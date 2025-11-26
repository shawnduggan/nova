import { Platform } from 'obsidian';
import { AIProvider, ProviderType, AIMessage, AIGenerationOptions, AIStreamResponse } from './types';
import { ClaudeProvider } from './providers/claude';
import { OpenAIProvider } from './providers/openai';
import { GoogleProvider } from './providers/google';
import { OllamaProvider } from './providers/ollama';
import { NovaSettings } from '../settings';
import { FeatureManager } from '../licensing/feature-manager';
import { getProviderTypeForModel } from './models';
import { getModelMaxOutputTokens } from './context-limits';
import { TimeoutManager } from '../utils/timeout-manager';

export class AIProviderManager {
	private providers: Map<ProviderType, AIProvider> = new Map();
	private settings: NovaSettings;
	private featureManager?: FeatureManager;
	private availabilityCache: Map<ProviderType, { isAvailable: boolean; timestamp: number }> = new Map();
	private readonly CACHE_TTL = 30000; // 30 seconds
	private timeoutManager: TimeoutManager;

	constructor(settings: NovaSettings, featureManager?: FeatureManager) {
		this.settings = settings;
		this.featureManager = featureManager;
		this.timeoutManager = new TimeoutManager();
	}

	initialize() {
		this.providers.set('claude', new ClaudeProvider(this.settings.aiProviders.claude, this.settings.general, this.timeoutManager));
		this.providers.set('openai', new OpenAIProvider(this.settings.aiProviders.openai, this.settings.general, this.timeoutManager));
		this.providers.set('google', new GoogleProvider(this.settings.aiProviders.google, this.settings.general, this.timeoutManager));
		this.providers.set('ollama', new OllamaProvider(this.settings.aiProviders.ollama, this.settings.general, this.timeoutManager));
	}

	updateSettings(settings: NovaSettings) {
		this.settings = settings;
		// Reinitialize providers with new settings including general settings
		this.initialize();
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
		
		if (provider && isAvailable) {
			return provider;
		}
		
		return null;
	}

	async generateText(prompt: string, _options?: AIGenerationOptions): Promise<string> {
		const provider = await this.getAvailableProvider();
		if (!provider) {
			throw new Error('Nova is disabled or no AI provider is available');
		}
		
		// Always use global settings with model-specific token limits
		const enhancedOptions: AIGenerationOptions = {
			temperature: this.getDefaultTemperature(),
			maxTokens: this.getModelSpecificMaxTokens(),
			model: this.getSelectedModel()
		};
		
		return provider.generateText(prompt, enhancedOptions);
	}

	async *generateTextStream(prompt: string, _options?: AIGenerationOptions): AsyncGenerator<AIStreamResponse> {
		const provider = await this.getAvailableProvider();
		if (!provider) {
			throw new Error('Nova is disabled or no AI provider is available');
		}
		
		// Always use global settings with model-specific token limits
		const enhancedOptions: AIGenerationOptions = {
			temperature: this.getDefaultTemperature(),
			maxTokens: this.getModelSpecificMaxTokens(),
			model: this.getSelectedModel()
		};
		
		yield* provider.generateTextStream(prompt, enhancedOptions);
	}

	async chatCompletion(messages: AIMessage[], _options?: AIGenerationOptions): Promise<string> {
		const provider = await this.getAvailableProvider();
		if (!provider) {
			throw new Error('Nova is disabled or no AI provider is available');
		}
		
		// Always use global settings with model-specific token limits
		const enhancedOptions: AIGenerationOptions = {
			temperature: this.getDefaultTemperature(),
			maxTokens: this.getModelSpecificMaxTokens(),
			model: this.getSelectedModel()
		};
		
		return provider.chatCompletion(messages, enhancedOptions);
	}

	async *chatCompletionStream(messages: AIMessage[], _options?: AIGenerationOptions): AsyncGenerator<AIStreamResponse> {
		const provider = await this.getAvailableProvider();
		if (!provider) {
			throw new Error('Nova is disabled or no AI provider is available');
		}
		
		// Always use global settings with model-specific token limits
		const enhancedOptions: AIGenerationOptions = {
			temperature: this.getDefaultTemperature(),
			maxTokens: this.getModelSpecificMaxTokens(),
			model: this.getSelectedModel()
		};
		
		yield* provider.chatCompletionStream(messages, enhancedOptions);
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

	async complete(systemPrompt: string, userPrompt: string, _options?: AIGenerationOptions): Promise<string> {
		const provider = await this.getAvailableProvider();
		if (!provider) {
			throw new Error('Nova is disabled or no AI provider is available');
		}
		
		// Always use global settings with model-specific token limits
		const enhancedOptions: AIGenerationOptions = {
			temperature: this.getDefaultTemperature(),
			maxTokens: this.getModelSpecificMaxTokens(),
			model: this.getSelectedModel()
		};
		
		return provider.complete(systemPrompt, userPrompt, enhancedOptions);
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

	isProviderAllowed(_providerType: ProviderType): boolean {
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
		if (provider.getAvailableModels) {
			return await provider.getAvailableModels();
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
		if (provider.clearModelCache) {
			provider.clearModelCache();
		}
	}

	cleanup() {
		this.timeoutManager.clearAll();
		this.providers.clear();
	}

	/**
	 * Get the default max tokens from settings
	 */
	getDefaultMaxTokens(): number {
		return this.settings.general.defaultMaxTokens;
	}

	/**
	 * Get model-specific max output tokens, falling back to user setting if no model-specific limit
	 */
	getModelSpecificMaxTokens(): number {
		const selectedModel = this.getSelectedModel();
		const providerType = this.getProviderForModel(selectedModel);
		
		if (providerType && providerType !== 'none') {
			const modelLimit = getModelMaxOutputTokens(providerType, selectedModel);
			// Use the smaller of model limit or user setting
			return Math.min(modelLimit, this.settings.general.defaultMaxTokens);
		}
		
		// Fallback to user setting
		return this.settings.general.defaultMaxTokens;
	}

	getDefaultTemperature(): number {
		return this.settings.general.defaultTemperature;
	}
}