import { describe, it, expect } from 'vitest'
import { isContinuation } from '@/lib/chat-grouping'

describe('isContinuation', () => {
  const a = { userId: 'a' }
  const b = { userId: 'b' }
  const sys = { userId: 'a', isSystem: true }

  it('groups back-to-back messages from the same person', () => {
    expect(isContinuation(a, a)).toBe(true)
  })

  it('starts a new run when someone else speaks', () => {
    const thread = [a, a, b, a]
    const heads = thread.map((m, i) => !isContinuation(thread[i - 1], m))
    expect(heads).toEqual([true, false, true, true])
  })

  it('never groups across or into system messages', () => {
    expect(isContinuation(sys, a)).toBe(false)
    expect(isContinuation(a, sys)).toBe(false)
  })

  it('treats the first message as a run head', () => {
    expect(isContinuation(undefined, a)).toBe(false)
  })
})
