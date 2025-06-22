import { LicenseValidator } from './license-validator';
import { SupernovaLicense, FeatureFlag, FeatureAccessResult, DebugSettings, SupernovaValidationResult } from './types';
import { SUPERNOVA_FEATURES, CORE_FEATURES, TimeGatedFeature, CoreFeature } from './feature-config';

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
				console.log('🔒 Production mode: Debug features disabled');
			} else {
				this.debugSettings = debugSettings;
				if (debugSettings.enabled) {
					console.log('🔧 Debug mode enabled with settings:', debugSettings);
				}
			}
		}
		this.initializeFeatureFlags();
	}

	/**
	 * Initialize all feature flags
	 * Core features are always enabled
	 * Time-gated features depend on current date and Supernova status
	 */
	private initializeFeatureFlags(): void {
		// Core features - always available to all users
		Object.entries(CORE_FEATURES).forEach(([key, config]) => {
			this.registerFeature({
				key,
				enabled: true,
				description: config.description
			});
		});

		// Time-gated features - available based on date
		Object.entries(SUPERNOVA_FEATURES).forEach(([key, config]) => {
			const enabled = this.isTimeGatedFeatureEnabled(key, config);
			this.registerFeature({
				key,
				enabled,
				description: config.description,
				isTimeGated: true,
				earlyAccessOnly: !this.isGenerallyAvailable(config)
			});
		});
	}

	/**
	 * Check if a time-gated feature should be enabled
	 */
	private isTimeGatedFeatureEnabled(featureKey: string, config: TimeGatedFeature): boolean {
		const now = this.getCurrentDate();
		const supernovaDate = new Date(config.supernovaDate);
		const generalDate = new Date(config.generalDate);
		const isSupernova = this.getIsSupernova();

		// Add debug logging for commands feature specifically
		if (featureKey === 'commands') {
			console.log(`🔧 Commands feature check:`, {
				now: now.toISOString(),
				supernovaDate: supernovaDate.toISOString(),
				generalDate: generalDate.toISOString(),
				isSupernova,
				debugEnabled: this.debugSettings.enabled,
				forceSupernova: this.debugSettings.forceSupernova,
				nodeEnv: process.env.NODE_ENV
			});
		}

		// Feature is available to everyone after general date
		if (now >= generalDate) {
			if (featureKey === 'commands') console.log(`🔧 Commands: Enabled via general availability`);
			return true;
		}

		// Feature is available to Supernova supporters after supernova date
		if (isSupernova && now >= supernovaDate) {
			if (featureKey === 'commands') console.log(`🔧 Commands: Enabled via Supernova early access`);
			return true;
		}

		if (featureKey === 'commands') console.log(`🔧 Commands: Not enabled - before release date`);
		return false;
	}

	/**
	 * Check if feature is generally available (past general date)
	 */
	private isGenerallyAvailable(config: TimeGatedFeature): boolean {
		const now = this.getCurrentDate();
		const generalDate = new Date(config.generalDate);
		return now >= generalDate;
	}

	/**
	 * Get current date (can be overridden in debug mode)
	 */
	private getCurrentDate(): Date {
		if (this.debugSettings.enabled && this.debugSettings.overrideDate) {
			console.log(`🔧 Debug: Using override date: ${this.debugSettings.overrideDate}`);
			return new Date(this.debugSettings.overrideDate);
		}
		return new Date();
	}

	/**
	 * Get Supernova status (can be overridden in debug mode)
	 */
	private getIsSupernova(): boolean {
		// Only allow debug overrides in development and test builds
		if (this.debugSettings.enabled && this.debugSettings.forceSupernova !== undefined && (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test')) {
			console.log(`🔧 Debug: Force Supernova enabled: ${this.debugSettings.forceSupernova}`);
			return this.debugSettings.forceSupernova;
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
	 * Check if a feature is enabled
	 */
	isFeatureEnabled(featureKey: string): boolean {
		// Handle old feature keys that might still be referenced
		if (this.isLegacyFeatureKey(featureKey)) {
			return true; // All legacy features are now enabled for everyone
		}

		const feature = this.features.get(featureKey);
		return feature?.enabled ?? false;
	}

	/**
	 * Check if this is a legacy feature key that should always be enabled
	 */
	private isLegacyFeatureKey(key: string): boolean {
		const legacyKeys = [
			'basic_editing',
			'local_ai_providers',
			'file_conversations',
			'single_cloud_provider',
			'unlimited_cloud_ai',
			'provider_switching',
			'mobile_access',
			'advanced_templates',
			'batch_operations',
			'cross_document_context',
			'priority_support'
		];
		return legacyKeys.includes(key);
	}

	/**
	 * Check feature access with detailed result
	 */
	checkFeatureAccess(featureKey: string): FeatureAccessResult {
		// Handle legacy features
		if (this.isLegacyFeatureKey(featureKey)) {
			return { allowed: true };
		}

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

		// For time-gated features, provide more information
		if (feature.isTimeGated) {
			const config = SUPERNOVA_FEATURES[featureKey];
			if (config) {
				const now = this.getCurrentDate();
				const generalDate = new Date(config.generalDate);
				const supernovaDate = new Date(config.supernovaDate);

				if (this.getIsSupernova() && now < supernovaDate) {
					return {
						allowed: false,
						reason: `This feature will be available to Supernova supporters on ${config.supernovaDate}`,
						isSupernovaFeature: true,
						availableDate: supernovaDate
					};
				} else if (!this.getIsSupernova() && now < generalDate) {
					return {
						allowed: false,
						reason: `This feature is currently in early access for Supernova supporters. It will be available to all users on ${config.generalDate}`,
						isSupernovaFeature: true,
						availableDate: generalDate
					};
				}
			}
		}

		return {
			allowed: false,
			reason: 'Feature is not available'
		};
	}

	/**
	 * Get all enabled features
	 */
	getEnabledFeatures(): FeatureFlag[] {
		return Array.from(this.features.values()).filter(feature => feature.enabled);
	}

	/**
	 * Get all Supernova early access features
	 */
	getSupernovaFeatures(): FeatureFlag[] {
		return Array.from(this.features.values()).filter(feature => 
			feature.isTimeGated && feature.earlyAccessOnly
		);
	}

	/**
	 * Update debug settings for development testing
	 */
	updateDebugSettings(settings: DebugSettings): void {
		// In production builds, never allow debug settings to be enabled
		if (process.env.NODE_ENV === 'production') {
			this.debugSettings = { enabled: false };
			console.log('🔒 Production mode: Debug settings update ignored');
		} else {
			this.debugSettings = settings;
			console.log('🔧 Debug settings updated:', settings);
		}
		// Reinitialize features with new debug settings
		this.initializeFeatureFlags();
	}

	/**
	 * Reset debug settings to safe defaults
	 */
	resetDebugSettings(): void {
		this.debugSettings = { enabled: false };
		console.log('🔄 Debug settings reset to defaults');
		this.initializeFeatureFlags();
	}

	/**
	 * Get debug settings
	 */
	getDebugSettings(): DebugSettings {
		return { ...this.debugSettings };
	}

	/**
	 * Get feature summary
	 */
	getFeatureSummary(): { 
		isSupernova: boolean; 
		enabled: string[]; 
		comingSoon: Array<{key: string; availableDate: string; isSupernova: boolean}> 
	} {
		const enabled: string[] = [];
		const comingSoon: Array<{key: string; availableDate: string; isSupernova: boolean}> = [];

		for (const [key, feature] of this.features) {
			if (feature.enabled) {
				enabled.push(key);
			} else if (feature.isTimeGated) {
				const config = SUPERNOVA_FEATURES[key];
				if (config) {
					const isSupernovaUser = this.getIsSupernova();
					comingSoon.push({
						key,
						availableDate: isSupernovaUser ? config.supernovaDate : config.generalDate,
						isSupernova: isSupernovaUser
					});
				}
			}
		}

		return { 
			isSupernova: this.getIsSupernova(), 
			enabled, 
			comingSoon 
		};
	}
}