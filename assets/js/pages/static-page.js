import { getPageData } from "../core/config.js";
import { getCurrentLanguage } from "../core/preferences.js";
import { escapeAttr, escapeHtml, getLocalizedValue } from "../core/utils.js";
import { renderContributorsSection } from "./contributors-section.js";
import { renderDownloadsPanel } from "./downloads-panel.js";

function renderAction(action, lang) {
  const label = getLocalizedValue(action?.label, lang);
  const href = action?.href || "#";
  const className = action?.variant === "primary" ? "btn primary" : "btn";
  const attrs = action?.external ? ` target="_blank" rel="noopener noreferrer"` : "";
  return `<a class="${className}" href="${escapeAttr(href)}"${attrs}>${escapeHtml(label)}</a>`;
}

function renderHero(hero, lang) {
  const breadcrumbs = Array.isArray(hero?.breadcrumbs)
    ? `
      <nav class="doc-breadcrumbs" aria-label="Breadcrumb">
        ${hero.breadcrumbs
          .map((item, index) => {
            const label = getLocalizedValue(item?.label, lang);
            const prefix = index === 0 ? "" : `<span class="doc-breadcrumbs-sep">/</span>`;
            if (item?.href) return `${prefix}<a href="${escapeAttr(item.href)}">${escapeHtml(label)}</a>`;
            return `${prefix}<span>${escapeHtml(label)}</span>`;
          })
          .join("")}
      </nav>
    `
    : "";

  const media = hero?.media
    ? `
      <div class="hero-banner-flat">
        <img src="${escapeAttr(hero.media.src)}" alt="${escapeAttr(getLocalizedValue(hero.media.alt, lang))}" loading="eager" decoding="async" />
      </div>
    `
    : "";

  const actions = Array.isArray(hero?.actions) && hero.actions.length
    ? `<div class="hero-actions">${hero.actions.map((action) => renderAction(action, lang)).join("")}</div>`
    : "";

  const title = hero?.title ? escapeHtml(getLocalizedValue(hero.title, lang)) : hero?.titleHtml ? getLocalizedValue(hero.titleHtml, lang) : "";
  const lead = hero?.leadHtml ? getLocalizedValue(hero.leadHtml, lang) : escapeHtml(getLocalizedValue(hero?.lead, lang));
  const heroCopy = `
    ${hero?.kicker ? `<p class="hero-kicker">${escapeHtml(getLocalizedValue(hero.kicker, lang))}</p>` : ""}
    <h1 class="home-hero-title">${title}</h1>
    <p class="page-lead">${lead}</p>
    ${actions}
  `;

  if (hero?.media) {
    return `
      <section class="page-hero home-hero">
        <div class="home-hero-split">
          ${media}
          <div class="home-hero-copy">${breadcrumbs}${heroCopy}</div>
        </div>
      </section>
    `;
  }

  return `
    <section class="page-hero">
      ${breadcrumbs}
      <h1>${title}</h1>
      ${hero?.meta ? `<div class="doc-page-meta"><span class="doc-page-meta-item">${escapeHtml(getLocalizedValue(hero.meta, lang))}</span></div>` : ""}
      <p class="page-lead">${lead}</p>
    </section>
  `;
}

function renderMetrics(metrics, lang) {
  if (!Array.isArray(metrics) || !metrics.length) return "";
  return `
    <section class="page-summary-grid">
      ${metrics
        .map(
          (item) => `
            <article class="metric-card">
              <span class="metric-label">${escapeHtml(getLocalizedValue(item?.label, lang))}</span>
              <strong class="metric-value">${escapeHtml(getLocalizedValue(item?.value, lang))}</strong>
              ${item?.desc ? `<p>${escapeHtml(getLocalizedValue(item.desc, lang))}</p>` : ""}
            </article>
          `
        )
        .join("")}
    </section>
  `;
}

function renderCalloutBlock(callout, lang) {
  if (!callout) return "";
  const items = Array.isArray(callout?.items)
    ? `<ol class="hero-flow-list">${callout.items.map((item) => `<li>${escapeHtml(getLocalizedValue(item, lang))}</li>`).join("")}</ol>`
    : callout?.bodyHtml
      ? `<p>${getLocalizedValue(callout.bodyHtml, lang)}</p>`
      : callout?.body
        ? `<p>${escapeHtml(getLocalizedValue(callout.body, lang))}</p>`
        : "";

  return `
    <section class="page-callout">
      ${callout?.title ? `<strong>${escapeHtml(getLocalizedValue(callout.title, lang))}</strong>` : ""}
      ${items}
    </section>
  `;
}

function renderCards(cards, lang) {
  return cards
    .map((card) => {
      const desc = card?.descHtml ? getLocalizedValue(card.descHtml, lang) : escapeHtml(getLocalizedValue(card?.desc, lang));
      return `
        <article class="card info-card">
          ${card?.tag ? `<span class="card-tag">${escapeHtml(getLocalizedValue(card.tag, lang))}</span>` : ""}
          <h3>${escapeHtml(getLocalizedValue(card?.title, lang))}</h3>
          <p>${desc}</p>
          ${card?.linkLabel ? renderAction({ href: card.href, label: card.linkLabel, external: card.external }, lang) : ""}
        </article>
      `;
    })
    .join("");
}

function renderFaq(items, lang) {
  return `
    <div class="cards faq-grid">
      ${items
        .map(
          (item) => `
            <article class="card faq-card">
              <h3>${escapeHtml(getLocalizedValue(item?.question, lang))}</h3>
              <p>${getLocalizedValue(item?.answerHtml, lang)}</p>
            </article>
          `
        )
        .join("")}
    </div>
  `;
}

function renderSection(section, lang) {
  const titleId = section?.id ? ` id="${escapeAttr(section.id)}"` : "";
  const head = `
    <div class="section-head">
      ${section?.kicker ? `<p class="section-kicker">${escapeHtml(getLocalizedValue(section.kicker, lang))}</p>` : ""}
      <h2 class="section-title"${titleId}>${escapeHtml(getLocalizedValue(section?.title, lang))}</h2>
      ${section?.desc ? `<p class="section-desc">${escapeHtml(getLocalizedValue(section.desc, lang))}</p>` : ""}
    </div>
  `;

  if (section?.type === "contributors") {
    return `
      <section class="section-shell">
        ${head}
        <div id="contributors-meta" class="sync-meta">${escapeHtml(lang === "en" ? "Loading contributor data..." : "正在加载贡献者数据…")}</div>
        <article class="contributors-page surface-panel">
          <h3>${escapeHtml(lang === "en" ? "Contributors" : "贡献者")}</h3>
          <p id="contributors-list-hint"></p>
          <div id="contributors-list" class="contributors-grid" aria-live="polite">
            <div class="contributor-empty">${escapeHtml(lang === "en" ? "Loading contributor list..." : "正在加载贡献者列表…")}</div>
          </div>
        </article>
      </section>
    `;
  }

  if (section?.type === "downloadDynamic") {
    return `
      <section class="section-shell">
        ${head}
        <div id="download-dynamic" class="loading">${escapeHtml(lang === "en" ? "Generating download entries..." : "正在生成下载入口…")}</div>
      </section>
    `;
  }

  if (Array.isArray(section?.faq)) {
    return `
      <section class="section-shell section-shell-compact">
        ${head}
        ${renderFaq(section.faq, lang)}
      </section>
    `;
  }

  if (section?.callout && !section?.cards) {
    return `
      <section class="section-shell section-shell-compact">
        ${head}
        <div class="page-callout"><p>${escapeHtml(getLocalizedValue(section.callout, lang))}</p></div>
      </section>
    `;
  }

  return `
    <section class="section-shell section-shell-compact">
      ${head}
      ${Array.isArray(section?.cards) ? `<div class="cards ${escapeAttr(section.cardsClass || section.gridClass || "")}">${renderCards(section.cards, lang)}</div>` : ""}
      ${section?.callout && section?.cards ? `<div class="page-callout"><p>${escapeHtml(getLocalizedValue(section.callout, lang))}</p></div>` : ""}
    </section>
  `;
}

function renderCta(cta, lang) {
  if (!cta) return "";
  return `
    <section class="page-cta surface-panel">
      <div class="page-cta-copy">
        ${cta?.kicker ? `<p class="page-kicker">${escapeHtml(getLocalizedValue(cta.kicker, lang))}</p>` : ""}
        <h2>${escapeHtml(getLocalizedValue(cta?.title, lang))}</h2>
        <p>${escapeHtml(getLocalizedValue(cta?.desc, lang))}</p>
      </div>
      <div class="page-cta-actions">
        ${(cta?.actions || []).map((action) => renderAction(action, lang)).join("")}
      </div>
    </section>
  `;
}

export async function renderStaticPage(pageId) {
  const root = document.getElementById("page-root");
  if (!root) return;
  const lang = getCurrentLanguage();
  const pages = await getPageData();
  const page = pages?.[pageId];
  if (!page) return;

  document.title = getLocalizedValue(page.pageTitle, lang, "LocoWiki");
  root.innerHTML = `
    <article class="md page-article ${pageId === "home" ? "home-article" : ""}">
      ${renderHero(page.hero, lang)}
      ${renderMetrics(page.metrics, lang)}
      ${renderCalloutBlock(page.callout, lang)}
      ${(page.sections || []).map((section) => renderSection(section, lang)).join("")}
      ${renderCta(page.cta, lang)}
    </article>
  `;

  const hint = document.getElementById("contributors-list-hint");
  if (hint) hint.textContent = lang === "en" ? "Sorted by contribution count." : "按贡献次数排序展示。";

  if (document.getElementById("contributors-meta")) {
    await renderContributorsSection();
  }

  if (document.getElementById("download-dynamic")) {
    await renderDownloadsPanel();
  }
}
