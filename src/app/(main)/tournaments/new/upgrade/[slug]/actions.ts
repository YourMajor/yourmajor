'use server'

import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth'
import { consumeProCredit } from '@/lib/stripe'

export async function redeemProCredit(tournamentId: string, slug: string) {
  const user = await getUser()
  if (!user) throw new Error('Unauthorized')

  const consumed = await consumeProCredit(user.id, tournamentId)
  if (!consumed) throw new Error('No available Pro credits')

  redirect(`/${slug}?upgraded=true`)
}
