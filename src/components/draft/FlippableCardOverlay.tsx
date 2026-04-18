'use client'

import { useState, useEffect, useCallback, type ReactNode } from 'react'
import type { PowerupCardData } from './PowerupCard'
import { CardFront } from './CardHand'
import type { PowerupEffect } from '@/lib/powerup-engine'

interface FlippableCardOverlayProps {
  powerup: PowerupCardData | null
  onClose: () => void
  /** Content rendered on the back face of the card. Receives an animated close function. */
  backContent: ReactNode | ((close: () => void) => ReactNode)
  /** When true, plays the fall-to-hand animation instead of normal close */
  fallAnimation?: boolean
  /** Called after the fall animation completes */
  onFallComplete?: () => void
}

export function FlippableCardOverlay({
  powerup,
  onClose,
  backContent,
  fallAnimation,
  onFallComplete,
}: FlippableCardOverlayProps) {
  const [closing, setClosing] = useState(false)
  const isFalling = !!fallAnimation

  const close = useCallback(() => {
    setClosing(true)
    setTimeout(() => {
      setClosing(false)
      onClose()
    }, 600)
  }, [onClose])

  // Handle fall animation trigger
  useEffect(() => {
    if (fallAnimation && powerup) {
      const timer = setTimeout(() => {
        onFallComplete?.()
      }, 800)
      return () => clearTimeout(timer)
    }
  }, [fallAnimation, powerup, onFallComplete])

  if (!powerup) return null

  const isAttack = powerup.type === 'ATTACK'
  const effect = powerup.effect as PowerupEffect

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[90] transition-opacity duration-500 ${
          closing || isFalling ? 'bg-black/0' : 'bg-black/60'
        }`}
        onClick={!isFalling && !closing ? close : undefined}
      />

      {/* Card container */}
      <div
        className="fixed z-[95]"
        style={{
          width: 'min(75vw, 320px)',
          height: 'min(calc(75vw * 1.45), 464px)',
          top: '55%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          ...(isFalling ? {
            animation: 'cardFallToHand 0.8s ease-in forwards',
          } : {}),
        }}
      >
        {/* Front face */}
        <div
          className={`
            absolute inset-0 rounded-2xl flex flex-col overflow-hidden select-none
            bg-[#f5f0e8] border-[3px]
            ${isAttack ? 'border-red-700' : 'border-emerald-800'}
            shadow-2xl shadow-black/50
          `}
          style={{
            animation: isFalling
              ? undefined
              : closing
                ? 'cardFlipFrontIn 0.6s ease-in-out forwards'
                : 'cardFlipFrontOut 0.7s ease-in-out forwards',
            ...(isFalling ? { opacity: 0 } : {}),
          }}
        >
          <CardFront
            slug={powerup.slug}
            name={powerup.name}
            type={powerup.type}
            effect={effect}
            isAttack={isAttack}
            isHovered={false}
            count={1}
            large
          />
        </div>

        {/* Back face */}
        <div
          className={`
            absolute inset-0 rounded-2xl flex flex-col overflow-hidden select-none
            bg-[#f5f0e8] border-[3px]
            ${isAttack ? 'border-red-700' : 'border-emerald-800'}
            shadow-2xl shadow-black/50
          `}
          style={{
            animation: isFalling
              ? undefined
              : closing
                ? 'cardFlipBackOut 0.6s ease-in-out forwards'
                : 'cardFlipBackIn 0.7s ease-in-out forwards',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {typeof backContent === 'function' ? backContent(close) : backContent}
        </div>
      </div>
    </>
  )
}
