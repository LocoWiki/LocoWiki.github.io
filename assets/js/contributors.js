(function () {
  const API_ACCEPT = "application/vnd.github+json";
  const MAX_PAGES = 10;
  const PAGE_SIZE = 100;

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

  function formatCount(value) {
    return new Intl.NumberFormat("zh-CN").format(Number.isFinite(value) ? value : 0);
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
      if (!res.ok) throw new Error(`GitHub API 返回 HTTP ${res.status}`);

      const rows = await res.json();
      if (!Array.isArray(rows)) throw new Error("GitHub API 返回数据格式异常");
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
        <div class="contributors-summary-label">贡献者总数</div>
        <div class="contributors-summary-value">${formatCount(contributors.length)}</div>
      </div>
      <div class="contributors-summary-item">
        <div class="contributors-summary-label">累计贡献次数</div>
        <div class="contributors-summary-value">${formatCount(totalContributions)}</div>
      </div>
      <div class="contributors-summary-item">
        <div class="contributors-summary-label">数据来源</div>
        <div class="contributors-summary-value contributors-summary-link">
          <a href="${escapeAttr(contributorsUrl)}" target="_blank" rel="noopener noreferrer">GitHub Contributors</a>
        </div>
      </div>
    `;
  }

  function renderContributors(listEl, contributors) {
    if (!contributors.length) {
      listEl.innerHTML = `<div class="contributor-empty">暂无贡献者数据。</div>`;
      return;
    }

    listEl.innerHTML = contributors
      .map((item) => {
        const login = escapeHtml(item.login || "unknown");
        const profileUrl = escapeAttr(item.html_url || "#");
        const avatarUrl = escapeAttr(item.avatar_url || "");
        const contributionCount = Number.isFinite(item.contributions) ? item.contributions : 0;
        const extraMeta = item.type === "Bot" ? " · Bot" : "";

        return `
          <a class="contributor-card" href="${profileUrl}" target="_blank" rel="noopener noreferrer" aria-label="查看 ${login} 的 GitHub 主页">
            <img class="contributor-avatar" src="${avatarUrl}" alt="${login} 的头像" loading="lazy" decoding="async" />
            <div class="contributor-info">
              <div class="contributor-login">${login}</div>
              <div class="contributor-meta">${formatCount(contributionCount)} 次贡献${extraMeta}</div>
            </div>
          </a>
        `;
      })
      .join("");
  }

  function renderError(metaEl, listEl, contributorsUrl, message) {
    metaEl.className = "sync-meta";
    metaEl.innerHTML = `
      <strong>贡献者数据加载失败</strong>
      <div class="sync-meta-detail">
        你可以直接访问
        <a href="${escapeAttr(contributorsUrl)}" target="_blank" rel="noopener noreferrer">GitHub Contributors 页面</a>。
      </div>
    `;

    listEl.innerHTML = `
      <div class="contributor-empty">
        <div>当前无法读取 GitHub API。</div>
        <div style="margin-top: 6px; color: var(--muted);">${escapeHtml(message || "未知错误")}</div>
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

    try {
      const contributors = await fetchContributors(owner, repo);
      renderSummary(metaEl, contributors, contributorsUrl);
      renderContributors(listEl, contributors);
    } catch (err) {
      console.error(err);
      renderError(metaEl, listEl, contributorsUrl, err instanceof Error ? err.message : String(err));
    }
  }

  window.addEventListener("DOMContentLoaded", () => {
    render().catch((err) => console.error(err));
  });
})();
