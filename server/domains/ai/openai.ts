import type { AICompletionOptions, AICompletionResult, AIProvider } from './provider'

const GPT4O_MINI_COST_PER_INPUT_TOKEN = 0.00000015
const GPT4O_MINI_COST_PER_OUTPUT_TOKEN = 0.0000006

interface OpenAIChatResponse {
  choices: Array<{
    message: { content: string | null }
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
  }
  model: string
}

export function createOpenAIProvider(apiKey: string, defaultModel = 'gpt-4o-mini'): AIProvider {
  return {
    modelName: defaultModel,

    async completeReview(
      prompt: string,
      options: AICompletionOptions = {},
    ): Promise<AICompletionResult> {
      const messages: Array<{ role: string; content: string }> = []

      if (options.systemPrompt) {
        messages.push({ role: 'system', content: options.systemPrompt })
      }
      messages.push({ role: 'user', content: prompt })

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: defaultModel,
          messages,
          max_tokens: options.maxTokens ?? 1024,
          temperature: options.temperature ?? 0.3,
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`OpenAI API error ${response.status}: ${error}`)
      }

      const data = await response.json() as OpenAIChatResponse
      const text = data.choices[0]?.message?.content ?? ''
      const tokensIn = data.usage?.prompt_tokens ?? 0
      const tokensOut = data.usage?.completion_tokens ?? 0
      const costUsd
        = tokensIn * GPT4O_MINI_COST_PER_INPUT_TOKEN + tokensOut * GPT4O_MINI_COST_PER_OUTPUT_TOKEN

      return { text, tokensIn, tokensOut, model: defaultModel, costUsd }
    },
  }
}
