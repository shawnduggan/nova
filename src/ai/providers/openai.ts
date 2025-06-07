import { AIProvider, AIMessage, AIGenerationOptions, AIStreamResponse, ProviderConfig } from '../types';

export class OpenAIProvider implements AIProvider {
	name = 'OpenAI';
	private config: ProviderConfig;

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

		const response = await fetch(this.config.baseUrl || 'https://api.openai.com/v1/chat/completions', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${this.config.apiKey}`
			},
			body: JSON.stringify({
				model: options?.model || this.config.model || 'gpt-3.5-turbo',
				messages: requestMessages,
				max_tokens: options?.maxTokens || this.config.maxTokens || 1000,
				temperature: options?.temperature || this.config.temperature || 0.7
			})
		});

		if (!response.ok) {
			throw new Error(`OpenAI API error: ${response.statusText}`);
		}

		const data = await response.json();
		return data.choices[0].message.content;
	}

	async *chatCompletionStream(messages: AIMessage[], options?: AIGenerationOptions): AsyncGenerator<AIStreamResponse> {
		if (!this.config.apiKey) {
			throw new Error('OpenAI API key not configured');
		}

		const requestMessages = [...messages];
		if (options?.systemPrompt) {
			requestMessages.unshift({ role: 'system', content: options.systemPrompt });
		}

		const response = await fetch(this.config.baseUrl || 'https://api.openai.com/v1/chat/completions', {
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
								yield { content, done: false };
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