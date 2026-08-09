@AGENTS.md

## Vault — check it before you design

The `om` MCP server exposes a personal knowledge vault
(`C:\Users\Beast\Obsidian-Mind`). It is registered user-scope, so its tools are
available here with no per-repo setup.

**Do not propose an architecture, schema change, migration approach, or design
direction in this repo without first calling `mcp__om__recall` and
`mcp__om__search`.** This project has recorded decisions that were made and
approaches that were explicitly rejected. Re-proposing a rejected approach is a
defect, not a fresh idea. If the vault contradicts what you were about to
suggest, say so and cite the note path.

Preserve the qualifiers you find. Vault notes carry `as of YYYY-MM-DD` on
volatile facts and `(TBC)` / `(inferred)` on unverified ones — never promote an
inferred fact to a stated one.

After a decision is made or a lesson learned that will still be true in a
different session, call `mcp__om__remember` (scoped to this project) or
`mcp__om__record_work`. Do not put session URLs or absolute local paths into
commits, PRs, or issues.
