# LocoWiki.github.io

LocoWiki 的静态展示站点仓库，部署到 GitHub Pages。

这次重构后的目标很明确：

- 公共壳层模块化：导航、页脚、搜索、设置和文档侧栏拆成独立模块
- 页面内容数据化：首页、关于、贡献者、下载页文案集中在 `assets/content/pages.json`
- 文档阅读独立化：Markdown 拉取、链接改写、目录同步和翻页逻辑独立维护
- 页面框架标准化：站点只保留 `page` 和 `docs` 两种正文框架
- 去掉历史耦合：移除飞书同步链路、状态文件、relay 脚本和字体切换逻辑

## 页面入口

- 首页：`index.html`
- 快速上手：`quickstart.html`
- 专题文档：`docs.html`
- 下载页：`downloads.html`
- 关于页：`about.html`
- 贡献者页：`contributors.html`

## 当前目录结构

- `assets/content/`
  - `pages.json`：静态页面文案与区块数据
  - `ui-text.json`：公共 UI 文案
- `assets/js/core/`
  - 配置、偏好、i18n、文档路径映射
- `assets/js/components/`
  - 公共壳层组件
- `assets/js/pages/`
  - 静态页渲染、文档页渲染、目录和动态区块
- `assets/js/entries/`
  - 各 HTML 页入口脚本
- `docs/`
  - 前端维护文档

## 后续怎么加新文本

如果只是改首页、关于页、贡献者页、下载页的文案或卡片：

1. 编辑 `assets/content/pages.json`
2. 保持现有区块结构
3. 只有在需要新增一种全新页面区块时，再修改 `assets/js/pages/static-page.js`

如果是改导航、侧栏、默认文档路径：

1. 编辑 `assets/site-config.json`

如果是改页面归属标准、来源类型或框架类型：

1. 编辑 `assets/site-config.json` 里的 `pageStandards`

如果是改公共按钮、设置面板、搜索等 UI 文案：

1. 编辑 `assets/content/ui-text.json`

## 本地预览

```bash
python -m http.server 8080
```

然后访问 `http://localhost:8080`。

## License

仓库代码遵循 [MIT License](LICENSE)。
