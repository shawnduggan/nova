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
		
		if (systemPrompt && systemPrompt.trim()) {
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

		// Ensure we have at least one message
		if (contents.length === 0) {
			throw new Error('No messages provided for Google API');
		}

		return contents;
	}

	async chatCompletion(messages: AIMessage[], options?: AIGenerationOptions): Promise<string> {
		if (!this.config.apiKey) {
			throw new Error('Google API key not configured');
		}

		// Use a newer model by default if no model is specified
		const model = options?.model || this.config.model || 'gemini-2.0-flash';
		const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.config.apiKey}`;

		const requestBody = {
			contents: this.formatMessagesForGemini(messages, options?.systemPrompt),
			generationConfig: {
				temperature: options?.temperature || this.config.temperature || 0.7,
				maxOutputTokens: options?.maxTokens || this.config.maxTokens || 1000
			}
		};

		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(requestBody)
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Google API error: ${response.statusText} - ${errorText}`);
		}

		const data = await response.json();
		
		// Check if response has valid structure
		if (!data.candidates || data.candidates.length === 0) {
			// Check if there's an error message in the response
			if (data.error) {
				throw new Error(`Google API error: ${data.error.message || JSON.stringify(data.error)}`);
			}
			throw new Error('Google API returned no candidates');
		}
		
		// Check if the response was blocked or filtered
		if (data.candidates[0].finishReason === 'SAFETY' || data.candidates[0].finishReason === 'BLOCKED') {
			throw new Error('Google API blocked the response due to safety filters');
		}
		
		// Check if we hit the token limit before generating content
		if (data.candidates[0].finishReason === 'MAX_TOKENS' && 
		    (!data.candidates[0].content || !data.candidates[0].content.parts || data.candidates[0].content.parts.length === 0)) {
			throw new Error('API hit token limit before generating any content. Please increase "Default Max Tokens" in settings.');
		}
		
		// Check if response has content
		if (data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts.length > 0) {
			const text = data.candidates[0].content.parts[0].text;
			
			// If response was truncated, throw error instead of returning partial content
			if (data.candidates[0].finishReason === 'MAX_TOKENS') {
				throw new Error('Response was truncated due to token limit. Please increase "Default Max Tokens" in settings.');
			}
			
			return text || '';
		}
		
		throw new Error('Google API returned empty response');
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

		// Use a newer model by default if no model is specified
		const model = options?.model || this.config.model || 'gemini-2.0-flash';
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
			
			// Return hardcoded current models
			const models = [
				'gemini-2.5-flash-preview-04-17',
				'gemini-2.5-pro-preview-03-25',
				'gemini-2.0-flash',
				'gemini-2.0-flash-lite'
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