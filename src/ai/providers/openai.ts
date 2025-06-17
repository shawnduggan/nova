import { AIProvider, AIMessage, AIGenerationOptions, AIStreamResponse, ProviderConfig } from '../types';

export class OpenAIProvider implements AIProvider {
	name = 'OpenAI';
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
			max_tokens: options?.maxTokens || this.config.maxTokens || 1000,
			temperature: options?.temperature || this.config.temperature || 0.7
		});

		// Retry logic for 500-level errors
		const maxRetries = 3;
		const baseDelay = 1000; // 1 second

		for (let attempt = 0; attempt <= maxRetries; attempt++) {
			try {
				const response = await fetch(endpoint, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${this.config.apiKey}`
					},
					body: requestBody
				});

				if (response.ok) {
					const data = await response.json();
					return data.choices[0].message.content;
				}

				// Check if it's a 500-level error that we should retry
				if (response.status >= 500 && attempt < maxRetries) {
					const delay = baseDelay * Math.pow(2, attempt); // Exponential backoff
					await new Promise(resolve => setTimeout(resolve, delay));
					continue; // Retry
				}

				// For all other errors or final attempt, throw error
				throw new Error(`OpenAI API error: ${response.statusText}`);

			} catch (error) {
				// Network errors - retry if not final attempt
				if (attempt < maxRetries && error instanceof Error && error.message.includes('fetch')) {
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
		if (!this.config.apiKey) {
			throw new Error('OpenAI API key not configured');
		}

		const requestMessages = [...messages];
		if (options?.systemPrompt) {
			requestMessages.unshift({ role: 'system', content: options.systemPrompt });
		}

		const baseUrl = this.config.baseUrl || 'https://api.openai.com/v1';
		const endpoint = baseUrl.endsWith('/chat/completions') ? baseUrl : `${baseUrl}/chat/completions`;
		const response = await fetch(endpoint, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${this.config.apiKey}`
			},
			body: JSON.stringify({
				model: options?.model || this.config.model || 'gpt-3.5-turbo',
				messages: requestMessages,
				max_tokens: options?.maxTokens || this.config.maxTokens || 1000,
				temperature: options?.temperature || this.config.temperature || 0.7,
				stream: true
			})
		});

		if (!response.ok) {
			throw new Error(`OpenAI API error: ${response.statusText}`);
		}

		const reader = response.body?.getReader();
		if (!reader) {
			throw new Error('Failed to get response reader');
		}

		const decoder = new TextDecoder();
		let buffer = '';

		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split('\n');
				buffer = lines.pop() || '';

				for (const line of lines) {
					if (line.startsWith('data: ')) {
						const data = line.slice(6);
						if (data === '[DONE]') {
							yield { content: '', done: true };
							return;
						}

						try {
							const parsed = JSON.parse(data);
							const content = parsed.choices?.[0]?.delta?.content;
							if (content) {
								// Split content into smaller chunks for consistent typewriter effect
								const chunkSize = 3; // Characters per chunk
								for (let i = 0; i < content.length; i += chunkSize) {
									const chunk = content.slice(i, i + chunkSize);
									yield { content: chunk, done: false };
									// Small delay between chunks to create smooth typewriter effect
									await new Promise(resolve => setTimeout(resolve, 20));
								}
							}
						} catch (e) {
							// Skip malformed JSON
						}
					}
				}
			}
		} finally {
			reader.releaseLock();
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
			
			const response = await fetch(endpoint, {
				method: 'GET',
				headers: {
					'Authorization': `Bearer ${this.config.apiKey}`
				}
			});

			if (!response.ok) {
				throw new Error(`API request failed: ${response.statusText}`);
			}

			const data = await response.json();
			
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