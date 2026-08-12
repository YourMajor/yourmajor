import Link from 'next/link'
import Image from 'next/image'

const STATUS_LABEL: Record<string, string> = {
  REGISTRATION: 'Upcoming',
  ACTIVE: 'Live',
  COMPLETED: 'Completed',
}

function formatDateRange(start: string | null, end: string | null) {
  if (!start) return 'Date TBD'
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  if (!end) return fmt(start)
  return `${fmt(start)} – ${fmt(end)}`
}

interface LandingTournamentCardProps {
  slug: string
  name: string
  description: string | null
  logo: string | null
  status: string
  startDate: string | null
  endDate: string | null
  playerCount: number
  featured?: boolean
}

/**
 * A real tournament, on a bone plate. The previous version filled half the card
 * with a navy gradient and an outsized initial; DESIGN.md is explicit that a
 * gradient never stands in for a picture, so the card carries information only.
 *
 * Featured events are marked by the plate's own hairline turning gold and a
 * word in the meta line — not a second pill. One card already carries a
 * status chip, and two chips side by side is a badge shelf, not a card.
 */
export function LandingTournamentCard({
  slug,
  name,
  description,
  logo,
  status,
  startDate,
  endDate,
  playerCount,
  featured,
}: LandingTournamentCardProps) {
  const isLive = status === 'ACTIVE'

  return (
    <Link
      href={`/${slug}`}
      className="mk-plate mk-sheen block p-5 transition-shadow hover:shadow-[var(--mk-shadow-plate-hover)]"
      style={featured ? { borderColor: 'var(--mk-gold)' } : undefined}
    >
      <div className="flex items-start gap-4">
        {logo && (
          <Image
            src={logo}
            alt=""
            width={44}
            height={44}
            className="h-11 w-11 shrink-0 object-cover"
            style={{ borderRadius: 'var(--mk-radius-md)' }}
          />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0 truncate text-lg font-semibold" style={{ color: 'var(--mk-ink)' }}>
              {name}
            </p>

            <span
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 mk-label"
              style={{
                border: `1px solid ${isLive ? 'var(--mk-gold)' : 'var(--mk-rule-ink)'}`,
                color: isLive ? 'var(--mk-ink)' : 'var(--mk-over-par)',
              }}
            >
              {isLive && (
                <span
                  className="h-1.5 w-1.5 rounded-full animate-pulse motion-reduce:animate-none"
                  style={{ background: 'var(--mk-gold)' }}
                />
              )}
              {STATUS_LABEL[status] ?? status}
            </span>
          </div>

          <p className="mt-1.5 text-xs" style={{ color: 'var(--mk-over-par)' }}>
            {featured && (
              /* The darkened gold: bright gold on bone measures 2.2:1. */
              <span className="font-semibold" style={{ color: 'var(--mk-gold-on-bone)' }}>
                Featured ·{' '}
              </span>
            )}
            <span className="mk-data">{playerCount}</span> player
            {playerCount !== 1 ? 's' : ''}
            {` · ${formatDateRange(startDate, endDate)}`}
          </p>

          {description && (
            <p
              className="mt-2 line-clamp-2 text-sm leading-relaxed"
              style={{ color: 'var(--mk-over-par)' }}
            >
              {description}
            </p>
          )}
        </div>
      </div>
    </Link>
  )
}
