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
	isAvailable(): Promise<boolean>;
	generateText(prompt: string, options?: AIGenerationOptions): Promise<string>;
	generateTextStream(prompt: string, options?: AIGenerationOptions): AsyncGenerator<AIStreamResponse>;
	chatCompletion(messages: AIMessage[], options?: AIGenerationOptions): Promise<string>;
	chatCompletionStream(messages: AIMessage[], options?: AIGenerationOptions): AsyncGenerator<AIStreamResponse>;
	updateConfig?(config: ProviderConfig): void;
}

export interface AIGenerationOptions {
	temperature?: number;
	maxTokens?: number;
	model?: string;
	systemPrompt?: string;
}

export interface ProviderConfig {
	apiKey?: string;
	baseUrl?: string;
	model?: string;
	temperature?: number;
	maxTokens?: number;
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
		primaryProvider: ProviderType;
		fallbackProviders: ProviderType[];
	};
	mobile: {
		primaryProvider: ProviderType;
		fallbackProviders: ProviderType[];
	};
}