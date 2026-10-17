import { getLocalizedList, getLocalizedValue } from "./utils.js";

let reverseAliasesCache = null;

export const DOC_COLLECTIONS = {
  docs: ["wiki/", "competition-rules/", "technical-sharing/", "scripts/"],
  papers: ["reading-list/"],
  "open-source": ["network-open-source/"]
};

export const DOC_TOP_LEVEL_DIRS = ["competition-rules", "technical-sharing", "scripts"];

export function getDocCollectionForPath(path) {
  const normalized = String(path || "").trim();
  return Object.entries(DOC_COLLECTIONS).find(([, prefixes]) => prefixes.some((prefix) => normalized.startsWith(prefix)))?.[0] || "";
}

export function getDocShellForPath(path) {
  const normalized = String(path || "").trim();
  if (!normalized) return "papers";
  if (normalized === "README.md" || normalized === "README.en.md") return "about";
  if (normalized.startsWith("wiki/")) return "docs";
  if (normalized.startsWith("site-docs/")) return "developer";
  if (normalized.startsWith("network-open-source/")) return "open-source";
  if (normalized.startsWith("reading-list/")) return "papers";
  if (DOC_TOP_LEVEL_DIRS.some((dir) => normalized.startsWith(`${dir}/`))) return "docs";
  return "papers";
}

export function getDocShellName(pathname = window.location.pathname) {
  const value = String(pathname || "");
  if (/(^|\/)docs\.html$/i.test(value)) return "docs";
  if (/(^|\/)(quickstart|papers)\.html$/i.test(value)) return "papers";
  if (/(^|\/)open-source\.html$/i.test(value)) return "open-source";
  if (/(^|\/)developer-docs\.html$/i.test(value)) return "developer";
  if (/(^|\/)about\.html$/i.test(value)) return "about";
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
  const page = targetShell === "docs" ? "docs.html" : targetShell === "developer" ? "developer-docs.html" : targetShell === "open-source" ? "open-source.html" : targetShell === "about" ? "about.html" : "papers.html";
  const mappedPath = mapDocPathToLanguage(path, lang, config);
  return `${page}?path=${encodeURIComponent(mappedPath)}`;
}

export function resetDocAliasCache() {
  reverseAliasesCache = null;
}
