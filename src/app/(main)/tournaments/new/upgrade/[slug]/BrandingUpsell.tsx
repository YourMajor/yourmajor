'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Crown, Palette, Image, Users, Trophy, ArrowRight, Ticket, Calculator } from 'lucide-react'
import { redeemProCredit } from './actions'

// Preview color pair — "Navy & Gold" for attractive demo
const PREVIEW = { primary: '#1B2A4A', accent: '#D4A843' }
const DEFAULT = { primary: '#006747', accent: '#C9A84C' }

interface Props {
  tournamentId: string
  tournamentName: string
  slug: string
  proCredits: number
}

export function BrandingUpsell({ tournamentId, tournamentName, slug, proCredits }: Props) {
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [creditPending, startCreditTransition] = useTransition()

  async function handleUpgrade() {
    setCheckoutLoading(true)
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'PRO',
          tournamentId,
          tournamentName,
          slug,
        }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      }
    } finally {
      setCheckoutLoading(false)
    }
  }

  function handleUseCredit() {
    startCreditTransition(async () => {
      await redeemProCredit(tournamentId, slug)
    })
  }

  const initial = tournamentName.charAt(0).toUpperCase()

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 sm:py-16">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent mb-4">
          <Crown className="w-3.5 h-3.5" />
          Tournament Created
        </div>
        <h1 className="text-2xl sm:text-3xl font-heading font-bold text-foreground">
          Make it yours
        </h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
          Your tournament is live! Upgrade to Pro to add custom branding and unlock premium features.
        </p>
      </div>

      {/* Preview comparison */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {/* Free preview */}
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-2 bg-muted/50 border-b border-border">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Free</p>
          </div>
          <div className="p-6 flex flex-col items-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-heading font-bold text-white"
              style={{ backgroundColor: DEFAULT.primary }}
            >
              {initial}
            </div>
            <p className="mt-3 text-sm font-heading font-bold text-foreground">{tournamentName}</p>
            <div className="w-8 h-0.5 rounded-full mt-2" style={{ backgroundColor: DEFAULT.accent }} />
            <p className="text-[10px] text-muted-foreground mt-2">Default colors &middot; No logo</p>
          </div>
        </div>

        {/* Pro preview */}
        <div className="rounded-xl border-2 border-accent/40 overflow-hidden ring-1 ring-accent/10">
          <div className="px-4 py-2 border-b border-accent/20" style={{ backgroundColor: `${PREVIEW.accent}15` }}>
            <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: PREVIEW.accent }}>Pro</p>
          </div>
          {/* Banner area */}
          <div className="relative h-20 overflow-hidden" style={{ background: `linear-gradient(135deg, ${PREVIEW.primary} 0%, ${PREVIEW.primary}dd 50%, ${PREVIEW.accent}40 100%)` }}>
            {/* Decorative overlay pattern */}
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.1) 10px, rgba(255,255,255,0.1) 20px)' }} />
            <div className="absolute bottom-2 left-3 text-[8px] font-semibold uppercase tracking-widest text-white/60">Your banner image here</div>
          </div>
          <div className="px-6 pb-6 flex flex-col items-center -mt-8 relative">
            {/* Logo mock */}
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center shadow-lg border-2 border-white"
              style={{ backgroundColor: PREVIEW.primary }}
            >
              <svg viewBox="0 0 40 40" className="w-9 h-9" fill="none">
                <circle cx="20" cy="14" r="4" fill={PREVIEW.accent} />
                <path d="M20 18 C20 18, 22 28, 20 36" stroke={PREVIEW.accent} strokeWidth="2" strokeLinecap="round" />
                <path d="M14 34 L26 34" stroke={PREVIEW.accent} strokeWidth="1.5" strokeLinecap="round" />
                <path d="M10 22 C14 18, 16 24, 20 18 C24 24, 26 18, 30 22" stroke="white" strokeWidth="1" opacity="0.4" fill="none" />
              </svg>
            </div>
            <p className="mt-2 text-sm font-heading font-bold" style={{ color: PREVIEW.primary }}>{tournamentName}</p>
            <div className="w-8 h-0.5 rounded-full mt-1.5" style={{ backgroundColor: PREVIEW.accent }} />
            <p className="text-[10px] mt-1.5" style={{ color: PREVIEW.accent }}>Your colors &middot; Your logo</p>
          </div>
        </div>
      </div>

      {/* Feature list */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
        {[
          { icon: Palette, label: 'Custom Colors', desc: '24 color themes' },
          { icon: Image, label: 'Logo & Banner', desc: 'Upload your own' },
          { icon: Users, label: 'Up to 72 Players', desc: 'vs 16 on Free' },
          { icon: Calculator, label: 'Handicap Systems', desc: 'WHS, Stableford & more' },
          { icon: Trophy, label: 'Powerups & More', desc: 'Full feature access' },
        ].map(({ icon: Icon, label, desc }) => (
          <div key={label} className="text-center p-3 rounded-lg border border-border bg-card">
            <Icon className="w-5 h-5 mx-auto text-accent mb-1.5" />
            <p className="text-xs font-semibold text-foreground">{label}</p>
            <p className="text-[10px] text-muted-foreground">{desc}</p>
          </div>
        ))}
      </div>

      {/* CTAs */}
      <div className="space-y-3">
        <Button
          onClick={handleUpgrade}
          disabled={checkoutLoading}
          className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
          size="lg"
        >
          {checkoutLoading ? 'Redirecting to checkout...' : 'Upgrade to Pro — $29'}
          {!checkoutLoading && <ArrowRight className="w-4 h-4 ml-2" />}
        </Button>

        {proCredits > 0 && (
          <Button
            onClick={handleUseCredit}
            disabled={creditPending}
            variant="outline"
            className="w-full"
            size="lg"
          >
            <Ticket className="w-4 h-4 mr-2" />
            {creditPending ? 'Applying credit...' : `Use Pro Credit (${proCredits} available)`}
          </Button>
        )}

        <div className="text-center">
          <Link
            href={`/${slug}`}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Continue with Free →
          </Link>
        </div>
      </div>

      <p className="text-center text-[10px] text-muted-foreground mt-6">
        You can always upgrade later from your tournament settings.
      </p>
    </div>
  )
}
