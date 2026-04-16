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
- Docs
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

## 6. Hard constraints in the current codebase

This section is based on the repository as it exists now:

- `*.html` files are shells only, not body-content containers
- `page` body content comes from `assets/content/pages.json`
- `docs` body content comes from the external Markdown repo or local `site-docs/`
- navigation, sidebar, default docs, and language doc mapping are owned by `assets/site-config.json`
- site-level interactions are centralized in `assets/js/components/site-shell.js`

If a small request forces changes in shell HTML, JSON copy, and component logic at the same time, the ownership boundary is probably being broken.

## 7. Decision order for new requirements

Before changing code, check in this order:

1. Is this a content problem or a frame problem?
2. If it is content-only, can JSON or Markdown handle it alone?
3. If frame work is needed, is it on the `page` render path or the `docs` render path?
4. After the change, will language switching, theme switching, search, or TOC be affected?

Only move into JS and CSS once step 2 is clearly not enough.

## 8. Smallest allowed change surface by page type

### `page` pages

Smallest allowed change surface:

- copy: `assets/content/pages.json`
- new block rendering: `assets/js/pages/static-page.js`
- block styling: `assets/css/site-shell.css`

Should not require:

- `docs-page.js`
- `docs-routing.js`

### `docs` pages

Smallest allowed change surface:

- article body: external repo Markdown or `site-docs/`
- doc registry and routing: `assets/site-config.json`
- docs-shell behavior: `assets/js/pages/docs-page.js`

Should not require:

- `assets/content/pages.json`

unless the site information architecture itself is changing.

## 9. Minimum acceptance after any change

Whether the change touches `page` or `docs`, verify at least:

1. the target page opens
2. top navigation highlight still works
3. language switching does not land on the wrong page
4. theme switching leaves no stale styles behind
5. site search still returns reasonable results
