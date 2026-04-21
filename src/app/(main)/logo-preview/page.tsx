'use client'

import { useState } from 'react'
import { Playfair_Display, Cormorant_Garamond, Bebas_Neue, DM_Serif_Display } from 'next/font/google'

const playfair = Playfair_Display({ subsets: ['latin'], display: 'swap', weight: ['400', '700', '900'] })
const cormorant = Cormorant_Garamond({ subsets: ['latin'], display: 'swap', weight: ['400', '700'] })
const bebas = Bebas_Neue({ subsets: ['latin'], display: 'swap', weight: '400' })
const dmSerif = DM_Serif_Display({ subsets: ['latin'], display: 'swap', weight: '400' })

const OPTIONS = [
  {
    id: 1,
    name: 'Current — Playfair Display',
    description: 'Classic editorial serif. Golf-traditional, prestigious.',
    render: () => (
      <span className={`${playfair.className} text-4xl font-bold leading-none`} style={{ color: 'var(--primary)' }}>
        Your<span style={{ color: 'var(--accent)' }}>Major</span>
      </span>
    ),
  },
  {
    id: 2,
    name: 'Elegant Italic Serif',
    description: 'Playfair with italic "Major" — Augusta National aesthetic.',
    render: () => (
      <span className={`${playfair.className} text-4xl font-bold leading-none`} style={{ color: 'var(--primary)' }}>
        Your<span className="italic" style={{ color: 'var(--accent)' }}>Major</span>
      </span>
    ),
  },
  {
    id: 3,
    name: 'Split Weight Serif',
    description: '"Your" light, "Major" black — modern hierarchy within the serif.',
    render: () => (
      <span className={`${playfair.className} text-4xl leading-none`} style={{ color: 'var(--primary)' }}>
        <span className="font-normal tracking-wide">Your</span>
        <span className="font-black" style={{ color: 'var(--accent)' }}>Major</span>
      </span>
    ),
  },
  {
    id: 4,
    name: 'Modern Sans — Geist',
    description: 'Clean, tech-forward. Lowercase for startup energy.',
    render: () => (
      <span className="font-sans text-4xl font-bold leading-none tracking-tight" style={{ color: 'var(--primary)' }}>
        your<span style={{ color: 'var(--accent)' }}>major</span>
      </span>
    ),
  },
  {
    id: 5,
    name: 'All-Caps Spaced Serif',
    description: 'Uppercase with letter-spacing. Engraved / monogram feel.',
    render: () => (
      <span className={`${playfair.className} text-3xl font-bold leading-none uppercase`} style={{ color: 'var(--primary)', letterSpacing: '0.2em' }}>
        Your<span style={{ color: 'var(--accent)' }}>Major</span>
      </span>
    ),
  },
  {
    id: 6,
    name: 'Stacked Layout',
    description: '"Your" small on top, "MAJOR" large below. Mobile-optimized.',
    render: () => (
      <span className={`${playfair.className} leading-none text-center`} style={{ color: 'var(--primary)' }}>
        <span className="block text-lg font-normal uppercase" style={{ letterSpacing: '0.15em' }}>Your</span>
        <span className="block text-4xl font-black -mt-1" style={{ color: 'var(--accent)' }}>MAJOR</span>
      </span>
    ),
  },
  {
    id: 7,
    name: 'Cormorant Garamond',
    description: 'Lighter, elegant serif. Luxury golf brand (St. Andrews, Titleist).',
    render: () => (
      <span className={`${cormorant.className} text-4xl font-bold leading-none`} style={{ color: 'var(--primary)' }}>
        Your<span style={{ color: 'var(--accent)' }}>Major</span>
      </span>
    ),
  },
  {
    id: 8,
    name: 'Bebas Neue',
    description: 'Bold, condensed, sporty. ESPN / broadcast graphics energy.',
    render: () => (
      <span className={`${bebas.className} text-5xl leading-none`} style={{ color: 'var(--primary)', letterSpacing: '0.05em' }}>
        YOUR<span style={{ color: 'var(--accent)' }}>MAJOR</span>
      </span>
    ),
  },
  {
    id: 9,
    name: 'DM Serif Display',
    description: 'Warm, slightly rounded serif. Modern golf lifestyle brand.',
    render: () => (
      <span className={`${dmSerif.className} text-4xl leading-none`} style={{ color: 'var(--primary)' }}>
        Your<span style={{ color: 'var(--accent)' }}>Major</span>
      </span>
    ),
  },
  {
    id: 10,
    name: 'Hybrid — Sans + Serif',
    description: '"Your" in Geist light, "Major" in Playfair bold. Tech meets tradition.',
    render: () => (
      <span className="text-4xl leading-none">
        <span className="font-sans font-light tracking-tight" style={{ color: 'var(--primary)' }}>Your</span>
        <span className={`${playfair.className} font-bold`} style={{ color: 'var(--accent)' }}>Major</span>
      </span>
    ),
  },
]

export default function LogoPreviewPage() {
  const [selected, setSelected] = useState<number | null>(null)

  return (
    <main className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold">Logo Font Preview</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Click any option to highlight it. All 10 options shown with real fonts.
        </p>
      </div>

      <div className="grid gap-4">
        {OPTIONS.map((opt) => (
          <button
            key={opt.id}
            onClick={() => setSelected(opt.id === selected ? null : opt.id)}
            className={`text-left rounded-xl border-2 p-6 transition-all ${
              selected === opt.id
                ? 'border-[var(--accent)] bg-accent/5 shadow-lg'
                : 'border-border bg-card hover:border-border/80 hover:shadow-md'
            }`}
          >
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {opt.id}. {opt.name}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
              </div>
              {selected === opt.id && (
                <span className="shrink-0 text-xs font-bold px-2 py-1 rounded-full bg-accent text-accent-foreground">
                  Selected
                </span>
              )}
            </div>

            {/* White card preview */}
            <div className="bg-white rounded-lg border border-border/50 py-8 px-6 flex items-center justify-center">
              {opt.render()}
            </div>

            {/* Dark card preview */}
            <div className="bg-[#1A3260] rounded-lg mt-2 py-8 px-6 flex items-center justify-center">
              <div className="[&_span]:!text-white [&_span_span]:!text-[#C9A84C]">
                {opt.render()}
              </div>
            </div>
          </button>
        ))}
      </div>
    </main>
  )
}
