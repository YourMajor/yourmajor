'use client'

import Link from 'next/link'
import Image from 'next/image'
import { motion, useReducedMotion } from 'motion/react'
import posterCourse from '../../public/images/marketing/poster-course.webp'

const LINKS = [
  { href: '/terms', label: 'Terms of Use' },
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/feedback', label: 'Feedback' },
]

/* Marketing routes also point at the clubhouse: the live public-tournament
   shelf is the one destination the legal links don't cover. */
const MARKETING_LINKS = [{ href: '/#clubhouse', label: 'Tournaments' }, ...LINKS]

export default function FooterEndPlate() {
  const reduce = useReducedMotion()

  /* The end plate. The page's nightfall lands here: a near-black night
     ground with the dusk course photograph crushed into a painterly
     texture, a rising sunset ember, and the wordmark set as the film
     title with a slow projector sweep. The links read as the credits
     line under it. Poster register: dark, textured, typographic. */
  return (
    <footer
      className="marketing relative overflow-hidden"
      style={{ background: 'var(--mk-night)' }}
    >
      {/* Painterly texture: the dusk photograph, crushed dark, masked so it
          fades up from nothing at the footer's top edge and dissolves into
          the nightfall above, same treatment as every other image seam. */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.16]"
        style={{
          WebkitMaskImage:
            'linear-gradient(to bottom, transparent, black 38%)',
          maskImage: 'linear-gradient(to bottom, transparent, black 38%)',
        }}
      >
        <Image
          src={posterCourse}
          alt=""
          fill
          sizes="100vw"
          className="object-cover"
          style={{ filter: 'saturate(0.85) brightness(0.8)' }}
        />
      </div>
      {/* The sunset ember rises behind the title. */}
      <div aria-hidden className="mk-footer-horizon" />

      <div className="mk-container relative flex flex-col items-center gap-9 pt-16 pb-10 text-center lg:pt-24">
        <p
          className="max-w-[40ch] text-base italic"
          style={{
            fontFamily: 'var(--font-display), Georgia, serif',
            color: 'var(--mk-text-muted)',
          }}
        >
          Every group has a major.
        </p>

        {/* The title. Letters rise once; a projector sweep crosses slowly.
            Hovering a letter flushes it gold (CSS, color only: a transform
            here would drop the glyph out of the background-clip and make it
            vanish). Decorative duplicate of the brand name, hence aria-hidden. */}
        <p
          aria-hidden
          className="mk-endplate-title select-none uppercase"
          style={{
            fontFamily: 'var(--font-display), Georgia, serif',
            fontSize: 'clamp(3rem, 13vw, 11rem)',
            // Caslon's J descends below the baseline even in caps, and
            // background-clip: text only paints inside the box: a tight
            // line height amputated the tail. Full line box + padding
            // keeps every glyph inside the painted area.
            lineHeight: 1.04,
            paddingBottom: '0.06em',
            letterSpacing: '0.04em',
          }}
        >
          {'YourMajor'.split('').map((ch, i) => (
            <motion.span
              key={i}
              className="inline-block"
              initial={{ y: '0.4em' }}
              whileInView={{ y: '0em' }}
              viewport={{ once: true, amount: 0.4 }}
              transition={
                reduce
                  ? { duration: 0 }
                  : { duration: 0.8, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }
              }
            >
              {ch}
            </motion.span>
          ))}
        </p>

        {/* The credits block: product facts, then the links. */}
        <div className="flex flex-col items-center gap-4">
          <p
            className="text-[0.6875rem] font-semibold uppercase tracking-[0.22em]"
            style={{ color: 'var(--mk-text-subtle)' }}
          >
            Live leaderboards · Digital scorecards · Powerup drafts
          </p>
          <nav
            className="flex flex-wrap items-center justify-center gap-x-7 gap-y-3"
            aria-label="Footer"
          >
            {MARKETING_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="mk-label transition-colors hover:opacity-100 pointer-coarse:py-3"
                style={{ color: 'var(--mk-text-subtle)' }}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  )
}
