/**
 * @file FeatureConfig - Feature access configuration
 */

import { FEATURE_SMART_REVISION, FEATURE_SMARTFILL } from '../constants';
import type { FeatureAccessPolicy, FeatureCategory } from './types';

export interface FeatureConfig {
	access: FeatureAccessPolicy;
	category: FeatureCategory;
	description: string;
}

/**
 * Feature access configuration.
 * Core features are available to everyone.
 * Permanent features require Supernova access.
 */
export const FEATURE_CONFIGS: Record<string, FeatureConfig> = {
	[FEATURE_SMARTFILL]: {
		access: 'core',
		category: 'core',
		description: 'Smart fill with / triggers and placeholders'
	},
	[FEATURE_SMART_REVISION]: {
		access: 'permanent',
		category: 'advanced-revision',
		description: 'Smart Revision with snapshots, revision cards, meaning risk, and safe review'
	}
};
