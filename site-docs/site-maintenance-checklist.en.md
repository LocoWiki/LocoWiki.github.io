# Site Maintenance Checklist

This checklist only covers real files that already exist in this repository. The goal is simple: if you need to change something, you should know which file owns it and how to verify the result.

## 1. Decide the write target first

### Update Home / About / Downloads / Contributors copy

Start with:

```text
assets/content/pages.json
```

Only change code when:

- a new block type is needed: update `assets/js/pages/static-page.js`
- page TOC visibility changes: update `assets/js/pages/page-toc.js`
- dynamic download cards change: update `assets/js/pages/downloads-panel.js`

### Update navigation, sidebar, default docs, or language aliases

Only change:

```text
assets/site-config.json
```

This file owns:

- header navigation in `nav`
- left doc sidebar in `sidebar`
- default doc entry in `site.defaultDocByShell`
- language path mapping in `i18n.docPathAliases`
- external doc source in `sourceRepo`

### Update shared buttons, search, theme, header, or footer

Start with:

```text
assets/js/components/site-shell.js
assets/js/core/preferences.js
assets/css/site-shell.css
assets/content/ui-text.json
```

Responsibilities:

- `site-shell.js`: header, search modal, language switch, theme switch, site-level interactions
- `preferences.js`: saved language and theme preferences
- `site-shell.css`: shell layout, navigation, search, theme styling, shared card density
- `ui-text.json`: shared UI copy, instead of scattering text in components

### Update the docs reading flow

Check:

```text
assets/js/pages/docs-page.js
assets/js/core/docs-routing.js
assets/js/entries/docs.js
```

Responsibilities:

- `docs-page.js`: document fetch, render, TOC, breadcrumbs, sidebar tree
- `docs-routing.js`: routing rules for `quickstart / docs / developer`
- `entries/docs.js`: docs-page bootstrap, not page logic in HTML

## 2. How to handle common tasks

### Task: add a homepage card

Minimum steps:

1. Edit `assets/content/pages.json`
2. Do not touch JS if the card still belongs to an existing card group
3. Only adjust `assets/css/site-shell.css` if layout needs change

Acceptance:

- no broken columns on desktop or mobile
- title and button work in both languages
- search can find the new card title

### Task: add a Developer Docs article

Minimum steps:

1. Create `site-docs/*.md`
2. Create the English version `site-docs/*.en.md`
3. Register both in `assets/site-config.json` under the Developer Docs sidebar group
4. Add the path mapping in `i18n.docPathAliases`

Acceptance:

- `developer-docs.html` opens the page directly
- language switching lands on the correct article
- the right-side TOC still works

### Task: adjust search behavior

Primary file:

```text
assets/js/components/site-shell.js
```

Requirements:

- update the index source before touching ranking
- keep both page and docs results
- do not move search logic into individual page components

Acceptance:

- module titles can find homepage cards
- doc titles can find sidebar docs
- empty results show a clear fallback state

### Task: adjust theme switching

Primary files:

```text
assets/js/components/site-shell.js
assets/js/core/preferences.js
assets/css/site-shell.css
```

Requirements:

- theme values must stay limited to `light / dark`
- the chosen theme must persist in `localStorage`
- the visual transition must degrade gracefully instead of requiring one browser feature

Acceptance:

- theme persists after refresh
- the header button icon, label, and next state stay aligned
- no forced animation when `prefers-reduced-motion` is enabled

## 3. Required checks before finishing

### Data files

Run at least once:

```bash
node -e "JSON.parse(require('fs').readFileSync('assets/content/pages.json','utf8')); JSON.parse(require('fs').readFileSync('assets/site-config.json','utf8')); JSON.parse(require('fs').readFileSync('assets/content/ui-text.json','utf8'));"
```

### Script syntax

Run at least once:

```bash
node --check assets/js/components/site-shell.js
node --check assets/js/pages/docs-page.js
node --check assets/js/pages/static-page.js
```

If you edited other entry files, add them to the check list.

### Real page inspection

At minimum, inspect:

- `index.html`
- `downloads.html`
- `docs.html`
- `developer-docs.html`

Check at least:

- top navigation
- language switch
- theme switch
- search open and search hits
- docs TOC still rendering

## 4. Hard rules for this repository

- Do not introduce a third content frame. Only `page` and `docs` are allowed.
- Do not move static-page body copy back into HTML. Prefer `assets/content/pages.json`.
- Do not hardcode shared UI text in JS. Prefer `assets/content/ui-text.json`.
- Do not place maintenance docs under `docs/` and pretend they are user-facing copy. Site maintenance docs belong in `site-docs/`.
- Do not create a new page-specific stylesheet for one small change. Prefer `assets/css/site-shell.css`.

## 5. Where to look first when something breaks

- wrong page copy: `assets/content/pages.json`
- wrong doc sidebar entry: `assets/site-config.json`
- search misses results: `assets/js/components/site-shell.js`
- wrong language doc route: `assets/site-config.json -> i18n.docPathAliases`
- wrong theme button state: `assets/js/core/preferences.js` and `assets/js/components/site-shell.js`
