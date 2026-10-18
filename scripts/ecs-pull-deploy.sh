#!/usr/bin/env bash
# LocoWiki 网站（locowiki.com）ECS 拉模式部署脚本
#
# 背景：GitHub 托管的 Actions runner 无法连接 ECS 的 22 端口（ssh-keyscan 超时），
# 所以改为由 ECS 主动拉取本仓库，再 rsync 到 Nginx 站点目录。
#
# 一次性安装（在 ECS 上以 root 执行）：
#
#   install -m 755 ecs-pull-deploy.sh /usr/local/bin/locowiki-deploy.sh
#   install -m 644 systemd/locowiki-deploy.service /etc/systemd/system/
#   install -m 644 systemd/locowiki-deploy.timer  /etc/systemd/system/
#
#   systemctl daemon-reload
#   systemctl enable --now locowiki-deploy.timer
#   systemctl start locowiki-deploy.service
#   journalctl -u locowiki-deploy.service -n 40 --no-pager
#
# 也可以直接从仓库下载（GitHub raw 不通时改用镜像）：
#
#   curl -fsSL -o /usr/local/bin/locowiki-deploy.sh \
#     https://raw.githubusercontent.com/LocoWiki/LocoWiki.github.io/main/scripts/ecs-pull-deploy.sh
#   chmod +x /usr/local/bin/locowiki-deploy.sh
#   curl -fsSL -o /etc/systemd/system/locowiki-deploy.service \
#     https://raw.githubusercontent.com/LocoWiki/LocoWiki.github.io/main/scripts/systemd/locowiki-deploy.service
#   curl -fsSL -o /etc/systemd/system/locowiki-deploy.timer \
#     https://raw.githubusercontent.com/LocoWiki/LocoWiki.github.io/main/scripts/systemd/locowiki-deploy.timer
#
# 依赖：git、rsync、nginx、flock（util-linux）、python3。
# 若 ECS 访问 github.com 不稳定，可在 service 里设置
#   Environment=REPO_URL=https://<镜像>/https://github.com/LocoWiki/LocoWiki.github.io.git
# 例如 ghproxy 类镜像；首次部署前先执行 `git ls-remote "$REPO_URL" main` 验证。
#
# 文档正文同源：
#   脚本还会从 CONTENT_REPO_URL（默认 Gitee 上的 locowiki-content 镜像）拉取内容仓库，
#   rsync 到 $WEB_ROOT/content/，并把 assets/site-config.json 的
#   sourceRepo.contentBase 设为 /content/。这样访客不再需要访问
#   raw.githubusercontent.com，国内网络也能加载文档。置空 CONTENT_REPO_URL 可关闭。
#
# 手动执行一次：locowiki-deploy.sh
# 查看下次触发：systemctl list-timers locowiki-deploy.timer

set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/LocoWiki/LocoWiki.github.io.git}"
BRANCH="${BRANCH:-main}"
SRC_DIR="${SRC_DIR:-/srv/locowiki-src}"
WEB_ROOT="${WEB_ROOT:-/var/www/locowiki}"
LOCK_FILE="${LOCK_FILE:-/var/lock/locowiki-deploy.lock}"
# 内容仓库镜像（Gitee），用于把文档正文以同源方式提供；置空可关闭
CONTENT_REPO_URL="${CONTENT_REPO_URL:-https://gitee.com/Hua-CM-014/locowiki-content.git}"
CONTENT_SRC_DIR="${CONTENT_SRC_DIR:-/srv/locowiki-content-src}"
CONTENT_BASE_PATH="${CONTENT_BASE_PATH:-content}"

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "another locowiki deploy is already running, skip"
  exit 0
fi

if [ ! -d "$SRC_DIR/.git" ]; then
  mkdir -p "$(dirname "$SRC_DIR")"
  git clone --depth=1 --branch "$BRANCH" "$REPO_URL" "$SRC_DIR"
else
  git -C "$SRC_DIR" fetch --depth=1 origin "$BRANCH"
  git -C "$SRC_DIR" reset --hard "origin/$BRANCH"
fi

mkdir -p "$WEB_ROOT"
rsync -a --delete \
  --exclude='.git' \
  --exclude='.github' \
  --exclude='.vscode' \
  --exclude='.codex' \
  --exclude='.gitignore' \
  --exclude='node_modules' \
  --exclude='.wrangler' \
  --exclude='test-results' \
  --exclude='.well-known' \
  --exclude="$CONTENT_BASE_PATH" \
  "$SRC_DIR"/ "$WEB_ROOT"/

# 文档正文同源：从 Gitee 内容镜像拉取并同步到 $WEB_ROOT/content/
if [ -n "$CONTENT_REPO_URL" ]; then
  if [ ! -d "$CONTENT_SRC_DIR/.git" ]; then
    mkdir -p "$(dirname "$CONTENT_SRC_DIR")"
    git clone --depth=1 --branch "$BRANCH" "$CONTENT_REPO_URL" "$CONTENT_SRC_DIR"
  else
    git -C "$CONTENT_SRC_DIR" fetch --depth=1 origin "$BRANCH"
    git -C "$CONTENT_SRC_DIR" reset --hard "origin/$BRANCH"
  fi

  mkdir -p "$WEB_ROOT/$CONTENT_BASE_PATH"
  rsync -a --delete \
    --exclude='.git' \
    --exclude='.github' \
    "$CONTENT_SRC_DIR"/ "$WEB_ROOT/$CONTENT_BASE_PATH"/

  # 仅 ECS 生效：让前端从同源 /content/ 读取 Markdown 与图片；
  # GitHub Pages 上的配置没有该字段，仍回退到 raw.githubusercontent.com
  python3 - "$WEB_ROOT/assets/site-config.json" "$CONTENT_BASE_PATH" <<'PY'
import json
import pathlib
import sys

config_path = pathlib.Path(sys.argv[1])
base = "/" + sys.argv[2].strip("/") + "/"
data = json.loads(config_path.read_text(encoding="utf-8"))
data.setdefault("sourceRepo", {})["contentBase"] = base
config_path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
PY

  echo "content synced from $CONTENT_REPO_URL ($(git -C "$CONTENT_SRC_DIR" rev-parse --short HEAD))"
fi

# 站点是纯静态文件，nginx -t 只做配置校验；失败时保留旧文件并让 timer 报错
nginx -t
systemctl reload nginx

echo "deployed $(git -C "$SRC_DIR" rev-parse --short HEAD) to $WEB_ROOT at $(date -Is)"
