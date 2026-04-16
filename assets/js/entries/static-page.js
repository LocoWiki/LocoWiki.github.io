import { initSiteShell } from "../components/site-shell.js";
import { renderPageToc, bindPageToc } from "../pages/page-toc.js";
import { renderStaticPage } from "../pages/static-page.js";

async function renderPage() {
  const pageId = document.body?.dataset.pageId;
  if (!pageId) return;
  await renderStaticPage(pageId);
  renderPageToc();
}

window.addEventListener("DOMContentLoaded", async () => {
  await initSiteShell();
  await renderPage();
  bindPageToc();
  window.addEventListener("locowiki:languagechange", () => {
    renderPage().catch((error) => console.error(error));
  });
});
