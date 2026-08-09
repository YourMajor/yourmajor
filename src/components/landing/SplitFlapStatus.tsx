'use client'

import { useEffect, useState } from 'react'

/**
 * A split-flap round-status readout: the board's own clock, flipped
 * broadcast-style when the lead-change chapter advances a beat. The Masters
 * heritage this page borrows from is literally a manual flap scoreboard, so
 * the flip is the one place the metaphor is physical. Purely decorative to
 * AT (the copy rail carries the story), so the row is aria-hidden. Reduced
 * motion swaps characters without leaves; on mobile the chapter never
 * advances, so the display simply holds its first value.
 */

function FlapTile({ char, index }: { char: string; index: number }) {
  const [shown, setShown] = useState(char)
  const flipping = char !== shown

  useEffect(() => {
    if (char === shown) return
    const t = setTimeout(() => setShown(char), 200 + index * 45)
    return () => clearTimeout(t)
  }, [char, shown, index])

  const delay = `${index * 45}ms`
  return (
    <span className="mk-flap">
      <span className="mk-flap-half mk-flap-top">
        <span className="mk-flap-char">{char}</span>
      </span>
      <span className="mk-flap-half mk-flap-bottom">
        <span className="mk-flap-char">{shown}</span>
      </span>
      {flipping && (
        <>
          <span key={`f-${char}`} className="mk-flap-leaf mk-flap-front" style={{ animationDelay: delay }}>
            <span className="mk-flap-char">{shown}</span>
          </span>
          <span key={`b-${char}`} className="mk-flap-leaf mk-flap-back" style={{ animationDelay: delay }}>
            <span className="mk-flap-char">{char}</span>
          </span>
        </>
      )}
    </span>
  )
}

export function SplitFlapStatus({ value, width = 7 }: { value: string; width?: number }) {
  const label = value.toUpperCase()
  const left = Math.floor(Math.max(0, width - label.length) / 2)
  const chars = (' '.repeat(left) + label).padEnd(width).slice(0, width).split('')

  return (
    <span className="mk-flap-row mk-data text-base" aria-hidden>
      {chars.map((c, i) => (
        <FlapTile key={i} char={c} index={i} />
      ))}
    </span>
  )
}
