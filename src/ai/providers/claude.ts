/**
 * @file ClaudeProvider - Anthropic Claude API integration
 */

import { requestUrl } from 'obsidian';
import { AIProvider, AIMessage, AIGenerationOptions, AIStreamResponse, ProviderConfig } from '../types';
import { Logger } from '../../utils/logger';
import { TimeoutManager } from '../../utils/timeout-manager';

export class ClaudeProvider implements AIProvider {
	name = 'Claude (Anthropic)';
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
			throw new Error('Claude API key not configured');
		}

		const model = options?.model || this.config.model || 'claude-haiku-4-5-20251001';
		const body: Record<string, unknown> = {
			model,
			max_tokens: options?.maxTokens || this.generalSettings.defaultMaxTokens
		};
		if (modelAcceptsTemperature(model)) {
			body.temperature = options?.temperature || this.generalSettings.defaultTemperature;
		}
		body.system = options?.systemPrompt;
		body.messages = messages.map(msg => ({
			role: msg.role === 'assistant' ? 'assistant' : 'user',
			content: msg.content
		}));
		const requestBody = JSON.stringify(body);

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
					body: requestBody,
					throw: false
				});

				if (response.status === 200) {
					const data: unknown = response.json;
					return extractClaudeTextContent(data);
				}

				// Check if it's a 500-level error that we should retry
				if (response.status >= 500 && attempt < maxRetries) {
					const delay = baseDelay * Math.pow(2, attempt); // Exponential backoff
					await new Promise<void>(resolve => {
						this.timeoutManager.addTimeout(() => resolve(), delay);
					});
					continue; // Retry
				}

					Logger.error('Claude API request failed', {
						status: response.status,
						model,
						attempt: attempt + 1
					});

					throw new Error(`Claude API error: ${response.status}`);

			} catch (error) {
				// Network/connection errors - retry if not final attempt
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
				
					if (error instanceof Error && error.message.startsWith('Claude API')) {
						throw error;
					}
					throw new Error('Claude API request failed');
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
			// Check if operation was aborted
			if (options?.signal?.aborted) {
				return; // Exit generator early
			}

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
					model: 'claude-haiku-4-5-20251001',
					max_tokens: 1,
					messages: [{ role: 'user', content: 'test' }]
				})
			});

				if (response.status !== 200) {
					throw new Error(`Claude API key validation failed: ${response.status}`);
			}

			// Return current available models (from API docs)
			const models = [
				'claude-opus-5',
				'claude-opus-4-8',
				'claude-sonnet-5',
				'claude-opus-4-7',
				'claude-opus-4-6',
				'claude-sonnet-4-6',
				'claude-haiku-4-5-20251001'
			];

			this.cachedModels = models;
			return models;
			} catch {
				throw new Error('Failed to fetch Claude models');
		}
	}

	/**
	 * Clear cached models
	 */
	clearModelCache(): void {
		this.cachedModels = null;
	}
}

function extractClaudeTextContent(data: unknown): string {
	if (!isRecord(data) || !Array.isArray(data.content)) {
		throw new Error('Claude API response did not include text content.');
	}

	const textBlocks: string[] = [];
	for (const block of data.content) {
		if (isRecord(block) && block.type === 'text' && typeof block.text === 'string') {
			textBlocks.push(block.text);
		}
	}

	const text = textBlocks.join('');
	if (!text.trim()) {
		throw new Error('Claude API response did not include text content.');
	}

	return text;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

// Anthropic deprecated the `temperature` parameter for newer Claude models;
// sending it returns a 400 "temperature is deprecated for this model" error.
// Extend this predicate as additional models drop the parameter.
export function modelAcceptsTemperature(model: string): boolean {
	return !model.startsWith('claude-opus-5')
		&& !model.startsWith('claude-opus-4-7')
		&& !model.startsWith('claude-opus-4-8')
		&& !model.startsWith('claude-sonnet-5');
}
