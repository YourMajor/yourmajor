---
name: YourMajor
description: Prestige tournament golf, executed at broadcast craft — the committed world for the marketing surface
colors:
  green-deep: "oklch(0.21 0.045 155)"
  green-ground: "oklch(0.27 0.055 155)"
  green-raised: "oklch(0.32 0.06 155)"
  gold-rule: "oklch(0.72 0.11 78)"
  bone-plate: "oklch(0.95 0.012 85)"
  ink: "oklch(0.22 0.02 150)"
  under-par: "oklch(0.50 0.20 25)"
  over-par: "oklch(0.45 0.02 150)"
  gold-on-bone: "oklch(0.45 0.10 78)"
  dusk-slate: "oklch(0.24 0.030 262)"
  night: "oklch(0.16 0.025 262)"
  sunset-ember: "oklch(0.60 0.150 45)"
  text-primary: "oklch(0.98 0.005 85)"
  text-muted: "oklch(0.88 0.012 120)"
  text-subtle: "oklch(0.76 0.014 130)"
typography:
  display:
    fontFamily: "Libre Caslon Display, Georgia, serif"
    fontSize: "clamp(2.5rem, 4.5vw, 4rem)"
    fontWeight: 400
    lineHeight: 1.05
    letterSpacing: "-0.015em"
  poster:
    fontFamily: "Libre Caslon Display, Georgia, serif"
    fontSize: "clamp(2.75rem, 7.5vw, 6.5rem)"
    fontWeight: 400
    lineHeight: 0.98
    letterSpacing: "0.01em"
    note: "The single screenprint interstitial only; a second use is drift"
  wordmark:
    fontFamily: "Libre Caslon Display, Georgia, serif"
    fontSize: "clamp(3rem, 13vw, 11rem)"
    fontWeight: 400
    lineHeight: 1.04
    letterSpacing: "0.04em"
    note: "The footer end plate only: gradient-clipped bone with the projector sweep; full line box so Caslon's descending cap J is never clipped"
  headline:
    fontFamily: "Libre Caslon Display, Georgia, serif"
    fontSize: "clamp(1.75rem, 3.5vw, 3rem)"
    fontWeight: 400
    lineHeight: 1.15
  title:
    fontFamily: "Google Sans, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.3
    note: "Card and panel headings, where a sans title outranks running copy but is not a section opener. Implemented as .ym-title"
  body:
    fontFamily: "Google Sans, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  body-sm:
    fontFamily: "Google Sans, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    note: "Secondary copy: captions, FAQ answers, plate feature lists, the skip link. Tailwind text-sm; already ubiquitous on the surface"
  label:
    fontFamily: "Google Sans, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    letterSpacing: "0.14em"
    note: "Implemented as the .ym-label class; uppercase; color stays with the call site. .mk-label and .masters-table thead th compose it"
  data:
    fontFamily: "Google Sans Code, ui-monospace, monospace"
    fontSize: "1rem"
    fontWeight: 600
    fontFeature: "tnum"
  micro:
    fontFamily: "Google Sans, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    note: "The legibility floor. Tailwind text-xs. Nothing smaller ships; text-[8px] is a defect"
weights:
  regular: 400
  medium: 500
  semibold: 600
  bold: 700
  note: "Four weights, one meaning each. 400 body and Caslon display; 500 UI labels, nav, secondary buttons; 600 sans headings, primary button labels, table headers; 700 data that must pop. 800 and 900 are retired from the Operate surface"
rounded:
  sm: "2px"
  md: "4px"
  lg: "6px"
spacing:
  section: "clamp(5rem, 10vw, 9rem)"
  gutter: "1.5rem"
  container: "80rem"
components:
  button-primary:
    backgroundColor: "{colors.bone-plate}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 1.75rem"
    height: "3rem"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.bone-plate}"
    rounded: "{rounded.md}"
    padding: "0 1.75rem"
    height: "3rem"
  plate:
    backgroundColor: "{colors.bone-plate}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "1.5rem"
---

# Design System: YourMajor

## Overview

**Creative North Star: "The Championship Board"**

This is the category standard, chosen deliberately and executed at full craft.
The user was offered dealt alternatives twice and took the canon both times, so
prestige tournament golf is the commitment: a deep green field, a gold rule,
serif display type, and real course photography, with no irony and no smuggled
quirk. The bar is the Masters app and the PGA Tour app, named by the user. What
that bar actually means in practice is not scenery, it is **discipline**:
broadcast-grade data typography, photography that carries real weight rather than
decorating, and dense live standings that stay legible at a glance.

The world is drenched. Green owns the surface at page scale rather than appearing
as an accent on a neutral ground, which is the difference between a golf page and
a page with golf colors on it. Against that field, exactly two things are allowed
to be bright: a bone-white plate, which is where real information lives, and a
gold hairline, which separates and never fills. Photography sits directly on the
green with no card around it.

The one thing this world inherits from the product rather than the category is the
score palette. Red already means under par in this codebase, and that convention
is broadcast-correct, so red stays the color of a good score and is never
repurposed as an error state on marketing surfaces.

**Key Characteristics:**
- Deep green ground at page scale, not a green accent on neutral
- Serif display (Libre Caslon Display) against sans body and mono data
- Gold appears only as a rule, a hairline, or a single highlighted word
- Bone plates carry real information; the page ground never turns pale
- Squared corners (2-6px), because the category reads formal, not friendly
- Photography-grade imagery or none; gradients never stand in for a picture

**v3 expressive range (user-directed, 2026-08-06).** The world's truth rules
are inviolable: the palette and token layer, Red Means Good, Tabular, exact
pricing, no invented stats or testimonials, no fake product screenshots built
from divs. But the strict-canon posture is deliberately widened for the
cinematic landing sequence, in four directions held in rough balance: the
Championship Board foundation; expressive editorial and illustrated type
moments; Apple-product-page scroll craft with living shader fields as motion
texture (never as fake photography); and one screenprint-poster register.
Where a chapter bends a stylistic rule (Rare Serif, no-eyebrows,
photography-or-nothing), the bend is flagged in that chapter's code and this
document records it. Current sanctioned bends:

- **Generated scenery is allowed.** "Real photography or no photography"
  relaxes to: photography-grade imagery, generated or captured, for scenery
  only, never standing in for product proof, always analyzed for AI artifacts
  before shipping, and labeled a demonstration when it depicts anything
  product-shaped.
- **One poster moment.** The features interstitial may set oversized display
  serif with registration-offset ink layers and halftone texture. Exactly one
  such moment exists on the page; a second one is drift.
- **Cursor reactivity is part of the world.** Magnetic CTAs, plate sheen, the
  bento spotlight, and in-chapter custom-cursor moments are sanctioned on
  pointer devices, always inert on touch, never load-bearing.
- **One dusk interlude (user-directed, 2026-08-07; deepened same day).**
  "Green owns the page at page scale" relaxes for exactly one stretch of the
  landing page: the poster photograph hands the ground to the hero
  photograph's own sky, a deep hazy slate (`--mk-dusk`,
  `oklch(0.24 0.030 262)`) with a band of sunset haze low on the horizon
  (`--mk-sunset`, `oklch(0.60 0.150 45)`), ramping back to green as the
  tracer chapter ends (`.mk-dusk-zone`). Sunset orange is atmosphere only:
  a radial haze, a shader stop, a glow behind display type. It is never a
  UI color, a fill, a rule, or text. One interlude exists; a second is
  drift, and dusk never carries plates, buttons, or data surfaces.
- **Film grain and soft rules (user-directed, 2026-08-07).** The whole
  marketing surface carries the hero photograph's texture: a static grain
  overlay at 5.5% (main.marketing::after) and full-width gold separators
  that fade at both ends (.mk-rule-soft-*) instead of hitting the viewport
  edge as hard lines. Grain is a still image, exempt from motion gating.
- **The page ends at night (user-directed, 2026-08-07).** The landing page
  runs day to night: green ground, the dusk interlude, green again, then a
  final descent (.mk-night-zone) through twilight into `--mk-night`
  (`oklch(0.16 0.025 262)`) that lands on the footer end plate: a
  poster-register close (dark painterly texture from the dusk photograph,
  the wordmark as a film title with a slow projector sweep, links set as
  the credits line). The night ground exists only in this descent and the
  footer; the screenprint poster in the features run remains the page's
  only screenprint moment.

## Colors

A drenched green field with two permitted brights and one inherited functional
signal.

### Primary
- **Tournament Green** (`oklch(0.27 0.055 155)`): the page ground for every
  marketing surface. Deep enough to carry white body copy at AAA contrast.
- **Deep Green** (`oklch(0.21 0.045 155)`): the base of the page and the footer,
  and the bottom stop of any hero gradient.
- **Raised Green** (`oklch(0.32 0.06 155)`): sections that need to separate from
  the ground without becoming a card.

### Secondary
- **Bone Plate** (`oklch(0.95 0.012 85)`): a warm off-white reserved for elevated
  plates carrying real information, and for the primary button. Never a section
  background.
- **Ink** (`oklch(0.22 0.02 150)`): text on bone. Green-tinted, never neutral black.

### Tertiary
- **Gold Rule** (`oklch(0.72 0.11 78)`): hairlines, eyebrow labels, small icons,
  and single emphasized words. Carried over from the incumbent identity, which
  keeps the logo mark's surroundings continuous.
- **Gold on Bone** (`oklch(0.45 0.10 78)`): the accent's dark tonal step for
  gold text or icons sitting on bone plates, where bright gold is 2.2:1 and
  fails AA. Same hue, dropped lightness; measured 6.5:1 on bone. Never used on
  green grounds, where bright gold already passes.

### Neutral
Text on the green ground runs a three-step ladder, each step tinted from the
ground's own hue rather than desaturated to grey.
- **Text Primary** (`oklch(0.98 0.005 85)`): headings and lead copy.
- **Text Muted** (`oklch(0.88 0.012 120)`): body copy. Holds ≥4.5:1 on the ground.
- **Text Subtle** (`oklch(0.76 0.014 130)`): captions and secondary labels only,
  never body copy.

### Functional
- **Under Par** (`oklch(0.50 0.20 25)`): red, for scores under par. Broadcast
  convention, inherited from the app's existing score semantics. It does not mean
  error anywhere on these surfaces.
- **Over Par** (`oklch(0.45 0.02 150)`): a desaturated green-grey for scores over
  par, so the leaderboard reads without a second hue.

### Atmosphere
The page's time-of-day arc, never UI colors: no text, border, icon, or control
may be set in these.
- **Dusk Slate** (`oklch(0.24 0.030 262)`): the dusk interlude's ground
  (`.mk-dusk-zone`, poster through shot tracer).
- **Night** (`oklch(0.16 0.025 262)`): the nightfall ending and the footer end
  plate (`.mk-night-zone`).
- **Sunset Ember** (`oklch(0.60 0.150 45)`): radial glows and horizon washes
  inside the dusk and night zones only.

### Named Rules

**The Gold Hairline Rule.** Gold is a rule, never a field. It may be a 1px or 2px
line, a small icon, an eyebrow label, or one highlighted word. There is no gold
button, no gold panel, and no gold text block. Its scarcity is what makes it read
as ceremony rather than decoration.

**The Green Owns The Page Rule.** Green is the ground at page scale. Bone appears
only as an elevated plate. The moment a full section turns pale, the world has
broken and the page starts reading as the scrapped cream-editorial direction.

**The Red Means Good Rule.** Red is under par. It is never an error, a warning, or
a destructive action on any marketing surface.

## Typography

**Display Font:** Libre Caslon Display (with Georgia, serif)
**Body Font:** Google Sans (with system-ui, sans-serif)
**Data Font:** Google Sans Code (with ui-monospace, monospace)

**Character:** Caslon is the serif of classic club and sporting print, which is
the heritage this category actually draws on, and it carries the canon without
reaching for the display serifs that signal a machine picked them. Against it,
Google Sans stays neutral so that the data typography can do broadcast work: a
geometric humanist sans with open apertures, which is what holds up at arm's
length in sunlight on a phone. Google Sans Code is its monospace sibling, so the
sans and the data face are one superfamily rather than two unrelated licences.
The pairing is deliberately unequal: the serif is ceremonial and appears rarely,
the sans and mono carry nearly all the words.

Google Sans was released under the SIL Open Font License in January 2026 and is
loaded through `next/font/google` like every other face here. Both it and Google
Sans Code are present in the font list Next bundles, so neither needs a
self-hosted fallback.

### Hierarchy

One scale, marketing and app both. The class named in each step is the only
implementation; a hand-rolled equivalent at the call site is drift.

| Step | Class | Family | Size | Weight | Use |
|---|---|---|---|---|---|
| Display | `font-heading` | Libre Caslon | `clamp(2.5rem, 4.5vw, 4rem)` / 1.05 | 400 | Hero headline and major section openers only |
| Headline | `font-heading` | Libre Caslon | `clamp(1.75rem, 3.5vw, 3rem)` / 1.15 | 400 | Section headings, and every `h1`-`h4` |
| Title | `.ym-title` | Google Sans | `1.125rem` / 1.3 | 600 | Card and panel headings |
| Body | default | Google Sans | `1rem` / 1.6, max 65ch | 400 | All running copy |
| Body-sm | `text-sm` | Google Sans | `0.875rem` / 1.5 | 400 | Secondary copy, captions |
| Label | `.ym-label` | Google Sans | `0.6875rem`, `0.14em`, uppercase | 600 | Eyebrows and table headers |
| Data | `.tabular-data` | Google Sans Code | `1rem`, `tnum` | 600 | Every score, position, statistic |
| Micro | `text-xs` | Google Sans | `0.75rem` | 500 | The floor |

Caslon at display size does not need weight to carry, which is why both serif
steps are 400. On green, body copy is white at 80% for lead and 65% for
secondary; inside the app the One Muted Step Rule applies instead.

### Named Rules

**The Four Weights Rule.** Emphasis runs on exactly four weights, each with one
meaning, and Google Sans ships precisely those four:

- **400** body copy, and Caslon at both serif steps
- **500** UI labels, nav items, secondary button text
- **600** sans headings, primary button labels, table headers, `.ym-label`
- **700** data that must pop: score values, leaderboard positions

`font-extrabold` and `font-black` are retired from the Operate surface. Three
competing mid-weights with no rule about which means what is not a hierarchy, it
is an accident, and it is what the pre-2026-08-10 surface had.

**The Legibility Floor Rule.** `0.75rem` (`text-xs`) is the smallest type that
ships in the DOM, and the label step at `0.6875rem` is a sanctioned exception
because it is uppercase and tracked, which buys back the height. `text-[8px]` is
a defect. Players read this surface outdoors, in sunlight, one-handed.

The one further exception is **SVG axis ticks inside a chart** (currently `9`
in `ComparativeScoreChart` and the donut centre label). Those are reference
marks sitting immediately beside the value they annotate, not reading copy, and
raising them crowds the plot. They are exempt; nothing else in an SVG is.

**The Tabular Rule.** Any number a visitor might compare vertically is set in
Google Sans Code with `tnum` on. Positions, scores, yardages, prices. A column of
proportional figures in a leaderboard is a defect.

**The Rare Serif Rule.** The display serif appears at most twice per viewport. It
opens a section; it never sets body copy, labels, buttons, or UI text.

**The Serif Has A Floor (2026-08-11).** Libre Caslon Display is a *display* cut:
high stroke contrast, fine hairlines, drawn to be set large. **Below 20px it does
not hold** — rendered at 14px, 16px and 18px on a phone the hairlines thin to
near-nothing and the heading reads *lighter* than the body copy beneath it, which
inverts the hierarchy it is supposed to create. Measured on device at 360px wide
across a 14/16/18/20/24/28 ladder: it breaks under 20px and is elegant at 24px up.

So the serif floor is **20px (`text-xl`)**. A card title, panel heading, stat
value or any UI text below that is set in **Google Sans 600**, the Title step,
not in the serif. This is the same boundary The Rare Serif Rule already implies
("never UI text"), now with a number attached.

This was found by looking at the surface on a phone, not in the code. Removing
the synthetic bold from Caslon on 2026-08-11 was correct in itself, but it left
58 small headings as bare 400-weight display serif, and only at phone size was
it obvious they had stopped reading as headings at all.

## Layout

A centered `80rem` container with a `1.5rem` gutter, which fixes the incumbent's
missing container: section headings currently run to the full viewport width at
desktop while the hero stays centered, and that mismatch is the clearest
structural defect in the old layout.

A 12-column grid at `lg` and above, collapsing to a single column below `768px`.
Section rhythm is `clamp(5rem, 10vw, 9rem)` vertical padding, which is
deliberately generous: the incumbent compressed to `pt-10` on mobile and read as
cramped rather than premium.

Breakpoints are Tailwind defaults. Hero height uses `min-h-[100dvh]`, never
`h-screen`, so the iOS address bar cannot cause a layout jump.

## Elevation & Depth

Restrained and mostly flat. Depth comes from the green tonal ladder (deep,
ground, raised) rather than from a shadow scale. The one real elevation is the
bone plate, which lifts off the green with a soft green-tinted ambient shadow and
a gold hairline acting as its edge.

### Shadow Vocabulary
- **Plate ambient** (`0 24px 60px oklch(0.15 0.04 155 / 0.45)`): under bone plates
  and photography. Tinted to the green ground; never a black shadow.
- **Plate hover** (`0 32px 80px oklch(0.15 0.04 155 / 0.55)` plus a 2px rise):
  interactive plates only.

### Named Rules

**The Tinted Shadow Rule.** Every shadow on this surface is mixed toward the green
ground. A neutral or black drop shadow on green reads as dirt.

## Shapes

Squared and formal. Radii run 2px to 6px, a deliberate step down from the
incumbent's 8-14px, because the category reads as ceremony rather than
friendliness and the leaderboard furniture it borrows from is rectilinear.

Borders are 1px gold hairlines at low opacity on green, or 1px ink hairlines at
low opacity on bone. Pills are reserved exclusively for genuine status chips
(live, open, closed) and never used for navigation or feature labels.

## Components

### Buttons
- **Shape:** `rounded-md` (4px), 48px tall, label on one line always.
- **Primary:** bone plate ground with ink text. The highest-contrast object on the
  page, which is correct because it is the one thing a visitor must find.
- **Secondary:** transparent with a bone hairline and bone text.
- **Hover / Focus:** 120ms background and border transition, `-translate-y-px` on
  active for physical feedback, and a visible gold focus ring.

### Plates
The system's primary container, replacing the incumbent's translucent white cards.
- **Background:** bone. **Corner:** 6px. **Border:** 1px ink at 8%.
- **Shadow:** plate ambient (see Elevation).
- Plates carry information a visitor is meant to read closely: a leaderboard, a
  scorecard, a pricing tier. Decorative content does not get a plate.

### Navigation
- Sticky, 72px tall, one line at desktop, transparent over the hero and settling
  into deep green with a gold hairline past 80px of scroll.
- Labels in Google Sans at label size, not serif.

### Signature Component — the Leaderboard Plate
The product's strongest asset and the direct expression of the North Star. A bone
plate carrying a deep-green header row in gold uppercase labels, underlined by a
2px gold rule, with rows separated by 1px ink hairlines at 8%. Positions and
scores in tabular mono, under-par figures in red. This is the one place the page
should feel exactly like broadcast furniture, because that is what earns the
craft comparison the user set.

### Motion
`MOTION_INTENSITY: 7`. Motion must be motivated: hierarchy, storytelling,
feedback, or state transition. The hero uses a GSAP ScrollTrigger pin with a
scrubbed reveal; section content uses `whileInView` staggers from `motion/react`;
the leaderboard demo uses an anime.js timeline for score movement. Everything
collapses to static under `prefers-reduced-motion`.

## Do's and Don'ts

### Do:
- **Do** keep green as the page ground on every marketing surface, so the four
  routes read as one world.
- **Do** set every comparable number in Google Sans Code with tabular figures.
- **Do** tint every shadow toward the green ground.
- **Do** use real course photography, and label anything synthetic as a
  demonstration.
- **Do** route all marketing color through the scoped token layer, so the palette
  can change again without editing markup.
- **Do** use `overflow-x-clip` on scroll ancestors; `overflow-x-hidden` silently
  kills `position: sticky` and the hero depends on sticky.

### Don't:
- **Don't** let a full section turn bone or cream. That is the scrapped
  cream-editorial direction, explicitly excluded.
- **Don't** fill anything with gold. It is a rule, an icon, or one word.
- **Don't** hardcode `oklch()` literals or `text-white/NN` into components. The
  incumbent marketing surface carries roughly 234 of them and that is precisely
  why its palette could not be changed without rewriting markup.
- **Don't** use red for errors or warnings on these surfaces. Red is under par.
- **Don't** build a fake product screenshot out of divs. Use the real UI, a real
  capture, or nothing.
- **Don't** carry the incumbent's opacity ladder as the only hierarchy device.
  White at five different alphas is not a type system.
- **Don't** use eyebrows or kickers above headings. Not one per section, not one
  per three sections: none. The heading carries its own weight. Gold labels are
  for table headers and status chips, which are structure, not decoration.
- **Don't** use section numbers (01 / 02 / 03) unless the sequence itself is
  information the reader needs.
- **Don't** make same-size icon-heading-text cards the page structure, and never
  nest a card inside a card.

## Operate Surface (post-login application, 2026-08-08)

The authenticated app carries the Championship Board **craft**, not its drench.
Users are mid-task — often outdoors, sunlit, one-handed — so the surface is
Operate mode: a warm bone-paper ground (`--background oklch(0.97 0.008 85)`),
ink text tinted green, and deep green as **structure** rather than atmosphere:
the primary action, the nav strips (`--surface-deep`), table headers, active
states. Gold stays a rule, a hairline, or one accent word (`--accent` on dark,
`--gold-ink oklch(0.45 0.10 78)` for AA text on light). Radii are squared
(`--radius 0.375rem`, 2–6px range). Libre Caslon Display is the app's heading
face too; Playfair is retired. Playful drench, dusk/night atmosphere, poster
moments, grain, and MOTION_INTENSITY 7 remain marketing-only.

Rules that carry over unchanged:
- **Tabular:** any vertically comparable number is Google Sans Code `tnum`
  (`.tabular-data`). A leaderboard column of proportional figures is a defect.
- **Red Means Under Par** for scores (`--score-birdie`). Unlike marketing, the
  app does keep `--destructive` red for errors — score red is distinguished by
  mono type and table context, never by button styling.
- **Plates carry information** (`.plate`): bone card, ink hairline at 8%,
  green-tinted ambient shadow. Decoration never gets a plate.
- **Tinted shadows** toward the green ground; never neutral black on color.

Operate constraints (from the mode, binding here):
- Motion is 150–250ms and conveys state — feedback, loading, reveal,
  position change. No orchestrated page-load choreography.
- Density is a feature: tables and standings stay dense and legible.
- Touch targets ≥ 44px on player-facing surfaces (sunlight, one-handed).

### Light and dark, side by side

The app ships both modes. Dark is not an afterthought recolour: it is the
marketing dusk, lived in. Mode rides a cookie (`ym-theme`) so SSR paints the
right one with no flash, and the class lands on `<html>` in `layout.tsx`. There
is no `prefers-color-scheme` query and no system following; the toggle in
`src/components/profile/ThemeToggle.tsx` is the only switch.

**Tokens that flip.** Everything below is defined twice, in `:root` and `.dark`:

| Token | Light | Dark |
|---|---|---|
| `--background` | `oklch(0.97 0.008 85)` warm paper | `oklch(0.16 0.025 262)` night |
| `--foreground` | `oklch(0.22 0.02 150)` ink | `oklch(0.95 0.012 85)` bone |
| `--card` | `oklch(0.995 0.004 85)` | `oklch(0.21 0.028 262)` |
| `--primary` | `oklch(0.27 0.055 155)` deep green | `oklch(0.50 0.11 155)` lit green |
| `--primary-foreground` | bone | bone |
| `--secondary` | `oklch(0.93 0.015 150)` | `oklch(0.26 0.030 262)` |
| `--muted-foreground` | `oklch(0.47 0.02 150)` | `oklch(0.76 0.014 130)` |
| `--accent` | `oklch(0.72 0.11 78)` gold | `oklch(0.72 0.11 78)` gold |
| `--gold-ink` | `oklch(0.45 0.10 78)` | `oklch(0.72 0.11 78)` |
| `--border` / `--input` | `oklch(0.87 0.012 120)` | `oklch(0.32 0.03 262)` |
| `--ring` | deep green | gold |
| `--surface-deep` | `oklch(0.21 0.045 155)` | `oklch(0.13 0.02 262)` |
| score ramp | measured 5.45:1 to 7.65:1 | measured 4.82:1 to 10.46:1 |

**Tokens that deliberately do not flip**, and why. This list is load-bearing:
reading it is how you know a value is intentionally mode-invariant rather than
an omission.

- `--radius` (`0.375rem`). Shape is not a function of light level.
- `--brand-ink` and `--brand-bone`. These are the two endpoints `brandVars()`
  picks between. If they flipped, the guard would have nothing stable to
  resolve to.
- The whole powerup register except `--powerup-active`. Powerup cards are
  physical objects; a game piece does not change colour when the room does.
  Only the live-on-this-hole glow brightens.
- `--club` and `--tour`, the tier colours. They are identity, not surface.
- `--sunset`. Atmosphere, marketing-only, and never a UI colour in either mode.
- The `.marketing` scope in its entirety. It is a third, fixed token world for
  public routes and does not respond to `.dark` at all. A marketing surface
  looks the same to a visitor whatever their system is set to.

**The Primary Means One Thing Rule.** `--primary` is the green brand action in
both modes, and `--primary-foreground` is bone in both. Dark shifts the green
lighter rather than inverting it, so a filled primary reads as the same object
in either mode.

Until 2026-08-10 dark `--primary` flipped to the bone plate
(`oklch(0.95 0.012 85)`). That inversion is retired and must not be reinstated.
It meant "primary" named two different colours depending on mode, and eleven
components had hardcoded a foreground against it: `text-white` on bone measured
**1.16:1**. The whole create-tournament flow was unreadable in dark.

The replacement is bounded on both sides by measurement, not taste. Bone text on
it is **4.91:1** (AA body), it holds **3.42:1** against the night ground and
**3.12:1** on a card (both clear the 3:1 floor for a non-text UI boundary).
Those two constraints pull in opposite directions and `oklch(0.50 0.11 155)` sits
near the only band satisfying both. The useful consequence is that
`--primary-foreground` is now bone in *both* modes, so even a stray hardcoded
`text-white` renders approximately right instead of catastrophically wrong.

**The Guard Runs Everywhere Rule.** `brandVars()` only executes where it is
spread: `[slug]/layout.tsx`, the draft page, and `TournamentBottomBar`. Every
other route, including the whole `(main)` tree, reads the unguarded app token.
So any surface that touches `--color-primary` must either sit inside a guarded
subtree or take its foreground from `text-primary-foreground`. Hardcoding
`text-white` against a brand variable is a defect in every case, and it is the
specific defect that produced this section. A brand *fill* is safe because it
pairs with the guarded foreground; brand *text* is not, which is what
`.text-brand` exists to solve.

**The branding contract.** Inside `/[slug]`, per-tournament branding is exactly
two variables — `--color-primary` and `--color-accent`, injected inline by the
tournament layout — plus logo and header image. Every branded surface derives
from those two variables with contrast guarding; nothing may hardcode a
foreground against them. The app tokens above are the fallback world when a
tournament has no branding.

Contrast guarding is centralized: `brandVars()` in `src/lib/utils.ts` computes
the foregrounds once at the two injection points (`[slug]/layout.tsx` and the
draft page) by luminance-testing each brand color and overriding
`--primary-foreground` / `--accent-foreground` with the mode-invariant
`--brand-ink` or `--brand-bone`. Components read `text-primary-foreground` /
`text-accent-foreground` (or the vars inline) and never hardcode white or ink
against `--color-primary` / `--color-accent`. Brand colors are validated to
`#RRGGBB` at every write path.

**The powerup register.** Powerup cards are game pieces with their own
sanctioned, token-only palette — mode-invariant (cards are physical objects;
only the active glow flips in dark) and independent of tournament branding:

- `--powerup-attack` / `--powerup-attack-deep` — system crimson ink and deeps
- `--powerup-boost` / `--powerup-boost-deep` — tournament green ink and deeps
- `--powerup-active` — purple; exactly one meaning: *a powerup is live on this
  hole* (rings, glows, scorecard stars, chat powerup messages)
- `--powerup-stock` — the card-face paper (the old hardcoded `#f5f0e8`)

All component usage goes through `POWERUP_STYLES` / `powerupStyles()` in
`src/components/draft/CardHand.tsx`; a raw Tailwind color-scale class
(red-*, emerald-*, purple-*, amber-*) on a powerup surface is a defect.
Selected/highlighted cards use the gold accent (`ring-accent`) — never a third
hue. Good/bad stroke modifiers use `--success` / `--destructive`, selection
states use `--primary` — those are app semantics, not the register. The
favourite heart stays literal red: it is iconography, not dialect.

**The One Muted Step Rule.** On a branded surface, secondary text is
`text-primary-foreground/80` — the single muted step, not a ladder. Measured
against the default tournament green, bone reads 3.39:1 at `/60` and 4.05:1 at
`/70`; only `/80` (4.79:1) clears AA. `/60` and `/70` foregrounds are a defect,
not a taste choice. Non-text uses of the same ramp — hairlines at `/15`,
dividers at `/20`, chip fills at `/10` — are unaffected; they are structure,
and structure is allowed to whisper.

**The Disabled-Is-Not-Faded Rule.** A disabled control is restyled, never
dimmed with `opacity`. Opacity composites a filled button's label toward the
page ground exactly as fast as its fill, so a green primary at 50% collapsed to
grey-on-grey (1.9:1). Every filled variant disables to `bg-muted` +
`text-muted-foreground` (5.69:1) and reads plainly as inactive; ghost and link
variants disable to `text-muted-foreground` alone. This lives in
`buttonVariants` (`src/components/ui/button-variants.ts`) so no call site has
to remember it.

**The Unlayered-Beats-Utilities Trap.** Custom rules in `globals.css` sit
outside `@layer`, so they outrank *every* Tailwind utility regardless of
specificity. A bare `.marketing nav a { display: inline-block }` silently
stripped `inline-flex` from any anchor styled as a button, dropping its label
to the top of the pill. When an unlayered rule sets a property a utility also
owns, scope it (`:not([class*="flex"])`) so component-level intent survives.
