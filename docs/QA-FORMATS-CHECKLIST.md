# QA Checklist — All 21 Tournament Formats

A clickthrough plan for verifying every format end-to-end. Run after pulling
new changes to the scoring/leaderboard surface.

## Setup

```bash
# 1. Make sure dev server is running on http://localhost:3000
npm run dev

# 2. Seed test fixtures (idempotent — re-running upserts everything)
npx tsx scripts/seed-format-test.ts            # seed all 19 formats
# OR for a single format:
npx tsx scripts/seed-format-test.ts NASSAU

# 3. Run automated leaderboard render check
python scripts/format-clickthrough.py http://localhost:3000

# Screenshots land in tmp/qa-screenshots/{slug}.png
```

The seeder creates `qa-{format}` test tournaments (e.g. `qa-nassau`,
`qa-best-ball-2`). Each is ACTIVE with 4 fake players, 12 of 18 holes scored,
and teams pre-built where required.

---

## Automated coverage (Playwright)

`format-clickthrough.py` already verifies for every format:
- ✓ Page returns HTTP 200
- ✓ Reaches `networkidle` without hanging
- ✓ Correct leaderboard component renders (right `aria-label`)
- ✓ No console errors / uncaught exceptions
- ✓ Screenshot captured for visual review

What it **cannot** check (needs you):
- Score-entry flow (`/{slug}/play`) — gated by auth
- Team-management UI (`/{slug}/admin/teams`) — gated by admin
- Multi-player concurrent submissions — needs two browsers
- Concede-hole interaction — needs a logged-in match-play participant
- Wizard creation flows

---

## Manual QA — Per format

For each format below, sign in (the seeded users are `qa-alice@test.local` …
`qa-finn@test.local` if you wired magic-link to your local mailer; otherwise
your own admin account is also a tournament admin on every seeded fixture).

### Common across all formats

For every `/qa-{format}` tournament:
- [ ] Hub page loads, status pill says **LIVE**
- [ ] Leaderboard renders with the format-appropriate columns
- [ ] Filter pill (Search) works; typing a player name filters rows
- [ ] No console errors in DevTools

---

### 1. STROKE_PLAY (`/qa-stroke-play`)

**Expected leaderboard:** default Masters-style table.
**Columns:** POS · PLAYER · TOTAL · THRU · TODAY · R1 · NET (hidden — handicap is NONE).

- [ ] Total column shows `+/E/-` styled vs par
- [ ] THRU shows hole count (12 for fixture); `F` after all 18
- [ ] Sort: lowest gross-vs-par on top
- [ ] Tied positions render as `T2`, `T3`

### 2. STROKE_PLAY_NET (`/qa-stroke-play-net`)

**Expected:** same as STROKE_PLAY but with handicap (WHS).

- [ ] NET column appears
- [ ] Gross/Net pill toggles which column drives sort
- [ ] Net-vs-par values factor in stroke-index allocation

### 3. STABLEFORD (`/qa-stableford`)

**Expected:** TOTAL cell shows points (not vs-par); Net column hidden.

- [ ] Sort: highest points first
- [ ] Default points table: 4/3/2/1/0 (eagle/birdie/par/bogey/double+)
- [ ] Carol with all pars produces 36 (or scaled for 12 holes)

### 4. MODIFIED_STABLEFORD (`/qa-modified-stableford`)

**Expected:** same as STABLEFORD but with table 5/2/0/-1/-3.

- [ ] Players who go bogey-or-worse can have negative totals
- [ ] Sort still highest-first

### 5. BEST_BALL_2 (`/qa-best-ball-2`)

**Expected:** **Team leaderboard table** with team color chip, name, member chips, captain "C" badge.

- [ ] One row per team (2 rows for fixture)
- [ ] Team color chips render
- [ ] Avatars stack with "C" badge on captain
- [ ] R1 shows team's best-ball total per round
- [ ] Click team name → routes to `/qa-best-ball-2/teams/{teamId}` (no 404)
- [ ] **Team detail page** shows roster + per-round totals + member contribution grid
  with the lowest-scoring member identified per hole

### 6. BEST_BALL_4 (`/qa-best-ball-4`)

Same as BEST_BALL_2 but with 4-person teams.

- [ ] Team has 4 stacked avatars (no `+N` overflow at 4; overflow shows at 5+)
- [ ] Best-ball selection per hole picks lowest of 4 member scores

### 7. SCRAMBLE (`/qa-scramble`)

**Expected:** Team leaderboard.

- [ ] Same visual as BEST_BALL but TOTAL is the **single team score per hole**, not a per-member best
- [ ] Team detail page shows per-round totals (no contribution grid — only one score per team-hole)

### 8. SHAMBLE (`/qa-shamble`)

Same as SCRAMBLE.
- [ ] Renders identically to scramble (current scoring engine treats them the same; format-specific differences are in real-life play, not in the digital scorecard)

### 9. CHAPMAN (`/qa-chapman`)

Same as SCRAMBLE.
- [ ] Same as scramble; alternate-shot differences not modeled in v1

### 10. PINEHURST (`/qa-pinehurst`)

Same as SCRAMBLE.

### 11. MATCH_PLAY (`/qa-match-play`)

**Expected:** **Match-play leaderboard table.**
**Columns:** POS · PLAYER · RECORD (W-L-H) · STATUS · OPPONENT.

- [ ] STATUS cell shows `X UP thru Y` / `X DOWN thru Y` / `Dormie thru Y` / `5&4` / `AS thru Y` / `Halved`
- [ ] Lead colored green, behind colored red, AS neutral
- [ ] RECORD shows W-L-H of holes (e.g. `8-2-2`)
- [ ] OPPONENT name shown only when the player has exactly one opponent (heads-up)
- [ ] Aggregate "X UP" computed across all opponents in the field for >2 player events

### 12. RYDER_CUP (`/qa-ryder-cup`)

Same UI as MATCH_PLAY.

- [ ] Same rendering as match play; team-vs-team UX is a future polish item

### 13. NASSAU (`/qa-nassau`)

**Expected:** **Nassau leaderboard table.**
**Columns:** POS · PLAYER · FRONT · BACK · OVERALL.

- [ ] Each cell uses match-play vocab: `5&4`, `Dormie thru 14`, `AS thru 7`, etc.
- [ ] Front, back, and overall computed independently — closing the front does NOT end the back
- [ ] Sort: by overall holesUp first, then back, then front

**Known v1 limitation:** with **>2 players**, holesUp is summed across all
opponents and labels can show non-physical values (e.g. `20&6`). Real-world
Nassau is heads-up (2 players); 4-player Nassau in the seeded fixture is not
realistic. **For 2-player Nassau**, all labels render correctly.

### 14. SKINS_GROSS (`/qa-skins-gross`)

**Expected:** **Skins leaderboard table.**
**Columns:** POS · PLAYER · SKINS · HOLES · THRU (no VALUE column unless `valuePerSkin > 1`).

- [ ] SKINS shows count of skins won
- [ ] HOLES shows preview list (e.g. `3, 9(×2), 17`); the `×N` notation is a carryover claim
- [ ] **Trailing carryover badge** above the table when latest hole tied (pulsing amber pill)
- [ ] Tied holes do NOT award a skin to anyone
- [ ] Tooltip on HOLES cell shows full breakdown (`R1 H4: 1 skin, R1 H9: 2 skins ...`)

### 15. SKINS_NET (`/qa-skins-net`)

Same as SKINS_GROSS but with WHS handicap allocation.

- [ ] Players with higher handicap get net strokes on indexed holes; per-hole skins compute on net values

### 16. QUOTA (`/qa-quota`)

**Expected:** default table; TOTAL cell shows `over/under` quota (negative if behind).

- [ ] Quota target = `36 - handicap` (capped at 0)
- [ ] Per-hole points: eagle 8, birdie 4, par 2, bogey 1, double+ 0
- [ ] Sort: highest over-quota first

### 17. CALLAWAY (`/qa-callaway`)

**Expected:** default table with NET column showing Callaway-derived net total.

- [ ] No prior handicap needed; net is computed from worst holes 1-16
- [ ] Holes 17 & 18 are excluded from the worst-hole pool

### 18. PEORIA (`/qa-peoria` and `/qa-peoria-complete`)

**Expected:** default table; secret-hole reveal panel above the table; NET
column gated on round completion.

The seed produces two fixtures:
- `qa-peoria` — 12 of 18 holes scored. Round is **incomplete**. NET column
  hidden, reveal panel says "Hidden until round complete" with a lock icon.
- `qa-peoria-complete` — all 18 holes scored. Round is **complete**. NET column
  visible, reveal panel lists the 6 secret hole numbers.

For `qa-peoria` (gate closed):
- [ ] NET column **does not appear** anywhere on the leaderboard
- [ ] "Peoria secret holes — Hidden until round complete" panel renders above the table with a lock icon
- [ ] Sort still works — falls back to gross-vs-par
- [ ] Player profile / scorecard pages do not leak the secret holes

For `qa-peoria-complete` (gate open):
- [ ] NET column **appears**
- [ ] Reveal panel lists exactly 6 hole numbers
- [ ] The 6 holes include 2 par-3s, 2 par-4s, and 2 par-5s (one of each from each nine, when the course supports it)
- [ ] Net total per player matches `Gross − round(((cappedSum × 3) − coursePar) × 0.80)` clamped to [0, 36]
- [ ] Net **differs from** what WHS would have computed for the same scorecard

For multi-round Peoria (no fixture; manual setup):
- [ ] R1 finished, R2 in progress → R1 holes revealed, R2 row says "Hidden until round complete"
- [ ] R1 contributes its handicap to net; R2 does not until completed

### 19. LOW_GROSS_LOW_NET (`/qa-low-gross-low-net`)

**Expected:** **Low gross / low net leaderboard table.**
**Columns:** POS · PLAYER · GROSS · G-RANK · NET · N-RANK · THRU.

- [ ] Crown chip "GROSS 1" appears next to whoever leads gross
- [ ] Crown chip "NET 1" appears next to whoever leads net
- [ ] Different players can hold the two crowns simultaneously
- [ ] Sort: by net first, gross as tiebreaker

---

## Multi-player edge cases (manual)

These can't be Playwright-tested without two simultaneous logged-in sessions.
Use two browsers (or one regular + one incognito) signed in as different
fixture users.

### Test 1: Concurrent team-mode entry (Scramble)

`/qa-scramble` — sign in as two members of Team Albatross in two browsers.

- [ ] Browser A enters score 5 on hole 13 → both browsers eventually show 5
- [ ] Browser B *immediately* changes hole 13 to 4 → both browsers show 4
- [ ] Switch to a 3rd browser as a Team Birdie member → entering on Team Albatross's hole should be **rejected** (403 Forbidden)
- [ ] Leaderboard updates within ~1s of either save (per the new 600ms save / 150ms refetch budget)
- [ ] Score is stored exactly **once** per (team-anchor, hole, round); confirm via:
  ```bash
  npx tsx -e "import { prisma } from './src/lib/prisma'; (async()=>{const t=await prisma.tournament.findUnique({where:{slug:'qa-scramble'}});const c=await prisma.score.count({where:{round:{tournamentId:t.id},hole:{number:13}}});console.log('scores on hole 13:',c)})()"
  ```
  Expected: `2` (one per team), not `4` (one per player). Anchor routing prevents fan-out.

### Test 2: Concede flow (Match Play)

`/qa-match-play` — sign in as Alice (or any participant).

- [ ] Visit `/qa-match-play/play`
- [ ] Strokes stepper visible
- [ ] Click **Concede Hole** button → strokes stepper replaces with red "Hole Conceded" panel
- [ ] Reload page → still shows "Hole Conceded" (persisted)
- [ ] Tap `+` or `-` → un-concedes (stepper returns)
- [ ] Save indicator goes through `Pending… → Saving… → Saved` lifecycle
- [ ] Open `/qa-match-play` leaderboard in another tab → STATUS column reflects the conceded hole within ~1s

### Test 3: Captain reassignment (any team format)

`/qa-best-ball-2/admin/teams` — sign in as a tournament admin.

- [ ] Two teams shown with current captains
- [ ] Click a different member's radio → optimistic update (yellow "Captain" pill moves)
- [ ] Reload → change persisted
- [ ] Visit `/qa-best-ball-2` leaderboard → "C" badge moved to new captain on the team row

### Test 4: Team CRUD (any team format)

`/qa-best-ball-4/admin/teams`

- [ ] Click **New Team** → form appears with name input + 6 color swatches
- [ ] Submit empty name → button disabled
- [ ] Pick a color, type a name, submit → new team appears
- [ ] Click **Add member** on the new team → dropdown shows only players not yet on a team
- [ ] Add 2 players → both appear, first one auto-flagged as captain
- [ ] Remove the captain → next member auto-promotes
- [ ] Delete the team via the trash icon → confirms via `confirm()`, team disappears, members become unassigned

### Test 5: Performance budget

For any seeded tournament:
- [ ] Open browser DevTools → Network tab
- [ ] Tap `+` on the strokes stepper at `/{slug}/play`
- [ ] **`Pending…` indicator appears within 16ms** (one frame)
- [ ] **POST `/api/scores`** fires ~600ms after the last tap (debounce)
- [ ] **`Saving…`** flips to **`Saved`** within ~200ms of POST resolving
- [ ] In another tab on the leaderboard, the row updates within ~150ms of POST resolving (Realtime push)
- [ ] **End-to-end** spectator-visible latency: ~1.0–1.3s total

### Test 6: Concede + leaderboard SSR

- [ ] In Browser A on `/qa-match-play/play`, concede hole 5
- [ ] In Browser B *fully reload* `/qa-match-play` (forces SSR)
- [ ] Leaderboard shows the conceded hole reflected in the W-L-H record (not stale)
- [ ] `revalidateTag` correctly busts the SSR cache; you should NOT see a 30s-old standing

---

## Wizard / creation flow QA

This part isn't seeded — drives the wizard at `/tournaments/new`.

- [ ] Step "Format" shows formats grouped: Individual / Team / Match / Combined
- [ ] Free tier sees only STROKE_PLAY, STABLEFORD, SCRAMBLE; everything else has Pro lock
- [ ] **NASSAU** appears under Match group (Pro) — pick it
- [ ] Picking a format card with `impliedHandicap` set (e.g., STROKE_PLAY_NET → WHS) skips the standalone Handicap step in later wizard steps
- [ ] Picking SCRAMBLE auto-checks Teams in step Players
- [ ] Tournament created lands on `/{slug}` hub
- [ ] **`Manage Teams`** link appears in admin sidebar when `teamsEnabled === true`

---

## Cleanup

After QA, optionally remove all `qa-*` test tournaments:

```bash
npx tsx -e "
import 'dotenv/config'
import { prisma } from './src/lib/prisma'
;(async () => {
  const r = await prisma.tournament.deleteMany({ where: { slug: { startsWith: 'qa-' } } })
  console.log('Deleted', r.count, 'tournaments')
  process.exit(0)
})()
"
```

---

## Findings from the automated run (2026-05-07)

Captured by `scripts/format-clickthrough.py`:

| Format | Result | Notes |
|---|---|---|
| STROKE_PLAY | ✓ PASS | default table, no errors |
| STROKE_PLAY_NET | ✓ PASS | NET column appears |
| STABLEFORD | ✓ PASS | points-based sort |
| MODIFIED_STABLEFORD | ✓ PASS | points-based sort |
| CALLAWAY | ✓ PASS | NET visible |
| PEORIA | ✓ PASS | Two fixtures: qa-peoria (gate closed, NET hidden) and qa-peoria-complete (gate open, secret holes revealed) |
| QUOTA | ✓ PASS | over/under in TOTAL |
| SKINS_GROSS | ✓ PASS | Carryover badge visible |
| SKINS_NET | ✓ PASS | net-stroke skins |
| MATCH_PLAY | ✓ PASS | W-L-H + status + opponent |
| RYDER_CUP | ✓ PASS | same UI as match play |
| NASSAU | ✓ PASS | front/back/overall — labels distort with >2 players |
| LOW_GROSS_LOW_NET | ✓ PASS | gross + net crowns, dual ranks |
| BEST_BALL_2 | ✓ PASS | team table, color, captain badge |
| BEST_BALL_4 | ✓ PASS | up to 4 stacked avatars |
| SCRAMBLE | ✓ PASS | single team-anchor scoring |
| SHAMBLE | ✓ PASS | same as scramble |
| CHAPMAN | ✓ PASS | same as scramble |
| PINEHURST | ✓ PASS | same as scramble |

**19 / 19 leaderboard render checks pass with zero console errors.**

### Known visual quirks worth noting (not regressions)

1. **Nassau >2 players**: aggregate holesUp is summed across all opponents,
   producing labels like `20&6` for a 4-player fixture. Real-world Nassau is
   1-vs-1 and renders correctly there. If the app must support N-way Nassau,
   the row component should switch to a "leading vs the field" semantic.
2. **Best Ball / Scramble**: the gross/net "Traditional" pill renders even
   when `handicapSystem === 'NONE'` (Scramble is set to NONE in the registry).
   The pill toggle does nothing in that case but takes UI space. Cosmetic only.
3. **Peoria multi-round**: not yet covered by an automated fixture — the seed
   only creates a single-round Peoria event. Multi-round gating must be
   verified by setting up a 2-round Peoria tournament manually.
4. **Team detail page** (`/{slug}/teams/{id}`): only renders the
   member-contribution grid for best-ball formats; for scramble it correctly
   shows just per-round totals.

---

## Re-running this QA

```bash
# Quick: verify nothing regressed since last run
npx tsx scripts/seed-format-test.ts && python scripts/format-clickthrough.py http://localhost:3000

# Full: run the manual checklist sections above for the format(s) you touched
```
