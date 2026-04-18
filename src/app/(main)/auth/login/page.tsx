import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { OAuthButtons } from './OAuthButtons'

async function signIn(formData: FormData) {
  'use server'
  const email = formData.get('email') as string
  if (!email) return

  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const proto = h.get('x-forwarded-proto') ?? 'https'
  const origin = `${proto}://${host}`

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/api/auth/callback`,
    },
  })
  if (error) redirect('/auth/login?error=1')
  redirect('/auth/login?sent=1')
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string; next?: string }>
}) {
  const { sent, error, next } = await searchParams

  if (sent) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4">
        <Card className="w-full max-w-sm text-center">
          <CardHeader>
            <CardTitle>Check your email</CardTitle>
            <CardDescription>We sent you a magic link. Click it to sign in.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Sign in with your preferred method.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* OAuth providers */}
          <OAuthButtons next={next} />

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-card px-2 text-muted-foreground">or continue with email</span>
            </div>
          </div>

          {/* Magic link form */}
          <form action={signIn} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" placeholder="you@example.com" required />
            </div>
            {error && <p className="text-sm text-destructive">Something went wrong. Try again.</p>}
            <Button
              type="submit"
              className="w-full"
              variant="outline"
            >
              Send magic link
            </Button>
          </form>

          <p className="text-[11px] text-muted-foreground text-center">
            By signing in, you agree to our{' '}
            <Link href="/terms" className="underline hover:text-foreground">Terms of Use</Link>
            {' '}and{' '}
            <Link href="/privacy" className="underline hover:text-foreground">Privacy Policy</Link>.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
