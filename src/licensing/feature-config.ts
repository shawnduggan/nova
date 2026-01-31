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
    // Smart Fill - 3 month early access
    // TODO - update before release
    'smartfill': {
        supernovaDate: '2026-05-01',  // Supernova early access
        generalDate: '2026-08-01',   // General availability
        description: 'Smart Fill with / triggers and placeholders'
    }
};