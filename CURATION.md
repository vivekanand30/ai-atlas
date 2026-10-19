# Curation policy

AI Atlas is a **shortlist, not a registry**. Being popular is not enough to get in. A tool has to be one of the best ways to do a job.

## The bar (all must be true)

1. **Best at something.** You can finish the sentence "Pick this when…" and the answer isn't "it's another option".
2. **Alive.** Meaningful releases in the last 6 months, issues get answered.
3. **Proven.** Real adoption: production users, a strong community, or backing from the team that owns the standard.
4. **Usable today.** Clear docs and a working quickstart. No waitlists or vaporware.
5. **Honest.** Open source, or commercial with a transparent free tier or pricing.

## Hard limits

- **At most 8 tools per category.** To add a 9th, make the case for which one it replaces.
- **One ★ Editor's pick per category**: the default we'd hand a friend who doesn't want to compare.
- No wrappers around a single API, no "awesome lists", no tools superseded by their own successor (e.g. AutoGen → Microsoft Agent Framework).

## Every entry must have

| Field | Purpose |
|:--|:--|
| `description` | What it is, in one sentence. |
| `why` | Why it made the cut and when to choose it over the alternatives. |
| `bestFor` | 2–6 phrases a real person would type, like "turn figma designs into code". They power search. |
| `learn` *(optional)* | One genuinely great tutorial, guide or talk. Not the homepage again. |

## Companion Tools

Non-AI tools are allowed only in the Companion Tools category, and only when they close a loop in an AI workflow, such as checking AI-generated UI on every screen size. The same bar applies.

## Review log

Every nomination we evaluate, whether added, watchlisted or declined, is recorded in [`data/reviews.json`](data/reviews.json) with its evidence (stars, age, activity, license) and reasoning. Reviews are shown in the README and on each tool's detail panel. When we change our mind, we say so in the review.

## Watchlist

Tools that look excellent but haven't cleared the bar yet, usually because they're too new, depend on one maintainer, or rest on a fragile dependency, go into [`data/watchlist.json`](data/watchlist.json). Each entry records what's holding it back, what would get it promoted, and a revisit date. Watchlisted tools appear in a separate section and never show up as recommendations in search.

## Removal

Entries are reviewed quarterly. A tool is removed when it is archived, superseded, or no longer clearly best at its job. The weekly link check opens issues for dead links automatically.
