/**
 * @file OllamaProvider - Local Ollama API integration
 */

import { AIProvider, AIMessage, AIGenerationOptions, AIStreamResponse, ProviderConfig } from '../types';
import { requestUrl } from 'obsidian';
import { TimeoutManager } from '../../utils/timeout-manager';
import { Logger } from '../../utils/logger';

export class OllamaProvider implements AIProvider {
	name = 'Ollama (local Ollama API)';
	private config: ProviderConfig;
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

	private getBaseUrl(): string {
		const configuredBaseUrl = this.config.baseUrl?.trim();
		if (!configuredBaseUrl) {
			return 'http://localhost:11434';
		}

		return configuredBaseUrl.replace(/\/+$/, '');
	}

	async isAvailable(): Promise<boolean> {
		try {
			await this.getAvailableModels();
			return true;
		} catch {
			return false;
		}
	}

	async getAvailableModels(): Promise<string[]> {
		const baseUrl = this.getBaseUrl();
			const response = await requestUrl({
			url: `${baseUrl}/api/tags`,
			method: 'GET',
			headers: { 'Content-Type': 'application/json' },
				throw: false
			}).catch(() => {
				throw new Error('Ollama models API request failed');
			});

			if (response.status !== 200) {
				throw new Error(`Ollama API error: ${response.status}`);
		}

		return this.extractModelNames(response.json);
	}

	private extractModelNames(responseJson: unknown): string[] {
		const models = (responseJson as { models?: unknown }).models;
		if (!Array.isArray(models)) {
			return [];
		}

		const names = models.flatMap((model): string[] => {
			if (!model || typeof model !== 'object') {
				return [];
			}

			const name = (model as { name?: unknown }).name;
			if (typeof name !== 'string') {
				return [];
			}

			const trimmedName = name.trim();
			return trimmedName ? [trimmedName] : [];
		});

		return Array.from(new Set(names));
	}

	async generateText(prompt: string, options?: AIGenerationOptions): Promise<string> {
		const baseUrl = this.getBaseUrl();
		const model = options?.model || this.config.model;
		if (!model) {
			throw new Error('Ollama model must be specified');
		}

			const response = await requestUrl({
			url: `${baseUrl}/api/generate`,
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				model,
				prompt,
				stream: false,
				options: {
					temperature: options?.temperature || this.generalSettings.defaultTemperature,
					num_predict: options?.maxTokens || this.generalSettings.defaultMaxTokens
				}
			}),
				throw: false
			}).catch(() => {
				throw new Error('Ollama API request failed');
			});

			if (response.status !== 200) {
				Logger.error('Ollama API request failed', {
					status: response.status,
					model
				});
				throw new Error(`Ollama API error: ${response.status}`);
		}

		const data = response.json;
		return data.response;
	}

	async *generateTextStream(prompt: string, options?: AIGenerationOptions): AsyncGenerator<AIStreamResponse> {
		// Get the full response from Ollama, then simulate streaming with consistent chunking
		const result = await this.generateText(prompt, options);

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

	async chatCompletion(messages: AIMessage[], options?: AIGenerationOptions): Promise<string> {
		const baseUrl = this.getBaseUrl();
		const model = options?.model || this.config.model;
		if (!model) {
			throw new Error('Ollama model must be specified');
		}

			const response = await requestUrl({
			url: `${baseUrl}/api/chat`,
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				model,
				messages: messages.map(msg => ({
					role: msg.role,
					content: msg.content
				})),
				stream: false,
				options: {
					temperature: options?.temperature || this.generalSettings.defaultTemperature,
					num_predict: options?.maxTokens || this.generalSettings.defaultMaxTokens
				}
			}),
				throw: false
			}).catch(() => {
				throw new Error('Ollama API request failed');
			});

			if (response.status !== 200) {
				Logger.error('Ollama API request failed', {
					status: response.status,
					model
				});
				throw new Error(`Ollama API error: ${response.status}`);
		}

		const data = response.json;
		return data.message.content;
	}

	async complete(systemPrompt: string, userPrompt: string, options?: AIGenerationOptions): Promise<string> {
		const messages: AIMessage[] = [
			{ role: 'system', content: systemPrompt },
			{ role: 'user', content: userPrompt }
		];
		return this.chatCompletion(messages, options);
	}

	async *chatCompletionStream(messages: AIMessage[], options?: AIGenerationOptions): AsyncGenerator<AIStreamResponse> {
		// Get the full response from Ollama, then simulate streaming with consistent chunking
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
}
