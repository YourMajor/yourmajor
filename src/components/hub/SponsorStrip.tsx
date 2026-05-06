import Image from 'next/image'
import { getEffectiveSponsor } from '@/lib/sponsor'

/**
 * Sponsor attribution shown above the leaderboard. Renders nothing if no
 * sponsor is configured at the tournament or root level.
 *
 * Two layouts:
 *   - With banner: full-width hero image with "Presented by [logo] [name]"
 *     overlaid centered, dark scrim ensures legibility regardless of image.
 *   - Without banner: the original inline "Presented by [logo|name]" strip.
 */
export async function SponsorStrip({ tournamentId }: { tournamentId: string }) {
  const sponsor = await getEffectiveSponsor(tournamentId)
  if (!sponsor) return null

  const attribution = (
    <span className="inline-flex items-center gap-2">
      <span className="uppercase tracking-wider text-[10px]">Presented by</span>
      {sponsor.logoUrl && (
        <Image
          src={sponsor.logoUrl}
          alt={sponsor.name}
          width={64}
          height={20}
          className="h-5 w-auto object-contain"
          unoptimized
        />
      )}
      <span className="font-medium">{sponsor.name}</span>
    </span>
  )

  if (sponsor.bannerUrl) {
    const overlay = (
      <div className="relative w-full h-28 sm:h-32 rounded-lg overflow-hidden mb-3">
        <Image
          src={sponsor.bannerUrl}
          alt=""
          fill
          sizes="(max-width: 640px) 100vw, 800px"
          className="object-cover"
          unoptimized
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 from-0% to-transparent to-45%" />
        <div className="absolute inset-x-0 bottom-0 p-3 flex justify-center text-white text-xs">
          {attribution}
        </div>
      </div>
    )
    return sponsor.link ? (
      <a
        href={sponsor.link}
        target="_blank"
        rel="noopener noreferrer sponsored"
        className="block hover:opacity-90 transition-opacity"
      >
        {overlay}
      </a>
    ) : (
      overlay
    )
  }

  // No banner: original inline strip — show logo OR name (logo wins) to keep
  // the existing compact look for sponsors that haven't uploaded a banner.
  const inline = (
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
          {inline}
        </a>
      ) : (
        inline
      )}
    </div>
  )
}
