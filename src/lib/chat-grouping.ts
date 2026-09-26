interface GroupableMessage {
  userId: string
  isSystem?: boolean
}

/**
 * A chat message continues the previous one's run when the same person sent
 * both back to back. A run shows the sender's name and avatar once, on its
 * first message; anyone else posting (including a system message) ends it.
 */
export function isContinuation(prev: GroupableMessage | undefined, m: GroupableMessage): boolean {
  return !!prev && !prev.isSystem && !m.isSystem && prev.userId === m.userId
}
