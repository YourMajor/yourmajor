import { redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'
import { getUserTier } from '@/lib/stripe'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ProfileEditForm } from './ProfileEditForm'
import { Trophy, Zap, Crown } from 'lucide-react'
import { IdentityHero } from '@/components/profile/IdentityHero'
import { ScoringTrend } from '@/components/profile/ScoringTrend'
import { StatSheet } from '@/components/insights/StatSheet'
import { computeRoundStats, statFindings } from '@/lib/round-stats'
import { PushNotificationManager } from '@/components/pwa/PushNotificationManager'
import { ThemeToggle } from '@/components/profile/ThemeToggle'

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; edit?: string }>
}) {
  const user = await getUser()
  if (!user) redirect('/auth/login')

  const { ref: tournamentRef, edit } = await searchParams
  const isEditing = edit === '1'
  const userTier = await getUserTier(user.id)

  const profile = await prisma.playerProfile.findUnique({ where: { userId: user.id } })
  const playerIds = await prisma.tournamentPlayer.findMany({
    where: { userId: user.id },
    select: { id: true },
  })
  const tpIds = playerIds.map((p) => p.id)

  const tournamentRoundCount = await prisma.score.groupBy({
    by: ['roundId'],
    where: { tournamentPlayerId: { in: tpIds } },
  })
  const standaloneCount = await prisma.standaloneRound.count({ where: { userId: user.id } })

  // Fetch ALL tournament scores for aggregate stats
  const allScores = await prisma.score.findMany({
    where: { tournamentPlayerId: { in: tpIds } },
    select: {
      strokes: true, putts: true, fairwayHit: true, gir: true,
      hole: { select: { number: true, par: true } },
      roundId: true,
    },
  })

  // Also fetch standalone round scores
  const standaloneScores = await prisma.standaloneScore.findMany({
    where: { round: { userId: user.id } },
    select: { strokes: true, putts: true, fairwayHit: true, gir: true, par: true, holeNumber: true, standaloneRoundId: true },
  })

  // Merge all scores into a uniform shape
  type ScoreRow = { strokes: number; par: number; putts: number | null; fairwayHit: boolean | null; gir: boolean | null; roundId: string }
  const allRows: ScoreRow[] = [
    ...allScores.map(s => ({ strokes: s.strokes, par: s.hole.par, putts: s.putts, fairwayHit: s.fairwayHit, gir: s.gir, roundId: s.roundId })),
    ...standaloneScores.map(s => ({ strokes: s.strokes, par: s.par, putts: s.putts, fairwayHit: s.fairwayHit, gir: s.gir, roundId: s.standaloneRoundId })),
  ]

  const handicap = profile?.handicap ?? 0
  const totalHoles = allRows.length

  // One shared module, so the career view and the per-round scorecard cannot
  // drift apart the way the two hand-rolled copies of this maths had.
  const careerStats = computeRoundStats(allRows)
  const careerFindings = statFindings(careerStats, handicap)

  const { eagle: eagles, birdie: birdies, par: pars, bogey: bogeys, double: doubles } = careerStats.counts

  const asPct = (r: { value: number } | null) => (r ? Math.round(r.value * 100) : null)
  const fairwayPct = asPct(careerStats.fairways)
  const girPct = asPct(careerStats.gir)
  const scramblingPct = asPct(careerStats.scrambling)
  const fairwayHoles = careerStats.fairways?.sample ?? 0
  const fairwaysHit = Math.round(((careerStats.fairways?.value ?? 0) * fairwayHoles))
  const girHoles = careerStats.gir?.sample ?? 0
  const girsHit = Math.round(((careerStats.gir?.value ?? 0) * girHoles))

  const par3Avg = careerStats.parType.par3?.value ?? null
  const par4Avg = careerStats.parType.par4?.value ?? null
  const par5Avg = careerStats.parType.par5?.value ?? null
  const par3Count = careerStats.parType.par3?.sample ?? 0
  const par4Count = careerStats.parType.par4?.sample ?? 0
  const par5Count = careerStats.parType.par5?.sample ?? 0

  // Conditional splits the module does not carry: scoring with and without the
  // fairway, and with and without the green.
  const avgVsPar = (rows: ScoreRow[]) => rows.length > 0 ? (rows.reduce((sum, s) => sum + (s.strokes - s.par), 0) / rows.length) : null
  const avgOnFairway = avgVsPar(allRows.filter(s => s.fairwayHit === true))
  const avgOffFairway = avgVsPar(allRows.filter(s => s.fairwayHit === false))
  const avgOnGir = avgVsPar(allRows.filter(s => s.gir === true))
  const avgOffGir = avgVsPar(allRows.filter(s => s.gir === false))

  // Round-level stats (best/worst/avg round)
  const roundGroups = new Map<string, ScoreRow[]>()
  for (const s of allRows) {
    const list = roundGroups.get(s.roundId) ?? []
    list.push(s)
    roundGroups.set(s.roundId, list)
  }
  const completedRounds = Array.from(roundGroups.values()).filter(r => r.length >= 18)
  const roundVsPars = completedRounds.map(r => r.reduce((sum, s) => sum + (s.strokes - s.par), 0))
  const bestRound = roundVsPars.length > 0 ? Math.min(...roundVsPars) : null
  const avgRound = roundVsPars.length > 0 ? (roundVsPars.reduce((a, b) => a + b, 0) / roundVsPars.length) : null

  const initialName = profile?.displayName ?? user.name ?? user.email.split('@')[0]
  const initialAvatarUrl = profile?.avatar ?? user.image ?? null

  const totalRounds = tournamentRoundCount.length + standaloneCount

  return (
    <>
    <IdentityHero
      displayName={initialName}
      avatarUrl={initialAvatarUrl}
      tier={userTier.tier}
      handicap={Number(handicap)}
      totalRounds={totalRounds}
      avgVsPar={avgRound}
      tournamentBackRef={tournamentRef ?? null}
      isEditing={isEditing}
    />

    <main className="max-w-2xl mx-auto px-4 py-6 sm:px-6 space-y-6">
      {isEditing && (
        <div id="profile-edit" className="scroll-mt-16">
          <ProfileEditForm
            initialName={initialName}
            initialEmail={user.email}
            initialHandicap={handicap}
            initialPhone={user.phone ?? ''}
            initialSmsNotifications={user.smsNotifications}
          />
        </div>
      )}

      {/* Membership */}
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-base font-heading">Membership</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              userTier.tier === 'LEAGUE'
                ? 'bg-primary/10'
                : userTier.tier === 'PRO'
                ? 'bg-accent/10'
                : 'bg-muted'
            }`}>
              {userTier.tier === 'LEAGUE' ? (
                <Crown className="w-5 h-5 text-primary" />
              ) : userTier.tier === 'PRO' ? (
                <Zap className="w-5 h-5 text-accent" />
              ) : (
                <Trophy className="w-5 h-5 text-muted-foreground" />
              )}
            </div>
            <div>
              <p className="font-heading text-sm">
                {userTier.tier === 'LEAGUE' ? 'Tour' : userTier.tier === 'PRO' ? 'Pro' : 'Free'} Plan
              </p>
              {userTier.tier === 'LEAGUE' && userTier.expiresAt && (
                <p className="text-xs text-muted-foreground">
                  Season expires {new Date(userTier.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              )}
              {userTier.tier === 'FREE' && (
                <p className="text-xs text-muted-foreground">
                  <Link href="/pricing" className="underline text-brand">Upgrade</Link> for more features
                </p>
              )}
            </div>
          </div>
          {userTier.proCredits > 0 && (
            <>
              <Separator className="mt-1" />
              <div className="flex justify-between text-sm pt-1">
                <span className="text-muted-foreground">Tournament Credits</span>
                <span className="font-medium">{userTier.proCredits}</span>
              </div>
            </>
          )}
          {userTier.tier !== 'FREE' && (
            <>
              <Separator />
              <Link href="/billing" className="text-xs text-brand underline">
                Manage billing
              </Link>
            </>
          )}
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card>
        <CardContent className="py-4">
          <ThemeToggle />
        </CardContent>
      </Card>

      {/* Notifications */}
      <PushNotificationManager
        vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null}
        initialPrefs={{
          notifyChatMessages: user.notifyChatMessages,
          notifyAdminAnnouncements: user.notifyAdminAnnouncements,
        }}
      />

      {/* Overview Stats */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-heading">Stats</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Tournament Rounds</span>
            <span className="font-medium">{tournamentRoundCount.length}</span>
          </div>
          <Separator />
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Solo Rounds</span>
            <span className="font-medium">{standaloneCount}</span>
          </div>
          <Separator />
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total Holes Played</span>
            <span className="font-medium">{totalHoles}</span>
          </div>
          {completedRounds.length > 0 && (
            <>
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Best Round (vs Par)</span>
                <span className="font-bold text-red-600">{bestRound !== null ? (bestRound >= 0 ? '+' : '') + bestRound : '—'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Average Round (vs Par)</span>
                <span className="font-medium">{avgRound !== null ? (avgRound >= 0 ? '+' : '') + avgRound.toFixed(1) : '—'}</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Performance Breakdown */}
      {totalHoles >= 18 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-heading">Performance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Par breakdown */}
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              {[
                { label: 'Par 3s', avg: par3Avg, count: par3Count },
                { label: 'Par 4s', avg: par4Avg, count: par4Count },
                { label: 'Par 5s', avg: par5Avg, count: par5Count },
              ].filter(d => d.count > 0).map(d => (
                <div key={d.label} className="rounded-lg border border-border p-2 sm:p-3 text-center">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{d.label}</p>
                  <p className={`text-lg font-heading ${d.avg !== null && d.avg < 0 ? 'text-score-birdie' : ''}`}>
                    {d.avg !== null ? (d.avg >= 0 ? '+' : '') + d.avg.toFixed(2) : '—'}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{d.count} holes</p>
                </div>
              ))}
            </div>

            {/* Key metrics. Putts are reported per green in regulation, not per
                hole — per hole rewards missing greens, which is backwards. */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2">
              {fairwayPct !== null && (
                <div className="rounded-lg border border-border p-2 sm:p-3 text-center">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider">FIR</p>
                  <p className="text-lg font-heading">{fairwayPct}%</p>
                  <p className="text-[11px] text-muted-foreground">{fairwaysHit}/{fairwayHoles}</p>
                </div>
              )}
              {girPct !== null && (
                <div className="rounded-lg border border-border p-2 sm:p-3 text-center">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider">GIR</p>
                  <p className="text-lg font-heading">{girPct}%</p>
                  <p className="text-[11px] text-muted-foreground">{girsHit}/{girHoles}</p>
                </div>
              )}
              {careerStats.puttsPerGir && (
                <div className="rounded-lg border border-border p-2 sm:p-3 text-center">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Putts</p>
                  <p className="text-lg font-heading">{careerStats.puttsPerGir.value.toFixed(2)}</p>
                  <p className="text-[11px] text-muted-foreground">per green hit</p>
                </div>
              )}
              {scramblingPct !== null && (
                <div className="rounded-lg border border-border p-2 sm:p-3 text-center">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Scrambling</p>
                  <p className="text-lg font-heading">{scramblingPct}%</p>
                  <p className="text-[11px] text-muted-foreground">up and down</p>
                </div>
              )}
            </div>

            {/* Score distribution */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Score Distribution</p>
              <div className="flex gap-1.5 flex-wrap">
                {[
                  { label: 'Eagles', count: eagles, tone: 'var(--score-eagle)' },
                  { label: 'Birdies', count: birdies, tone: 'var(--score-birdie)' },
                  { label: 'Pars', count: pars, tone: 'var(--score-par)' },
                  { label: 'Bogeys', count: bogeys, tone: 'var(--score-bogey)' },
                  { label: 'Double+', count: doubles, tone: 'var(--score-double)' },
                ].filter(d => d.count > 0).map(d => (
                  <div
                    key={d.label}
                    className="px-2.5 py-1 rounded-full border text-xs font-medium"
                    style={{
                      color: d.tone,
                      borderColor: `color-mix(in oklch, ${d.tone} 40%, var(--border))`,
                      background: `color-mix(in oklch, ${d.tone} 6%, var(--card))`,
                    }}
                  >
                    {d.count} {d.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Fairway vs off-fairway scoring */}
            {avgOnFairway !== null && avgOffFairway !== null && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Scoring by Fairway</p>
                <div className="grid grid-cols-2 gap-2">
                  <SplitPlate label="On Fairway" value={avgOnFairway} better />
                  <SplitPlate label="Off Fairway" value={avgOffFairway} />
                </div>
              </div>
            )}

            {/* GIR vs miss scoring */}
            {avgOnGir !== null && avgOffGir !== null && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Scoring by GIR</p>
                <div className="grid grid-cols-2 gap-2">
                  <SplitPlate label="Hit Green" value={avgOnGir} better />
                  <SplitPlate label="Missed Green" value={avgOffGir} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Insights */}
      {userTier.tier === 'FREE' ? (
        (careerFindings.length > 0 || roundVsPars.length >= 2) && (
          <Card className="border-dashed border-2 border-border shadow-none">
            <CardContent className="py-6 flex flex-col items-center text-center">
              <p className="font-heading text-sm">Unlock Insights</p>
              <p className="text-xs text-muted-foreground mt-1">
                Upgrade to Pro or Tour to see what your scoring is actually costing you, measured
                against players off your handicap.
              </p>
              <Link
                href="/pricing"
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg text-primary-foreground px-4 py-2 text-xs font-semibold hover:opacity-90 transition"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                View Plans
              </Link>
            </CardContent>
          </Card>
        )
      ) : (
        (careerFindings.length > 0 || roundVsPars.length >= 2) && (
          <Card>
            <CardContent className="space-y-3">
              <StatSheet findings={careerFindings} handicap={handicap} divided={false}>
                {roundVsPars.length >= 2 && <ScoringTrend roundVsPars={roundVsPars} />}
              </StatSheet>
            </CardContent>
          </Card>
        )
      )}
    </main>
    </>
  )
}

/** One side of a conditional scoring split — with the fairway vs without, and so on. */
function SplitPlate({ label, value, better }: { label: string; value: number; better?: boolean }) {
  const tone = better ? 'var(--success)' : 'var(--warning)'
  return (
    <div
      className="rounded-lg border p-2.5 text-center"
      style={{
        borderColor: `color-mix(in oklch, ${tone} 35%, var(--border))`,
        background: `color-mix(in oklch, ${tone} 6%, var(--card))`,
      }}
    >
      <p className="text-[11px] font-semibold text-muted-foreground">{label}</p>
      <p className="tabular-data text-base font-bold" style={{ color: tone }}>
        {value >= 0 ? '+' : ''}{value.toFixed(2)}
      </p>
    </div>
  )
}
