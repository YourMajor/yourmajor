import Image from 'next/image'
import posterCourse from '../../../public/images/marketing/poster-course.webp'

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
    <div
      className="relative flex min-h-[75vh] flex-col justify-center py-14"
      style={{ width: '100vw', marginLeft: 'calc(50% - 50vw)' }}
    >
      {/* Media stage: same drop-in contract as the hero's. The photo (and
          its tint below) dissolve via mask instead of being painted over
          with dusk: the zone's own background shows through the poster's
          lower reach, so the boundary with the next section cannot exist,
          haze and all. */}
      <div
        className="absolute inset-0"
        aria-hidden
        style={{
          WebkitMaskImage:
            'linear-gradient(to bottom, black 52%, transparent 90%)',
          maskImage: 'linear-gradient(to bottom, black 52%, transparent 90%)',
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
      {/* Top handoff only: the page green dissolving into the photo. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(to bottom, var(--mk-green-ground), transparent 26%)',
        }}
      />

      <div className="mk-container relative w-full">
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
          className="mt-8 max-w-[65ch] text-base lg:text-lg"
          style={{ color: 'var(--mk-text)' }}
        >
          Everything you need to run tournament golf, from casual weekend events
          to season-long leagues.
        </p>
      </div>
    </div>
  )
}
