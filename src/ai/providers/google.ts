import { AIProvider, AIMessage, AIGenerationOptions, AIStreamResponse, ProviderConfig } from '../types';

export class GoogleProvider implements AIProvider {
	name = 'Google (Gemini)';
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

	private formatMessagesForGemini(messages: AIMessage[], systemPrompt?: string): any {
		const contents = [];
		
		if (systemPrompt) {
			contents.push({
				role: 'user',
				parts: [{ text: `System: ${systemPrompt}` }]
			});
		}

		for (const message of messages) {
			const role = message.role === 'assistant' ? 'model' : 'user';
			contents.push({
				role,
				parts: [{ text: message.content }]
			});
		}

		return contents;
	}

	async chatCompletion(messages: AIMessage[], options?: AIGenerationOptions): Promise<string> {
		if (!this.config.apiKey) {
			throw new Error('Google API key not configured');
		}

		const model = options?.model || this.config.model || 'gemini-pro';
		const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.config.apiKey}`;

		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				contents: this.formatMessagesForGemini(messages, options?.systemPrompt),
				generationConfig: {
					temperature: options?.temperature || this.config.temperature || 0.7,
					maxOutputTokens: options?.maxTokens || this.config.maxTokens || 1000
				}
			})
		});

		if (!response.ok) {
			throw new Error(`Google API error: ${response.statusText}`);
		}

		const data = await response.json();
		return data.candidates[0].content.parts[0].text;
	}

	async complete(systemPrompt: string, userPrompt: string, options?: AIGenerationOptions): Promise<string> {
		const messages: AIMessage[] = [{ role: 'user', content: userPrompt }];
		const completeOptions = { ...options, systemPrompt };
		return this.chatCompletion(messages, completeOptions);
	}

	async *chatCompletionStream(messages: AIMessage[], options?: AIGenerationOptions): AsyncGenerator<AIStreamResponse> {
		if (!this.config.apiKey) {
			throw new Error('Google API key not configured');
		}

		const model = options?.model || this.config.model || 'gemini-pro';
		const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${this.config.apiKey}`;

		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				contents: this.formatMessagesForGemini(messages, options?.systemPrompt),
				generationConfig: {
					temperature: options?.temperature || this.config.temperature || 0.7,
					maxOutputTokens: options?.maxTokens || this.config.maxTokens || 1000
				}
			})
		});

		if (!response.ok) {
			throw new Error(`Google API error: ${response.statusText}`);
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
					if (line.trim()) {
						try {
							const parsed = JSON.parse(line);
							const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
							if (text) {
								yield { content: text, done: false };
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
	 * Fetch available models from Google API
	 */
	async getAvailableModels(): Promise<string[]> {
		if (!this.config.apiKey) {
			throw new Error('Google API key not configured');
		}

		// If we have cached models, return them
		if (this.cachedModels) {
			return this.cachedModels;
		}

		try {
			const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${this.config.apiKey}`;
			
			const response = await fetch(url, {
				method: 'GET',
				headers: {
					'Content-Type': 'application/json'
				}
			});

			if (!response.ok) {
				throw new Error(`API request failed: ${response.statusText}`);
			}

			const data = await response.json();
			
			// Filter to generative models that support generateContent
			const generativeModels = data.models
				.filter((model: any) => {
					return model.supportedGenerationMethods && 
						   model.supportedGenerationMethods.includes('generateContent') &&
						   model.name.includes('gemini');
				})
				.map((model: any) => {
					// Extract model name from full path (e.g., "models/gemini-pro" -> "gemini-pro")
					return model.name.split('/').pop();
				})
				.sort();

			const models = generativeModels.length > 0 ? generativeModels : [
				'gemini-2.0-flash-exp',
				'gemini-1.5-pro',
				'gemini-1.5-flash',
				'gemini-1.0-pro'
			];

			this.cachedModels = models;
			return models;
		} catch (error) {
			throw new Error(`Failed to fetch Google models: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	/**
	 * Clear cached models
	 */
	clearModelCache(): void {
		this.cachedModels = null;
	}
}