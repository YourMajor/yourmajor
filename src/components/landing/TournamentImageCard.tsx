'use client'

import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const STATUS_LABEL: Record<string, string> = {
  REGISTRATION: 'Registration Open',
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

interface TournamentImageCardProps {
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

export function TournamentImageCard({
  slug,
  name,
  description,
  logo,
  status,
  startDate,
  endDate,
  playerCount,
  imageVariant = 'default',
}: TournamentImageCardProps) {
  const isLive = status === 'ACTIVE'

  return (
    <Link href={`/${slug}`} className="block group">
      <Card className="overflow-hidden border-0 shadow-sm hover:shadow-lg transition-shadow duration-300">
        {/* Image area — placeholder gradient */}
        <div className={`${IMAGE_CLASSES[imageVariant]} relative h-44 sm:h-52`}>
          {/* Subtle pattern overlay */}
          <svg className="absolute inset-0 w-full h-full opacity-[0.07]" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id={`dots-${slug}`} x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1" fill="white" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill={`url(#dots-${slug})`} />
          </svg>

          {/* Centered logo or initial */}
          <div className="absolute inset-0 flex items-center justify-center">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logo}
                alt=""
                className="w-20 h-20 rounded-full object-cover border-2 border-white/20 opacity-80 group-hover:opacity-100 transition-opacity"
              />
            ) : (
              <span className="text-white/25 text-6xl font-heading font-bold select-none">
                {name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          {/* Status badge overlay */}
          <div className="absolute top-3 right-3">
            {isLive ? (
              <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold text-white uppercase tracking-wider bg-black/40 backdrop-blur-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                Live
              </span>
            ) : (
              <Badge variant="secondary" className="bg-white/90 text-foreground text-[10px] font-semibold backdrop-blur-sm">
                {STATUS_LABEL[status] ?? status}
              </Badge>
            )}
          </div>
        </div>

        {/* Content area */}
        <CardContent className="pt-4 pb-5 px-5">
          <h3 className="font-heading text-lg font-semibold tracking-tight line-clamp-2 group-hover:text-primary transition-colors">
            {name}
          </h3>
          {description && (
            <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2">
              {description}
            </p>
          )}
          <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
            <span>{formatDateRange(startDate, endDate)}</span>
            <span>&middot;</span>
            <span>{playerCount} player{playerCount !== 1 ? 's' : ''}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
