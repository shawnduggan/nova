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
        'claude-opus-4-20250514': { tokens: 200000 },
        'claude-sonnet-4-20250514': { tokens: 200000 },
        'claude-3-7-sonnet-latest': { tokens: 200000 },
        'claude-3-5-sonnet-latest': { tokens: 200000 },
        'claude-3-5-haiku-latest': { tokens: 200000 },
        // Fallback for any Claude model
        'default': { tokens: 200000, fallback: true }
    },
    
    openai: {
        // GPT-4.1 models 
        'gpt-4.1-2025-04-14': { tokens: 1047576 },
        'gpt-4.1-mini-2025-04-14': { tokens: 1047576 },
        'gpt-4.1-nano-2025-04-14': { tokens: 1047576 },

        // o4 models 
        'o4-mini-2025-04-16': { tokens: 200000 },
        
        // o3 models 
        'o3-2025-04-16': { tokens: 200000 },
        'o3-mini-2025-01-31': { tokens: 200000 },
        
        // o1 models 
        'o1-2024-12-17': { tokens: 128000 },
      
        // GPT-4o models 
        'gpt-4o': { tokens: 128000 },
        'gpt-4o-mini': { tokens: 128000 },
    
        // Fallback for OpenAI models - assume GPT-4o capacity
        'default': { tokens: 128000, fallback: true }
    },
    
    google: {
        // Gemini 2.5 models - 1M tokens
        'gemini-2.5-pro': { tokens: 1048576 },
        'gemini-2.5-flash': { tokens: 1048576 },
        'gemini-2.5-flash-lite-preview-06-17': { tokens: 1000000 },
           
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