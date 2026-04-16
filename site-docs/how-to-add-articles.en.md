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
- Topic Docs
- Developer Docs

Rules:

- `Quick Start` and `Topic Docs` read Markdown from the external repository configured in `assets/site-config.json -> sourceRepo`
- `Developer Docs` reads local Markdown files from this repository under `site-docs/`

### 2. Static page copy

These appear under:

- Home
- Downloads
- About
- Contributors

These pages do not use Markdown. They are maintained in `assets/content/pages.json`.

They all belong to the `page` frame.

## Add a Quick Start or Topic Docs article

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

- Paths starting with `wiki/` go to `Topic Docs`
- Other Markdown paths go to `Quick Start`

### Step 2: register it in the sidebar

Edit:

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
