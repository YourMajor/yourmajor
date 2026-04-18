import Link from 'next/link'

const STATUS_LABEL: Record<string, string> = {
  REGISTRATION: 'Upcoming',
  ACTIVE: 'Live',
  COMPLETED: 'Completed',
}

const IMAGE_CLASSES: Record<string, string> = {
  default: 'tournament-card-image',
  alt: 'tournament-card-image-alt',
  gold: 'tournament-card-image-gold',
}

function formatDateRange(start: string | null, end: string | null) {
  if (!start) return 'Date TBD'
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  if (!end) return fmt(start)
  return `${fmt(start)} \u2013 ${fmt(end)}`
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
  imageVariant?: 'default' | 'alt' | 'gold'
}

export function LandingTournamentCard({
  slug,
  name,
  description,
  logo,
  status,
  startDate,
  endDate,
  playerCount,
  imageVariant = 'default',
}: LandingTournamentCardProps) {
  return (
    <div className="relative">
      <Link
        href={`/${slug}`}
        className="block rounded-lg bg-card text-sm text-card-foreground shadow-md hover:shadow-lg transition-shadow overflow-hidden"
      >
        {/* Status badge — top left */}
        <div className="absolute top-0 left-0 z-10">
          {status === 'ACTIVE' ? (
            <span className="inline-flex items-center gap-1.5 rounded-br-lg rounded-tl-lg px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white bg-green-600">
              <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
              Live
            </span>
          ) : (
            <span
              className={`inline-flex items-center rounded-br-lg rounded-tl-lg px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                status === 'REGISTRATION'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {STATUS_LABEL[status] ?? status}
            </span>
          )}
        </div>

        <div className="flex flex-col sm:flex-row">
          {/* Left: tournament info */}
          <div className="w-full sm:w-1/2 min-w-0 px-4 sm:px-6 py-4 flex items-center">
            <div className="flex items-center gap-3 min-w-0 pt-3">
              {logo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logo}
                  alt=""
                  className="h-10 w-10 rounded-full object-cover shrink-0"
                />
              )}
              <div className="min-w-0">
                <p className="text-lg font-heading font-bold truncate">{name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {playerCount} player{playerCount !== 1 ? 's' : ''}
                  {` \u00b7 ${formatDateRange(startDate, endDate)}`}
                </p>
                {description && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-3 sm:line-clamp-2">
                    {description}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Right: gradient image */}
          <div
            className={`${IMAGE_CLASSES[imageVariant]} relative w-full sm:w-1/2 min-h-[120px] sm:min-h-[100px]`}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-white/15 text-5xl font-heading font-bold select-none">
                {name.charAt(0).toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      </Link>
    </div>
  )
}
