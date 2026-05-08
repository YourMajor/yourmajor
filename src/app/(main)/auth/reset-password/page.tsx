import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { AuthShell } from '../_shared/AuthShell'
import { ResetPasswordForm } from './ResetPasswordForm'

async function resetPassword(formData: FormData) {
  'use server'
  const password = formData.get('password') as string | null
  const confirm = formData.get('confirm') as string | null

  if (!password || !confirm) {
    redirect(`/auth/reset-password?error=${encodeURIComponent('Both password fields are required.')}`)
  }
  if (password.length < 8) {
    redirect(`/auth/reset-password?error=${encodeURIComponent('Password must be at least 8 characters.')}`)
  }
  if (password !== confirm) {
    redirect(`/auth/reset-password?error=${encodeURIComponent('Passwords don’t match.')}`)
  }

  const supabase = await createClient()
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) {
    redirect(`/auth/forgot-password?error=${encodeURIComponent('Your reset link expired. Request a new one.')}`)
  }

  const { error } = await supabase.auth.updateUser({ password })
  if (error) {
    console.error('Password update error:', error.message)
    redirect(`/auth/reset-password?error=${encodeURIComponent(error.message)}`)
  }

  redirect('/dashboard')
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  // Recovery callback should have set a session via the /api/auth/callback handler.
  // If there's no session (e.g. user opened /auth/reset-password directly), bounce
  // them to forgot-password.
  const supabase = await createClient()
  const { data, error: sessionError } = await supabase.auth.getUser()
  if (sessionError || !data.user) {
    redirect('/auth/forgot-password')
  }

  return (
    <AuthShell>
      <Card className="w-full max-w-sm bg-white/[0.04] border-white/10 shadow-2xl shadow-black/30 backdrop-blur-sm">
        <CardContent className="pt-8 pb-6 px-6 space-y-5">
          <div className="space-y-1.5 text-center">
            <h1 className="font-heading text-2xl sm:text-3xl font-bold text-white">
              Set a new password
            </h1>
            <p className="text-sm text-white/60">
              Choose a password you’ll remember. You’ll stay signed in afterwards.
            </p>
          </div>

          <ResetPasswordForm resetPassword={resetPassword} error={error} />
        </CardContent>
      </Card>
    </AuthShell>
  )
}
