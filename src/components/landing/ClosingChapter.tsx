'use client'

import Link from 'next/link'
import { motion, useReducedMotion } from 'motion/react'

/**
 * The 18th: the page's chapter-divider close, sitting at night at the end
 * of the nightfall descent. The badge's ring geometry is drawn large with a
 * slow gold glint circling it (CSS, .mk-ch-rings), the hole number sits in
 * display serif between its flanking labels, and the two closing lines
 * drift in from either side. Everything starts visible (x offsets only);
 * reduced motion stills the glint and zeroes the drifts.
 */
export function ClosingChapter() {
  const reduce = useReducedMotion()
  const drift = (from: number) => ({
    initial: { x: from },
    whileInView: { x: 0 },
    viewport: { once: true, amount: 0.5 },
    transition: reduce
      ? { duration: 0 }
      : { duration: 0.9, ease: [0.16, 1, 0.3, 1] as const },
  })

  return (
    <section
      aria-label="Get started"
      className="relative overflow-x-clip py-24 text-center lg:py-32"
    >
      <div className="mk-container relative">
        <div className="relative mx-auto flex h-52 items-center justify-center lg:h-64">
          <span aria-hidden className="mk-ch-rings" />
          <span
            aria-hidden
            className="absolute right-[calc(50%+clamp(6.5rem,13vw,9rem))] text-[0.6875rem] font-semibold uppercase tracking-[0.14em]"
            style={{ color: 'var(--mk-text-subtle)' }}
          >
            Final
          </span>
          <h2
            className="relative"
            style={{
              fontFamily: 'var(--font-display), Georgia, serif',
              fontSize: 'clamp(2.75rem, 7.5vw, 6.5rem)',
              lineHeight: 1,
              color: 'var(--mk-text)',
            }}
          >
            18
          </h2>
          <span
            aria-hidden
            className="absolute left-[calc(50%+clamp(6.5rem,13vw,9rem))] text-[0.6875rem] font-semibold uppercase tracking-[0.14em]"
            style={{ color: 'var(--mk-text-subtle)' }}
          >
            Hole
          </span>
        </div>

        <div className="mx-auto mt-8 grid max-w-3xl gap-2 sm:grid-cols-2 sm:gap-8">
          <motion.p
            {...drift(-32)}
            className="text-lg sm:text-right"
            style={{ color: 'var(--mk-text-muted)' }}
          >
            Every round is free.
          </motion.p>
          <motion.p
            {...drift(32)}
            className="text-lg sm:text-left"
            style={{ color: 'var(--mk-text-muted)' }}
          >
            The rivalry is forever.
          </motion.p>
        </div>

        <Link href="/auth/signup" className="mk-btn mk-btn-primary mt-10">
          Create a tournament
        </Link>
      </div>
    </section>
  )
}
