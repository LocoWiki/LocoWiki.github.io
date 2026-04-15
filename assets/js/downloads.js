(function () {
  function escapeHtml(str) {
    return window.LocoWikiSite?.escapeHtml ? window.LocoWikiSite.escapeHtml(str) : String(str);
  }

  function t(key, fallback, vars) {
    if (typeof window.LocoWikiSite?.t === "function") {
      return window.LocoWikiSite.t(key, { fallback, vars });
    }
    return fallback;
  }

  async function render() {
    const el = document.getElementById("download-dynamic");
    if (!el) return;

    const config = await window.LocoWikiSite.getConfig();
    const owner = config.sourceRepo.owner;
    const repo = config.sourceRepo.repo;
    const branch = config.sourceRepo.branch;

    const zipUrl = `https://github.com/${owner}/${repo}/archive/refs/heads/${branch}.zip`;
    const repoUrl = config.links.repo;
    const releasesUrl = `https://github.com/${owner}/${repo}/releases`;

    el.className = "";
    el.innerHTML = `
        <div class="cards download-entry-grid">
        <div class="card info-card">
          <span class="card-tag">${escapeHtml(t("downloads.dynamic.zipTag", "最快"))}</span>
          <h3>${escapeHtml(t("downloads.dynamic.zipTitle", "⬇️ 下载 ZIP"))}</h3>
          <p>${escapeHtml(t("downloads.dynamic.zipDesc", "适合快速浏览与离线查阅（不包含 Git 历史）。"))}</p>
          <a href="${zipUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(t("downloads.dynamic.zipLink", "下载 main.zip"))}</a>
        </div>
        <div class="card info-card">
          <span class="card-tag">${escapeHtml(t("downloads.dynamic.cloneTag", "同步"))}</span>
          <h3>${escapeHtml(t("downloads.dynamic.cloneTitle", "🧬 克隆仓库"))}</h3>
          <p>${escapeHtml(t("downloads.dynamic.cloneDesc", "适合持续更新与贡献；推荐配合 Git LFS（若存在大文件）。"))}</p>
          <div class="code-panel">
            <div class="code-panel-label">${escapeHtml(t("downloads.dynamic.cloneCommandLabel", "推荐命令"))}</div>
            <code>git clone https://github.com/${escapeHtml(owner)}/${escapeHtml(repo)}.git</code>
          </div>
          <div class="download-entry-note">${escapeHtml(t("downloads.dynamic.cloneCommandNote", "如果你要长期跟仓库同步，这个方式最稳。"))}</div>
        </div>
        <div class="card info-card">
          <span class="card-tag">${escapeHtml(t("downloads.dynamic.releasesTag", "发版"))}</span>
          <h3>${escapeHtml(t("downloads.dynamic.releasesTitle", "📦 Releases"))}</h3>
          <p>${escapeHtml(t("downloads.dynamic.releasesDesc", "如果后续提供打包资源（模型/数据/场地等），会优先放到 Releases。"))}</p>
          <a href="${releasesUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(t("downloads.dynamic.releasesLink", "打开 Releases"))}</a>
        </div>
        <div class="card info-card">
          <span class="card-tag">${escapeHtml(t("downloads.dynamic.repoTag", "仓库"))}</span>
          <h3>${escapeHtml(t("downloads.dynamic.repoTitle", "🔗 GitHub 仓库"))}</h3>
          <p>${escapeHtml(t("downloads.dynamic.repoDesc", "查看目录结构、历史提交、Issue/PR、以及最完整的更新说明。"))}</p>
          <a href="${repoUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(t("downloads.dynamic.repoLink", "打开仓库"))}</a>
        </div>
      </div>
    `;
  }

  window.addEventListener("DOMContentLoaded", () => {
    render().catch((e) => {
      console.error(e);
      const el = document.getElementById("download-dynamic");
      if (el) {
        el.className = "error";
        el.textContent = t("downloads.dynamic.renderError", "生成下载入口失败，请稍后重试。");
      }
    });

    window.addEventListener("locowiki:languagechange", () => {
      render().catch((e) => console.error(e));
    });
  });
})();
