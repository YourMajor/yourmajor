import Image from 'next/image'

interface TournamentHeaderBlockProps {
  name: string
  description: string | null
  logo: string | null
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

export function TournamentHeaderBlock({
  name,
  description,
  logo,
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
      className="mb-6 pb-5 border-b-2"
      style={{ borderColor: 'var(--color-accent)' }}
    >
      <div className="flex items-start gap-4 sm:gap-5">
        {logo && (
          <div className="relative shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden ring-1 ring-black/5 shadow-sm bg-muted">
            <Image src={logo} alt="" fill sizes="56px" className="object-cover" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-heading font-bold text-foreground leading-tight">
            {name}
          </h1>
          {description && (
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{description}</p>
          )}
        </div>
      </div>

      {(dateLabel || meta) && (
        <div className="mt-3 flex items-center gap-3 flex-wrap">
          {meta && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] font-semibold"
              style={{
                borderColor: 'color-mix(in oklab, var(--color-accent) 40%, transparent)',
                backgroundColor: 'color-mix(in oklab, var(--color-accent) 10%, transparent)',
                color: 'color-mix(in oklab, var(--color-accent) 50%, black)',
              }}
            >
              {meta.live && (
                <span className="relative flex w-1.5 h-1.5">
                  <span
                    className="absolute inset-0 rounded-full animate-ping opacity-75"
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
              className="text-[11px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: 'var(--color-primary)' }}
            >
              {dateLabel}
            </span>
          )}
        </div>
      )}
    </header>
  )
}
