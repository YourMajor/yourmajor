'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getUser } from '@/lib/auth'
import { snapshotHandicapOnActivation } from '@/lib/handicap-snapshot'
import { safeNextPath } from '@/lib/safe-redirect'
import { registerHref, resolveRegistration, tournamentHref } from './registration'

// `confirmRegistration` must stay the ONLY export of this module: every export
// of a 'use server' file is a public HTTP endpoint. Shared helpers and types
// live in ./registration, which has no directive.

// Next deserializes server-action arguments with no runtime type check, and the
// TypeScript annotation is erased at build time, so the parameter is typed
// `unknown` and parsed here. Without this an attacker can POST
// `{ slug, token: { not: null } }`: an open-registration tournament skips token
// validation by design, so that object would reach `invitation.updateMany` as a
// Prisma StringFilter and re-assign every pending invitation for the tournament
// to the attacker.
//
// `slug` is `.min(1)` because `encodeURIComponent('')` is the empty string, so
// an empty slug builds the protocol-relative `//register`. `safeNextPath` on
// every redirect target below is the second layer of that same defence.
const ConfirmRegistrationInput = z.object({
  slug: z.string().min(1),
  token: z.string().nullable(),
})

/**
 * Perform the tournament registration the register page asks the user to
 * confirm.
 *
 * This used to happen during the page's GET render, which meant any top-level
 * cross-site navigation — Supabase session cookies are SameSite=Lax and ride
 * along with those — silently joined a logged-in victim to a tournament and
 * consumed their invitation. The write now needs an explicit POST the user
 * confirms.
 *
 * Nothing from the client is trusted: the caller's identity is re-derived from
 * the session and the entire eligibility chain is re-run server-side.
 */
export async function confirmRegistration(input: unknown): Promise<void> {
  const parsed = ConfirmRegistrationInput.safeParse(input)
  if (!parsed.success) return redirect('/')
  const { slug, token } = parsed.data

  const user = await getUser()
  if (!user) {
    return redirect(`/auth/login?next=${encodeURIComponent(safeNextPath(registerHref(slug, token), '/'))}`)
  }

  const resolution = await resolveRegistration({ slug, token, user })

  if (resolution.status === 'not-found') return redirect('/')
  if (resolution.status === 'redirect') return redirect(safeNextPath(resolution.href, '/'))
  // Send refusals back to the page, which renders the reason.
  if (resolution.status === 'refused') return redirect(safeNextPath(registerHref(slug, token), '/'))

  const { tournamentId, maxPlayers, profileHandicap } = resolution

  // Register inside a transaction with an atomic count re-check to prevent
  // race conditions where two users pass the above limit check simultaneously.
  const registered = await prisma.$transaction(async (tx) => {
    const freshCount = await tx.tournamentPlayer.count({
      where: { tournamentId },
    })
    if (freshCount >= maxPlayers) return false

    const tp = await tx.tournamentPlayer.upsert({
      where: { tournamentId_userId: { tournamentId, userId: user.id } },
      create: { tournamentId, userId: user.id, handicap: profileHandicap, isParticipant: true },
      update: { isParticipant: true },
    })

    // The update branch reached an existing row — a watcher, an admin, or an
    // earlier opt-out — which was created with the default 0 handicap and never
    // took a snapshot. Write one now; a row already holding a real handicap or
    // any scores is left untouched.
    await snapshotHandicapOnActivation(tx, tp.id, profileHandicap)

    if (token) {
      await tx.invitation.updateMany({
        where: { token, tournamentId, acceptedAt: null },
        data: { acceptedAt: new Date(), userId: user.id },
      })
    }

    return true
  })

  // Lost the race for the last seat — the page re-renders "Tournament Full".
  if (!registered) return redirect(safeNextPath(registerHref(slug, token), '/'))

  return redirect(safeNextPath(tournamentHref(slug), '/'))
}
