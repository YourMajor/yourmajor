'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

// Pre-defined color pairs that are accessibility/contrast compliant.
// Each pair has a dark primary (for white text) and a complementary accent.
// All pairs pass WCAG AA for normal text on white backgrounds and white text on primary.
const COLOR_PAIRS: Array<{ label: string; primary: string; accent: string }> = [
  { label: 'Masters Green',     primary: '#006747', accent: '#C9A84C' },
  { label: 'Navy & Gold',       primary: '#1B2A4A', accent: '#D4A843' },
  { label: 'Forest',            primary: '#2D5016', accent: '#B8860B' },
  { label: 'Royal Blue',        primary: '#1A3C8F', accent: '#E8A317' },
  { label: 'Burgundy',          primary: '#6B1D2A', accent: '#D4A574' },
  { label: 'Slate',             primary: '#3B4856', accent: '#7FAFCF' },
  { label: 'Emerald',           primary: '#065F46', accent: '#F59E0B' },
  { label: 'Deep Purple',       primary: '#4A1D6B', accent: '#E6B422' },
  { label: 'Charcoal',          primary: '#2C2C2C', accent: '#E07C3E' },
  { label: 'Ocean',             primary: '#0C4A6E', accent: '#38BDF8' },
  { label: 'Crimson',           primary: '#991B1B', accent: '#FCD34D' },
  { label: 'Teal',              primary: '#115E59', accent: '#F0ABFC' },
  { label: 'Olive',             primary: '#4A5520', accent: '#D97706' },
  { label: 'Midnight',          primary: '#1E1B4B', accent: '#A78BFA' },
  { label: 'Copper',            primary: '#7C2D12', accent: '#BEF264' },
  { label: 'Steel Blue',        primary: '#1E3A5F', accent: '#94A3B8' },
]

interface ColorDonutPickerProps {
  primaryColor: string
  accentColor: string
  onPrimaryChange: (color: string) => void
  onAccentChange: (color: string) => void
  onPairChange?: (primary: string, accent: string) => void
}

export function ColorDonutPicker({
  primaryColor,
  accentColor,
  onPrimaryChange,
  onAccentChange,
  onPairChange,
}: ColorDonutPickerProps) {
  const selectedIndex = COLOR_PAIRS.findIndex(
    (p) => p.primary.toLowerCase() === primaryColor.toLowerCase() && p.accent.toLowerCase() === accentColor.toLowerCase()
  )

  function selectPair(pair: typeof COLOR_PAIRS[0]) {
    if (onPairChange) {
      onPairChange(pair.primary, pair.accent)
    } else {
      onPrimaryChange(pair.primary)
      onAccentChange(pair.accent)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Tournament Colors</p>
      <div className="flex flex-wrap gap-2.5">
        {COLOR_PAIRS.map((pair, i) => {
          const isSelected = selectedIndex === i
          return (
            <button
              key={pair.label}
              type="button"
              onClick={() => selectPair(pair)}
              title={pair.label}
              className={cn(
                'relative w-10 h-10 rounded-full transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary',
                isSelected
                  ? 'ring-2 ring-foreground ring-offset-2 scale-110'
                  : 'hover:scale-105 hover:ring-1 hover:ring-border hover:ring-offset-1'
              )}
            >
              {/* Outer ring — primary color */}
              <span
                className="absolute inset-0 rounded-full"
                style={{ backgroundColor: pair.primary }}
              />
              {/* Inner circle — accent color (donut hole) */}
              <span
                className="absolute inset-[6px] rounded-full border-2 border-white"
                style={{ backgroundColor: pair.accent }}
              />
              {/* Check mark for selected */}
              {isSelected && (
                <span className="absolute inset-0 flex items-center justify-center">
                  <svg className="w-4 h-4 text-white drop-shadow-md" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </span>
              )}
            </button>
          )
        })}
      </div>
      {/* Preview strip */}
      <div className="flex items-center gap-3 mt-2">
        <div className="flex rounded-lg overflow-hidden border border-border shadow-sm">
          <div className="w-16 h-8 flex items-center justify-center text-[10px] font-bold text-white" style={{ backgroundColor: primaryColor }}>
            Aa
          </div>
          <div
            className="w-16 h-8 flex items-center justify-center text-[10px] font-bold"
            style={{
              backgroundColor: accentColor,
              color: isLightAccent(accentColor) ? '#1a1a1a' : '#ffffff',
            }}
          >
            Aa
          </div>
        </div>
        <span className="text-xs text-muted-foreground">
          {COLOR_PAIRS[selectedIndex]?.label ?? 'Custom'}
        </span>
      </div>
    </div>
  )
}

function isLightAccent(hex: string): boolean {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return false
  const r = parseInt(result[1], 16) / 255
  const g = parseInt(result[2], 16) / 255
  const b = parseInt(result[3], 16) / 255
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.5
}
