# Feishu Webhook Relay (Example)

这个目录提供一个 Cloudflare Worker 示例，用于把飞书 Webhook 事件转发为 GitHub 的 `repository_dispatch` 事件。

## 目标

1. 飞书 Webhook 触发 Worker
2. Worker 调用 GitHub API 触发 `feishu_wiki_sync`
3. GitHub Actions 更新 `assets/feishu-sync-status.json`
4. `readmydock.html` 页面显示最新同步状态

## 文件

- `worker.js`：可直接放到 Cloudflare Workers（Modules 语法）

## 必需环境变量

- `GITHUB_OWNER`
- `GITHUB_REPO`
- `GITHUB_TOKEN`（具备 repo dispatch 权限）
- `FEISHU_SPACE_URL`（可选，用于状态展示）
- `FEISHU_WEBHOOK_SECRET`（可选，示例中用 `x-feishu-token` 做简单校验）

## 注意

- 示例代码仅做中转演示，不包含飞书签名验签的完整实现。
- 生产环境建议加入重放保护、来源 IP 校验、结构化日志与告警。
