/**
 * @file FeatureManager - Manages feature flags and Supernova access
 */

import { LicenseValidator } from './license-validator';
import { SupernovaLicense, FeatureFlag, FeatureAccessResult, DebugSettings } from './types';
import { FEATURE_CONFIGS, FeatureConfig } from './feature-config';

export class FeatureManager {
	private features: Map<string, FeatureFlag> = new Map();
	private supernovaLicense: SupernovaLicense | null = null;
	private isSupernova: boolean = false;
	private debugSettings: DebugSettings = { enabled: false };

	constructor(
		private licenseValidator: LicenseValidator,
		debugSettings?: DebugSettings
	) {
		if (debugSettings) {
			// In production builds, always disable debug features for security
			if (process.env.NODE_ENV === 'production') {
				this.debugSettings = { enabled: false };
			} else {
				this.debugSettings = debugSettings;
			}
		}
		this.initializeFeatureFlags();
	}

	/**
	 * Initialize feature flags from the access policy registry.
	 */
	private initializeFeatureFlags(): void {
		this.features.clear();

		Object.entries(FEATURE_CONFIGS).forEach(([key, config]) => {
			this.registerFeature({
				key,
				enabled: this.isConfiguredFeatureEnabled(config),
				description: config.description,
				access: config.access,
				supernovaOnly: config.access === 'permanent'
			});
		});
	}

	/**
	 * Check if a configured feature should be enabled.
	 */
	private isConfiguredFeatureEnabled(config: FeatureConfig): boolean {
		if (config.access === 'core') {
			return true;
		}

		return this.getIsSupernova();
	}

	/**
	 * Get Supernova status (can be overridden in debug mode)
	 */
	private getIsSupernova(): boolean {
		// Only allow debug overrides to force Supernova=true in development and test builds
		// Never override a real license to false - always fall back to real license status
		if (this.debugSettings.enabled && this.debugSettings.forceSupernova === true && (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test')) {
			return true;
		}
		return this.isSupernova;
	}

	/**
	 * Register a new feature flag
	 */
	registerFeature(flag: FeatureFlag): void {
		this.features.set(flag.key, flag);
	}

	/**
	 * Update Supernova license and recalculate feature availability
	 */
	async updateSupernovaLicense(licenseKey: string | null): Promise<void> {
		if (!licenseKey) {
			this.supernovaLicense = null;
			this.isSupernova = false;
		} else {
			const validation = await this.licenseValidator.validateSupernovaLicense(licenseKey);
			if (validation.valid && validation.license) {
				this.supernovaLicense = validation.license;
				this.isSupernova = true;
			} else {
				this.supernovaLicense = null;
				this.isSupernova = false;
			}
		}

		// Reinitialize features with updated Supernova status
		this.initializeFeatureFlags();
	}

	/**
	 * Get current Supernova status
	 */
	isSupernovaSupporter(): boolean {
		return this.getIsSupernova();
	}

	/**
	 * Get current Supernova license
	 */
	getSupernovaLicense(): SupernovaLicense | null {
		return this.supernovaLicense;
	}

	/**
	 * Check if user has lifetime access (lifetime or founding license)
	 */
	hasLifetimeAccess(): boolean {
		const license = this.getSupernovaLicense();
		return license !== null && (license.type === 'lifetime' || license.type === 'founding');
	}

	/**
	 * Check if a feature is enabled
	 */
	isFeatureEnabled(featureKey: string): boolean {
		const feature = this.features.get(featureKey);
		return feature?.enabled ?? false;
	}

	/**
	 * Check feature access with detailed result
	 */
	checkFeatureAccess(featureKey: string): FeatureAccessResult {
		const feature = this.features.get(featureKey);
		
		if (!feature) {
			return { 
				allowed: false, 
				reason: `Feature '${featureKey}' not found` 
			};
		}

		if (feature.enabled) {
			return { allowed: true };
		}

		if (feature.supernovaOnly) {
			return {
				allowed: false,
				reason: 'This is a Supernova advanced revision feature. Free Nova keeps instant editing, Prose Linter, Smart Fill, and all providers.',
				isSupernovaFeature: true,
				access: feature.access,
				upgradeRequired: true
			};
		}

		return {
			allowed: false,
			reason: 'Feature is not available'
		};
	}

	/**
	 * Get all enabled configured features.
	 */
	getEnabledFeatures(): FeatureFlag[] {
		return Array.from(this.features.values()).filter(feature => feature.enabled);
	}

	/**
	 * Get active Supernova-gated features
	 */
	getSupernovaFeatures(): FeatureFlag[] {
		return Array.from(this.features.values()).filter(feature => 
			feature.supernovaOnly
		);
	}

	/**
	 * Update debug settings for development testing
	 */
	updateDebugSettings(settings: DebugSettings): void {
		// In production builds, never allow debug settings to be enabled
		if (process.env.NODE_ENV === 'production') {
			this.debugSettings = { enabled: false };
		} else {
			this.debugSettings = settings;
		}
		// Reinitialize features with new debug settings
		this.initializeFeatureFlags();
	}

	/**
	 * Reset debug settings to safe defaults
	 */
	resetDebugSettings(): void {
		this.debugSettings = { enabled: false };
		this.initializeFeatureFlags();
	}

	/**
	 * Get debug settings
	 */
	getDebugSettings(): DebugSettings {
		return { ...this.debugSettings };
	}

	/**
	 * Get feature summary.
	 */
	getFeatureSummary(): { 
		isSupernova: boolean; 
		enabled: string[]; 
		supernovaOnly: string[];
	} {
		const enabled: string[] = [];
		const supernovaOnly: string[] = [];

		for (const [key, feature] of this.features) {
			if (feature.enabled) {
				enabled.push(key);
			}

			if (feature.supernovaOnly) {
				supernovaOnly.push(key);
			}
		}

		return { 
			isSupernova: this.getIsSupernova(), 
			enabled, 
			supernovaOnly
		};
	}
}
