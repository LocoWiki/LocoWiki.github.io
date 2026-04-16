import { normalizePathname } from "./utils.js";

function normalizePageKey(pathname = window.location.pathname) {
  const normalized = normalizePathname(pathname);
  if (!normalized || normalized === "/" || normalized.endsWith("/index.html")) return "index.html";
  return normalized.split("/").pop() || "";
}

export function getPageStandards(config) {
  return config?.pageStandards || { frames: {}, pages: {} };
}

export function getPageStandard(config, pathname = window.location.pathname) {
  const key = normalizePageKey(pathname);
  const standards = getPageStandards(config);
  const page = standards?.pages?.[key];
  if (!page) return null;
  return {
    key,
    frame: page.frame || "",
    source: page.source || "",
    shell: page.shell || "",
    frameSpec: standards?.frames?.[page.frame] || null
  };
}

export function applyPageStandard(config, body = document.body, pathname = window.location.pathname) {
  if (!body) return null;
  const standard = getPageStandard(config, pathname);
  if (!standard) {
    delete body.dataset.standardKey;
    delete body.dataset.standardFrame;
    delete body.dataset.standardSource;
    delete body.dataset.standardShell;
    return null;
  }

  body.dataset.standardKey = standard.key;
  body.dataset.standardFrame = standard.frame;
  body.dataset.standardSource = standard.source;
  if (standard.shell) body.dataset.standardShell = standard.shell;
  else delete body.dataset.standardShell;
  return standard;
}
