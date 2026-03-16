# LocoWiki.github.io

本仓库用于托管 LocoWiki 的静态展示站点（GitHub Pages / `github.io`）。

- 入口：`index.html`
- 文档浏览：`docs.html?path=README.md`（从源仓库实时拉取 Markdown 并渲染）
- 飞书知识库：`readmydock.html`（站内内嵌 + 飞书事件同步状态）
- 配置：`assets/site-config.json`

## 飞书事件同步（长连接推荐）

仓库已内置两套方案，用于把飞书事件同步到站点状态面板：

- 工作流：`.github/workflows/feishu-readmydock-sync.yml`
- 状态脚本：`scripts/update-feishu-sync-status.mjs`
- 长连接方案（推荐）：`scripts/feishu-ws-relay/README.md`
- 回调中转方案（备选）：`scripts/feishu-webhook-relay/README.md`

触发事件类型：`repository_dispatch` 的 `feishu_wiki_sync`。
