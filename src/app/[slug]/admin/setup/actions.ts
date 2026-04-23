'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { supabaseAdmin } from '@/lib/supabase'

export async function updateTournament(
  tournamentId: string,
  currentSlug: string,
  currentLogo: string | null,
  currentHeaderImage: string | null,
  formData: FormData,
) {
  const name = formData.get('name') as string
  const newSlug = (formData.get('slug') as string).toLowerCase().replace(/[^a-z0-9-]/g, '-')
  const primaryColor = formData.get('primaryColor') as string
  const accentColor = formData.get('accentColor') as string
  const requestedHandicap = formData.get('handicapSystem') as string

  // Re-fetch current state server-side for guards
  const currentTournament = await prisma.tournament.findUnique({ where: { id: tournamentId } })
  const serverScoreCount = await prisma.score.count({
    where: { round: { tournamentId } },
  })
  const serverHasScores = serverScoreCount > 0

  // Guard: don't allow handicap system change once scores exist
  const handicapSystem = serverHasScores ? currentTournament!.handicapSystem : requestedHandicap

  // If powerups are locked (draft started or cards dealt), preserve existing values
  const currentDraft = await prisma.draft.findUnique({ where: { tournamentId } })
  const currentDealtCount = await prisma.playerPowerup.count({
    where: { tournamentPlayer: { tournamentId } },
  })
  const isLocked = !!(currentDraft?.status === 'ACTIVE' || currentDraft?.status === 'COMPLETED' || currentDealtCount > 0)

  const powerupsEnabled = isLocked ? currentTournament!.powerupsEnabled : formData.get('powerupsEnabled') === 'on'
  const powerupsPerPlayer = isLocked ? currentTournament!.powerupsPerPlayer : (parseInt(formData.get('powerupsPerPlayer') as string) || 3)
  const maxAttacksPerPlayer = isLocked ? currentTournament!.maxAttacksPerPlayer : (parseInt(formData.get('maxAttacksPerPlayer') as string) || 1)
  const distributionMode = isLocked ? currentTournament!.distributionMode : (formData.get('distributionMode') as string || 'DRAFT')
  const startDate = formData.get('startDate') as string
  const endDate = formData.get('endDate') as string
  const logoFile = formData.get('logo') as File
  const headerFile = formData.get('headerImage') as File

  let logoUrl = currentLogo
  let headerImageUrl = currentHeaderImage

  if (logoFile?.size > 0) {
    const ext = logoFile.name.split('.').pop()
    const path = `${tournamentId}.${ext}`
    const buffer = Buffer.from(await logoFile.arrayBuffer())

    const { error } = await supabaseAdmin.storage
      .from('logos')
      .upload(path, buffer, { contentType: logoFile.type, upsert: true })

    if (!error) {
      const { data } = supabaseAdmin.storage.from('logos').getPublicUrl(path)
      logoUrl = `${data.publicUrl}?v=${Date.now()}`
    }
  }

  if (headerFile?.size > 0) {
    const ext = headerFile.name.split('.').pop()
    const path = `${tournamentId}.${ext}`
    const buffer = Buffer.from(await headerFile.arrayBuffer())

    const { error } = await supabaseAdmin.storage
      .from('headers')
      .upload(path, buffer, { contentType: headerFile.type, upsert: true })

    if (!error) {
      const { data } = supabaseAdmin.storage.from('headers').getPublicUrl(path)
      headerImageUrl = `${data.publicUrl}?v=${Date.now()}`
    }
  }

  await prisma.tournament.update({
    where: { id: tournamentId },
    data: {
      name,
      slug: newSlug,
      primaryColor,
      accentColor,
      handicapSystem: handicapSystem as 'NONE' | 'WHS' | 'STABLEFORD' | 'CALLAWAY' | 'PEORIA',
      powerupsEnabled,
      powerupsPerPlayer,
      maxAttacksPerPlayer,
      distributionMode: distributionMode as 'DRAFT' | 'RANDOM',
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      logo: logoUrl,
      headerImage: headerImageUrl,
    },
  })

  revalidatePath(`/${newSlug}`, 'layout')
  revalidatePath(`/${newSlug}/admin/setup`)

  if (newSlug !== currentSlug) {
    redirect(`/${newSlug}/admin/setup`)
  }
}
