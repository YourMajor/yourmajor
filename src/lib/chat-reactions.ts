/** Emojis offered in the chat reaction picker, in display order. */
export const CHAT_REACTIONS = ['👍', '❤️', '😂', '🔥', '😮', '👏', '⛳'] as const
export type ChatReactionEmoji = (typeof CHAT_REACTIONS)[number]

export function isChatReaction(value: unknown): value is ChatReactionEmoji {
  return typeof value === 'string' && (CHAT_REACTIONS as readonly string[]).includes(value)
}

export interface ReactionSummary {
  emoji: string
  count: number
  /** Whether the viewer is one of the reactors. */
  mine: boolean
  /** Who reacted, for the tooltip. */
  names: string[]
}

/**
 * Collapse reaction rows into one chip per emoji, in picker order, with the
 * viewer's own reactions flagged.
 */
export function summarizeReactions(
  rows: Array<{ emoji: string; userId: string; user?: { name: string | null } | null }>,
  viewerUserId: string | null,
): ReactionSummary[] {
  const byEmoji = new Map<string, ReactionSummary>()
  for (const r of rows) {
    const cur = byEmoji.get(r.emoji) ?? { emoji: r.emoji, count: 0, mine: false, names: [] }
    cur.count += 1
    if (viewerUserId && r.userId === viewerUserId) cur.mine = true
    if (r.user?.name) cur.names.push(r.user.name)
    byEmoji.set(r.emoji, cur)
  }
  const order = (e: string) => {
    const i = (CHAT_REACTIONS as readonly string[]).indexOf(e)
    return i === -1 ? CHAT_REACTIONS.length : i
  }
  return [...byEmoji.values()].sort((a, b) => order(a.emoji) - order(b.emoji))
}

/** Apply a toggle locally (optimistic update) and return the new summary list. */
export function toggleReactionLocally(list: ReactionSummary[], emoji: string, viewerName: string | null): ReactionSummary[] {
  const existing = list.find((r) => r.emoji === emoji)
  if (existing?.mine) {
    const next = list
      .map((r) =>
        r.emoji === emoji
          ? { ...r, count: r.count - 1, mine: false, names: viewerName ? removeOnce(r.names, viewerName) : r.names }
          : r,
      )
      .filter((r) => r.count > 0)
    return next
  }
  if (existing) {
    return list.map((r) =>
      r.emoji === emoji ? { ...r, count: r.count + 1, mine: true, names: viewerName ? [...r.names, viewerName] : r.names } : r,
    )
  }
  const order = (e: string) => {
    const i = (CHAT_REACTIONS as readonly string[]).indexOf(e)
    return i === -1 ? CHAT_REACTIONS.length : i
  }
  return [...list, { emoji, count: 1, mine: true, names: viewerName ? [viewerName] : [] }].sort(
    (a, b) => order(a.emoji) - order(b.emoji),
  )
}

function removeOnce(names: string[], name: string): string[] {
  const i = names.indexOf(name)
  return i === -1 ? names : [...names.slice(0, i), ...names.slice(i + 1)]
}
