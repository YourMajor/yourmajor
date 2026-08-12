import { ScrollReveal } from '@/components/motion/ScrollReveal'
import { SheetSweep } from '@/components/motion/SheetSweep'

/**
 * The organizer's chapter. Everything here names a real control that ships
 * under /[slug]/admin (setup, scores, groups, invites, communications); no
 * mocked dashboard, no invented capability, per DESIGN.md's no-fake-
 * screenshots rule. The bone plate is set as a committee sheet: ruled rows
 * in the scorecard idiom, one row per control.
 *
 * Server component, zero JS. Reveals reuse ScrollReveal, which animates from
 * a visible default and zeroes its transition under reduced motion.
 */

const CONTROLS: Array<{ name: string; detail: string }> = [
  {
    name: 'Registration',
    detail: 'Open or close entries with one switch, with a deadline if you want one.',
  },
  {
    name: 'Formats and rounds',
    detail: 'Set the scoring format and build each round before play starts.',
  },
  {
    name: 'Groups and pairings',
    detail: 'Arrange the field into groups for every round.',
  },
  {
    name: 'Announcements',
    detail: 'Post updates that reach the whole field at once.',
  },
  {
    name: 'Score control',
    detail: 'Correct any card while the round is live.',
  },
  {
    name: 'Invites',
    detail: 'Share a join code or invite players directly.',
  },
]

export function AdminChapter() {
  return (
    <section id="admin" className="mt-16 lg:mt-32">
      <div className="mk-container">
        {/* Same studio-band idiom as the lead-change chapter: a deep panel
            on the page ground, gold-ruled. */}
        <div
          className="grid items-start gap-10 lg:grid-cols-12 lg:gap-14"
          style={{
            background: 'var(--mk-green-deep)',
            border: '1px solid color-mix(in oklch, var(--mk-gold) 45%, transparent)',
            borderRadius: 'var(--mk-radius-lg)',
            padding: 'clamp(1.75rem, 4vw, 3.5rem)',
            boxShadow: 'var(--mk-shadow-plate)',
          }}
        >
          <ScrollReveal className="lg:col-span-5">
            <h2>Run it like a committee</h2>
            <p
              className="mt-4 max-w-[46ch] text-base leading-relaxed"
              style={{ color: 'var(--mk-text-muted)' }}
            >
              Every organizer control lives in one admin room, so the person
              running the event is never the last to know what changed.
            </p>
            <p
              className="mt-5 max-w-[46ch] text-base leading-relaxed"
              style={{ color: 'var(--mk-text-muted)' }}
            >
              Admins do not have to play. Run the event from the clubhouse, or
              captain it from inside the field.
            </p>
          </ScrollReveal>

          <ScrollReveal className="lg:col-span-7" delay={80}>
            <div
              className="mk-sheet-trace p-6 lg:p-8"
              style={{
                background: 'var(--mk-bone)',
                borderRadius: 'var(--mk-radius-md)',
                boxShadow: 'var(--mk-shadow-plate)',
              }}
            >
              <SheetSweep />
              <div
                className="flex items-baseline justify-between pb-3"
                style={{ borderBottom: '2px solid var(--mk-gold)' }}
              >
                <span
                  className="mk-label"
                  style={{ color: 'var(--mk-ink)' }}
                >
                  Committee sheet
                </span>
                <span
                  className="mk-data text-sm"
                  style={{ color: 'color-mix(in oklch, var(--mk-ink) 60%, transparent)' }}
                >
                  {CONTROLS.length} controls
                </span>
              </div>

              {CONTROLS.map((control, i) => (
                <div
                  key={control.name}
                  className="flex flex-col gap-1 py-3.5 sm:flex-row sm:items-baseline sm:gap-4"
                  style={{
                    borderBottom:
                      i < CONTROLS.length - 1 ? '1px solid var(--mk-rule-ink)' : undefined,
                  }}
                >
                  <span
                    className="w-40 shrink-0 text-sm font-semibold"
                    style={{ color: 'var(--mk-ink)' }}
                  >
                    {control.name}
                  </span>
                  <span
                    className="text-sm leading-relaxed"
                    style={{ color: 'color-mix(in oklch, var(--mk-ink) 72%, transparent)' }}
                  >
                    {control.detail}
                  </span>
                </div>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  )
}
