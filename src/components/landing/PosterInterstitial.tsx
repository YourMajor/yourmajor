import Image from 'next/image'
import posterCourse from '../../../public/images/marketing/poster-course.webp'

/**
 * The one screenprint moment on the page (DESIGN.md v3: exactly one; a second
 * is drift), now set as a full-bleed photo stage (live-accepted variant,
 * params baked: scrim 0.5, photo anchored center). The features heading in
 * two flat inks, the gold layer a fixed 3px out of register, over a dusk
 * course photograph that breaks out of the container. Generated scenery,
 * artifact-checked, sanctioned by the v3 range; the green scrims at top and
 * bottom hand the photo off to the page ground with no visible seam.
 *
 * No JavaScript here at all; the misregister is the poster's charm and is
 * identical under reduced motion.
 */

const LINES = ['Built for', 'competitive', 'golfers']

export function PosterInterstitial() {
  return (
    <div
      className="relative flex min-h-[70vh] flex-col justify-center py-20"
      style={{ width: '100vw', marginLeft: 'calc(50% - 50vw)' }}
    >
      {/* Media stage: same drop-in contract as the hero's. */}
      <div className="absolute inset-0" aria-hidden>
        <Image
          src={posterCourse}
          alt=""
          fill
          sizes="100vw"
          className="object-cover"
          placeholder="blur"
        />
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(to bottom, var(--mk-green-ground), transparent 32%, transparent 68%, var(--mk-green-ground)), color-mix(in oklch, var(--mk-green-deep) 50%, transparent)',
        }}
      />

      <div className="mk-container relative w-full">
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
            className="absolute inset-0 select-none"
            style={{ color: 'var(--mk-gold)', transform: 'translate(3px, 3px)' }}
          >
            {LINES.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </span>
          {/* Bone ink, front. */}
          <span className="relative" style={{ color: 'var(--mk-text)' }}>
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
