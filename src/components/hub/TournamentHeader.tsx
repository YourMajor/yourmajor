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
  headerImage: string | null
  status: string
  startDate: Date | null
  endDate: Date | null
  slug: string
}

export function TournamentHeader({ name, logo, headerImage, status, startDate, endDate, slug }: Props) {
  const fmt = (d: Date) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const isLive = status === 'ACTIVE'

  return (
    <div className="relative overflow-hidden rounded-b-2xl">
      {/* Background: primary color + optional banner at 30% opacity */}
      <div className="absolute inset-0 tournament-header" />
      {headerImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={headerImage}
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-30 pointer-events-none"
        />
      )}

      <div className="relative pt-10 pb-8 sm:pt-12 sm:pb-10 px-4 max-w-5xl mx-auto">
        <div className="flex flex-col items-center text-center">
          {/* Large logo — dynamically sized */}
          <Link href={`/${slug}`} aria-label={`${name} home`}>
            <div className="tournament-logo-badge w-24 h-24 sm:w-32 sm:h-32 md:w-40 md:h-40 rounded-full flex items-center justify-center overflow-hidden">
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt={name} className="w-full h-full object-cover" />
              ) : (
                <span
                  className="w-full h-full flex items-center justify-center text-4xl sm:text-5xl md:text-6xl font-heading font-bold text-white"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  {name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
          </Link>

          {/* Tournament name */}
          <h1 className="text-2xl sm:text-3xl font-heading font-bold leading-tight mt-4 tracking-tight text-white">
            {name}
          </h1>

          {/* Date + status */}
          <div className="flex items-center gap-2.5 mt-2">
            {startDate && (
              <p className="text-xs sm:text-sm text-white/60">
                {fmt(startDate)}{endDate ? ` \u2013 ${fmt(endDate)}` : ''}
              </p>
            )}
            {isLive ? (
              <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold text-white uppercase tracking-wider bg-white/15">
                <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                Live
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full border border-white/20 px-2.5 py-0.5 text-[11px] font-semibold text-white/60 uppercase tracking-wider">
                {STATUS_LABELS[status] ?? status}
              </span>
            )}
          </div>

          {/* Accent divider */}
          <div className="w-12 h-0.5 rounded-full mt-4" style={{ backgroundColor: 'var(--color-accent)' }} />
        </div>
      </div>
    </div>
  )
}
