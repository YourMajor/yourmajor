import Link from 'next/link'
import { MailCheck } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

interface Props {
  title?: string
  email?: string
  description?: string
  expiryHint?: string
  backHref: string
  backLabel?: string
}

export function EmailSentCard({
  title = 'Check your email',
  email,
  description,
  expiryHint = 'Didn’t get it? Check your spam folder.',
  backHref,
  backLabel = 'Use a different email',
}: Props) {
  return (
    <Card className="w-full max-w-sm bg-white/[0.04] border-white/10 shadow-2xl shadow-black/30 backdrop-blur-sm">
      <CardContent className="pt-8 pb-6 px-6 text-center space-y-5">
        <div className="mx-auto w-14 h-14 rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center">
          <MailCheck className="w-7 h-7 text-accent" />
        </div>
        <div className="space-y-1.5">
          <h1 className="font-heading text-2xl font-bold text-white">{title}</h1>
          {email ? (
            <p className="text-sm text-white/60">
              {description ?? 'We sent a link to'}{' '}
              <span className="text-white font-medium">{email}</span>
            </p>
          ) : (
            <p className="text-sm text-white/60">
              {description ?? 'We sent you a link. Click it to continue.'}
            </p>
          )}
        </div>
        <p className="text-xs text-white/40 leading-relaxed">{expiryHint}</p>
        <div className="pt-1">
          <Link
            href={backHref}
            className="text-sm text-accent hover:text-accent/80 font-semibold transition-colors"
          >
            {backLabel}
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
