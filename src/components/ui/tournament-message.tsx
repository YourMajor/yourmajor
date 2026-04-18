import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button-variants'

interface TournamentMessageProps {
  icon?: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  heading: string
  description?: string
  children?: React.ReactNode
  backHref?: string
  backLabel?: string
  variant?: 'default' | 'waiting'
}

export function TournamentMessage({
  icon: Icon,
  heading,
  description,
  children,
  backHref,
  backLabel,
  variant = 'default',
}: TournamentMessageProps) {
  return (
    <main className="max-w-md mx-auto px-4 py-16 flex flex-col items-center text-center space-y-4">
      {Icon && (
        <div className="relative">
          {variant === 'waiting' && (
            <div
              className="absolute inset-0 rounded-full animate-ping opacity-20"
              style={{ backgroundColor: 'var(--color-primary, var(--primary))' }}
            />
          )}
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'color-mix(in srgb, var(--color-primary, var(--primary)) 10%, transparent)' }}
          >
            <Icon className="w-6 h-6" style={{ color: 'var(--color-primary, var(--primary))' }} />
          </div>
        </div>
      )}
      <h1 className="text-2xl font-heading font-bold text-foreground">{heading}</h1>
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
      )}
      {children}
      {backHref && (
        <Link
          href={backHref}
          className={buttonVariants({ variant: 'ghost', size: 'sm' }) + ' text-muted-foreground'}
        >
          &larr; {backLabel ?? 'Back to Leaderboard'}
        </Link>
      )}
    </main>
  )
}
