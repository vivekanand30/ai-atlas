# Contributing

The atlas is a **curated shortlist**. Read [CURATION.md](CURATION.md) first: most nominations should not get in, and that's by design.

It is data-driven. **Never edit `README.md` directly.** It is generated from `data/`.

## Add a tool

1. Add one line to [`data/tools.json`](data/tools.json) inside its category block:

   ```json
   {"id":"my-tool","name":"My Tool","category":"agents","description":"What it is, in one sentence.","why":"Why it beats the alternatives, and when to pick it.","bestFor":["phrase someone would type","another real use case"],"url":"https://mytool.dev/","repo":"me/my-tool","learn":{"title":"A great tutorial","url":"https://..."},"pricing":"oss","tags":["multi-agent"],"languages":["python"]}
   ```

   | Field | Rules |
   |:--|:--|
   | `id` | lowercase-kebab-case, unique |
   | `category` | an `id` from [`data/categories.json`](data/categories.json) |
   | `pricing` | `oss` (open source), `free`, `freemium` (free tier), `paid` |
   | `repo` | `owner/name` on GitHub, or `""`. Powers the live ★ and last-commit badges |
   | `why` | The verdict, under 160 chars. Shown on the card; this is the most important field |
   | `bestFor` | 2–6 plain-language use cases ("turn figma design into code"). Search ranks these highly |
   | `learn` | Optional: one great tutorial or guide |
   | `pick` | `true` for the single editor's pick of a category (maintainers only) |
   | `tags` | 1–5 short keywords |
   | `languages` | SDK languages, e.g. `python`, `typescript`, `go`, `rust` |

2. If the category already has 8 tools, your PR must remove one and explain why yours is better.
3. Optionally add it to a step in [`data/stacks.json`](data/stacks.json) if it is a common pick for that goal.
4. Run `node scripts/build.mjs` (Node 20+, no install needed) and commit the regenerated `README.md`.
5. Open a PR. CI validates the data and checks the README is up to date.

## What belongs here

- AI tools, frameworks, MCP servers, model APIs and infra that are **actively maintained** and **used by real people**.
- Programming languages and libraries only when they are foundational to AI work.
- **Companion Tools** (not AI themselves) only when they close a loop in an AI workflow, such as verifying or previewing what AI produced. The entry's `why` must say how.
- No affiliate links, no one-week-old wrappers. Prefer the official URL.

## Preview the website locally

```bash
node scripts/build.mjs && npx serve dist
```

## Improve search

If a reasonable search returns nothing useful, add the missing everyday word to [`data/concepts.json`](data/concepts.json). For example, `"website": ["web", "frontend", "ui"]`. That's usually a better fix than adding tags to every tool.
