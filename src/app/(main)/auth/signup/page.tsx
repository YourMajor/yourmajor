import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { AuthShell } from '../_shared/AuthShell'
import { EmailSentCard } from '../_shared/EmailSentCard'
import { SignupForm } from './SignupForm'

async function signUp(formData: FormData) {
  'use server'
  const email = (formData.get('email') as string | null)?.trim()
  const password = formData.get('password') as string | null
  const confirm = formData.get('confirm') as string | null
  const next = formData.get('next') as string | null

  if (!email || !password || !confirm) {
    redirect(`/auth/signup?error=${encodeURIComponent('Email and password are required.')}`)
  }
  if (password.length < 8) {
    redirect(`/auth/signup?error=${encodeURIComponent('Password must be at least 8 characters.')}`)
  }
  if (password !== confirm) {
    redirect(`/auth/signup?error=${encodeURIComponent('Passwords don’t match.')}`)
  }

  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  const origin = `${proto}://${host}`
  const callbackUrl = next
    ? `${origin}/api/auth/callback?next=${encodeURIComponent(next)}`
    : `${origin}/api/auth/callback`

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: callbackUrl },
  })

  if (error) {
    console.error('Signup error:', error.message, { email })
    const params = new URLSearchParams({ error: error.message, email })
    if (next) params.set('next', next)
    redirect(`/auth/signup?${params.toString()}`)
  }

  // Supabase returns a user with `identities: []` when the email already exists
  // and confirmations are required — surface that as a clear error.
  if (data.user && data.user.identities && data.user.identities.length === 0) {
    const params = new URLSearchParams({
      error: 'An account with this email already exists. Try signing in instead.',
      email,
    })
    if (next) params.set('next', next)
    redirect(`/auth/signup?${params.toString()}`)
  }

  const params = new URLSearchParams({ sent: '1', email })
  if (next) params.set('next', next)
  redirect(`/auth/signup?${params.toString()}`)
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string; next?: string; email?: string }>
}) {
  const { sent, error, next, email } = await searchParams

  if (sent) {
    return (
      <AuthShell>
        <EmailSentCard
          title="Verify your email"
          email={email ? decodeURIComponent(email) : undefined}
          description="We sent a verification link to"
          expiryHint="Click the link to activate your account. The link expires in 24 hours. Didn’t get it? Check your spam folder."
          backHref={`/auth/signup${next ? `?next=${encodeURIComponent(next)}` : ''}`}
        />
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <Card className="w-full max-w-sm bg-white/[0.04] border-white/10 shadow-2xl shadow-black/30 backdrop-blur-sm">
        <CardContent className="pt-8 pb-6 px-6 space-y-5">
          <div className="space-y-1.5 text-center">
            <h1 className="font-heading text-2xl sm:text-3xl font-bold text-white">
              Create your <span className="text-accent">YourMajor</span> account
            </h1>
            <p className="text-sm text-white/60">
              You’ll need to verify your email before signing in.
            </p>
          </div>

          <SignupForm
            signUp={signUp}
            next={next}
            error={error}
            defaultEmail={email ? decodeURIComponent(email) : undefined}
          />

          <p className="text-sm text-white/60 text-center pt-1">
            Already have an account?{' '}
            <Link
              href={`/auth/login${next ? `?next=${encodeURIComponent(next)}` : ''}`}
              className="text-accent hover:text-accent/80 font-semibold transition-colors"
            >
              Sign in
            </Link>
          </p>

          <p className="text-[11px] text-white/40 text-center leading-relaxed pt-1">
            By creating an account, you agree to our{' '}
            <Link href="/terms" className="underline hover:text-white/70">
              Terms of Use
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="underline hover:text-white/70">
              Privacy Policy
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    </AuthShell>
  )
}
