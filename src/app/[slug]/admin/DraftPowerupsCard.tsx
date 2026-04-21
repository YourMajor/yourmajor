'use client'

import { Sparkles } from 'lucide-react'
import { LifecycleActionCard } from './LifecycleActionCard'

export function DraftPowerupsCard({
  label,
  href,
}: {
  label: string
  href: string
}) {
  return (
    <LifecycleActionCard
      icon={Sparkles}
      iconColor="var(--color-accent)"
      label={label}
      sublabel="Distribute powerup cards to players"
      href={href}
    />
  )
}
