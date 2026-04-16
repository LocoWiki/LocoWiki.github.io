export function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isString(value) {
  return typeof value === "string";
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function escapeAttr(value) {
  return escapeHtml(value).replaceAll("`", "&#96;");
}

export function interpolate(template, vars) {
  if (!isString(template) || !isObject(vars)) return isString(template) ? template : "";
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) => {
    if (!(key in vars)) return match;
    return String(vars[key]);
  });
}

export function getValueByPath(obj, path) {
  if (!isObject(obj) || !isString(path) || !path) return undefined;
  return path.split(".").reduce((acc, key) => {
    if (!acc || typeof acc !== "object") return undefined;
    return acc[key];
  }, obj);
}

export function getLocalizedValue(value, lang, fallback = "") {
  if (isString(value)) return value;
  if (!isObject(value)) return fallback;
  return value[lang] || value.zh || value.en || value.default || fallback;
}

export function getLocalizedList(value, lang) {
  if (Array.isArray(value)) return value;
  if (!isObject(value)) return [];
  const list = value[lang] || value.zh || value.en || value.default;
  return Array.isArray(list) ? list : [];
}

export function normalizeLanguage(value) {
  const s = String(value || "").trim().toLowerCase();
  if (s.startsWith("en")) return "en";
  if (s.startsWith("zh")) return "zh";
  return "";
}

export function normalizeTheme(value) {
  const s = String(value || "").trim().toLowerCase();
  if (s === "light" || s === "dark") return s;
  return "";
}

export function normalizePathname(pathname = window.location.pathname) {
  const path = String(pathname || "").trim() || "/";
  return path.startsWith("/") ? path : `/${path}`;
}

export function stripLeadingSlash(path) {
  return String(path || "").replace(/^\/+/, "");
}

export function dirname(path) {
  const value = String(path || "");
  const index = value.lastIndexOf("/");
  return index === -1 ? "" : value.slice(0, index + 1);
}

export function normalizePath(path) {
  const segments = String(path || "").split("/");
  const normalized = [];
  segments.forEach((segment) => {
    if (!segment || segment === ".") return;
    if (segment === "..") {
      if (normalized.length) normalized.pop();
      return;
    }
    normalized.push(segment);
  });
  return normalized.join("/");
}

export function encodePath(path) {
  return String(path || "")
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export function resolveRelativePath(currentDocPath, relativePath) {
  const relative = stripLeadingSlash(relativePath);
  if (String(relativePath || "").startsWith("/")) return normalizePath(relative);
  return normalizePath(`${dirname(currentDocPath)}${relative}`);
}

export function splitHash(url) {
  const value = String(url || "");
  const index = value.indexOf("#");
  if (index === -1) return { base: value, hash: "" };
  return {
    base: value.slice(0, index),
    hash: value.slice(index)
  };
}

export function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function isExternalHref(href) {
  return /^(https?:)?\/\//i.test(href) || /^mailto:/i.test(href) || /^tel:/i.test(href);
}

export function isDangerousHref(href) {
  return /^javascript:/i.test(href) || /^data:/i.test(href);
}

export function cssEscape(value) {
  if (window.CSS && typeof window.CSS.escape === "function") return window.CSS.escape(value);
  return String(value).replace(/["\\]/g, "\\$&");
}
