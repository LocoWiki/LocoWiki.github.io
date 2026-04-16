# How to Add Articles

This document explains how article content is added in the current site structure, and which content belongs to this site repository versus the external content repository.

Before adding anything, decide which content frame it belongs to:

- landing / info page: `page`
- reading document page: `docs`

Full rules:

```text
site-docs/page-framework-standards.en.md
```

## Two content types

### 1. Documentation articles

These appear under:

- Quick Start
- Docs
- Developer Docs

Rules:

- `Quick Start` and `Docs` read Markdown from the external repository configured in `assets/site-config.json -> sourceRepo`
- `Developer Docs` reads local Markdown files from this repository under `site-docs/`

### 2. Static page copy

These appear under:

- Home
- Downloads
- About
- Contributors

These pages do not use Markdown. They are maintained in `assets/content/pages.json`.

They all belong to the `page` frame.

## Add a Quick Start or Docs article

### Step 1: create the Markdown file in the content repository

The external source is configured in:

```json
assets/site-config.json -> sourceRepo
```

Examples:

```text
competition-rules/new-topic.md
```

or

```text
wiki/my-topic.md
```

Routing rules:

- Paths starting with `wiki/` go to `Docs`
- Other Markdown paths go to `Quick Start`

### Step 2: register it in the sidebar

For a Quick Start article, edit:

```text
assets/site-config.json
```

Add an item inside `sidebar.zh` and `sidebar.en`.

Example:

```json
{
  "title": "New Article Title",
  "path": "competition-rules/new-topic.md"
}
```

If it is a Docs article:

- any Markdown file under `wiki/` is now discovered recursively and rendered as a nested sidebar tree
- you no longer need to manually register every `wiki/...` path in `assets/site-config.json`
- keep a matching sidebar entry only when you want to override the displayed title for a specific document

### Step 3: add language aliases if needed

If the English file uses a different path, update:

```text
assets/site-config.json -> i18n.docPathAliases
```

Example:

```json
"competition-rules/new-topic.md": "competition-rules/new-topic.en.md"
```

### Step 4: set it as the default entry if needed

Edit:

```text
assets/site-config.json -> site.defaultDocByShell
```

Example:

```json
"quickstart": "competition-rules/new-topic.md"
```

or

```json
"docs": "wiki/my-topic.md"
```

## Add a Developer Docs article

Developer Docs is maintained in this site repository.

Even though Developer Docs is internal content, it still belongs to the `docs` frame.

### Step 1: create a Markdown file locally

Put the file under:

```text
site-docs/
```

Example:

```text
site-docs/how-to-add-pages.md
```

### Step 2: register it in the Developer Docs sidebar

Edit:

```text
assets/site-config.json
```

Add an item to the `Developer Docs` group in `sidebar.zh` and `sidebar.en`.

Example:

```json
{
  "title": "How to Add Pages",
  "path": "site-docs/how-to-add-pages.md"
}
```

If the English version uses a different file, also add:

```json
"site-docs/how-to-add-pages.md": "site-docs/how-to-add-pages.en.md"
```

## Update Home / About / Contributors / Downloads page copy

This is not article content, so no Markdown is involved.

Edit:

```text
assets/content/pages.json
```

This file controls:

- Home hero
- Home cards
- About copy
- Contributors copy
- Downloads copy

## Minimal examples

To add one Developer Docs article:

1. Create `site-docs/how-to-add-pages.md`
2. Add it to the Developer Docs section in `assets/site-config.json`
3. Add the English alias if needed

To add one Quick Start article:

1. Create the Markdown file in the external content repository
2. Update `assets/site-config.json`
3. Add the new entry to `sidebar.zh` and `sidebar.en`

To add one Docs article:

1. Create the Markdown file under `wiki/` in the external content repository
2. Stop there if the default filename-based sidebar title is acceptable
3. Only update `sidebar.zh` / `sidebar.en` when you need a custom sidebar label

## Minimum self-check before finishing

Do not stop after the Markdown renders. At minimum:

1. confirm both Chinese and English sidebars are registered in `assets/site-config.json`
   For Docs under `wiki/`, this instead means confirming the file is under `wiki/` and adding sidebar entries only when you need title overrides
2. add the `i18n.docPathAliases` mapping if an English file exists
3. open `developer-docs.html` or `docs.html` locally and reach the new article directly
4. switch language and confirm it does not jump back to the default doc
5. confirm the right-side TOC is generated from headings

## When not to add a new article

Do not create a Markdown article for these cases:

- editing Home, Downloads, About, or Contributors page copy
- adding one homepage or downloads card
- editing button text, search hint text, or theme-toggle copy

Those changes belong in:

- `assets/content/pages.json`
- `assets/content/ui-text.json`

## Requirements for Developer Docs writing

If the new article is a maintenance document, do not stop at general principles. It should state:

- the exact file to edit
- the files that should not be touched
- how to verify the result
- what counts as a regression

Otherwise the document becomes abstract guidance instead of executable maintenance help.
