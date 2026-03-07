(function () {
  function escapeHtml(str) {
    return window.LeggedWikiSite?.escapeHtml ? window.LeggedWikiSite.escapeHtml(str) : String(str);
  }

  async function render() {
    const el = document.getElementById("download-dynamic");
    if (!el) return;

    const config = await window.LeggedWikiSite.getConfig();
    const owner = config.sourceRepo.owner;
    const repo = config.sourceRepo.repo;
    const branch = config.sourceRepo.branch;

    const zipUrl = `https://github.com/${owner}/${repo}/archive/refs/heads/${branch}.zip`;
    const repoUrl = config.links.repo;
    const releasesUrl = `https://github.com/${owner}/${repo}/releases`;

    el.className = "";
    el.innerHTML = `
      <div class="cards" style="margin-top: 14px;">
        <div class="card">
          <h3>⬇️ 下载 ZIP</h3>
          <p>适合快速浏览与离线查阅（不包含 Git 历史）。</p>
          <a href="${zipUrl}" target="_blank" rel="noopener noreferrer">下载 main.zip</a>
        </div>
        <div class="card">
          <h3>🧬 克隆仓库</h3>
          <p>适合持续更新与贡献；推荐配合 Git LFS（若存在大文件）。</p>
          <pre><code>git clone https://github.com/${escapeHtml(owner)}/${escapeHtml(repo)}.git</code></pre>
        </div>
        <div class="card">
          <h3>📦 Releases</h3>
          <p>如果后续提供打包资源（模型/数据/场地等），会优先放到 Releases。</p>
          <a href="${releasesUrl}" target="_blank" rel="noopener noreferrer">打开 Releases</a>
        </div>
        <div class="card">
          <h3>🔗 GitHub 仓库</h3>
          <p>查看目录结构、历史提交、Issue/PR、以及最完整的更新说明。</p>
          <a href="${repoUrl}" target="_blank" rel="noopener noreferrer">打开仓库</a>
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
        el.textContent = "生成下载入口失败，请稍后重试。";
      }
    });
  });
})();

