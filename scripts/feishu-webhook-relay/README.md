# Feishu Webhook Relay (Step-by-step)

本目录用于把飞书 Webhook 事件转发到 GitHub Actions，最终更新站点里的同步状态文件 `assets/feishu-sync-status.json`。

> 如果你在飞书保存“请求地址”时持续出现 3 秒超时，建议改用长连接方案：`../feishu-ws-relay/README.md`

## 整体链路

1. 飞书触发 Webhook
2. Cloudflare Worker 收到请求并调用 GitHub `repository_dispatch`
3. 工作流 `.github/workflows/feishu-readmydock-sync.yml` 执行
4. 脚本 `scripts/update-feishu-sync-status.mjs` 写入状态 JSON
5. `readmydock.html` 显示最新同步时间与来源

## 0. 先做环境自检

在仓库根目录执行：

```bash
git --version
node -v
npm -v
npx --version
wrangler --version
```

判定标准：

- `git/node/npm/npx` 能输出版本即可
- 如果 `wrangler` 未安装，用下面命令安装

```bash
npm i -g wrangler
```

## 1. GitHub 侧准备

### 1.1 确认仓库中已有这些文件

- `.github/workflows/feishu-readmydock-sync.yml`
- `scripts/update-feishu-sync-status.mjs`
- `assets/feishu-sync-status.json`
- `scripts/feishu-webhook-relay/worker.js`

### 1.2 准备一个 GitHub Token

需要一个可调用仓库 dispatch API 的 Token，供 Worker 使用。

- 仓库为私有：建议 Classic PAT，勾选 `repo`
- 仓库为公开：Classic PAT 可用 `public_repo`（也可直接 `repo`）

后续会把它保存为 Worker Secret（不是写进代码）。

### 1.3 记下仓库信息

- `GITHUB_OWNER`: `Lain-Ego0`
- `GITHUB_REPO`: `LocoWiki.github.io`

## 2. 部署 Cloudflare Worker

以下命令在 `scripts/feishu-webhook-relay` 目录执行：

```bash
cd scripts/feishu-webhook-relay
```

### 2.1 登录 Cloudflare

```bash
wrangler login
```

浏览器授权成功后继续。

### 2.2 检查 `wrangler.toml`

当前仓库已经有示例：

```toml
name = "locowiki-feishu-relay"
main = "worker.js"
compatibility_date = "2026-03-16"
workers_dev = true
```

可按需修改 `name`，避免和你账号里其他 Worker 重名。

### 2.3 写入 Worker Secrets（必做）

```bash
wrangler secret put GITHUB_TOKEN
wrangler secret put FEISHU_WEBHOOK_SECRET
```

命令会提示输入值：

- `GITHUB_TOKEN`: 你在 1.2 生成的 GitHub Token
- `FEISHU_WEBHOOK_SECRET`: 你自定义的一串高强度随机字符串（后面飞书端的 `Verification Token` 要配置成同样的值）

### 2.4 配置普通变量（推荐）

编辑 `wrangler.toml`，增加：

```toml
[vars]
GITHUB_OWNER = "Lain-Ego0"
GITHUB_REPO = "LocoWiki.github.io"
FEISHU_SPACE_URL = "https://wcn9j5638vrr.feishu.cn/wiki/space/7570988375279517715?ccm_open_type=lark_wiki_spaceLink&open_tab_from=wiki_home"
```

### 2.5 发布 Worker

```bash
wrangler deploy
```

记下输出 URL（例如 `https://locowiki-feishu-relay.<subdomain>.workers.dev`）。

## 3. 飞书端配置 Webhook

在飞书开发者后台（应用详情）按下面配置：

1. 进入 `开发配置 > 事件与回调 > 加密策略`
2. `Verification Token` 设置为与你的 `FEISHU_WEBHOOK_SECRET` 完全一致
3. `Encrypt Key` 暂时留空（当前示例未实现加密事件解密）
4. 进入 `开发配置 > 事件与回调 > 事件配置`
5. 订阅方式选择“将事件发送至开发者服务器”
6. 请求地址填写第 2.5 步得到的 Worker URL，然后保存
7. 按需添加事件（建议先选一个容易触发的 v2.0 事件做联调）
8. 发布应用使配置生效

注意：

- `worker.js` 里做的是简化校验：优先读 `x-feishu-token`，也支持飞书事件体里的 `token/header.token`
- URL 保存时飞书会发 `url_verification`，当前代码支持 challenge 回显

## 4. 联调与验收（按顺序）

### 4.1 先本地触发一次 Worker（不经过飞书）

将下面的 `<WORKER_URL>` 和 `<TOKEN>` 替换成你的值：

```bash
curl -X POST "<WORKER_URL>" \
  -H "content-type: application/json" \
  -d '{"schema":"2.0","header":{"event_type":"wiki.page.updated","token":"<TOKEN>"},"event":{"type":"wiki.page.updated"}}'
```

成功时应返回：

```json
{"ok":true,"dispatched":true,"eventType":"wiki.page.updated"}
```

### 4.2 检查 GitHub Actions

打开仓库 `Actions`，确认 `Feishu Readmydock Sync` 出现一次新运行并成功。

### 4.3 检查状态文件

查看 `assets/feishu-sync-status.json` 是否被更新，重点字段：

- `lastSyncAt`
- `source`（形如 `repository_dispatch:feishu_wiki_sync`）
- `eventType`
- `message`
- `receivedAt`

### 4.4 检查页面展示

访问站点：

- `readmydock.html`

确认页面上的“Webhook 同步状态”已更新。

## 5. 常见问题排查

### 5.1 Worker 返回 `401 invalid_webhook_secret`

- 原因：飞书回调里的 `token`（或你手工请求时的 `x-feishu-token`）与 Worker 的 `FEISHU_WEBHOOK_SECRET` 不一致
- 处理：重新核对飞书 `Verification Token` 与 `wrangler secret put FEISHU_WEBHOOK_SECRET` 的值

### 5.2 Worker 返回 `502 github_dispatch_failed`

- 原因：GitHub Token 无权限或仓库 owner/repo 写错
- 处理：
  - 确认 `GITHUB_OWNER/GITHUB_REPO` 正确
  - 重新生成 PAT（至少含 `repo` 或 `public_repo`）
  - 重新 `wrangler secret put GITHUB_TOKEN`

### 5.3 Actions 没有触发

- 原因：dispatch 事件类型不匹配
- 处理：确认 Worker 里 `event_type` 固定为 `feishu_wiki_sync`，且 workflow 也监听该类型

### 5.4 页面仍显示“未配置自动同步”

- 原因：`assets/feishu-sync-status.json` 未成功更新或页面缓存
- 处理：
  - 打开仓库确认 JSON 最近一次提交时间
  - 强制刷新页面（Ctrl/Cmd + Shift + R）
  - 检查 `assets/site-config.json` 的 `integrations.readmydock.syncStatusUrl`

### 5.5 Worker 返回 `encrypted_payload_not_supported`

- 原因：飞书端配置了 `Encrypt Key`，而当前示例未实现解密
- 处理：在飞书 `开发配置 > 事件与回调 > 加密策略` 中先关闭 `Encrypt Key`

## 6. 安全建议（生产环境）

- 不要把 Token 写入仓库明文文件
- 至少保留 `Verification Token`（或 `x-feishu-token`）校验
- 建议补充飞书签名验签、防重放（时间戳+nonce）和访问频率限制
- 给 Worker 增加失败告警（如日志平台/消息通知）

## 7. 快速回滚

如果你临时不想接收 Webhook：

1. 在飞书端停用回调
2. 或在 Cloudflare 把 Worker 路由移除/停用
3. 需要时仍可手动触发 workflow（`workflow_dispatch`）更新状态
