/**
 * @file Models - Centralized model definitions for all AI providers
 */

import type { NovaSettings } from '../settings';

export interface ModelDefinition {
	value: string;
	label: string;
}

export interface ModelConfig {
	getAvailableModels(providerType: string, settings?: NovaSettings): ModelDefinition[];
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