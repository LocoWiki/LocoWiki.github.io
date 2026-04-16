# 如何新增文章

这篇文档说明当前站点里“新增文章”要改哪些地方，以及哪些内容是在本仓库维护，哪些内容是在外部内容仓库维护。

在继续之前，先确认你要新增的是哪种正文框架：

- 说明页 / 落地页：`page`
- 文档阅读页：`docs`

完整规则见：

```text
site-docs/page-framework-standards.md
```

## 先分清两类内容

### 1. 文档文章

这类内容会显示在：

- 快速上手
- 飞书同步文档
- 开发文档

其中：

- `快速上手` 和 `飞书同步文档` 默认读取 `assets/site-config.json` 里 `sourceRepo` 指向的外部仓库
- `开发文档` 读取当前站点仓库里的本地 Markdown 文件，也就是 `site-docs/` 目录

### 2. 静态页面文案

这类内容会显示在：

- 首页
- 资源下载
- 关于
- 贡献者

这部分不走 Markdown，而是直接维护在 `assets/content/pages.json`

它们统一属于 `page` 框架。

## 新增一篇“快速上手”或“飞书同步文档”文章

### 步骤 1：先在内容仓库里新增 Markdown 文件

当前站点的外部文档来源配置在：

```json
assets/site-config.json -> sourceRepo
```

也就是说，真正的文档正文不是写在这个站点仓库，而是写在 `sourceRepo` 指向的仓库里。

例如你可以在内容仓库中新增：

```text
competition-rules/new-topic.md
```

或者：

```text
wiki/my-topic.md
```

规则是：

- 路径以 `wiki/` 开头的，会被归到 `飞书同步文档`
- 其他普通 Markdown 路径，默认会归到 `快速上手`

### 步骤 2：把它挂到侧边栏

编辑：

```text
assets/site-config.json
```

在 `sidebar.zh` 和 `sidebar.en` 里新增条目。

例如新增一篇中文快速上手文章：

```json
{
  "title": "新的文章标题",
  "path": "competition-rules/new-topic.md"
}
```

如果是飞书同步文档，就把 `path` 改成 `wiki/...`

### 步骤 3：如果有英文版，再补语言映射

如果中英文文件名不同，就编辑：

```text
assets/site-config.json -> i18n.docPathAliases
```

例如：

```json
"competition-rules/new-topic.md": "competition-rules/new-topic.en.md"
```

这样切换语言时，站点会自动跳到对应英文文档。

### 步骤 4：如果你想把它设成默认入口

编辑：

```text
assets/site-config.json -> site.defaultDocByShell
```

例如：

```json
"quickstart": "competition-rules/new-topic.md"
```

或者：

```json
"docs": "wiki/my-topic.md"
```

## 新增一篇“开发文档”文章

开发文档是专门给这个站点仓库自己用的，不依赖外部内容仓库。

虽然开发文档是内部维护的，但它仍然属于 `docs` 框架。

### 步骤 1：在本仓库新增 Markdown

把新文件放到：

```text
site-docs/
```

例如：

```text
site-docs/how-to-add-pages.md
```

### 步骤 2：把它挂到开发文档侧栏

编辑：

```text
assets/site-config.json
```

在 `sidebar.zh` 和 `sidebar.en` 的 `开发文档 / Developer Docs` 分组里新增条目。

例如：

```json
{
  "title": "如何新增页面",
  "path": "site-docs/how-to-add-pages.md"
}
```

如果有英文版，再补：

```json
"site-docs/how-to-add-pages.md": "site-docs/how-to-add-pages.en.md"
```

## 修改首页、关于、贡献者、下载页文案

这类不是文章，不需要改 Markdown。

直接编辑：

```text
assets/content/pages.json
```

这里维护的是：

- 首页 Hero
- 首页卡片
- 关于页说明
- 贡献者页说明
- 下载页说明

## 一个最小新增示例

如果你要新增一篇“开发文档”文章，最小操作就是：

1. 新建 `site-docs/how-to-add-pages.md`
2. 在 `assets/site-config.json` 的 `sidebar.zh` 开发文档分组里加一条
3. 如果有英文版，再在 `sidebar.en` 和 `docPathAliases` 里补一条

如果你要新增一篇“快速上手”文章，最小操作就是：

1. 去外部内容仓库新建 `.md`
2. 回到这个站点仓库，编辑 `assets/site-config.json`
3. 把新文章挂进 `sidebar.zh / sidebar.en`

## 当前建议

如果内容是：

- 仓库资料、规则、论文、项目整理：放外部内容仓库
- 站点维护方法、页面结构、前端约定：放 `site-docs/`

## 提交前最低自检

不要只看 Markdown 有没有渲染出来，至少再做下面这些检查：

1. 在 `assets/site-config.json` 里确认中文和英文侧栏都挂上了
2. 如果存在英文版，确认 `i18n.docPathAliases` 已补齐
3. 本地打开 `developer-docs.html` 或 `docs.html`，确认能直达新文档
4. 切换语言，确认不会跳回默认文档
5. 看右侧目录是否能根据标题正常生成

## 什么时候不应该新增文章

以下情况不要新增 Markdown 文章，直接改现有数据源更合适：

- 只是修改首页、下载页、关于页、贡献者页文案
- 只是新增一个首页卡片或下载卡片
- 只是修改按钮文案、搜索提示语、主题按钮提示语

这些改动分别应该回到：

- `assets/content/pages.json`
- `assets/content/ui-text.json`

## 写开发文档时的要求

如果新增的是开发文档，不要只写“原则”，至少写清楚：

- 具体改哪个文件
- 哪些文件不要改
- 改完以后怎么验证
- 哪些行为算回归

否则文档只会变成复读规范，不能指导维护。
