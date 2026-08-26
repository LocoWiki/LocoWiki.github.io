# 如何新增文章

这篇文档说明当前站点里“新增文章”要改哪些地方，以及哪些内容是在本仓库维护，哪些内容是在外部内容仓库维护。

在继续之前，先确认你要新增的是哪种正文框架：

- 说明页 / 落地页：`page`
- 文档阅读页：`docs`

完整规则见：

```text
site-docs/page-framework-standards.md
```

## 先分清两个仓库的职责

### 内容仓库：`LocoWiki/LocoWiki`

- `wiki/`、`competition-rules/`、`technical-sharing/`、`scripts/` → 文档
- `reading-list/` → 论文
- `network-open-source/` → 开源

### 网站仓库：`LocoWiki/LocoWiki.github.io`

- `assets/content/pages.json` → 首页、关于、资源下载、贡献者页面
- `assets/content/ui-text.json` → 公共 UI 文案
- `assets/site-config.json` → 路由、导航、栏目规则和标题覆盖
- `site-docs/` → 网站维护与开发文档

不要把机器人知识文章复制到网站仓库，也不要把网站产品文案写入内容仓库。

## 先分清页面来源

### 1. 远程知识文章

这类内容会显示在：

- 论文
- 开源
- 文档

其中：

- `论文` 读取 `reading-list/`
- `开源` 读取 `network-open-source/`
- `文档` 读取 `wiki/`、`competition-rules/`、`technical-sharing/`、`scripts/`
- `remote-docs-index.json` 是自动生成的索引缓存，不手工编辑

### 2. 静态页面文案

这类内容会显示在：

- 首页
- 关于
- 资源下载
- 贡献者

这部分不走 Markdown，而是直接维护在 `assets/content/pages.json`

它们统一属于 `page` 框架。

## 新增一篇论文、开源或文档文章

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

- 路径以 `wiki/` 开头的，会被归到 `文档`
- `competition-rules/`、`technical-sharing/`、`scripts/` 会归到 `文档`
- `reading-list/` 下的路径会归到 `论文`
- `network-open-source/` 下的路径会归到 `开源`

### 步骤 2：刷新远程索引

执行：

```bash
node scripts/update-remote-doc-index.mjs
```

- `collections.docs`、`collections.papers`、`collections.open-source` 分别驱动三个栏目。
- 只有需要自定义侧栏标题或排序时，才在 `assets/site-config.json` 中保留条目。

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
"papers": "reading-list/new-topic.md"
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

如果你要新增一篇论文或开源文章，最小操作就是：

1. 去外部内容仓库新建 `.md`
2. 回到这个站点仓库执行 `node scripts/update-remote-doc-index.mjs`

如果你要新增一篇“文档”文章，最小操作就是：

1. 去外部内容仓库的 `wiki/` 下新建 `.md`
2. 在本站仓库执行 `node scripts/update-remote-doc-index.mjs`
3. 如果需要自定义侧栏标题，再回到这个站点仓库补 `sidebar.zh / sidebar.en`

## 当前建议

如果内容是：

- 仓库资料、规则、论文、项目整理：放外部内容仓库
- 站点维护方法、页面结构、前端约定：放 `site-docs/`

## 提交前最低自检

不要只看 Markdown 有没有渲染出来，至少再做下面这些检查：

1. 在 `assets/site-config.json` 里确认中文和英文侧栏都挂上了
   如果是 `wiki/` 下的文档，这一步改为确认路径位于 `wiki/` 目录、`assets/content/remote-docs-index.json` 已刷新，并按需要补标题覆盖
2. 如果存在英文版，确认 `i18n.docPathAliases` 已补齐
3. 本地打开 `developer-docs.html` 或 `docs.html`，确认能直达新文档
4. 切换语言，确认不会跳回默认文档
5. 看右侧目录是否能根据标题正常生成

## 什么时候不应该新增文章

以下情况不要新增 Markdown 文章，直接改现有数据源更合适：

- 只是修改首页、下载页、贡献者页文案
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
