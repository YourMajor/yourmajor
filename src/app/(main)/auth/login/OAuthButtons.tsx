'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { Provider } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/client'

interface Props {
  next?: string | null
}

type ProviderKey = 'google' | 'apple'

export function OAuthButtons({ next }: Props) {
  const [loadingProvider, setLoadingProvider] = useState<ProviderKey | null>(null)

  const redirectTo =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ''}`
      : undefined

  async function signInWith(provider: ProviderKey) {
    setLoadingProvider(provider)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOAuth({
        provider: provider as Provider,
        options: { redirectTo },
      })
      if (error) setLoadingProvider(null)
    } catch {
      setLoadingProvider(null)
    }
  }

  return (
    <div className="space-y-2.5">
      <ProviderButton
        label="Continue with Google"
        loading={loadingProvider === 'google'}
        disabled={loadingProvider !== null}
        onClick={() => signInWith('google')}
        icon={<GoogleIcon />}
      />
      <ProviderButton
        label="Continue with Apple"
        loading={loadingProvider === 'apple'}
        disabled={loadingProvider !== null}
        onClick={() => signInWith('apple')}
        icon={<AppleIcon />}
      />
    </div>
  )
}

function ProviderButton({
  label,
  loading,
  disabled,
  onClick,
  icon,
}: {
  label: string
  loading: boolean
  disabled: boolean
  onClick: () => void
  icon: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center justify-center gap-3 w-full h-11 rounded-lg
        bg-white text-gray-900 font-semibold text-sm
        hover:bg-gray-50 active:bg-gray-100
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-[oklch(0.20_0.06_255)]
        disabled:opacity-70 disabled:cursor-not-allowed
        transition-colors select-none"
    >
      {loading ? <Loader2 className="w-5 h-5 animate-spin text-gray-500" /> : icon}
      {loading ? 'Redirecting…' : label}
    </button>
  )
}

function GoogleIcon() {
  return (
    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  )
}

function AppleIcon() {
  return (
    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#000"
        d="M16.365 1.43c0 1.14-.42 2.23-1.25 3.06-.83.83-1.93 1.32-2.97 1.27-.04-1.16.42-2.27 1.25-3.1.83-.83 1.99-1.27 2.97-1.23zM20.5 17.21c-.55 1.27-.81 1.83-1.51 2.95-.97 1.55-2.34 3.49-4.04 3.51-1.51.02-1.9-.98-3.95-.96-2.05.02-2.49 1-4 .96-1.7-.02-2.99-1.78-3.97-3.33C.85 16.46.42 11.96 2.42 9.05c1.41-2.06 3.62-3.27 5.7-3.27 2.12 0 3.46 1.16 5.21 1.16 1.7 0 2.74-1.16 5.19-1.16 1.86 0 3.83 1.01 5.23 2.76-4.6 2.52-3.85 9.09 1.75 8.67z"
      />
    </svg>
  )
}
