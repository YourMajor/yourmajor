# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary — the organizer.** Someone running a golf event for a group they
already belong to: a friend group, a work outing, a bachelor party, a casual
recurring league. They are not a club pro or a tournament director. They set the
event up ahead of time, usually at a desk or on a phone, and they are the person
who pays. Their job: get a real tournament running without spreadsheets, and
without needing everyone to have an official handicap.

**Secondary — the player.** Arrives through an invite link or a tournament code,
not through search. Scores from a phone, on-course, outdoors, often one-handed
and sometimes on poor signal. Their job: enter scores, see where they stand, and
take part in the group's banter.

The public marketing surface addresses **both, organizer-led**: the organizer is
the one being persuaded, with a clear secondary path for a player who has a code
and just needs to get in.

## Product Purpose

Run a golf tournament end to end — create it, register players, score it live,
rank it on a leaderboard, and keep the group talking while it happens. Success is
an organizer running a complete multi-round event, with real scoring, without
falling back to a spreadsheet or a group text.

## Positioning

The casual and social end of tournament golf. Established competitors serve
institutions: clubs and associations (Golf Genius), charity and nonprofit events
(GolfStatus), state associations and junior tours (BlueGolf), or individual
consumer GPS and round tracking (18Birdies, Golf GameBook). *(Competitive
analysis as of April 2026.)* The friend-group organizer sits between those and is
not owned by any of them.

What a neighboring product could not truthfully copy without rebuilding around
it: scoring that works for a group where **nobody has an official handicap**
(Callaway and Peoria alongside WHS and Stableford), and a **powerup draft** —
players draft cards before the round and spend them mid-play against each other.
The draft makes the event social before it is competitive, which is the actual
reason a casual group chooses to make their round a tournament at all.

## Operating Context

- **Before the event:** the organizer builds the tournament in a five-step wizard
  — basic info, rounds and courses, handicap system, powerups, registration.
  Course data comes from a golf course API. Registration is either open (anyone
  with the hub link) or invite-only (token from an email invite).
- **The draft:** a distinct ritual with its own screen and turn order, run before
  play. It has a real-time turn indicator and can be auto-picked or reset.
- **During the round:** players score from their phones on-course — strokes,
  putts, fairways, greens in regulation. The leaderboard updates live for
  everyone. Powerups are activated mid-play and resolved against other players.
  Conditions are outdoor and sunlit, one-handed, sometimes low-signal.
- **Around the round:** group chat and a photo gallery, both live.
- **After:** season standings, round history, per-player stats and
  season-over-season tracking for recurring groups.

## Capabilities and Constraints

**Confirmed functionality:** five-step tournament creation wizard; multi-round
events; Masters-style live leaderboard with gross/net toggle; live scoring;
powerup draft and in-play activation; tournament chat; photo gallery; season
standings and history; team play and groups; per-tournament custom branding
(colors, logo, embossed badge); email invites; late entries.

**Handicap systems:** WHS, Stableford, Callaway, Peoria. Callaway and Peoria
exist specifically so a group with no official indexes can still be scored
fairly — this is a positioning-critical capability, not a minor option.

**Product rules that future work must not contradict:**
- **Every participant must have an account.** There are no guest players; any
  record without a linked user is legacy data.
- **Admin and participant are independent.** Someone can administer a tournament
  without playing in it, and vice versa. Never assume an admin is on the
  leaderboard.
- Registration closes once a tournament is ACTIVE or COMPLETED.

**Pricing (current and accurate — state these exactly or not at all):**
- **Free** — $0, up to 16 players, fully functional, no card required.
- **Pro** — $29, one tournament credit, up to 72 players. Credits do not expire.
- **The Club** — $99/month, up to 4 tournaments per month, season standings,
  recurring rosters, sponsor placements, 2 admin seats.
- **Tour** — $1,999 for 365 days, up to 144 players, unlimited tournaments, all
  Club features, 5 admin seats, a custom subdomain, priority email support.

## Brand Commitments

- The name **YourMajor** is binding. Primary domain is yourmajor.club; the Tour
  tier issues custom subdomains under yourmajor.app.
- The **existing logo mark** is binding. New visual work must accommodate it
  rather than restyle or replace it.
- **Standing preference, recorded 2026-08-06: the category standard.** Offered a
  dealt visual direction twice, across two independent rolls, the user chose the
  canon both times: prestige tournament golf, executed conventionally and
  without irony. This is a durable preference, not a one-off page decision.
  Future surfaces inherit it unless the user changes it.
- **Craft bar: the Masters app and the PGA Tour app.** Named by the user as the
  standard this work is held to. Practically that means broadcast-grade data
  typography, real photography carrying real weight, and dense live standings
  that stay legible at a glance.
- **Not binding:** exact palette values, type faces, layout language and motion
  remain implementation choices. The incumbent navy-and-gold execution and the
  Playfair Display heading face are the previous implementation, not commitments.
  One explicit exclusion: the cream-paper editorial rendition scrapped on
  2026-08-05 is not what canon means here.

## Evidence on Hand

**Real and usable:**
- Product screenshots of the live application — leaderboard, scorecard, draft
  and related screens. This is the strongest honest proof available.
- Tournaments that have actually been run, which may be shown directly or
  anonymized.
- The pricing above.

**Does not exist — must never be invented:**
- Testimonials, quotes, or named users.
- Customer counts, event counts, growth figures, or any benchmark.
- Partner or client logos.

**Known synthetic material already in the codebase:** the landing page
demonstrations use invented player names (J. Palmer, T. Watson, B. Hogan,
S. Snead, G. Player) and invented scores. These are illustrations, not records.
Any such material that survives a redesign must read unmistakably as a
demonstration, and the list of what to swap for real captures must be handed to
the user.

## Product Principles

1. **Zero friction to the first tournament.** The free tier is fully functional
   and needs no card. Anything that puts a wall before a group's first event
   works against the product.
2. **Social before competitive.** The draft, the chat and the photos are the
   reason a casual group formalizes a round. They are the product, not a
   secondary feature list.
3. **No handicap required.** A group where nobody has an official index must
   still get fair, defensible scoring. This is the wedge, and it must stay legible.
4. **Asymmetric effort by design.** The organizer does the setup; players only
   ever tap a link and enter scores. Never move work onto the player.
5. **Proof over claims.** Show real interface and real events. The absence of
   testimonials and customer numbers is a fact to design around, not to paper over.

## Accessibility & Inclusion

No formal standard has been set by the user. One product-specific requirement
follows from the confirmed operating context rather than preference: players use
this outdoors in direct sunlight, one-handed, while holding clubs. Contrast and
touch-target sizing on any player-facing surface are functional requirements, not
compliance decoration.

Note for future work: the app currently disables pinch-zoom
(`maximumScale: 1, userScalable: false` in `src/app/layout.tsx`). That is a known
accessibility defect, recorded here so it is not mistaken for an intentional
product decision.
