(function () {
  const CONFIG_URL = "assets/site-config.json";
  const THEME_KEY = "leggedwiki_theme";

  let configPromise;

  function isString(value) {
    return typeof value === "string";
  }

  async function getConfig() {
    if (!configPromise) {
      configPromise = fetch(CONFIG_URL, { cache: "no-store" }).then((res) => {
        if (!res.ok) throw new Error(`Failed to load ${CONFIG_URL}: ${res.status}`);
        return res.json();
      });
    }
    return configPromise;
  }

  function getPreferredTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "dark" || saved === "light") return saved;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
    const btn = document.getElementById("theme-toggle");
    if (btn) btn.setAttribute("aria-label", theme === "dark" ? "切换为浅色" : "切换为深色");
  }

  function initTheme() {
    applyTheme(getPreferredTheme());
    document.addEventListener("click", (e) => {
      const target = e.target instanceof Element ? e.target.closest("#theme-toggle") : null;
      if (!target) return;
      const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      applyTheme(next);
    });
  }

  function normalizePathname(pathname) {
    if (!isString(pathname)) return "/";
    const q = pathname.split("?")[0].split("#")[0];
    return q.endsWith("/") ? `${q}index.html` : q;
  }

  function setActiveNav(container) {
    const current = normalizePathname(window.location.pathname);
    const links = container.querySelectorAll("a[data-nav]");
    links.forEach((a) => {
      const href = a.getAttribute("href") || "";
      const normalized = normalizePathname(new URL(href, window.location.href).pathname);
      if (normalized === current) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
  }

  function renderHeader(config) {
    const header = document.getElementById("site-header");
    if (!header) return;

    const navItems = Array.isArray(config.nav) ? config.nav : [];
    header.className = "topbar";
    header.innerHTML = `
      <div class="topbar-inner">
        <a class="brand" href="index.html" aria-label="${escapeHtml(config?.site?.title || "LeggedWiki")}">
          <img src="assets/img/icon.svg" alt="" />
          <span>${escapeHtml(config?.site?.title || "LeggedWiki")}</span>
        </a>
        <div class="spacer"></div>
        <nav class="nav" aria-label="主导航">
          ${navItems
            .map(
              (it) =>
                `<a data-nav href="${escapeAttr(it.href)}">${escapeHtml(it.title || "")}</a>`,
            )
            .join("")}
        </nav>
        <button class="icon-btn" id="theme-toggle" type="button" aria-label="切换主题">
          <span class="kdb">T</span>
          <span>主题</span>
        </button>
        <a id="github-link" class="icon-btn" href="${escapeAttr(
          config?.links?.repo || "#",
        )}" target="_blank" rel="noopener noreferrer">
          <span class="kdb">GitHub</span>
        </a>
      </div>
    `;

    setActiveNav(header);
  }

  function renderSidebar(config) {
    const sidebar = document.getElementById("site-sidebar");
    if (!sidebar) return;

    const groups = Array.isArray(config.sidebar) ? config.sidebar : [];
    sidebar.className = "sidebar";
    sidebar.innerHTML = groups
      .map((g) => {
        const items = Array.isArray(g.items) ? g.items : [];
        return `
          <section>
            <h3>${escapeHtml(g.title || "")}</h3>
            ${items
              .map((it) => {
                const path = it.path || "";
                const href = `docs.html?path=${encodeURIComponent(path)}`;
                return `<a data-doc-link href="${href}" data-doc-path="${escapeAttr(path)}">${escapeHtml(
                  it.title || "",
                )}</a>`;
              })
              .join("")}
          </section>
        `;
      })
      .join("");
  }

  function renderFooter(config) {
    const footer = document.getElementById("site-footer");
    if (!footer) return;
    footer.className = "footer";

    const year = new Date().getFullYear();
    footer.innerHTML = `
      <div class="footer-inner">
        <div>© ${year} ${escapeHtml(config?.site?.title || "LeggedWiki")} · MIT License</div>
        <div>
          <a href="${escapeAttr(config?.links?.issues || "#")}" target="_blank" rel="noopener noreferrer">Issues</a>
          ·
          <a href="${escapeAttr(config?.links?.discussions || "#")}" target="_blank" rel="noopener noreferrer">Discussions</a>
        </div>
      </div>
    `;
  }

  function highlightActiveDocLink() {
    const sidebar = document.getElementById("site-sidebar");
    if (!sidebar) return;
    const params = new URLSearchParams(window.location.search);
    const path = params.get("path") || "";
    const links = sidebar.querySelectorAll("a[data-doc-link]");
    links.forEach((a) => {
      const p = a.getAttribute("data-doc-path") || "";
      a.dataset.active = p === path ? "true" : "false";
    });
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function escapeAttr(str) {
    return escapeHtml(str).replaceAll("`", "&#96;");
  }

  async function init() {
    const config = await getConfig();
    renderHeader(config);
    renderSidebar(config);
    renderFooter(config);
    initTheme();
    highlightActiveDocLink();
  }

  window.LeggedWikiSite = {
    getConfig,
    escapeHtml,
  };

  window.addEventListener("DOMContentLoaded", () => {
    init().catch((err) => {
      // Keep the site usable even if config load fails.
      console.error(err);
      initTheme();
    });
  });
})();
