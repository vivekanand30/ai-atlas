// Shared helpers for the AI Map and roles pages.
(() => {
  const { tools, categories } = window.ATLAS;
  const byId = Object.fromEntries(tools.map((t) => [t.id, t]));
  const catById = Object.fromEntries(categories.map((c) => [c.id, c]));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function avatar(t, size = "") {
    const letter = esc(t.name[0]);
    if (!t.repo) return `<span class="avatar ${size}">${letter}</span>`;
    const owner = t.repo.split("/")[0];
    return `<span class="avatar ${size}"><img loading="lazy" alt="" src="https://github.com/${esc(owner)}.png?size=80" onerror="this.replaceWith(document.createTextNode('${letter}'))"></span>`;
  }
  // A tool chip linking to its detail panel on the Atlas page.
  const toolChip = (id) => {
    const t = byId[id];
    return `<a class="tool-chip" href="index.html#tool=${t.id}">${avatar(t, "xs")}<span>${esc(t.name)}</span></a>`;
  };

  const store = {
    get(k, fallback) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return fallback; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };

  const root = document.documentElement;
  try { const saved = localStorage.getItem("theme"); if (saved) root.dataset.theme = saved; } catch {}
  document.getElementById("theme-toggle")?.addEventListener("click", () => {
    const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    root.dataset.theme = dark ? "light" : "dark";
    try { localStorage.setItem("theme", root.dataset.theme); } catch {}
  });

  window.UI = { byId, catById, esc, avatar, toolChip, store };
})();
