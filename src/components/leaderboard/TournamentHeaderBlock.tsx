import Image from 'next/image'

interface TournamentHeaderBlockProps {
  name: string
  description: string | null
  logo: string | null
  headerImage?: string | null
  startDate: Date | null
  endDate: Date | null
  status: string
}

function formatDate(d: Date) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function statusMeta(status: string): { label: string; live: boolean } | null {
  const s = status.toUpperCase()
  if (s === 'ACTIVE') return { label: 'Live', live: true }
  if (s === 'REGISTRATION') return { label: 'Registration Open', live: false }
  if (s === 'COMPLETED') return { label: 'Final', live: false }
  if (s === 'DRAFT') return { label: 'Draft', live: false }
  return null
}

/**
 * The Clubhouse Wall header. One framed plate for every tournament: the
 * header photograph (when the organizer set one) hangs behind the title
 * under a scrim mixed from the tournament's own primary — always darkened
 * toward black, so type stays bone-on-dark whatever the brand color.
 * Without a photograph the frame holds a quiet wash of the primary instead;
 * the geometry never changes between brandings.
 */
export function TournamentHeaderBlock({
  name,
  description,
  logo,
  headerImage = null,
  startDate,
  endDate,
  status,
}: TournamentHeaderBlockProps) {
  const meta = statusMeta(status)
  const dateLabel = startDate
    ? `${formatDate(startDate)}${endDate ? ` – ${formatDate(endDate)}` : ''}`
    : null

  return (
    <header
      className="relative mb-6 overflow-hidden rounded-lg"
      style={{ border: '1px solid color-mix(in oklab, var(--color-accent) 55%, transparent)' }}
    >
      {/* The hanging photograph, crushed dark under the brand's own color */}
      {headerImage ? (
        <>
          <Image
            src={headerImage}
            alt=""
            fill
            sizes="(max-width: 1024px) 100vw, 1024px"
            className="object-cover"
            priority
          />
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(to top, color-mix(in oklab, var(--color-primary) 40%, black) 0%, color-mix(in oklab, var(--color-primary) 45%, oklch(0 0 0 / 0.55)) 60%, color-mix(in oklab, var(--color-primary) 35%, oklch(0 0 0 / 0.35)) 100%)',
            }}
          />
        </>
      ) : (
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ background: 'color-mix(in oklab, var(--color-primary) 55%, black)' }}
        />
      )}

      <div className="relative px-5 py-6 sm:px-7 sm:py-8">
        <div className="flex items-start gap-4 sm:gap-5">
          {logo && (
            <div className="tournament-logo-badge relative shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden">
              <Image src={logo} alt="" fill sizes="64px" className="object-cover" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1
              className="text-2xl sm:text-3xl lg:text-4xl font-heading font-bold leading-tight"
              style={{ color: 'oklch(0.98 0.005 85)' }}
            >
              {name}
            </h1>
            {description && (
              <p className="text-sm mt-1 max-w-2xl" style={{ color: 'oklch(0.98 0.005 85 / 0.75)' }}>
                {description}
              </p>
            )}
          </div>
        </div>

        {(dateLabel || meta) && (
          <div className="mt-4 flex items-center gap-3 flex-wrap">
            {meta && (
              <span
                className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.6875rem] uppercase tracking-[0.14em] font-semibold"
                style={{
                  borderColor: 'color-mix(in oklab, var(--color-accent) 60%, transparent)',
                  backgroundColor: 'color-mix(in oklab, var(--color-accent) 18%, transparent)',
                  color: 'oklch(0.98 0.005 85)',
                }}
              >
                {meta.live && (
                  <span className="relative flex w-1.5 h-1.5">
                    <span
                      className="absolute inset-0 rounded-full motion-safe:animate-ping opacity-75"
                      style={{ backgroundColor: 'var(--color-accent)' }}
                    />
                    <span
                      className="relative rounded-full w-1.5 h-1.5"
                      style={{ backgroundColor: 'var(--color-accent)' }}
                    />
                  </span>
                )}
                {meta.label}
              </span>
            )}
            {dateLabel && (
              <span
                className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em]"
                style={{ color: 'oklch(0.98 0.005 85 / 0.75)' }}
              >
                {dateLabel}
              </span>
            )}
          </div>
        )}
      </div>

      {/* The frame's bottom rail: the accent as a rule, never a fill */}
      <div
        aria-hidden
        className="relative h-0.5 w-full"
        style={{ background: 'var(--color-accent)' }}
      />
    </header>
  )
}
