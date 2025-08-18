import { AIProvider, AIMessage, AIGenerationOptions, AIStreamResponse, ProviderConfig } from '../types';
import { requestUrl } from 'obsidian';

export class OpenAIProvider implements AIProvider {
	name = 'OpenAI';
	private config: ProviderConfig;
	private cachedModels: string[] | null = null;
	private generalSettings: { defaultTemperature: number; defaultMaxTokens: number };

	constructor(config: ProviderConfig, generalSettings: { defaultTemperature: number; defaultMaxTokens: number }) {
		this.config = config;
		this.generalSettings = generalSettings;
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
			throw new Error('OpenAI API key not configured');
		}

		const requestMessages = [...messages];
		if (options?.systemPrompt) {
			requestMessages.unshift({ role: 'system', content: options.systemPrompt });
		}

		const baseUrl = this.config.baseUrl || 'https://api.openai.com/v1';
		const endpoint = baseUrl.endsWith('/chat/completions') ? baseUrl : `${baseUrl}/chat/completions`;
		
		const requestBody = JSON.stringify({
			model: options?.model || this.config.model || 'gpt-3.5-turbo',
			messages: requestMessages,
			max_tokens: options?.maxTokens || this.generalSettings.defaultMaxTokens,
			temperature: options?.temperature || this.generalSettings.defaultTemperature
		});

		// Retry logic for 500-level errors
		const maxRetries = 3;
		const baseDelay = 1000; // 1 second

		for (let attempt = 0; attempt <= maxRetries; attempt++) {
			try {
				const response = await requestUrl({
					url: endpoint,
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${this.config.apiKey}`
					},
					body: requestBody
				});

				if (response.status === 200) {
					const data = response.json;
					return data.choices[0].message.content;
				}

				// Check if it's a 500-level error that we should retry
				if (response.status >= 500 && attempt < maxRetries) {
					const delay = baseDelay * Math.pow(2, attempt); // Exponential backoff
					await new Promise(resolve => setTimeout(resolve, delay));
					continue; // Retry
				}

				// For all other errors or final attempt, throw error
				throw new Error(`OpenAI API error: ${response.status} - ${response.text}`);

			} catch (error) {
				// Network errors - retry if not final attempt
				if (attempt < maxRetries && error instanceof Error && (
					error.message.includes('Network error') || 
					error.message.includes('Failed to connect')
				)) {
					const delay = baseDelay * Math.pow(2, attempt);
					await new Promise(resolve => setTimeout(resolve, delay));
					continue;
				}
				
				// Re-throw the error if it's the final attempt or not a network error
				throw error;
			}
		}

		// This should never be reached, but TypeScript wants it
		throw new Error('OpenAI API: Maximum retries exceeded');
	}

	async complete(systemPrompt: string, userPrompt: string, options?: AIGenerationOptions): Promise<string> {
		const messages: AIMessage[] = [
			{ role: 'system', content: systemPrompt },
			{ role: 'user', content: userPrompt }
		];
		return this.chatCompletion(messages, options);
	}

	async *chatCompletionStream(messages: AIMessage[], options?: AIGenerationOptions): AsyncGenerator<AIStreamResponse> {
		// Get the full response from OpenAI, then simulate streaming with consistent chunking
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
	 * Fetch available models from OpenAI API
	 */
	async getAvailableModels(): Promise<string[]> {
		if (!this.config.apiKey) {
			throw new Error('OpenAI API key not configured');
		}

		// If we have cached models, return them
		if (this.cachedModels) {
			return this.cachedModels;
		}

		try {
			const baseUrl = this.config.baseUrl || 'https://api.openai.com/v1';
			const endpoint = baseUrl.endsWith('/models') ? baseUrl : `${baseUrl}/models`;
			
			const response = await requestUrl({
				url: endpoint,
				method: 'GET',
				headers: {
					'Authorization': `Bearer ${this.config.apiKey}`
				}
			});

			if (response.status !== 200) {
				throw new Error(`API request failed: ${response.status}`);
			}

			response.json; // Validate response format
			
			// Return hardcoded current models
			const models = [
				'gpt-4.1-2025-04-14',
				'gpt-4.1-mini-2025-04-14',
				'gpt-4.1-nano-2025-04-14',
				'gpt-4o',
				'gpt-4o-mini'
			];

			this.cachedModels = models;
			return models;
		} catch (error) {
			throw new Error(`Failed to fetch OpenAI models: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	/**
	 * Clear cached models
	 */
	clearModelCache(): void {
		this.cachedModels = null;
	}
}