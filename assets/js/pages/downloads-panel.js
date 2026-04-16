import { getSiteConfig } from "../core/config.js";
import { t } from "../core/i18n.js";
import { escapeHtml } from "../core/utils.js";

export async function renderDownloadsPanel() {
  const root = document.getElementById("download-dynamic");
  if (!root) return;

  const config = await getSiteConfig();
  const owner = config?.sourceRepo?.owner || "LocoWiki";
  const repo = config?.sourceRepo?.repo || "LocoWiki";
  const branch = config?.sourceRepo?.branch || "main";
  const zipUrl = `https://github.com/${owner}/${repo}/archive/refs/heads/${branch}.zip`;
  const releasesUrl = `https://github.com/${owner}/${repo}/releases`;
  const repoUrl = config?.links?.repo || "#";

  root.className = "";
  root.innerHTML = `
    <div class="cards cards-3 download-entry-grid">
      <div class="card info-card">
        <span class="card-tag">${escapeHtml(t("downloads.zipTag", { fallback: "Fastest" }))}</span>
        <h3>${escapeHtml(t("downloads.zipTitle", { fallback: "Download ZIP" }))}</h3>
        <p>${escapeHtml(t("downloads.zipDesc", { fallback: "Best for quick browsing and offline reading." }))}</p>
        <a href="${zipUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(t("downloads.zipLink", { fallback: "Download ZIP" }))}</a>
      </div>
      <div class="card info-card">
        <span class="card-tag">${escapeHtml(t("downloads.cloneTag", { fallback: "Sync" }))}</span>
        <h3>${escapeHtml(t("downloads.cloneTitle", { fallback: "Clone Repository" }))}</h3>
        <p>${escapeHtml(t("downloads.cloneDesc", { fallback: "Best for updates, pull workflows, and contributions." }))}</p>
        <div class="code-panel">
          <div class="code-panel-label">Git</div>
          <code>git clone https://github.com/${owner}/${repo}.git</code>
        </div>
      </div>
      <div class="card info-card">
        <span class="card-tag">${escapeHtml(t("downloads.repoTag", { fallback: "Repository" }))}</span>
        <h3>${escapeHtml(t("downloads.repoTitle", { fallback: "GitHub Repository" }))}</h3>
        <p>${escapeHtml(t("downloads.repoDesc", { fallback: "Browse folder structure, history, issues, and updates." }))}</p>
        <a href="${repoUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(t("downloads.repoLink", { fallback: "Open Repository" }))}</a>
      </div>
      <div class="card info-card">
        <span class="card-tag">${escapeHtml(t("downloads.releaseTag", { fallback: "Release" }))}</span>
        <h3>${escapeHtml(t("downloads.releaseTitle", { fallback: "Releases" }))}</h3>
        <p>${escapeHtml(t("downloads.releaseDesc", { fallback: "Packaged resources should land in Releases first when available." }))}</p>
        <a href="${releasesUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(t("downloads.releaseLink", { fallback: "Open Releases" }))}</a>
      </div>
    </div>
  `;
}
