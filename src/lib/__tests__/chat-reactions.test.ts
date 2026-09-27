import { describe, it, expect } from 'vitest'
import { isChatReaction, summarizeReactions, toggleReactionLocally } from '@/lib/chat-reactions'

describe('chat reactions', () => {
  it('only accepts emojis from the picker', () => {
    expect(isChatReaction('👍')).toBe(true)
    expect(isChatReaction('💩')).toBe(false)
    expect(isChatReaction('<script>')).toBe(false)
  })

  it('groups reactions per emoji in picker order and flags the viewer', () => {
    const s = summarizeReactions(
      [
        { emoji: '😂', userId: 'a', user: { name: 'Ann' } },
        { emoji: '👍', userId: 'b', user: { name: 'Bob' } },
        { emoji: '👍', userId: 'me', user: { name: 'Me' } },
      ],
      'me',
    )
    expect(s.map((r) => [r.emoji, r.count, r.mine])).toEqual([
      ['👍', 2, true],
      ['😂', 1, false],
    ])
    expect(s[0].names).toEqual(['Bob', 'Me'])
  })

  it('toggles on, adds to an existing chip, and toggles off', () => {
    let list = toggleReactionLocally([], '🔥', 'Me')
    expect(list).toEqual([{ emoji: '🔥', count: 1, mine: true, names: ['Me'] }])

    list = toggleReactionLocally([{ emoji: '👍', count: 1, mine: false, names: ['Bob'] }], '👍', 'Me')
    expect(list[0]).toEqual({ emoji: '👍', count: 2, mine: true, names: ['Bob', 'Me'] })

    list = toggleReactionLocally(list, '👍', 'Me')
    expect(list[0]).toEqual({ emoji: '👍', count: 1, mine: false, names: ['Bob'] })

    expect(toggleReactionLocally([{ emoji: '⛳', count: 1, mine: true, names: ['Me'] }], '⛳', 'Me')).toEqual([])
  })
})
