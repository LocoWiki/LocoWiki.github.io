import { getLocalizedList, getLocalizedValue } from "./utils.js";

let reverseAliasesCache = null;

export function getDocShellForPath(path) {
  const normalized = String(path || "").trim();
  if (!normalized) return "quickstart";
  if (normalized.startsWith("wiki/")) return "docs";
  if (normalized.startsWith("site-docs/")) return "developer";
  return "quickstart";
}

export function getDocShellName(pathname = window.location.pathname) {
  const value = String(pathname || "");
  if (/(^|\/)docs\.html$/i.test(value)) return "docs";
  if (/(^|\/)quickstart\.html$/i.test(value)) return "quickstart";
  if (/(^|\/)developer-docs\.html$/i.test(value)) return "developer";
  return "";
}

function buildReverseAliases(config) {
  if (reverseAliasesCache) return reverseAliasesCache;
  const aliases = config?.i18n?.docPathAliases || {};
  const reverse = {};
  Object.entries(aliases).forEach(([zhPath, enPath]) => {
    reverse[enPath] = zhPath;
  });
  reverseAliasesCache = reverse;
  return reverseAliasesCache;
}

export function mapDocPathToLanguage(path, lang, config) {
  const rawPath = String(path || "").trim();
  if (!rawPath) return rawPath;
  if (lang === "en") {
    return config?.i18n?.docPathAliases?.[rawPath] || rawPath;
  }
  const reverse = buildReverseAliases(config);
  return reverse[rawPath] || rawPath;
}

export function getDefaultDocPathForShell(config, lang, shell) {
  const shellDefaults = config?.site?.defaultDocByShell || {};
  const byShell = shellDefaults?.[shell];
  if (byShell) return mapDocPathToLanguage(byShell, lang, config);
  if (shell === "docs") {
    const docsGroup = getLocalizedList(config?.sidebar, lang)
      .flatMap((group) => getLocalizedList(group?.items, lang))
      .find((item) => getDocShellForPath(getLocalizedValue(item?.path, lang)) === "docs");
    return getLocalizedValue(docsGroup?.path, lang) || config?.site?.defaultDoc || "README.md";
  }
  const localizedDefault = config?.site?.defaultDocByLang?.[lang] || config?.site?.defaultDoc || "README.md";
  return mapDocPathToLanguage(localizedDefault, lang, config);
}

export function getDocPageHref(path, config, lang, shell = "") {
  const targetShell = shell || getDocShellForPath(path);
  const page = targetShell === "docs" ? "docs.html" : targetShell === "developer" ? "developer-docs.html" : "quickstart.html";
  const mappedPath = mapDocPathToLanguage(path, lang, config);
  return `${page}?path=${encodeURIComponent(mappedPath)}`;
}

export function resetDocAliasCache() {
  reverseAliasesCache = null;
}
