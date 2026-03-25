# LocoWiki.github.io

LocoWiki 的静态展示站点仓库（GitHub Pages）。

本站用于聚合和展示足式机器人相关资料入口，前台聚焦“访客阅读体验”，维护说明集中在 `docs/`。

## 项目定位

- 面向对象：ROBOCON 备赛成员、机器人方向学习者、科研与工程实践者
- 核心目标：提供统一入口，快速访问规则、技术分享、论文与阅读索引
- 展示方式：前台页面 + 动态拉取源仓库 Markdown（不在本站重复存储资料文件）

## 页面入口

- 首页：`index.html`
- 文档页：`docs.html?path=README.md`
- 下载页：`downloads.html`
- 飞书知识库页：`feishu-wiki.html`（兼容旧地址 `readmydock.html`）
- 关于页：`about.html`

## 目录说明

- `assets/`：样式、脚本、图片、站点配置、同步状态 JSON
- `.github/workflows/`：自动化工作流（含飞书同步状态更新）
- `scripts/`：同步与维护脚本（长连接 relay / webhook relay / 状态写入）
- `docs/`：开发与维护文档（前台不展示技术细节）

## 文档加载机制

`docs.html` 会根据 `assets/site-config.json` 中的 `sourceRepo` 配置，实时拉取源仓库 Markdown 并渲染。

当前默认源仓库：

- Owner: `Lain-Ego0`
- Repo: `LocoWiki`
- Branch: `main`

## 飞书知识库同步

前台仅展示“最近同步时间与简要说明”。

详细维护文档见：

- `docs/feishu-sync.md`
- `scripts/feishu-ws-relay/README.md`
- `scripts/feishu-webhook-relay/README.md`

相关文件：

- 工作流：`.github/workflows/feishu-wiki-sync.yml`
- 状态脚本：`scripts/update-feishu-sync-status.mjs`
- 状态文件：`assets/feishu-sync-status.json`

## 本地预览

可在仓库根目录启动本地静态服务：

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
