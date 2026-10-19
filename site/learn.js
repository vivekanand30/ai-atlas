(() => {
  const { roadmap, stacks } = window.ATLAS;
  const { esc, toolChip, store } = window.UI;
  const $ = (s) => document.querySelector(s);
  const nodes = roadmap.nodes;
  const nodeById = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const order = Object.fromEntries(nodes.map((n, i) => [n.id, i + 1]));
  const prevOf = Object.fromEntries(nodes.map((n) => [n.id, nodes.filter((m) => (m.next || []).includes(n.id)).map((m) => m.id)]));
  const KEY = "atlas-map-done";
  let done = new Set(store.get(KEY, []));

  // ---------- big picture ----------
  const NEST = [["ai", "Artificial Intelligence", "rules → learning"], ["ml", "Machine Learning", "learns from examples"], ["dl", "Deep Learning", "many-layer networks"], ["llm", "Large Language Models", "transformers at scale"]];
  const nestHtml = (i) => i >= NEST.length ? "" :
    `<div class="nest-box n${i}" data-node="${NEST[i][0]}" role="button" tabindex="0"><span class="nest-label"><strong>${NEST[i][1]}</strong><small>${NEST[i][2]}</small></span>${nestHtml(i + 1)}</div>`;
  $("#nest").innerHTML = nestHtml(0);

  const LAYERS = [
    ["you", "🧑", "You", "Set the goal, review the result", null],
    ["skills", "🪄", "Skills & plugins", "Know-how: how to do this job well", "skills"],
    ["agents", "🔁", "Agent loop", "Plan → act → check → repeat", "agents"],
    ["mcp", "🔌", "Tools via MCP", "Hands: files, browsers, apps, data", "mcp"],
    ["rag", "📚", "Your context", "Docs and memory it can look up", "rag"],
    ["llm", "🧠", "The model (LLM)", "The brain: reads, reasons, writes", "llm"],
  ];
  $("#layers").innerHTML = LAYERS.map(([cls, icon, title, sub, node]) =>
    `<${node ? `button data-node="${node}"` : "div"} class="layer layer-${cls}"><span class="layer-icon">${icon}</span><span><strong>${title}</strong><small>${sub}</small></span></${node ? "button" : "div"}>`).join("");

  // ---------- roadmap ----------
  function renderMap() {
    $("#roadmap").innerHTML = roadmap.phases.map((p, pi) => {
      const items = nodes.filter((n) => n.phase === p.id);
      return `<section class="phase" id="phase-${p.id}">
        <header class="phase-head"><span class="phase-num">Phase ${pi + 1}</span><h2>${esc(p.title)}</h2><p>${esc(p.subtitle)} · <span class="muted">${esc(p.era)}</span></p></header>
        <ol class="nodes">${items.map((n) => `<li class="node-row">
          <button class="node${done.has(n.id) ? " is-done" : ""}" data-node="${n.id}">
            <span class="node-num">${done.has(n.id) ? "✓" : order[n.id]}</span>
            <span class="node-text"><strong>${esc(n.title)}</strong>${n.era ? `<small>${esc(n.era)}</small>` : ""}</span>
          </button></li>`).join("")}</ol>
      </section>`;
    }).join("");
    const count = nodes.filter((n) => done.has(n.id)).length;
    $("#progress-fill").style.width = `${(100 * count) / nodes.length}%`;
    $("#progress-text").textContent = `${count} of ${nodes.length} understood`;
    $("#progress-reset").hidden = count === 0;
  }

  // ---------- drawer ----------
  let current = null;
  function open(id) {
    const n = nodeById[id];
    if (!n) return;
    current = id;
    const stack = n.stack && stacks.find((s) => s.id === n.stack);
    const nav = (ids, label) => ids.length ? `<div class="d-nav"><span>${label}</span>${ids.map((x) => `<button class="chip" data-node="${x}">${esc(nodeById[x].title)}</button>`).join("")}</div>` : "";
    $("#drawer").innerHTML = `
      <div class="d-head">
        <div><div class="kicker">Stop ${order[id]} of ${nodes.length}${n.era ? ` · ${esc(n.era)}` : ""}</div><h2>${esc(n.title)}</h2></div>
        <button class="close-btn" data-close aria-label="Close">×</button>
      </div>
      <div class="d-body">
        <h3>What it is</h3><p>${esc(n.what)}</p>
        <h3>How it fits</h3><p>${esc(n.fits)}</p>
        ${n.analogy ? `<div class="analogy">💡 ${esc(n.analogy)}</div>` : ""}
        ${n.try ? `<div class="try-box"><div class="verdict-label">Try it</div>${esc(n.try)}</div>` : ""}
        ${n.tools?.length ? `<h3>Tools on the Atlas</h3><div class="chips">${n.tools.map(toolChip).join("")}</div>` : ""}
        ${stack ? `<a class="learn" href="index.html#stack=${stack.id}"><span>${stack.emoji}</span><span>Recommended stack: ${esc(stack.title)}</span><span class="arrow">→</span></a>` : ""}
        ${n.resource ? `<h3>Best single resource</h3><a class="learn" href="${esc(n.resource.url)}" target="_blank" rel="noopener"><span>📖</span><span>${esc(n.resource.title)}</span><span class="arrow">↗</span></a>` : ""}
        ${nav(prevOf[id], "Builds on")}
        ${nav(n.next || [], "Next")}
      </div>
      <div class="d-foot">
        <label class="check"><input type="checkbox" id="done-box" ${done.has(id) ? "checked" : ""}> I understand this</label>
        ${n.next?.length ? `<button class="btn btn-primary" data-node="${n.next[0]}">Next: ${esc(nodeById[n.next[0]].title)} →</button>` : `<a class="btn btn-primary" href="roles.html">Pick your role →</a>`}
      </div>`;
    $("#drawer").hidden = false;
    $("#scrim").hidden = false;
    $("#drawer").scrollTop = 0;
    history.replaceState(null, "", `#node=${id}`);
    document.querySelectorAll(".node").forEach((b) => b.classList.toggle("is-active", b.dataset.node === id));
  }
  function close() {
    current = null;
    $("#drawer").hidden = true;
    $("#scrim").hidden = true;
    history.replaceState(null, "", location.pathname);
    document.querySelectorAll(".node.is-active").forEach((b) => b.classList.remove("is-active"));
  }

  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-node],[data-close]");
    if (el?.dataset.node) { e.preventDefault(); return open(el.dataset.node); }
    if (el && "close" in el.dataset) return close();
    if (e.target === $("#scrim")) close();
  });
  document.addEventListener("change", (e) => {
    if (e.target.id !== "done-box" || !current) return;
    e.target.checked ? done.add(current) : done.delete(current);
    store.set("atlas-map-done", [...done]);
    renderMap();
    document.querySelector(`.node[data-node="${current}"]`)?.classList.add("is-active");
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && current) close();
    if ((e.key === "Enter" || e.key === " ") && e.target.matches?.('[role="button"][data-node]')) { e.preventDefault(); open(e.target.dataset.node); }
  });
  $("#progress-reset").addEventListener("click", () => { done = new Set(); store.set(KEY, []); renderMap(); });

  renderMap();
  const fromHash = new URLSearchParams(location.hash.slice(1)).get("node");
  if (fromHash) open(fromHash);
})();
