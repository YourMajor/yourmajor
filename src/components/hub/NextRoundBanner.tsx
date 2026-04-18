interface Props {
  roundNumber: number
  date: Date | null
  status: string
}

export function NextRoundBanner({ roundNumber, date, status }: Props) {
  if (status === 'ACTIVE' || status === 'COMPLETED') return null

  const fmt = date
    ? new Date(date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : 'Date TBD'

  return (
    <div className="mx-4 mb-4 max-w-5xl md:mx-auto border-l-4 border-[var(--color-accent)] bg-[var(--color-accent)]/10 rounded-r-md px-4 py-3">
      <p className="text-sm font-semibold">
        {status === 'REGISTRATION' ? 'Registration Open' : 'Upcoming'}
      </p>
      <p className="text-sm text-muted-foreground mt-0.5">
        Round {roundNumber} · {fmt}
      </p>
    </div>
  )
}
