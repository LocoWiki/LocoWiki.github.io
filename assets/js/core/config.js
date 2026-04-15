const CONFIG_URL = "assets/site-config.json";
const UI_TEXT_URL = "assets/content/ui-text.json";
const PAGE_DATA_URL = "assets/content/pages.json";

let configPromise;
let uiTextPromise;
let pageDataPromise;
let uiTextCache = {};
let pageDataCache = {};

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load ${url}: HTTP ${response.status}`);
  }
  return response.json();
}

export function getSiteConfig() {
  if (!configPromise) {
    configPromise = fetchJson(CONFIG_URL);
  }
  return configPromise;
}

export function getUiTextData() {
  if (!uiTextPromise) {
    uiTextPromise = fetchJson(UI_TEXT_URL).then((data) => {
      uiTextCache = data || {};
      return uiTextCache;
    });
  }
  return uiTextPromise;
}

export function getPageData() {
  if (!pageDataPromise) {
    pageDataPromise = fetchJson(PAGE_DATA_URL).then((data) => {
      pageDataCache = data || {};
      return pageDataCache;
    });
  }
  return pageDataPromise;
}

export function getUiTextSync() {
  return uiTextCache || {};
}

export function getPageDataSync() {
  return pageDataCache || {};
}
