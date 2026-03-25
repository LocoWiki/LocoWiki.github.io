(function () {
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
      download: `https://github.com/${owner}/${repo}/raw/${branch}/${encoded}`,
    };
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
        a.setAttribute("href", `docs.html?path=${encodeURIComponent(mappedPath)}${hash}`);
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

  function renderToc(container) {
    const tocRoot = document.getElementById("toc-items");
    if (!tocRoot) return;
    tocRoot.innerHTML = "";

    const headings = Array.from(container.querySelectorAll("h2, h3"));
    if (headings.length === 0) {
      tocRoot.innerHTML = `<div style="color: var(--muted); font-size: 13px;">${window.LocoWikiSite.escapeHtml(t("common.tocEmpty", "无"))}</div>`;
      return;
    }

    headings.forEach((h) => {
      const level = h.tagName === "H3" ? 1 : 0;
      const a = document.createElement("a");
      a.href = `#${encodeURIComponent(h.id)}`;
      a.textContent = (h.textContent || "").trim();
      a.style.paddingLeft = `${8 + level * 12}px`;
      tocRoot.appendChild(a);
    });
  }

  function scrollToHash() {
    if (!window.location.hash) return;
    const id = decodeURIComponent(window.location.hash.slice(1));
    const el = document.getElementById(id) || document.querySelector(`[name="${cssEscape(id)}"]`);
    if (!el) return;
    el.scrollIntoView();
  }

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === "function") return window.CSS.escape(value);
    return String(value).replace(/["\\]/g, "\\$&");
  }

  function getLanguage() {
    const lang =
      typeof window.LocoWikiSite?.getLanguage === "function" ? window.LocoWikiSite.getLanguage() : "zh";
    return lang === "en" ? "en" : "zh";
  }

  async function loadDoc() {
    const docEl = document.getElementById("doc");
    if (!docEl) return;

    const config = await window.LocoWikiSite.getConfig();
    const lang = getLanguage();
    const params = new URLSearchParams(window.location.search);
    const defaultDocPath =
      typeof window.LocoWikiSite?.getDefaultDocPath === "function"
        ? window.LocoWikiSite.getDefaultDocPath(config, lang)
        : config.site.defaultDoc || "README.md";
    const docPath = params.get("path") || defaultDocPath;

    const urls = buildUrls(config, docPath);

    docEl.innerHTML = `
      <div class="doc-meta">
        <span>${window.LocoWikiSite.escapeHtml(t("docs.metaPath", "路径"))}: <code>${window.LocoWikiSite.escapeHtml(docPath)}</code></span>
        <a href="${urls.blob}" target="_blank" rel="noopener noreferrer">${window.LocoWikiSite.escapeHtml(t("docs.viewOnGitHub", "在 GitHub 查看"))}</a>
        <a href="${urls.download}" target="_blank" rel="noopener noreferrer">${window.LocoWikiSite.escapeHtml(t("docs.downloadRaw", "下载/原始文件"))}</a>
      </div>
      <div id="doc-content" class="loading">${window.LocoWikiSite.escapeHtml(t("docs.loadingContent", "正在加载内容…"))}</div>
    `;

    const contentEl = document.getElementById("doc-content");
    try {
      const res = await fetch(urls.raw, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const md = await res.text();

      if (typeof window.marked?.setOptions === "function") {
        window.marked.setOptions({
          gfm: true,
          breaks: false,
          headerIds: true,
          mangle: false,
        });
      }

      const html = typeof window.marked?.parse === "function" ? window.marked.parse(md) : md;
      contentEl.className = "";
      contentEl.innerHTML = html;

      rewriteLinksAndMedia(contentEl, config, docPath);
      ensureHeadingIds(contentEl);
      renderToc(contentEl);
      scrollToHash();

      if (typeof window.LocoWikiSite?.getConfig === "function") {
        const titleBase = config.site.title || "LocoWiki";
        document.title = `${titleBase} · ${docPath}`;
      }
    } catch (err) {
      console.error(err);
      contentEl.className = "error";
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
    }
  }

  window.addEventListener("DOMContentLoaded", () => {
    loadDoc().catch((e) => console.error(e));
    window.addEventListener("hashchange", () => {
      scrollToHash();
    });
    window.addEventListener("locowiki:languagechange", () => {
      loadDoc().catch((e) => console.error(e));
    });
  });
})();
