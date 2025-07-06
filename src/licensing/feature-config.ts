export interface TimeGatedFeature {
    supernovaDate: string;  // YYYY-MM-DD format
    generalDate: string;   // YYYY-MM-DD format
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
    // Commands - 3 month early access
    'commands': {
        supernovaDate: '2025-09-30',  // Supernova early access
        generalDate: '2026-01-01',   // General availability 
        description: 'Command system with / triggers, command button, and custom commands'
    }
};