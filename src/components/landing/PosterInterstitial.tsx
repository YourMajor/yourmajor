import Image from 'next/image'
import posterCourse from '../../../public/images/marketing/poster-course.webp'
import { TubeRun } from './TubeRun'

/**
 * The one screenprint moment on the page (DESIGN.md v3: exactly one; a second
 * is drift), now set as a full-bleed photo stage (live-accepted variant,
 * params baked: scrim 0.5, photo anchored center). The features heading in
 * two flat inks, the gold layer a fixed 3px out of register, over a dusk
 * course photograph that breaks out of the container. Generated scenery,
 * artifact-checked, sanctioned by the v3 range; the top scrim hands off from
 * the green page ground and the bottom scrim hands into the dusk interlude
 * (.mk-dusk-zone) with no visible seam.
 *
 * No JavaScript here at all. Where the browser supports scroll-driven CSS
 * animation, the gold ink starts a full press-stroke out of register and
 * pulls into print as the sheet scrolls through (.mk-poster-ink); everywhere
 * else, and under reduced motion, the static 3px misregister stands.
 */

const LINES = ['Built for', 'competitive', 'golfers']

export function PosterInterstitial() {
  return (
    // Compact band (no min-h): the poster is a beat between chapters now,
    // not a destination. No overflow clip — the worm tube overlay is meant
    // to overflow this section's top and bottom (the photo layer is static
    // inset-0, so nothing else can poke out).
    // Tall enough for the photograph to be a stage rather than a strip, and
    // for the worm tube to complete its run inside this section. No
    // overflow clip: the tube is meant to overhang the top edge.
    //
    // Desktop only. The whole set piece — the 88rem stage, the 26rem of
    // headroom above the flag, the full-bleed photograph — exists to hold
    // TubeRun, which is itself `hidden lg:block`. On a phone what was left
    // was poster type and one sentence standing in a field of green, and it
    // read as a stray page rather than a beat between chapters.
    <div
      className="relative hidden min-h-[88rem] flex-col justify-center pt-[26rem] pb-40 lg:flex"
      style={{ width: '100vw', marginLeft: 'calc(50% - 50vw)' }}
    >
      {/* Media stage: same drop-in contract as the hero's. The photo (and
          its tint below) dissolve via mask instead of being painted over
          with dusk: the zone's own background shows through the poster's
          lower reach, so the boundary with the next section cannot exist,
          haze and all. */}
      {/* No parallax here, deliberately: a data-speed drift on this layer
          swept the photo's hard edge (near-black dusk sky) through the
          section as a flashing hairline — twice, even with generous
          overdraw, because smoother catch-up transients exceed any static
          margin. The poster's motion budget is its press-register ink and
          the breathing glow; the photo holds still. */}
      <div
        className="absolute inset-0"
        aria-hidden
        style={{
          // The photograph fills the whole section and dissolves at both
          // ends, so the green ground carries into it and out of it with
          // no seam at either edge.
          WebkitMaskImage:
            'linear-gradient(to bottom, transparent 0%, black 17%, black 74%, transparent 100%)',
          maskImage:
            'linear-gradient(to bottom, transparent 0%, black 17%, black 74%, transparent 100%)',
        }}
      >
        <Image
          src={posterCourse}
          alt=""
          fill
          sizes="100vw"
          className="object-cover"
          placeholder="blur"
        />
        {/* Deep-green tint rides inside the masked layer so it fades with
            the photo rather than staining the ground beneath. */}
        <div
          className="absolute inset-0"
          style={{
            background: 'color-mix(in oklch, var(--mk-green-deep) 50%, transparent)',
          }}
        />
      </div>
      {/* No separate top handoff: the mask above now dissolves the
          photograph at both edges, and a second green wash on top of it
          only darkened the sky twice over. */}

      {/* z-10: the type always reads in front of the worm tube, which
          passes behind the letterforms. */}
      <div className="mk-container relative z-10 w-full">
        {/* Sunset projection: a slow orange glow breathes behind the type. */}
        <div aria-hidden className="mk-poster-glow" />
        <h2
          className="relative uppercase"
          style={{
            fontSize: 'clamp(2.75rem, 7.5vw, 6.5rem)',
            lineHeight: 0.98,
            letterSpacing: '0.01em',
          }}
        >
          {/* Gold ink, misregistered. */}
          <span
            aria-hidden
            className="mk-poster-ink absolute inset-0 select-none"
            style={{ color: 'var(--mk-gold)', transform: 'translate(3px, 3px)' }}
          >
            {LINES.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </span>
          {/* Front ink, filled with the dusk sky's own gradient. */}
          <span className="mk-poster-sky relative">
            {LINES.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </span>
        </h2>

        <p
          className="mt-8 max-w-[46ch] text-base lg:text-lg"
          style={{ color: 'var(--mk-text)' }}
        >
          Everything you need to run tournament golf, from casual weekend events
          to season-long leagues.
        </p>
      </div>

      {/* The worm tube rides the right side of this section (copy stays
          left), overflowing into the divider above and the leaderboard
          below so the chapters read as one continuous course. */}
      <TubeRun />
    </div>
  )
}
