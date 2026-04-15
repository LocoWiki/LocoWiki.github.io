# 飞书知识库同步说明

本文档描述飞书内容同步到源仓库 `wiki/` 目录的维护方式，以及相关状态文件和导航清单的用途。

## 1. 同步链路

1. 飞书事件触发（Webhook 或长连接）
2. relay 将事件转发到 GitHub `repository_dispatch`（`feishu_wiki_sync`）
3. 工作流 `.github/workflows/feishu-wiki-sync.yml` 执行
4. 脚本 `scripts/update-feishu-sync-status.mjs` 更新 `assets/feishu-sync-status.json`
5. 脚本 `scripts/generate-wiki-manifest.mjs` 生成 `wiki/_manifest.json`
6. 前台页面 `docs.html?path=__feishu_wiki__` 映射到 `wiki/` 入口文档并按 Markdown 渲染（旧地址 `feishu-wiki.html` / `readmydock.html` 可兼容跳转）

## 2. 工作流与脚本

- 工作流：`.github/workflows/feishu-wiki-sync.yml`
- 状态写入脚本：`scripts/update-feishu-sync-status.mjs`
- 状态文件：`assets/feishu-sync-status.json`
- 导航清单脚本：`scripts/generate-wiki-manifest.mjs`
- 导航清单文件：`wiki/_manifest.json`

手动触发工作流时可输入：

- `event_type`：显示在状态中的事件类型（建议写业务语义，如 `wiki.page.updated`）
- `message`：对本次同步的简要说明（面向阅读者，避免调试术语）

## 3. 接入方案

- 长连接（推荐）：`scripts/feishu-ws-relay/README.md`
- Webhook 中转（备选）：`scripts/feishu-webhook-relay/README.md`

## 4. 页面文案约定

- 前台优先展示同步后的 Markdown 文档内容
- 不在前台暴露 workflow 名称、脚本路径、token 校验细节
- 详细维护流程统一写在 `docs/` 或 `scripts/*/README.md`

## 5. 生成 wiki/_manifest.json

可在源仓库工作流中调用本站仓库提供的脚本，或将同内容脚本同步到源仓库后执行：

```bash
node scripts/generate-wiki-manifest.mjs --repo-root . --wiki-dir wiki --entry "wiki/【必读】LocoWiki介绍.md"
```

生成结果说明：

- `entryDocPath`：站点里 `docs.html?path=__feishu_wiki__` 的默认落点
- `items[].title`：侧栏文档标题
- `items[].path`：对应 Markdown 路径
- `items[].order`：侧栏顺序
- `items[].hasChildren`：该文档是否存在下一级标题标记
- `items[].headingCount`：文档内二级标题数量
