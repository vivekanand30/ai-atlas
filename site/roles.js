(() => {
  const { roles, roadmap } = window.ATLAS;
  const { byId, esc, avatar } = window.UI;
  const $ = (s) => document.querySelector(s);
  const nodeById = Object.fromEntries(roadmap.nodes.map((n) => [n.id, n]));
  let current = null;

  function renderGrid() {
    $("#role-grid").innerHTML = roles.map((r) => `
      <button class="role-card" data-role="${r.id}" aria-pressed="${current === r.id}">
        <span class="role-emoji">${r.emoji}</span>
        <strong>${esc(r.title)}</strong>
        <small>${esc(r.who)}</small>
      </button>`).join("");
  }

  function item(it) {
    const t = it.tool && byId[it.tool];
    const name = t ? t.name : it.name;
    const href = t ? `index.html#tool=${t.id}` : it.url;
    const ext = t ? "" : ' target="_blank" rel="noopener"';
    const av = t ? avatar(t) : `<span class="avatar">${esc(name[0])}</span>`;
    return `<a class="role-item" href="${esc(href)}"${ext}>
      ${av}
      <span class="ri-body"><span class="ri-top"><strong>${esc(name)}</strong><span class="kind kind-${esc(it.kind.toLowerCase())}">${esc(it.kind)}</span>${t ? "" : '<span class="muted">↗</span>'}</span>
      <span class="ri-why">${esc(it.why)}</span></span>
    </a>`;
  }

  function renderDetail() {
    const r = roles.find((x) => x.id === current);
    const d = $("#role-detail");
    if (!r) { d.hidden = true; d.innerHTML = ""; return; }
    d.hidden = false;
    d.innerHTML = `
      <header class="rd-head">
        <span class="rd-emoji">${r.emoji}</span>
        <div><h2>${esc(r.title)}</h2><p class="muted">${esc(r.who)}</p></div>
        <button class="close-btn" data-role-close aria-label="Close">×</button>
      </header>
      <div class="verdict"><div class="verdict-label">Mindset</div>${esc(r.mindset)}</div>
      <div class="levels">${r.levels.map((l, i) => `
        <section class="level">
          <h3><span class="level-num">${i + 1}</span>${esc(l.label)}</h3>
          <div class="level-items">${l.items.map(item).join("")}</div>
        </section>`).join("")}
      </div>
      <div class="watch-out"><strong>Watch out</strong><p>${esc(r.watchOut)}</p></div>
      ${r.concepts?.length ? `<div class="concepts"><span>Concepts worth knowing</span>${r.concepts.map((id) => `<a class="chip" href="learn.html#node=${id}">${esc(nodeById[id].title)}</a>`).join("")}</div>` : ""}`;
  }

  function select(id) {
    current = current === id ? null : id;
    renderGrid();
    renderDetail();
    history.replaceState(null, "", current ? `#role=${current}` : location.pathname);
    if (current) $("#role-detail").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-role],[data-role-close]");
    if (!el) return;
    if ("roleClose" in el.dataset) return select(current);
    select(el.dataset.role);
  });

  const fromHash = new URLSearchParams(location.hash.slice(1)).get("role");
  if (roles.some((r) => r.id === fromHash)) current = fromHash;
  renderGrid();
  renderDetail();
})();
