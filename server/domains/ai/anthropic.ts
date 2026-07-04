import type { AICompletionOptions, AICompletionResult, AIProvider } from './provider'

const HAIKU_COST_PER_INPUT_TOKEN = 0.0000008
const HAIKU_COST_PER_OUTPUT_TOKEN = 0.000004

interface AnthropicMessagesResponse {
  content: Array<{ type: string; text?: string }>
  usage?: {
    input_tokens: number
    output_tokens: number
  }
  model: string
}

export function createAnthropicProvider(
  apiKey: string,
  defaultModel = 'claude-3-5-haiku-20241022',
): AIProvider {
  return {
    modelName: defaultModel,

    async completeReview(
      prompt: string,
      options: AICompletionOptions = {},
    ): Promise<AICompletionResult> {
      const body: Record<string, unknown> = {
        model: defaultModel,
        max_tokens: options.maxTokens ?? 1024,
        temperature: options.temperature ?? 0.3,
        messages: [{ role: 'user', content: prompt }],
      }

      if (options.systemPrompt) {
        body.system = options.systemPrompt
      }

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Anthropic API error ${response.status}: ${error}`)
      }

      const data = await response.json() as AnthropicMessagesResponse
      const text = data.content.find(block => block.type === 'text')?.text ?? ''
      const tokensIn = data.usage?.input_tokens ?? 0
      const tokensOut = data.usage?.output_tokens ?? 0
      const costUsd
        = tokensIn * HAIKU_COST_PER_INPUT_TOKEN + tokensOut * HAIKU_COST_PER_OUTPUT_TOKEN

      return { text, tokensIn, tokensOut, model: defaultModel, costUsd }
    },
  }
}
