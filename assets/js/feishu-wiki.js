(function () {
  const BOOTSTRAP_FLAG = "__LocoWikiFeishuWikiBootstrapped";
  if (window[BOOTSTRAP_FLAG]) return;
  window[BOOTSTRAP_FLAG] = true;

  const EMBED_TIMEOUT_MS = 12000;
  const FALLBACK_FEISHU_URL =
    "https://wcn9j5638vrr.feishu.cn/wiki/space/7570988375279517715?ccm_open_type=lark_wiki_spaceLink&open_tab_from=wiki_home";

  function formatTime(isoString) {
    if (!isoString) return "尚未同步";
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return isoString;
    return d.toLocaleString("zh-CN", { hour12: false });
  }

  function setNotice(kind, text) {
    const notice = document.getElementById("embed-notice");
    if (!notice) return;
    notice.className = kind === "error" ? "error" : "loading";
    notice.textContent = text;
  }

  function withCacheBuster(url) {
    try {
      const u = new URL(url, window.location.href);
      u.searchParams.set("_ts", Date.now().toString());
      return u.toString();
    } catch {
      return url;
    }
  }

  async function loadSyncStatus(statusUrl) {
    const textEl = document.getElementById("sync-status-text");
    const detailEl = document.getElementById("sync-status-detail");
    if (!textEl || !detailEl) return;

    try {
      const res = await fetch(statusUrl, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const hasSyncTime = Boolean(data.lastSyncAt);
      textEl.textContent = hasSyncTime ? `最近同步：${formatTime(data.lastSyncAt)}` : "暂无自动同步记录";
      detailEl.textContent = data.message || "状态面板仅展示最近一次同步记录。";
    } catch (err) {
      console.error(err);
      textEl.textContent = "未配置自动同步";
      detailEl.textContent = "如需启用自动同步，请查看仓库 docs/feishu-sync.md。";
    }
  }

  function initFrame(feishuUrl) {
    const frame = document.getElementById("feishu-frame");
    if (!frame) return;

    let loaded = false;
    const timeout = window.setTimeout(() => {
      if (loaded) return;
      setNotice("error", "内嵌加载超时。请点击上方按钮在新标签页打开飞书知识库。");
    }, EMBED_TIMEOUT_MS);

    frame.addEventListener(
      "load",
      () => {
        loaded = true;
        window.clearTimeout(timeout);
        setNotice("loading", "知识库页面已加载。如果看到登录页或空白，请改用新标签页打开。");
      },
      { once: true },
    );

    frame.addEventListener(
      "error",
      () => {
        loaded = true;
        window.clearTimeout(timeout);
        setNotice("error", "当前浏览器阻止了内嵌加载，请点击上方按钮打开原页面。");
      },
      { once: true },
    );

    frame.src = feishuUrl;
  }

  async function init() {
    const config = await window.LocoWikiSite.getConfig();
    const feishuUrl = config?.links?.feishu || FALLBACK_FEISHU_URL;
    const syncStatusUrl =
      config?.integrations?.feishuWiki?.syncStatusUrl ||
      config?.integrations?.readmydock?.syncStatusUrl ||
      "assets/feishu-sync-status.json";

    const link = document.getElementById("open-feishu-link");
    if (link) link.href = feishuUrl;

    const reloadBtn = document.getElementById("reload-feishu");
    if (reloadBtn) {
      reloadBtn.addEventListener("click", () => {
        const frame = document.getElementById("feishu-frame");
        if (!frame) return;
        setNotice("loading", "正在刷新内嵌视图…");
        frame.src = withCacheBuster(feishuUrl);
      });
    }

    setNotice("loading", "正在尝试加载飞书知识库…");
    initFrame(feishuUrl);
    await loadSyncStatus(syncStatusUrl);
  }

  function bootstrap() {
    init().catch((err) => {
      console.error(err);
      setNotice("error", "飞书知识库页面初始化失败，请稍后重试。");
    });
  }

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", bootstrap, { once: true });
  } else {
    bootstrap();
  }
})();
