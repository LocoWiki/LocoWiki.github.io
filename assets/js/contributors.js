(function () {
  const API_ACCEPT = "application/vnd.github+json";
  const MAX_PAGES = 10;
  const PAGE_SIZE = 100;
  let cachedContributors = null;
  let cachedContributorsUrl = "";
  let cachedErrorMessage = "";

  function escapeHtml(value) {
    if (window.LocoWikiSite?.escapeHtml) return window.LocoWikiSite.escapeHtml(value);
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function escapeAttr(value) {
    return escapeHtml(value).replaceAll("`", "&#96;");
  }

  function t(key, fallback, vars) {
    if (typeof window.LocoWikiSite?.t === "function") {
      return window.LocoWikiSite.t(key, { fallback, vars });
    }
    return fallback;
  }

  function getLanguage() {
    const lang =
      typeof window.LocoWikiSite?.getLanguage === "function" ? window.LocoWikiSite.getLanguage() : "zh";
    return lang === "en" ? "en" : "zh";
  }

  function formatCount(value) {
    const locale = getLanguage() === "en" ? "en-US" : "zh-CN";
    return new Intl.NumberFormat(locale).format(Number.isFinite(value) ? value : 0);
  }

  function buildContributorsApiUrl(owner, repo, page) {
    return `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(
      repo,
    )}/contributors?per_page=${PAGE_SIZE}&page=${page}`;
  }

  function buildContributorsPageUrl(owner, repo) {
    return `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(
      repo,
    )}/graphs/contributors`;
  }

  async function fetchContributors(owner, repo) {
    const all = [];

    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const res = await fetch(buildContributorsApiUrl(owner, repo, page), {
        headers: { Accept: API_ACCEPT },
      });
      if (!res.ok) {
        throw new Error(
          t("contributors.apiHttpError", "GitHub API 返回 HTTP {status}", {
            status: res.status,
          }),
        );
      }

      const rows = await res.json();
      if (!Array.isArray(rows)) {
        throw new Error(t("contributors.apiFormatError", "GitHub API 返回数据格式异常"));
      }
      if (!rows.length) break;

      all.push(
        ...rows.filter(
          (item) =>
            item &&
            typeof item.login === "string" &&
            typeof item.html_url === "string" &&
            typeof item.avatar_url === "string",
        ),
      );

      if (rows.length < PAGE_SIZE) break;
    }

    return all.sort((a, b) => (b.contributions || 0) - (a.contributions || 0));
  }

  function renderSummary(metaEl, contributors, contributorsUrl) {
    const totalContributions = contributors.reduce((sum, item) => {
      return sum + (Number.isFinite(item.contributions) ? item.contributions : 0);
    }, 0);

    metaEl.className = "contributors-summary";
    metaEl.innerHTML = `
      <div class="contributors-summary-item">
        <div class="contributors-summary-label">${escapeHtml(t("contributors.summary.totalContributors", "贡献者总数"))}</div>
        <div class="contributors-summary-value">${formatCount(contributors.length)}</div>
      </div>
      <div class="contributors-summary-item">
        <div class="contributors-summary-label">${escapeHtml(t("contributors.summary.totalContributions", "累计贡献次数"))}</div>
        <div class="contributors-summary-value">${formatCount(totalContributions)}</div>
      </div>
      <div class="contributors-summary-item">
        <div class="contributors-summary-label">${escapeHtml(t("contributors.summary.dataSource", "数据来源"))}</div>
        <div class="contributors-summary-value contributors-summary-link">
          <a href="${escapeAttr(contributorsUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t("contributors.summary.dataSourceLink", "GitHub Contributors"))}</a>
        </div>
      </div>
    `;
  }

  function renderContributors(listEl, contributors) {
    if (!contributors.length) {
      listEl.innerHTML = `<div class="contributor-empty">${escapeHtml(t("contributors.empty", "暂无贡献者数据。"))}</div>`;
      return;
    }

    listEl.innerHTML = contributors
      .map((item) => {
        const rawLogin = item.login || "unknown";
        const login = escapeHtml(rawLogin);
        const profileUrl = escapeAttr(item.html_url || "#");
        const avatarUrl = escapeAttr(item.avatar_url || "");
        const contributionCount = Number.isFinite(item.contributions) ? item.contributions : 0;
        const extraMeta = item.type === "Bot" ? ` ${escapeHtml(t("contributors.botSuffix", "· Bot"))}` : "";
        const countText = t("contributors.metaContribution", "{count} 次贡献", {
          count: formatCount(contributionCount),
        });
        const profileAria = t("contributors.cardAria", "查看 {login} 的 GitHub 主页", { login: rawLogin });
        const avatarAlt = t("contributors.avatarAlt", "{login} 的头像", { login: rawLogin });

        return `
          <a class="contributor-card" href="${profileUrl}" target="_blank" rel="noopener noreferrer" aria-label="${escapeAttr(profileAria)}">
            <img class="contributor-avatar" src="${avatarUrl}" alt="${escapeAttr(avatarAlt)}" loading="lazy" decoding="async" />
            <div class="contributor-info">
              <div class="contributor-login">${login}</div>
              <div class="contributor-meta">${escapeHtml(countText)}${extraMeta}</div>
            </div>
          </a>
        `;
      })
      .join("");
  }

  function renderError(metaEl, listEl, contributorsUrl, message) {
    metaEl.className = "sync-meta";
    metaEl.innerHTML = `
      <strong>${escapeHtml(t("contributors.errorTitle", "贡献者数据加载失败"))}</strong>
      <div class="sync-meta-detail">
        ${escapeHtml(t("contributors.errorHintPrefix", "你可以直接访问"))}
        <a href="${escapeAttr(contributorsUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t("contributors.errorHintLink", "GitHub Contributors 页面"))}</a>${escapeHtml(t("contributors.errorHintSuffix", "。"))}
      </div>
    `;

    listEl.innerHTML = `
      <div class="contributor-empty">
        <div>${escapeHtml(t("contributors.errorListTop", "当前无法读取 GitHub API。"))}</div>
        <div style="margin-top: 6px; color: var(--muted);">${escapeHtml(message || t("contributors.errorUnknown", "未知错误"))}</div>
      </div>
    `;
  }

  async function render() {
    const metaEl = document.getElementById("contributors-meta");
    const listEl = document.getElementById("contributors-list");
    if (!metaEl || !listEl) return;

    const config = await window.LocoWikiSite.getConfig();
    const owner = config?.sourceRepo?.owner || "LocoWiki";
    const repo = config?.sourceRepo?.repo || "LocoWiki";
    const contributorsUrl = buildContributorsPageUrl(owner, repo);
    cachedContributorsUrl = contributorsUrl;
    cachedErrorMessage = "";

    try {
      const contributors = await fetchContributors(owner, repo);
      cachedContributors = contributors;
      renderSummary(metaEl, contributors, contributorsUrl);
      renderContributors(listEl, contributors);
    } catch (err) {
      console.error(err);
      cachedContributors = null;
      cachedErrorMessage = err instanceof Error ? err.message : String(err);
      renderError(metaEl, listEl, contributorsUrl, cachedErrorMessage);
    }
  }

  window.addEventListener("DOMContentLoaded", () => {
    render().catch((err) => console.error(err));
    window.addEventListener("locowiki:languagechange", () => {
      const metaEl = document.getElementById("contributors-meta");
      const listEl = document.getElementById("contributors-list");
      if (!metaEl || !listEl) return;
      if (Array.isArray(cachedContributors)) {
        renderSummary(metaEl, cachedContributors, cachedContributorsUrl);
        renderContributors(listEl, cachedContributors);
      } else if (cachedContributorsUrl) {
        renderError(metaEl, listEl, cachedContributorsUrl, cachedErrorMessage);
      }
    });
  });
})();
