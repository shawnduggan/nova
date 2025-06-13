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
				{ value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet (Oct 22)' },
				{ value: 'claude-3-5-haiku-latest', label: 'Claude 3.5 Haiku' }
			];
		case 'openai':
			return [
				{ value: 'gpt-4.1-2025-04-14', label: 'GPT-4.1' },
				{ value: 'gpt-4.1-mini-2025-04-14', label: 'GPT-4.1 Mini' },
				{ value: 'gpt-4.1-nano-2025-04-14', label: 'GPT-4.1 Nano' },
				{ value: 'gpt-4o', label: 'GPT-4o' },
				{ value: 'gpt-4o-mini', label: 'GPT-4o Mini' }
			];
		case 'google':
			return [
				{ value: 'gemini-2.5-flash-preview-04-17', label: 'Gemini 2.5 Flash' },
				{ value: 'gemini-2.5-pro-preview-03-25', label: 'Gemini 2.5 Pro' },
				{ value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
				{ value: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash-Lite' }
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