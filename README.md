# LocoWiki.github.io

LocoWiki 的静态展示站点仓库（GitHub Pages）。

本站用于聚合和展示足式机器人相关资料入口，前台聚焦“访客阅读体验”，维护说明集中在 `docs/`。

## 项目定位

- 面向对象：ROBOCON 备赛成员、机器人方向学习者、科研与工程实践者
- 核心目标：提供统一入口，快速访问规则、技术分享、论文学习清单与网络开源项目
- 展示方式：前台页面 + 动态拉取源仓库 Markdown（不在本站重复存储资料文件）

## 页面入口

- 首页：`index.html`
- 文档页：`docs.html?path=README.md`
- 下载页：`downloads.html`
- 飞书知识库：`docs.html?path=__feishu_wiki__`（当前会映射到源仓库 `wiki/` 目录入口文档，兼容旧地址 `feishu-wiki.html` / `readmydock.html`）
- 关于页：`about.html`

## 目录说明

- `assets/`：样式、脚本、图片、站点配置、同步状态 JSON
- `.github/workflows/`：自动化工作流（含飞书同步状态更新）
- `scripts/`：同步与维护脚本（长连接 relay / webhook relay / 状态写入）
- `docs/`：开发与维护文档（前台不展示技术细节）

## 文档加载机制

`docs.html` 会根据 `assets/site-config.json` 中的 `sourceRepo` 配置，实时拉取源仓库 Markdown 并渲染。

当前默认源仓库：

- Owner: `LocoWiki`
- Repo: `LocoWiki`
- Branch: `main`

## 飞书知识库同步

飞书内容建议同步导出到源仓库 `wiki/` 目录，前台继续按 Markdown 文档方式渲染。

建议同时在源仓库生成 `wiki/_manifest.json`，前端会优先读取它来渲染知识库文档导航；若缺失则退回站点内的静态入口。

详细维护文档见：

- `docs/feishu-sync.md`
- `scripts/feishu-ws-relay/README.md`
- `scripts/feishu-webhook-relay/README.md`
- `scripts/generate-wiki-manifest.mjs`

相关文件：

- 工作流：`.github/workflows/feishu-wiki-sync.yml`
- 状态脚本：`scripts/update-feishu-sync-status.mjs`
- 状态文件：`assets/feishu-sync-status.json`

## 本地预览

可在仓库根目录启动本地静态服务：
 1000 行小很多，
```bash
python3 -m http.server 8080
```

然后访问：`http://localhost:8080`

## 文案治理约定

- 前台页面只保留面向访客的信息
- 维护/调试/部署说明统一写在 `docs/` 或 `scripts/*/README.md`
- 历史命名 `Readmydock` 已在前台文案统一为“飞书知识库”

## 引用资料与版权声明

1. 内容来源
- 本站展示内容主要来自源仓库 [LocoWiki](https://github.com/LocoWiki/LocoWiki) 及其索引。
- 页面中的外部工具链接（如 MuJoCo、Webots、ROS 2 等）指向各官方站点。

2. 版权归属
- 仓库中收录或链接的论文、PPT、规则文档等资料，版权归原作者或原发布机构所有。
- 本站仅做学习与检索索引，不主张第三方资料版权。

3. 第三方组件
- `assets/vendor/marked.umd.js` 来自 `marked` 项目（MIT License）。

如有引用不当或侵权内容，请在仓库 Issue 提交说明，我们会及时处理。

## License

本仓库代码遵循 [MIT License](LICENSE)。

## Git message
feat: 新特性
fix: 修改问题
refactor: 代码重构
docs: 文档修改
style: 代码格式修改, 注意不是 css 修改
test: 测试用例修改
chore: 其他修改, 比如构建流程, 依赖管理.
scope: commit 影响的范围, 比如: route, component, utils, build...
subject: commit 的概述, 建议符合 50/72 formatting
body: commit 具体修改内容, 可以分为多行, 建议符合 50/72 formatting
footer: 一些备注, 通常是 BREAKING CHANGE 或修复的 bug 的链接.

使用格式：[类型]更新内容简述
