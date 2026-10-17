import { t } from "../core/i18n.js";
import { getCurrentLanguage } from "../core/preferences.js";
import { escapeAttr, escapeHtml, getLocalizedValue } from "../core/utils.js";

export function renderBreadcrumbs(breadcrumbs, lang) {
  if (!Array.isArray(breadcrumbs) || !breadcrumbs.length) return "";
  return `
    <nav class="doc-breadcrumbs" aria-label="Breadcrumb">
      ${breadcrumbs
        .map((item, index) => {
          const label = getLocalizedValue(item?.label, lang);
          const prefix = index === 0 ? "" : `<span class="doc-breadcrumbs-sep">/</span>`;
          if (item?.href) return `${prefix}<a href="${escapeAttr(item.href)}">${escapeHtml(label)}</a>`;
          return `${prefix}<span>${escapeHtml(label)}</span>`;
        })
        .join("")}
    </nav>
  `;
}

export function renderPageFrameHead(hero, lang) {
  const breadcrumbs = renderBreadcrumbs(hero?.breadcrumbs, lang);
  const media = hero?.media
    ? `
      <div class="hero-banner-flat">
        <img src="${escapeAttr(hero.media.src)}" alt="${escapeAttr(getLocalizedValue(hero.media.alt, lang))}" loading="eager" decoding="async" />
      </div>
    `
    : "";

  const actions = Array.isArray(hero?.actions) && hero.actions.length
    ? `
      <div class="hero-actions">
        ${hero.actions
          .map((action) => {
            const label = getLocalizedValue(action?.label, lang);
            const href = action?.href || "#";
            const className = action?.variant === "primary" ? "btn primary" : "btn";
            const attrs = action?.external ? ` target="_blank" rel="noopener noreferrer"` : "";
            return `<a class="${className}" href="${escapeAttr(href)}"${attrs}>${escapeHtml(label)}</a>`;
          })
          .join("")}
      </div>
    `
    : "";

  const title = hero?.title ? escapeHtml(getLocalizedValue(hero.title, lang)) : hero?.titleHtml ? getLocalizedValue(hero.titleHtml, lang) : "";
  const lead = hero?.leadHtml ? getLocalizedValue(hero.leadHtml, lang) : escapeHtml(getLocalizedValue(hero?.lead, lang));
  const meta = hero?.meta ? `<div class="doc-page-meta"><span class="doc-page-meta-item">${escapeHtml(getLocalizedValue(hero.meta, lang))}</span></div>` : "";
  const copy = `
    ${breadcrumbs}
    ${hero?.kicker ? `<p class="hero-kicker">${escapeHtml(getLocalizedValue(hero.kicker, lang))}</p>` : ""}
    <div class="content-head-title-row">
      <h1 class="home-hero-title">${title}</h1>
    </div>
    ${meta}
    <p class="page-lead">${lead}</p>
    ${actions}
  `;

  if (hero?.media) {
    return `
      <section class="page-hero content-head content-head-page home-hero">
        <div class="home-hero-split">
          ${media}
          <div class="home-hero-copy">${copy}</div>
        </div>
      </section>
    `;
  }

  return `
    <section class="page-hero content-head content-head-page">
      ${copy}
    </section>
  `;
}

export function renderDocsFrameHead({ title, breadcrumbs, date, docPath, editHref }) {
  const lang = getCurrentLanguage();
  return `
    ${renderBreadcrumbs(breadcrumbs, lang)}
    <div class="content-head-title-row doc-meta-title-row">
      <h1>${escapeHtml(title)}</h1>
    </div>
    <div class="doc-meta-line">
      ${date ? `<span class="doc-meta-inline"><span>${escapeHtml(date)}</span></span>` : ""}
      <span class="doc-meta-inline doc-meta-inline-path">
        <span>${escapeHtml(t("docs.metaPath", { fallback: "Path" }))}:</span>
        <code>${escapeHtml(docPath)}</code>
        ${
          editHref
            ? `<span class="doc-meta-sep">·</span>
        <a class="doc-meta-link" href="${escapeAttr(editHref)}" target="_blank" rel="noopener noreferrer">${escapeHtml(
          t("docs.editOnGitHub", { fallback: "Edit on GitHub" })
        )}</a>`
            : ""
        }
      </span>
    </div>
  `;
}
