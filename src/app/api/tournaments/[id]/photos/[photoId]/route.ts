import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUser, isTournamentAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; photoId: string }> },
) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, photoId } = await params

  if (!(await isTournamentAdmin(user.id, id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const photo = await prisma.tournamentPhoto.findUnique({ where: { id: photoId } })
  if (!photo || photo.tournamentId !== id) {
    return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
  }

  // Extract storage path from public URL (everything after "tournament-photos/")
  const marker = 'tournament-photos/'
  const idx = photo.url.indexOf(marker)
  if (idx !== -1) {
    const storagePath = photo.url.slice(idx + marker.length)
    await supabaseAdmin.storage.from('tournament-photos').remove([storagePath])
  }

  await prisma.tournamentPhoto.delete({ where: { id: photoId } })

  return NextResponse.json({ success: true })
}
