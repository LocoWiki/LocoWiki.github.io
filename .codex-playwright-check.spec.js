const { test } = require("@playwright/test");
const fs = require("node:fs");

test("locowiki layout and i18n", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 1680, height: 1400 }
  });
  const page = await context.newPage();

  const countCols = async (selector) =>
    page.evaluate((value) => {
      const el = document.querySelector(value);
      if (!el) return 0;
      return getComputedStyle(el).gridTemplateColumns.split(" ").filter(Boolean).length;
    }, selector);

  const result = {};

  await page.goto("http://127.0.0.1:4173/index.html", { waitUntil: "networkidle" });
  await page.screenshot({ path: "/tmp/locowiki-home.png", fullPage: true });
  result.home = {
    featureCols: await countCols(".feature-grid"),
    toolboxCols: await countCols(".toolbox-grid"),
    collaborationCols: await countCols(".collaboration-grid"),
    featureCount: await page.locator(".feature-grid .card").count(),
    collaborationCount: await page.locator(".collaboration-grid .card").count()
  };

  await page.goto("http://127.0.0.1:4173/downloads.html", { waitUntil: "networkidle" });
  await page.screenshot({ path: "/tmp/locowiki-downloads-zh.png", fullPage: true });
  result.downloadsZh = {
    hasSectionNav: await page.locator(".page-section-nav").count(),
    dynamicCols: await countCols(".download-entry-grid"),
    dynamicTitles: await page.locator(".download-entry-grid .card h3").allTextContents(),
    dynamicTags: await page.locator(".download-entry-grid .card .card-tag").allTextContents(),
    sectionTitles: await page.locator(".section-title").allTextContents(),
    sectionCardCols: await page.evaluate(() =>
      Array.from(document.querySelectorAll(".section-shell .cards")).map((el) =>
        getComputedStyle(el).gridTemplateColumns.split(" ").filter(Boolean).length
      )
    )
  };

  await page.click("#language-toggle");
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "/tmp/locowiki-downloads-en.png", fullPage: true });
  result.downloadsEn = {
    htmlLang: await page.locator("html").getAttribute("lang"),
    dynamicTitles: await page.locator(".download-entry-grid .card h3").allTextContents(),
    dynamicTags: await page.locator(".download-entry-grid .card .card-tag").allTextContents(),
    sectionTitles: await page.locator(".section-title").allTextContents()
  };

  fs.writeFileSync("/tmp/locowiki-playwright-result.json", JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));

  await context.close();
});
