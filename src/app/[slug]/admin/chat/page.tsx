import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'
import { ChatModerationPanel } from './ChatModerationPanel'

export default async function ChatModerationPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const user = await getUser()

  const tournament = await prisma.tournament.findUnique({
    where: { slug },
    select: { id: true, name: true },
  })
  if (!tournament || !user) return null

  const [bans, recentMessages] = await Promise.all([
    prisma.chatBan.findMany({
      where: {
        tournamentId: tournament.id,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: { user: { select: { id: true, name: true, email: true, image: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.tournamentMessage.findMany({
      where: { tournamentId: tournament.id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        content: true,
        isSystem: true,
        createdAt: true,
        userId: true,
        user: { select: { name: true, image: true } },
      },
    }),
  ])

  return (
    <main className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-heading font-bold">Chat Moderation</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage banned users and moderate messages</p>
      </div>

      <ChatModerationPanel
        tournamentId={tournament.id}
        initialBans={bans.map((b) => ({
          id: b.id,
          userId: b.user.id,
          userName: b.user.name ?? b.user.email,
          userImage: b.user.image,
          reason: b.reason,
          expiresAt: b.expiresAt?.toISOString() ?? null,
          createdAt: b.createdAt.toISOString(),
        }))}
        initialMessages={recentMessages.reverse().map((m) => ({
          id: m.id,
          content: m.content,
          isSystem: m.isSystem,
          createdAt: m.createdAt,
          userId: m.userId,
          user: m.user,
        }))}
      />
    </main>
  )
}
