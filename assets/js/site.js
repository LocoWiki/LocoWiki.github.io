(function () {
  const CONFIG_URL = "assets/site-config.json";
  const I18N_URL = "assets/i18n.json";
  const THEME_KEY = "locowiki_theme";
  const LANG_KEY = "locowiki_lang";
  const PAGE_WIDTH_KEY = "locowiki_page_width";
  const FONT_SIZE_KEY = "locowiki_font_size";
  const DOC_NAV_KEY = "locowiki_doc_nav";

  const UI_TEXT = {
    zh: {
      navAria: "主导航",
      tocTitle: "本页目录",
      settingsBtn: "页面设置",
      settingsAria: "打开页面设置",
      settingsPanelTitle: "页面设置",
      sectionWidth: "页面宽度",
      widthStandard: "标准",
      widthFull: "无限宽",
      sectionFontSize: "字体大小",
      fontSmall: "小",
      fontMedium: "中",
      fontLarge: "大",
      sectionLanguage: "语言",
      languageZh: "中文",
      languageEn: "English",
      sectionTheme: "亮暗模式",
      themeLight: "浅色",
      themeDark: "深色",
      sectionDocNav: "文档导航",
      docNavShow: "展开导航",
      docNavHide: "收起导航",
    },
    en: {
      navAria: "Primary Navigation",
      tocTitle: "On This Page",
      settingsBtn: "Page Settings",
      settingsAria: "Open page settings",
      settingsPanelTitle: "Page Settings",
      sectionWidth: "Page Width",
      widthStandard: "Standard",
      widthFull: "Full Width",
      sectionFontSize: "Font Size",
      fontSmall: "Small",
      fontMedium: "Medium",
      fontLarge: "Large",
      sectionLanguage: "Language",
      languageZh: "中文",
      languageEn: "English",
      sectionTheme: "Theme",
      themeLight: "Light",
      themeDark: "Dark",
      sectionDocNav: "Doc Navigation",
      docNavShow: "Show Navigation",
      docNavHide: "Hide Navigation",
    },
  };

  const ICONS = {
    settings: `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="12" cy="12" r="3"></circle>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33 1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82 1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
      </svg>
    `,
    slider: `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <line x1="5" y1="6.5" x2="19" y2="6.5"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
        <line x1="5" y1="17.5" x2="19" y2="17.5"></line>
        <circle cx="9" cy="6.5" r="1.8"></circle>
        <circle cx="15" cy="12" r="1.8"></circle>
        <circle cx="11" cy="17.5" r="1.8"></circle>
      </svg>
    `,
    sectionWidth: `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <rect x="4" y="6" width="16" height="12" rx="2"></rect>
        <path d="M9 6v12"></path>
      </svg>
    `,
    sectionFont: `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M6 18L10.5 6h3L18 18"></path>
        <path d="M8 14h8"></path>
      </svg>
    `,
    sectionLang: `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="12" cy="12" r="8.5"></circle>
        <path d="M3.5 12h17"></path>
        <path d="M12 3.5a14 14 0 0 1 0 17"></path>
        <path d="M12 3.5a14 14 0 0 0 0 17"></path>
      </svg>
    `,
    sectionTheme: `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 3v18"></path>
        <path d="M12 21a9 9 0 1 0 0-18"></path>
      </svg>
    `,
    sectionDocNav: `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <rect x="3" y="4" width="18" height="16" rx="2"></rect>
        <path d="M9 4v16"></path>
      </svg>
    `,
    widthStandard: `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <rect x="6" y="7" width="12" height="10" rx="1.8"></rect>
      </svg>
    `,
    widthFull: `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M4 9V4h5"></path>
        <path d="M20 9V4h-5"></path>
        <path d="M4 15v5h5"></path>
        <path d="M20 15v5h-5"></path>
      </svg>
    `,
    fontSmall: `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M9 16l2.5-8h1L15 16"></path>
        <path d="M10 13h4"></path>
      </svg>
    `,
    fontMedium: `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M7.5 17l3-10h1L14.5 17"></path>
        <path d="M8.8 13.5h4.8"></path>
      </svg>
    `,
    fontLarge: `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M6 18l3.5-12h1L15 18"></path>
        <path d="M7.7 14h5.6"></path>
      </svg>
    `,
    langGlobe: `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="12" cy="12" r="8"></circle>
        <path d="M4 12h16"></path>
      </svg>
    `,
    sun: `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="12" cy="12" r="3.5"></circle>
        <path d="M12 2.8v2.2"></path>
        <path d="M12 19v2.2"></path>
        <path d="M2.8 12h2.2"></path>
        <path d="M19 12h2.2"></path>
        <path d="M5.8 5.8l1.6 1.6"></path>
        <path d="M16.6 16.6l1.6 1.6"></path>
        <path d="M18.2 5.8l-1.6 1.6"></path>
        <path d="M7.4 16.6l-1.6 1.6"></path>
      </svg>
    `,
    moon: `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M19 14.8A7.4 7.4 0 1 1 9.2 5a6 6 0 1 0 9.8 9.8z"></path>
      </svg>
    `,
    docNavOpen: `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <rect x="3" y="4" width="18" height="16" rx="2"></rect>
        <path d="M9 4v16"></path>
        <path d="M5.6 8h1"></path>
        <path d="M5.6 12h1"></path>
      </svg>
    `,
    docNavCollapsed: `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <rect x="3" y="4" width="18" height="16" rx="2"></rect>
        <path d="M5.6 8h1"></path>
        <path d="M5.6 12h1"></path>
        <path d="M5.6 16h1"></path>
      </svg>
    `,
    github: `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 .5a12 12 0 0 0-3.8 23.4c.6.1.8-.2.8-.6v-2.1c-3.3.7-4-1.5-4-1.5a3.2 3.2 0 0 0-1.3-1.8c-1.1-.8.1-.8.1-.8a2.5 2.5 0 0 1 1.8 1.2 2.6 2.6 0 0 0 3.6 1 2.6 2.6 0 0 1 .8-1.6c-2.7-.3-5.5-1.3-5.5-6a4.8 4.8 0 0 1 1.2-3.2 4.5 4.5 0 0 1 .1-3.1s1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.2-1.5 3.2-1.2 3.2-1.2a4.5 4.5 0 0 1 .1 3.1 4.8 4.8 0 0 1 1.3 3.2c0 4.7-2.8 5.7-5.5 6 .5.4.9 1.2.9 2.4v3.5c0 .4.2.7.8.6A12 12 0 0 0 12 .5z"></path>
      </svg>
    `,
  };

  let configPromise;
  let i18nPromise;
  let i18nCache;
  let reverseAliasesCache;
  let settingsInited = false;

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

  function normalizeTheme(value) {
    const s = String(value || "")
      .trim()
      .toLowerCase();
    if (s === "dark" || s === "light") return s;
    return "";
  }

  function normalizePageWidth(value) {
    const s = String(value || "")
      .trim()
      .toLowerCase();
    if (s === "standard" || s === "full") return s;
    return "";
  }

  function normalizeFontSize(value) {
    const s = String(value || "")
      .trim()
      .toLowerCase();
    if (s === "sm" || s === "md" || s === "lg") return s;
    return "";
  }

  function normalizeDocNav(value) {
    const s = String(value || "")
      .trim()
      .toLowerCase();
    if (s === "open" || s === "collapsed") return s;
    return "";
  }

  function getUiText(lang) {
    const fallback = UI_TEXT[lang === "en" ? "en" : "zh"];
    return {
      navAria: t("header.navAria", { lang, fallback: fallback.navAria }),
      tocTitle: t("common.tocTitle", { lang, fallback: fallback.tocTitle }),
      settingsBtn: t("header.settingsBtn", { lang, fallback: fallback.settingsBtn }),
      settingsAria: t("header.settingsAria", { lang, fallback: fallback.settingsAria }),
      settingsPanelTitle: t("header.settingsPanelTitle", {
        lang,
        fallback: fallback.settingsPanelTitle,
      }),
      sectionWidth: t("header.sectionWidth", { lang, fallback: fallback.sectionWidth }),
      widthStandard: t("header.widthStandard", { lang, fallback: fallback.widthStandard }),
      widthFull: t("header.widthFull", { lang, fallback: fallback.widthFull }),
      sectionFontSize: t("header.sectionFontSize", { lang, fallback: fallback.sectionFontSize }),
      fontSmall: t("header.fontSmall", { lang, fallback: fallback.fontSmall }),
      fontMedium: t("header.fontMedium", { lang, fallback: fallback.fontMedium }),
      fontLarge: t("header.fontLarge", { lang, fallback: fallback.fontLarge }),
      sectionLanguage: t("header.sectionLanguage", { lang, fallback: fallback.sectionLanguage }),
      languageZh: t("header.languageZh", { lang, fallback: fallback.languageZh }),
      languageEn: t("header.languageEn", { lang, fallback: fallback.languageEn }),
      sectionTheme: t("header.sectionTheme", { lang, fallback: fallback.sectionTheme }),
      themeLight: t("header.themeLight", { lang, fallback: fallback.themeLight }),
      themeDark: t("header.themeDark", { lang, fallback: fallback.themeDark }),
      sectionDocNav: t("header.sectionDocNav", { lang, fallback: fallback.sectionDocNav }),
      docNavShow: t("header.docNavShow", { lang, fallback: fallback.docNavShow }),
      docNavHide: t("header.docNavHide", { lang, fallback: fallback.docNavHide }),
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
    const saved = normalizeTheme(localStorage.getItem(THEME_KEY));
    if (saved) return saved;
    return "light";
  }

  function getCurrentTheme() {
    const active = normalizeTheme(document.documentElement.dataset.theme);
    if (active) return active;
    return getPreferredTheme();
  }

  function getPreferredPageWidth() {
    const saved = normalizePageWidth(localStorage.getItem(PAGE_WIDTH_KEY));
    if (saved) return saved;
    return "standard";
  }

  function getCurrentPageWidth() {
    const active = normalizePageWidth(document.documentElement.dataset.pageWidth);
    if (active) return active;
    return getPreferredPageWidth();
  }

  function getPreferredFontSize() {
    const saved = normalizeFontSize(localStorage.getItem(FONT_SIZE_KEY));
    if (saved) return saved;
    return "md";
  }

  function getCurrentFontSize() {
    const active = normalizeFontSize(document.documentElement.dataset.fontSize);
    if (active) return active;
    return getPreferredFontSize();
  }

  function getPreferredDocNav() {
    const saved = normalizeDocNav(localStorage.getItem(DOC_NAV_KEY));
    if (saved) return saved;
    return "collapsed";
  }

  function getCurrentDocNav() {
    const active = normalizeDocNav(document.body?.dataset.docNav);
    if (active) return active;
    return getPreferredDocNav();
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
    const normalized = normalizeTheme(theme) || getPreferredTheme();
    document.documentElement.dataset.theme = normalized;
    localStorage.setItem(THEME_KEY, normalized);
    syncSettingsControls();
    return normalized;
  }

  function applyPageWidth(width) {
    const normalized = normalizePageWidth(width) || getPreferredPageWidth();
    document.documentElement.dataset.pageWidth = normalized;
    localStorage.setItem(PAGE_WIDTH_KEY, normalized);
    syncSettingsControls();
    return normalized;
  }

  function applyFontSize(size) {
    const normalized = normalizeFontSize(size) || getPreferredFontSize();
    document.documentElement.dataset.fontSize = normalized;
    localStorage.setItem(FONT_SIZE_KEY, normalized);
    syncSettingsControls();
    return normalized;
  }

  function applyDocNav(state) {
    if (document.body?.dataset.layout !== "docs") {
      document.body?.removeAttribute("data-doc-nav");
      return "open";
    }
    const normalized = normalizeDocNav(state) || getPreferredDocNav();
    document.body.dataset.docNav = normalized;
    localStorage.setItem(DOC_NAV_KEY, normalized);
    syncSettingsControls();
    return normalized;
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

  function renderSettingChipIcon(item) {
    if (isString(item?.icon) && item.icon) {
      return `<span class="setting-chip-icon" aria-hidden="true">${item.icon}</span>`;
    }
    if (isString(item?.mark) && item.mark) {
      return `<span class="setting-chip-icon setting-chip-mark" aria-hidden="true">${escapeHtml(item.mark)}</span>`;
    }
    return "";
  }

  function renderSettingGroup(setting, label, sectionIcon, options) {
    return `
      <section class="page-setting-group">
        <div class="page-setting-head">
          <span class="page-setting-icon" aria-hidden="true">${sectionIcon || ""}</span>
          <span class="page-setting-label">${escapeHtml(label)}</span>
        </div>
        <div class="page-setting-options" role="group" aria-label="${escapeAttr(label)}">
          ${options
            .map(
              (item) => `
                <button
                  class="setting-chip"
                  type="button"
                  data-setting="${escapeAttr(setting)}"
                  data-value="${escapeAttr(item.value)}"
                  aria-pressed="false"
                >
                  ${renderSettingChipIcon(item)}
                  <span class="setting-chip-text">${escapeHtml(item.label)}</span>
                </button>
              `,
            )
            .join("")}
        </div>
      </section>
    `;
  }

  function renderSettingsPanel(lang, options = {}) {
    const opts = isObject(options) ? options : {};
    const text = getUiText(lang);
    const withTitle = opts.withTitle !== false;
    const withDocNav = opts.withDocNav === true;

    const groups = [
      renderSettingGroup("page-width", text.sectionWidth, ICONS.sectionWidth, [
        { value: "standard", label: text.widthStandard, icon: ICONS.widthStandard },
        { value: "full", label: text.widthFull, icon: ICONS.widthFull },
      ]),
      renderSettingGroup("font-size", text.sectionFontSize, ICONS.sectionFont, [
        { value: "sm", label: text.fontSmall, icon: ICONS.fontSmall },
        { value: "md", label: text.fontMedium, icon: ICONS.fontMedium },
        { value: "lg", label: text.fontLarge, icon: ICONS.fontLarge },
      ]),
      renderSettingGroup("lang", text.sectionLanguage, ICONS.sectionLang, [
        { value: "zh", label: text.languageZh, mark: "中" },
        { value: "en", label: text.languageEn, mark: "EN" },
      ]),
      renderSettingGroup("theme", text.sectionTheme, ICONS.sectionTheme, [
        { value: "light", label: text.themeLight, icon: ICONS.sun },
        { value: "dark", label: text.themeDark, icon: ICONS.moon },
      ]),
    ];

    if (withDocNav) {
      groups.push(
        renderSettingGroup("doc-nav", text.sectionDocNav, ICONS.sectionDocNav, [
          { value: "open", label: text.docNavShow, icon: ICONS.docNavOpen },
          { value: "collapsed", label: text.docNavHide, icon: ICONS.docNavCollapsed },
        ]),
      );
    }

    return `
      <div class="page-settings apple-settings" data-page-settings>
        ${
          withTitle
            ? `
          <div class="page-settings-title">
            <span class="page-settings-title-icon" aria-hidden="true">${ICONS.slider}</span>
            <span>${escapeHtml(text.settingsPanelTitle)}</span>
          </div>
        `
            : ""
        }
        ${groups.join("")}
      </div>
    `;
  }

  function closeSettingsPopover() {
    const panel = document.getElementById("settings-popover");
    const btn = document.getElementById("settings-toggle");
    if (!panel || !btn) return;
    panel.hidden = true;
    btn.setAttribute("aria-expanded", "false");
  }

  function toggleSettingsPopover(forceOpen) {
    const panel = document.getElementById("settings-popover");
    const btn = document.getElementById("settings-toggle");
    if (!panel || !btn) return;
    const open = typeof forceOpen === "boolean" ? forceOpen : panel.hidden;
    panel.hidden = !open;
    btn.setAttribute("aria-expanded", open ? "true" : "false");
  }

  function renderHeader(config, lang) {
    const header = document.getElementById("site-header");
    if (!header) return;

    const navItems = getLocalizedList(config.nav, lang);
    const text = getUiText(lang);
    const siteTitle = getLocalizedValue(config?.site?.title, lang) || "LocoWiki";
    const isDocsLayout = document.body?.dataset.layout === "docs";
    header.className = "topbar";
    header.innerHTML = `
      <div class="topbar-inner">
        <a class="brand" href="index.html" aria-label="${escapeHtml(siteTitle)}">
          <img src="assets/img/icon.svg" alt="" />
          <span>${escapeHtml(siteTitle)}</span>
        </a>
        <nav class="nav" aria-label="${escapeAttr(text.navAria)}">
          ${navItems
            .map((it) => {
              const title = getLocalizedValue(it?.title, lang);
              const href = getLocalizedValue(it?.href, lang);
              return `<a data-nav href="${escapeAttr(href)}">${escapeHtml(title)}</a>`;
            })
            .join("")}
        </nav>
        <div class="topbar-actions">
          <div class="settings-menu">
            <button
              class="icon-btn icon-only"
              id="settings-toggle"
              type="button"
              aria-label="${escapeAttr(text.settingsAria)}"
              title="${escapeAttr(text.settingsBtn)}"
              aria-expanded="false"
              aria-controls="settings-popover"
            >
              ${ICONS.settings}
            </button>
            <div id="settings-popover" class="settings-popover" hidden>
              ${renderSettingsPanel(lang, { withDocNav: isDocsLayout })}
            </div>
          </div>
          <a
            id="github-link"
            class="icon-btn icon-only"
            href="${escapeAttr(config?.links?.repo || "#")}"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
            title="GitHub"
          >
            ${ICONS.github}
          </a>
        </div>
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
    const titles = document.querySelectorAll(".toc .toc-title");
    titles.forEach((tocTitle) => {
      tocTitle.textContent = t("common.tocTitle", {
        lang,
        fallback: getUiText(lang).tocTitle,
      });
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

  function syncSettingsControls() {
    const current = {
      "page-width": getCurrentPageWidth(),
      "font-size": getCurrentFontSize(),
      lang: getCurrentLanguage(),
      theme: getCurrentTheme(),
      "doc-nav": getCurrentDocNav(),
    };

    const chips = document.querySelectorAll(".setting-chip[data-setting][data-value]");
    chips.forEach((chip) => {
      const setting = chip.getAttribute("data-setting") || "";
      const value = chip.getAttribute("data-value") || "";
      const active = current[setting] === value;
      chip.dataset.active = active ? "true" : "false";
      chip.setAttribute("aria-pressed", active ? "true" : "false");
    });

    const text = getUiText(getCurrentLanguage());
    const toggle = document.getElementById("settings-toggle");
    if (toggle) {
      toggle.setAttribute("title", text.settingsBtn);
      toggle.setAttribute("aria-label", text.settingsAria);
    }
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
    syncSettingsControls();
    if (options.emitEvent !== false) {
      window.dispatchEvent(
        new CustomEvent("locowiki:languagechange", {
          detail: { lang: normalized },
        }),
      );
    }
    return normalized;
  }

  function isEditableElement(el) {
    if (!(el instanceof Element)) return false;
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
      return true;
    }
    return el.isContentEditable;
  }

  function initSettings(config) {
    if (settingsInited) return;
    settingsInited = true;

    document.addEventListener("click", (e) => {
      const target = e.target instanceof Element ? e.target : null;
      if (!target) return;

      const settingsToggle = target.closest("#settings-toggle");
      if (settingsToggle) {
        toggleSettingsPopover();
        return;
      }

      const option = target.closest(".setting-chip[data-setting][data-value]");
      if (option) {
        const setting = option.getAttribute("data-setting") || "";
        const value = option.getAttribute("data-value") || "";

        if (setting === "theme") {
          applyTheme(value);
        } else if (setting === "lang") {
          setLanguage(value, config);
          return;
        } else if (setting === "page-width") {
          applyPageWidth(value);
        } else if (setting === "font-size") {
          applyFontSize(value);
        } else if (setting === "doc-nav") {
          applyDocNav(value);
        }

        syncSettingsControls();
        return;
      }

      if (!target.closest(".settings-menu")) {
        closeSettingsPopover();
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeSettingsPopover();
      if (document.body?.dataset.layout !== "docs") return;
      if (isEditableElement(e.target)) return;
      if (e.key !== "h" && e.key !== "H") return;
      e.preventDefault();
      const next = getCurrentDocNav() === "collapsed" ? "open" : "collapsed";
      applyDocNav(next);
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
    applyTheme(getPreferredTheme());
    applyPageWidth(getPreferredPageWidth());
    applyFontSize(getPreferredFontSize());
    applyDocNav(getPreferredDocNav());
    const lang = getPreferredLanguage(config);
    setLanguage(lang, config, { syncDocPath: false });
    initSettings(config);
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
      applyTheme(getPreferredTheme());
      applyPageWidth(getPreferredPageWidth());
      applyFontSize(getPreferredFontSize());
      applyDocNav(getPreferredDocNav());
      const lang = applyLanguage(getPreferredLanguage());
      applyI18n(document, lang);
      syncSettingsControls();
      initSettings({});
    });
  });
})();
