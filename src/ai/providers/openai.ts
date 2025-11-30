import { AIProvider, AIMessage, AIGenerationOptions, AIStreamResponse, ProviderConfig } from '../types';
import { requestUrl } from 'obsidian';
import { TimeoutManager } from '../../utils/timeout-manager';
import { Logger } from '../../utils/logger';

export class OpenAIProvider implements AIProvider {
	name = 'OpenAI';
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

	async chatCompletion(messages: AIMessage[], options?: AIGenerationOptions): Promise<string> {
		if (!this.config.apiKey) {
			throw new Error('OpenAI API key not configured');
		}

		const requestMessages = [...messages];
		if (options?.systemPrompt) {
			requestMessages.unshift({ role: 'system', content: options.systemPrompt });
		}

		const modelName = options?.model || this.config.model || 'gpt-5';
		const baseUrl = this.config.baseUrl || 'https://api.openai.com/v1';

		// Always use the new /responses endpoint as we only support modern models (GPT-5+)
		let endpoint = baseUrl;
		if (!baseUrl.endsWith('/responses')) {
			endpoint = `${baseUrl}/responses`;
		}

		interface OpenAIRequestBody {
			model: string;
			input: AIMessage[];
			max_output_tokens: number;
			reasoning: { effort: string };
		}

		const requestBodyObj: OpenAIRequestBody = {
			model: modelName,
			input: requestMessages,
			max_output_tokens: options?.maxTokens || this.generalSettings.defaultMaxTokens,
			reasoning: { effort: 'medium' }
		};

        // Override reasoning.effort for -pro models
        if (modelName.endsWith('-pro')) {
            requestBodyObj.reasoning.effort = 'high';
        }

		const requestBody = JSON.stringify(requestBodyObj);

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
					body: requestBody,
					throw: false
				});

				if (response.status === 200) {
					const data = response.json;
					
					// Handle new Responses API format (v1/responses)
					if (data.output_text) {
						return data.output_text;
					}
					
					if (data.output && Array.isArray(data.output)) {
						// Extract text content from output items
						// GPT-5 returns items with type 'message' (containing 'content') or 'text'
						return data.output
							.filter((item: unknown) => {
								const outputItem = item as { type?: string };
								return outputItem.type === 'message' || outputItem.type === 'text';
							})
							.map((item: unknown) => {
								const outputItem = item as { content?: unknown; text?: string };
								const content = outputItem.content || outputItem.text || '';
								// content might be an array of parts (e.g. [{type: 'text', text: '...'}])
								if (Array.isArray(content)) {
									return content
										.map((part: unknown) => {
											const contentPart = part as { text?: string; value?: string };
											return contentPart.text || contentPart.value || '';
										})
										.join('');
								}
								return content;
							})
							.join('');
					}

					// Handle legacy Chat Completions API format (choices)
					if (data.choices && data.choices.length > 0 && data.choices[0].message) {
						return data.choices[0].message.content;
					}
					
					// If we get here, the response format is unexpected
					Logger.error('OpenAI API Response Error: Unexpected format', {
						data: data,
						model: modelName,
						endpoint: endpoint
					});
					throw new Error('OpenAI API: Unexpected response format');
				}

				// Check if it's a 500-level error that we should retry
				if (response.status >= 500 && attempt < maxRetries) {
					const delay = baseDelay * Math.pow(2, attempt); // Exponential backoff
					await new Promise<void>(resolve => {
						this.timeoutManager.addTimeout(() => resolve(), delay);
					});
					continue; // Retry
				}

				// For all other errors or final attempt, log details and throw error

				// Try to parse error message if JSON
				let errorMessage = `${response.status}`;
				try {
					const errorData = JSON.parse(response.text);
					if (errorData.error) {
						errorMessage = `${response.status}: ${errorData.error.message || errorData.error.type || response.text}`;
					}
				} catch {
					errorMessage = `${response.status}: ${response.text}`;
				}

				// Log detailed error for debugging (following Google provider pattern)
				Logger.error('OpenAI API Error Details:', {
					status: response.status,
					headers: response.headers,
					errorText: response.text,
					requestBody: requestBodyObj,
					model: modelName,
					endpoint: endpoint,
					attempt: attempt + 1,
					maxRetries: maxRetries
				});

				throw new Error(`OpenAI API error: ${errorMessage}`);

			} catch (error) {
				// Network errors - retry if not final attempt
				if (attempt < maxRetries && error instanceof Error && (
					error.message.includes('Network error') || 
					error.message.includes('Failed to connect')
				)) {
					const delay = baseDelay * Math.pow(2, attempt);
					await new Promise<void>(resolve => {
						this.timeoutManager.addTimeout(() => resolve(), delay);
					});
					continue;
				}
				
				// Log the error before re-throwing if it wasn't retried or if retries failed
				Logger.error('OpenAI API Request Failed (Exception):', {
					error: error,
					message: error instanceof Error ? error.message : String(error),
					model: modelName,
					endpoint: endpoint,
					attempt: attempt + 1
				});
				
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
			await new Promise<void>(resolve => {
				this.timeoutManager.addTimeout(() => resolve(), 20);
			});
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

			void response.json; // Validate response format
			
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