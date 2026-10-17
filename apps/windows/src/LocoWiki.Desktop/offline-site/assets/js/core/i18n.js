import { getUiTextData, getUiTextSync } from "./config.js";
import { getCurrentLanguage } from "./preferences.js";
import { getValueByPath, interpolate, isObject, isString } from "./utils.js";

export async function initI18n() {
  return getUiTextData();
}

export function t(key, options = {}) {
  const opts = isObject(options) ? options : {};
  const lang = opts.lang || getCurrentLanguage();
  const fallback = isString(opts.fallback) ? opts.fallback : key;
  const dict = getUiTextSync();
  const value =
    getValueByPath(dict?.[lang], key) ??
    getValueByPath(dict?.zh, key) ??
    getValueByPath(dict?.en, key);
  const text = isString(value) ? value : fallback;
  return interpolate(text, opts.vars);
}

export function applyI18n(root = document, lang = getCurrentLanguage()) {
  const selector = [
    "[data-i18n]",
    "[data-i18n-html]",
    "[data-i18n-title]",
    "[data-i18n-aria-label]",
    "[data-i18n-placeholder]",
    "[data-i18n-alt]"
  ].join(", ");

  const nodes = [];
  if (root instanceof Element && root.matches(selector)) nodes.push(root);
  if (typeof root.querySelectorAll === "function") {
    nodes.push(...root.querySelectorAll(selector));
  }

  nodes.forEach((element) => {
    const textKey = element.getAttribute("data-i18n");
    if (textKey) {
      element.textContent = t(textKey, {
        lang,
        fallback: (element.textContent || "").trim()
      });
    }

    const htmlKey = element.getAttribute("data-i18n-html");
    if (htmlKey) {
      element.innerHTML = t(htmlKey, {
        lang,
        fallback: element.innerHTML || ""
      });
    }

    [
      ["data-i18n-title", "title"],
      ["data-i18n-aria-label", "aria-label"],
      ["data-i18n-placeholder", "placeholder"],
      ["data-i18n-alt", "alt"]
    ].forEach(([dataAttr, targetAttr]) => {
      const key = element.getAttribute(dataAttr);
      if (!key) return;
      element.setAttribute(
        targetAttr,
        t(key, {
          lang,
          fallback: element.getAttribute(targetAttr) || ""
        })
      );
    });
  });
}
