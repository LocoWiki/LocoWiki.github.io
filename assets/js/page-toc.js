(function () {
  let headingMeta = [];
  let activeHeadingId = "";
  let rafToken = 0;
  let listenersBound = false;

  function t(key, fallback) {
    if (typeof window.LocoWikiSite?.t === "function") {
      return window.LocoWikiSite.t(key, { fallback });
    }
    return fallback;
  }

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === "function") return window.CSS.escape(value);
    return String(value).replace(/["\\]/g, "\\$&");
  }

  function buildHref(id) {
    return `#${encodeURIComponent(id)}`;
  }

  function ensureHeadingIds(headings) {
    const used = new Set(Array.from(document.querySelectorAll("[id]")).map((el) => el.id));
    let counter = 0;

    headings.forEach((heading) => {
      if (heading.id) return;

      const text = (heading.textContent || "").trim();
      let slug = text
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

  function shouldIgnoreHeading(heading) {
    return Boolean(heading.closest(".cards, .toc, .page-section-nav"));
  }

  function pickHeadings(container) {
    return Array.from(container.querySelectorAll("h2, h3")).filter((heading) => !shouldIgnoreHeading(heading));
  }

  function collectHeadingMeta(headings) {
    let currentSectionId = "";
    return headings.map((heading) => {
      if (heading.tagName === "H2") currentSectionId = heading.id;
      return {
        element: heading,
        id: heading.id,
        label: (heading.textContent || "").trim(),
        level: heading.tagName === "H3" ? 1 : 0,
        sectionId: currentSectionId || heading.id,
      };
    });
  }

  function renderToc(metaList) {
    const tocRoot = document.getElementById("toc-items");
    const tocTitle = document.querySelector(".toc .toc-title");
    if (tocTitle) tocTitle.textContent = t("common.tocTitle", "本页目录");
    if (!tocRoot) return;

    tocRoot.innerHTML = "";

    if (!metaList.length) {
      const empty = document.createElement("div");
      empty.className = "toc-empty";
      empty.textContent = t("common.tocEmpty", "无");
      tocRoot.appendChild(empty);
      return;
    }

    metaList.forEach((meta) => {
      const link = document.createElement("a");
      link.href = buildHref(meta.id);
      link.textContent = meta.label;
      link.style.paddingLeft = `${8 + meta.level * 12}px`;
      link.dataset.pageNavTarget = meta.id;
      link.dataset.pageNavKind = "toc";
      tocRoot.appendChild(link);
    });
  }

  function renderSectionNav(metaList) {
    const root = document.querySelector("main.content");
    const hero = root?.querySelector(".page-hero");
    if (!root || !hero || document.body.dataset.layout !== "page") return;

    let nav = root.querySelector(".page-section-nav");
    const sectionList = metaList.filter((meta) => meta.level === 0);

    if (sectionList.length < 2) {
      if (nav) nav.remove();
      return;
    }

    if (!nav) {
      nav = document.createElement("nav");
      nav.className = "page-section-nav surface-panel";
      nav.innerHTML = `
        <div class="page-section-nav-title"></div>
        <div class="page-section-nav-list"></div>
      `;
      hero.insertAdjacentElement("afterend", nav);
    }

    nav.setAttribute("aria-label", t("common.sectionNavAria", "章节导航"));
    const title = nav.querySelector(".page-section-nav-title");
    const list = nav.querySelector(".page-section-nav-list");
    if (!title || !list) return;

    title.textContent = t("common.sectionNavTitle", "章节导航");
    list.innerHTML = "";

    sectionList.forEach((meta) => {
      const link = document.createElement("a");
      link.href = buildHref(meta.id);
      link.textContent = meta.label;
      link.dataset.pageNavTarget = meta.id;
      link.dataset.pageNavKind = "section";
      list.appendChild(link);
    });
  }

  function getTopOffset() {
    const raw = getComputedStyle(document.documentElement).getPropertyValue("--topbar-h");
    const topbarHeight = Number.parseFloat(raw);
    const sectionNav = document.querySelector(".page-section-nav");
    const sectionNavHeight = sectionNav ? sectionNav.getBoundingClientRect().height : 0;
    return (Number.isFinite(topbarHeight) ? topbarHeight : 72) + sectionNavHeight + 20;
  }

  function getMetaById(id) {
    return headingMeta.find((meta) => meta.id === id) || null;
  }

  function setActiveHeading(meta) {
    const currentId = meta?.id || "";
    const sectionId = meta?.sectionId || currentId;
    if (activeHeadingId === currentId) return;
    activeHeadingId = currentId;

    document.querySelectorAll("[data-page-nav-target]").forEach((link) => {
      const target = link.dataset.pageNavTarget || "";
      const kind = link.dataset.pageNavKind || "toc";
      const isActive = kind === "section" ? target === sectionId : target === currentId;
      link.dataset.active = isActive ? "true" : "false";
      if (isActive) {
        link.setAttribute("aria-current", "true");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }

  function findActiveMeta() {
    if (!headingMeta.length) return null;

    const offset = getTopOffset();
    let current = headingMeta[0];

    for (const meta of headingMeta) {
      const top = meta.element.getBoundingClientRect().top;
      if (top - offset <= 0) {
        current = meta;
        continue;
      }
      break;
    }

    return current;
  }

  function syncActiveHeading() {
    setActiveHeading(findActiveMeta());
  }

  function scheduleSync() {
    if (rafToken) return;
    rafToken = window.requestAnimationFrame(() => {
      rafToken = 0;
      syncActiveHeading();
    });
  }

  function scrollToHash() {
    if (!window.location.hash) {
      scheduleSync();
      return;
    }

    const id = decodeURIComponent(window.location.hash.slice(1));
    const target =
      document.getElementById(id) || document.querySelector(`[name="${cssEscape(id)}"]`);
    if (!target) {
      scheduleSync();
      return;
    }

    target.scrollIntoView();
    const meta = getMetaById(target.id);
    if (meta) setActiveHeading(meta);
  }

  function render() {
    const container = document.querySelector("main.content") || document.querySelector(".content");
    if (!container) return;

    const headings = pickHeadings(container);
    ensureHeadingIds(headings);
    headingMeta = collectHeadingMeta(headings);
    activeHeadingId = "";

    renderToc(headingMeta);
    renderSectionNav(headingMeta);
    scrollToHash();
    scheduleSync();
  }

  function bindListeners() {
    if (listenersBound) return;
    listenersBound = true;

    window.addEventListener("scroll", scheduleSync, { passive: true });
    window.addEventListener("resize", scheduleSync);
    window.addEventListener("hashchange", () => scrollToHash());
    window.addEventListener("locowiki:languagechange", () => {
      render();
    });
  }

  function init() {
    render();
    bindListeners();
  }

  window.addEventListener("DOMContentLoaded", init);
})();
