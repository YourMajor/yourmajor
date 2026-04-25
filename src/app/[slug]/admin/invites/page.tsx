import { prisma } from '@/lib/prisma'
import { Mail, Check, Clock } from 'lucide-react'
import { InviteForm } from './InviteForm'
import { ResendButton } from './ResendButton'

export default async function InvitesPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const tournament = await prisma.tournament.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      tournamentType: true,
      invitations: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          phone: true,
          acceptedAt: true,
          createdAt: true,
        },
      },
    },
  })

  if (!tournament) return null

  const accepted = tournament.invitations.filter((i) => i.acceptedAt)
  const pending = tournament.invitations.filter((i) => !i.acceptedAt)

  return (
    <main className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-heading font-bold">Invite Players</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Send invitations by email. Players will receive a link to register.
        </p>
      </div>

      <InviteForm tournamentId={tournament.id} slug={tournament.slug} />

      {/* Pending invitations */}
      {pending.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            Pending ({pending.length})
          </h2>
          <div className="divide-y divide-border rounded-lg border border-border">
            {pending.map((inv) => (
              <div key={inv.id} className="flex items-center gap-3 px-4 py-3">
                <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-sm">{inv.email}</span>
                <span className="ml-auto flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {new Date(inv.createdAt).toLocaleDateString()}
                  </span>
                  <ResendButton invitationId={inv.id} />
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Accepted invitations */}
      {accepted.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Check className="w-4 h-4 text-green-600" />
            Accepted ({accepted.length})
          </h2>
          <div className="divide-y divide-border rounded-lg border border-border">
            {accepted.map((inv) => (
              <div key={inv.id} className="flex items-center gap-3 px-4 py-3">
                <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-sm">{inv.email}</span>
                <span className="ml-auto text-xs text-green-600">
                  Accepted {new Date(inv.acceptedAt!).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tournament.invitations.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          No invitations sent yet. Use the form above to invite players.
        </p>
      )}
    </main>
  )
}
