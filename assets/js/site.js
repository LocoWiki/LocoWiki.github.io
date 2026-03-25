(function () {
  const CONFIG_URL = "assets/site-config.json";
  const I18N_URL = "assets/i18n.json";
  const THEME_KEY = "locowiki_theme";
  const LANG_KEY = "locowiki_lang";

  const UI_TEXT = {
    zh: {
      navAria: "主导航",
      themeBtn: "主题",
      themeAriaToLight: "切换为浅色",
      themeAriaToDark: "切换为深色",
      langBtn: "English",
      langAria: "切换到英文",
      tocTitle: "本页目录",
    },
    en: {
      navAria: "Primary Navigation",
      themeBtn: "Theme",
      themeAriaToLight: "Switch to light theme",
      themeAriaToDark: "Switch to dark theme",
      langBtn: "中文",
      langAria: "Switch to Chinese",
      tocTitle: "On This Page",
    },
  };

  let configPromise;
  let i18nPromise;
  let i18nCache;
  let reverseAliasesCache;
  let themeInited = false;
  let languageInited = false;

  function isString(value) {
    return typeof value === "string";
  }

  function isObject(value) {
    return value && typeof value === "object" && !Array.isArray(value);
  }

  function normalizeLanguage(value) {
    const s = String(value || "")
      .trim()
      .toLowerCase();
    if (s.startsWith("en")) return "en";
    if (s.startsWith("zh")) return "zh";
    return "";
  }

  function getUiText(lang) {
    const fallback = UI_TEXT[lang === "en" ? "en" : "zh"];
    return {
      navAria: t("header.navAria", { lang, fallback: fallback.navAria }),
      themeBtn: t("header.themeBtn", { lang, fallback: fallback.themeBtn }),
      themeAriaToLight: t("header.themeAriaToLight", { lang, fallback: fallback.themeAriaToLight }),
      themeAriaToDark: t("header.themeAriaToDark", { lang, fallback: fallback.themeAriaToDark }),
      langBtn: t("header.langBtn", { lang, fallback: fallback.langBtn }),
      langAria: t("header.langAria", { lang, fallback: fallback.langAria }),
      tocTitle: t("common.tocTitle", { lang, fallback: fallback.tocTitle }),
    };
  }

  async function getConfig() {
    if (!configPromise) {
      configPromise = fetch(CONFIG_URL, { cache: "no-store" }).then((res) => {
        if (!res.ok) throw new Error(`Failed to load ${CONFIG_URL}: ${res.status}`);
        return res.json();
      });
    }
    return configPromise;
  }

  async function getI18n() {
    if (!i18nPromise) {
      i18nPromise = fetch(I18N_URL, { cache: "no-store" })
        .then((res) => {
          if (!res.ok) throw new Error(`Failed to load ${I18N_URL}: ${res.status}`);
          return res.json();
        })
        .catch((err) => {
          console.error(err);
          return {};
        })
        .then((data) => {
          i18nCache = isObject(data) ? data : {};
          return i18nCache;
        });
    }
    return i18nPromise;
  }

  function getI18nSync() {
    return isObject(i18nCache) ? i18nCache : {};
  }

  function getValueByPath(obj, path) {
    if (!isObject(obj) || !isString(path) || !path) return undefined;
    return path.split(".").reduce((acc, key) => {
      if (!acc || typeof acc !== "object") return undefined;
      return acc[key];
    }, obj);
  }

  function interpolate(template, vars) {
    if (!isString(template)) return "";
    if (!isObject(vars)) return template;
    return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) => {
      if (!(key in vars)) return match;
      return String(vars[key]);
    });
  }

  function t(key, options = {}) {
    const opts = isObject(options) ? options : {};
    const lang = normalizeLanguage(opts.lang) || getCurrentLanguage();
    const fallback = isString(opts.fallback) ? opts.fallback : key;
    const dict = getI18nSync();
    const defaultLang = getDefaultLanguage({ i18n: dict });
    const value =
      getValueByPath(dict[lang], key) ??
      getValueByPath(dict[defaultLang], key) ??
      getValueByPath(dict.zh, key) ??
      getValueByPath(dict.en, key);
    const text = isString(value) ? value : fallback;
    return interpolate(text, opts.vars);
  }

  function applyI18n(root = document, lang = getCurrentLanguage()) {
    const scope = root || document;
    const selector = [
      "[data-i18n]",
      "[data-i18n-html]",
      "[data-i18n-title]",
      "[data-i18n-aria-label]",
      "[data-i18n-placeholder]",
      "[data-i18n-alt]",
      "[data-i18n-content]",
      "[data-i18n-value]",
    ].join(", ");

    const nodes = [];
    if (scope instanceof Element && scope.matches(selector)) nodes.push(scope);
    if (typeof scope.querySelectorAll === "function") {
      nodes.push(...scope.querySelectorAll(selector));
    }

    nodes.forEach((el) => {
      const textKey = el.getAttribute("data-i18n");
      if (textKey) {
        const fallback = (el.textContent || "").trim();
        el.textContent = t(textKey, { lang, fallback });
      }

      const htmlKey = el.getAttribute("data-i18n-html");
      if (htmlKey) {
        const fallback = (el.innerHTML || "").trim();
        el.innerHTML = t(htmlKey, { lang, fallback });
      }

      const attrPairs = [
        ["data-i18n-title", "title"],
        ["data-i18n-aria-label", "aria-label"],
        ["data-i18n-placeholder", "placeholder"],
        ["data-i18n-alt", "alt"],
        ["data-i18n-content", "content"],
        ["data-i18n-value", "value"],
      ];

      attrPairs.forEach(([dataAttr, targetAttr]) => {
        const key = el.getAttribute(dataAttr);
        if (!key) return;
        const fallback = el.getAttribute(targetAttr) || "";
        el.setAttribute(targetAttr, t(key, { lang, fallback }));
      });
    });
  }

  function getPreferredTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "dark" || saved === "light") return saved;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  function getDefaultLanguage(config) {
    const configDefault = normalizeLanguage(config?.i18n?.defaultLanguage);
    return configDefault || "zh";
  }

  function getPreferredLanguage(config) {
    const saved = normalizeLanguage(localStorage.getItem(LANG_KEY));
    if (saved) return saved;
    const htmlLang = normalizeLanguage(document.documentElement.getAttribute("lang"));
    if (htmlLang) return htmlLang;
    return getDefaultLanguage(config);
  }

  function getCurrentLanguage(config) {
    const active = normalizeLanguage(document.documentElement.dataset.lang);
    if (active) return active;
    return getPreferredLanguage(config);
  }

  function applyLanguage(lang) {
    const normalized = normalizeLanguage(lang) || "zh";
    document.documentElement.dataset.lang = normalized;
    document.documentElement.lang = normalized === "en" ? "en" : "zh-CN";
    localStorage.setItem(LANG_KEY, normalized);
    return normalized;
  }

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
    const btn = document.getElementById("theme-toggle");
    if (btn) {
      const lang = getCurrentLanguage();
      const text = getUiText(lang);
      btn.setAttribute("aria-label", theme === "dark" ? text.themeAriaToLight : text.themeAriaToDark);
    }
  }

  function initTheme() {
    if (themeInited) return;
    themeInited = true;
    applyTheme(getPreferredTheme());
    document.addEventListener("click", (e) => {
      const target = e.target instanceof Element ? e.target.closest("#theme-toggle") : null;
      if (!target) return;
      const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      applyTheme(next);
    });
  }

  function normalizePathname(pathname) {
    if (!isString(pathname)) return "/";
    const q = pathname.split("?")[0].split("#")[0];
    return q.endsWith("/") ? `${q}index.html` : q;
  }

  function getLocalizedValue(value, lang) {
    if (isObject(value)) {
      if (isString(value[lang])) return value[lang];
      if (isString(value.zh)) return value.zh;
      if (isString(value.en)) return value.en;
      return "";
    }
    return isString(value) ? value : "";
  }

  function getLocalizedList(value, lang) {
    if (Array.isArray(value)) return value;
    if (isObject(value)) {
      if (Array.isArray(value[lang])) return value[lang];
      if (Array.isArray(value.zh)) return value.zh;
      if (Array.isArray(value.en)) return value.en;
    }
    return [];
  }

  function getDocAliases(config) {
    const aliases = config?.i18n?.docPathAliases;
    return isObject(aliases) ? aliases : {};
  }

  function getReverseDocAliases(config) {
    if (reverseAliasesCache) return reverseAliasesCache;
    const reverse = {};
    const aliases = getDocAliases(config);
    Object.entries(aliases).forEach(([from, to]) => {
      if (!isString(from) || !isString(to)) return;
      reverse[to] = from;
    });
    reverseAliasesCache = reverse;
    return reverseAliasesCache;
  }

  function getDefaultDocPath(config, lang) {
    const currentLang = normalizeLanguage(lang) || getCurrentLanguage(config);
    const byLang = config?.site?.defaultDocByLang;
    if (isObject(byLang) && isString(byLang[currentLang])) return byLang[currentLang];
    if (isString(config?.site?.defaultDoc)) return config.site.defaultDoc;
    return "README.md";
  }

  function mapDocPathToLanguage(path, lang, config) {
    const cleanPath = String(path || "").trim();
    const targetLang = normalizeLanguage(lang) || getCurrentLanguage(config);
    if (!cleanPath) return getDefaultDocPath(config, targetLang);

    if (targetLang === "en") {
      const aliases = getDocAliases(config);
      return isString(aliases[cleanPath]) ? aliases[cleanPath] : cleanPath;
    }

    if (targetLang === "zh") {
      const reverse = getReverseDocAliases(config);
      return isString(reverse[cleanPath]) ? reverse[cleanPath] : cleanPath;
    }

    return cleanPath;
  }

  function isDocsPage() {
    return /(^|\/)docs\.html$/i.test(normalizePathname(window.location.pathname));
  }

  function maybeSyncCurrentDocPath(lang, config) {
    if (!isDocsPage()) return false;
    const params = new URLSearchParams(window.location.search);
    const currentPath = params.get("path");
    if (!currentPath) return false;

    const mapped = mapDocPathToLanguage(currentPath, lang, config);
    if (mapped === currentPath) return false;

    params.set("path", mapped);
    const query = params.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash || ""}`;
    window.location.replace(nextUrl);
    return true;
  }

  function rewriteDocLinksForLanguage(lang, config) {
    const links = document.querySelectorAll("a[href]");
    links.forEach((a) => {
      const rawHref = a.getAttribute("href") || "";
      if (!rawHref || rawHref.startsWith("#")) return;
      if (/^(https?:)?\/\//i.test(rawHref) || /^mailto:/i.test(rawHref) || /^tel:/i.test(rawHref)) return;

      let url;
      try {
        url = new URL(rawHref, window.location.href);
      } catch {
        return;
      }

      if (!/(^|\/)docs\.html$/i.test(normalizePathname(url.pathname))) return;

      const params = new URLSearchParams(url.search);
      const currentPath = params.get("path");
      const targetPath = currentPath
        ? mapDocPathToLanguage(currentPath, lang, config)
        : getDefaultDocPath(config, lang);
      params.set("path", targetPath);

      const query = params.toString();
      const rewritten = `docs.html${query ? `?${query}` : ""}${url.hash || ""}`;
      a.setAttribute("href", rewritten);
    });
  }

  function setActiveNav(container) {
    const current = normalizePathname(window.location.pathname);
    const links = container.querySelectorAll("a[data-nav]");
    links.forEach((a) => {
      const href = a.getAttribute("href") || "";
      const normalized = normalizePathname(new URL(href, window.location.href).pathname);
      if (normalized === current) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
  }

  function renderHeader(config, lang) {
    const header = document.getElementById("site-header");
    if (!header) return;

    const navItems = getLocalizedList(config.nav, lang);
    const text = getUiText(lang);
    const siteTitle = getLocalizedValue(config?.site?.title, lang) || "LocoWiki";
    const langShort = lang === "zh" ? "EN" : "中";

    header.className = "topbar";
    header.innerHTML = `
      <div class="topbar-inner">
        <a class="brand" href="index.html" aria-label="${escapeHtml(siteTitle)}">
          <img src="assets/img/icon.svg" alt="" />
          <span>${escapeHtml(siteTitle)}</span>
        </a>
        <div class="spacer"></div>
        <nav class="nav" aria-label="${escapeAttr(text.navAria)}">
          ${navItems
            .map(
              (it) => {
                const title = getLocalizedValue(it?.title, lang);
                const href = getLocalizedValue(it?.href, lang);
                return `<a data-nav href="${escapeAttr(href)}">${escapeHtml(title)}</a>`;
              },
            )
            .join("")}
        </nav>
        <button class="icon-btn" id="lang-toggle" type="button" aria-label="${escapeAttr(text.langAria)}">
          <span class="kdb">${langShort}</span>
          <span>${escapeHtml(text.langBtn)}</span>
        </button>
        <button class="icon-btn" id="theme-toggle" type="button" aria-label="${escapeAttr(text.themeAriaToDark)}">
          <span class="kdb">T</span>
          <span>${escapeHtml(text.themeBtn)}</span>
        </button>
        <a id="github-link" class="icon-btn" href="${escapeAttr(
          config?.links?.repo || "#",
        )}" target="_blank" rel="noopener noreferrer">
          <span class="kdb">GitHub</span>
        </a>
      </div>
    `;

    setActiveNav(header);
  }

  function renderSidebar(config, lang) {
    const sidebar = document.getElementById("site-sidebar");
    if (!sidebar) return;

    const groups = getLocalizedList(config.sidebar, lang);
    sidebar.className = "sidebar";
    sidebar.innerHTML = groups
      .map((g) => {
        const items = getLocalizedList(g?.items, lang);
        return `
          <section>
            <h3>${escapeHtml(getLocalizedValue(g?.title, lang))}</h3>
            ${items
              .map((it) => {
                const rawPath = getLocalizedValue(it?.path, lang);
                const path = rawPath ? mapDocPathToLanguage(rawPath, lang, config) : "";
                const href = `docs.html?path=${encodeURIComponent(path)}`;
                const title = getLocalizedValue(it?.title, lang);
                return `<a data-doc-link href="${href}" data-doc-path="${escapeAttr(path)}">${escapeHtml(title)}</a>`;
              })
              .join("")}
          </section>
        `;
      })
      .join("");
  }

  function renderFooter(config, lang) {
    const footer = document.getElementById("site-footer");
    if (!footer) return;
    footer.className = "footer";

    const year = new Date().getFullYear();
    const siteTitle = getLocalizedValue(config?.site?.title, lang) || "LocoWiki";

    footer.innerHTML = `
      <div class="footer-inner">
        <div>© ${year} ${escapeHtml(siteTitle)} · MIT License</div>
      </div>
    `;
  }

  function updateTocTitle(lang) {
    const tocTitle = document.querySelector(".toc .toc-title");
    if (!tocTitle) return;
    tocTitle.textContent = t("common.tocTitle", {
      lang,
      fallback: getUiText(lang).tocTitle,
    });
  }

  function highlightActiveDocLink(config, lang) {
    const sidebar = document.getElementById("site-sidebar");
    if (!sidebar) return;
    const params = new URLSearchParams(window.location.search);
    const path = mapDocPathToLanguage(params.get("path") || getDefaultDocPath(config, lang), lang, config);
    const links = sidebar.querySelectorAll("a[data-doc-link]");
    links.forEach((a) => {
      const p = a.getAttribute("data-doc-path") || "";
      a.dataset.active = p === path ? "true" : "false";
    });
  }

  function setLanguage(lang, config, options = {}) {
    reverseAliasesCache = null;
    const normalized = applyLanguage(lang);
    if (options.syncDocPath !== false && maybeSyncCurrentDocPath(normalized, config)) {
      return normalized;
    }
    renderHeader(config, normalized);
    renderSidebar(config, normalized);
    renderFooter(config, normalized);
    updateTocTitle(normalized);
    highlightActiveDocLink(config, normalized);
    rewriteDocLinksForLanguage(normalized, config);
    applyI18n(document, normalized);
    applyTheme(getPreferredTheme());
    if (options.emitEvent !== false) {
      window.dispatchEvent(
        new CustomEvent("locowiki:languagechange", {
          detail: { lang: normalized },
        }),
      );
    }
    return normalized;
  }

  function initLanguage(config) {
    if (languageInited) return;
    languageInited = true;
    document.addEventListener("click", (e) => {
      const target = e.target instanceof Element ? e.target.closest("#lang-toggle") : null;
      if (!target) return;
      const current = getCurrentLanguage(config);
      const next = current === "en" ? "zh" : "en";
      setLanguage(next, config);
    });
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function escapeAttr(str) {
    return escapeHtml(str).replaceAll("`", "&#96;");
  }

  async function init() {
    const [config] = await Promise.all([getConfig(), getI18n()]);
    const lang = getPreferredLanguage(config);
    setLanguage(lang, config, { syncDocPath: false });
    initTheme();
    initLanguage(config);
  }

  const siteApi = {
    getConfig,
    getI18n,
    t,
    applyI18n,
    escapeHtml,
    getLanguage: () => getCurrentLanguage(),
    getDefaultDocPath,
    mapDocPathToLanguage,
  };
  window.LocoWikiSite = siteApi;

  window.addEventListener("DOMContentLoaded", () => {
    init().catch((err) => {
      // Keep the site usable even if config load fails.
      console.error(err);
      const lang = applyLanguage(getPreferredLanguage());
      applyI18n(document, lang);
      initTheme();
    });
  });
})();
