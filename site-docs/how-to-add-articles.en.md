# How to Add Articles

This document explains how article content is added in the current site structure, and which content belongs to this site repository versus the external content repository.

Before adding anything, decide which content frame it belongs to:

- landing / info page: `page`
- reading document page: `docs`

Full rules:

```text
site-docs/page-framework-standards.en.md
```

## Repository responsibilities

### Content repository: `LocoWiki/LocoWiki`

- `wiki/`, `competition-rules/`, `technical-sharing/`, and `scripts/` → Docs
- `reading-list/` → Papers
- `network-open-source/` → Open Source

### Website repository: `LocoWiki/LocoWiki.github.io`

- `assets/content/pages.json` → Home, About, Downloads, and Contributors copy
- `assets/content/ui-text.json` → shared UI copy
- `assets/site-config.json` → routes, navigation, collection rules, and title overrides
- `site-docs/` → website maintenance and development docs

Do not copy robotics articles into the website repository, or website copy into the content repository.

## Page content sources

### 1. Remote knowledge articles

These appear under:

- Papers
- Open Source
- Docs

Rules:

- `Papers` reads `reading-list/`
- `Open Source` reads `network-open-source/`
- `Docs` reads `wiki/`, `competition-rules/`, `technical-sharing/`, and `scripts/`
- `remote-docs-index.json` is generated automatically and must not be edited by hand

### 2. Static page copy

These appear under:

- Home
- About
- Downloads
- Contributors

These pages do not use Markdown. They are maintained in `assets/content/pages.json`.

They all belong to the `page` frame.

## Add a Papers, Open Source, or Docs article

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
- `competition-rules/`, `technical-sharing/`, and `scripts/` go to `Docs`
- Paths under `reading-list/` go to `Papers`
- Paths under `network-open-source/` go to `Open Source`

### Step 2: refresh the remote index

Run:

```bash
node scripts/update-remote-doc-index.mjs
```

- `collections.docs`, `collections.papers`, and `collections.open-source` drive the three website collections.
- Keep a matching sidebar entry only when you need a custom title or ordering.

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
"papers": "reading-list/new-topic.md"
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

To add one Papers or Open Source article:

1. Create the Markdown file in the external content repository
2. Run `node scripts/update-remote-doc-index.mjs` in this site repository

To add one Docs article:

1. Create the Markdown file under `wiki/` in the external content repository
2. Run `node scripts/update-remote-doc-index.mjs` in this site repository
3. Only update `sidebar.zh` / `sidebar.en` when you need a custom sidebar label

## Minimum self-check before finishing

Do not stop after the Markdown renders. At minimum:

1. confirm the file is placed under the collection directory it belongs to, and `assets/content/remote-docs-index.json` has been refreshed
2. add the `i18n.docPathAliases` mapping if an English file exists
3. open `developer-docs.html` or `docs.html` locally and reach the new article directly
4. switch language and confirm it does not jump back to the default doc
5. confirm the right-side TOC is generated from headings

## When not to add a new article

Do not create a Markdown article for these cases:

- editing Home, Downloads, or Contributors page copy
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
