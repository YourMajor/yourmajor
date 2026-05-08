'use client'

import { useState } from 'react'
import { useFormStatus } from 'react-dom'
import { AlertCircle, Loader2, UserPlus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Props {
  signUp: (formData: FormData) => Promise<void>
  next?: string | null
  error?: string
  defaultEmail?: string
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus()
  const isDisabled = pending || disabled
  return (
    <button
      type="submit"
      disabled={isDisabled}
      className="inline-flex items-center justify-center gap-2 w-full h-11 rounded-lg
        bg-white text-gray-900 font-semibold text-sm
        hover:bg-gray-50 active:bg-gray-100
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-[oklch(0.20_0.06_255)]
        disabled:opacity-70 disabled:cursor-not-allowed
        transition-colors select-none"
    >
      {pending ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Creating account…
        </>
      ) : (
        <>
          <UserPlus className="w-4 h-4" />
          Create account
        </>
      )}
    </button>
  )
}

export function SignupForm({ signUp, next, error, defaultEmail }: Props) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [touched, setTouched] = useState(false)

  const passwordTooShort = password.length > 0 && password.length < 8
  const passwordsDontMatch = confirm.length > 0 && password !== confirm
  const showLocalError = touched && (passwordTooShort || passwordsDontMatch)
  const localErrorMessage = passwordTooShort
    ? 'Password must be at least 8 characters.'
    : passwordsDontMatch
      ? 'Passwords don’t match.'
      : null

  return (
    <form action={signUp} className="space-y-3" onSubmit={() => setTouched(true)}>
      {next && <input type="hidden" name="next" value={next} />}
      <div className="space-y-1.5">
        <Label htmlFor="email" className="text-white/80 text-sm font-medium">
          Email address
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="you@example.com"
          required
          autoComplete="email"
          defaultValue={defaultEmail}
          className="h-11 bg-white/[0.06] border-white/15 text-white placeholder:text-white/40
            focus-visible:border-accent focus-visible:ring-accent/30 focus-visible:bg-white/[0.08]"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password" className="text-white/80 text-sm font-medium">
          Password
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          placeholder="At least 8 characters"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-11 bg-white/[0.06] border-white/15 text-white placeholder:text-white/40
            focus-visible:border-accent focus-visible:ring-accent/30 focus-visible:bg-white/[0.08]"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirm" className="text-white/80 text-sm font-medium">
          Confirm password
        </Label>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          placeholder="Re-enter password"
          required
          minLength={8}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="h-11 bg-white/[0.06] border-white/15 text-white placeholder:text-white/40
            focus-visible:border-accent focus-visible:ring-accent/30 focus-visible:bg-white/[0.08]"
        />
      </div>
      {(showLocalError || error) && (
        <div
          role="alert"
          aria-live="polite"
          className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2.5 text-sm text-red-200"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{showLocalError ? localErrorMessage : decodeURIComponent(error!)}</span>
        </div>
      )}
      <SubmitButton disabled={passwordTooShort || passwordsDontMatch || password.length === 0} />
    </form>
  )
}
