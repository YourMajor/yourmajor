/**
 * A broadcast ticker of the scoring vocabulary the product actually ships:
 * formats and handicap systems, nothing invented. Set in Geist label style
 * between gold hairlines; one slow seamless CSS loop, a still row under
 * reduced motion. Server component: there is no JS here at all.
 */

const TERMS = [
  'Stroke play',
  'Match play',
  'Scramble',
  'WHS',
  'Stableford',
  'Callaway',
  'Peoria',
  'Gross',
  'Net',
  'Team play',
  'Flights',
  'Seasons',
]

export function FormatsMarquee() {
  const row = (ariaHidden: boolean) => (
    <div className="flex shrink-0 items-center" aria-hidden={ariaHidden || undefined}>
      {TERMS.map((term) => (
        <span key={term} className="flex items-center">
          <span
            className="whitespace-nowrap px-6 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] lg:px-8"
            style={{ color: 'var(--mk-text-subtle)' }}
          >
            {term}
          </span>
          <span
            aria-hidden
            className="h-1 w-1 rounded-full"
            style={{ background: 'var(--mk-gold)' }}
          />
        </span>
      ))}
    </div>
  )

  return (
    <div
      className="mt-24 overflow-hidden py-5 lg:mt-32"
      style={{
        borderTop: '1px solid var(--mk-rule-gold)',
        borderBottom: '1px solid var(--mk-rule-gold)',
      }}
      role="marquee"
      aria-label="Supported formats and handicap systems"
    >
      <div className="mk-marquee-track">
        {row(false)}
        {row(true)}
      </div>
    </div>
  )
}
