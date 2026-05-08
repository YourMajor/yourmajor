import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { AuthShell } from '../_shared/AuthShell'
import { EmailSentCard } from '../_shared/EmailSentCard'
import { ForgotPasswordForm } from './ForgotPasswordForm'

async function resolveOrigin() {
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}

async function sendReset(formData: FormData) {
  'use server'
  const email = (formData.get('email') as string | null)?.trim()
  if (!email) {
    redirect(`/auth/forgot-password?error=${encodeURIComponent('Email is required.')}`)
  }

  const origin = await resolveOrigin()
  const callbackUrl = `${origin}/api/auth/callback?next=${encodeURIComponent('/auth/reset-password')}`

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: callbackUrl,
  })

  if (error) {
    console.error('Password reset error:', error.message, { email })
    const params = new URLSearchParams({ error: error.message, email })
    redirect(`/auth/forgot-password?${params.toString()}`)
  }
  redirect(`/auth/forgot-password?sent=reset&email=${encodeURIComponent(email)}`)
}

async function sendMagicLink(formData: FormData) {
  'use server'
  const email = (formData.get('email') as string | null)?.trim()
  if (!email) {
    redirect(`/auth/forgot-password?error=${encodeURIComponent('Email is required.')}`)
  }

  const origin = await resolveOrigin()
  const callbackUrl = `${origin}/api/auth/callback`

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: callbackUrl },
  })

  if (error) {
    console.error('Magic link error:', error.message, { email })
    const params = new URLSearchParams({ error: error.message, email })
    redirect(`/auth/forgot-password?${params.toString()}`)
  }
  redirect(`/auth/forgot-password?sent=magic&email=${encodeURIComponent(email)}`)
}

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string; email?: string }>
}) {
  const { sent, error, email } = await searchParams

  if (sent) {
    const isMagic = sent === 'magic'
    return (
      <AuthShell>
        <EmailSentCard
          title={isMagic ? 'Check your email' : 'Reset link sent'}
          email={email ? decodeURIComponent(email) : undefined}
          description={
            isMagic
              ? 'We sent a magic link to'
              : 'We sent a password reset link to'
          }
          expiryHint={
            isMagic
              ? 'Click the link to sign in. The link expires in 1 hour. Didn’t get it? Check your spam folder.'
              : 'Click the link to set a new password. The link expires in 1 hour. Didn’t get it? Check your spam folder.'
          }
          backHref="/auth/forgot-password"
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
              Forgot your password?
            </h1>
            <p className="text-sm text-white/60">
              Enter your email and we’ll send you a reset link — or a magic link to sign in
              without a password.
            </p>
          </div>

          <ForgotPasswordForm
            sendReset={sendReset}
            sendMagicLink={sendMagicLink}
            error={error}
            defaultEmail={email ? decodeURIComponent(email) : undefined}
          />

          <p className="text-sm text-white/60 text-center pt-1">
            Remembered it?{' '}
            <Link
              href="/auth/login"
              className="text-accent hover:text-accent/80 font-semibold transition-colors"
            >
              Back to sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </AuthShell>
  )
}
