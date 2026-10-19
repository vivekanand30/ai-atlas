#!/usr/bin/env node
// Validates data/*.json, regenerates README.md + docs/*.md and builds the static site into dist/.
//   node scripts/build.mjs           validate + write generated markdown + build dist/
//   node scripts/build.mjs --check   validate and fail if any generated markdown is out of date (for CI)
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE_URL = "https://vivekanand30.github.io/ai-atlas/";
const REPO_URL = "https://github.com/vivekanand30/ai-atlas";

const load = (f) => JSON.parse(readFileSync(join(ROOT, "data", f), "utf8"));
const tools = load("tools.json");
const categories = load("categories.json");
const stacks = load("stacks.json");
const { _comment, ...concepts } = load("concepts.json");
const watchlist = load("watchlist.json");
const reviews = load("reviews.json");
const roadmap = load("roadmap.json");
const roles = load("roles.json");
const MAX_PER_CATEGORY = 8;

// ---------- validate ----------
const errors = [];
const PRICING = new Set(["oss", "free", "freemium", "paid"]);
const catIds = new Set(categories.map((c) => c.id));
const seen = new Set();
for (const [i, t] of tools.entries()) {
  const where = `tools.json[${i}] (${t.id ?? "no id"})`;
  for (const k of ["id", "name", "category", "description", "why", "url", "pricing"]) if (!t[k]) errors.push(`${where}: missing "${k}"`);
  if (!/^[a-z0-9-]+$/.test(t.id ?? "")) errors.push(`${where}: id must be lowercase-kebab-case`);
  if (seen.has(t.id)) errors.push(`${where}: duplicate id`);
  seen.add(t.id);
  if (!catIds.has(t.category)) errors.push(`${where}: unknown category "${t.category}"`);
  if (!PRICING.has(t.pricing)) errors.push(`${where}: pricing must be one of ${[...PRICING].join(", ")}`);
  if (t.repo && !/^[\w.-]+\/[\w.-]+$/.test(t.repo)) errors.push(`${where}: repo must look like "owner/name"`);
  if (!/^https:\/\//.test(t.url ?? "")) errors.push(`${where}: url must start with https://`);
  if ((t.description ?? "").length > 160) errors.push(`${where}: description over 160 chars`);
  if ((t.why ?? "").length > 160) errors.push(`${where}: why over 160 chars`);
  if (!Array.isArray(t.bestFor) || t.bestFor.length < 2 || t.bestFor.length > 6) errors.push(`${where}: bestFor needs 2-6 search phrases`);
  if (t.learn && !(t.learn.title && /^https:\/\//.test(t.learn.url ?? ""))) errors.push(`${where}: learn needs {title, url}`);
  if (!Array.isArray(t.tags) || !Array.isArray(t.languages)) errors.push(`${where}: tags and languages must be arrays`);
}
for (const c of categories) {
  const items = tools.filter((t) => t.category === c.id);
  if (items.length > MAX_PER_CATEGORY) errors.push(`category "${c.id}" has ${items.length} tools; the limit is ${MAX_PER_CATEGORY}. Replace one instead (see CURATION.md)`);
  if (items.filter((t) => t.pick).length > 1) errors.push(`category "${c.id}" has more than one editor's pick`);
}
for (const [i, w] of watchlist.entries()) {
  const where = `watchlist.json[${i}] (${w.id ?? "no id"})`;
  for (const k of ["id", "name", "url", "category", "pitch", "holdingBack", "promoteIf", "added", "revisit"]) if (!w[k]) errors.push(`${where}: missing "${k}"`);
  if (seen.has(w.id)) errors.push(`${where}: already on the list; remove it from the watchlist`);
  if (!catIds.has(w.category)) errors.push(`${where}: unknown category "${w.category}"`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(w.revisit ?? "")) errors.push(`${where}: revisit must be YYYY-MM-DD`);
}
for (const [w, list] of Object.entries(concepts)) if (!Array.isArray(list)) errors.push(`concepts.json: "${w}" must map to an array`);
for (const s of stacks) for (const step of s.steps) for (const id of step.picks) {
  if (!seen.has(id)) errors.push(`stacks.json (${s.id} → ${step.label}): unknown tool "${id}"`);
}
const nodeIds = new Set(roadmap.nodes.map((n) => n.id));
const phaseIds = new Set(roadmap.phases.map((p) => p.id));
const stackIds = new Set(stacks.map((s) => s.id));
for (const n of roadmap.nodes) {
  const where = `roadmap.json (${n.id})`;
  for (const k of ["id", "phase", "title", "what", "fits"]) if (!n[k]) errors.push(`${where}: missing "${k}"`);
  if (!phaseIds.has(n.phase)) errors.push(`${where}: unknown phase "${n.phase}"`);
  for (const id of n.tools || []) if (!seen.has(id)) errors.push(`${where}: unknown tool "${id}"`);
  for (const id of n.next || []) if (!nodeIds.has(id)) errors.push(`${where}: unknown next node "${id}"`);
  if (n.stack && !stackIds.has(n.stack)) errors.push(`${where}: unknown stack "${n.stack}"`);
  if (n.resource && !/^https:\/\//.test(n.resource.url ?? "")) errors.push(`${where}: resource needs an https url`);
}
for (const r of roles) {
  const where = `roles.json (${r.id})`;
  for (const k of ["id", "title", "who", "mindset", "levels", "watchOut"]) if (!r[k]) errors.push(`${where}: missing "${k}"`);
  for (const l of r.levels || []) for (const it of l.items) {
    if (it.tool ? !seen.has(it.tool) : !(it.name && /^https:\/\//.test(it.url ?? ""))) errors.push(`${where} → ${l.label}: item needs a known "tool" id or {name, url}`);
    if (!it.why) errors.push(`${where} → ${l.label}: every item needs a "why"`);
  }
  for (const id of r.concepts || []) if (!nodeIds.has(id)) errors.push(`${where}: unknown concept "${id}"`);
}
const VERDICTS = new Set(["added", "watchlist", "declined"]);
for (const r of reviews) {
  if (!VERDICTS.has(r.verdict)) errors.push(`reviews.json (${r.name}): verdict must be added, watchlist or declined`);
  if (r.verdict === "added" && !seen.has(r.tool)) errors.push(`reviews.json (${r.name}): "added" review must reference a tool id`);
}
if (errors.length) {
  console.error(`✗ ${errors.length} problem(s):\n  ` + errors.join("\n  "));
  process.exit(1);
}

// ---------- README ----------
const byId = Object.fromEntries(tools.map((t) => [t.id, t]));
const PRICE = { oss: "🟢 OSS", free: "🔵 Free", freemium: "🟡 Free tier", paid: "🔴 Paid" };
const nameCell = (t) => `${t.pick ? "⭐ " : ""}**${link(t)}**${t.learn ? ` <sub>[📖 learn](${t.learn.url})</sub>` : ""}`;
const cell = (s) => String(s).replace(/\|/g, "\\|");
const link = (t) => `[${t.name}](${t.url})`;

const toc = [];
for (let i = 0; i < categories.length; i += 3) {
  toc.push("| " + categories.slice(i, i + 3).map((c) => {
    const n = tools.filter((t) => t.category === c.id).length;
    return `${c.emoji} [${c.name}](#${c.id}) <sub>${n}</sub>`;
  }).concat(Array(3).fill("")).slice(0, 3).join(" | ") + " |");
}

const stackRows = stacks.map((s) =>
  `| ${s.emoji} **[${s.title}](${SITE_URL}#stack=${s.id})** | ${s.steps.map((st) => `${st.label}: ${link(byId[st.picks[0]])}`).join(" → ")} |`);

const sections = categories.map((c) => {
  const items = tools.filter((t) => t.category === c.id).sort((a, b) => (b.pick ? 1 : 0) - (a.pick ? 1 : 0) || a.name.localeCompare(b.name));
  if (!items.length) return "";
  const rows = items.map((t) => {
    const stars = t.repo ? `[![stars](https://img.shields.io/github/stars/${t.repo}?style=flat&label=%E2%98%85&color=555)](https://github.com/${t.repo})` : "";
    return `| ${nameCell(t)} | ${cell(t.why)}<br><sub>Best for: ${cell(t.bestFor.slice(0, 3).join(" · "))}</sub> | ${PRICE[t.pricing]} | ${stars} |`;
  });
  return `<a id="${c.id}"></a>
## ${c.emoji} ${c.name}

> ${c.blurb}

| Tool | Why it's on the list | Pricing | GitHub |
|:--|:--|:--|:--|
${rows.join("\n")}

<div align="right"><a href="#top">↑ back to top</a></div>
`;
}).join("\n");

const readme = `<!-- GENERATED by scripts/build.mjs from data/*.json. Edit the data, not this file. -->
<a id="top"></a>
<div align="center">

# 🧭 AI Atlas

**A curated shortlist of the AI tools actually worth your time, and why.**

Not a registry. Every entry must be best at something, actively maintained and proven in real use.<br>
Max ${MAX_PER_CATEGORY} per category · ${tools.length} tools · ${stacks.length} ready-made stacks · [how we curate](CURATION.md)

### [🔎 Search the Atlas](${SITE_URL}) · [🗺️ AI Map](docs/AI-MAP.md) · [🧑‍💼 AI for your role](docs/ROLES.md)

[![Validate](${REPO_URL}/actions/workflows/ci.yml/badge.svg)](${REPO_URL}/actions/workflows/ci.yml)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-5b5bf0)](CONTRIBUTING.md)

</div>

---

## 🧭 New to all this?

- **[🗺️ The AI Map](docs/AI-MAP.md)**: ${roadmap.nodes.length} short stops from machine learning → LLMs → agents → MCP → skills. What each one is and how they fit together.
- **[🧑‍💼 AI for your role](docs/ROLES.md)**: ${roles.map((r) => `${r.emoji} ${r.title}`).join(" · ")}. What to use first, what next, and why.

## 🎯 I want to…

Each stack is an ordered recipe. The tool shown is a good default for that step; open the stack on the website to see the alternatives.

| Goal | Recommended path |
|:--|:--|
${stackRows.join("\n")}

## 🗂️ Browse by category

| | | |
|:--|:--|:--|
${toc.join("\n")}

**Legend:** ⭐ editor's pick (our default for the category) · 🟢 open source · 🔵 free · 🟡 free tier · 🔴 paid · ★ live GitHub stars

**Tip:** on GitHub, press <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>F</kbd> to search this page. For goal-based search, filters and alternatives, use the [website](${SITE_URL}).

---

${sections}
---

<a id="watchlist"></a>
## 👀 Watchlist

Promising, but not proven yet. These are **not recommendations**. Each one is re-reviewed on its revisit date, then promoted or dropped.

| Tool | Why it's interesting | What's holding it back | Promote if | Revisit |
|:--|:--|:--|:--|:--|
${watchlist.map((w) => `| **[${w.name}](${w.url})**${w.repo ? `<br>[![stars](https://img.shields.io/github/stars/${w.repo}?style=flat&label=%E2%98%85&color=555)](https://github.com/${w.repo})` : ""} | ${cell(w.pitch)} | ${cell(w.holdingBack)} | ${cell(w.promoteIf)} | ${w.revisit} |`).join("\n")}

<a id="reviews"></a>
<details>
<summary><b>📝 Review log</b>: every nomination we evaluated and why (${reviews.length})</summary>

| Date | Tool | Verdict | Evidence | Reasoning |
|:--|:--|:--|:--|:--|
${reviews.map((r) => `| ${r.date} | [${r.name}](${r.url}) | ${{ added: "✅ added", watchlist: "👀 watchlist", declined: "❌ declined" }[r.verdict]} | ${cell(r.evidence)} | ${cell(r.summary)} |`).join("\n")}

</details>

---

## 🤝 Contributing

This list stays small on purpose. Nominate a tool by [opening an issue](${REPO_URL}/issues/new?template=add-tool.yml) that makes the case against the bar in [CURATION.md](CURATION.md). To change data directly, see [CONTRIBUTING.md](CONTRIBUTING.md).
`;

// ---------- docs/AI-MAP.md ----------
const toolLink = (id) => `[${byId[id].name}](${byId[id].url})`;
const phaseNodes = (p) => roadmap.nodes.filter((n) => n.phase === p.id);
const mermaid = ["flowchart TD", ...roadmap.phases.map((p) =>
  `  subgraph phase_${p.id}["${p.title}"]\n${phaseNodes(p).map((n) => `    ${n.id}["${n.title.replace(/"/g, "'")}"]`).join("\n")}\n  end`),
  ...roadmap.nodes.flatMap((n) => (n.next || []).map((x) => `  ${n.id} --> ${x}`))].join("\n");
let step = 0;
const aiMap = `<!-- GENERATED by scripts/build.mjs from data/roadmap.json. Edit the data, not this file. -->
# 🗺️ The AI Map

**How we got from machine learning to agents, skills and plugins, and how the pieces fit together.**
${roadmap.nodes.length} short stops. Each one covers what it is, how it fits, one thing to try, and one great resource.
Interactive version with progress tracking: [AI Map on the website](${SITE_URL}learn.html) · Next: [AI for your role](ROLES.md)

\`\`\`mermaid
${mermaid}
\`\`\`

${roadmap.phases.map((p) => `## ${p.title} <sub>${p.era}</sub>

*${p.subtitle}*

${phaseNodes(p).map((n) => `### ${++step}. ${n.title} <sub>${n.era || ""}</sub>

**What it is:** ${n.what}

**How it fits:** ${n.fits}
${n.analogy ? `\n> 💡 ${n.analogy}\n` : ""}${n.try ? `\n**Try it:** ${n.try}\n` : ""}${n.tools?.length ? `\n**Tools:** ${n.tools.map(toolLink).join(" · ")}\n` : ""}${n.resource ? `\n**Best resource:** [${n.resource.title}](${n.resource.url})\n` : ""}${n.next?.length ? `\n**Next →** ${n.next.map((x) => roadmap.nodes.find((m) => m.id === x).title).join(", ")}\n` : ""}`).join("\n")}`).join("\n---\n\n")}
`;

// ---------- docs/ROLES.md ----------
const itemCell = (it) => it.tool ? `**${toolLink(it.tool)}**` : `**[${it.name}](${it.url})**`;
const rolesMd = `<!-- GENERATED by scripts/build.mjs from data/roles.json. Edit the data, not this file. -->
# 🧑‍💼 AI for your role

What to use first, what to add next, and why, by role. Interactive version: [AI for your role on the website](${SITE_URL}roles.html) · Concepts: [AI Map](AI-MAP.md)

${roles.map((r) => `[${r.emoji} ${r.title}](#${r.id})`).join(" · ")}

${roles.map((r) => `<a id="${r.id}"></a>
## ${r.emoji} ${r.title}

*${r.who}*

> **Mindset:** ${r.mindset}

${r.levels.map((l) => `**${l.label}**

| Use | Type | Why |
|:--|:--|:--|
${l.items.map((it) => `| ${itemCell(it)} | ${it.kind} | ${cell(it.why)} |`).join("\n")}
`).join("\n")}
⚠️ **Watch out:** ${r.watchOut}

${r.concepts?.length ? `📖 **Concepts worth knowing:** ${r.concepts.map((id) => roadmap.nodes.find((n) => n.id === id).title).join(" · ")} (see the [AI Map](AI-MAP.md))` : ""}
`).join("\n---\n\n")}`;

const outputs = { "README.md": readme, "docs/AI-MAP.md": aiMap, "docs/ROLES.md": rolesMd };
if (process.argv.includes("--check")) {
  const stale = Object.entries(outputs).filter(([f, content]) => {
    try { return readFileSync(join(ROOT, f), "utf8") !== content; } catch { return true; }
  }).map(([f]) => f);
  if (stale.length) {
    console.error(`✗ Out of date: ${stale.join(", ")}. Run \`node scripts/build.mjs\` and commit the result.`);
    process.exit(1);
  }
  console.log(`✓ ${tools.length} tools valid, generated markdown up to date`);
  process.exit(0);
}
mkdirSync(join(ROOT, "docs"), { recursive: true });
for (const [f, content] of Object.entries(outputs)) writeFileSync(join(ROOT, f), content);

// ---------- site ----------
const dist = join(ROOT, "dist");
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
cpSync(join(ROOT, "site"), dist, { recursive: true });
writeFileSync(join(dist, "data.js"), `window.ATLAS=${JSON.stringify({ tools, categories, stacks, concepts, watchlist, reviews, roadmap, roles })};\n`);
console.log(`✓ ${tools.length} tools, ${categories.length} categories, ${stacks.length} stacks, ${watchlist.length} watchlisted, ${roadmap.nodes.length} map stops, ${roles.length} roles → README.md, docs/, dist/`);
