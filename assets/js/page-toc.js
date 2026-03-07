(function () {
  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === "function") return window.CSS.escape(value);
    return String(value).replace(/["\\]/g, "\\$&");
  }

  function ensureHeadingIds(headings) {
    const used = new Set(Array.from(document.querySelectorAll("[id]")).map((el) => el.id));
    let counter = 0;

    headings.forEach((h) => {
      if (h.id) return;
      const text = (h.textContent || "").trim();
      let slug = text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, "-")
        .replace(/^-+|-+$/g, "");
      if (!slug) slug = `section-${counter++}`;

      let candidate = slug;
      let i = 2;
      while (used.has(candidate)) {
        candidate = `${slug}-${i++}`;
      }
      h.id = candidate;
      used.add(candidate);
    });
  }

  function isInsideCards(heading) {
    return Boolean(heading.closest(".cards"));
  }

  function pickHeadings(container) {
    const raw = Array.from(container.querySelectorAll("h2, h3"));
    return raw.filter((h) => !isInsideCards(h));
  }

  function renderToc(headings) {
    const tocRoot = document.getElementById("toc-items");
    if (!tocRoot) return;
    tocRoot.innerHTML = "";

    if (!headings.length) {
      tocRoot.innerHTML = `<div style="color: var(--muted); font-size: 13px;">无</div>`;
      return;
    }

    headings.forEach((h) => {
      const level = h.tagName === "H3" ? 1 : 0;
      const a = document.createElement("a");
      a.href = `#${encodeURIComponent(h.id)}`;
      a.textContent = (h.textContent || "").trim();
      a.style.paddingLeft = `${8 + level * 12}px`;
      tocRoot.appendChild(a);
    });
  }

  function scrollToHash() {
    if (!window.location.hash) return;
    const id = decodeURIComponent(window.location.hash.slice(1));
    const el = document.getElementById(id) || document.querySelector(`[name="${cssEscape(id)}"]`);
    if (!el) return;
    el.scrollIntoView();
  }

  function init() {
    const container = document.querySelector("main.content") || document.querySelector(".content");
    if (!container) return;

    const headings = pickHeadings(container);
    ensureHeadingIds(headings);
    renderToc(headings);
    scrollToHash();

    window.addEventListener("hashchange", () => scrollToHash());
  }

  window.addEventListener("DOMContentLoaded", init);
})();

