import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'
import { getUserTier } from '@/lib/stripe'
import { TIER_LIMITS } from '@/lib/tiers'
import { TeamClient } from './TeamClient'

export const metadata = {
  title: 'Team — YourMajor',
}

export default async function TeamPage() {
  const user = await getUser()
  if (!user) redirect('/auth/login?next=/team')

  const { tier } = await getUserTier(user.id)
  const totalSeats = TIER_LIMITS[tier].maxAdminSeats

  const links = await prisma.accountAdmin.findMany({
    where: { ownerUserId: user.id },
    include: { admin: { select: { email: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  })

  const coAdmins = links.map((l) => ({
    id: l.id,
    email: l.admin.email,
    name: l.admin.name,
    invitedEmail: l.invitedEmail,
    acceptedAt: l.acceptedAt,
  }))

  const remainingSeats = Math.max(0, totalSeats - 1 - coAdmins.length)

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10 space-y-2">
      <div>
        <h1 className="font-heading text-2xl font-bold">Team</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage co-admins on your account. Co-admins inherit admin rights on every tournament and league you own.
        </p>
      </div>
      <div className="pt-4">
        <TeamClient
          coAdmins={coAdmins}
          remainingSeats={remainingSeats}
          totalSeats={totalSeats}
          ownerEmail={user.email}
        />
      </div>
    </main>
  )
}
