export interface ContextLimit {
    tokens: number;
    fallback?: boolean;
}

export interface ProviderContextLimits {
    [modelName: string]: ContextLimit;
}

// Context window limits for all supported providers
const CLOUD_PROVIDER_LIMITS: Record<string, ProviderContextLimits> = {
    claude: {
        // Claude models - all current versions have 200k tokens
        'claude-sonnet-4-20250514': { tokens: 200000 },
        'claude-3-5-sonnet-20241022': { tokens: 200000 },
        'claude-3-5-sonnet-20240620': { tokens: 200000 },
        'claude-3-5-haiku-20241022': { tokens: 200000 },
        'claude-3-opus-20240229': { tokens: 200000 },
        'claude-3-sonnet-20240229': { tokens: 200000 },
        'claude-3-haiku-20240307': { tokens: 200000 },
        // Fallback for any Claude model
        'default': { tokens: 200000, fallback: true }
    },
    
    openai: {
        // GPT-4.1 models - 1M tokens
        'gpt-4.1-mini-2025-04-14': { tokens: 1000000 },
        'gpt-4.1-turbo-2025-04-14': { tokens: 1000000 },
        
        // GPT-4o models - 128k tokens
        'gpt-4o': { tokens: 128000 },
        'gpt-4o-2024-08-06': { tokens: 128000 },
        'gpt-4o-2024-05-13': { tokens: 128000 },
        'gpt-4o-mini': { tokens: 128000 },
        'gpt-4o-mini-2024-07-18': { tokens: 128000 },
        
        // GPT-4 Turbo models - 128k tokens
        'gpt-4-turbo': { tokens: 128000 },
        'gpt-4-turbo-2024-04-09': { tokens: 128000 },
        'gpt-4-turbo-preview': { tokens: 128000 },
        'gpt-4-0125-preview': { tokens: 128000 },
        'gpt-4-1106-preview': { tokens: 128000 },
        
        // Legacy GPT-4 models - 8k tokens
        'gpt-4': { tokens: 8000 },
        'gpt-4-0613': { tokens: 8000 },
        'gpt-4-0314': { tokens: 8000 },
        
        // GPT-3.5 models - 16k tokens
        'gpt-3.5-turbo': { tokens: 16000 },
        'gpt-3.5-turbo-0125': { tokens: 16000 },
        'gpt-3.5-turbo-1106': { tokens: 16000 },
        'gpt-3.5-turbo-16k': { tokens: 16000 },
        
        // Fallback for OpenAI models - assume GPT-4o capacity
        'default': { tokens: 128000, fallback: true }
    },
    
    google: {
        // Gemini 2.5 models - 1M tokens
        'gemini-2.5-flash-preview-04-17': { tokens: 1000000 },
        'gemini-2.5-flash-exp': { tokens: 1000000 },
        
        // Gemini 2.0 models - 1M tokens
        'gemini-2.0-flash-exp': { tokens: 1000000 },
        'gemini-2.0-flash-thinking-exp-01-21': { tokens: 1000000 },
        
        // Gemini 1.5 models - 1M tokens
        'gemini-1.5-pro': { tokens: 1000000 },
        'gemini-1.5-pro-latest': { tokens: 1000000 },
        'gemini-1.5-pro-002': { tokens: 1000000 },
        'gemini-1.5-pro-001': { tokens: 1000000 },
        'gemini-1.5-flash': { tokens: 1000000 },
        'gemini-1.5-flash-latest': { tokens: 1000000 },
        'gemini-1.5-flash-002': { tokens: 1000000 },
        'gemini-1.5-flash-001': { tokens: 1000000 },
        'gemini-1.5-flash-8b': { tokens: 1000000 },
        'gemini-1.5-flash-8b-latest': { tokens: 1000000 },
        'gemini-1.5-flash-8b-001': { tokens: 1000000 },
        
        // Legacy Gemini models - 30k tokens
        'gemini-pro': { tokens: 30000 },
        'gemini-pro-vision': { tokens: 30000 },
        'gemini-1.0-pro': { tokens: 30000 },
        'gemini-1.0-pro-latest': { tokens: 30000 },
        'gemini-1.0-pro-001': { tokens: 30000 },
        
        // Fallback for Google models - assume modern Gemini capacity
        'default': { tokens: 1000000, fallback: true }
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
 * Check if a model has a known context limit
 */
export function hasKnownContextLimit(provider: string, model: string): boolean {
    const providerLimits = CLOUD_PROVIDER_LIMITS[provider.toLowerCase()];
    if (!providerLimits) {
        return false;
    }
    
    return !!providerLimits[model] && !providerLimits[model].fallback;
}