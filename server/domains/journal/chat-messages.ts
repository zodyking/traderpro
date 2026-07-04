import type { JournalChatMessage } from '../../../db/schema/journal'

export function appendMessage(
  messages: JournalChatMessage[],
  role: JournalChatMessage['role'],
  content: string,
  createdAt = new Date().toISOString(),
): JournalChatMessage[] {
  const trimmed = content.trim()
  if (!trimmed) {
    throw new Error('Message cannot be empty')
  }

  return [
    ...messages,
    {
      role,
      content: trimmed,
      createdAt,
    },
  ]
}
