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

机器人知识内容请提交到 LocoWiki/LocoWiki 仓库；网站文案和维护文档留在本仓库。Markdown 变更会通过 GitHub Actions 通知本仓库刷新栏目索引；也可手动更新：

```bash
node scripts/update-remote-doc-index.mjs
```

跨仓库通知由内容仓库的 `LOCO_WIKI_SITE_DISPATCH_TOKEN` Secret 授权，并以 `wiki-updated` 事件触发本仓库的 `repository_dispatch` workflow。

## 部署

- **locowiki.github.io**：推送到 main 分支后自动构建
- **locowiki.com**：手动同步至 ECS（`root@47.107.154.165:/var/www/locowiki`），同步后在 CDN 控制台执行目录刷新

## License

[MIT](LICENSE)
