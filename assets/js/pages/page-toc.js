import { t } from "../core/i18n.js";
import { cssEscape } from "../core/utils.js";

let headingMeta = [];
let rafToken = 0;

function shouldIgnoreHeading(heading) {
  return Boolean(heading.closest(".cards, .toc, .page-section-nav, [data-toc-ignore]"));
}

function pickHeadings(container) {
  return Array.from(container.querySelectorAll("h2, h3")).filter((heading) => !shouldIgnoreHeading(heading));
}

function ensureHeadingIds(headings) {
  const used = new Set(Array.from(document.querySelectorAll("[id]")).map((element) => element.id));
  let counter = 0;
  headings.forEach((heading) => {
    if (heading.id) return;
    let slug = (heading.textContent || "")
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "");
    if (!slug) slug = `section-${counter++}`;
    let candidate = slug;
    let suffix = 2;
    while (used.has(candidate)) {
      candidate = `${slug}-${suffix++}`;
    }
    heading.id = candidate;
    used.add(candidate);
  });
}

function collectMeta(headings) {
  let currentSectionId = "";
  return headings.map((heading) => {
    if (heading.tagName === "H2") currentSectionId = heading.id;
    return {
      element: heading,
      id: heading.id,
      label: (heading.textContent || "").trim(),
      level: heading.tagName === "H3" ? 1 : 0,
      sectionId: currentSectionId || heading.id
    };
  });
}

function renderSectionNav(metaList) {
  const root = document.querySelector("main.content");
  const hero = root?.querySelector(".page-hero");
  if (!root || !hero || document.body?.dataset.layout !== "page") return;
  if (document.body?.dataset.pageId === "downloads") {
    root.querySelector(".page-section-nav")?.remove();
    return;
  }

  let nav = root.querySelector(".page-section-nav");
  const sections = metaList.filter((meta) => meta.level === 0);
  if (sections.length < 2) {
    if (nav) nav.remove();
    return;
  }

  if (!nav) {
    nav = document.createElement("nav");
    nav.className = "page-section-nav surface-panel";
    nav.innerHTML = `<div class="page-section-nav-title"></div><div class="page-section-nav-list"></div>`;
    hero.insertAdjacentElement("afterend", nav);
  }

  nav.setAttribute("aria-label", t("common.sectionNavAria", { fallback: "Section navigation" }));
  nav.querySelector(".page-section-nav-title").textContent = t("common.sectionNavTitle", { fallback: "Sections" });
  nav.querySelector(".page-section-nav-list").innerHTML = sections
    .map((meta) => `<a href="#${encodeURIComponent(meta.id)}" data-page-nav-target="${meta.id}" data-page-nav-kind="section">${meta.label}</a>`)
    .join("");
}

function renderToc(metaList) {
  const root = document.getElementById("toc-items");
  if (!root) return;
  root.innerHTML = "";
  const title = document.querySelector(".toc .toc-title");
  if (title) title.textContent = t("common.tocTitle", { fallback: "On This Page" });

  if (!metaList.length) {
    root.innerHTML = `<div class="toc-empty">${t("common.tocEmpty", { fallback: "None" })}</div>`;
    return;
  }

  root.innerHTML = metaList
    .map(
      (meta) => `
        <a href="#${encodeURIComponent(meta.id)}" data-page-nav-target="${meta.id}" data-page-nav-kind="toc" style="padding-left:${8 + meta.level * 12}px">
          ${meta.label}
        </a>
      `
    )
    .join("");
}

function getTopOffset() {
  const value = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--topbar-h"));
  const sectionNavHeight = document.querySelector(".page-section-nav")?.getBoundingClientRect().height || 0;
  return (Number.isFinite(value) ? value : 64) + sectionNavHeight + 20;
}

function syncActiveHeading() {
  if (!headingMeta.length) return;
  const offset = getTopOffset();
  let current = headingMeta[0];
  for (const meta of headingMeta) {
    if (meta.element.getBoundingClientRect().top - offset <= 0) {
      current = meta;
      continue;
    }
    break;
  }

  document.querySelectorAll("[data-page-nav-target]").forEach((link) => {
    const target = link.getAttribute("data-page-nav-target") || "";
    const kind = link.getAttribute("data-page-nav-kind") || "toc";
    const active = kind === "section" ? target === current.sectionId : target === current.id;
    link.dataset.active = active ? "true" : "false";
  });
}

function scrollToHash() {
  if (!window.location.hash) {
    syncActiveHeading();
    return;
  }
  const id = decodeURIComponent(window.location.hash.slice(1));
  const target = document.getElementById(id) || document.querySelector(`[name="${cssEscape(id)}"]`);
  if (target) target.scrollIntoView();
  syncActiveHeading();
}

function scheduleSync() {
  if (rafToken) return;
  rafToken = window.requestAnimationFrame(() => {
    rafToken = 0;
    syncActiveHeading();
  });
}

export function renderPageToc() {
  const container = document.querySelector("main.content");
  if (!container) return;
  const headings = pickHeadings(container);
  ensureHeadingIds(headings);
  headingMeta = collectMeta(headings);
  renderToc(headingMeta);
  renderSectionNav(headingMeta);
  scrollToHash();
}

export function bindPageToc() {
  window.addEventListener("scroll", scheduleSync, { passive: true });
  window.addEventListener("resize", scheduleSync);
  window.addEventListener("hashchange", () => scrollToHash());
}
