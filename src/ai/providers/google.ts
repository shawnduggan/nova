import { AIProvider, AIMessage, AIGenerationOptions, AIStreamResponse, ProviderConfig } from '../types';
import { Logger } from '../../utils/logger';
import { requestUrl } from 'obsidian';
import { TimeoutManager } from '../../utils/timeout-manager';

export class GoogleProvider implements AIProvider {
	name = 'Google (Gemini)';
	private config: ProviderConfig;
	private cachedModels: string[] | null = null;
	private generalSettings: { defaultTemperature: number; defaultMaxTokens: number };
	private timeoutManager: TimeoutManager;

	constructor(config: ProviderConfig, generalSettings: { defaultTemperature: number; defaultMaxTokens: number }, timeoutManager: TimeoutManager) {
		this.config = config;
		this.generalSettings = generalSettings;
		this.timeoutManager = timeoutManager;
	}

	updateConfig(config: ProviderConfig) {
		this.config = config;
	}

	isAvailable(): boolean {
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

	private formatMessagesForGemini(messages: AIMessage[]): any {
		const contents = [];

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
		

		const requestBody: any = {
			contents: this.formatMessagesForGemini(messages),
			generationConfig: {
				temperature: options?.temperature || this.generalSettings.defaultTemperature,
				maxOutputTokens: options?.maxTokens || this.generalSettings.defaultMaxTokens
			}
		};

		// Add system instruction if provided (Google's proper format)
		if (options?.systemPrompt && options.systemPrompt.trim()) {
			requestBody.systemInstruction = {
				parts: [{ text: options.systemPrompt }]
			};
		}

		const response = await requestUrl({
			url: url,
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(requestBody),
			throw: false
		});

		if (response.status !== 200) {
			const errorText = response.text;
			let errorMessage = '';
			
			try {
				const errorData = JSON.parse(errorText);
				if (errorData.error) {
					// Format as [CODE]: message
					const code = errorData.error.code || response.status;
					const message = errorData.error.message || errorData.error.status;
					errorMessage = `[${code}]: ${message}`;
					
					// Add specific guidance for common errors
					if (response.status === 400) {
						errorMessage += ' (Check request format or model name)';
					} else if (response.status === 401) {
						errorMessage += ' (Check API key in settings)';
					} else if (response.status === 404) {
						errorMessage += ' (Model may not be available)';
					} else if (response.status === 429) {
						errorMessage += ' (Rate limit exceeded)';
					}
				} else {
					errorMessage = `[${response.status}]: ${errorText}`;
				}
			} catch (e) {
				errorMessage = `[${response.status}]: ${errorText}`;
			}
			
			// Log detailed error for debugging
			Logger.error('Google API Error Details:', {
				status: response.status,
				errorText: errorText,
				requestBody: requestBody,
				model: model,
				url: url
			});
			
			throw new Error(`Google API error ${errorMessage}`);
		}

		const data = response.json;
		
		
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
			
			// Make sure we have actual text content
			if (!text || text.trim().length === 0) {
				Logger.error('Google API returned empty text content');
				throw new Error('Google API returned empty text content');
			}
			
			return text;
		}
		
		throw new Error('Google API returned empty response');
	}

	async complete(systemPrompt: string, userPrompt: string, options?: AIGenerationOptions): Promise<string> {
		const messages: AIMessage[] = [{ role: 'user', content: userPrompt }];
		const completeOptions = { ...options, systemPrompt };
		return this.chatCompletion(messages, completeOptions);
	}

	async *chatCompletionStream(messages: AIMessage[], options?: AIGenerationOptions): AsyncGenerator<AIStreamResponse> {
		// Get the full response from Google, then simulate streaming with consistent chunking
		const result = await this.chatCompletion(messages, options);
		
		// Split result into smaller chunks for consistent typewriter effect
		const chunkSize = 3; // Characters per chunk
		for (let i = 0; i < result.length; i += chunkSize) {
			const chunk = result.slice(i, i + chunkSize);
			yield { content: chunk, done: false };
			// Small delay between chunks to create smooth typewriter effect
			await new Promise<void>(resolve => {
				this.timeoutManager.addTimeout(() => resolve(), 20);
			});
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
			
			const response = await requestUrl({
				url: url,
				method: 'GET',
				headers: {
					'Content-Type': 'application/json'
				}
			});

			if (response.status !== 200) {
				throw new Error(`API request failed: ${response.status}`);
			}

			response.json; // Validate response format
			
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