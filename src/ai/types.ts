/**
 * @file AITypes - Type definitions for AI providers, messages, and streaming
 */

export interface AIMessage {
	role: 'user' | 'assistant' | 'system';
	content: string;
}

export interface AIStreamResponse {
	content: string;
	done: boolean;
	error?: string;
}

export interface AIProvider {
	name: string;
	isAvailable(): Promise<boolean> | boolean;
	generateText(prompt: string, options?: AIGenerationOptions): Promise<string>;
	generateTextStream(prompt: string, options?: AIGenerationOptions): AsyncGenerator<AIStreamResponse>;
	chatCompletion(messages: AIMessage[], options?: AIGenerationOptions): Promise<string>;
	chatCompletionStream(messages: AIMessage[], options?: AIGenerationOptions): AsyncGenerator<AIStreamResponse>;
	complete(systemPrompt: string, userPrompt: string, options?: AIGenerationOptions): Promise<string>;
	updateConfig?(config: ProviderConfig): void;
	getAvailableModels?(): Promise<string[]>;
	clearModelCache?(): void;
}

export interface AIGenerationOptions {
	temperature?: number;
	maxTokens?: number;
	model?: string;
	systemPrompt?: string;
	signal?: AbortSignal;
}

export interface ProviderConfig {
	apiKey?: string;
	baseUrl?: string;
	model?: string;
	contextSize?: number;
	status?: {
		state: 'connected' | 'error' | 'not-configured' | 'untested' | 'testing';
		message?: string;
		lastChecked?: Date | string | null;
	};
}

export interface AIProviderSettings {
	claude: ProviderConfig;
	openai: ProviderConfig;
	google: ProviderConfig;
	ollama: ProviderConfig;
}

export type ProviderType = 'claude' | 'openai' | 'google' | 'ollama' | 'none';

export interface PlatformSettings {
	desktop: {
		selectedModel: string;
	};
	mobile: {
		selectedModel: string;
	};
}