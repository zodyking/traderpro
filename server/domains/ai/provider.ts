export interface AICompletionOptions {
  maxTokens?: number
  temperature?: number
  systemPrompt?: string
}

export interface AICompletionResult {
  text: string
  tokensIn: number
  tokensOut: number
  model: string
  costUsd: number
}

export interface AIProvider {
  completeReview(prompt: string, options?: AICompletionOptions): Promise<AICompletionResult>
  modelName: string
}
