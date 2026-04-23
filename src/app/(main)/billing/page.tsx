import { redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button-variants'
import { Receipt, Crown, Zap, Users } from 'lucide-react'
import { ManageSubscriptionButton } from './ManageSubscriptionButton'

export const metadata = {
  title: 'Billing — YourMajor',
}

export default async function BillingPage() {
  const user = await getUser()
  if (!user) redirect('/auth/login?next=/billing')

  const purchases = await prisma.purchase.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    include: {
      tournament: {
        select: { name: true, slug: true },
      },
    },
  })

  const hasStripeCustomer = !!user.stripeCustomerId
  const activeLeague = purchases.find(
    (p) => p.type === 'LEAGUE' && p.status === 'ACTIVE'
  )
  const activeClub = purchases.find(
    (p) => p.type === 'CLUB' && p.status === 'ACTIVE'
  )

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-bold">Billing</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your purchases and subscription.
        </p>
      </div>

      {/* Active Subscription */}
      {activeLeague ? (
        <Card className="border-primary/30">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-primary" />
              <CardTitle>The Tour — Active</CardTitle>
            </div>
            <CardDescription>
              {activeLeague.expiresAt
                ? `Annual pass — expires ${new Date(activeLeague.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                : 'Active'}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            {hasStripeCustomer && <ManageSubscriptionButton />}
          </CardContent>
        </Card>
      ) : activeClub ? (
        <Card className="border-blue-500/30">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-500" />
              <CardTitle>The Club — Active</CardTitle>
            </div>
            <CardDescription>
              Monthly subscription — 4 tournaments per month
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            {hasStripeCustomer && <ManageSubscriptionButton />}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed border-2 border-border shadow-none">
          <CardContent className="py-6 flex flex-col items-center text-center">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-2">
              <Crown className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="font-heading font-semibold text-sm">No active subscription</p>
            <p className="text-xs text-muted-foreground mt-1">
              Upgrade to The Club or The Tour for more tournaments.
            </p>
            <Link
              href="/pricing"
              className={buttonVariants({ size: 'sm' }) + ' mt-3'}
            >
              View Plans
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Purchase History */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Receipt className="w-4 h-4 text-muted-foreground" />
          <h2 className="font-heading font-semibold text-lg">Purchase History</h2>
        </div>

        {purchases.length === 0 ? (
          <p className="text-sm text-muted-foreground">No purchases yet.</p>
        ) : (
          <div className="space-y-2">
            {purchases.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-lg border border-border px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  {p.type === 'EVENT' ? (
                    <Zap className="w-4 h-4 text-accent shrink-0" />
                  ) : p.type === 'CLUB' ? (
                    <Users className="w-4 h-4 text-blue-500 shrink-0" />
                  ) : (
                    <Crown className="w-4 h-4 text-primary shrink-0" />
                  )}
                  <div>
                    <p className="text-sm font-medium">
                      {p.type === 'EVENT'
                        ? `Pro — ${p.tournament?.name ?? 'Tournament'}`
                        : p.type === 'CLUB'
                        ? 'The Club — Monthly'
                        : 'The Tour — Annual'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(p.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">
                    ${(p.amount / 100).toFixed(2)}
                  </span>
                  <Badge
                    variant={
                      p.status === 'ACTIVE'
                        ? 'default'
                        : p.status === 'CANCELLED'
                        ? 'destructive'
                        : 'secondary'
                    }
                  >
                    {p.status.toLowerCase()}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
