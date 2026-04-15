import { getSiteConfig } from "../core/config.js";
import { t } from "../core/i18n.js";
import { escapeAttr, escapeHtml } from "../core/utils.js";

const API_ACCEPT = "application/vnd.github+json";
const PAGE_SIZE = 100;
const MAX_PAGES = 10;

let cachedContributors = null;
let cachedContributorsUrl = "";
let cachedErrorMessage = "";

function formatCount(value) {
  const lang = document.documentElement.dataset.lang === "en" ? "en-US" : "zh-CN";
  return new Intl.NumberFormat(lang).format(Number.isFinite(value) ? value : 0);
}

function buildApiUrl(owner, repo, page) {
  return `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contributors?per_page=${PAGE_SIZE}&page=${page}`;
}

function buildPageUrl(owner, repo) {
  return `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/graphs/contributors`;
}

async function fetchContributors(owner, repo) {
  const all = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const response = await fetch(buildApiUrl(owner, repo, page), {
      headers: { Accept: API_ACCEPT }
    });
    if (!response.ok) {
      throw new Error(t("contributors.apiHttpError", { fallback: "GitHub API returned HTTP {status}", vars: { status: response.status } }));
    }
    const rows = await response.json();
    if (!Array.isArray(rows)) {
      throw new Error(t("contributors.apiFormatError", { fallback: "Unexpected GitHub API response format" }));
    }
    if (!rows.length) break;
    all.push(...rows);
    if (rows.length < PAGE_SIZE) break;
  }
  return all
    .filter((row) => row && typeof row.login === "string" && typeof row.html_url === "string")
    .sort((a, b) => (b.contributions || 0) - (a.contributions || 0));
}

function renderSummary(metaEl, contributors, contributorsUrl) {
  const totalContributions = contributors.reduce((sum, item) => sum + (Number.isFinite(item.contributions) ? item.contributions : 0), 0);
  metaEl.className = "contributors-summary";
  metaEl.innerHTML = `
    <div class="contributors-summary-item">
      <div class="contributors-summary-label">${escapeHtml(t("contributors.summary.totalContributors", { fallback: "Total Contributors" }))}</div>
      <div class="contributors-summary-value">${formatCount(contributors.length)}</div>
    </div>
    <div class="contributors-summary-item">
      <div class="contributors-summary-label">${escapeHtml(t("contributors.summary.totalContributions", { fallback: "Total Contributions" }))}</div>
      <div class="contributors-summary-value">${formatCount(totalContributions)}</div>
    </div>
    <div class="contributors-summary-item">
      <div class="contributors-summary-label">${escapeHtml(t("contributors.summary.dataSource", { fallback: "Data Source" }))}</div>
      <div class="contributors-summary-value contributors-summary-link">
        <a href="${escapeAttr(contributorsUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(
          t("contributors.summary.dataSourceLink", { fallback: "GitHub Contributors" })
        )}</a>
      </div>
    </div>
  `;
}

function renderList(listEl, contributors) {
  if (!contributors.length) {
    listEl.innerHTML = `<div class="contributor-empty">${escapeHtml(t("contributors.empty", { fallback: "No contributor data yet." }))}</div>`;
    return;
  }

  listEl.innerHTML = contributors
    .map((item) => {
      const login = item.login || "unknown";
      const count = Number.isFinite(item.contributions) ? item.contributions : 0;
      return `
        <a class="contributor-card" href="${escapeAttr(item.html_url)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeAttr(
          t("contributors.cardAria", { fallback: "View {login}'s GitHub profile", vars: { login } })
        )}">
          <img class="contributor-avatar" src="${escapeAttr(item.avatar_url || "")}" alt="${escapeAttr(
            t("contributors.avatarAlt", { fallback: "{login}'s avatar", vars: { login } })
          )}" loading="lazy" decoding="async" />
          <div class="contributor-info">
            <div class="contributor-login">${escapeHtml(login)}</div>
            <div class="contributor-meta">${escapeHtml(
              t("contributors.metaContribution", { fallback: "{count} contributions", vars: { count: formatCount(count) } })
            )}${item.type === "Bot" ? ` ${escapeHtml(t("contributors.botSuffix", { fallback: "· Bot" }))}` : ""}</div>
          </div>
        </a>
      `;
    })
    .join("");
}

function renderError(metaEl, listEl, contributorsUrl, message) {
  metaEl.className = "sync-meta";
  metaEl.innerHTML = `
    <strong>${escapeHtml(t("contributors.errorTitle", { fallback: "Failed to load contributor data" }))}</strong>
    <div class="sync-meta-detail">
      ${escapeHtml(t("contributors.errorHintPrefix", { fallback: "You can directly visit" }))}
      <a href="${escapeAttr(contributorsUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(
        t("contributors.errorHintLink", { fallback: "the GitHub Contributors page" })
      )}</a>${escapeHtml(t("contributors.errorHintSuffix", { fallback: "." }))}
    </div>
  `;
  listEl.innerHTML = `
    <div class="contributor-empty">
      <div>${escapeHtml(t("contributors.errorListTop", { fallback: "Unable to read the GitHub API right now." }))}</div>
      <div style="margin-top: 6px; color: var(--muted);">${escapeHtml(message || t("contributors.errorUnknown", { fallback: "Unknown error" }))}</div>
    </div>
  `;
}

export async function renderContributorsSection() {
  const metaEl = document.getElementById("contributors-meta");
  const listEl = document.getElementById("contributors-list");
  if (!metaEl || !listEl) return;

  const config = await getSiteConfig();
  const owner = config?.sourceRepo?.owner || "LocoWiki";
  const repo = config?.sourceRepo?.repo || "LocoWiki";
  const contributorsUrl = buildPageUrl(owner, repo);
  cachedContributorsUrl = contributorsUrl;

  try {
    const contributors = await fetchContributors(owner, repo);
    cachedContributors = contributors;
    cachedErrorMessage = "";
    renderSummary(metaEl, contributors, contributorsUrl);
    renderList(listEl, contributors);
  } catch (error) {
    cachedContributors = null;
    cachedErrorMessage = error instanceof Error ? error.message : String(error);
    renderError(metaEl, listEl, contributorsUrl, cachedErrorMessage);
  }
}

export function rerenderCachedContributors() {
  const metaEl = document.getElementById("contributors-meta");
  const listEl = document.getElementById("contributors-list");
  if (!metaEl || !listEl || !cachedContributorsUrl) return;

  if (Array.isArray(cachedContributors)) {
    renderSummary(metaEl, cachedContributors, cachedContributorsUrl);
    renderList(listEl, cachedContributors);
    return;
  }

  renderError(metaEl, listEl, cachedContributorsUrl, cachedErrorMessage);
}
