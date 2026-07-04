import { and, eq } from 'drizzle-orm'
import { v7 as uuidv7 } from 'uuid'
import { journalConversations, journalEntries } from '../../../db/schema'
import type { JournalChatMessage } from '../../../db/schema/journal'
import { checkAiCredits, incrementUsage } from '../billing/entitlements'
import { getAIProvider } from '../ai/factory'
import { appendMessage } from './chat-messages'
import { getEntry } from './service'
import { useDb } from '../../utils/db'

const CHAT_SYSTEM_PROMPT = `You are a supportive trading journal coach in a multi-turn conversation about a single trade entry.

Ground every reply in the journal context provided. Be concise (2-4 short paragraphs max), warm, and actionable.
Ask follow-up questions when useful. Do not invent trade details that are not in the context.`

export { appendMessage } from './chat-messages'

function buildChatPrompt(
  entry: Awaited<ReturnType<typeof getEntry>>,
  messages: JournalChatMessage[],
): string {
  const context = {
    setupTag: entry.setupTag,
    side: entry.side,
    symbolTicker: entry.symbolTicker,
    planned: entry.planned,
    actual: entry.actual,
    emotion: entry.emotion,
    mistakes: entry.mistakes,
    note: entry.note,
    linkedExecutions: entry.linkedExecutions,
  }

  const history = messages
    .map(message => `${message.role === 'user' ? 'Trader' : 'Coach'}: ${message.content}`)
    .join('\n\n')

  return `Journal entry context (JSON):
${JSON.stringify(context, null, 2)}

Conversation so far:
${history || '(no prior messages)'}

Respond as the coach to the trader's latest message.`
}

export async function getConversation(userId: string, journalEntryId: string) {
  await getEntry(userId, journalEntryId)
  const db = useDb()

  const [conversation] = await db
    .select()
    .from(journalConversations)
    .where(
      and(
        eq(journalConversations.journalEntryId, journalEntryId),
        eq(journalConversations.userId, userId),
      ),
    )
    .limit(1)

  if (!conversation) {
    return {
      id: null,
      journalEntryId,
      messages: [] as JournalChatMessage[],
      createdAt: null,
    }
  }

  return {
    id: conversation.id,
    journalEntryId: conversation.journalEntryId,
    messages: conversation.messages,
    createdAt: conversation.createdAt.toISOString(),
  }
}

export async function addMessage(userId: string, journalEntryId: string, message: string) {
  const usage = await checkAiCredits(userId)
  if (!usage.allowed) {
    throw createError({
      statusCode: 429,
      statusMessage: `AI credit limit reached (${usage.used}/${usage.limit} this month)`,
    })
  }

  const entry = await getEntry(userId, journalEntryId)
  const db = useDb()

  const [existing] = await db
    .select()
    .from(journalConversations)
    .where(
      and(
        eq(journalConversations.journalEntryId, journalEntryId),
        eq(journalConversations.userId, userId),
      ),
    )
    .limit(1)

  const withUserMessage = appendMessage(existing?.messages ?? [], 'user', message)
  const provider = getAIProvider()
  const prompt = buildChatPrompt(entry, withUserMessage)

  const completion = await provider.completeReview(prompt, {
    systemPrompt: CHAT_SYSTEM_PROMPT,
    maxTokens: 800,
    temperature: 0.5,
  })

  const withAssistantMessage = appendMessage(withUserMessage, 'assistant', completion.text)

  if (existing) {
    const [updated] = await db
      .update(journalConversations)
      .set({ messages: withAssistantMessage })
      .where(eq(journalConversations.id, existing.id))
      .returning()

    await incrementUsage(userId, 'aiCredits')

    const assistantReply = withAssistantMessage.at(-1)!
    return {
      conversationId: updated!.id,
      message: assistantReply,
      messages: withAssistantMessage,
    }
  }

  const conversationId = uuidv7()
  await db.insert(journalConversations).values({
    id: conversationId,
    userId,
    journalEntryId,
    messages: withAssistantMessage,
  })

  await incrementUsage(userId, 'aiCredits')

  const assistantReply = withAssistantMessage.at(-1)!
  return {
    conversationId,
    message: assistantReply,
    messages: withAssistantMessage,
  }
}

export async function assertJournalEntryOwnership(userId: string, journalEntryId: string) {
  const db = useDb()
  const [entry] = await db
    .select({ id: journalEntries.id })
    .from(journalEntries)
    .where(and(eq(journalEntries.id, journalEntryId), eq(journalEntries.userId, userId)))
    .limit(1)

  if (!entry) {
    throw createError({ statusCode: 404, statusMessage: 'Journal entry not found' })
  }
}
