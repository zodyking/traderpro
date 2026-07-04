import { describe, expect, it } from 'vitest'
import { appendMessage } from '../server/domains/journal/chat-messages'

describe('journal chat appendMessage', () => {
  it('appends a user message to an empty thread', () => {
    const messages = appendMessage([], 'user', 'What went wrong on entry?')

    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      role: 'user',
      content: 'What went wrong on entry?',
    })
    expect(messages[0]!.createdAt).toBeTruthy()
  })

  it('appends assistant replies after existing messages', () => {
    const first = appendMessage([], 'user', 'How was my risk?')
    const second = appendMessage(first, 'assistant', 'Position size was within plan.')

    expect(second).toHaveLength(2)
    expect(second[0]!.role).toBe('user')
    expect(second[1]).toMatchObject({
      role: 'assistant',
      content: 'Position size was within plan.',
    })
  })

  it('trims whitespace from message content', () => {
    const messages = appendMessage([], 'user', '  hello coach  ')
    expect(messages[0]!.content).toBe('hello coach')
  })

  it('rejects empty messages', () => {
    expect(() => appendMessage([], 'user', '   ')).toThrow()
  })

  it('preserves message order across multiple turns', () => {
    let messages = appendMessage([], 'user', 'First question')
    messages = appendMessage(messages, 'assistant', 'First answer')
    messages = appendMessage(messages, 'user', 'Follow-up')
    messages = appendMessage(messages, 'assistant', 'Second answer')

    expect(messages.map(m => m.role)).toEqual([
      'user',
      'assistant',
      'user',
      'assistant',
    ])
  })
})
