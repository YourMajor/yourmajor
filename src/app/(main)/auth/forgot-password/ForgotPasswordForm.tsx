'use client'

import { useFormStatus } from 'react-dom'
import { AlertCircle, Loader2, KeyRound, Mail } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Props {
  sendReset: (formData: FormData) => Promise<void>
  sendMagicLink: (formData: FormData) => Promise<void>
  error?: string
  defaultEmail?: string
}

function ResetButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      formAction={undefined}
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
          Sending…
        </>
      ) : (
        <>
          <KeyRound className="w-4 h-4" />
          Send password reset link
        </>
      )}
    </button>
  )
}

function MagicLinkButton({ formAction }: { formAction: (formData: FormData) => Promise<void> }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      formAction={formAction}
      disabled={pending}
      className="inline-flex items-center justify-center gap-2 w-full h-11 rounded-lg
        bg-white/[0.06] border border-white/15 text-white font-semibold text-sm
        hover:bg-white/[0.10] active:bg-white/[0.14]
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-[oklch(0.20_0.06_255)]
        disabled:opacity-70 disabled:cursor-not-allowed
        transition-colors select-none"
    >
      <Mail className="w-4 h-4" />
      Or send me a magic link
    </button>
  )
}

export function ForgotPasswordForm({ sendReset, sendMagicLink, error, defaultEmail }: Props) {
  return (
    <form action={sendReset} className="space-y-3">
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
      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2.5 text-sm text-red-200"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{decodeURIComponent(error)}</span>
        </div>
      )}
      <ResetButton />
      <MagicLinkButton formAction={sendMagicLink} />
    </form>
  )
}
