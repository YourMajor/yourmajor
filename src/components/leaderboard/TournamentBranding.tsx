import Link from 'next/link'

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  REGISTRATION: 'Registration Open',
  ACTIVE: 'Live',
  COMPLETED: 'Completed',
}

interface Props {
  name: string
  logo: string | null
  status: string
  startDate: Date | null
  endDate: Date | null
  slug: string
}

export function TournamentBranding({ name, logo, status, startDate, endDate, slug }: Props) {
  const fmt = (d: Date) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const isLive = status === 'ACTIVE'

  return (
    <div className="pt-8 pb-6 px-4 bg-background">
      <div className="max-w-5xl mx-auto flex flex-col items-center text-center">
        {/* Large logo with embossed badge treatment */}
        <Link href={`/${slug}`} aria-label={`${name} home`}>
          <div className="tournament-logo-badge w-24 h-24 sm:w-32 sm:h-32 rounded-full flex items-center justify-center overflow-hidden">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt={name} className="w-full h-full object-cover" />
            ) : (
              <span
                className="w-full h-full flex items-center justify-center text-4xl sm:text-5xl font-heading font-bold text-white"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                {name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
        </Link>

        {/* Tournament name — embossed text effect */}
        <h1 className="tournament-embossed-text text-2xl sm:text-3xl font-heading font-bold leading-tight mt-4 tracking-tight">
          {name}
        </h1>

        {/* Date + status */}
        <div className="flex items-center gap-2.5 mt-2">
          {startDate && (
            <p className="text-xs sm:text-sm text-muted-foreground">
              {fmt(startDate)}
              {endDate ? ` \u2013 ${fmt(endDate)}` : ''}
            </p>
          )}
          {isLive ? (
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold text-white uppercase tracking-wider"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-white/80 animate-pulse" />
              Live
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full border border-border px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              {STATUS_LABELS[status] ?? status}
            </span>
          )}
        </div>

        {/* Accent divider */}
        <div
          className="w-12 h-0.5 rounded-full mt-4"
          style={{ backgroundColor: 'var(--color-accent)' }}
        />
      </div>
    </div>
  )
}
