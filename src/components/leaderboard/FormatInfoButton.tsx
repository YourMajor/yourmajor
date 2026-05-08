'use client'

import { Info } from 'lucide-react'
import { getFormat } from '@/lib/formats/registry'
import { getExplanation } from '@/lib/formats/explanations'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface FormatInfoButtonProps {
  formatId?: string
  className?: string
}

export function FormatInfoButton({ formatId, className }: FormatInfoButtonProps) {
  if (!formatId) return null

  const format = getFormat(formatId)
  const explanation = getExplanation(formatId)

  return (
    <Dialog>
      <span className={`inline-flex items-center gap-1.5 ${className ?? ''}`}>
        <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Format
        </span>
        <span className="text-sm font-semibold text-foreground">{format.label}</span>
        <DialogTrigger
          className="inline-flex items-center justify-center rounded-full p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40"
          aria-label={`About ${format.label}`}
        >
          <Info className="h-4 w-4" />
        </DialogTrigger>
      </span>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{format.label}</DialogTitle>
          <DialogDescription>{explanation.summary}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <section>
            <h3 className="font-semibold text-foreground mb-1.5 uppercase tracking-wide text-[11px]">
              How it&apos;s scored
            </h3>
            <ul className="list-disc pl-5 space-y-1 text-foreground/90">
              {explanation.scoringRules.map((rule, i) => (
                <li key={i}>{rule}</li>
              ))}
            </ul>
          </section>

          {explanation.handicapNote && (
            <section>
              <h3 className="font-semibold text-foreground mb-1.5 uppercase tracking-wide text-[11px]">
                Handicap
              </h3>
              <p className="text-foreground/90">{explanation.handicapNote}</p>
            </section>
          )}

          {explanation.tieBreaker && (
            <section>
              <h3 className="font-semibold text-foreground mb-1.5 uppercase tracking-wide text-[11px]">
                Ties
              </h3>
              <p className="text-foreground/90">{explanation.tieBreaker}</p>
            </section>
          )}

          {explanation.exampleLine && (
            <section className="rounded-md bg-muted/50 px-3 py-2">
              <h3 className="font-semibold text-foreground mb-1 uppercase tracking-wide text-[11px]">
                Example
              </h3>
              <p className="text-foreground/90">{explanation.exampleLine}</p>
            </section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
