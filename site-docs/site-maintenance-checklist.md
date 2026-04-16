# 站点维护清单

这份清单只写当前仓库里真实存在的工程入口。目的不是讲概念，而是让维护者知道“要改什么，就去哪个文件；改完以后，必须怎么验”。

## 1. 先判断改动落点

### 改首页 / 关于 / 下载 / 贡献者文案

优先改：

```text
assets/content/pages.json
```

只在以下场景再动代码：

- 新增区块类型：改 `assets/js/pages/static-page.js`
- 调整页面目录显隐：改 `assets/js/pages/page-toc.js`
- 调整下载动态卡片：改 `assets/js/pages/downloads-panel.js`

### 改导航、侧栏、默认文档、语言映射

只改：

```text
assets/site-config.json
```

这里负责：

- 顶部导航 `nav`
- 左侧文档侧栏 `sidebar`
- 默认打开文档 `site.defaultDocByShell`
- 中英文文档路径映射 `i18n.docPathAliases`
- 文档源仓库 `sourceRepo`

### 改公共按钮、搜索、主题、页头页脚

优先改：

```text
assets/js/components/site-shell.js
assets/js/core/preferences.js
assets/css/site-shell.css
assets/content/ui-text.json
```

分工是：

- `site-shell.js`：页头、搜索弹层、语言切换、主题切换、站点级交互
- `preferences.js`：语言 / 主题偏好写入与读取
- `site-shell.css`：壳层布局、导航、搜索、主题样式、全站卡片密度
- `ui-text.json`：公共 UI 文案，不要把按钮文案散落到组件里

### 改文档阅读流

优先检查：

```text
assets/js/pages/docs-page.js
assets/js/core/docs-routing.js
assets/js/entries/docs.js
```

分工是：

- `docs-page.js`：文档拉取、渲染、目录、面包屑、侧栏树
- `docs-routing.js`：`quickstart / docs / developer` 三类文档壳的路由规则
- `entries/docs.js`：文档页入口初始化，不要把页面逻辑塞回 HTML

## 2. 常见任务该怎么改

### 任务：新增一个首页卡片

最小步骤：

1. 改 `assets/content/pages.json`
2. 如果只是在已有卡片组里加卡片，不要改 JS
3. 如果出现新布局需求，再改 `assets/css/site-shell.css`

验收：

- 桌面端和移动端都没有断列
- 中英文切换后标题和按钮都正常
- 搜索能搜到新卡片标题

### 任务：新增一篇开发文档

最小步骤：

1. 新建 `site-docs/*.md`
2. 新建英文版 `site-docs/*.en.md`
3. 在 `assets/site-config.json` 的 `sidebar.zh / sidebar.en` 里挂到开发文档分组
4. 在 `i18n.docPathAliases` 里补路径映射

验收：

- `developer-docs.html` 能直接打开
- 切换中英文时能落到对应文档
- 文档页右侧目录可用

### 任务：修改搜索结果

优先改：

```text
assets/js/components/site-shell.js
```

要求：

- 先改索引来源，再改排序逻辑
- 页面结果和文档结果都要保留
- 不要把搜索逻辑写进单页组件

验收：

- 搜模块标题能命中首页卡片
- 搜文档标题能命中文档侧栏项
- 空结果有明确反馈

### 任务：修改主题切换

优先改：

```text
assets/js/components/site-shell.js
assets/js/core/preferences.js
assets/css/site-shell.css
```

要求：

- 主题值只允许 `light / dark`
- 点击后要持久化到 `localStorage`
- 视觉动画必须支持降级，不能依赖单一浏览器特性

验收：

- 刷新后主题保持
- 页头按钮的图标、标题和下一状态一致
- `prefers-reduced-motion` 下不应强行动画

## 3. 提交前必须执行的检查

### 数据文件

至少跑一次：

```bash
node -e "JSON.parse(require('fs').readFileSync('assets/content/pages.json','utf8')); JSON.parse(require('fs').readFileSync('assets/site-config.json','utf8')); JSON.parse(require('fs').readFileSync('assets/content/ui-text.json','utf8'));"
```

### 脚本语法

至少跑一次：

```bash
node --check assets/js/components/site-shell.js
node --check assets/js/pages/docs-page.js
node --check assets/js/pages/static-page.js
```

如果你改了别的入口文件，也要把对应文件补进检查。

### 页面实际查看

至少人工看这几页：

- `index.html`
- `downloads.html`
- `docs.html`
- `developer-docs.html`

最少检查这些动作：

- 顶部导航切换
- 中英文切换
- 亮暗切换
- 搜索打开和结果命中
- 文档页目录是否还存在

## 4. 当前仓库的硬要求

- 不要再引入第三种正文框架，页面只允许 `page` 和 `docs`
- 不要把静态页正文重新写回 HTML，优先维护 `assets/content/pages.json`
- 不要把公共 UI 文案硬编码进 JS，优先维护 `assets/content/ui-text.json`
- 不要把开发文档写到 `docs/` 里冒充前台文案，站点维护文档统一放 `site-docs/`
- 不要为了一个页面写单独样式文件，优先收敛到 `assets/css/site-shell.css`

## 5. 出问题时先查哪里

- 页面文案不对：先查 `assets/content/pages.json`
- 文档侧栏不对：先查 `assets/site-config.json`
- 搜索搜不到：先查 `assets/js/components/site-shell.js`
- 文档跳错语言：先查 `assets/site-config.json -> i18n.docPathAliases`
- 主题按钮状态不对：先查 `assets/js/core/preferences.js` 和 `assets/js/components/site-shell.js`
