/**
 * @file Models - Centralized model definitions and context limits for all AI providers
 */

import type { NovaSettings } from '../settings';

export interface ModelDefinition {
	value: string;
	label: string;
}

export interface ModelConfig {
	getAvailableModels(providerType: string, settings?: NovaSettings): ModelDefinition[];
}

export interface ContextLimit {
    tokens: number;
    maxOutputTokens?: number;
    fallback?: boolean;
}

export interface ProviderContextLimits {
    [modelName: string]: ContextLimit;
}

/**
 * Get the provider type for a given model name by searching all providers
 */
export function getProviderTypeForModel(modelName: string, settings?: NovaSettings): string | null {
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
export function getAvailableModels(providerType: string, settings?: NovaSettings): ModelDefinition[] {
	switch (providerType) {
		case 'claude':
			return [
				{ value: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
				{ value: 'claude-opus-4-5', label: 'Claude Opus 4.5' },
				{ value: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
				{ value: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' }
			];
		case 'openai':
			return [
				{ value: 'gpt-5.2-2025-12-11', label: 'GPT-5.2' },
				{ value: 'gpt-5.1-chat-latest', label: 'GPT-5.1 Chat' },
				{ value: 'gpt-5.1', label: 'GPT-5.1' },
				{ value: 'gpt-5-pro', label: 'GPT-5 Pro' },
				{ value: 'gpt-5-mini', label: 'GPT-5 Mini' },
				{ value: 'gpt-5-nano', label: 'GPT-5 Nano' },
				{ value: 'gpt-5', label: 'GPT-5' }
			];
		case 'google':
			return [
				{ value: 'gemini-3-pro-preview', label: 'Gemini 3 Pro (Preview)' },
				{ value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash (Preview)' },
				{ value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
				{ value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
				{ value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite' }
			];
		case 'ollama': {
			// Return the configured model from settings
			const ollamaModel = settings?.aiProviders?.ollama?.model;
			if (ollamaModel && ollamaModel.trim()) {
				return [{ value: ollamaModel, label: ollamaModel }];
			}
			return [];
		}
		default:
			return [];
	}
}

// Context window limits for all supported providers
const CLOUD_PROVIDER_LIMITS: Record<string, ProviderContextLimits> = {
    claude: {
        // Claude models
        'claude-opus-4-5': { tokens: 200000, maxOutputTokens: 64000 },
        'claude-sonnet-4-5': { tokens: 200000, maxOutputTokens: 64000 },
        'claude-haiku-4-5': { tokens: 200000, maxOutputTokens: 64000 },
        'claude-opus-4-6': { tokens: 200000, maxOutputTokens: 128000 },
        // Fallback for any Claude model
        'default': { tokens: 200000, maxOutputTokens: 64000, fallback: true }
    },
    
    openai: {
        // OpenAI models
        'gpt-5.2-2025-12-11': { tokens: 400000, maxOutputTokens: 128000 },
        'gpt-5.1-chat-latest': { tokens: 400000, maxOutputTokens: 128000 },
        'gpt-5.1': { tokens: 400000, maxOutputTokens: 128000 },
        'gpt-5': { tokens: 400000, maxOutputTokens: 128000 },
        'gpt-5-pro': { tokens: 400000, maxOutputTokens: 272000 },
        'gpt-5-mini': { tokens: 400000, maxOutputTokens: 128000 },
        'gpt-5-nano': { tokens: 400000, maxOutputTokens: 128000 },

        // Fallback for OpenAI models - assume GPT-4o capacity
        'default': { tokens: 400000, maxOutputTokens: 128000, fallback: true }
    },
    
    google: {
        // Google models
        'gemini-2.5-pro': { tokens: 1048576, maxOutputTokens: 65536 },
        'gemini-2.5-flash': { tokens: 1048576, maxOutputTokens: 65536 },
        'gemini-2.5-flash-lite': { tokens: 1048576, maxOutputTokens: 65536 },
        'gemini-3-pro-preview': { tokens: 1048576, maxOutputTokens: 65536 },
        'gemini-3-flash-preview': { tokens: 1048576, maxOutputTokens: 65536 },

        // Fallback for Google models - assume modern Gemini capacity
        'default': { tokens: 1000000, maxOutputTokens: 65536, fallback: true }
    }
};

// Default context window for Ollama when not configured by user
export const OLLAMA_DEFAULT_CONTEXT = 32000;

/**
 * Get context window limit for a specific provider and model
 */
export function getContextLimit(provider: string, model: string): number {
    const providerLimits = CLOUD_PROVIDER_LIMITS[provider.toLowerCase()];
    if (!providerLimits) {
        // Unknown provider fallback
        return 32000;
    }
    
    // Try exact model match first
    const modelLimit = providerLimits[model];
    if (modelLimit) {
        return modelLimit.tokens;
    }
    
    // Fall back to provider default
    const defaultLimit = providerLimits['default'];
    if (defaultLimit) {
        return defaultLimit.tokens;
    }
    
    // Final fallback
    return 32000;
}


/**
 * Get all context limits for a provider (for UI display)
 */
export function getProviderContextLimits(provider: string): ProviderContextLimits {
    return CLOUD_PROVIDER_LIMITS[provider.toLowerCase()] || {};
}

/**
 * Get max output tokens for a specific provider and model
 */
export function getModelMaxOutputTokens(provider: string, model: string): number {
    const providerLimits = CLOUD_PROVIDER_LIMITS[provider.toLowerCase()];
    if (!providerLimits) {
        // Unknown provider fallback
        return 4096;
    }
    
    // Try exact model match first
    const modelLimit = providerLimits[model];
    if (modelLimit && modelLimit.maxOutputTokens) {
        return modelLimit.maxOutputTokens;
    }
    
    // Fall back to provider default
    const defaultLimit = providerLimits['default'];
    if (defaultLimit && defaultLimit.maxOutputTokens) {
        return defaultLimit.maxOutputTokens;
    }
    
    // Final fallback
    return 4096;
}

/**
 * Check if a model has a known context limit
 */
export function hasKnownContextLimit(provider: string, model: string): boolean {
    const providerLimits = CLOUD_PROVIDER_LIMITS[provider.toLowerCase()];
    if (!providerLimits) {
        return false;
    }
    
    return !!providerLimits[model] && !providerLimits[model].fallback;
}
