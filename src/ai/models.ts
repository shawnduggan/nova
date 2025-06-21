/**
 * Centralized model definitions for all AI providers
 */

export interface ModelDefinition {
	value: string;
	label: string;
}

export interface ModelConfig {
	getAvailableModels(providerType: string, settings?: any): ModelDefinition[];
}

/**
 * Get the provider type for a given model name by searching all providers
 */
export function getProviderTypeForModel(modelName: string, settings?: any): string | null {
	// Search all provider types for this model
	const providerTypes = ['claude', 'openai', 'google', 'ollama'];
	
	for (const providerType of providerTypes) {
		const models = getAvailableModels(providerType, settings);
		const foundModel = models.find(m => m.value === modelName);
		if (foundModel) {
			return providerType;
		}
	}
	
	// If not found in any provider, return null
	return null;
}

/**
 * Get available models for a provider
 */
export function getAvailableModels(providerType: string, settings?: any): ModelDefinition[] {
	switch (providerType) {
		case 'claude':
			return [
				{ value: 'claude-opus-4-20250514', label: 'Claude Opus 4' },
				{ value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
				{ value: 'claude-3-7-sonnet-latest', label: 'Claude 3.7 Sonnet' },
				{ value: 'claude-3-5-sonnet-latest', label: 'Claude 3.5 Sonnet' },
				{ value: 'claude-3-5-haiku-latest', label: 'Claude 3.5 Haiku' }
			];
		case 'openai':
			return [
				{ value: 'gpt-4.1-2025-04-14', label: 'GPT-4.1' },
				{ value: 'gpt-4.1-mini-2025-04-14', label: 'GPT-4.1 Mini' },
				{ value: 'gpt-4.1-nano-2025-04-14', label: 'GPT-4.1 Nano' },
				{ value: 'o4-mini-2025-04-16', label: 'o4 Mini' },
				{ value: 'o3-mini-2025-01-31', label: 'o3 Mini' },
				{ value: 'o3-2025-04-16', label: 'o3' },
				{ value: 'o1-2024-12-17', label: 'o1' },
				{ value: 'gpt-4o', label: 'GPT-4o' },
				{ value: 'gpt-4o-mini', label: 'GPT-4o Mini' }
			];
		case 'google':
			return [
				{ value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
				{ value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
				{ value: 'gemini-2.5-flash-lite-preview-06-17', label: 'Gemini 2.5 Flash-Lite' }
			];
		case 'ollama':
			// Return the configured model from settings
			const ollamaModel = settings?.aiProviders?.ollama?.model;
			if (ollamaModel && ollamaModel.trim()) {
				return [{ value: ollamaModel, label: ollamaModel }];
			}
			return [];
		default:
			return [];
	}
}