import { getSiteConfig } from "../core/config.js";
import { t } from "../core/i18n.js";
import { escapeAttr, escapeHtml } from "../core/utils.js";

const CACHE_URL = "assets/content/contributors-cache.json";
const STORAGE_KEY = "locowiki_contributors_cache_v1";

let cachedContributors = null;
let cachedContributorsUrl = "";
let cachedErrorMessage = "";
let cachedGeneratedAt = "";

function formatCount(value) {
  const lang = document.documentElement.dataset.lang === "en" ? "en-US" : "zh-CN";
  return new Intl.NumberFormat(lang).format(Number.isFinite(value) ? value : 0);
}

function buildPageUrl(owner, repo) {
  return `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/graphs/contributors`;
}

function formatUpdatedAt(value) {
  const date = new Date(String(value || ""));
  if (Number.isNaN(date.getTime())) return "";
  const lang = document.documentElement.dataset.lang === "en" ? "en-US" : "zh-CN";
  return new Intl.DateTimeFormat(lang, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function readBrowserCache() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (Array.isArray(value?.contributors) && value.contributors.length) return value;
  } catch {
    // Ignore unavailable or malformed browser storage.
  }
  return null;
}

function writeBrowserCache(value) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Storage is an optional fallback, not a requirement for rendering.
  }
}

async function fetchCachedContributors(owner, repo) {
  const response = await fetch(CACHE_URL, { cache: "no-cache" });
  if (!response.ok) throw new Error(`Contributor cache returned HTTP ${response.status}`);
  const payload = await response.json();
  if (!Array.isArray(payload?.contributors)) throw new Error("Contributor cache format is invalid");
  if (payload?.sourceRepo?.owner !== owner || payload?.sourceRepo?.repo !== repo) throw new Error("Contributor cache source repository does not match");
  return payload;
}

function renderSummary(metaEl, contributors, contributorsUrl, generatedAt) {
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
    <div class="contributors-summary-item">
      <div class="contributors-summary-label">${escapeHtml(t("contributors.summary.updatedAt", { fallback: "Updated" }))}</div>
      <div class="contributors-summary-value">${escapeHtml(formatUpdatedAt(generatedAt) || t("contributors.summary.cached", { fallback: "Cached snapshot" }))}</div>
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
    let payload;
    try {
      payload = await fetchCachedContributors(owner, repo);
      writeBrowserCache(payload);
    } catch (cacheError) {
      payload = readBrowserCache();
      if (!payload) throw cacheError;
    }
    const contributors = payload.contributors;
    cachedContributors = contributors;
    cachedGeneratedAt = payload.generatedAt || "";
    cachedErrorMessage = "";
    renderSummary(metaEl, contributors, contributorsUrl, cachedGeneratedAt);
    renderList(listEl, contributors);
  } catch (error) {
    cachedContributors = null;
    cachedGeneratedAt = "";
    cachedErrorMessage = error instanceof Error ? error.message : String(error);
    renderError(metaEl, listEl, contributorsUrl, cachedErrorMessage);
  }
}

export function rerenderCachedContributors() {
  const metaEl = document.getElementById("contributors-meta");
  const listEl = document.getElementById("contributors-list");
  if (!metaEl || !listEl || !cachedContributorsUrl) return;

  if (Array.isArray(cachedContributors)) {
    renderSummary(metaEl, cachedContributors, cachedContributorsUrl, cachedGeneratedAt);
    renderList(listEl, cachedContributors);
    return;
  }

  renderError(metaEl, listEl, cachedContributorsUrl, cachedErrorMessage);
}
