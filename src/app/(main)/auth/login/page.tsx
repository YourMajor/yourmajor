import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import Link from 'next/link'
import { ArrowLeft, MailCheck } from 'lucide-react'
import { createClient } from '@/utils/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { OAuthButtons } from './OAuthButtons'
import { MagicLinkForm } from './MagicLinkForm'

async function signIn(formData: FormData) {
  'use server'
  const email = formData.get('email') as string
  const next = formData.get('next') as string | null
  if (!email) return

  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  const origin = `${proto}://${host}`

  const callbackUrl = next
    ? `${origin}/api/auth/callback?next=${encodeURIComponent(next)}`
    : `${origin}/api/auth/callback`

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: callbackUrl,
    },
  })
  if (error) {
    console.error('Magic link error:', error.message, { email, origin })
    const params = new URLSearchParams({ error: error.message, email })
    if (next) params.set('next', next)
    redirect(`/auth/login?${params.toString()}`)
  }
  const params = new URLSearchParams({ sent: '1', email })
  if (next) params.set('next', next)
  redirect(`/auth/login?${params.toString()}`)
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string; next?: string; email?: string }>
}) {
  const { sent, error, next, email } = await searchParams

  if (sent) {
    return (
      <LoginShell>
        <Card className="w-full max-w-sm bg-white/[0.04] border-white/10 shadow-2xl shadow-black/30 backdrop-blur-sm">
          <CardContent className="pt-8 pb-6 px-6 text-center space-y-5">
            <div className="mx-auto w-14 h-14 rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center">
              <MailCheck className="w-7 h-7 text-accent" />
            </div>
            <div className="space-y-1.5">
              <h1 className="font-heading text-2xl font-bold text-white">Check your email</h1>
              {email ? (
                <p className="text-sm text-white/60">
                  We sent a magic link to{' '}
                  <span className="text-white font-medium">{decodeURIComponent(email)}</span>
                </p>
              ) : (
                <p className="text-sm text-white/60">
                  We sent you a magic link. Click it to sign in.
                </p>
              )}
            </div>
            <p className="text-xs text-white/40 leading-relaxed">
              The link expires in 1 hour. Didn&apos;t get it? Check your spam folder.
            </p>
            <div className="pt-1">
              <Link
                href={`/auth/login${next ? `?next=${encodeURIComponent(next)}` : ''}`}
                className="text-sm text-accent hover:text-accent/80 font-semibold transition-colors"
              >
                Use a different email
              </Link>
            </div>
          </CardContent>
        </Card>
      </LoginShell>
    )
  }

  return (
    <LoginShell>
      <Card className="w-full max-w-sm bg-white/[0.04] border-white/10 shadow-2xl shadow-black/30 backdrop-blur-sm">
        <CardContent className="pt-8 pb-6 px-6 space-y-5">
          <div className="space-y-1.5 text-center">
            <h1 className="font-heading text-2xl sm:text-3xl font-bold text-white">
              Welcome to <span className="text-accent">YourMajor</span>
            </h1>
            <p className="text-sm text-white/60">
              Sign in to create or join tournaments
            </p>
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

          <MagicLinkForm
            signIn={signIn}
            next={next}
            error={error}
            defaultEmail={email ? decodeURIComponent(email) : undefined}
          />

          <p className="text-[11px] text-white/40 text-center leading-relaxed pt-1">
            By continuing, you agree to our{' '}
            <Link href="/terms" className="underline hover:text-white/70">
              Terms of Use
            </Link>
            {' '}and{' '}
            <Link href="/privacy" className="underline hover:text-white/70">
              Privacy Policy
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    </LoginShell>
  )
}

function LoginShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="landing-section-dark landing-hero-pattern relative min-h-[calc(100vh-80px)] flex flex-col items-center justify-center px-4 py-10 overflow-hidden">
      {children}
      <Link
        href="/"
        className="mt-6 inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to home
      </Link>
    </div>
  )
}
