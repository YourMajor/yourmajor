'use server'

import { redirect } from 'next/navigation'
import { getUser, isTournamentAdmin } from '@/lib/auth'
import { consumeProCredit } from '@/lib/stripe'

export async function redeemProCredit(tournamentId: string, slug: string) {
  const user = await getUser()
  if (!user) throw new Error('Unauthorized')

  // The action id ships in the client bundle, so tournamentId is caller-controlled:
  // bind the credit only to a tournament the caller actually administers.
  if (!(await isTournamentAdmin(user.id, tournamentId))) {
    throw new Error('Forbidden')
  }

  const consumed = await consumeProCredit(user.id, tournamentId)
  if (!consumed) throw new Error('No available Pro credits')

  redirect(`/${slug}?upgraded=true`)
}
