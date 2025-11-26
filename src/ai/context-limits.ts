export interface ContextLimit {
    tokens: number;
    maxOutputTokens?: number;
    fallback?: boolean;
}

export interface ProviderContextLimits {
    [modelName: string]: ContextLimit;
}

// Context window limits for all supported providers
const CLOUD_PROVIDER_LIMITS: Record<string, ProviderContextLimits> = {
    claude: {
        // Claude models - matching models.ts exactly
        'claude-opus-4-5': { tokens: 200000, maxOutputTokens: 64000 },
        'claude-sonnet-4-5': { tokens: 200000, maxOutputTokens: 64000 },
        'claude-haiku-4-5': { tokens: 200000, maxOutputTokens: 64000 },
        'claude-opus-4-1': { tokens: 200000, maxOutputTokens: 32000 },
        // Fallback for any Claude model
        'default': { tokens: 200000, maxOutputTokens: 64000, fallback: true }
    },
    
    openai: {
        // OpenAI models - matching models.ts exactly
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
        // Google models - matching models.ts exactly
        'gemini-2.5-pro': { tokens: 1048576, maxOutputTokens: 65536 },
        'gemini-2.5-flash': { tokens: 1048576, maxOutputTokens: 65536 },
        'gemini-2.5-flash-lite': { tokens: 1048576, maxOutputTokens: 65536 },
        'gemini-3-pro-preview': { tokens: 1048576, maxOutputTokens: 65536 },

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