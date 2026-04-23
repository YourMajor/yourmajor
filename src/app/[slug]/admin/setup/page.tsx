import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { ColorDonutForm } from '@/components/ui/color-donut-form'
import { DeleteTournamentButton } from './DeleteTournamentButton'
import { ResetDraftButton } from './ResetDraftButton'
import { updateTournament } from './actions'
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

  const updateTournamentAction = updateTournament.bind(null, tournament.id, slug, tournament.logo, tournament.headerImage)

  const fmt = (d: Date | null) => (d ? new Date(d).toISOString().split('T')[0] : '')

  return (
    <main className="max-w-2xl mx-auto px-4 py-6 sm:p-6 space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href={`/${slug}/admin`} className="hover:text-foreground transition-colors">Admin</Link>
          {' › '}Settings
        </p>
        <h1 className="text-2xl font-heading font-bold">Tournament Setup</h1>
      </div>

      <form action={updateTournamentAction} className="space-y-6">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                className="native-select flex h-11 md:h-9 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-base md:text-sm shadow-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25"
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
            <div className="space-y-2">
              <Label htmlFor="headerImage">Banner Image</Label>
              <p className="text-xs text-muted-foreground">Displayed at 30% opacity behind your brand color in the header bar. Wide landscape images work best.</p>
              {tournament.headerImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={tournament.headerImage} alt="Banner" className="h-16 w-full object-cover rounded-md mb-2" />
              )}
              <Input id="headerImage" name="headerImage" type="file" accept="image/*" />
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
              className="native-select flex h-11 md:h-9 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-base md:text-sm shadow-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25 disabled:opacity-50 disabled:cursor-not-allowed"
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
                className="w-full sm:w-24"
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
                className="w-full sm:w-24"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="distributionMode">Distribution Method</Label>
              <select
                id="distributionMode"
                name="distributionMode"
                defaultValue={tournament.distributionMode}
                disabled={powerupsLocked}
                className="native-select flex h-11 md:h-9 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-base md:text-sm shadow-sm outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25 disabled:opacity-50 disabled:cursor-not-allowed"
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
