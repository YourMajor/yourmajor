'use client'

import { useState } from 'react'
import { Info, ChevronDown, Zap, Swords } from 'lucide-react'
import { PowerupCard, type PowerupCardData } from '@/components/draft/PowerupCard'

const EXAMPLE_BOOST: PowerupCardData = {
  id: 'example-boost',
  slug: 'iron-man',
  name: 'Iron Man',
  type: 'BOOST',
  description: 'Use only irons for the entire hole. Subtract 2 from your score. Cannot be used on par 3s.',
  effect: {
    scoring: { mode: 'auto', modifier: -2 },
    duration: 1,
    flavorText: "Real golfers don't need woods.",
    requiresTarget: false,
  },
}

const EXAMPLE_ATTACK: PowerupCardData = {
  id: 'example-attack',
  slug: 'club-roulette',
  name: 'Club Roulette',
  type: 'ATTACK',
  description: "Choose a club your opponent must use for their next shot. They can't switch.",
  effect: {
    scoring: { mode: 'behavioral', modifier: null },
    duration: 1,
    flavorText: 'Hope you like your 60-degree on a par 5.',
    requiresTarget: true,
  },
}

export function PowerupsInfoPanel() {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <p className="text-sm text-muted-foreground leading-relaxed">
        Powerups are special ability cards that add a strategic twist to your tournament.
        Each player receives a hand of cards they can play during rounds to gain advantages
        or challenge opponents.
      </p>

      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
      >
        <Info className="w-3.5 h-3.5" />
        What are powerups?
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
      </button>

      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
          expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="overflow-hidden">
          <div className="pt-2 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Boost column */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-emerald-600" />
                  <h4 className="text-sm font-semibold text-emerald-800 dark:text-emerald-400">Boost Cards</h4>
                </div>
                <p className="text-xs text-muted-foreground">
                  Boosts benefit you — reduce strokes, improve lies, or earn creative advantages.
                  Play them on your own holes to gain an edge.
                </p>
                <div className="flex justify-center pt-1">
                  <PowerupCard powerup={EXAMPLE_BOOST} size="sm" disabled />
                </div>
                <p className="text-[10px] text-center text-muted-foreground italic">
                  Example: &ldquo;{EXAMPLE_BOOST.name}&rdquo; — {EXAMPLE_BOOST.description}
                </p>
              </div>

              {/* Attack column */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Swords className="w-4 h-4 text-red-600" />
                  <h4 className="text-sm font-semibold text-red-800 dark:text-red-400">Attack Cards</h4>
                </div>
                <p className="text-xs text-muted-foreground">
                  Attacks target opponents — force handicaps, swap scores, or impose restrictions.
                  Use them strategically to disrupt the competition.
                </p>
                <div className="flex justify-center pt-1">
                  <PowerupCard powerup={EXAMPLE_ATTACK} size="sm" disabled />
                </div>
                <p className="text-[10px] text-center text-muted-foreground italic">
                  Example: &ldquo;{EXAMPLE_ATTACK.name}&rdquo; — {EXAMPLE_ATTACK.description}
                </p>
              </div>
            </div>

            <div className="border-t pt-3">
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">How are cards distributed?</span>{' '}
                Choose between a <span className="font-medium">live draft</span> where players take turns picking cards
                (more strategic and social) or a <span className="font-medium">random deal</span> where cards are shuffled
                and dealt automatically (quick and easy).
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
