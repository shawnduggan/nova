import { AIProvider, AIMessage, AIGenerationOptions, AIStreamResponse, ProviderConfig } from '../types';
import { requestUrl } from 'obsidian';

export class ClaudeProvider implements AIProvider {
	name = 'Claude (Anthropic)';
	private config: ProviderConfig;
	private cachedModels: string[] | null = null;

	constructor(config: ProviderConfig) {
		this.config = config;
	}

	updateConfig(config: ProviderConfig) {
		this.config = config;
	}

	async isAvailable(): Promise<boolean> {
		return !!this.config.apiKey;
	}

	async generateText(prompt: string, options?: AIGenerationOptions): Promise<string> {
		const messages: AIMessage[] = [{ role: 'user', content: prompt }];
		return this.chatCompletion(messages, options);
	}

	async *generateTextStream(prompt: string, options?: AIGenerationOptions): AsyncGenerator<AIStreamResponse> {
		const messages: AIMessage[] = [{ role: 'user', content: prompt }];
		yield* this.chatCompletionStream(messages, options);
	}

	async chatCompletion(messages: AIMessage[], options?: AIGenerationOptions): Promise<string> {
		if (!this.config.apiKey) {
			throw new Error('Claude API key not configured');
		}

		let response;
		try {
			response = await requestUrl({
				url: 'https://api.anthropic.com/v1/messages',
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-api-key': this.config.apiKey,
					'anthropic-version': '2023-06-01'
				},
				body: JSON.stringify({
					model: options?.model || this.config.model || 'claude-3-5-haiku-latest',
					max_tokens: options?.maxTokens || this.config.maxTokens || 1000,
					temperature: options?.temperature || this.config.temperature || 0.7,
					system: options?.systemPrompt,
					messages: messages.map(msg => ({
						role: msg.role === 'assistant' ? 'assistant' : 'user',
						content: msg.content
					}))
				})
			});
		} catch (error) {
			console.error('Claude API Request Error:', error);
			throw new Error(`Failed to connect to Claude API: ${error instanceof Error ? error.message : 'Network error'}`);
		}

		if (response.status !== 200) {
			console.error('Claude API Error:', response.status, response.text);
			throw new Error(`Claude API error: ${response.status} - ${response.text}`);
		}

		const data = response.json;
		return data.content[0].text;
	}

	async complete(systemPrompt: string, userPrompt: string, options?: AIGenerationOptions): Promise<string> {
		const messages: AIMessage[] = [{ role: 'user', content: userPrompt }];
		const completeOptions = { ...options, systemPrompt };
		return this.chatCompletion(messages, completeOptions);
	}

	async *chatCompletionStream(messages: AIMessage[], options?: AIGenerationOptions): AsyncGenerator<AIStreamResponse> {
		// For now, fall back to non-streaming for Claude due to CORS limitations
		// requestUrl doesn't support streaming, so we'll get the full response at once
		const result = await this.chatCompletion(messages, options);
		yield { content: result, done: true };
	}

	/**
	 * Fetch available models from Claude API
	 */
	async getAvailableModels(): Promise<string[]> {
		if (!this.config.apiKey) {
			throw new Error('Claude API key not configured');
		}

		// If we have cached models, return them
		if (this.cachedModels) {
			return this.cachedModels;
		}

		// For Claude, we'll use a hardcoded list since Anthropic doesn't provide a models endpoint
		// But we can validate the API key by making a test call
		try {
			// Validate API key with a minimal request
			const response = await requestUrl({
				url: 'https://api.anthropic.com/v1/messages',
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-api-key': this.config.apiKey,
					'anthropic-version': '2023-06-01'
				},
				body: JSON.stringify({
					model: 'claude-3-5-haiku-latest',
					max_tokens: 1,
					messages: [{ role: 'user', content: 'test' }]
				})
			});

			if (response.status !== 200) {
				throw new Error(`API key validation failed: ${response.status} - ${response.text}`);
			}

			// Return current available models (from API docs)
			const models = [
				'claude-opus-4-20250514',
				'claude-sonnet-4-20250514',
				'claude-3-7-sonnet-latest',
				'claude-3-5-sonnet-latest',
				'claude-3-5-haiku-latest'
			];

			this.cachedModels = models;
			return models;
		} catch (error) {
			throw new Error(`Failed to fetch Claude models: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	/**
	 * Clear cached models
	 */
	clearModelCache(): void {
		this.cachedModels = null;
	}
}