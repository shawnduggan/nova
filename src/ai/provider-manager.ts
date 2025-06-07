import { Platform } from 'obsidian';
import { AIProvider, ProviderType, AIMessage, AIGenerationOptions, AIStreamResponse } from './types';
import { ClaudeProvider } from './providers/claude';
import { OpenAIProvider } from './providers/openai';
import { GoogleProvider } from './providers/google';
import { OllamaProvider } from './providers/ollama';
import { NovaSettings } from '../settings';

export class AIProviderManager {
	private providers: Map<ProviderType, AIProvider> = new Map();
	private settings: NovaSettings;

	constructor(settings: NovaSettings) {
		this.settings = settings;
	}

	async initialize() {
		this.providers.set('claude', new ClaudeProvider(this.settings.aiProviders.claude));
		this.providers.set('openai', new OpenAIProvider(this.settings.aiProviders.openai));
		this.providers.set('google', new GoogleProvider(this.settings.aiProviders.google));
		this.providers.set('ollama', new OllamaProvider(this.settings.aiProviders.ollama));
	}

	updateSettings(settings: NovaSettings) {
		this.settings = settings;
		this.providers.forEach((provider, type) => {
			provider.updateConfig?.(this.settings.aiProviders[type]);
		});
	}

	private getPlatformProviders(): ProviderType[] {
		const platform = Platform.isMobile ? 'mobile' : 'desktop';
		const platformSettings = this.settings.platformSettings[platform];
		return [platformSettings.primaryProvider, ...platformSettings.fallbackProviders];
	}

	private async getAvailableProvider(): Promise<AIProvider | null> {
		const orderedProviders = this.getPlatformProviders();
		
		for (const providerType of orderedProviders) {
			const provider = this.providers.get(providerType);
			if (provider && await provider.isAvailable()) {
				return provider;
			}
		}
		
		return null;
	}

	async generateText(prompt: string, options?: AIGenerationOptions): Promise<string> {
		const provider = await this.getAvailableProvider();
		if (!provider) {
			throw new Error('No AI provider available');
		}
		return provider.generateText(prompt, options);
	}

	async *generateTextStream(prompt: string, options?: AIGenerationOptions): AsyncGenerator<AIStreamResponse> {
		const provider = await this.getAvailableProvider();
		if (!provider) {
			throw new Error('No AI provider available');
		}
		yield* provider.generateTextStream(prompt, options);
	}

	async chatCompletion(messages: AIMessage[], options?: AIGenerationOptions): Promise<string> {
		const provider = await this.getAvailableProvider();
		if (!provider) {
			throw new Error('No AI provider available');
		}
		return provider.chatCompletion(messages, options);
	}

	async *chatCompletionStream(messages: AIMessage[], options?: AIGenerationOptions): AsyncGenerator<AIStreamResponse> {
		const provider = await this.getAvailableProvider();
		if (!provider) {
			throw new Error('No AI provider available');
		}
		yield* provider.chatCompletionStream(messages, options);
	}

	getProviderNames(): string[] {
		return Array.from(this.providers.values()).map(p => p.name);
	}

	cleanup() {
		this.providers.clear();
	}
}