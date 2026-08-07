'use client'

import { useReducedMotion } from 'motion/react'
import { GrainGradient } from '@paper-design/shaders-react'
import { CountUp } from '@/components/motion/CountUp'
import { ScrollReveal } from '@/components/motion/ScrollReveal'

/**
 * A full-width band of product-truthful figures over a slow shader field.
 * Every number here is a fact of the product, not a metric: handicap
 * systems shipped, the player ceiling, holes scored live, the price of
 * starting. Invented counts (customers, events, growth) do not exist and
 * are banned by PRODUCT.md.
 *
 * The GrainGradient is motion texture, not fake photography: deep greens
 * with a whisper of gold, slow enough to read as grass in wind. Its colors
 * are the DESIGN.md tokens flattened to literals because canvas uniforms
 * cannot read CSS variables. Reduced motion freezes it to a still field.
 */

const STATS = [
  { to: 4, label: 'Handicap systems', suffix: '' },
  { to: 144, label: 'Players per event', suffix: '' },
  { to: 18, label: 'Holes scored live', suffix: '' },
  { to: 0, label: 'To start', prefix: '$' },
]

export function StatsBand() {
  const reduce = useReducedMotion()

  return (
    <section
      id="stats"
      className="relative mt-24 overflow-hidden lg:mt-32"
      style={{
        borderTop: '1px solid var(--mk-rule-gold)',
        borderBottom: '1px solid var(--mk-rule-gold)',
        background: 'var(--mk-green-raised)',
      }}
    >
      <div className="absolute inset-0 opacity-45" aria-hidden>
        <GrainGradient
          style={{ width: '100%', height: '100%' }}
          colorBack="oklch(0.21 0.045 155)"
          colors={['oklch(0.27 0.055 155)', 'oklch(0.32 0.06 155)', 'oklch(0.72 0.11 78 / 0.25)']}
          shape="wave"
          softness={0.9}
          intensity={0.18}
          noise={0.3}
          speed={reduce ? 0 : 0.35}
        />
      </div>

      <div className="mk-container relative grid grid-cols-2 gap-y-12 py-16 lg:grid-cols-4 lg:py-20">
        {STATS.map((stat, i) => (
          <ScrollReveal key={stat.label} direction="up" delay={i * 80} duration={600}>
            <div className="text-center">
              <CountUp
                to={stat.to}
                prefix={stat.prefix ?? ''}
                suffix={stat.suffix ?? ''}
                duration={1100}
                className="mk-data text-5xl lg:text-6xl"
              />
              <p
                className="mt-3 text-[0.6875rem] font-semibold uppercase tracking-[0.14em]"
                style={{ color: 'var(--mk-text-subtle)' }}
              >
                {stat.label}
              </p>
            </div>
          </ScrollReveal>
        ))}
      </div>
    </section>
  )
}
