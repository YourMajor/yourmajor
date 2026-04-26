import Image from 'next/image'
import { getEffectiveSponsor } from '@/lib/sponsor'

/**
 * Unobtrusive sponsor attribution shown above the leaderboard.
 * Renders nothing if no sponsor is configured at the tournament or root level.
 */
export async function SponsorStrip({ tournamentId }: { tournamentId: string }) {
  const sponsor = await getEffectiveSponsor(tournamentId)
  if (!sponsor) return null

  const content = (
    <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
      <span className="uppercase tracking-wider text-[10px]">Presented by</span>
      {sponsor.logoUrl ? (
        <Image
          src={sponsor.logoUrl}
          alt={sponsor.name}
          width={64}
          height={20}
          className="h-5 w-auto object-contain"
          unoptimized
        />
      ) : (
        <span className="font-medium text-foreground">{sponsor.name}</span>
      )}
    </div>
  )

  return (
    <div className="flex justify-center py-2 mb-2">
      {sponsor.link ? (
        <a
          href={sponsor.link}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="hover:opacity-80 transition-opacity"
        >
          {content}
        </a>
      ) : (
        content
      )}
    </div>
  )
}
