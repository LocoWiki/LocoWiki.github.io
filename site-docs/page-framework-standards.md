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
- 文档
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

## 6. 当前工程里的强约束

这一节不是抽象建议，而是按当前仓库落地：

- `*.html` 只保留壳，不承载正文内容
- `page` 类页面正文统一来自 `assets/content/pages.json`
- `docs` 类页面正文统一来自外部 Markdown 仓库或本地 `site-docs/`
- 导航、侧栏、默认文档、文档语言映射统一来自 `assets/site-config.json`
- 站点级交互统一收敛在 `assets/js/components/site-shell.js`

如果一个需求需要同时改壳层 HTML、JSON 正文、组件逻辑，通常说明分层已经开始混乱，应该先回头检查归属。

## 7. 新增需求时的判断顺序

先按下面顺序判断，不要上来就改代码：

1. 这是内容问题，还是框架问题？
2. 如果只是内容问题，能不能只改 JSON 或 Markdown？
3. 如果必须改框架，是 `page` 渲染链路还是 `docs` 渲染链路？
4. 改完以后，中英文、主题切换、搜索、目录会不会被带坏？

只有第 2 步答案是否定的，才应该进入 JS 和 CSS 层。

## 8. 每类页面的最小改动面

### `page` 页面

允许的最小改动面：

- 文案：`assets/content/pages.json`
- 新区块渲染：`assets/js/pages/static-page.js`
- 区块样式：`assets/css/site-shell.css`

不应该改：

- `docs-page.js`
- `docs-routing.js`

### `docs` 页面

允许的最小改动面：

- 文档正文：外部仓库 Markdown 或 `site-docs/`
- 文档目录与路由：`assets/site-config.json`
- 文档壳交互：`assets/js/pages/docs-page.js`

不应该改：

- `assets/content/pages.json`

除非你同时在做站点信息架构调整。

## 9. 改动后的最低验收

无论改的是 `page` 还是 `docs`，至少验：

1. 当前页面能打开
2. 顶部导航高亮正常
3. 中英文切换不跳错页
4. 亮暗切换后没有样式残留
5. 站内搜索还能返回合理结果
