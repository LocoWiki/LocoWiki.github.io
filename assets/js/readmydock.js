(function () {
  const BOOTSTRAP_FLAG = "__LocoWikiFeishuWikiBootstrapped";
  if (window[BOOTSTRAP_FLAG]) return;

  const NEW_SCRIPT_SRC = "assets/js/feishu-wiki.js";
  const existing = Array.from(document.scripts || []).some((script) => {
    const src = script.getAttribute("src") || "";
    return src.endsWith("/assets/js/feishu-wiki.js") || src === NEW_SCRIPT_SRC;
  });
  if (existing) return;

  const script = document.createElement("script");
  script.src = NEW_SCRIPT_SRC;
  script.defer = true;
  script.setAttribute("data-compat-alias", "readmydock");

  const current = document.currentScript;
  if (current && current.nonce) script.nonce = current.nonce;

  document.head.appendChild(script);
})();
