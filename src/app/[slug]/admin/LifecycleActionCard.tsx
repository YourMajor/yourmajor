'use client'

import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { Loader2 } from 'lucide-react'

interface LifecycleActionCardProps {
  icon: LucideIcon
  iconColor: string
  label: string
  sublabel: string
  onClick?: () => void
  href?: string
  disabled?: boolean
  pending?: boolean
}

export function LifecycleActionCard({
  icon: Icon,
  iconColor,
  label,
  sublabel,
  onClick,
  href,
  disabled,
  pending,
}: LifecycleActionCardProps) {
  const content = (
    <>
      <div
        className="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-colors"
        style={{ backgroundColor: `color-mix(in srgb, ${iconColor} 10%, transparent)` }}
      >
        {pending ? (
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        ) : (
          <Icon className="w-5 h-5" style={{ color: iconColor }} />
        )}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{sublabel}</p>
      </div>
    </>
  )

  const className =
    'flex items-center gap-4 w-full h-16 rounded-xl border border-border px-5 transition-all cursor-pointer text-left hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed'

  if (href && !disabled) {
    return (
      <Link
        href={href}
        className={className}
        style={
          {
            '--_accent': iconColor,
          } as React.CSSProperties
        }
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = `color-mix(in srgb, ${iconColor} 40%, transparent)`
          e.currentTarget.style.backgroundColor = `color-mix(in srgb, ${iconColor} 5%, transparent)`
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = ''
          e.currentTarget.style.backgroundColor = ''
        }}
      >
        {content}
      </Link>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || pending}
      className={className}
      onMouseEnter={(e) => {
        if (!disabled && !pending) {
          e.currentTarget.style.borderColor = `color-mix(in srgb, ${iconColor} 40%, transparent)`
          e.currentTarget.style.backgroundColor = `color-mix(in srgb, ${iconColor} 5%, transparent)`
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = ''
        e.currentTarget.style.backgroundColor = ''
      }}
    >
      {content}
    </button>
  )
}
