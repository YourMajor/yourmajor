import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { supabaseAdmin } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { ColorDonutForm } from '@/components/ui/color-donut-form'
import { DeleteTournamentButton } from './DeleteTournamentButton'
import { ResetDraftButton } from './ResetDraftButton'

export default async function TournamentSetup({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const tournament = await prisma.tournament.findUnique({ where: { slug } })
  if (!tournament) return null

  // Check if powerups have already been distributed (draft started or cards dealt)
  const draft = await prisma.draft.findUnique({ where: { tournamentId: tournament.id } })
  const dealtPowerupCount = await prisma.playerPowerup.count({
    where: { tournamentPlayer: { tournamentId: tournament.id } },
  })
  const powerupsLocked = !!(draft?.status === 'ACTIVE' || draft?.status === 'COMPLETED' || dealtPowerupCount > 0)

  // Check if any scores have been submitted
  const scoreCount = await prisma.score.count({
    where: { round: { tournamentId: tournament.id } },
  })
  const hasScores = scoreCount > 0
  const isActive = tournament.status === 'ACTIVE'
  const isCompleted = tournament.status === 'COMPLETED'

  async function updateTournament(formData: FormData) {
    'use server'
    const { slug: currentSlug } = await params

    const name = formData.get('name') as string
    const newSlug = (formData.get('slug') as string).toLowerCase().replace(/[^a-z0-9-]/g, '-')
    const primaryColor = formData.get('primaryColor') as string
    const accentColor = formData.get('accentColor') as string
    const requestedStatus = formData.get('status') as string
    const isOpenRegistration = formData.get('isOpenRegistration') === 'on'
    const requestedHandicap = formData.get('handicapSystem') as string

    // Re-fetch current state server-side for guards
    const currentTournament = await prisma.tournament.findUnique({ where: { id: tournament!.id } })
    const serverScoreCount = await prisma.score.count({
      where: { round: { tournamentId: tournament!.id } },
    })
    const serverHasScores = serverScoreCount > 0

    // Guard: don't allow handicap system change once scores exist
    const handicapSystem = serverHasScores ? currentTournament!.handicapSystem : requestedHandicap

    // Guard: validate status transitions
    const currentStatus = currentTournament!.status
    let status = requestedStatus
    if (status === 'REGISTRATION' && serverHasScores) {
      status = currentStatus
    }
    if (currentStatus === 'COMPLETED' && status === 'REGISTRATION') {
      status = currentStatus
    }

    // If powerups are locked (draft started or cards dealt), preserve existing values
    const currentDraft = await prisma.draft.findUnique({ where: { tournamentId: tournament!.id } })
    const currentDealtCount = await prisma.playerPowerup.count({
      where: { tournamentPlayer: { tournamentId: tournament!.id } },
    })
    const isLocked = !!(currentDraft?.status === 'ACTIVE' || currentDraft?.status === 'COMPLETED' || currentDealtCount > 0)

    const powerupsEnabled = isLocked ? currentTournament!.powerupsEnabled : formData.get('powerupsEnabled') === 'on'
    const powerupsPerPlayer = isLocked ? currentTournament!.powerupsPerPlayer : (parseInt(formData.get('powerupsPerPlayer') as string) || 3)
    const maxAttacksPerPlayer = isLocked ? currentTournament!.maxAttacksPerPlayer : (parseInt(formData.get('maxAttacksPerPlayer') as string) || 1)
    const distributionMode = isLocked ? currentTournament!.distributionMode : (formData.get('distributionMode') as string || 'DRAFT')
    const startDate = formData.get('startDate') as string
    const endDate = formData.get('endDate') as string
    const logoFile = formData.get('logo') as File

    let logoUrl = tournament!.logo

    if (logoFile?.size > 0) {
      const ext = logoFile.name.split('.').pop()
      const path = `${tournament!.id}.${ext}`
      const buffer = Buffer.from(await logoFile.arrayBuffer())

      const { error } = await supabaseAdmin.storage
        .from('logos')
        .upload(path, buffer, { contentType: logoFile.type, upsert: true })

      if (!error) {
        const { data } = supabaseAdmin.storage.from('logos').getPublicUrl(path)
        logoUrl = data.publicUrl
      }
    }

    await prisma.tournament.update({
      where: { id: tournament!.id },
      data: {
        name,
        slug: newSlug,
        primaryColor,
        accentColor,
        status: status as 'REGISTRATION' | 'ACTIVE' | 'COMPLETED',
        isOpenRegistration,
        handicapSystem: handicapSystem as 'NONE' | 'WHS' | 'STABLEFORD' | 'CALLAWAY' | 'PEORIA',
        powerupsEnabled,
        powerupsPerPlayer,
        maxAttacksPerPlayer,
        distributionMode: distributionMode as 'DRAFT' | 'RANDOM',
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        logo: logoUrl,
      },
    })

    // Cache champion when status changes to COMPLETED
    if (status === 'COMPLETED' && currentTournament!.status !== 'COMPLETED') {
      try {
        const { getLeaderboard } = await import('@/lib/scoring')
        const standings = await getLeaderboard(tournament!.id)
        const champion = standings.find((s) => s.rank === 1)
        if (champion) {
          const tp = await prisma.tournamentPlayer.findUnique({
            where: { id: champion.tournamentPlayerId },
            select: { userId: true },
          })
          await prisma.tournament.update({
            where: { id: tournament!.id },
            data: {
              championUserId: tp?.userId ?? null,
              championName: champion.playerName,
            },
          })
        }
      } catch {
        // Non-critical
      }
    }

    revalidatePath(`/${newSlug}/admin/setup`)

    if (newSlug !== currentSlug) {
      redirect(`/${newSlug}/admin/setup`)
    }
  }

  const fmt = (d: Date | null) => (d ? new Date(d).toISOString().split('T')[0] : '')

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href={`/${slug}/admin`} className="hover:text-foreground transition-colors">Admin</Link>
          {' › '}Settings
        </p>
        <h1 className="text-2xl font-heading font-bold">Tournament Setup</h1>
      </div>

      <form action={updateTournament} className="space-y-6">
        {/* ── Basic Info ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Basic Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" defaultValue={tournament.name} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">URL Slug</Label>
              <Input id="slug" name="slug" defaultValue={tournament.slug} required />
              <p className="text-xs text-muted-foreground">
                Tournament URL: yourdomain.com/<strong>{tournament.slug}</strong>
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input id="startDate" name="startDate" type="date" defaultValue={fmt(tournament.startDate)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input id="endDate" name="endDate" type="date" defaultValue={fmt(tournament.endDate)} />
              </div>
            </div>
            {(isActive || isCompleted) && (
              <p className="text-xs text-muted-foreground">
                Changing dates on a live or completed tournament may affect auto-status transitions. The tournament will not revert to Registration automatically.
              </p>
            )}
          </CardContent>
        </Card>

        {/* ── Status & Registration ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status &amp; Registration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {hasScores && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Scores have been submitted. Status cannot be reverted to Registration, and some changes may affect the leaderboard.
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                name="status"
                defaultValue={tournament.status}
                className="flex h-11 md:h-9 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-base md:text-sm shadow-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25"
              >
                {/* Only show REGISTRATION if no scores exist */}
                {!hasScores && <option value="REGISTRATION">Registration Open</option>}
                <option value="ACTIVE">Active (Live)</option>
                <option value="COMPLETED">Completed</option>
              </select>
              <div className="text-xs text-muted-foreground space-y-1 pt-1">
                <p><span className="font-medium">Registration Open</span> — Published. Players can find and register.</p>
                <p><span className="font-medium">Active (Live)</span> — Scoring is open. Auto-set when round day arrives, or use &ldquo;Go Live&rdquo; on the hub.</p>
                <p><span className="font-medium">Completed</span> — All rounds finished. Auto-set the day after the last round.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <input
                id="isOpenRegistration"
                name="isOpenRegistration"
                type="checkbox"
                defaultChecked={tournament.isOpenRegistration}
                className="h-4 w-4"
              />
              <Label htmlFor="isOpenRegistration">Open registration (anyone can join via link)</Label>
            </div>
          </CardContent>
        </Card>

        {/* ── Branding ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Branding</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="logo">Logo</Label>
              {tournament.logo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={tournament.logo} alt="Logo" className="h-10 object-contain mb-2" />
              )}
              <Input id="logo" name="logo" type="file" accept="image/*" />
            </div>
            <Separator />
            <ColorDonutForm
              defaultPrimary={tournament.primaryColor}
              defaultAccent={tournament.accentColor}
            />
          </CardContent>
        </Card>

        {/* ── Handicap System ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Handicap System</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {hasScores && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Scores have been submitted. Changing the handicap system would alter how the leaderboard is calculated.
              </div>
            )}
            <Label htmlFor="handicapSystem">System</Label>
            <select
              id="handicapSystem"
              name="handicapSystem"
              defaultValue={tournament.handicapSystem}
              disabled={hasScores}
              className="flex h-11 md:h-9 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-base md:text-sm shadow-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="WHS">World Handicap System (WHS)</option>
              <option value="STABLEFORD">Stableford</option>
              <option value="CALLAWAY">Callaway</option>
              <option value="PEORIA">Peoria</option>
            </select>
          </CardContent>
        </Card>

        {/* ── Powerups ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Powerup System</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {powerupsLocked && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Powerups have already been drafted or dealt. These settings are locked to prevent data inconsistencies.
              </div>
            )}
            <div className="flex items-center justify-between">
              <Label htmlFor="powerupsEnabled">Enable Powerups</Label>
              <input
                id="powerupsEnabled"
                name="powerupsEnabled"
                type="checkbox"
                defaultChecked={tournament.powerupsEnabled}
                disabled={powerupsLocked}
                className="h-4 w-4 disabled:opacity-50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="powerupsPerPlayer">Powerups Per Player</Label>
              <Input
                id="powerupsPerPlayer"
                name="powerupsPerPlayer"
                type="number"
                min={1}
                max={10}
                defaultValue={tournament.powerupsPerPlayer}
                disabled={powerupsLocked}
                className="w-24"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxAttacksPerPlayer">Max Attack Cards Per Player</Label>
              <Input
                id="maxAttacksPerPlayer"
                name="maxAttacksPerPlayer"
                type="number"
                min={0}
                max={10}
                defaultValue={tournament.maxAttacksPerPlayer}
                disabled={powerupsLocked}
                className="w-24"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="distributionMode">Distribution Method</Label>
              <select
                id="distributionMode"
                name="distributionMode"
                defaultValue={tournament.distributionMode}
                disabled={powerupsLocked}
                className="flex h-11 md:h-9 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-base md:text-sm shadow-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="DRAFT">Draft</option>
                <option value="RANDOM">Random Deal</option>
              </select>
            </div>
          </CardContent>
        </Card>

        <Button type="submit" className="w-full">Save Changes</Button>
      </form>

      {/* ── Danger Zone ── */}
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-base text-destructive">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {(draft?.status === 'ACTIVE' || draft?.status === 'COMPLETED') && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Reset the powerup draft back to setup. All picks will be deleted and players will lose their drafted cards.
              </p>
              <ResetDraftButton tournamentId={tournament.id} />
            </div>
          )}
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Permanently delete this tournament and all associated data. This cannot be undone.
            </p>
            <DeleteTournamentButton
              tournamentId={tournament.id}
              tournamentName={tournament.name}
            />
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
