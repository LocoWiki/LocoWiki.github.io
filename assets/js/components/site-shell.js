import { getSiteConfig } from "../core/config.js";
import { getDefaultDocPathForShell, getDocPageHref, getDocShellForPath, getDocShellName, mapDocPathToLanguage, resetDocAliasCache } from "../core/docs-routing.js";
import { applyI18n, initI18n, t } from "../core/i18n.js";
import { applyLanguage, applyTheme, cleanupLegacyPreferences, getCurrentLanguage, getCurrentTheme, getPreferredLanguage, getPreferredTheme } from "../core/preferences.js";
import { escapeAttr, escapeHtml, getLocalizedList, getLocalizedValue, normalizePathname } from "../core/utils.js";

let shellReady = false;
let currentConfig = null;
let listenersBound = false;

function isDocsLayout() {
  return document.body?.dataset.layout === "docs";
}

function getCurrentShell() {
  return document.body?.dataset.docShell || getDocShellName() || "quickstart";
}

function getCurrentPath() {
  return normalizePathname(window.location.pathname);
}

function getNavItems(config, lang) {
  return getLocalizedList(config?.nav, lang);
}

function getHeaderNavItems(config, lang) {
  return getNavItems(config, lang).filter((item) => item?.showInHeader !== false);
}

function getSidebarGroups(config, lang) {
  const shell = getCurrentShell();
  return getLocalizedList(config?.sidebar, lang)
    .map((group) => {
      const items = getLocalizedList(group?.items, lang).filter((item) => {
        const path = getLocalizedValue(item?.path, lang);
        return path && getDocShellForPath(path) === shell;
      });
      return { ...group, items };
    })
    .filter((group) => group.items.length > 0);
}

function getSearchIndex(config, lang) {
  const pages = getNavItems(config, lang).map((item) => ({
    title: getLocalizedValue(item?.title, lang),
    meta: getLocalizedValue(config?.site?.title, lang, "LocoWiki"),
    href: getLocalizedValue(item?.href, lang),
    kind: "page"
  }));

  const docs = getLocalizedList(config?.sidebar, lang).flatMap((group) => {
    const groupTitle = getLocalizedValue(group?.title, lang);
    return getLocalizedList(group?.items, lang).map((item) => {
      const path = getLocalizedValue(item?.path, lang);
      return {
        title: getLocalizedValue(item?.title, lang),
        meta: groupTitle,
        href: getDocPageHref(path, config, lang),
        kind: "doc"
      };
    });
  });

  return { pages, docs };
}

function isHrefActive(href) {
  try {
    const url = new URL(href, window.location.href);
    const currentPath = getCurrentPath();
    const candidatePath = normalizePathname(url.pathname);
    if (candidatePath === currentPath) return true;
    if ((currentPath === "/" || currentPath.endsWith("/index.html")) && candidatePath.endsWith("/index.html")) return true;
  } catch {
    return false;
  }
  return false;
}

function getHrefKey(href) {
  try {
    const url = new URL(href, window.location.href);
    const path = normalizePathname(url.pathname);
    if (path === "/" || path.endsWith("/index.html")) return "home";
    if (path.endsWith("/quickstart.html")) return "quickstart";
    if (path.endsWith("/docs.html")) return "docs";
    if (path.endsWith("/downloads.html")) return "downloads";
    if (path.endsWith("/about.html")) return "about";
    if (path.endsWith("/developer-docs.html")) return "developer";
  } catch {
    return "";
  }
  return "";
}

function getIconMarkup(name) {
  const icons = {
    home: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/></svg>`,
    quickstart: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m13 2-9 14h7l-1 6 10-14h-7z"/></svg>`,
    docs: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 17A2.5 2.5 0 0 0 4 19.5V5a2 2 0 0 1 2-2h14v16"/><path d="M8 7h8"/><path d="M8 11h6"/></svg>`,
    downloads: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v11"/><path d="m7.5 11.5 4.5 4.5 4.5-4.5"/><path d="M4 19h16"/></svg>`,
    about: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 10v6"/><path d="M12 7h.01"/></svg>`,
    developer: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h8"/><path d="M8 12h8"/><path d="M8 18h5"/><path d="M5 3h14a2 2 0 0 1 2 2v14l-4-2-4 2-4-2-4 2V5a2 2 0 0 1 2-2Z"/></svg>`,
    repo: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2h6.5A2.5 2.5 0 0 1 21 9.5v9A2.5 2.5 0 0 1 18.5 21h-13A2.5 2.5 0 0 1 3 18.5z"/><path d="M8 12h8"/><path d="M8 16h5"/></svg>`,
    language: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h8"/><path d="M8 3v4"/><path d="M5 9c1.2 3 3.4 5.8 6 8"/><path d="M8 9c1 2 2.6 4 5 6"/><path d="M14 5h6"/><path d="M17 5v14"/><path d="m14 14 3-6 3 6"/><path d="M15 12h4"/></svg>`,
    sun: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2.5"/><path d="M12 19.5V22"/><path d="m4.93 4.93 1.77 1.77"/><path d="m17.3 17.3 1.77 1.77"/><path d="M2 12h2.5"/><path d="M19.5 12H22"/><path d="m4.93 19.07 1.77-1.77"/><path d="m17.3 6.7 1.77-1.77"/></svg>`,
    moon: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4 6.8 6.8 0 0 0 20 14.5Z"/></svg>`
  };
  return icons[name] || "";
}

function ensureBackToTopButton() {
  let button = document.getElementById("back-to-top");
  if (button) return button;
  button = document.createElement("button");
  button.id = "back-to-top";
  button.className = "back-to-top";
  button.type = "button";
  button.setAttribute("aria-label", "Back to top");
  button.innerHTML = `<span class="back-to-top-icon" aria-hidden="true">↑</span>`;
  document.body.appendChild(button);
  return button;
}

function syncBackToTopVisibility() {
  const button = ensureBackToTopButton();
  button.dataset.visible = window.scrollY > 420 ? "true" : "false";
}

function renderNavLinks(navItems, lang, options = {}) {
  const className = options.className || "";
  const activeAttr = options.activeAttr || "aria-current";
  const dataAttr = options.dataAttr || "data-nav";
  return navItems
    .map((item) => {
      const href = getLocalizedValue(item?.href, lang);
      const title = getLocalizedValue(item?.title, lang);
      const active = isHrefActive(href);
      const activeMarkup = activeAttr === "aria-current" ? (active ? ` aria-current="page"` : "") : ` ${activeAttr}="${active ? "true" : "false"}"`;
      const iconName = getHrefKey(href);
      const iconMarkup = options.withIcons && iconName ? `<span class="${escapeAttr(options.iconClass || "nav-link-icon")}">${getIconMarkup(iconName)}</span>` : "";
      return `<a ${dataAttr} class="${className}" href="${escapeAttr(href)}"${activeMarkup}>${iconMarkup}<span>${escapeHtml(title)}</span></a>`;
    })
    .join("");
}

function renderHeader(config, lang) {
  const header = document.getElementById("site-header");
  if (!header) return;

  const navItems = getHeaderNavItems(config, lang);
  const siteTitle = getLocalizedValue(config?.site?.title, lang, "LocoWiki");
  const navLabel = t("header.navAria", { lang, fallback: "Primary Navigation" });
  const searchLabel = t("header.searchOpen", { lang, fallback: "Search" });
  const theme = getCurrentTheme();
  const currentLang = getCurrentLanguage();
  const nextLang = currentLang === "zh" ? "en" : "zh";
  const languageLabel = currentLang === "zh" ? "Switch to English" : "Switch to Chinese";
  const nextTheme = theme === "dark" ? "light" : "dark";
  const themeLabel =
    nextTheme === "dark"
      ? t("header.themeDark", { lang, fallback: "Dark" })
      : t("header.themeLight", { lang, fallback: "Light" });

  header.className = "topbar";
  header.innerHTML = `
    <div class="topbar-inner">
      <div class="topbar-start">
        <a class="brand" href="index.html" aria-label="${escapeAttr(siteTitle)}">
          <img src="assets/img/icon.svg" alt="" />
          <span>${escapeHtml(siteTitle)}</span>
        </a>
      </div>
      <div class="topbar-center">
        <nav class="nav" aria-label="${escapeAttr(navLabel)}">
          ${renderNavLinks(navItems, lang, { withIcons: true, iconClass: "nav-link-icon" })}
        </nav>
      </div>
      <div class="topbar-actions">
        <a class="icon-btn icon-only" id="github-link" href="${escapeAttr(config?.links?.repo || "#")}" target="_blank" rel="noopener noreferrer" aria-label="GitHub" title="GitHub">${getIconMarkup("repo")}</a>
        <button class="icon-btn search-trigger" id="search-toggle" type="button" aria-label="${escapeAttr(searchLabel)}" title="${escapeAttr(searchLabel)}">
          <span class="search-trigger-copy"><span class="search-trigger-text">${escapeHtml(searchLabel)}</span></span>
          <span class="search-shortcut"><kbd>Ctrl</kbd><kbd>K</kbd></span>
        </button>
        <button class="icon-btn icon-only language-toggle" id="language-toggle" type="button" data-next-language="${escapeAttr(nextLang)}" aria-label="${escapeAttr(languageLabel)}" title="${escapeAttr(languageLabel)}">${getIconMarkup("language")}</button>
        <button class="icon-btn icon-only theme-toggle" id="theme-toggle" type="button" data-next-theme="${escapeAttr(nextTheme)}" data-theme="${escapeAttr(theme)}" aria-label="${escapeAttr(themeLabel)}" title="${escapeAttr(themeLabel)}">
          <span class="theme-icon" aria-hidden="true">
            <span class="theme-icon-sun">${getIconMarkup("sun")}</span>
            <span class="theme-icon-moon">${getIconMarkup("moon")}</span>
          </span>
        </button>
      </div>
    </div>
    ${renderSearchDialog(lang)}
  `;
}

function renderSearchDialog(lang) {
  return `
    <div id="search-modal" class="search-modal" hidden>
      <div class="search-backdrop" data-search-close></div>
      <div class="search-dialog">
        <div class="search-head">
          <div class="search-title">${escapeHtml(t("header.searchDialog", { lang, fallback: "Search" }))}</div>
          <label class="search-input-wrap">
            <input id="search-input" type="search" placeholder="${escapeAttr(
              t("header.searchPlaceholder", { lang, fallback: "Search pages and docs" })
            )}" />
          </label>
        </div>
        <div id="search-results" class="search-body"></div>
        <div class="search-foot">${escapeHtml(t("header.searchHint", { lang, fallback: "Press Esc to close" }))}</div>
      </div>
    </div>
  `;
}

function renderSidebar(config, lang) {
  const sidebar = document.getElementById("site-sidebar");
  if (!sidebar) return;

  const navItems = getNavItems(config, lang);
  const groups = isDocsLayout() ? getSidebarGroups(config, lang) : [];
  const siteTitle = lang === "en" ? "Site" : "站点";

  sidebar.className = "sidebar";
  sidebar.innerHTML = `
    <section class="sidebar-group sidebar-group-primary">
      <h3 class="sidebar-group-title">${escapeHtml(siteTitle)}</h3>
      <div class="sidebar-home">
        ${renderNavLinks(navItems, lang, { className: "sidebar-home-link", activeAttr: "data-active", dataAttr: "data-global-nav", withIcons: true, iconClass: "sidebar-link-icon" })}
      </div>
    </section>
    ${groups
      .map((group) => {
        const title = getLocalizedValue(group?.title, lang);
        const items = getLocalizedList(group?.items, lang)
          .filter((item) => {
            const path = getLocalizedValue(item?.path, lang);
            return path && getDocShellForPath(path) === getCurrentShell();
          })
          .map((item) => {
            const path = getLocalizedValue(item?.path, lang);
            const titleText = getLocalizedValue(item?.title, lang);
            return `
              <div class="sidebar-doc-item" data-doc-item data-doc-path="${escapeAttr(path)}" data-expanded="false">
                <a data-doc-link href="${escapeAttr(getDocPageHref(path, config, lang))}" data-doc-path="${escapeAttr(path)}" data-doc-title="${escapeAttr(titleText)}">
                  <span>${escapeHtml(titleText)}</span>
                </a>
                <div class="sidebar-subtree" data-sidebar-subtree hidden></div>
              </div>
            `;
          })
          .join("");

        return `
          <section class="sidebar-group">
            <h3 class="sidebar-group-title">${escapeHtml(title)}</h3>
            ${items}
          </section>
        `;
      })
      .join("")}
  `;
}

function renderFooter(config, lang) {
  const footer = document.getElementById("site-footer");
  if (!footer) return;

  const title = getLocalizedValue(config?.site?.title, lang, "LocoWiki");
  footer.className = "footer";
  footer.innerHTML = `
    <div class="footer-inner">
      <div class="footer-meta">
        <span>© ${new Date().getFullYear()} ${escapeHtml(title)}</span>
        <a href="${escapeAttr(config?.links?.repo || "#")}" target="_blank" rel="noopener noreferrer">GitHub</a>
      </div>
    </div>
  `;
}

function highlightActiveDocLink(config, lang) {
  const params = new URLSearchParams(window.location.search);
  const requested = params.get("path") || getDefaultDocPathForShell(config, lang, getCurrentShell());
  const currentPath = mapDocPathToLanguage(requested, lang, config);
  document.querySelectorAll("[data-doc-link]").forEach((link) => {
    const path = link.getAttribute("data-doc-path") || "";
    link.dataset.active = path === currentPath ? "true" : "false";
  });
}

function renderSearchResults(config) {
  const root = document.getElementById("search-results");
  const input = document.getElementById("search-input");
  if (!root || !input) return;

  const lang = getCurrentLanguage();
  const query = input.value.trim().toLowerCase();
  const index = getSearchIndex(config, lang);
  const filter = (items) =>
    items.filter((item) => {
      if (!query) return true;
      return `${item.title} ${item.meta}`.toLowerCase().includes(query);
    });

  const renderGroup = (title, items) => {
    if (!items.length) return "";
    return `
      <section class="search-group">
        <h3 class="search-group-title">${escapeHtml(title)}</h3>
        ${items
          .map(
            (item) => `
              <a class="search-result" href="${escapeAttr(item.href)}">
                <span class="search-result-copy">
                  <span class="search-result-title">${escapeHtml(item.title)}</span>
                  <span class="search-result-meta">${escapeHtml(item.meta)}</span>
                </span>
              </a>
            `
          )
          .join("")}
      </section>
    `;
  };

  const pageResults = filter(index.pages);
  const docResults = filter(index.docs);
  if (!pageResults.length && !docResults.length) {
    root.innerHTML = `<div class="search-empty">${escapeHtml(t("header.searchEmpty", { lang, fallback: "No matches found" }))}</div>`;
    return;
  }

  root.innerHTML = [
    renderGroup(t("header.searchPages", { lang, fallback: "Pages" }), pageResults),
    renderGroup(t("header.searchDocs", { lang, fallback: "Docs" }), docResults)
  ].join("");
}

function closeSearchDialog() {
  const modal = document.getElementById("search-modal");
  if (modal) modal.hidden = true;
}

function toggleSearchDialog(config, forceOpen) {
  const modal = document.getElementById("search-modal");
  const input = document.getElementById("search-input");
  if (!modal || !input) return;

  const open = typeof forceOpen === "boolean" ? forceOpen : modal.hidden;
  modal.hidden = !open;
  if (!open) return;
  input.value = "";
  renderSearchResults(config);
  window.setTimeout(() => input.focus(), 0);
}

function rerenderShell() {
  if (!currentConfig) return;
  const lang = getCurrentLanguage();
  renderHeader(currentConfig, lang);
  renderSidebar(currentConfig, lang);
  renderFooter(currentConfig, lang);
  ensureBackToTopButton();
  applyI18n(document, lang);
  highlightActiveDocLink(currentConfig, lang);
  syncBackToTopVisibility();
}

function bindShellEvents() {
  if (listenersBound) return;
  listenersBound = true;

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    if (target.closest("#search-toggle")) {
      toggleSearchDialog(currentConfig);
      return;
    }

    if (target.closest("[data-search-close]")) {
      closeSearchDialog();
      return;
    }

    const languageButton = target.closest("[data-set-language]");
    if (languageButton || target.closest("#language-toggle")) {
      const button = languageButton || target.closest("#language-toggle");
      const value = button?.getAttribute("data-next-language");
      if (value && value !== getCurrentLanguage()) {
        resetDocAliasCache();
        applyLanguage(value);
      }
      return;
    }

    const themeButton = target.closest("[data-set-theme]") || target.closest("#theme-toggle");
    if (themeButton) {
      const value = themeButton.getAttribute("data-next-theme") || themeButton.getAttribute("data-set-theme");
      if (value && value !== getCurrentTheme()) {
        applyTheme(value);
        rerenderShell();
      }
      return;
    }

    if (target.closest("#back-to-top")) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (target.closest(".search-result")) {
      closeSearchDialog();
    }
  });

  document.addEventListener("input", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.id === "search-input") {
      renderSearchResults(currentConfig);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeSearchDialog();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      toggleSearchDialog(currentConfig, true);
    }
  });

  window.addEventListener("scroll", () => {
    syncBackToTopVisibility();
  });

  window.addEventListener("locowiki:languagechange", () => {
    rerenderShell();
  });
}

export async function initSiteShell() {
  currentConfig = await getSiteConfig();
  await initI18n();
  cleanupLegacyPreferences();

  applyTheme(getPreferredTheme());

  if (!shellReady) {
    applyLanguage(getPreferredLanguage(currentConfig));
    shellReady = true;
  } else {
    document.documentElement.dataset.lang = getCurrentLanguage();
  }

  rerenderShell();
  bindShellEvents();
  return currentConfig;
}

export function getShellConfig() {
  return currentConfig;
}
