import { getDefaultDocPathForShell, getDocPageHref } from "../core/docs-routing.js";
import { applyI18n } from "../core/i18n.js";
import { initSiteShell } from "../components/site-shell.js";

window.addEventListener("DOMContentLoaded", async () => {
  const config = await initSiteShell();
  const lang = document.documentElement.dataset.lang || "zh";
  applyI18n(document, lang);
  const docsLink = document.getElementById("not-found-docs");
  if (docsLink) {
    const defaultPath = getDefaultDocPathForShell(config, lang, "quickstart");
    docsLink.href = getDocPageHref(defaultPath, config, lang, "quickstart");
  }
});
