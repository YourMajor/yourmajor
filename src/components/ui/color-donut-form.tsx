'use client'

import { useState } from 'react'
import { ColorDonutPicker } from './color-donut-picker'

interface ColorDonutFormProps {
  defaultPrimary: string
  defaultAccent: string
}

/**
 * Wraps ColorDonutPicker with hidden form inputs so it works
 * inside a server-action <form>.
 */
export function ColorDonutForm({ defaultPrimary, defaultAccent }: ColorDonutFormProps) {
  const [primary, setPrimary] = useState(defaultPrimary)
  const [accent, setAccent] = useState(defaultAccent)

  return (
    <>
      <input type="hidden" name="primaryColor" value={primary} />
      <input type="hidden" name="accentColor" value={accent} />
      <ColorDonutPicker
        primaryColor={primary}
        accentColor={accent}
        onPrimaryChange={setPrimary}
        onAccentChange={setAccent}
        onPairChange={(p, a) => { setPrimary(p); setAccent(a) }}
      />
    </>
  )
}
