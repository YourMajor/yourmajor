interface MyGroup {
  name: string
  teeTime: Date | string | null
  startingHole: number | null
  memberNames: string[]
}

interface Props {
  myGroup: MyGroup
}

export function TeeTimeTile({ myGroup }: Props) {
  const teeTime = myGroup.teeTime ? new Date(myGroup.teeTime) : null

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="px-5 py-3 bg-[var(--color-primary)]/5 border-b border-border">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-primary)]">Your Tee Time</p>
      </div>
      <div className="px-5 py-4 space-y-2">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm font-semibold text-foreground">{myGroup.name}</p>
          {teeTime && (
            <p className="text-sm font-bold text-foreground">
              {teeTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </p>
          )}
        </div>
        {myGroup.startingHole && (
          <p className="text-xs text-muted-foreground">Starting on Hole {myGroup.startingHole}</p>
        )}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {myGroup.memberNames.map((name, i) => (
            <span key={i} className="text-xs px-2.5 py-1 rounded-full border border-border bg-muted/50">{name}</span>
          ))}
        </div>
      </div>
    </div>
  )
}
