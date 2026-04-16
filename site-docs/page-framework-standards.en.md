# Page Frame Standards

This site now keeps only two content-frame standards:

- `page`: internal landing / overview pages
- `docs`: long-form reading pages

Do not choose a layout based on whether content is internal. Choose it based on whether the user is scanning entry information or reading a document continuously.

## 1. page frame

Applies to:

- Home
- About
- Downloads
- Contributors

Source:

- `assets/content/pages.json`

Standard structure:

1. `hero`
2. optional `metrics`
3. optional `callout`
4. `sections[]`
5. optional `cta`

Implementation:

- HTML shell: `data-layout="page"`
- Entry: `assets/js/entries/static-page.js`
- Renderer: `assets/js/pages/static-page.js`

Use it for:

- Overview copy
- Navigation entry points
- Action guidance
- Dynamic info panels

Do not use it for:

- Long tutorials
- Chapter-based reading
- Previous / next article flows

## 2. docs frame

Applies to:

- Quick Start
- Topic Docs
- Developer Docs

Source:

- External Markdown repository
- Local `site-docs/`

Standard structure:

1. `meta`
2. `content`
3. optional `toc`
4. optional `pager`

Implementation:

- HTML shell: `data-layout="docs"`
- Entry: `assets/js/entries/docs.js`
- Renderer: `assets/js/pages/docs-page.js`

Use it for:

- Tutorials
- Rules
- Maintenance docs
- Long-form reading

Do not use it for:

- Card-based homepage navigation
- Contributor panels
- Download entry aggregations

## 3. Decision rule

When adding a page, ask two questions first:

1. Is the main job quick overview/navigation, or continuous reading?
2. Does the content come from JSON blocks, or Markdown documents?

Rules:

- Overview / cards / action entry points => `page`
- Markdown body / doc TOC / pager flow => `docs`

Whether content is maintained internally is not the deciding factor.

Examples:

- `Developer Docs` is internal content, but still uses `docs`
- `Contributors` has dynamic data, but still uses `page`

## 4. Explicit registry

Page standards are registered in:

```text
assets/site-config.json -> pageStandards
```

Current mapping:

- `index.html / about.html / downloads.html / contributors.html` => `page`
- `quickstart.html / docs.html / developer-docs.html` => `docs`

During shell initialization, the resolved standard is written to `body.dataset`:

- `data-standard-key`
- `data-standard-frame`
- `data-standard-source`
- `data-standard-shell` for docs-shell pages only

## 5. Maintenance rules

When adding or refactoring a page:

1. Update `assets/site-config.json -> pageStandards` first
2. Then decide whether it belongs to `static-page.js` or `docs-page.js`
3. Do not introduce a third content frame
4. If you only need a new `page` block type, change `assets/js/pages/static-page.js`
5. If you only need a new `docs` article, do not change the frame layer
