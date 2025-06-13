import { Platform } from 'obsidian';
import { AIProvider, ProviderType, AIMessage, AIGenerationOptions, AIStreamResponse, AIProviderSettings } from './types';
import { ClaudeProvider } from './providers/claude';
import { OpenAIProvider } from './providers/openai';
import { GoogleProvider } from './providers/google';
import { OllamaProvider } from './providers/ollama';
import { NovaSettings } from '../settings';
import { FeatureManager } from '../licensing/feature-manager';

export class AIProviderManager {
	private providers: Map<ProviderType, AIProvider> = new Map();
	private settings: NovaSettings;
	private featureManager?: FeatureManager;

	constructor(settings: NovaSettings, featureManager?: FeatureManager) {
		this.settings = settings;
		this.featureManager = featureManager;
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
			if (type !== 'none' && type in this.settings.aiProviders) {
				provider.updateConfig?.(this.settings.aiProviders[type as keyof AIProviderSettings]);
			}
		});
	}

	private getPlatformProviders(): ProviderType[] {
		const platform = Platform.isMobile ? 'mobile' : 'desktop';
		const platformSettings = this.settings.platformSettings[platform];
		const providers = [platformSettings.primaryProvider, ...platformSettings.fallbackProviders];
		
		// No restrictions - all users can use all providers with their own API keys
		return providers;
	}


	private async getAvailableProvider(): Promise<AIProvider | null> {
		const orderedProviders = this.getPlatformProviders();
		
		// If primary provider is 'none', Nova is disabled on this platform
		if (orderedProviders[0] === 'none') {
			return null;
		}
		
		for (const providerType of orderedProviders) {
			if (providerType === 'none') continue;
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
			throw new Error('Nova is disabled or no AI provider is available');
		}
		return provider.generateText(prompt, options);
	}

	async *generateTextStream(prompt: string, options?: AIGenerationOptions): AsyncGenerator<AIStreamResponse> {
		const provider = await this.getAvailableProvider();
		if (!provider) {
			throw new Error('Nova is disabled or no AI provider is available');
		}
		yield* provider.generateTextStream(prompt, options);
	}

	async chatCompletion(messages: AIMessage[], options?: AIGenerationOptions): Promise<string> {
		const provider = await this.getAvailableProvider();
		if (!provider) {
			throw new Error('Nova is disabled or no AI provider is available');
		}
		return provider.chatCompletion(messages, options);
	}

	async *chatCompletionStream(messages: AIMessage[], options?: AIGenerationOptions): AsyncGenerator<AIStreamResponse> {
		const provider = await this.getAvailableProvider();
		if (!provider) {
			throw new Error('Nova is disabled or no AI provider is available');
		}
		yield* provider.chatCompletionStream(messages, options);
	}

	getProviderNames(): string[] {
		return Array.from(this.providers.values()).map(p => p.name);
	}

	async getCurrentProviderName(): Promise<string> {
		const provider = await this.getAvailableProvider();
		return provider ? provider.name : 'None';
	}

	async getCurrentProviderType(): Promise<string | null> {
		const orderedProviders = this.getPlatformProviders();
		if (orderedProviders[0] === 'none') {
			return null;
		}
		
		for (const providerType of orderedProviders) {
			if (providerType === 'none') continue;
			const provider = this.providers.get(providerType);
			if (provider && await provider.isAvailable()) {
				return providerType;
			}
		}
		
		return null;
	}

	async complete(systemPrompt: string, userPrompt: string, options?: AIGenerationOptions): Promise<string> {
		const provider = await this.getAvailableProvider();
		if (!provider) {
			throw new Error('Nova is disabled or no AI provider is available');
		}
		return provider.complete(systemPrompt, userPrompt, options);
	}

	getAllowedProviders(): ProviderType[] {
		// All providers are allowed for all users
		return ['claude', 'openai', 'google', 'ollama'];
	}

	isProviderAllowed(providerType: ProviderType): boolean {
		// All providers are allowed
		return true;
	}

	getProviderLimits(): { local: number; cloud: number } {
		// No limits in the Supernova model
		return { local: Infinity, cloud: Infinity };
	}

	/**
	 * Get available models for a specific provider
	 */
	async getProviderModels(providerType: ProviderType): Promise<string[]> {
		const provider = this.providers.get(providerType);
		if (!provider) {
			throw new Error(`Provider ${providerType} not found`);
		}

		// Check if provider has getAvailableModels method
		if ('getAvailableModels' in provider && typeof provider.getAvailableModels === 'function') {
			return await (provider as any).getAvailableModels();
		}

		// For providers without API model listing (like Ollama), return empty array
		return [];
	}

	/**
	 * Clear model cache for a specific provider
	 */
	clearProviderModelCache(providerType: ProviderType): void {
		const provider = this.providers.get(providerType);
		if (!provider) {
			return;
		}

		// Check if provider has clearModelCache method
		if ('clearModelCache' in provider && typeof provider.clearModelCache === 'function') {
			(provider as any).clearModelCache();
		}
	}

	cleanup() {
		this.providers.clear();
	}
}