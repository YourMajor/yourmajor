import Link from 'next/link'
import { ScrollReveal } from '@/components/motion/ScrollReveal'

/**
 * The quiet chapter: recurring groups. Season standings, round history and
 * season-over-season stats are real, shipped product that no section was
 * selling, and they are the reason The Club and The Tour tiers exist. One
 * editorial strip, no numbers, because the honest numbers here belong to
 * the visitor's own group once they have a season behind them.
 */

const KEPT = [
  { title: 'Season standings', line: 'Every event in the season rolls into one table.' },
  { title: 'Round history', line: 'Each card, each round, kept and browsable.' },
  { title: 'Season over season', line: 'The same group, tracked year against year.' },
]

export function SeasonStrip() {
  return (
    <section className="mk-section pt-0">
      <div className="mk-container">
        <div className="grid gap-12 lg:grid-cols-12">
          <ScrollReveal direction="up" duration={600} className="lg:col-span-5">
            <div>
              <h2>The group that keeps score, keeps history</h2>
              <p
                className="mt-4 max-w-[46ch] text-base leading-relaxed lg:text-lg"
                style={{ color: 'var(--mk-text-muted)' }}
              >
                One tournament is a day out. A season is a rivalry. Standings
                carry across events, and next year the argument picks up where
                it left off.
              </p>
              <Link href="/pricing" className="mk-btn mk-btn-secondary mt-8">
                See season plans
              </Link>
            </div>
          </ScrollReveal>

          <div className="lg:col-span-6 lg:col-start-7">
            {KEPT.map((item, i) => (
              <ScrollReveal key={item.title} direction="up" delay={i * 70} duration={600}>
                <div
                  className="py-6"
                  style={{ borderTop: '1px solid var(--mk-rule-gold)' }}
                >
                  <h3 className="text-xl">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--mk-text-subtle)' }}>
                    {item.line}
                  </p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
