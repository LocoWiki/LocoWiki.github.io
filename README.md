# LocoWiki.github.io

LocoWiki 官网的源代码仓库。机器人知识内容存放在 [LocoWiki/LocoWiki](https://github.com/LocoWiki/LocoWiki) 的约定目录，本仓库负责网站展示、检索与部署。

线上地址：

- <https://locowiki.github.io>（GitHub Pages）
- <https://locowiki.com>（阿里云 ECS）

## 项目结构

```
assets/
  site-config.json          全局配置（导航、侧栏、默认文档路径）
  content/
    pages.json              静态页面文案
    ui-text.json            公共 UI 文案
    remote-docs-index.json  远程内容栏目索引快照
  js/
    core/                   核心逻辑（配置、i18n）
    components/             公共组件
    pages/                  页面渲染
    entries/                入口脚本
site-docs/                  站点维护与开发文档
```

## 内容更新

机器人知识内容请提交到 LocoWiki/LocoWiki 仓库；网站文案和维护文档留在本仓库。内容仓库主分支更新会通过 GitHub Actions 通知本仓库，同时刷新栏目索引和贡献者缓存；也可手动更新：

```bash
node scripts/update-remote-doc-index.mjs
```

跨仓库通知由内容仓库的 `LOCO_WIKI_SITE_DISPATCH_TOKEN` Secret 授权，并以 `wiki-updated` 事件触发本仓库的 `repository_dispatch` workflow。

## 部署

- **locowiki.github.io**：推送到 main 分支后由 GitHub Pages 自动构建；正文由浏览器从 `raw.githubusercontent.com` 读取
- **locowiki.com**：ECS 拉模式部署。[scripts/ecs-pull-deploy.sh](scripts/ecs-pull-deploy.sh) + systemd timer 每 2 分钟拉取本仓库并 rsync 到 `/var/www/locowiki`。CDN 缓存为 `max-age=300`，部署后 5 分钟内生效

GitHub 托管的 runner 无法连接 ECS 的 22 端口（`ssh-keyscan` 超时），因此 `.github/workflows/deploy.yml` 保持禁用。代码与内容都通过 Gitee 镜像中转：

- [mirror-gitee.yml](.github/workflows/mirror-gitee.yml)：网站仓库 push 后镜像到 `gitee.com/Hua-CM-014/locowiki-site`
- 内容仓库不需要 Actions：使用 Gitee 仓库的「管理 → 仓库镜像管理 → Pull 方向」，由 Gitee 服务器从 `LocoWiki/LocoWiki` 自动同步到 `gitee.com/Hua-CM-014/locowiki-content`（需 GitHub 私人令牌，勾选「自动从 GitHub 同步仓库」）

ECS 部署脚本还会把内容镜像同步到 `/var/www/locowiki/content/`，并将 `sourceRepo.contentBase` 设为 `/content/`：locowiki.com 的文档正文因此是同源读取，不再依赖 `raw.githubusercontent.com`；GitHub Pages 上的配置没有该字段，自动回退到 raw。

## License

[MIT](LICENSE)
