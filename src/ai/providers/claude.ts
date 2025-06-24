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

		const requestBody = JSON.stringify({
			model: options?.model || this.config.model || 'claude-3-5-haiku-latest',
			max_tokens: options?.maxTokens || this.config.maxTokens,
			temperature: options?.temperature || this.config.temperature,
			system: options?.systemPrompt,
			messages: messages.map(msg => ({
				role: msg.role === 'assistant' ? 'assistant' : 'user',
				content: msg.content
			}))
		});

		// Retry logic for 500-level errors
		const maxRetries = 3;
		const baseDelay = 1000; // 1 second

		for (let attempt = 0; attempt <= maxRetries; attempt++) {
			try {
				const response = await requestUrl({
					url: 'https://api.anthropic.com/v1/messages',
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'x-api-key': this.config.apiKey,
						'anthropic-version': '2023-06-01'
					},
					body: requestBody
				});

				if (response.status === 200) {
					const data = response.json;
					return data.content[0].text;
				}

				// Check if it's a 500-level error that we should retry
				if (response.status >= 500 && attempt < maxRetries) {
					const delay = baseDelay * Math.pow(2, attempt); // Exponential backoff
					await new Promise(resolve => setTimeout(resolve, delay));
					continue; // Retry
				}

				// For all other errors or final attempt, throw error
				throw new Error(`Claude API error: ${response.status} - ${response.text}`);

			} catch (error) {
				// Network/connection errors - retry if not final attempt
				if (attempt < maxRetries && error instanceof Error && (
					error.message.includes('Network error') || 
					error.message.includes('Failed to connect')
				)) {
					const delay = baseDelay * Math.pow(2, attempt);
					await new Promise(resolve => setTimeout(resolve, delay));
					continue;
				}
				
				// Re-throw the error if it's the final attempt or not a retryable error
				if (error instanceof Error && error.message.startsWith('Claude API error:')) {
					throw error; // Already formatted error
				}
				throw new Error(`Failed to connect to Claude API: ${error instanceof Error ? error.message : 'Network error'}`);
			}
		}

		// This should never be reached, but TypeScript wants it
		throw new Error('Claude API: Maximum retries exceeded');
	}

	async complete(systemPrompt: string, userPrompt: string, options?: AIGenerationOptions): Promise<string> {
		const messages: AIMessage[] = [{ role: 'user', content: userPrompt }];
		const completeOptions = { ...options, systemPrompt };
		return this.chatCompletion(messages, completeOptions);
	}

	async *chatCompletionStream(messages: AIMessage[], options?: AIGenerationOptions): AsyncGenerator<AIStreamResponse> {
		// Get the full response from Claude, then simulate streaming with consistent chunking
		const result = await this.chatCompletion(messages, options);
		
		// Split result into smaller chunks for consistent typewriter effect
		const chunkSize = 3; // Characters per chunk
		for (let i = 0; i < result.length; i += chunkSize) {
			const chunk = result.slice(i, i + chunkSize);
			yield { content: chunk, done: false };
			// Small delay between chunks to create smooth typewriter effect
			await new Promise(resolve => setTimeout(resolve, 20));
		}
		
		yield { content: '', done: true };
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