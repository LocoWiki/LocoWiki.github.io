# LocoWiki.github.io

本仓库用于托管 LocoWiki 的静态展示站点（GitHub Pages / `github.io`）。

- 入口：`index.html`
- 文档浏览：`docs.html?path=README.md`（从源仓库实时拉取 Markdown 并渲染）
- 飞书知识库：`readmydock.html`（站内内嵌 + Webhook 同步状态）
- 配置：`assets/site-config.json`

## 飞书 Webhook（可选）

仓库已内置一套轻量方案，用于把飞书事件同步到站点状态面板：

- 工作流：`.github/workflows/feishu-readmydock-sync.yml`
- 状态脚本：`scripts/update-feishu-sync-status.mjs`
- 中转示例：`scripts/feishu-webhook-relay/worker.js`

触发事件类型：`repository_dispatch` 的 `feishu_wiki_sync`。
