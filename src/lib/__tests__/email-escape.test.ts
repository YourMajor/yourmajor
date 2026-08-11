import { describe, it, expect } from 'vitest'
import { escapeHtml } from '@/lib/email'

describe('escapeHtml', () => {
  it('neutralises a script tag', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;',
    )
  })

  it('escapes quotes, which matters inside href="..."', () => {
    expect(escapeHtml('" onmouseover="evil()')).toBe(
      '&quot; onmouseover=&quot;evil()',
    )
    expect(escapeHtml("it's")).toBe('it&#039;s')
  })

  // Ampersand must be replaced first, or the escapes themselves get mangled
  // into &amp;lt; on a second pass.
  it('escapes ampersands without double-escaping the others', () => {
    expect(escapeHtml('Tom & Jerry <b>')).toBe('Tom &amp; Jerry &lt;b&gt;')
  })

  it('passes ordinary tournament names through unchanged', () => {
    expect(escapeHtml('Sunday Medal 2026')).toBe('Sunday Medal 2026')
  })

  it('handles the non-string values email templates interpolate', () => {
    expect(escapeHtml(null)).toBe('')
    expect(escapeHtml(undefined)).toBe('')
    expect(escapeHtml(7)).toBe('7')
  })

  // htmlBody in league-announcements escapes first, then converts real
  // newlines to <br />. Reversed, it would escape its own inserted tags.
  it('supports the escape-then-linebreak order used for announcement bodies', () => {
    const body = 'line one\n<b>line two</b>'
    const rendered = escapeHtml(body).replace(/\n/g, '<br />')
    expect(rendered).toBe('line one<br />&lt;b&gt;line two&lt;/b&gt;')
    expect(rendered).not.toContain('&lt;br /&gt;')
  })
})
