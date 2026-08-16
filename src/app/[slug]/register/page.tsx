import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { getUser } from '@/lib/auth'
import { safeNextPath } from '@/lib/safe-redirect'
import { TournamentMessage } from '@/components/ui/tournament-message'
import { Button } from '@/components/ui/button'
import { Lock, ShieldX, ShieldCheck, Mail, Users } from 'lucide-react'
import { registerHref, resolveRegistration, tournamentHref, type RefusalIcon } from './registration'
import { confirmRegistration } from './actions'

const REFUSAL_ICONS: Record<RefusalIcon, typeof Lock> = {
  closed: Lock,
  invalid: ShieldX,
  accepted: ShieldCheck,
  required: Mail,
  full: Users,
}

export default async function RegisterPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ token?: string }>
}) {
  const [{ slug }, sp] = await Promise.all([params, searchParams])
  const token = sp.token ?? null

  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  if (!authUser) return redirect(`/auth/login?next=${encodeURIComponent(safeNextPath(registerHref(slug, token), '/'))}`)

  const dbUser = await getUser()
  const resolution = await resolveRegistration({ slug, token, user: dbUser })

  if (resolution.status === 'not-found') return null
  if (resolution.status === 'redirect') return redirect(safeNextPath(resolution.href, '/'))

  if (resolution.status === 'refused') {
    return (
      <TournamentMessage
        icon={REFUSAL_ICONS[resolution.icon]}
        heading={resolution.heading}
        description={resolution.description}
        backHref={resolution.backHref}
      />
    )
  }

  // This render writes nothing. It used to run the registration transaction
  // inline, so any top-level cross-site navigation — Supabase session cookies
  // are SameSite=Lax and ride along with those — joined a logged-in victim to
  // the tournament and burned their invitation without a click. The write is
  // now an explicit POST the user confirms below. The token travels as a bound
  // server-action argument, so it never reaches the client payload or the DOM.
  const confirm = confirmRegistration.bind(null, { slug, token })

  return (
    <TournamentMessage
      icon={ShieldCheck}
      heading="Confirm Registration"
      backHref={tournamentHref(slug)}
    >
      <form action={confirm}>
        <Button type="submit">Join Tournament</Button>
      </form>
    </TournamentMessage>
  )
}
