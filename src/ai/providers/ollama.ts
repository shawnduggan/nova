import { AIProvider, AIMessage, AIGenerationOptions, AIStreamResponse, ProviderConfig } from '../types';

export class OllamaProvider implements AIProvider {
	name = 'Ollama (Local)';
	private config: ProviderConfig;
	private generalSettings: { defaultTemperature: number; defaultMaxTokens: number };

	constructor(config: ProviderConfig, generalSettings: { defaultTemperature: number; defaultMaxTokens: number }) {
		this.config = config;
		this.generalSettings = generalSettings;
	}

	updateConfig(config: ProviderConfig) {
		this.config = config;
	}

	async isAvailable(): Promise<boolean> {
		if (!this.config.model) return false; // Require model to be set
		
		try {
			const baseUrl = this.config.baseUrl || 'http://localhost:11434';
			const response = await fetch(`${baseUrl}/api/tags`, {
				method: 'GET',
				headers: { 'Content-Type': 'application/json' }
			});
			return response.ok;
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

		const response = await fetch(`${baseUrl}/api/generate`, {
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
			})
		});

		if (!response.ok) {
			throw new Error(`Ollama API error: ${response.statusText}`);
		}

		const data = await response.json();
		return data.response;
	}

	async *generateTextStream(prompt: string, options?: AIGenerationOptions): AsyncGenerator<AIStreamResponse> {
		const baseUrl = this.config.baseUrl || 'http://localhost:11434';
		const model = options?.model || this.config.model;
		if (!model) {
			throw new Error('Ollama model must be specified');
		}

		const response = await fetch(`${baseUrl}/api/generate`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				model,
				prompt,
				stream: true,
				options: {
					temperature: options?.temperature || this.generalSettings.defaultTemperature,
					num_predict: options?.maxTokens || this.generalSettings.defaultMaxTokens
				}
			})
		});

		if (!response.ok) {
			throw new Error(`Ollama API error: ${response.statusText}`);
		}

		const reader = response.body?.getReader();
		if (!reader) {
			throw new Error('Failed to get response reader');
		}

		const decoder = new TextDecoder();

		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				const lines = decoder.decode(value).split('\n');
				for (const line of lines) {
					if (line.trim()) {
						try {
							const parsed = JSON.parse(line);
							if (parsed.response) {
								// Split text into smaller chunks for consistent typewriter effect
								const chunkSize = 3; // Characters per chunk
								for (let i = 0; i < parsed.response.length; i += chunkSize) {
									const chunk = parsed.response.slice(i, i + chunkSize);
									yield { content: chunk, done: false };
									// Small delay between chunks to create smooth typewriter effect
									await new Promise(resolve => setTimeout(resolve, 20));
								}
							}
							if (parsed.done) {
								yield { content: '', done: true };
								return;
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

	async chatCompletion(messages: AIMessage[], options?: AIGenerationOptions): Promise<string> {
		const baseUrl = this.config.baseUrl || 'http://localhost:11434';
		const model = options?.model || this.config.model;
		if (!model) {
			throw new Error('Ollama model must be specified');
		}

		const response = await fetch(`${baseUrl}/api/chat`, {
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
			})
		});

		if (!response.ok) {
			throw new Error(`Ollama API error: ${response.statusText}`);
		}

		const data = await response.json();
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
		const baseUrl = this.config.baseUrl || 'http://localhost:11434';
		const model = options?.model || this.config.model;
		if (!model) {
			throw new Error('Ollama model must be specified');
		}

		const response = await fetch(`${baseUrl}/api/chat`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				model,
				messages: messages.map(msg => ({
					role: msg.role,
					content: msg.content
				})),
				stream: true,
				options: {
					temperature: options?.temperature || this.generalSettings.defaultTemperature,
					num_predict: options?.maxTokens || this.generalSettings.defaultMaxTokens
				}
			})
		});

		if (!response.ok) {
			throw new Error(`Ollama API error: ${response.statusText}`);
		}

		const reader = response.body?.getReader();
		if (!reader) {
			throw new Error('Failed to get response reader');
		}

		const decoder = new TextDecoder();

		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				const lines = decoder.decode(value).split('\n');
				for (const line of lines) {
					if (line.trim()) {
						try {
							const parsed = JSON.parse(line);
							if (parsed.message?.content) {
								// Split text into smaller chunks for consistent typewriter effect
								const chunkSize = 3; // Characters per chunk
								for (let i = 0; i < parsed.message.content.length; i += chunkSize) {
									const chunk = parsed.message.content.slice(i, i + chunkSize);
									yield { content: chunk, done: false };
									// Small delay between chunks to create smooth typewriter effect
									await new Promise(resolve => setTimeout(resolve, 20));
								}
							}
							if (parsed.done) {
								yield { content: '', done: true };
								return;
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
}