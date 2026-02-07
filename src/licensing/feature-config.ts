/**
 * @file FeatureConfig - Time-gated feature configuration
 */

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
    // Smart Fill - Supernova early access now, GA April 1
    'smartfill': {
        supernovaDate: '2026-02-07',  // Supernova early access
        generalDate: '2026-04-01',   // General availability
        description: 'Smart fill with / triggers and placeholders'
    }
};