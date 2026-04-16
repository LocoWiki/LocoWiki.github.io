import { getSiteConfig } from "../core/config.js";
import { getDefaultDocPathForShell, getDocPageHref, getDocShellName, mapDocPathToLanguage } from "../core/docs-routing.js";
import { t } from "../core/i18n.js";
import { getCurrentLanguage } from "../core/preferences.js";
import { renderDocsFrameHead } from "../components/content-head.js";
import { cssEscape, dirname, encodePath, escapeAttr, escapeHtml, isDangerousHref, isExternalHref, normalizePath, resolveRelativePath, safeDecode, splitHash, stripLeadingSlash } from "../core/utils.js";

const state = {
  currentDocPath: "",
  currentDocTitle: "",
  loadSeq: 0,
  navigationBound: false
};

const FEISHU_DOCS_URL = "https://lain-database.feishu.cn/wiki/HwyJwB70niKbW7khmwlcbCH2nXb?from=from_copylink";

function isLocalDocPath(path) {
  return String(path || "").trim().startsWith("site-docs/");
}

function createMathPlaceholder(id, block) {
  return block ? `<div data-locowiki-math-block="${id}"></div>` : `<span data-locowiki-math-inline="${id}"></span>`;
}

function stashMarkdownMath(markdown) {
  const stash = [];
  let output = String(markdown || "");

  const replacePattern = (pattern, block) => {
    output = output.replace(pattern, (match) => {
      const id = stash.push(match) - 1;
      return createMathPlaceholder(id, block);
    });
  };

  replacePattern(/\$\$[\s\S]+?\$\$/g, true);
  replacePattern(/\\\[[\s\S]+?\\\]/g, true);
  replacePattern(/\\\((?:\\.|[^\\\n]|\\(?!\)))*\\\)/g, false);
  output = output.replace(/(^|[^\\$])(\$(?:\\.|[^$\\\n])+\$)/g, (match, prefix, math) => {
    const id = stash.push(math) - 1;
    return `${prefix}${createMathPlaceholder(id, false)}`;
  });

  return { markdown: output, stash };
}

function restoreMathPlaceholders(container, stash) {
  container.querySelectorAll("[data-locowiki-math-block], [data-locowiki-math-inline]").forEach((element) => {
    const rawId = element.getAttribute("data-locowiki-math-block") || element.getAttribute("data-locowiki-math-inline");
    const id = Number.parseInt(rawId || "", 10);
    if (!Number.isInteger(id) || !stash[id]) return;
    element.replaceWith(document.createTextNode(stash[id]));
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
  return {
    docEl,
    metaEl: docEl.querySelector(".doc-meta"),
    contentEl: docEl.querySelector("#doc-content"),
    pagerEl: docEl.querySelector(".doc-pager")
  };
}

function buildUrls(config, path) {
  const cleanPath = stripLeadingSlash(path);
  const encoded = encodePath(cleanPath);
  if (isLocalDocPath(cleanPath)) {
    return {
      raw: encoded,
      blob: encoded,
      edit: "",
      download: encoded,
      isLocal: true
    };
  }

  const owner = config.sourceRepo.owner;
  const repo = config.sourceRepo.repo;
  const branch = config.sourceRepo.branch;
  return {
    raw: `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${encoded}`,
    blob: `https://github.com/${owner}/${repo}/blob/${branch}/${encoded}`,
    edit: `https://github.com/${owner}/${repo}/edit/${branch}/${encoded}`,
    download: `https://github.com/${owner}/${repo}/raw/${branch}/${encoded}`,
    isLocal: false
  };
}

function getTargetDocPath(config) {
  const lang = getCurrentLanguage();
  const shell = document.body?.dataset.docShell || getDocShellName() || "quickstart";
  const params = new URLSearchParams(window.location.search);
  const requested = params.get("path") || getDefaultDocPathForShell(config, lang, shell);
  return mapDocPathToLanguage(requested, lang, config);
}

function ensureHeadingIds(container) {
  const used = new Set();
  container.querySelectorAll("[id]").forEach((element) => used.add(element.id));
  let counter = 0;
  container.querySelectorAll("h2, h3, h4").forEach((heading) => {
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

function rewriteLinksAndMedia(container, config, currentDocPath) {
  container.querySelectorAll("a[href]").forEach((anchor) => {
    const rawHref = anchor.getAttribute("href") || "";
    if (!rawHref || rawHref.startsWith("#")) return;
    if (isDangerousHref(rawHref)) {
      anchor.removeAttribute("href");
      return;
    }
    if (isExternalHref(rawHref)) {
      anchor.setAttribute("target", "_blank");
      anchor.setAttribute("rel", "noopener noreferrer");
      return;
    }

    const { base, hash } = splitHash(rawHref);
    const resolved = resolveRelativePath(currentDocPath, safeDecode(base));
    if (base.toLowerCase().endsWith(".md")) {
      anchor.setAttribute("href", `${getDocPageHref(resolved, config, getCurrentLanguage())}${hash}`);
      return;
    }

    anchor.setAttribute("href", buildUrls(config, resolved).download);
    anchor.setAttribute("target", "_blank");
    anchor.setAttribute("rel", "noopener noreferrer");
  });

  container.querySelectorAll("img[src]").forEach((image) => {
    const rawSrc = image.getAttribute("src") || "";
    if (!rawSrc || isDangerousHref(rawSrc) || isExternalHref(rawSrc) || rawSrc.startsWith("data:")) return;
    const resolved = resolveRelativePath(currentDocPath, safeDecode(rawSrc));
    image.src = buildUrls(config, resolved).raw;
    image.loading = "lazy";
    image.decoding = "async";
  });
}

function renderMath(container) {
  if (typeof window.renderMathInElement !== "function") return;
  window.renderMathInElement(container, {
    delimiters: [
      { left: "$$", right: "$$", display: true },
      { left: "\\[", right: "\\]", display: true },
      { left: "\\(", right: "\\)", display: false },
      { left: "$", right: "$", display: false }
    ],
    throwOnError: false,
    strict: "ignore",
    ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code", "option"]
  });
}

function collectHeadings(container) {
  return Array.from(container.querySelectorAll("h2, h3"))
    .map((heading) => ({
      id: heading.id,
      text: (heading.textContent || "").trim(),
      level: heading.tagName === "H3" ? 1 : 0
    }))
    .filter((item) => item.id && item.text);
}

function collectSidebarHeadings(container) {
  return Array.from(container.querySelectorAll("h2"))
    .map((heading) => ({
      id: heading.id,
      text: (heading.textContent || "").trim()
    }))
    .filter((item) => item.id && item.text);
}

function renderDocToc(headings) {
  const root = document.getElementById("toc-items");
  if (!root) return;
  if (!headings.length) {
    root.innerHTML = `<div class="toc-empty">${escapeHtml(t("common.tocEmpty", { fallback: "None" }))}</div>`;
    return;
  }
  root.innerHTML = headings
    .map(
      (heading) => `
        <a href="#${encodeURIComponent(heading.id)}" style="padding-left:${10 + heading.level * 14}px">${escapeHtml(heading.text)}</a>
      `
    )
    .join("");
}

function formatDocDate(rawValue) {
  const date = new Date(String(rawValue || "").trim());
  if (Number.isNaN(date.getTime())) return "";
  const locale = getCurrentLanguage() === "en" ? "en-US" : "zh-CN";
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "numeric",
    day: "numeric"
  }).format(date);
}

function getSidebarContext(docPath) {
  const link = document.querySelector(`#site-sidebar a[data-doc-link][data-doc-path="${cssEscape(docPath)}"]`);
  const title = (link?.getAttribute("data-doc-title") || link?.textContent || docPath).trim();
  const shell = document.body?.dataset.docShell || getDocShellName() || "quickstart";
  const lang = getCurrentLanguage();
  const shellMap = {
    quickstart: {
      title: lang === "en" ? "Quick Start" : "快速上手",
      href: "quickstart.html"
    },
    docs: {
      title: lang === "en" ? "Docs" : "文档",
      href: "docs.html"
    },
    developer: {
      title: lang === "en" ? "Developer Docs" : "开发文档",
      href: "developer-docs.html"
    }
  };
  const currentShell = shellMap[shell] || shellMap.quickstart;
  return {
    title,
    shellTitle: currentShell.title,
    shellHref: currentShell.href
  };
}

function renderDocMeta(metaEl, docPath, urls, options = {}) {
  const context = getSidebarContext(docPath);
  const title = options.title || context.title || docPath;
  const date = formatDocDate(options.lastModified);
  metaEl.className = "doc-meta content-head content-head-doc";
  metaEl.innerHTML = renderDocsFrameHead({
    title,
    breadcrumbs: [
      {
        label: { zh: "主页", en: "Home" },
        href: "index.html"
      },
      {
        label: {
          zh: context.shellTitle,
          en: context.shellTitle
        },
        href: context.shellHref
      },
      {
        label: {
          zh: title,
          en: title
        }
      }
    ],
    date,
    docPath,
    editHref: urls.edit
  });
}

function setSidebarActiveDoc(docPath) {
  document.querySelectorAll("#site-sidebar a[data-doc-link]").forEach((link) => {
    const path = link.getAttribute("data-doc-path") || "";
    link.dataset.active = path === docPath ? "true" : "false";
  });
}

function syncSidebarOutline(docPath, docTitle, headings, config) {
  const activeItem = document.querySelector(`#site-sidebar [data-doc-item][data-doc-path="${cssEscape(docPath)}"]`);
  document.querySelectorAll("#site-sidebar [data-sidebar-subtree]").forEach((subtree) => {
    subtree.innerHTML = "";
    subtree.hidden = true;
  });
  document.querySelectorAll("#site-sidebar [data-doc-item]").forEach((item) => {
    item.dataset.expanded = "false";
  });
  if (!activeItem || !headings.length) return;

  const subtree = activeItem.querySelector("[data-sidebar-subtree]");
  if (!subtree) return;
  subtree.innerHTML = headings
    .map(
      (heading) => `
        <a class="sidebar-sub-link" href="${escapeAttr(getDocPageHref(docPath, config, getCurrentLanguage()))}#${encodeURIComponent(heading.id)}">${escapeHtml(
          heading.text
        )}</a>
      `
    )
    .join("");
  activeItem.dataset.expanded = window.location.hash ? "true" : "false";
  subtree.hidden = !window.location.hash;
}

function renderDocPager(pagerEl, docPath, config) {
  const sequence = Array.from(document.querySelectorAll("#site-sidebar a[data-doc-link]"))
    .map((link) => ({
      path: link.getAttribute("data-doc-path") || "",
      title: (link.getAttribute("data-doc-title") || link.textContent || "").trim()
    }))
    .filter((item, index, list) => item.path && list.findIndex((candidate) => candidate.path === item.path) === index);

  const index = sequence.findIndex((item) => item.path === docPath);
  const prev = index > 0 ? sequence[index - 1] : null;
  const next = index >= 0 && index < sequence.length - 1 ? sequence[index + 1] : null;
  if (!prev && !next) {
    pagerEl.hidden = true;
    pagerEl.innerHTML = "";
    return;
  }
  pagerEl.hidden = false;
  pagerEl.innerHTML = [prev, next]
    .map((item, itemIndex) => {
      if (!item) return "";
      const dir = itemIndex === 0 ? "prev" : "next";
      const label = dir === "prev" ? t("docs.prevPage", { fallback: "Previous" }) : t("docs.nextPage", { fallback: "Next" });
      const arrow = dir === "prev" ? "←" : "→";
      return `
        <a class="doc-pager-link" data-dir="${dir}" href="${escapeAttr(getDocPageHref(item.path, config, getCurrentLanguage()))}">
          <span class="doc-pager-head">
            <span class="doc-pager-arrow" aria-hidden="true">${arrow}</span>
            <span class="doc-pager-label">${escapeHtml(label)}</span>
          </span>
          <span class="doc-pager-title">${escapeHtml(item.title)}</span>
        </a>
      `;
    })
    .join("");
}

function scrollToHash() {
  if (!window.location.hash) return;
  const id = decodeURIComponent(window.location.hash.slice(1));
  const target = document.getElementById(id) || document.querySelector(`[name="${cssEscape(id)}"]`);
  if (target) target.scrollIntoView();
}

function consumeDocTitle(container, fallback) {
  const heading = container.querySelector("h1");
  const title = (heading?.textContent || "").trim() || fallback;
  if (heading) heading.remove();
  return title;
}

function renderError(contentEl, docPath, urls) {
  const viewLabel = urls.isLocal ? "View source file:" : t("docs.tipGitHub", { fallback: "View directly on GitHub:" });
  const fetchTarget = urls.isLocal ? "local site document" : t("docs.cannotFetch", { fallback: "Unable to fetch from the source repository" });
  contentEl.className = "error doc-content-live";
  contentEl.innerHTML = `
    <div><strong>${escapeHtml(t("docs.loadFailed", { fallback: "Failed to load" }))}</strong></div>
    <div style="margin-top: 8px; color: var(--muted);">
      ${escapeHtml(typeof fetchTarget === "string" ? fetchTarget : "")}
      <code>${escapeHtml(docPath)}</code>${escapeHtml(t("docs.fetchSeparator", { fallback: "." }))}
      ${escapeHtml(t("docs.youCan", { fallback: "You can:" }))}
      <ul>
        ${
          urls.isLocal
            ? `<li>${escapeHtml(getCurrentLanguage() === "en" ? "Verify that the local Markdown file exists in this repository" : "确认这个本地 Markdown 文件已经存在于当前仓库中")}</li>`
            : `<li>${escapeHtml(t("docs.tipNetwork", { fallback: "Check whether raw.githubusercontent.com is reachable" }))}</li>`
        }
        <li>${escapeHtml(t("docs.tipPath", { fallback: "Verify that the file path exists" }))}</li>
        <li>${escapeHtml(viewLabel)} <a href="${escapeAttr(urls.blob)}" target="_blank" rel="noopener noreferrer">${escapeHtml(urls.blob)}</a></li>
      </ul>
    </div>
  `;
}

function renderShellNotice() {
  const shell = document.body?.dataset.docShell || getDocShellName() || "quickstart";
  if (shell !== "docs") return "";

  const lang = getCurrentLanguage();
  const title = lang === "en" ? "Original Feishu Reading" : "飞书原文阅读";
  const body =
    lang === "en"
      ? `For a better reading experience, open the original page on <a href="${escapeAttr(FEISHU_DOCS_URL)}" target="_blank" rel="noopener noreferrer">Feishu</a>.`
      : `为获得更优阅读体验，请前往 <a href="${escapeAttr(FEISHU_DOCS_URL)}" target="_blank" rel="noopener noreferrer">飞书</a> 查看原文。`;

  return `
    <section class="page-callout">
      <strong>${escapeHtml(title)}</strong>
      <p>${body}</p>
    </section>
  `;
}

export async function renderDocsPage() {
  const elements = getDocElements();
  if (!elements) return;
  const { metaEl, contentEl, pagerEl } = elements;
  const config = await getSiteConfig();
  const docPath = getTargetDocPath(config);
  const urls = buildUrls(config, docPath);
  const loadSeq = ++state.loadSeq;
  setSidebarActiveDoc(docPath);

  try {
    const response = await fetch(urls.raw, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const markdown = await response.text();
    if (loadSeq !== state.loadSeq) return;

    if (typeof window.marked?.setOptions === "function") {
      window.marked.setOptions({ gfm: true, breaks: false, mangle: false });
    }

    const prepared = stashMarkdownMath(markdown);
    const stage = document.createElement("div");
    stage.innerHTML = typeof window.marked?.parse === "function" ? window.marked.parse(prepared.markdown) : prepared.markdown;
    restoreMathPlaceholders(stage, prepared.stash);
    rewriteLinksAndMedia(stage, config, docPath);
    ensureHeadingIds(stage);
    const docTitle = consumeDocTitle(stage, getSidebarContext(docPath).title || docPath);

    renderDocMeta(metaEl, docPath, urls, {
      title: docTitle,
      lastModified: response.headers.get("last-modified") || ""
    });
    contentEl.className = "doc-content-live";
    contentEl.innerHTML = `${renderShellNotice()}${stage.innerHTML}`;
    renderMath(contentEl);
    renderDocToc(collectHeadings(contentEl));
    syncSidebarOutline(docPath, docTitle, collectSidebarHeadings(contentEl), config);
    renderDocPager(pagerEl, docPath, config);
    state.currentDocPath = docPath;
    state.currentDocTitle = docTitle;
    document.title = `${config?.site?.title || "LocoWiki"} · ${docTitle}`;
    scrollToHash();
  } catch (error) {
    renderDocMeta(metaEl, docPath, urls, { title: docPath });
    renderError(contentEl, docPath, urls);
    renderDocToc([]);
    renderDocPager(pagerEl, docPath, config);
  }
}

export function initDocsNavigation() {
  if (state.navigationBound) return;
  state.navigationBound = true;

  document.addEventListener("click", (event) => {
    const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
    if (!anchor) return;
    if (anchor.target && anchor.target !== "_self") return;
    const href = anchor.getAttribute("href") || "";
    if (!href || href.startsWith("#")) return;

    let url;
    try {
      url = new URL(anchor.href, window.location.href);
    } catch {
      return;
    }

    const currentShell = document.body?.dataset.docShell || getDocShellName();
    const targetShell = getDocShellName(url.pathname);
    if (targetShell !== currentShell) return;

    event.preventDefault();
    window.history.pushState({}, "", `${url.pathname}${url.search}${url.hash}`);
    renderDocsPage().catch((error) => console.error(error));
  });

  window.addEventListener("popstate", () => {
    renderDocsPage().catch((error) => console.error(error));
  });

  window.addEventListener("hashchange", () => scrollToHash());
  window.addEventListener("locowiki:languagechange", () => {
    renderDocsPage().catch((error) => console.error(error));
  });
}
