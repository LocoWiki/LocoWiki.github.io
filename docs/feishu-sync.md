# 飞书知识库同步说明

本文档描述本站“飞书知识库同步状态”面板的维护方式。

## 1. 同步链路

1. 飞书事件触发（Webhook 或长连接）
2. relay 将事件转发到 GitHub `repository_dispatch`（`feishu_wiki_sync`）
3. 工作流 `.github/workflows/feishu-wiki-sync.yml` 执行
4. 脚本 `scripts/update-feishu-sync-status.mjs` 更新 `assets/feishu-sync-status.json`
5. 前台页面 `docs.html?path=__feishu_wiki__` 读取并展示最近同步状态（旧地址 `feishu-wiki.html` / `readmydock.html` 可兼容跳转）

## 2. 工作流与脚本

- 工作流：`.github/workflows/feishu-wiki-sync.yml`
- 状态写入脚本：`scripts/update-feishu-sync-status.mjs`
- 状态文件：`assets/feishu-sync-status.json`

手动触发工作流时可输入：

- `event_type`：显示在状态中的事件类型（建议写业务语义，如 `wiki.page.updated`）
- `message`：对本次同步的简要说明（面向阅读者，避免调试术语）

## 3. 接入方案

- 长连接（推荐）：`scripts/feishu-ws-relay/README.md`
- Webhook 中转（备选）：`scripts/feishu-webhook-relay/README.md`

## 4. 页面文案约定

- 前台只展示“是否同步、最近时间、简短说明”
- 不在前台暴露 workflow 名称、脚本路径、token 校验细节
- 详细维护流程统一写在 `docs/` 或 `scripts/*/README.md`
