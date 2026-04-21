import { redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'
import { getUserTier } from '@/lib/stripe'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ProfileEditForm } from './ProfileEditForm'
import { Trophy, Zap, Crown } from 'lucide-react'

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>
}) {
  const user = await getUser()
  if (!user) redirect('/auth/login')

  const { ref: tournamentRef } = await searchParams
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

  // Aggregate stats
  const totalHoles = allRows.length

  // Score distribution
  const eagles = allRows.filter(s => s.strokes - s.par <= -2).length
  const birdies = allRows.filter(s => s.strokes - s.par === -1).length
  const pars = allRows.filter(s => s.strokes - s.par === 0).length
  const bogeys = allRows.filter(s => s.strokes - s.par === 1).length
  const doubles = allRows.filter(s => s.strokes - s.par >= 2).length

  // Fairway stats
  const fairwayHoles = allRows.filter(s => s.par >= 4 && s.fairwayHit !== null)
  const fairwaysHit = fairwayHoles.filter(s => s.fairwayHit === true).length
  const fairwayPct = fairwayHoles.length > 0 ? Math.round((fairwaysHit / fairwayHoles.length) * 100) : null

  // GIR stats
  const girHoles = allRows.filter(s => s.gir !== null)
  const girsHit = girHoles.filter(s => s.gir === true).length
  const girPct = girHoles.length > 0 ? Math.round((girsHit / girHoles.length) * 100) : null

  // Putting stats
  const puttHoles = allRows.filter(s => s.putts !== null && s.putts !== undefined)
  const totalPutts = puttHoles.reduce((sum, s) => sum + (s.putts ?? 0), 0)
  const avgPutts = puttHoles.length > 0 ? (totalPutts / puttHoles.length).toFixed(1) : null

  // Par 3/4/5 performance
  const par3s = allRows.filter(s => s.par === 3)
  const par4s = allRows.filter(s => s.par === 4)
  const par5s = allRows.filter(s => s.par === 5)
  const avgVsPar = (rows: ScoreRow[]) => rows.length > 0 ? (rows.reduce((sum, s) => sum + (s.strokes - s.par), 0) / rows.length) : null
  const par3Avg = avgVsPar(par3s)
  const par4Avg = avgVsPar(par4s)
  const par5Avg = avgVsPar(par5s)

  // Overall avg score vs par
  // Scoring when on fairway vs off
  const onFairway = allRows.filter(s => s.fairwayHit === true)
  const offFairway = allRows.filter(s => s.fairwayHit === false)
  const avgOnFairway = avgVsPar(onFairway)
  const avgOffFairway = avgVsPar(offFairway)

  // Scoring when GIR vs miss
  const onGir = allRows.filter(s => s.gir === true)
  const offGir = allRows.filter(s => s.gir === false)
  const avgOnGir = avgVsPar(onGir)
  const avgOffGir = avgVsPar(offGir)

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

  // Insights
  const insights: Array<{ type: 'strength' | 'weakness'; area: string; message: string }> = []

  if (avgPutts !== null && parseFloat(avgPutts) <= 1.8 && puttHoles.length >= 36) {
    insights.push({ type: 'strength', area: 'Putting', message: `Averaging ${avgPutts} putts/hole across ${puttHoles.length} holes. Elite-level putting.` })
  } else if (avgPutts !== null && parseFloat(avgPutts) >= 2.2 && puttHoles.length >= 36) {
    insights.push({ type: 'weakness', area: 'Putting', message: `Averaging ${avgPutts} putts/hole. Reducing to 2.0 would save ~${((parseFloat(avgPutts) - 2.0) * puttHoles.length / completedRounds.length).toFixed(1)} strokes/round.` })
  }

  if (fairwayPct !== null && fairwayPct >= 70 && fairwayHoles.length >= 28) {
    insights.push({ type: 'strength', area: 'Accuracy', message: `Hitting ${fairwayPct}% of fairways across all rounds. Consistently finding the short grass.` })
  } else if (fairwayPct !== null && fairwayPct < 50 && fairwayHoles.length >= 28 && avgOnFairway !== null && avgOffFairway !== null) {
    const diff = avgOffFairway - avgOnFairway
    insights.push({ type: 'weakness', area: 'Off the Tee', message: `Only ${fairwayPct}% FIR. When missing, you score ${diff.toFixed(1)} strokes worse per hole. Focus on accuracy over distance.` })
  }

  if (girPct !== null && girPct >= 55 && girHoles.length >= 36) {
    insights.push({ type: 'strength', area: 'Approach Play', message: `${girPct}% greens in regulation. Strong iron play getting scoring opportunities.` })
  } else if (girPct !== null && girPct < 35 && girHoles.length >= 36 && avgOffGir !== null) {
    insights.push({ type: 'weakness', area: 'Approach Play', message: `${girPct}% GIR. When missing greens, averaging +${avgOffGir.toFixed(1)} vs par. Short game is being tested too often.` })
  }

  if (par5Avg !== null && par5Avg < 0.2 && par5s.length >= 8) {
    insights.push({ type: 'strength', area: 'Par 5 Scoring', message: `Averaging ${par5Avg >= 0 ? '+' : ''}${par5Avg.toFixed(2)} on par 5s. Taking advantage of scoring holes.` })
  }

  if (par3Avg !== null && par3Avg > 0.8 && par3s.length >= 8) {
    insights.push({ type: 'weakness', area: 'Par 3s', message: `Averaging +${par3Avg.toFixed(2)} on par 3s. Tee shot accuracy on shorter holes needs work.` })
  }

  const handicap = profile?.handicap ?? 0
  const initialName = profile?.displayName ?? user.name ?? user.email.split('@')[0]
  const initialAvatarUrl = profile?.avatar ?? user.image ?? null

  return (
    <main className="max-w-2xl mx-auto px-4 py-6 sm:px-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-heading font-bold">Profile</h1>
        {tournamentRef && (
          <Link
            href={`/${tournamentRef}`}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted transition-colors"
          >
            &larr; Back to Tournament
          </Link>
        )}
      </div>

      <ProfileEditForm
        initialName={initialName}
        initialEmail={user.email}
        initialAvatarUrl={initialAvatarUrl}
        initialHandicap={handicap}
        initialPhone={user.phone ?? ''}
        initialSmsNotifications={user.smsNotifications}
      />

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
              <p className="font-heading font-semibold text-sm">
                {userTier.tier === 'LEAGUE' ? 'Tour' : userTier.tier === 'PRO' ? 'Pro' : 'Free'} Plan
              </p>
              {userTier.tier === 'LEAGUE' && userTier.expiresAt && (
                <p className="text-xs text-muted-foreground">
                  Season expires {new Date(userTier.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              )}
              {userTier.tier === 'FREE' && (
                <p className="text-xs text-muted-foreground">
                  <Link href="/pricing" className="underline text-[var(--color-primary)]">Upgrade</Link> for more features
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
              <Link href="/billing" className="text-xs text-[var(--color-primary)] underline">
                Manage billing
              </Link>
            </>
          )}
        </CardContent>
      </Card>

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
                { label: 'Par 3s', avg: par3Avg, count: par3s.length },
                { label: 'Par 4s', avg: par4Avg, count: par4s.length },
                { label: 'Par 5s', avg: par5Avg, count: par5s.length },
              ].filter(d => d.count > 0).map(d => (
                <div key={d.label} className="rounded-lg border border-border p-2 sm:p-3 text-center">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{d.label}</p>
                  <p className={`text-lg font-bold font-heading ${d.avg !== null && d.avg < 0 ? 'text-red-600' : ''}`}>
                    {d.avg !== null ? (d.avg >= 0 ? '+' : '') + d.avg.toFixed(2) : '—'}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{d.count} holes</p>
                </div>
              ))}
            </div>

            {/* Key metrics */}
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              {fairwayPct !== null && (
                <div className="rounded-lg border border-border p-2 sm:p-3 text-center">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider">FIR</p>
                  <p className="text-lg font-bold font-heading">{fairwayPct}%</p>
                  <p className="text-[11px] text-muted-foreground">{fairwaysHit}/{fairwayHoles.length}</p>
                </div>
              )}
              {girPct !== null && (
                <div className="rounded-lg border border-border p-2 sm:p-3 text-center">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider">GIR</p>
                  <p className="text-lg font-bold font-heading">{girPct}%</p>
                  <p className="text-[11px] text-muted-foreground">{girsHit}/{girHoles.length}</p>
                </div>
              )}
              {avgPutts !== null && (
                <div className="rounded-lg border border-border p-2 sm:p-3 text-center">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Putts</p>
                  <p className="text-lg font-bold font-heading">{avgPutts}</p>
                  <p className="text-[11px] text-muted-foreground">per hole</p>
                </div>
              )}
            </div>

            {/* Score distribution */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Score Distribution</p>
              <div className="flex gap-1.5 flex-wrap">
                {[
                  { label: 'Eagles', count: eagles, color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
                  { label: 'Birdies', count: birdies, color: 'bg-red-100 text-red-700 border-red-300' },
                  { label: 'Pars', count: pars, color: 'bg-muted text-foreground border-border' },
                  { label: 'Bogeys', count: bogeys, color: 'bg-amber-100 text-amber-700 border-amber-300' },
                  { label: 'Double+', count: doubles, color: 'bg-muted text-muted-foreground border-border' },
                ].filter(d => d.count > 0).map(d => (
                  <div key={d.label} className={`px-2.5 py-1 rounded-full border text-xs font-medium ${d.color}`}>
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
                  <div className="rounded-lg border border-green-200 bg-green-50 p-2.5 text-center">
                    <p className="text-[11px] text-green-700 font-semibold">On Fairway</p>
                    <p className="text-base font-bold text-green-800">{avgOnFairway >= 0 ? '+' : ''}{avgOnFairway.toFixed(2)}</p>
                  </div>
                  <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-center">
                    <p className="text-[11px] text-red-700 font-semibold">Off Fairway</p>
                    <p className="text-base font-bold text-red-800">{avgOffFairway >= 0 ? '+' : ''}{avgOffFairway.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            )}

            {/* GIR vs miss scoring */}
            {avgOnGir !== null && avgOffGir !== null && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Scoring by GIR</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-green-200 bg-green-50 p-2.5 text-center">
                    <p className="text-[11px] text-green-700 font-semibold">Hit Green</p>
                    <p className="text-base font-bold text-green-800">{avgOnGir >= 0 ? '+' : ''}{avgOnGir.toFixed(2)}</p>
                  </div>
                  <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-center">
                    <p className="text-[11px] text-red-700 font-semibold">Missed Green</p>
                    <p className="text-base font-bold text-red-800">{avgOffGir >= 0 ? '+' : ''}{avgOffGir.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Insights */}
      {userTier.tier === 'FREE' ? (
        insights.length > 0 && (
          <Card className="border-dashed border-2 border-border shadow-none">
            <CardContent className="py-6 flex flex-col items-center text-center">
              <p className="font-heading font-semibold text-sm">Unlock Insights</p>
              <p className="text-xs text-muted-foreground mt-1">
                Upgrade to Pro or Tour to see personalized strengths, weaknesses, and improvement tips.
              </p>
              <Link
                href="/pricing"
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] text-white px-4 py-2 text-xs font-semibold hover:opacity-90 transition"
              >
                View Plans
              </Link>
            </CardContent>
          </Card>
        )
      ) : (
        insights.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-heading">Insights</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {insights.filter(i => i.type === 'strength').map((ins, i) => (
                <div key={i} className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg border border-green-200 bg-green-50">
                  <span className="text-green-600 text-sm mt-0.5 font-bold">+</span>
                  <div>
                    <p className="text-xs font-bold text-green-800">{ins.area}</p>
                    <p className="text-xs text-green-700 mt-0.5">{ins.message}</p>
                  </div>
                </div>
              ))}
              {insights.filter(i => i.type === 'weakness').map((ins, i) => (
                <div key={i} className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg border border-amber-200 bg-amber-50">
                  <span className="text-amber-600 text-sm mt-0.5 font-bold">!</span>
                  <div>
                    <p className="text-xs font-bold text-amber-800">{ins.area}</p>
                    <p className="text-xs text-amber-700 mt-0.5">{ins.message}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )
      )}
    </main>
  )
}
