import { Platform } from 'obsidian';
import { AIProvider, ProviderType, AIMessage, AIGenerationOptions, AIStreamResponse, AIProviderSettings } from './types';
import { ClaudeProvider } from './providers/claude';
import { OpenAIProvider } from './providers/openai';
import { GoogleProvider } from './providers/google';
import { OllamaProvider } from './providers/ollama';
import { NovaSettings } from '../settings';
import { FeatureManager } from '../licensing/feature-manager';
import { getProviderTypeForModel } from './models';

export class AIProviderManager {
	private providers: Map<ProviderType, AIProvider> = new Map();
	private settings: NovaSettings;
	private featureManager?: FeatureManager;
	private availabilityCache: Map<ProviderType, { isAvailable: boolean; timestamp: number }> = new Map();
	private readonly CACHE_TTL = 30000; // 30 seconds

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
		// Clear cache when settings change to force re-check
		this.availabilityCache.clear();
	}

	/**
	 * Check provider availability with caching to avoid repeated network calls
	 */
	private async checkProviderAvailability(providerType: ProviderType): Promise<boolean> {
		const now = Date.now();
		const cached = this.availabilityCache.get(providerType);
		
		// Return cached result if still valid
		if (cached && (now - cached.timestamp) < this.CACHE_TTL) {
			return cached.isAvailable;
		}
		
		// Get fresh availability status
		const provider = this.providers.get(providerType);
		const isAvailable = provider ? await provider.isAvailable() : false;
		
		// Cache the result
		this.availabilityCache.set(providerType, {
			isAvailable,
			timestamp: now
		});
		
		return isAvailable;
	}

	/**
	 * Get the provider type that handles a specific model
	 */
	private getProviderForModel(modelName: string): ProviderType | null {
		return getProviderTypeForModel(modelName, this.settings) as ProviderType | null;
	}

	/**
	 * Get the selected model for the current platform
	 */
	private getSelectedModel(): string {
		const platform = Platform.isMobile ? 'mobile' : 'desktop';
		const selectedModel = this.settings.platformSettings[platform].selectedModel;
		
		console.log('🔍 AIProviderManager.getSelectedModel():');
		console.log('🔍 Platform:', platform);
		console.log('🔍 Selected model:', selectedModel);
		
		return selectedModel;
	}


	private async getAvailableProvider(): Promise<AIProvider | null> {
		const selectedModel = this.getSelectedModel();
		const providerType = this.getProviderForModel(selectedModel);
		
		if (!providerType || providerType === 'none') {
			return null;
		}
		
		const provider = this.providers.get(providerType);
		const isAvailable = provider ? await this.checkProviderAvailability(providerType) : false;
		
		console.log('🔍 Provider for model:', { selectedModel, providerType, isAvailable });
		
		if (provider && isAvailable) {
			return provider;
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
		const selectedModel = this.getSelectedModel();
		const providerType = this.getProviderForModel(selectedModel);
		
		if (!providerType || providerType === 'none') {
			return null;
		}
		
		const provider = this.providers.get(providerType);
		if (provider && await this.checkProviderAvailability(providerType)) {
			return providerType;
		}
		
		return null;
	}

	/**
	 * Get the currently selected model name
	 */
	getCurrentModel(): string {
		return this.getSelectedModel();
	}

	async complete(systemPrompt: string, userPrompt: string, options?: AIGenerationOptions): Promise<string> {
		const provider = await this.getAvailableProvider();
		if (!provider) {
			throw new Error('Nova is disabled or no AI provider is available');
		}
		return provider.complete(systemPrompt, userPrompt, options);
	}

	getAllowedProviders(): ProviderType[] {
		// Ollama requires local server - not available on mobile
		if (Platform.isMobile) {
			return ['claude', 'openai', 'google'];
		}
		return ['claude', 'openai', 'google', 'ollama'];
	}

	/**
	 * Get all available providers with their availability status in parallel
	 */
	async getAvailableProvidersWithStatus(): Promise<Map<ProviderType, boolean>> {
		const allowedProviders = this.getAllowedProviders();
		const availabilityChecks = allowedProviders.map(async (providerType) => {
			const isAvailable = await this.checkProviderAvailability(providerType);
			return { providerType, isAvailable };
		});

		const results = await Promise.all(availabilityChecks);
		const availabilityMap = new Map<ProviderType, boolean>();
		
		results.forEach(({ providerType, isAvailable }) => {
			availabilityMap.set(providerType, isAvailable);
		});

		return availabilityMap;
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

	/**
	 * Get the default max tokens from settings
	 */
	getDefaultMaxTokens(): number {
		return this.settings.general.defaultMaxTokens;
	}
}