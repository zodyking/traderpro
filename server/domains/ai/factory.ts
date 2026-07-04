import type { AIProvider } from './provider'
import { createAnthropicProvider } from './anthropic'
import { createMockProvider } from './mock'
import { createOpenAIProvider } from './openai'

let _provider: AIProvider | undefined

export function getAIProvider(): AIProvider {
  if (_provider) return _provider

  const openaiKey = process.env.OPENAI_API_KEY
  const anthropicKey = process.env.ANTHROPIC_API_KEY

  if (openaiKey) {
    _provider = createOpenAIProvider(openaiKey)
  }
  else if (anthropicKey) {
    _provider = createAnthropicProvider(anthropicKey)
  }
  else {
    _provider = createMockProvider()
  }

  return _provider
}
