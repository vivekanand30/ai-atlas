(() => {
  const { tools, categories, stacks, concepts, watchlist, reviews } = window.ATLAS;
  const reviewByTool = Object.fromEntries(reviews.filter((r) => r.tool).map((r) => [r.tool, r]));
  const $ = (s) => document.querySelector(s);
  const byId = Object.fromEntries(tools.map((t) => [t.id, t]));
  const catById = Object.fromEntries(categories.map((c) => [c.id, c]));
  const REPO = "https://github.com/vivekanand30/ai-atlas";

  const PRICING = [["all", "All"], ["oss", "Open source"], ["free", "Free"], ["freemium", "Free tier"], ["paid", "Paid"]];
  const PRICE_LABEL = { oss: "Open source", free: "Free", freemium: "Free tier", paid: "Paid" };
  const LANG_LABEL = { python: "Python", typescript: "TypeScript", go: "Go", rust: "Rust", cpp: "C++", c: "C", csharp: "C#", java: "Java", swift: "Swift", svelte: "Svelte" };

  // ---------- search engine ----------
  // Layer 1: BM25 + prefix + typo tolerance (MiniSearch).
  // Layer 2: concept expansion from data/concepts.json, weighted lower than direct hits.
  // Layer 3: coverage — tools matching more of the user's words rank higher.
  const STOP = new Set("a an the to for with my of and or in on at by from is are be i me we want need how best good tool tools using use build make create get do some something like that this which ai".split(" "));
  const stem = (w) => (w.length > 4 && w.endsWith("ies") ? w.slice(0, -3) + "y" : w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w);
  const processTerm = (term) => { const w = term.toLowerCase(); return STOP.has(w) ? null : stem(w); };
  const searchOpts = { combineWith: "OR", prefix: (t) => t.length > 2, fuzzy: (t) => (t.length > 4 ? 0.2 : false) };

  const engine = new MiniSearch({
    fields: ["name", "bestFor", "tags", "description", "why"],
    storeFields: ["id"],
    processTerm,
    extractField: (doc, f) => {
      if (f === "bestFor") return doc.bestFor.join(" · ");
      if (f === "tags") return [...doc.tags, catById[doc.category].name, PRICE_LABEL[doc.pricing], ...doc.languages].join(" ");
      return doc[f];
    },
    searchOptions: { ...searchOpts, boost: { name: 5, bestFor: 3, tags: 2.5, description: 1.2, why: 1 } },
  });
  engine.addAll(tools);

  const stackEngine = new MiniSearch({
    fields: ["title", "goal", "keywords"], storeFields: ["id"], processTerm,
    extractField: (d, f) => (f === "keywords" ? d.keywords.join(" · ") : d[f]),
    searchOptions: { ...searchOpts, boost: { keywords: 3, title: 2 } },
  });
  stackEngine.addAll(stacks);

  // Watchlist gets its own index so matches can be shown, clearly labelled, below the recommendations.
  const watchEngine = new MiniSearch({
    fields: ["name", "pitch", "cat"], storeFields: ["id"], processTerm,
    extractField: (d, f) => (f === "cat" ? catById[d.category].name : d[f]),
    searchOptions: { ...searchOpts, boost: { name: 5, pitch: 2, cat: 1.5 } },
  });
  watchEngine.addAll(watchlist);

  const tokenize = (q) => q.toLowerCase().split(/[^\w#+.-]+/).map((w) => w.replace(/^[.-]+|[.-]+$/g, "")).filter((w) => w && !STOP.has(w));
  const expansionsOf = (w) => concepts[w] || concepts[stem(w)] || concepts[w.replace(/-/g, "")] || [];

  // Returns { scores: Map(id -> score), covered: Map(id -> Set(word)), terms: Map(id -> Set(matched doc terms)) }
  function runSearch(eng, words) {
    const scores = new Map(), covered = new Map(), terms = new Map();
    for (const w of words) {
      const best = new Map();
      for (const r of eng.search(w)) best.set(r.id, { s: r.score, terms: r.terms });
      for (const e of expansionsOf(w)) {
        for (const r of eng.search(e)) {
          const s = r.score * 0.45;
          if (!best.has(r.id)) best.set(r.id, { s, terms: [] }); // expansions rank, but aren't highlighted
          else if (best.get(r.id).s < s) best.get(r.id).s = s;
        }
      }
      for (const [id, { s, terms: tm }] of best) {
        scores.set(id, (scores.get(id) || 0) + s);
        (covered.get(id) || covered.set(id, new Set()).get(id)).add(w);
        const set = terms.get(id) || terms.set(id, new Set()).get(id);
        tm.forEach((x) => set.add(x));
      }
    }
    return { scores, covered, terms };
  }

  // Phrase bonus: adjacent query words appearing together in a tool's text ("prompt injection").
  const phraseText = Object.fromEntries(tools.map((t) => [t.id, " " + [t.name, ...t.bestFor, t.why, t.description].join(" ").toLowerCase().replace(/[^\w]+/g, " ") + " "]));
  function phraseBonus(id, words) {
    let bonus = 1;
    for (let i = 0; i < words.length - 1; i++) {
      if (phraseText[id].includes(` ${stem(words[i])}`) && new RegExp(`\\b${escapeRe(stem(words[i]))}\\w* ${escapeRe(stem(words[i + 1]))}`).test(phraseText[id])) bonus *= 1.6;
    }
    return bonus;
  }

  function searchTools(words) {
    const { scores, covered, terms } = runSearch(engine, words);
    const ranked = [...scores].map(([id, s]) => {
      const cov = covered.get(id).size / words.length;
      return { id, score: s * cov * cov * phraseBonus(id, words) * (byId[id].pick ? 1.08 : 1), cov };
    }).sort((a, b) => b.score - a.score);
    const top = ranked[0]?.score || 0;
    const kept = ranked.filter((r) => r.score >= top * 0.12);
    const unmatched = words.filter((w) => ![...covered.values()].some((set) => set.has(w)));
    return { ranked: kept, terms, unmatched };
  }

  function suggestStack(words) {
    if (!words.length) return null;
    const { scores, covered } = runSearch(stackEngine, words);
    let best = null;
    for (const [id, s] of scores) {
      const cov = covered.get(id).size / words.length;
      if (cov >= 0.5 && (!best || s * cov > best.v)) best = { id, v: s * cov };
    }
    return best && stacks.find((s) => s.id === best.id);
  }

  // ---------- state ----------
  const state = { q: "", cat: "all", pricing: "all", lang: "all", stack: null };

  function filtered() {
    const words = tokenize(state.q);
    const pass = (t) => (state.cat === "all" || t.category === state.cat)
      && (state.pricing === "all" || t.pricing === state.pricing)
      && (state.lang === "all" || t.languages.includes(state.lang));
    if (!words.length) return { list: tools.filter(pass), words, terms: new Map(), unmatched: [] };
    const { ranked, terms, unmatched } = searchTools(words);
    return { list: ranked.map((r) => byId[r.id]).filter(pass), ranked, words, terms, unmatched };
  }

  // ---------- rendering ----------
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  function highlight(text, termSet) {
    const html = esc(text);
    if (!termSet || !termSet.size) return html;
    const re = new RegExp(`\\b(${[...termSet].filter((t) => t.length > 1).map(escapeRe).join("|")})[\\w-]*`, "gi");
    return html.replace(re, "<mark>$&</mark>");
  }
  function avatar(t, size = "") {
    const letter = esc(t.name[0]);
    if (!t.repo) return `<span class="avatar ${size}">${letter}</span>`;
    const owner = t.repo.split("/")[0];
    return `<span class="avatar ${size}"><img loading="lazy" alt="" src="https://github.com/${esc(owner)}.png?size=80" onerror="this.replaceWith(document.createTextNode('${letter}'))"></span>`;
  }
  function card(t, terms) {
    const uses = t.bestFor.slice(0, 2).map((x) => `<span class="use">${highlight(x, terms)}</span>`).join("");
    return `<article class="card${t.pick ? " is-pick" : ""}" tabindex="0" data-tool="${t.id}">
      ${t.pick ? `<span class="pick-badge">★ Editor's pick</span>` : ""}
      <div class="card-top">${avatar(t)}<div class="card-id"><div class="card-title">${highlight(t.name, terms)}</div>
        <div class="card-cat">${catById[t.category].emoji} ${esc(catById[t.category].name)} · <span class="price-txt price-${t.pricing}">${PRICE_LABEL[t.pricing]}</span></div></div></div>
      <p class="card-why">${highlight(t.why, terms)}</p>
      <div class="uses">${uses}</div>
    </article>`;
  }

  function watchCard(w) {
    const c = catById[w.category];
    return `<article class="watch-card">
      <span class="watch-badge">👀 Watchlist</span>
      <div class="watch-top"><a href="${esc(w.url)}" target="_blank" rel="noopener"><strong>${esc(w.name)}</strong> ↗</a>
        <span class="card-cat">${c.emoji} ${esc(c.name)} · revisit ${esc(w.revisit)}</span></div>
      <p>${esc(w.pitch)}</p>
      <dl><dt>Holding it back</dt><dd>${esc(w.holdingBack)}</dd><dt>Promote if</dt><dd>${esc(w.promoteIf)}</dd></dl>
    </article>`;
  }
  function watchSection(items) {
    if (!items.length) return "";
    return `<section class="cat-section watch-section" id="watchlist">
      <header class="cat-head"><h2>👀 Watchlist</h2><span class="cat-count">${items.length}</span></header>
      <p class="cat-blurb">Promising, not proven yet. These are <strong>not recommendations</strong>; each is re-reviewed on its revisit date.</p>
      <div class="grid">${items.map(watchCard).join("")}</div></section>`;
  }
  // Returns the matching watchlist entries plus the query words they matched.
  function watchMatches(words) {
    if (!words.length) return { items: [], matched: new Set() };
    const { scores, covered } = runSearch(watchEngine, words);
    const hits = [...scores]
      .filter(([id]) => covered.get(id).size / words.length >= 0.5)
      .filter(([id]) => state.cat === "all" || watchlist.find((w) => w.id === id).category === state.cat)
      .sort((a, b) => b[1] - a[1]);
    const matched = new Set(hits.flatMap(([id]) => [...covered.get(id)]));
    return { items: hits.map(([id]) => watchlist.find((w) => w.id === id)), matched };
  }
  function watchResults(items, standalone) {
    if (!items.length) return "";
    return `<section class="watch-results">
      <header class="watch-results-head"><h3>👀 ${standalone ? "Found on the watchlist" : "Also on the watchlist"}</h3>
        <span>Promising, but <strong>not yet recommended</strong>. Check what's holding each one back.</span></header>
      <div class="grid">${items.map(watchCard).join("")}</div></section>`;
  }

  function renderIntents() {
    $("#stacks-anchor").innerHTML = stacks.map((s) =>
      `<button class="intent" role="listitem" data-stack="${s.id}" aria-pressed="${state.stack === s.id}">${s.emoji} ${esc(s.title)}</button>`).join("");
  }

  function renderStack() {
    const view = $("#stack-view");
    const s = stacks.find((x) => x.id === state.stack);
    if (!s) { view.hidden = true; view.innerHTML = ""; return; }
    view.hidden = false;
    view.innerHTML = `<div class="stack-card">
      <div class="stack-head">
        <div><div class="stack-kicker">Recommended stack</div><h2>${s.emoji} ${esc(s.title)}</h2><p>${esc(s.goal)}</p></div>
        <button class="close-btn" data-close-stack aria-label="Close stack">×</button>
      </div>
      <ol class="pipeline">${s.steps.map((step, i) => `
        <li class="step">
          <div class="step-num">${i + 1}</div>
          <h4>${esc(step.label)}</h4>
          <p>${esc(step.why)}</p>
          <div class="picks">${step.picks.map((id, j) => {
            const t = byId[id];
            return `<button class="pick${j === 0 ? " is-default" : ""}" data-tool="${id}">${avatar(t, "xs")}<span>${esc(t.name)}</span>${j === 0 ? '<span class="default">default</span>' : ""}</button>`;
          }).join("")}</div>
        </li>`).join("")}
      </ol>
    </div>`;
  }

  function renderFilters() {
    const counts = {};
    for (const t of tools) counts[t.category] = (counts[t.category] || 0) + 1;
    $("#cat-list").innerHTML =
      `<li><button class="cat-btn" data-cat="all" aria-pressed="${state.cat === "all"}">✨ Everything<span class="n">${tools.length}</span></button></li>` +
      categories.map((c) => `<li><button class="cat-btn" data-cat="${c.id}" aria-pressed="${state.cat === c.id}">${c.emoji} ${esc(c.name)}<span class="n">${counts[c.id] || 0}</span></button></li>`).join("");
    $("#pricing-seg").innerHTML = PRICING.map(([v, l]) => `<button data-pricing="${v}" aria-pressed="${state.pricing === v}">${l}</button>`).join("");
    const langs = [...new Set(tools.flatMap((t) => t.languages))].sort();
    $("#lang-select").innerHTML = `<option value="all">Any language</option>` +
      langs.map((l) => `<option value="${l}" ${state.lang === l ? "selected" : ""}>${LANG_LABEL[l] || l}</option>`).join("");
  }

  function renderResults() {
    const { list, words, terms, unmatched } = filtered();
    const active = state.q || state.cat !== "all" || state.pricing !== "all" || state.lang !== "all";
    $("#clear").hidden = !active;

    const { items: watched, matched: watchWords } = watchMatches(words);
    const qLabel = `“${esc(state.q.trim())}”`;
    let meta = !words.length ? `<strong>${list.length}</strong> hand-picked tools`
      : list.length ? `<strong>${list.length}</strong> result${list.length === 1 ? "" : "s"} for ${qLabel}, closest first`
      : `No recommended tools for ${qLabel}`;
    if (watched.length) meta += ` · ${watched.length} on the watchlist`;
    const stillUnmatched = unmatched.filter((w) => !watchWords.has(w));
    if (stillUnmatched.length) meta += ` · <span class="muted">no match for ${stillUnmatched.map((w) => `“${esc(w)}”`).join(", ")}</span>`;
    $("#results-meta").innerHTML = meta;

    const suggestion = suggestStack(words);
    const sug = $("#suggest");
    if (suggestion && suggestion.id !== state.stack) {
      sug.hidden = false;
      sug.dataset.stack = suggestion.id;
      sug.innerHTML = `<span class="sug-emoji">${suggestion.emoji}</span><div><div class="sug-kicker">There's a recommended stack for this</div><strong>${esc(suggestion.title)}</strong></div><span class="go">See the stack →</span>`;
    } else sug.hidden = true;

    const out = $("#results");
    if (!list.length && watched.length) {
      out.innerHTML = `<p class="muted soft-empty">Nothing on the recommended shortlist matches, but the watchlist does:</p>${watchResults(watched, true)}`;
      return;
    }
    if (!list.length) {
      out.innerHTML = `<div class="empty"><div class="empty-ico">🔭</div><p><strong>Nothing on the shortlist fits that yet.</strong></p>
        <p>Try fewer or different words, or browse a stack above. Know a tool that clears the <a href="${REPO}/blob/main/CURATION.md">bar</a>? <a href="${REPO}/issues/new?template=add-tool.yml">Nominate it</a>.</p></div>`;
      return;
    }
    if (words.length) {
      out.innerHTML = `<div class="grid">${list.map((t) => card(t, terms.get(t.id))).join("")}</div>${watchResults(watched, false)}`;
      return;
    }
    out.innerHTML = categories
      .map((c) => ({ c, items: list.filter((t) => t.category === c.id).sort((a, b) => (b.pick ? 1 : 0) - (a.pick ? 1 : 0)) }))
      .filter((g) => g.items.length)
      .map(({ c, items }) => `<section class="cat-section" id="cat-${c.id}">
        <header class="cat-head"><h2>${c.emoji} ${esc(c.name)}</h2><span class="cat-count">${items.length} of max 8</span></header>
        <p class="cat-blurb">${esc(c.blurb)}</p>
        <div class="grid">${items.map((t) => card(t)).join("")}</div></section>`).join("")
      + watchSection(watchlist.filter((w) => state.cat === "all" || w.category === state.cat));
  }

  function openDetail(id) {
    const t = byId[id];
    if (!t) return;
    const c = catById[t.category];
    const inStacks = stacks.filter((s) => s.steps.some((st) => st.picks.includes(id)));
    const alts = tools.filter((x) => x.category === t.category && x.id !== id);
    const badges = t.repo
      ? ["stars", "last-commit", "license"].map((k) =>
          `<img loading="lazy" alt="${k}" src="https://img.shields.io/github/${k}/${esc(t.repo)}?style=flat&color=555&label=${k === "stars" ? "%E2%98%85" : k.replace("-", "%20")}">`).join("")
      : "";
    const d = $("#detail");
    d.innerHTML = `<div class="detail-body">
      <div class="detail-head">${avatar(t, "lg")}<div><h2>${esc(t.name)}</h2>
        <div class="card-cat">${c.emoji} ${esc(c.name)} · <span class="price-txt price-${t.pricing}">${PRICE_LABEL[t.pricing]}</span>${t.pick ? ' · <span class="pick-inline">★ Editor\'s pick</span>' : ""}</div></div>
        <button class="close-btn" data-close aria-label="Close">×</button></div>
      <p class="lead">${esc(t.description)}</p>
      <div class="verdict"><div class="verdict-label">Why it's on the list</div>${esc(t.why)}</div>
      <h3>Best for</h3>
      <div class="chips">${t.bestFor.map((b) => `<button class="chip" data-search="${esc(b)}">${esc(b)}</button>`).join("")}</div>
      ${t.learn ? `<h3>Learn it</h3><a class="learn" href="${esc(t.learn.url)}" target="_blank" rel="noopener"><span>📖</span><span>${esc(t.learn.title)}</span><span class="arrow">↗</span></a>` : ""}
      <div class="actions">
        <a class="btn btn-primary" href="${esc(t.url)}" target="_blank" rel="noopener">Website ↗</a>
        ${t.repo ? `<a class="btn" href="https://github.com/${esc(t.repo)}" target="_blank" rel="noopener">GitHub ↗</a>` : ""}
        <button class="btn" data-copy="${location.href.split("#")[0]}#tool=${t.id}">Copy link</button>
      </div>
      ${badges ? `<div class="badges">${badges}</div>` : ""}
      ${inStacks.length ? `<h3>Part of these stacks</h3><div class="chips">${inStacks.map((s) => `<button class="chip" data-stack="${s.id}">${s.emoji} ${esc(s.title)}</button>`).join("")}</div>` : ""}
      ${reviewByTool[t.id] ? `<div class="review"><strong>📝 Our review (${esc(reviewByTool[t.id].date)}):</strong> ${esc(reviewByTool[t.id].summary)}<span class="ev">${esc(reviewByTool[t.id].evidence)}</span></div>` : ""}
      ${alts.length ? `<h3>Alternatives on the shortlist</h3><div class="alts">${alts.map((a) => `<button class="alt" data-tool="${a.id}">${avatar(a, "xs")}<span><strong>${esc(a.name)}</strong>${a.pick ? " ★" : ""}<br><small>${esc(a.why)}</small></span></button>`).join("")}</div>` : ""}
    </div>`;
    if (!d.open) d.showModal();
    d.scrollTop = 0;
    setHash({ tool: id });
  }

  // ---------- URL state ----------
  function setHash(extra = {}) {
    const p = new URLSearchParams();
    if (state.q) p.set("q", state.q);
    if (state.cat !== "all") p.set("cat", state.cat);
    if (state.pricing !== "all") p.set("pricing", state.pricing);
    if (state.lang !== "all") p.set("lang", state.lang);
    if (state.stack) p.set("stack", state.stack);
    for (const [k, v] of Object.entries(extra)) p.set(k, v);
    const h = p.toString();
    history.replaceState(null, "", h ? `#${h}` : location.pathname + location.search);
  }
  function readHash() {
    const p = new URLSearchParams(location.hash.slice(1));
    state.q = p.get("q") || "";
    state.cat = catById[p.get("cat")] ? p.get("cat") : "all";
    state.pricing = PRICING.some(([v]) => v === p.get("pricing")) ? p.get("pricing") : "all";
    state.lang = p.get("lang") || "all";
    state.stack = stacks.some((s) => s.id === p.get("stack")) ? p.get("stack") : null;
    return p.get("tool");
  }

  function render() { renderIntents(); renderStack(); renderFilters(); renderResults(); setHash(); }
  function selectStack(id) {
    state.stack = state.stack === id ? null : id;
    render();
    if (state.stack) $("#stack-view").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function runQuery(text) {
    q.value = text; state.q = text; renderResults(); setHash();
    $("#browse-anchor").scrollIntoView({ behavior: "smooth" });
  }

  // ---------- events ----------
  const q = $("#q");
  let t0;
  q.addEventListener("input", () => { clearTimeout(t0); t0 = setTimeout(() => { state.q = q.value; renderResults(); setHash(); }, 60); });
  q.addEventListener("keydown", (e) => { if (e.key === "Enter") $("#browse-anchor").scrollIntoView({ behavior: "smooth" }); });

  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-tool],[data-stack],[data-cat],[data-pricing],[data-close],[data-close-stack],[data-copy],[data-reset],[data-search],[data-try],[data-show-watchlist]");
    if (!el) { if (e.target === $("#detail")) $("#detail").close(); return; }
    const ds = el.dataset;
    if (ds.copy) { navigator.clipboard?.writeText(ds.copy); el.textContent = "Copied ✓"; return; }
    if ("close" in ds) return $("#detail").close();
    if ("closeStack" in ds) return selectStack(state.stack);
    if ("reset" in ds) { e.preventDefault(); Object.assign(state, { q: "", cat: "all", pricing: "all", lang: "all", stack: null }); q.value = ""; render(); scrollTo({ top: 0, behavior: "smooth" }); return; }
    if (ds.search) { $("#detail").close(); return runQuery(ds.search); }
    if (ds.try) return runQuery(ds.try);
    if ("showWatchlist" in ds) { e.preventDefault(); Object.assign(state, { q: "", cat: "all", pricing: "all", lang: "all" }); q.value = ""; renderFilters(); renderResults(); setHash(); $("#watchlist")?.scrollIntoView({ behavior: "smooth" }); return; }
    if (ds.tool) return openDetail(ds.tool);
    if (ds.stack) { if ($("#detail").open) $("#detail").close(); return selectStack(ds.stack); }
    if (ds.cat) { state.cat = ds.cat; renderFilters(); renderResults(); setHash(); $("#browse-anchor").scrollIntoView({ behavior: "smooth" }); return; }
    if (ds.pricing) { state.pricing = ds.pricing; renderFilters(); renderResults(); setHash(); }
  });
  document.addEventListener("keydown", (e) => {
    if ((e.key === "/" || (e.key === "k" && (e.metaKey || e.ctrlKey))) && document.activeElement !== q) { e.preventDefault(); q.focus(); q.select(); }
    if (e.key === "Enter" && document.activeElement?.classList.contains("card")) openDetail(document.activeElement.dataset.tool);
    if (e.key === "Escape" && document.activeElement === q && q.value) { q.value = ""; state.q = ""; renderResults(); setHash(); }
  });
  $("#lang-select").addEventListener("change", (e) => { state.lang = e.target.value; renderResults(); setHash(); });
  $("#clear").addEventListener("click", () => { Object.assign(state, { q: "", cat: "all", pricing: "all", lang: "all" }); q.value = ""; render(); });
  $("#detail").addEventListener("close", () => setHash());
  addEventListener("hashchange", () => { const tool = readHash(); q.value = state.q; render(); if (tool) openDetail(tool); });

  const root = document.documentElement;
  try { const saved = localStorage.getItem("theme"); if (saved) root.dataset.theme = saved; } catch {}
  $("#theme-toggle").addEventListener("click", () => {
    const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    root.dataset.theme = dark ? "light" : "dark";
    try { localStorage.setItem("theme", root.dataset.theme); } catch {}
  });

  // boot
  $("#count-tools").textContent = tools.length;
  $("#count-cats").textContent = categories.length;
  $("#count-stacks").textContent = stacks.length;
  const toolFromHash = readHash();
  q.value = state.q;
  render();
  if (toolFromHash) openDetail(toolFromHash);
  if (location.hash === "#watchlist") setTimeout(() => $("#watchlist")?.scrollIntoView(), 50);
  window.__atlasSearch = (text) => { const w = tokenize(text); return searchTools(w).ranked.slice(0, 5).map((r) => byId[r.id].name); };
})();
