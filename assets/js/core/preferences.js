import { normalizeLanguage, normalizeTheme } from "./utils.js";

const THEME_KEY = "locowiki_theme";
const LANG_KEY = "locowiki_lang";
const LEGACY_KEYS = ["locowiki_page_width", "locowiki_doc_nav"];

function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

export function cleanupLegacyPreferences() {
  LEGACY_KEYS.forEach((key) => localStorage.removeItem(key));
  document.documentElement.removeAttribute("data-page-width");
  if (document.body) {
    document.body.removeAttribute("data-doc-nav");
    document.body.removeAttribute("data-doc-sidebar-open");
  }
}

export function getPreferredTheme() {
  return normalizeTheme(getQueryParam("theme")) || normalizeTheme(localStorage.getItem(THEME_KEY)) || "light";
}

export function getCurrentTheme() {
  return normalizeTheme(document.documentElement.dataset.theme) || getPreferredTheme();
}

export function applyTheme(theme) {
  const normalized = normalizeTheme(theme) || "light";
  document.documentElement.dataset.theme = normalized;
  localStorage.setItem(THEME_KEY, normalized);
  return normalized;
}

export function getPreferredLanguage(config) {
  const saved = normalizeLanguage(localStorage.getItem(LANG_KEY));
  if (saved) return saved;
  const browser =
    normalizeLanguage(navigator.language) ||
    normalizeLanguage(Array.isArray(navigator.languages) ? navigator.languages[0] : "");
  if (browser) return browser;
  return normalizeLanguage(config?.i18n?.defaultLanguage) || "zh";
}

export function getCurrentLanguage() {
  return normalizeLanguage(document.documentElement.dataset.lang) || normalizeLanguage(localStorage.getItem(LANG_KEY)) || "zh";
}

export function applyLanguage(language) {
  const normalized = normalizeLanguage(language) || "zh";
  document.documentElement.lang = normalized === "en" ? "en" : "zh-CN";
  document.documentElement.dataset.lang = normalized;
  localStorage.setItem(LANG_KEY, normalized);
  window.dispatchEvent(
    new CustomEvent("locowiki:languagechange", {
      detail: { lang: normalized }
    })
  );
  return normalized;
}
