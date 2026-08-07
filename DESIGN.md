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
  body:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    letterSpacing: "0.14em"
    note: "Implemented as the .mk-label class; uppercase; color stays with the call site"
  data:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "1rem"
    fontWeight: 600
    fontFeature: "tnum"
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
**Body Font:** Geist (with system-ui, sans-serif)
**Data Font:** Geist Mono (with ui-monospace, monospace)

**Character:** Caslon is the serif of classic club and sporting print, which is
the heritage this category actually draws on, and it carries the canon without
reaching for the display serifs that signal a machine picked them. Against it,
Geist stays completely neutral so that the data typography can do broadcast work.
The pairing is deliberately unequal: the serif is ceremonial and appears rarely,
the sans and mono carry nearly all the words.

### Hierarchy
- **Display** (400, `clamp(2.5rem, 4.5vw, 4rem)`, 1.05): the hero headline and
  major section openers only. Regular weight, not bold; Caslon at display size
  does not need weight to carry.
- **Headline** (400, `clamp(1.75rem, 3.5vw, 3rem)`, 1.15): section headings.
- **Body** (400, `1rem`, 1.6, max 65ch): all running copy. On green, white at 80%
  for lead and 65% for secondary.
- **Label** (600, `0.6875rem`, `0.14em`, uppercase): eyebrows and table headers,
  set in gold.
- **Data** (600, `1rem`, tabular figures): every score, position, and statistic.

### Named Rules

**The Tabular Rule.** Any number a visitor might compare vertically is set in
Geist Mono with `tnum` on. Positions, scores, yardages, prices. A column of
proportional figures in a leaderboard is a defect.

**The Rare Serif Rule.** The display serif appears at most twice per viewport. It
opens a section; it never sets body copy, labels, buttons, or UI text.

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
- Labels in Geist at label size, not serif.

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
- **Do** set every comparable number in Geist Mono with tabular figures.
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
