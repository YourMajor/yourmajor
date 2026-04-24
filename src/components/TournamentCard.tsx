import Link from 'next/link'
import Image from 'next/image'
import { Card, CardContent } from '@/components/ui/card'
import { TournamentCardMenu } from '@/components/TournamentCardMenu'
import { CalendarClock } from 'lucide-react'

const STATUS_LABEL: Record<string, string> = {
  REGISTRATION: 'Upcoming',
  ACTIVE: 'Live',
  COMPLETED: 'Completed',
}

const HCP_LABEL: Record<string, string> = {
  NONE: 'No Handicap',
  WHS: 'WHS',
  STABLEFORD: 'Stableford',
  CALLAWAY: 'Callaway',
  PEORIA: 'Peoria',
}

export interface TournamentCardData {
  id: string
  slug: string
  name: string
  description: string | null
  handicapSystem: string
  status: string
  startDate: Date | null
  endDate: Date | null
  primaryColor: string
  accentColor: string
  logo: string | null
  headerImage: string | null
  registrationDeadline: Date | null
  registrationClosed: boolean
  isOpenRegistration: boolean
  tournamentType: string
  isLeague: boolean
  leagueEndDate: Date | null
  parentTournamentId: string | null
  rounds: { course: { name: string; par: number } }[]
  _count: { players: number; rounds: number }
}

export function TournamentCard({
  t,
  showAdmin,
  isRegistered,
  inviteToken,
}: {
  t: TournamentCardData
  showAdmin: boolean
  isRegistered?: boolean
  inviteToken?: string
}) {
  const isInvite = !!inviteToken && !isRegistered
  const canRegister = !isRegistered && !t.registrationClosed && t.status !== 'COMPLETED'

  const fmtDate = (d: Date | string) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const dateRange = t.startDate && t.endDate
    ? `${fmtDate(t.startDate)} – ${fmtDate(t.endDate)}`
    : t.startDate ? fmtDate(t.startDate) : null

  const courseName = t.rounds[0]?.course?.name
  const coursePar = t.rounds[0]?.course?.par

  return (
    <div className="relative">
      <Link href={`/${t.slug}`} className="block">
        <Card
          className={`hover:shadow-md transition-all cursor-pointer overflow-hidden !py-0 !gap-0${isInvite ? ' ring-2' : ''}`}
          style={isInvite ? { '--tw-ring-color': t.accentColor } as React.CSSProperties : undefined}
        >
          {/* Branded header strip */}
          <div
            className="relative px-3 py-2.5 flex items-center"
            style={{
              background: t.headerImage
                ? `linear-gradient(to top, ${t.primaryColor}ee, ${t.primaryColor}cc), url(${t.headerImage}) center/cover no-repeat`
                : `linear-gradient(135deg, ${t.primaryColor}, ${t.primaryColor}dd)`,
            }}
          >
            {/* Accent stripe */}
            <div
              className="absolute top-0 left-0 right-0 h-[2px]"
              style={{ backgroundColor: t.accentColor }}
            />

            {/* Logo + Name */}
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              {t.logo ? (
                <Image
                  src={t.logo}
                  alt=""
                  width={40}
                  height={40}
                  className="h-9 w-9 sm:h-10 sm:w-10 rounded-full object-cover shrink-0 border-2"
                  style={{ borderColor: t.accentColor }}
                />
              ) : (
                <div
                  className="h-9 w-9 sm:h-10 sm:w-10 rounded-full flex items-center justify-center text-base font-heading font-bold text-white shrink-0 border-2"
                  style={{ backgroundColor: `${t.primaryColor}80`, borderColor: t.accentColor }}
                >
                  {t.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="font-heading font-semibold text-white truncate text-sm sm:text-base">{t.name}</p>
                <p className="text-[11px] text-white/70 truncate">
                  {courseName ? `${courseName} (Par ${coursePar})` : `${t._count.players} player${t._count.players !== 1 ? 's' : ''}`}
                </p>
              </div>
            </div>

            {/* Status badge — top right corner */}
            <div className="absolute top-1.5 right-2">
              {isInvite ? (
                <span className="inline-flex items-center shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide bg-amber-400/90 text-amber-950">
                  Invited
                </span>
              ) : t.status === 'ACTIVE' ? (
                <span className="inline-flex items-center gap-1.5 shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white bg-green-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                  Live
                </span>
              ) : t.status !== 'REGISTRATION' ? (
                <span className="inline-flex items-center shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide bg-white/20 text-white">
                  {STATUS_LABEL[t.status] ?? t.status}
                </span>
              ) : null}
            </div>

            {/* Register button — uses <a> to avoid nested <Link> inside outer <Link> */}
            {(canRegister || isInvite) && (
              <a
                href={`/${t.slug}/register${inviteToken ? `?token=${inviteToken}` : ''}`}
                onClick={(e) => e.stopPropagation()}
                className="relative z-10 shrink-0 ml-3 inline-flex items-center rounded-md px-3 py-1.5 text-xs font-bold transition-colors bg-white hover:bg-white/90"
                style={{ color: t.primaryColor }}
              >
                {isInvite ? 'Accept Invite' : 'Register'}
              </a>
            )}
          </div>

          {/* Card body */}
          <CardContent className="py-2.5 space-y-1.5">
            {/* Tags — date, players, handicap, rounds */}
            <div className="flex flex-wrap items-center gap-1.5">
              {dateRange && (
                <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                  {dateRange}
                </span>
              )}
              <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                {t._count.players} player{t._count.players !== 1 ? 's' : ''}
              </span>
              <span
                className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-md text-white"
                style={{ backgroundColor: t.primaryColor }}
              >
                {HCP_LABEL[t.handicapSystem] ?? t.handicapSystem}
              </span>
              {t._count.rounds > 0 && (
                <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                  {t._count.rounds} round{t._count.rounds !== 1 ? 's' : ''}
                </span>
              )}
              {t.registrationClosed && t.status !== 'COMPLETED' && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                  <CalendarClock className="w-3 h-3" />
                  Closed
                </span>
              )}
            </div>

            {/* Description */}
            {t.description && (
              <p className="text-xs text-muted-foreground line-clamp-2">{t.description}</p>
            )}
          </CardContent>
        </Card>
      </Link>

      {/* Admin menu — bottom right of card */}
      {showAdmin && (
        <div className="absolute bottom-1.5 right-1.5 z-20">
          <TournamentCardMenu
            slug={t.slug}
            tournamentId={t.id}
            tournamentName={t.name}
            showRenew={t.status === 'COMPLETED'}
          />
        </div>
      )}
    </div>
  )
}
