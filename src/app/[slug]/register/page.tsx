import { redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/utils/supabase/server'
import { getUser } from '@/lib/auth'
import { getTournamentTier } from '@/lib/stripe'
import { TIER_LIMITS } from '@/lib/tiers'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { TournamentMessage } from '@/components/ui/tournament-message'
import { Lock, ShieldX, ShieldCheck, Mail, Users } from 'lucide-react'

export default async function RegisterPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ token?: string }>
}) {
  const [{ slug }, sp] = await Promise.all([params, searchParams])
  const token = sp.token ?? null

  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  if (!authUser) redirect(`/auth/login?next=/${slug}/register${token ? `?token=${token}` : ''}`)

  const [tournament, dbUser] = await Promise.all([
    prisma.tournament.findUnique({
      where: { slug },
      include: {
        _count: { select: { players: true } },
        rounds: {
          take: 1,
          orderBy: { roundNumber: 'asc' },
          include: { course: { include: { teeOptions: { orderBy: { name: 'asc' } } } } },
        },
      },
    }),
    getUser(),
  ])

  if (!tournament) return null

  // Registration cutoff:
  // - Open tournaments: allow registration through ACTIVE status (until end date passes or COMPLETED)
  // - Invite-only tournaments: close registration once ACTIVE
  const isOpen = tournament.isOpenRegistration
  const endDatePassed = tournament.endDate && new Date() > new Date(tournament.endDate)

  if (tournament.status === 'COMPLETED' || (!isOpen && tournament.status === 'ACTIVE') || (isOpen && endDatePassed)) {
    return (
      <TournamentMessage
        icon={Lock}
        heading="Registration Closed"
        description={tournament.status === 'COMPLETED'
          ? 'This tournament has been completed. Registration is no longer available.'
          : 'This tournament has already started. Registration is no longer available.'}
        backHref={`/${slug}`}
      />
    )
  }

  // Invite-only: require valid token or matching email
  let resolvedToken = token
  if (!tournament.isOpenRegistration) {
    if (token) {
      // Validate the provided token
      const invitation = await prisma.invitation.findUnique({
        where: { token },
        select: { id: true, acceptedAt: true, tournamentId: true },
      })

      if (!invitation || invitation.tournamentId !== tournament.id) {
        return (
          <TournamentMessage
            icon={ShieldX}
            heading="Invalid Invitation"
            description="This invitation link is invalid or has expired."
            backHref={`/${slug}`}
          />
        )
      }

      if (invitation.acceptedAt) {
        return (
          <TournamentMessage
            icon={ShieldCheck}
            heading="Invitation Already Used"
            description="This invitation has already been accepted."
            backHref={`/${slug}`}
          />
        )
      }

    } else if (dbUser?.email) {
      // No token — check if the user's email matches a pending invitation
      const emailInvitation = await prisma.invitation.findFirst({
        where: {
          tournamentId: tournament.id,
          email: dbUser.email,
          acceptedAt: null,
        },
        select: { token: true },
      })

      if (emailInvitation) {
        resolvedToken = emailInvitation.token
      } else {
        return (
          <TournamentMessage
            icon={Mail}
            heading="Invitation Required"
            description="This tournament requires an invitation. Please use the link from your invite email."
            backHref={`/${slug}`}
          />
        )
      }
    } else {
      return (
        <TournamentMessage
          icon={Mail}
          heading="Invitation Required"
          description="This tournament requires an invitation. Please use the link from your invite email."
          backHref={`/${slug}`}
        />
      )
    }
  }

  // Already registered → redirect to hub
  if (dbUser) {
    const existing = await prisma.tournamentPlayer.findUnique({
      where: { tournamentId_userId: { tournamentId: tournament.id, userId: dbUser.id } },
    })
    if (existing) redirect(`/${slug}`)
  }

  // Player limit enforcement based on tier
  const tier = await getTournamentTier(tournament.id)
  const maxPlayers = TIER_LIMITS[tier].maxPlayers
  if (tournament._count.players >= maxPlayers) {
    return (
      <TournamentMessage
        icon={Users}
        heading="Tournament Full"
        description={`This tournament has reached the ${maxPlayers}-player limit for its current plan. The organizer can upgrade to allow more players.`}
        backHref={`/${slug}`}
      />
    )
  }

  // Fetch user's profile handicap for pre-fill
  const userProfile = dbUser
    ? await prisma.playerProfile.findUnique({
        where: { userId: dbUser.id },
        select: { handicap: true },
      })
    : null
  const profileHandicap = userProfile?.handicap ?? 0

  // Tee options from the first configured round's course
  const firstRoundTees = tournament.rounds[0]?.course.teeOptions ?? []
  const hasDynamicTees = firstRoundTees.length > 0

  async function register(formData: FormData) {
    'use server'
    const supabase2 = await createClient()
    const { data: { user: au } } = await supabase2.auth.getUser()
    if (!au?.email) redirect('/auth/login')

    const dbU = await prisma.user.findUnique({ where: { email: au.email } })
    if (!dbU) redirect('/auth/login')

    const tee = formData.get('tee') as string
    const handicap = parseFloat(formData.get('handicap') as string) || 0
    const inviteToken = formData.get('inviteToken') as string | null

    const t = await prisma.tournament.findUnique({ where: { slug } })
    if (!t) return

    // Final registration cutoff check
    // Open tournaments allow registration during ACTIVE (until end date)
    const tEndDatePassed = t.endDate && new Date() > new Date(t.endDate)
    if (t.status === 'COMPLETED') redirect(`/${slug}`)
    if (t.status === 'ACTIVE' && !t.isOpenRegistration) redirect(`/${slug}`)
    if (t.status === 'ACTIVE' && t.isOpenRegistration && tEndDatePassed) redirect(`/${slug}`)

    await prisma.tournamentPlayer.upsert({
      where: { tournamentId_userId: { tournamentId: t.id, userId: dbU.id } },
      create: { tournamentId: t.id, userId: dbU.id, tee, handicap },
      update: { tee, handicap },
    })

    if (inviteToken) {
      await prisma.invitation.updateMany({
        where: { token: inviteToken, tournamentId: t.id, acceptedAt: null },
        data: { acceptedAt: new Date(), userId: dbU.id },
      })
    }

    redirect(`/${slug}`)
  }

  return (
    <main className="max-w-md mx-auto px-4 py-10">
      <div className="mb-4 rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm space-y-1">
        <p className="font-heading font-bold text-foreground">{tournament.name}</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {tournament.rounds[0]?.course && (
            <span>{tournament.rounds[0].course.name}</span>
          )}
          <span>{tournament._count.players} player{tournament._count.players !== 1 ? 's' : ''} registered</span>
          {tournament.startDate && (
            <span>{new Date(tournament.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
          )}
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="font-heading">Join Tournament</CardTitle>
          <CardDescription>
            Register for <strong>{tournament.name}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={register} className="space-y-5">
            {resolvedToken && <input type="hidden" name="inviteToken" value={resolvedToken} />}

            <div className="space-y-2">
              <Label htmlFor="tee">Preferred Tee</Label>
              <select
                id="tee"
                name="tee"
                defaultValue={hasDynamicTees ? firstRoundTees[0].id : 'WHITE'}
                className="flex h-11 md:h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              >
                {hasDynamicTees
                  ? firstRoundTees.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))
                  : (
                    <>
                      <option value="BLACK">Black (Championship)</option>
                      <option value="BLUE">Blue</option>
                      <option value="WHITE">White</option>
                      <option value="GOLD">Gold (Senior)</option>
                      <option value="RED">Red (Forward)</option>
                    </>
                  )
                }
              </select>
              <p className="text-xs text-muted-foreground">
                {hasDynamicTees
                  ? "Tees available at this tournament's course."
                  : 'Tees will be confirmed once courses are set up.'}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="handicap">Handicap Index</Label>
              <Input id="handicap" name="handicap" type="number" step="0.1" min="0" max="54" defaultValue={profileHandicap} />
              <p className="text-xs text-muted-foreground">Enter 0 if playing scratch.</p>
            </div>

            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="agreeTerms"
                name="agreeTerms"
                required
                className="mt-1 h-5 w-5 shrink-0 rounded border-input accent-[var(--color-primary)]"
              />
              <label htmlFor="agreeTerms" className="text-xs text-muted-foreground leading-relaxed">
                I agree to the{' '}
                <Link href="/terms" target="_blank" className="underline text-foreground hover:text-primary">Terms of Use</Link>
                {' '}and{' '}
                <Link href="/privacy" target="_blank" className="underline text-foreground hover:text-primary">Privacy Policy</Link>.
              </label>
            </div>

            <Button type="submit" className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 text-white">
              Join Tournament
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
