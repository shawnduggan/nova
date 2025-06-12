import { AIProvider, AIMessage, AIGenerationOptions, AIStreamResponse, ProviderConfig } from '../types';

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

		const response = await fetch('https://api.anthropic.com/v1/messages', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-api-key': this.config.apiKey,
				'anthropic-version': '2023-06-01'
			},
			body: JSON.stringify({
				model: options?.model || this.config.model || 'claude-3-haiku-20240307',
				max_tokens: options?.maxTokens || this.config.maxTokens || 1000,
				temperature: options?.temperature || this.config.temperature || 0.7,
				system: options?.systemPrompt,
				messages: messages.map(msg => ({
					role: msg.role === 'assistant' ? 'assistant' : 'user',
					content: msg.content
				}))
			})
		});

		if (!response.ok) {
			throw new Error(`Claude API error: ${response.statusText}`);
		}

		const data = await response.json();
		return data.content[0].text;
	}

	async complete(systemPrompt: string, userPrompt: string, options?: AIGenerationOptions): Promise<string> {
		const messages: AIMessage[] = [{ role: 'user', content: userPrompt }];
		const completeOptions = { ...options, systemPrompt };
		return this.chatCompletion(messages, completeOptions);
	}

	async *chatCompletionStream(messages: AIMessage[], options?: AIGenerationOptions): AsyncGenerator<AIStreamResponse> {
		if (!this.config.apiKey) {
			throw new Error('Claude API key not configured');
		}

		const response = await fetch('https://api.anthropic.com/v1/messages', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-api-key': this.config.apiKey,
				'anthropic-version': '2023-06-01'
			},
			body: JSON.stringify({
				model: options?.model || this.config.model || 'claude-3-haiku-20240307',
				max_tokens: options?.maxTokens || this.config.maxTokens || 1000,
				temperature: options?.temperature || this.config.temperature || 0.7,
				system: options?.systemPrompt,
				stream: true,
				messages: messages.map(msg => ({
					role: msg.role === 'assistant' ? 'assistant' : 'user',
					content: msg.content
				}))
			})
		});

		if (!response.ok) {
			throw new Error(`Claude API error: ${response.statusText}`);
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
							if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
								yield { content: parsed.delta.text, done: false };
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
			const response = await fetch('https://api.anthropic.com/v1/messages', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-api-key': this.config.apiKey,
					'anthropic-version': '2023-06-01'
				},
				body: JSON.stringify({
					model: 'claude-3-haiku-20240307',
					max_tokens: 1,
					messages: [{ role: 'user', content: 'test' }]
				})
			});

			if (!response.ok) {
				throw new Error(`API key validation failed: ${response.statusText}`);
			}

			// Return current available models
			const models = [
				'claude-3-5-sonnet-20241022',
				'claude-3-5-haiku-20241022', 
				'claude-3-opus-20240229',
				'claude-3-sonnet-20240229',
				'claude-3-haiku-20240307'
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