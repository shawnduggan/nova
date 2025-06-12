export interface TimeGatedFeature {
    catalystDate: string;  // YYYY-MM-DD format
    generalDate: string;   // YYYY-MM-DD format
    description: string;
}

/**
 * Feature release configuration for Catalyst early access model
 * Catalyst supporters get features on catalystDate
 * All users get features on generalDate
 * 
 * Dates are in YYYY-MM-DD format and easy to modify post-launch
 */
export const CATALYST_FEATURES: Record<string, TimeGatedFeature> = {
    // Command system - 3 month early access
    'command-system': {
        catalystDate: '2025-06-15',  // Launch day
        generalDate: '2025-09-15',   // 3 months later
        description: 'Command system with : triggers and provider switching'
    },
    
    // Multi-document context - 2 month early access  
    'multi-doc-context': {
        catalystDate: '2025-06-15',  // Launch day
        generalDate: '2025-08-15',   // 2 months later
        description: 'Reference other documents with [[doc]] syntax'
    },
    
    // Auto-growing input - 1 month early access
    'auto-input': {
        catalystDate: '2025-06-15',  // Launch day
        generalDate: '2025-07-15',   // 1 month later
        description: 'Auto-growing input area with smooth transitions'
    },
    
    // Command button - 2 month early access
    'command-button': {
        catalystDate: '2025-06-15',  // Launch day
        generalDate: '2025-08-15',   // 2 months later
        description: 'Command button for mobile and discovery'
    },
    
    // Custom commands - 3.5 month early access
    'custom-commands': {
        catalystDate: '2025-06-15',  // Launch day
        generalDate: '2025-10-01',   // Available to all Oct 1, 2025
        description: 'User-defined custom command shortcuts'
    },
    
    // Enhanced provider management - 2 month early access
    'enhanced-providers': {
        catalystDate: '2025-06-15',  // Launch day
        generalDate: '2025-08-15',   // 2 months later
        description: 'Advanced provider configuration and switching'
    }
};

/**
 * Core features that are always available to all users
 * These are NOT time-gated
 */
export const CORE_FEATURES = [
    'basic_editing',          // Add, edit, delete, grammar, rewrite commands
    'all_ai_providers',       // Claude, OpenAI, Google, Ollama
    'file_conversations',     // File-scoped conversation history
    'provider_switching',     // Switch providers in chat
    'mobile_access',          // Full mobile support
    'api_key_config',         // Configure own API keys
    'sidebar_chat',           // Chat interface in sidebar
    'document_context'        // Current document context
];