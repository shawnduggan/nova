/**
 * @file OllamaProvider - Local Ollama API integration
 */

import { AIProvider, AIMessage, AIGenerationOptions, AIStreamResponse, ProviderConfig } from '../types';
import { requestUrl } from 'obsidian';
import { TimeoutManager } from '../../utils/timeout-manager';
import { Logger } from '../../utils/logger';

export class OllamaProvider implements AIProvider {
	name = 'Ollama (Local)';
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

	async isAvailable(): Promise<boolean> {
		if (!this.config.model) return false; // Require model to be set
		
		try {
			const baseUrl = this.config.baseUrl || 'http://localhost:11434';
			const response = await requestUrl({
				url: `${baseUrl}/api/tags`,
				method: 'GET',
				headers: { 'Content-Type': 'application/json' }
			});
			return response.status === 200;
		} catch {
			return false;
		}
	}

	async generateText(prompt: string, options?: AIGenerationOptions): Promise<string> {
		const baseUrl = this.config.baseUrl || 'http://localhost:11434';
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
		});

		if (response.status !== 200) {
			Logger.error('Ollama API Error Details:', {
				status: response.status,
				headers: response.headers,
				errorText: response.text,
				model: model,
				endpoint: `${baseUrl}/api/generate`
			});
			throw new Error(`Ollama API error: ${response.status} - ${response.text}`);
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
		const baseUrl = this.config.baseUrl || 'http://localhost:11434';
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
		});

		if (response.status !== 200) {
			Logger.error('Ollama API Error Details:', {
				status: response.status,
				headers: response.headers,
				errorText: response.text,
				model: model,
				endpoint: `${baseUrl}/api/chat`
			});
			throw new Error(`Ollama API error: ${response.status} - ${response.text}`);
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