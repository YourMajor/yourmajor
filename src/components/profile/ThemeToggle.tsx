'use client'

import { useState } from 'react'
import { Sun, Moon } from 'lucide-react'

/** Light / dark switch. The class flips instantly on <html>; the cookie
 *  makes the next server render agree, so there is never a flash. */
export function ThemeToggle() {
  const [dark, setDark] = useState(
    () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  )

  function setTheme(next: 'light' | 'dark') {
    document.documentElement.classList.toggle('dark', next === 'dark')
    document.cookie = `ym-theme=${next}; path=/; max-age=31536000; samesite=lax`
    setDark(next === 'dark')
  }

  // Stacks on a phone. Side by side, the light-mode copy (11 characters longer
  // than the dark copy) squeezed the group until overflow-hidden clipped
  // "Dark" — in light mode only, which is what made the bug look mode-specific.
  // Giving the description the full width beats wrapping it into a four-line
  // column beside the control.
  return (
    <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold">Appearance</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {dark ? 'Dusk — the course after sundown.' : 'Daylight — bone paper and tournament green.'}
        </p>
      </div>
      <div role="group" aria-label="Theme" className="flex shrink-0 rounded-md border border-border overflow-hidden">
        <button
          type="button"
          aria-pressed={!dark}
          onClick={() => setTheme('light')}
          className={`flex items-center gap-1.5 px-4 py-3 text-sm font-semibold transition-colors ${
            !dark ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Sun className="w-4 h-4" />
          Light
        </button>
        <button
          type="button"
          aria-pressed={dark}
          onClick={() => setTheme('dark')}
          className={`flex items-center gap-1.5 px-4 py-3 text-sm font-semibold transition-colors ${
            dark ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Moon className="w-4 h-4" />
          Dark
        </button>
      </div>
    </div>
  )
}
