export interface TimeGatedFeature {
    supernovaDate: string;  // YYYY-MM-DD format
    generalDate: string;   // YYYY-MM-DD format
    description: string;
}

export interface CoreFeature {
    description: string;
}

/**
 * Feature release configuration for Supernova early access model
 * Supernova supporters get features on supernovaDate
 * All users get features on generalDate
 * 
 * Dates are in YYYY-MM-DD format and easy to modify post-launch
 */
export const SUPERNOVA_FEATURES: Record<string, TimeGatedFeature> = {
    // Commands (unified) - 2 month early access
    'commands': {
        supernovaDate: '2025-07-31',  // Supernova early access
        generalDate: '2025-09-30',   // General availability 
        description: 'Command system with : triggers, command button, and custom commands'
    },
    
    // Auto-growing input - 1 month early access
    'auto-input': {
        supernovaDate: '2025-06-15',  // Launch day
        generalDate: '2025-07-15',   // 1 month later
        description: 'Auto-growing input area with smooth transitions'
    },
    
    // Enhanced provider management - 2 month early access
    'enhanced-providers': {
        supernovaDate: '2025-06-15',  // Launch day
        generalDate: '2025-08-15',   // 2 months later
        description: 'Advanced provider configuration and switching'
    }
};

/**
 * Core features that are always available to all users
 * These are NOT time-gated
 */
export const CORE_FEATURES: Record<string, CoreFeature> = {
    'basic_editing': {
        description: 'Basic document editing commands (add, edit, delete, grammar, rewrite)'
    },
    'all_ai_providers': {
        description: 'Access to all AI providers (Claude, OpenAI, Google, Ollama)'
    },
    'file_conversations': {
        description: 'File-scoped conversation history'
    },
    'provider_switching': {
        description: 'Switch AI providers directly in chat interface'
    },
    'mobile_access': {
        description: 'Full mobile device support'
    },
    'api_key_config': {
        description: 'Configure your own API keys'
    },
    'sidebar_chat': {
        description: 'Chat interface in sidebar'
    },
    'document_context': {
        description: 'Current document context in conversations'
    },
    'multi-doc-context': {
        description: 'Reference other documents with [[doc]] syntax'
    }
};