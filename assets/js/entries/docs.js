import { initSiteShell } from "../components/site-shell.js";
import { initDocsNavigation, renderDocsPage } from "../pages/docs-page.js";

window.addEventListener("DOMContentLoaded", async () => {
  await initSiteShell();
  initDocsNavigation();
  await renderDocsPage();
});
