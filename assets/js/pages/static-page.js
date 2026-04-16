import { getPageData } from "../core/config.js";
import { getCurrentLanguage } from "../core/preferences.js";
import { renderPageFrameHead } from "../components/content-head.js";
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
  return renderPageFrameHead(hero, lang);
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

function renderSectionHead(section, lang) {
  const kicker = section?.kicker ? `<p class="section-kicker">${escapeHtml(getLocalizedValue(section.kicker, lang))}</p>` : "";
  const title = getLocalizedValue(section?.title, lang);
  const titleMarkup = title ? `<h2 class="section-title"${section?.id ? ` id="${escapeAttr(section.id)}"` : ""}>${escapeHtml(title)}</h2>` : "";
  const desc = section?.desc ? `<p class="section-desc">${escapeHtml(getLocalizedValue(section.desc, lang))}</p>` : "";
  if (!kicker && !titleMarkup && !desc) return "";
  return `
    <div class="section-head">
      ${kicker}
      ${titleMarkup}
      ${desc}
    </div>
  `;
}

function renderSection(section, lang) {
  const head = renderSectionHead(section, lang);
  const sectionId = !section?.title && section?.id ? ` id="${escapeAttr(section.id)}"` : "";

  if (section?.type === "contributors") {
    return `
      <section class="section-shell"${sectionId}>
        ${head}
        <div id="contributors-meta" class="sync-meta">${escapeHtml(lang === "en" ? "Loading contributor data..." : "正在加载贡献者数据…")}</div>
        <article class="contributors-page surface-panel" data-toc-ignore>
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
      <section class="section-shell"${sectionId}>
        ${head}
        <div id="download-dynamic" class="loading">${escapeHtml(lang === "en" ? "Generating download entries..." : "正在生成下载入口…")}</div>
      </section>
    `;
  }

  if (section?.callout && !section?.cards) {
    return `
      <section class="section-shell section-shell-compact"${sectionId}>
        ${head}
        <div class="page-callout"><p>${escapeHtml(getLocalizedValue(section.callout, lang))}</p></div>
      </section>
    `;
  }

  return `
    <section class="section-shell section-shell-compact"${sectionId}>
      ${head}
      ${Array.isArray(section?.cards) ? `<div class="cards ${escapeAttr(section.cardsClass || section.gridClass || "")}">${renderCards(section.cards, lang)}</div>` : ""}
      ${section?.callout && section?.cards ? `<div class="page-callout"><p>${escapeHtml(getLocalizedValue(section.callout, lang))}</p></div>` : ""}
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
