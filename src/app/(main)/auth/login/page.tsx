import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { AuthShell } from '../_shared/AuthShell'
import { OAuthButtons } from './OAuthButtons'
import { PasswordForm } from './PasswordForm'

async function signIn(formData: FormData) {
  'use server'
  const email = (formData.get('email') as string | null)?.trim()
  const password = formData.get('password') as string | null
  const next = formData.get('next') as string | null

  if (!email || !password) {
    const params = new URLSearchParams({ error: 'Email and password are required.' })
    if (email) params.set('email', email)
    if (next) params.set('next', next)
    redirect(`/auth/login?${params.toString()}`)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    console.error('Password sign-in error:', error.message, { email })
    // Supabase returns "Email not confirmed" when verification is still pending.
    const friendly =
      error.message.toLowerCase().includes('email not confirmed')
        ? 'Please verify your email before signing in. Check your inbox for the verification link.'
        : error.message.toLowerCase().includes('invalid login')
          ? 'Wrong email or password.'
          : error.message
    const params = new URLSearchParams({ error: friendly, email })
    if (next) params.set('next', next)
    redirect(`/auth/login?${params.toString()}`)
  }

  redirect(next || '/dashboard')
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string; email?: string }>
}) {
  const { error, next, email } = await searchParams

  return (
    <AuthShell>
      <Card className="w-full max-w-sm bg-white/[0.04] border-white/10 shadow-2xl shadow-black/30 backdrop-blur-sm">
        <CardContent className="pt-8 pb-6 px-6 space-y-5">
          <div className="space-y-1.5 text-center">
            <h1 className="font-heading text-2xl sm:text-3xl font-bold text-white">
              Welcome to <span className="text-accent">YourMajor</span>
            </h1>
            <p className="text-sm text-white/60">Sign in to create or join tournaments</p>
          </div>

          <OAuthButtons next={next} />

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center">
              <span className="px-3 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50 bg-white/[0.06] border border-white/10">
                or
              </span>
            </div>
          </div>

          <PasswordForm
            signIn={signIn}
            next={next}
            error={error}
            defaultEmail={email ? decodeURIComponent(email) : undefined}
          />

          <p className="text-sm text-white/60 text-center pt-1">
            Don’t have an account?{' '}
            <Link
              href={`/auth/signup${next ? `?next=${encodeURIComponent(next)}` : ''}`}
              className="text-accent hover:text-accent/80 font-semibold transition-colors"
            >
              Sign up
            </Link>
          </p>

          <p className="text-[11px] text-white/40 text-center leading-relaxed pt-1">
            By continuing, you agree to our{' '}
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
