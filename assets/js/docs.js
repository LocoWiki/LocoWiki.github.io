(function () {
  const FEISHU_DOC_PATH = "__feishu_wiki__";
  const state = {
    configPromise: null,
    manifestByLang: new Map(),
    headingMetaByPath: new Map(),
    headingMetaPromises: new Map(),
    currentDocPath: "",
    currentDocTitle: "",
    loadSeq: 0,
  };
  const ICONS = {
    home: `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M4 10.5L12 4l8 6.5"></path>
        <path d="M6.5 9.5V20h11V9.5"></path>
      </svg>
    `,
    calendar: `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <rect x="4.5" y="6.5" width="15" height="13" rx="2"></rect>
        <path d="M8 4.5v4"></path>
        <path d="M16 4.5v4"></path>
        <path d="M4.5 10h15"></path>
      </svg>
    `,
    doc: `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M8 4.5h6l4 4V19.5H8z"></path>
        <path d="M14 4.5v4h4"></path>
        <path d="M10 12h6"></path>
        <path d="M10 15.5h6"></path>
      </svg>
    `,
  };

  function t(key, fallback, vars) {
    if (typeof window.LocoWikiSite?.t === "function") {
      return window.LocoWikiSite.t(key, { fallback, vars });
    }
    return fallback;
  }

  function encodePath(path) {
    return String(path)
      .split("/")
      .map((seg) => encodeURIComponent(seg))
      .join("/");
  }

  function stripLeadingSlash(path) {
    return String(path).replace(/^\/+/, "");
  }

  function dirname(path) {
    const s = String(path);
    const idx = s.lastIndexOf("/");
    return idx === -1 ? "" : s.slice(0, idx + 1);
  }

  function normalizePath(path) {
    const parts = String(path).split("/");
    const out = [];
    for (const part of parts) {
      if (!part || part === ".") continue;
      if (part === "..") {
        if (out.length) out.pop();
        continue;
      }
      out.push(part);
    }
    return out.join("/");
  }

  function splitHash(url) {
    const s = String(url);
    const i = s.indexOf("#");
    if (i === -1) return { base: s, hash: "" };
    return { base: s.slice(0, i), hash: s.slice(i) };
  }

  function safeDecode(value) {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  function isExternalHref(href) {
    return /^(https?:)?\/\//i.test(href) || /^mailto:/i.test(href) || /^tel:/i.test(href);
  }

  function isDangerousHref(href) {
    return /^javascript:/i.test(href) || /^data:/i.test(href);
  }

  function isModifiedEvent(event) {
    return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
  }

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === "function") return window.CSS.escape(value);
    return String(value).replace(/["\\]/g, "\\$&");
  }

  function countSecondaryHeadings(markdown) {
    const matches = String(markdown).match(/^##\s+.+$/gm);
    return matches ? matches.length : 0;
  }

  function resolveRelativePath(currentDocPath, relative) {
    const rel = stripLeadingSlash(relative);
    if (relative.startsWith("/")) return normalizePath(rel);
    return normalizePath(`${dirname(currentDocPath)}${rel}`);
  }

  function buildUrls(config, path) {
    const owner = config.sourceRepo.owner;
    const repo = config.sourceRepo.repo;
    const branch = config.sourceRepo.branch;

    const cleanPath = stripLeadingSlash(path);
    const encoded = encodePath(cleanPath);

    return {
      raw: `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${encoded}`,
      blob: `https://github.com/${owner}/${repo}/blob/${branch}/${encoded}`,
      edit: `https://github.com/${owner}/${repo}/edit/${branch}/${encoded}`,
      download: `https://github.com/${owner}/${repo}/raw/${branch}/${encoded}`,
    };
  }

  function getLanguage() {
    const lang =
      typeof window.LocoWikiSite?.getLanguage === "function" ? window.LocoWikiSite.getLanguage() : "zh";
    return lang === "en" ? "en" : "zh";
  }

  function getDocShellName(pathname = window.location.pathname) {
    if (typeof window.LocoWikiSite?.getDocShellName === "function") {
      return window.LocoWikiSite.getDocShellName(pathname);
    }
    return /(^|\/)docs\.html$/i.test(String(pathname)) ? "docs" : "quickstart";
  }

  function getDocHref(path, config) {
    if (typeof window.LocoWikiSite?.getDocPageHref === "function") {
      return window.LocoWikiSite.getDocPageHref(path, config, getLanguage());
    }
    return `docs.html?path=${encodeURIComponent(path)}`;
  }

  function isFeishuDocPath(path) {
    return String(path || "").trim() === FEISHU_DOC_PATH;
  }

  function getManifestPath(config) {
    return config?.integrations?.feishuWiki?.manifestPath || "wiki/_manifest.json";
  }

  function getLocalizedManifestValue(value, lang) {
    if (typeof value === "string") return value.trim();
    if (!value || typeof value !== "object") return "";
    const candidate = value[lang] || value.zh || value.en || value.default;
    return typeof candidate === "string" ? candidate.trim() : "";
  }

  function normalizeManifestPath(path, lang, config) {
    const rawPath = getLocalizedManifestValue(path, lang);
    if (!rawPath) return "";
    return typeof window.LocoWikiSite?.mapDocPathToLanguage === "function"
      ? window.LocoWikiSite.mapDocPathToLanguage(rawPath, lang, config)
      : rawPath;
  }

  function normalizeWikiManifest(data, lang, config) {
    if (!data || typeof data !== "object") return null;
    const entryDocPath =
      normalizeManifestPath(data.entryDocPath, lang, config) || config?.integrations?.feishuWiki?.entryDocPath || "";
    const items = Array.isArray(data.items) ? data.items : [];
    const normalizedItems = items
      .map((item, index) => {
        const path = normalizeManifestPath(item?.path, lang, config);
        const title = getLocalizedManifestValue(item?.title, lang) || path;
        const order = Number.isFinite(item?.order) ? item.order : index;
        const headingCount = Number.isFinite(item?.headingCount) ? Math.max(0, item.headingCount) : 0;
        const hasChildren = item?.hasChildren === true || headingCount > 0;
        return { path, title, order, hasChildren, headingCount };
      })
      .filter((item) => item.path && item.title)
      .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, "zh-Hans-CN"));

    if (!normalizedItems.length) return null;
    return {
      entryDocPath: entryDocPath || normalizedItems[0].path,
      items: normalizedItems,
    };
  }

  function seedHeadingMetaFromManifest(manifest) {
    if (!manifest?.items?.length) return;
    manifest.items.forEach((item) => {
      state.headingMetaByPath.set(item.path, {
        hasChildren: item.hasChildren === true,
        headingCount: item.headingCount || 0,
      });
    });
  }

  function getDocTitle(container, fallback) {
    const heading = container.querySelector("h1");
    const text = (heading?.textContent || "").trim();
    return text || fallback;
  }

  function consumeDocTitle(container, fallback) {
    const heading = container.querySelector("h1");
    const text = (heading?.textContent || "").trim() || fallback;
    if (heading) heading.remove();
    return text;
  }

  function collectSidebarHeadings(container) {
    return Array.from(container.querySelectorAll("h2"))
      .map((heading) => ({
        id: heading.id,
        text: (heading.textContent || "").trim(),
      }))
      .filter((item) => item.id && item.text);
  }

  function collectTocHeadings(container) {
    return Array.from(container.querySelectorAll("h2, h3"))
      .map((heading) => ({
        id: heading.id,
        text: (heading.textContent || "").trim(),
        level: heading.tagName === "H3" ? 1 : 0,
      }))
      .filter((item) => item.id && item.text);
  }

  function ensureHeadingIds(container) {
    const headings = container.querySelectorAll("h2, h3, h4");
    let counter = 0;
    headings.forEach((h) => {
      const prev = h.previousElementSibling;
      if (!h.id && prev && prev.tagName === "A" && prev.id) h.id = prev.id;
      if (h.id) return;

      const text = (h.textContent || "").trim();
      let slug = text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, "-")
        .replace(/^-+|-+$/g, "");
      if (!slug) slug = `section-${counter++}`;
      h.id = slug;
    });
  }

  function scrollToHash() {
    if (!window.location.hash) return;
    const id = decodeURIComponent(window.location.hash.slice(1));
    const el = document.getElementById(id) || document.querySelector(`[name="${cssEscape(id)}"]`);
    if (!el) return;
    el.scrollIntoView();
  }

  function highlightSidebarHash() {
    const currentHash = decodeURIComponent(window.location.hash.slice(1) || "");
    const links = document.querySelectorAll(".sidebar-sub-link");
    links.forEach((link) => {
      const hash = decodeURIComponent((link.hash || "").slice(1));
      link.dataset.active = currentHash && hash === currentHash ? "true" : "false";
    });
  }

  function renderDocToc(headings) {
    const root = document.getElementById("toc-items");
    if (!root) return;
    root.innerHTML = "";

    if (!headings.length) {
      root.innerHTML = `<div class="toc-empty">${window.LocoWikiSite.escapeHtml(t("common.tocEmpty", "无"))}</div>`;
      return;
    }

    headings.forEach((heading) => {
      const link = document.createElement("a");
      link.href = `#${encodeURIComponent(heading.id)}`;
      link.textContent = heading.text;
      link.style.paddingLeft = `${10 + heading.level * 14}px`;
      root.appendChild(link);
    });

    highlightTocHash();
  }

  function highlightTocHash() {
    const currentHash = decodeURIComponent(window.location.hash.slice(1) || "");
    const links = document.querySelectorAll("#site-toc a");
    links.forEach((link) => {
      const hash = decodeURIComponent((link.hash || "").slice(1));
      link.dataset.active = currentHash && hash === currentHash ? "true" : "false";
    });
  }

  function getSidebarContext(docPath) {
    const link = document.querySelector(`#site-sidebar a[data-doc-link][data-doc-path="${cssEscape(docPath)}"]`);
    const title = (link?.getAttribute("data-doc-title") || link?.textContent || docPath).trim();
    const groupTitle =
      (link?.closest(".sidebar-group")?.querySelector(".sidebar-group-title")?.textContent || "").trim() ||
      t("docs.sectionTitle", "文档");
    return { title, groupTitle };
  }

  function formatDocDate(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return "";
    const locale = getLanguage() === "en" ? "en-US" : "zh-CN";
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "numeric",
      day: "numeric",
    }).format(date);
  }

  function getDocIcon(path, title) {
    const hint = `${path || ""} ${title || ""}`.toLowerCase();
    if (hint.includes("competition") || hint.includes("规则")) return ICONS.doc;
    if (hint.includes("technical") || hint.includes("分享")) return ICONS.doc;
    if (hint.includes("reading") || hint.includes("论文")) return ICONS.doc;
    if (hint.includes("network") || hint.includes("开源")) return ICONS.doc;
    if (hint.includes("wiki") || hint.includes("知识库")) return ICONS.doc;
    return ICONS.doc;
  }

  function setSidebarActiveDoc(docPath) {
    const links = document.querySelectorAll("#site-sidebar a[data-doc-link]");
    links.forEach((link) => {
      const path = link.getAttribute("data-doc-path") || "";
      link.dataset.active = path === docPath ? "true" : "false";
    });
  }

  function createSidebarDocItem(path, title, hasChildren = false, config) {
    const wrapper = document.createElement("div");
    wrapper.className = "sidebar-doc-item";
    wrapper.dataset.docItem = "";
    wrapper.dataset.docPath = path;
    wrapper.dataset.expanded = "false";
    wrapper.dataset.hasChildren = hasChildren ? "true" : "false";

    const link = document.createElement("a");
    link.setAttribute("data-doc-link", "");
    link.setAttribute("data-doc-path", path);
    link.setAttribute("data-doc-title", title);
    link.href = getDocHref(path, config);
    link.title = title;
    link.textContent = title;

    const subtree = document.createElement("div");
    subtree.className = "sidebar-subtree";
    subtree.setAttribute("data-sidebar-subtree", "");
    subtree.hidden = true;

    wrapper.append(link, subtree);
    return wrapper;
  }

  function applyHeadingMetaToSidebarItem(item, meta) {
    if (!item || !meta) return;
    item.dataset.hasChildren = meta.hasChildren ? "true" : "false";
    const link = item.querySelector("a[data-doc-link]");
    if (!link) return;
    const baseTitle = link.getAttribute("data-doc-title") || link.textContent || "";
    const docTitleHint = link.title.includes("文档标题：") ? link.title.split(" · 文档标题：")[1] : "";
    if (docTitleHint) return;
    link.title = meta.hasChildren ? `${baseTitle} · 含下一级标题` : baseTitle;
  }

  async function fetchHeadingMeta(config, docPath) {
    if (state.headingMetaByPath.has(docPath)) {
      return state.headingMetaByPath.get(docPath);
    }
    if (state.headingMetaPromises.has(docPath)) {
      return state.headingMetaPromises.get(docPath);
    }

    const task = (async () => {
      try {
        const urls = buildUrls(config, docPath);
        const res = await fetch(urls.raw, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const md = await res.text();
        const headingCount = countSecondaryHeadings(md);
        const meta = {
          hasChildren: headingCount > 0,
          headingCount,
        };
        state.headingMetaByPath.set(docPath, meta);
        return meta;
      } catch {
        const meta = {
          hasChildren: false,
          headingCount: 0,
        };
        state.headingMetaByPath.set(docPath, meta);
        return meta;
      } finally {
        state.headingMetaPromises.delete(docPath);
      }
    })();

    state.headingMetaPromises.set(docPath, task);
    return task;
  }

  async function primeSidebarHeadingMeta(config) {
    const sidebar = document.getElementById("site-sidebar");
    if (!sidebar) return;

    const items = Array.from(sidebar.querySelectorAll("[data-doc-item]"));
    await Promise.all(
      items.map(async (item) => {
        const docPath = item.getAttribute("data-doc-path") || "";
        if (!docPath) return;
        const meta = await fetchHeadingMeta(config, docPath);
        applyHeadingMetaToSidebarItem(item, meta);
      }),
    );
  }

  function applyWikiManifestToSidebar(config, manifest) {
    if (!manifest?.items?.length) return;
    const sidebar = document.getElementById("site-sidebar");
    if (!sidebar) return;

    const fallbackPath = config?.integrations?.feishuWiki?.entryDocPath || manifest.entryDocPath;
    const fallbackItem = Array.from(sidebar.querySelectorAll("[data-doc-item]")).find(
      (item) => (item.getAttribute("data-doc-path") || "") === fallbackPath,
    );
    if (!fallbackItem) return;

    const fragment = document.createDocumentFragment();
    manifest.items.forEach((item) => {
      fragment.appendChild(createSidebarDocItem(item.path, item.title, item.hasChildren, config));
    });

    fallbackItem.replaceWith(fragment);
  }

  function syncSidebarOutline(docPath, docTitle, headings, config) {
    const sidebar = document.getElementById("site-sidebar");
    if (!sidebar) return;

    const items = Array.from(sidebar.querySelectorAll("[data-doc-item]"));
    items.forEach((item) => {
      item.dataset.expanded = "false";
      const link = item.querySelector("a[data-doc-link]");
      const subtree = item.querySelector("[data-sidebar-subtree]");
      const hasChildren = item.dataset.hasChildren === "true";
      if (link) {
        const baseTitle = link.getAttribute("data-doc-title") || link.textContent || "";
        link.textContent = baseTitle;
        link.title = hasChildren ? `${baseTitle} · 含下一级标题` : baseTitle;
      }
      if (subtree) {
        subtree.innerHTML = "";
        subtree.hidden = true;
      }

      const cachedMeta = state.headingMetaByPath.get(item.getAttribute("data-doc-path") || "");
      if (cachedMeta) {
        applyHeadingMetaToSidebarItem(item, cachedMeta);
      }
    });

    const activeItem = items.find((item) => item.getAttribute("data-doc-path") === docPath);
    if (!activeItem) return;

    const activeLink = activeItem.querySelector("a[data-doc-link]");
    const activeSubtree = activeItem.querySelector("[data-sidebar-subtree]");
    if (!activeLink || !activeSubtree) return;

    const baseTitle = activeLink.getAttribute("data-doc-title") || activeLink.textContent || docTitle;
    activeItem.dataset.hasChildren = headings.length > 0 ? "true" : "false";
    activeLink.textContent = baseTitle;
    activeLink.title =
      baseTitle !== docTitle
        ? headings.length > 0
          ? `${baseTitle} · 文档标题：${docTitle} · 含下一级标题`
          : `${baseTitle} · 文档标题：${docTitle}`
        : headings.length > 0
          ? `${baseTitle} · 含下一级标题`
          : baseTitle;

    if (headings.length === 0) return;

    headings.forEach((heading) => {
      const link = document.createElement("a");
      link.className = "sidebar-sub-link";
      link.href = `${getDocHref(docPath, config)}#${encodeURIComponent(heading.id)}`;
      link.textContent = heading.text;
      link.title = heading.text;
      activeSubtree.appendChild(link);
    });

    const shouldAutoExpand = Boolean(window.location.hash);
    activeItem.dataset.expanded = shouldAutoExpand ? "true" : "false";
    activeSubtree.hidden = !shouldAutoExpand;
    highlightSidebarHash();
  }

  function initSidebarTreeInteractions() {
    const sidebar = document.getElementById("site-sidebar");
    if (!sidebar || sidebar.dataset.treeInit === "true") return;
    sidebar.dataset.treeInit = "true";

    sidebar.addEventListener("click", (event) => {
      const link = event.target instanceof Element ? event.target.closest("a[data-doc-link]") : null;
      if (!link || link.dataset.active !== "true") return;

      const item = link.closest("[data-doc-item]");
      const subtree = item?.querySelector("[data-sidebar-subtree]");
      if (!item || !subtree || subtree.childElementCount === 0) return;

      event.preventDefault();
      event.stopPropagation();
      const nextExpanded = item.dataset.expanded !== "true";
      item.dataset.expanded = nextExpanded ? "true" : "false";
      subtree.hidden = !nextExpanded;
    });
  }

  function rewriteLinksAndMedia(container, config, currentDocPath) {
    const links = container.querySelectorAll("a[href]");
    links.forEach((a) => {
      const rawHref = a.getAttribute("href") || "";
      if (!rawHref) return;
      if (rawHref.startsWith("#")) return;

      if (isDangerousHref(rawHref)) {
        a.removeAttribute("href");
        return;
      }

      if (isExternalHref(rawHref)) {
        a.setAttribute("target", "_blank");
        a.setAttribute("rel", "noopener noreferrer");
        return;
      }

      const { base, hash } = splitHash(rawHref);
      if (!base) return;
      const decodedBase = safeDecode(base);
      const resolved = resolveRelativePath(currentDocPath, decodedBase);
      const lower = decodedBase.toLowerCase();

      if (lower.endsWith(".md")) {
        const mappedPath =
          typeof window.LocoWikiSite?.mapDocPathToLanguage === "function"
            ? window.LocoWikiSite.mapDocPathToLanguage(resolved, getLanguage(), config)
            : resolved;
        a.setAttribute("href", `${getDocHref(mappedPath, config)}${hash}`);
        return;
      }

      const urls = buildUrls(config, resolved);
      a.setAttribute("href", urls.download);
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener noreferrer");
    });

    const imgs = container.querySelectorAll("img[src]");
    imgs.forEach((img) => {
      const rawSrc = img.getAttribute("src") || "";
      if (!rawSrc) return;
      if (isDangerousHref(rawSrc)) {
        img.removeAttribute("src");
        return;
      }
      if (isExternalHref(rawSrc) || rawSrc.startsWith("data:")) return;
      const decodedSrc = safeDecode(rawSrc);
      const resolved = resolveRelativePath(currentDocPath, decodedSrc);
      const urls = buildUrls(config, resolved);
      img.setAttribute("src", urls.raw);
      img.setAttribute("loading", "lazy");
      img.setAttribute("decoding", "async");
    });
  }

  function getDocElements() {
    const docEl = document.getElementById("doc");
    if (!docEl) return null;

    let metaEl = docEl.querySelector(".doc-meta");
    let contentEl = docEl.querySelector("#doc-content");
    let pagerEl = docEl.querySelector(".doc-pager");
    if (metaEl && contentEl && pagerEl) return { docEl, metaEl, contentEl, pagerEl };

    docEl.innerHTML = `
      <div class="doc-meta"></div>
      <div id="doc-content" class="doc-content-live"></div>
      <nav class="doc-pager" hidden></nav>
    `;

    metaEl = docEl.querySelector(".doc-meta");
    contentEl = docEl.querySelector("#doc-content");
    pagerEl = docEl.querySelector(".doc-pager");
    return { docEl, metaEl, contentEl, pagerEl };
  }

  function renderDocMeta(metaEl, docPath, urls, options = {}) {
    const context = getSidebarContext(docPath);
    const docTitle = options.title || context.title;
    const dateText = formatDocDate(options.lastModified);
    const homeText = t("header.homeTitle", "主页");
    metaEl.innerHTML = `
      <div class="doc-meta-breadcrumbs">
        <a href="index.html">${window.LocoWikiSite.escapeHtml(homeText)}</a>
        <span class="doc-breadcrumbs-sep">/</span>
        <span>${window.LocoWikiSite.escapeHtml(docTitle)}</span>
      </div>
      <div class="doc-meta-title-row">
        <span class="doc-meta-icon" aria-hidden="true">${getDocIcon(docPath, docTitle)}</span>
        <h1>${window.LocoWikiSite.escapeHtml(docTitle)}</h1>
      </div>
      <div class="doc-meta-line">
        ${
          dateText
            ? `
          <span class="doc-meta-inline">
            <span class="meta-inline-icon" aria-hidden="true">${ICONS.calendar}</span>
            <span>${window.LocoWikiSite.escapeHtml(dateText)}</span>
          </span>
        `
            : ""
        }
        <span class="doc-meta-inline doc-meta-inline-path">
          <span>${window.LocoWikiSite.escapeHtml(t("docs.metaPath", "路径"))}:</span>
          <code>${window.LocoWikiSite.escapeHtml(docPath)}</code>
          <span class="doc-meta-sep" aria-hidden="true">·</span>
          <a class="doc-meta-link" href="${urls.edit}" target="_blank" rel="noopener noreferrer">${window.LocoWikiSite.escapeHtml(
            t("docs.editOnGitHub", "在 GitHub 编辑"),
          )}</a>
        </span>
      </div>
    `;
  }

  function renderDocPager(pagerEl, docPath, config) {
    if (!pagerEl) return;
    const sequence = Array.from(document.querySelectorAll("#site-sidebar a[data-doc-link]"))
      .map((link) => ({
        path: link.getAttribute("data-doc-path") || "",
        title: (link.getAttribute("data-doc-title") || link.textContent || "").trim(),
      }))
      .filter((item, index, list) => item.path && item.title && list.findIndex((candidate) => candidate.path === item.path) === index);

    const currentIndex = sequence.findIndex((item) => item.path === docPath);
    const prev = currentIndex > 0 ? sequence[currentIndex - 1] : null;
    const next = currentIndex !== -1 && currentIndex < sequence.length - 1 ? sequence[currentIndex + 1] : null;

    if (!prev && !next) {
      pagerEl.hidden = true;
      pagerEl.innerHTML = "";
      return;
    }

    pagerEl.hidden = false;
    pagerEl.innerHTML = [prev, next]
      .map((item, index) => {
        if (!item) return "";
        const dir = index === 0 ? "prev" : "next";
        const label =
          dir === "prev" ? t("docs.prevPage", "上一页") : t("docs.nextPage", "下一页");
        return `
          <a class="doc-pager-link" data-dir="${dir}" href="${getDocHref(item.path, config)}">
            <span class="doc-pager-label">${window.LocoWikiSite.escapeHtml(label)}</span>
            <span class="doc-pager-title">${window.LocoWikiSite.escapeHtml(item.title)}</span>
          </a>
        `;
      })
      .join("");
  }

  function getTableColumnCount(table) {
    return Math.max(
      0,
      ...Array.from(table.rows || []).map((row) =>
        Array.from(row.cells || []).reduce((sum, cell) => sum + Math.max(1, cell.colSpan || 1), 0),
      ),
    );
  }

  function shouldEnhanceWideTable(table, docPath) {
    const columnCount = getTableColumnCount(table);
    const hasLongLink = Array.from(table.querySelectorAll("a")).some((link) => {
      const text = (link.textContent || "").trim();
      return text.length >= 18 || (link.getAttribute("href") || "").length >= 32;
    });
    return (
      columnCount >= 5 ||
      (columnCount >= 4 && hasLongLink) ||
      String(docPath || "").toLowerCase().includes("network-open-source/")
    );
  }

  function syncWideTableState(wrapper) {
    if (!wrapper) return;
    const scroller = wrapper.querySelector(".table-scroll-inner");
    const hint = wrapper.querySelector(".table-scroll-hint");
    if (!scroller || !hint) return;
    const overflow = scroller.scrollWidth > scroller.clientWidth + 8;
    wrapper.dataset.overflow = overflow ? "true" : "false";
    hint.hidden = !overflow || scroller.scrollLeft > 10;
  }

  function enhanceWideTables(container, docPath) {
    const tables = Array.from(container.querySelectorAll("table"));
    tables.forEach((table) => {
      if (!shouldEnhanceWideTable(table, docPath) || table.closest(".table-scroll-wrap")) return;

      const wrap = document.createElement("div");
      wrap.className = "table-scroll-wrap";
      wrap.dataset.overflow = "false";

      const hint = document.createElement("div");
      hint.className = "table-scroll-hint";
      hint.textContent = t("docs.tableScrollHint", "表格较宽，可左右滚动查看更多列");
      hint.hidden = true;

      const scroller = document.createElement("div");
      scroller.className = "table-scroll-inner";
      table.replaceWith(wrap);
      scroller.appendChild(table);
      wrap.append(hint, scroller);
      scroller.addEventListener("scroll", () => syncWideTableState(wrap), { passive: true });
    });

    window.requestAnimationFrame(() => {
      container.querySelectorAll(".table-scroll-wrap").forEach((wrapper) => syncWideTableState(wrapper));
    });
  }

  function setDocLoading(docEl, isLoading) {
    docEl.dataset.loading = isLoading ? "true" : "false";
  }

  function animateContentSwap(contentEl) {
    if (typeof contentEl.animate !== "function") return;
    contentEl.animate(
      [
        { opacity: 0.84, transform: "translateY(4px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      {
        duration: 180,
        easing: "cubic-bezier(.2,.8,.2,1)",
      },
    );
  }

  function parseLocationTarget(config, manifest) {
    const params = new URLSearchParams(window.location.search);
    const defaultDocPath =
      typeof window.LocoWikiSite?.getDefaultDocPathForShell === "function"
        ? window.LocoWikiSite.getDefaultDocPathForShell(config, getLanguage(), getDocShellName())
        : config.site.defaultDoc || "README.md";
    const requestedPath = params.get("path") || defaultDocPath;
    const docPath = isFeishuDocPath(requestedPath)
      ? manifest?.entryDocPath || config?.integrations?.feishuWiki?.entryDocPath || requestedPath
      : requestedPath;
    return { requestedPath, docPath, hash: window.location.hash || "" };
  }

  function ensureDocShell(docPath, config) {
    const targetHref = getDocHref(docPath, config);
    const targetUrl = new URL(targetHref, window.location.href);
    if (targetUrl.pathname === window.location.pathname) return false;
    window.location.replace(`${targetUrl.pathname}${targetUrl.search}${window.location.hash || ""}`);
    return true;
  }

  async function getConfig() {
    if (!state.configPromise) {
      state.configPromise = window.LocoWikiSite.getConfig();
    }
    return state.configPromise;
  }

  async function getWikiManifest(config, lang, force = false) {
    if (!force && state.manifestByLang.has(lang)) {
      return state.manifestByLang.get(lang);
    }

    const manifestPath = getManifestPath(config);
    const urls = buildUrls(config, manifestPath);
    let manifest = null;
    try {
      const res = await fetch(urls.raw, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        manifest = normalizeWikiManifest(data, lang, config);
      }
    } catch (err) {
      console.warn("Failed to load wiki manifest:", err);
    }

    state.manifestByLang.set(lang, manifest);
    return manifest;
  }

  async function renderDocView(options = {}) {
    const { forceManifest = false } = options;
    const elements = getDocElements();
    if (!elements) return;

    const { docEl, metaEl, contentEl, pagerEl } = elements;
    const config = await getConfig();
    const lang = getLanguage();
    const manifest = await getWikiManifest(config, lang, forceManifest);
    seedHeadingMetaFromManifest(manifest);
    applyWikiManifestToSidebar(config, manifest);
    initSidebarTreeInteractions();
    await primeSidebarHeadingMeta(config);

    const { docPath, hash } = parseLocationTarget(config, manifest);
    if (ensureDocShell(docPath, config)) return;

    if (state.currentDocPath === docPath && hash && contentEl.childElementCount > 0) {
      setSidebarActiveDoc(docPath);
      syncSidebarOutline(docPath, state.currentDocTitle || docPath, collectSidebarHeadings(contentEl), config);
      renderDocToc(collectTocHeadings(contentEl));
      renderDocPager(pagerEl, docPath, config);
      scrollToHash();
      highlightSidebarHash();
      highlightTocHash();
      return;
    }

    const urls = buildUrls(config, docPath);
    const loadSeq = ++state.loadSeq;
    setSidebarActiveDoc(docPath);
    setDocLoading(docEl, true);

    try {
      const res = await fetch(urls.raw, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const md = await res.text();
      const lastModified = res.headers.get("last-modified") || "";
      if (loadSeq !== state.loadSeq) return;

      if (typeof window.marked?.setOptions === "function") {
        window.marked.setOptions({
          gfm: true,
          breaks: false,
          headerIds: true,
          mangle: false,
        });
      }

      const html = typeof window.marked?.parse === "function" ? window.marked.parse(md) : md;
      const stage = document.createElement("div");
      stage.innerHTML = html;

      rewriteLinksAndMedia(stage, config, docPath);
      const docTitle = consumeDocTitle(stage, getDocTitle(stage, docPath));
      ensureHeadingIds(stage);

      renderDocMeta(metaEl, docPath, urls, { title: docTitle, lastModified });
      contentEl.className = "doc-content-live";
      contentEl.innerHTML = stage.innerHTML;
      enhanceWideTables(contentEl, docPath);
      animateContentSwap(contentEl);

      state.currentDocPath = docPath;
      state.currentDocTitle = docTitle;

      syncSidebarOutline(docPath, docTitle, collectSidebarHeadings(contentEl), config);
      renderDocToc(collectTocHeadings(contentEl));
      renderDocPager(pagerEl, docPath, config);
      scrollToHash();
      highlightSidebarHash();
      highlightTocHash();

      const titleBase = config.site.title || "LocoWiki";
      document.title = `${titleBase} · ${docTitle}`;
    } catch (err) {
      if (loadSeq !== state.loadSeq) return;
      console.error(err);
      renderDocMeta(metaEl, docPath, urls, { title: docPath });
      contentEl.className = "error doc-content-live";
      contentEl.innerHTML = `
        <div><strong>${window.LocoWikiSite.escapeHtml(t("docs.loadFailed", "加载失败"))}</strong></div>
        <div style="margin-top: 8px; color: var(--muted);">
          ${window.LocoWikiSite.escapeHtml(t("docs.cannotFetch", "无法从源仓库拉取"))}
          <code>${window.LocoWikiSite.escapeHtml(docPath)}</code>${window.LocoWikiSite.escapeHtml(t("docs.fetchSeparator", "。"))}
          ${window.LocoWikiSite.escapeHtml(t("docs.youCan", "你可以："))}
          <ul>
            <li>${window.LocoWikiSite.escapeHtml(t("docs.tipNetwork", "确认网络可访问 raw.githubusercontent.com"))}</li>
            <li>${window.LocoWikiSite.escapeHtml(t("docs.tipPath", "检查文件路径是否存在"))}</li>
            <li>${window.LocoWikiSite.escapeHtml(t("docs.tipGitHub", "直接在 GitHub 上查看："))}
              <a href="${urls.blob}" target="_blank" rel="noopener noreferrer">${urls.blob}</a>
            </li>
          </ul>
        </div>
      `;
      state.currentDocPath = docPath;
      state.currentDocTitle = docPath;
      renderDocToc([]);
      renderDocPager(pagerEl, docPath, config);
      highlightSidebarHash();
      highlightTocHash();
    } finally {
      if (loadSeq === state.loadSeq) {
        setDocLoading(docEl, false);
      }
    }
  }

  function navigateTo(url, options = {}) {
    const { replace = false } = options;
    const nextUrl = url instanceof URL ? url : new URL(url, window.location.href);
    const current = new URL(window.location.href);

    if (nextUrl.pathname !== current.pathname || nextUrl.search !== current.search || nextUrl.hash !== current.hash) {
      const method = replace ? "replaceState" : "pushState";
      window.history[method]({}, "", `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
    }

    renderDocView().catch((err) => console.error(err));
  }

  function isDocsPageUrl(url) {
    if (url.origin !== window.location.origin) return false;
    const targetShell = getDocShellName(url.pathname);
    return Boolean(targetShell) && targetShell === getDocShellName();
  }

  function initClientNavigation() {
    if (document.body?.dataset.docsNavigationInit === "true") return;
    document.body.dataset.docsNavigationInit = "true";

    document.addEventListener("click", (event) => {
      if (event.defaultPrevented) return;
      if (isModifiedEvent(event)) return;
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const href = anchor.getAttribute("href") || "";
      if (!href || href.startsWith("#")) return;

      let url;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }

      if (anchor.closest("#site-header")) {
        event.preventDefault();
        window.location.assign(`${url.pathname}${url.search}${url.hash}`);
        return;
      }

      if (!isDocsPageUrl(url)) return;

      event.preventDefault();
      navigateTo(url);
    });

    window.addEventListener("popstate", () => {
      renderDocView().catch((err) => console.error(err));
    });
  }

  window.addEventListener("DOMContentLoaded", () => {
    initClientNavigation();
    renderDocView({ forceManifest: true }).catch((err) => console.error(err));
    window.addEventListener("hashchange", () => {
      scrollToHash();
      highlightSidebarHash();
      highlightTocHash();
    });
    window.addEventListener("locowiki:languagechange", () => {
      renderDocView({ forceManifest: true }).catch((err) => console.error(err));
    });
  });
})();
