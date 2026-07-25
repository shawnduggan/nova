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

export const OLLAMA_DEFAULT_CONTEXT = 32000;
export const OPENAI_COMPATIBLE_DEFAULT_CONTEXT = 32000;

const LEGACY_MODEL_PROVIDER_TYPES: Record<string, string> = {
	'gpt-5.3-chat-latest': 'openai',
	'gpt-5.2-2025-12-11': 'openai',
	'gpt-5.1-chat-latest': 'openai',
	'gpt-5.1': 'openai',
	'gpt-5-pro': 'openai',
	'gpt-5-mini': 'openai',
	'gpt-5-nano': 'openai',
	'gpt-5': 'openai',
	'gemini-3.1-flash-lite-preview': 'google'
};

/**
 * Get the provider type for a given model name by searching all providers
 */
export function getProviderTypeForModel(modelName: string, settings?: NovaSettings): string | null {
	// Search all provider types for this model
	const providerTypes = ['claude', 'openai', 'google', 'ollama', 'openai-compatible'];
	
	for (const providerType of providerTypes) {
		const models = getAvailableModels(providerType, settings);
		const foundModel = models.find(m => m.value === modelName);
		if (foundModel) {
			return providerType;
		}
	}
	
	// Preserve provider routing for saved legacy models that no longer appear in pickers.
	return LEGACY_MODEL_PROVIDER_TYPES[modelName] || null;
}

function addUniqueModel(models: ModelDefinition[], value: string | undefined, label?: string): void {
	const modelValue = value?.trim();
	if (!modelValue || models.some(model => model.value === modelValue)) {
		return;
	}

	models.push({ value: modelValue, label: label || modelValue });
}

function getConfiguredModels(settings: NovaSettings | undefined, providerType: 'ollama' | 'openai-compatible'): ModelDefinition[] {
	const providerSettings = settings?.aiProviders?.[providerType];
	const cachedModels = Array.isArray(providerSettings?.models) ? providerSettings.models : [];
	const savedModel = providerSettings?.model?.trim();
	const models: ModelDefinition[] = [];

	for (const model of cachedModels) {
		addUniqueModel(models, model);
	}

	if (savedModel) {
		addUniqueModel(models, savedModel);
	}

	return models;
}

function getOpenAICompatibleConfiguredModels(settings: NovaSettings | undefined): ModelDefinition[] {
	const providerSettings = settings?.aiProviders?.['openai-compatible'];
	const savedModel = providerSettings?.model?.trim();
	const models: ModelDefinition[] = [];

	if (savedModel) {
		addUniqueModel(models, savedModel);
	}

	return models;
}

/**
 * Get available models for a provider
 */
export function getAvailableModels(providerType: string, settings?: NovaSettings): ModelDefinition[] {
	switch (providerType) {
		case 'claude':
			return [
				{ value: 'claude-opus-5', label: 'Claude Opus 5' },
				{ value: 'claude-opus-4-8', label: 'Claude Opus 4.8' },
				{ value: 'claude-sonnet-5', label: 'Claude Sonnet 5' },
				{ value: 'claude-opus-4-7', label: 'Claude Opus 4.7' },
				{ value: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
				{ value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
				{ value: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' }
			];
		case 'openai':
			return [
				{ value: 'gpt-5.6-sol', label: 'GPT-5.6 Sol' },
				{ value: 'gpt-5.6-terra', label: 'GPT-5.6 Terra' },
				{ value: 'gpt-5.6-luna', label: 'GPT-5.6 Luna' },
				{ value: 'gpt-5.5-pro', label: 'GPT-5.5 Pro' },
				{ value: 'gpt-5.5', label: 'GPT-5.5' },
				{ value: 'gpt-5.4-pro', label: 'GPT-5.4 Pro' },
				{ value: 'gpt-5.4', label: 'GPT-5.4' },
				{ value: 'gpt-5.4-mini', label: 'GPT-5.4 mini' },
				{ value: 'gpt-5.4-nano', label: 'GPT-5.4 nano' }
			];
		case 'google':
			return [
				{ value: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
				{ value: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro (Preview)' },
				{ value: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash-Lite' },
				{ value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash (Preview)' },
				{ value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
				{ value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
				{ value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite' }
			];
		case 'ollama': {
			return getConfiguredModels(settings, 'ollama');
		}
		case 'openai-compatible': {
			return getOpenAICompatibleConfiguredModels(settings);
		}
		default:
			return [];
	}
}

// Context window limits for all supported providers
const CLOUD_PROVIDER_LIMITS: Record<string, ProviderContextLimits> = {
	claude: {
		// Claude models
		'claude-opus-5': { tokens: 1000000, maxOutputTokens: 128000 },
		'claude-opus-4-8': { tokens: 1000000, maxOutputTokens: 128000 },
		'claude-sonnet-5': { tokens: 1000000, maxOutputTokens: 128000 },
		'claude-opus-4-7': { tokens: 200000, maxOutputTokens: 128000 },
		'claude-opus-4-6': { tokens: 200000, maxOutputTokens: 128000 },
		'claude-sonnet-4-6': { tokens: 200000, maxOutputTokens: 64000 },
		'claude-haiku-4-5': { tokens: 200000, maxOutputTokens: 64000 },
		// Fallback for any Claude model
		'default': { tokens: 200000, maxOutputTokens: 64000, fallback: true }
	},

	openai: {
		// OpenAI models
		'gpt-5.6-sol': { tokens: 1050000, maxOutputTokens: 128000 },
		'gpt-5.6-terra': { tokens: 1050000, maxOutputTokens: 128000 },
		'gpt-5.6-luna': { tokens: 1050000, maxOutputTokens: 128000 },
		'gpt-5.5': { tokens: 1050000, maxOutputTokens: 128000 },
		'gpt-5.5-pro': { tokens: 1050000, maxOutputTokens: 128000 },
		'gpt-5.4': { tokens: 1050000, maxOutputTokens: 128000 },
		'gpt-5.4-pro': { tokens: 1050000, maxOutputTokens: 128000 },
		'gpt-5.4-mini': { tokens: 400000, maxOutputTokens: 128000 },
		'gpt-5.4-nano': { tokens: 400000, maxOutputTokens: 128000 },
		'gpt-5.3-chat-latest': { tokens: 128000, maxOutputTokens: 16384 },
		'gpt-5.2-2025-12-11': { tokens: 400000, maxOutputTokens: 128000 },
		'gpt-5.1-chat-latest': { tokens: 400000, maxOutputTokens: 128000 },
		'gpt-5.1': { tokens: 400000, maxOutputTokens: 128000 },
		'gpt-5': { tokens: 400000, maxOutputTokens: 128000 },
		'gpt-5-pro': { tokens: 400000, maxOutputTokens: 272000 },
		'gpt-5-mini': { tokens: 400000, maxOutputTokens: 128000 },
		'gpt-5-nano': { tokens: 400000, maxOutputTokens: 128000 },

		// Fallback for OpenAI models - assume GPT-5 capacity
		'default': { tokens: 400000, maxOutputTokens: 128000, fallback: true }
	},

	google: {
		// Google models
		'gemini-3.5-flash': { tokens: 1048576, maxOutputTokens: 65536 },
		'gemini-3.1-flash-lite': { tokens: 1048576, maxOutputTokens: 65536 },
		'gemini-2.5-pro': { tokens: 1048576, maxOutputTokens: 65536 },
		'gemini-2.5-flash': { tokens: 1048576, maxOutputTokens: 65536 },
		'gemini-2.5-flash-lite': { tokens: 1048576, maxOutputTokens: 65536 },
		'gemini-3.1-pro-preview': { tokens: 1048576, maxOutputTokens: 65536 },
		'gemini-3.1-flash-lite-preview': { tokens: 1048576, maxOutputTokens: 65536 },
		'gemini-3-flash-preview': { tokens: 1048576, maxOutputTokens: 65536 },

		// Fallback for Google models - assume modern Gemini capacity
		'default': { tokens: 1000000, maxOutputTokens: 65536, fallback: true }
	},

	'openai-compatible': {
		'default': {
			tokens: OPENAI_COMPATIBLE_DEFAULT_CONTEXT,
			maxOutputTokens: 4096,
			fallback: true
		}
	}
};

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
