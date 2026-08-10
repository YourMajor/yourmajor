@AGENTS.md

## Business & design context — read before proposing either

`PRODUCT.md` is the binding product record: users, positioning, the four exact
price points, product rules (no guest players; admin ≠ participant), and the
**Evidence on Hand** section. That last one is a hard constraint for any
marketing, sales, or finance work — testimonials, customer counts, event
counts, growth figures, and partner logos **do not exist and must never be
invented**. State pricing exactly as written or not at all.

`DESIGN.md` is the design system: Championship Board tokens for marketing, the
Operate Surface rules for the post-login app. Read it before styling anything.

The business agents in `.claude/agents/` (growth, email, offer/lead-gen,
finance, sprint, feedback) are imported personas from the agency-agents repo.
They know their craft but nothing about YourMajor — hand them `PRODUCT.md`
before asking for a plan, and treat any number they produce that isn't derived
from it as an assumption to check.

## Recorded decisions — check them before you design

**Do not propose an architecture, schema change, migration approach, or design
direction in this repo without first checking what has already been decided.**
This project has recorded decisions that were made and approaches that were
explicitly rejected. Re-proposing a rejected approach is a defect, not a fresh
idea. If the record contradicts what you were about to suggest, say so and cite
where it says otherwise.

Three places hold that record, in order of cost to check:

1. **`MEMORY.md`** (auto-memory index, already in context each session) — the
   `yourmajor-*` notes cover app state, Prisma-only migrations, the two Supabase
   projects, Vercel env scoping, the scrapped v2 design direction, handicap
   rules, and the regression suite.
2. **`PRODUCT.md` and `DESIGN.md`** in this repo — binding product and design
   records, including what was explicitly excluded (guest players; the
   cream-editorial rendition scrapped 2026-08-05).
3. **The second-brain vault** — `mcp__plugin_obsidian-second-brain_vault__obsidian_search`,
   which holds `Projects/YourMajor/` architecture notes and weekly reviews.

Preserve the qualifiers you find. Notes carry `as of YYYY-MM-DD` on volatile
facts and `(TBC)` / `(inferred)` on unverified ones — never promote an inferred
fact to a stated one.

After a decision is made or a lesson learned that will still be true in a
different session, write it to the memory vault per the rules in the user-level
`CLAUDE.md` (kebab slug, matching `name:`, `Related:` line, one line in
`MEMORY.md`). Do not put session URLs or absolute local paths into commits,
PRs, or issues.
