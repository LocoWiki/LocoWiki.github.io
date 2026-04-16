# 页面框架标准

这套站点现在只保留两种正文框架：

- `page`：内部说明页 / 落地页框架
- `docs`：连续阅读型文档框架

不要再按“是不是内部内容”决定页面结构。应该按“用户是在扫读入口信息，还是在持续阅读正文”来决定。

## 1. page 框架

适用页面：

- 首页
- 关于
- 资源下载
- 贡献者

数据来源：

- `assets/content/pages.json`

标准结构：

1. `hero`
2. 可选 `metrics`
3. 可选 `callout`
4. `sections[]`
5. 可选 `cta`

实现位置：

- HTML 壳：`*.html` 中 `data-layout="page"`
- 入口：`assets/js/entries/static-page.js`
- 渲染：`assets/js/pages/static-page.js`

适用场景：

- 概览说明
- 导航入口
- 操作引导
- 动态信息面板

不要用于：

- 长篇教程
- 章节式连续阅读
- 需要上一页 / 下一页的文章流

## 2. docs 框架

适用页面：

- 快速上手
- 专题文档
- 开发文档

数据来源：

- 外部 Markdown 仓库
- 本仓库 `site-docs/`

标准结构：

1. `meta`
2. `content`
3. 可选 `toc`
4. 可选 `pager`

实现位置：

- HTML 壳：`*.html` 中 `data-layout="docs"`
- 入口：`assets/js/entries/docs.js`
- 渲染：`assets/js/pages/docs-page.js`

适用场景：

- 教程
- 规则文档
- 维护文档
- 连续阅读材料

不要用于：

- 首页式卡片导航
- 贡献者面板
- 下载入口聚合页

## 3. 判定规则

新增页面时，先问两个问题：

1. 这页的主任务是“快速概览和跳转”还是“持续阅读正文”？
2. 内容来源是 JSON 区块，还是 Markdown 文档？

规则：

- 概览 / 卡片 / 操作入口：用 `page`
- Markdown 正文 / 文档目录 / 翻页流：用 `docs`

“内容是不是内部维护”不是判定条件。

例如：

- `开发文档` 虽然是内部写的，但它仍然是 `docs`
- `贡献者` 虽然有动态数据，但它仍然是 `page`

## 4. 当前显式注册

页面标准配置统一维护在：

```text
assets/site-config.json -> pageStandards
```

当前约定是：

- `index.html / about.html / downloads.html / contributors.html` => `page`
- `quickstart.html / docs.html / developer-docs.html` => `docs`

初始化站点壳时会把标准写到 `body.dataset`：

- `data-standard-key`
- `data-standard-frame`
- `data-standard-source`
- `data-standard-shell`（仅 docs shell 页面）

## 5. 维护要求

新增页面或重构页面时：

1. 先更新 `assets/site-config.json -> pageStandards`
2. 再决定走 `static-page.js` 还是 `docs-page.js`
3. 不要混写第三种正文框架
4. 如果只是新增 `page` 区块类型，再改 `assets/js/pages/static-page.js`
5. 如果只是新增 `docs` 文章，不要改框架层
