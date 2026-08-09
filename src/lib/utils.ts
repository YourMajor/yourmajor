import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Relative-luminance check for brand colors (hex, rgb(), or oklch()).
 *  Unknown formats read as dark, matching the pre-guard behaviour. */
export function isLightColor(color: string): boolean {
  const hex = color.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i)
  if (hex) {
    const r = parseInt(hex[1], 16) / 255
    const g = parseInt(hex[2], 16) / 255
    const b = parseInt(hex[3], 16) / 255
    return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45
  }
  const rgb = color.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/)
  if (rgb) {
    const r = parseInt(rgb[1]) / 255
    const g = parseInt(rgb[2]) / 255
    const b = parseInt(rgb[3]) / 255
    return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45
  }
  const oklch = color.match(/oklch\(\s*([\d.]+)/)
  if (oklch) return parseFloat(oklch[1]) > 0.6
  return false
}

/** CSS-var style object for a tournament's brand colors, with
 *  contrast-guarded foregrounds (the DESIGN.md branding contract).
 *  Spread onto the branded subtree's wrapper; empty when unbranded. */
export function brandVars(
  primaryColor?: string | null,
  accentColor?: string | null,
): Record<string, string> {
  const vars: Record<string, string> = {}
  if (primaryColor) {
    vars['--color-primary'] = primaryColor
    vars['--primary-foreground'] = isLightColor(primaryColor)
      ? 'var(--brand-ink)'
      : 'var(--brand-bone)'
  }
  if (accentColor) {
    vars['--color-accent'] = accentColor
    vars['--accent-foreground'] = isLightColor(accentColor)
      ? 'var(--brand-ink)'
      : 'var(--brand-bone)'
  }
  return vars
}
