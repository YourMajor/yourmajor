import { Eye } from 'lucide-react'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'

export interface Watcher {
  id: string
  name: string | null
  image: string | null
}

interface Props {
  watchers: Watcher[]
}

const VISIBLE_COUNT = 8

function initials(name: string | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function WatchersStrip({ watchers }: Props) {
  if (watchers.length === 0) return null

  const visible = watchers.slice(0, VISIBLE_COUNT)
  const overflow = watchers.length - visible.length
  const allNames = watchers.map((w) => w.name ?? 'Anonymous').join(', ')

  return (
    <section className="mt-6 mx-2 sm:mx-0">
      <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
        <div className="flex items-center gap-2 mb-2 text-muted-foreground">
          <Eye className="w-4 h-4" />
          <span className="text-xs font-semibold uppercase tracking-wide">
            Watching ({watchers.length})
          </span>
        </div>
        <div
          className="flex flex-wrap items-center gap-x-3 gap-y-2"
          title={allNames}
        >
          {visible.map((w) => (
            <div key={w.id} className="flex items-center gap-1.5">
              <Avatar size="sm">
                {w.image ? <AvatarImage src={w.image} alt="" /> : null}
                <AvatarFallback>{initials(w.name)}</AvatarFallback>
              </Avatar>
              <span className="text-xs text-foreground/80">{w.name ?? 'Anonymous'}</span>
            </div>
          ))}
          {overflow > 0 && (
            <span className="text-xs text-muted-foreground italic">
              +{overflow} more
            </span>
          )}
        </div>
      </div>
    </section>
  )
}
