import { LicenseValidator } from './license-validator';
import { CatalystLicense, FeatureFlag, FeatureAccessResult, DebugSettings, CatalystValidationResult } from './types';
import { CATALYST_FEATURES, CORE_FEATURES, TimeGatedFeature } from './feature-config';

export class FeatureManager {
	private features: Map<string, FeatureFlag> = new Map();
	private catalystLicense: CatalystLicense | null = null;
	private isCatalyst: boolean = false;
	private debugSettings: DebugSettings = { enabled: false };

	constructor(
		private licenseValidator: LicenseValidator,
		debugSettings?: DebugSettings
	) {
		if (debugSettings) {
			this.debugSettings = debugSettings;
		}
		this.initializeFeatureFlags();
	}

	/**
	 * Initialize all feature flags
	 * Core features are always enabled
	 * Time-gated features depend on current date and Catalyst status
	 */
	private initializeFeatureFlags(): void {
		// Core features - always available to all users
		CORE_FEATURES.forEach(featureKey => {
			this.registerFeature({
				key: featureKey,
				enabled: true,
				description: this.getCoreFeatureDescription(featureKey)
			});
		});

		// Time-gated features - available based on date
		Object.entries(CATALYST_FEATURES).forEach(([key, config]) => {
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
	 * Get description for core features
	 */
	private getCoreFeatureDescription(key: string): string {
		const descriptions: Record<string, string> = {
			'basic_editing': 'Basic document editing commands (add, edit, delete, grammar, rewrite)',
			'all_ai_providers': 'Access to all AI providers (Claude, OpenAI, Google, Ollama)',
			'file_conversations': 'File-scoped conversation history',
			'provider_switching': 'Switch AI providers directly in chat interface',
			'mobile_access': 'Full mobile device support',
			'api_key_config': 'Configure your own API keys',
			'sidebar_chat': 'Chat interface in sidebar',
			'document_context': 'Current document context in conversations'
		};
		return descriptions[key] || key;
	}

	/**
	 * Check if a time-gated feature should be enabled
	 */
	private isTimeGatedFeatureEnabled(featureKey: string, config: TimeGatedFeature): boolean {
		const now = this.getCurrentDate();
		const catalystDate = new Date(config.catalystDate);
		const generalDate = new Date(config.generalDate);

		// Feature is available to everyone after general date
		if (now >= generalDate) {
			return true;
		}

		// Feature is available to Catalyst supporters after catalyst date
		if (this.getIsCatalyst() && now >= catalystDate) {
			return true;
		}

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
			return new Date(this.debugSettings.overrideDate);
		}
		return new Date();
	}

	/**
	 * Get Catalyst status (can be overridden in debug mode)
	 */
	private getIsCatalyst(): boolean {
		if (this.debugSettings.enabled && this.debugSettings.forceCatalyst !== undefined) {
			return this.debugSettings.forceCatalyst;
		}
		return this.isCatalyst;
	}

	/**
	 * Register a new feature flag
	 */
	registerFeature(flag: FeatureFlag): void {
		this.features.set(flag.key, flag);
	}

	/**
	 * Update Catalyst license and recalculate feature availability
	 */
	async updateCatalystLicense(licenseKey: string | null): Promise<void> {
		if (!licenseKey) {
			this.catalystLicense = null;
			this.isCatalyst = false;
		} else {
			const validation = await this.licenseValidator.validateCatalystLicense(licenseKey);
			if (validation.valid && validation.license) {
				this.catalystLicense = validation.license;
				this.isCatalyst = true;
			} else {
				this.catalystLicense = null;
				this.isCatalyst = false;
			}
		}

		// Reinitialize features with updated Catalyst status
		this.initializeFeatureFlags();
	}

	/**
	 * Get current Catalyst status
	 */
	getIsCatalystSupporter(): boolean {
		return this.getIsCatalyst();
	}

	/**
	 * Get current Catalyst license
	 */
	getCatalystLicense(): CatalystLicense | null {
		return this.catalystLicense;
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
			const config = CATALYST_FEATURES[featureKey];
			if (config) {
				const now = this.getCurrentDate();
				const generalDate = new Date(config.generalDate);
				const catalystDate = new Date(config.catalystDate);

				if (this.getIsCatalyst() && now < catalystDate) {
					return {
						allowed: false,
						reason: `This feature will be available to Catalyst supporters on ${config.catalystDate}`,
						isCatalystFeature: true,
						availableDate: catalystDate
					};
				} else if (!this.getIsCatalyst() && now < generalDate) {
					return {
						allowed: false,
						reason: `This feature is currently in early access for Catalyst supporters. It will be available to all users on ${config.generalDate}`,
						isCatalystFeature: true,
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
	 * Get all Catalyst early access features
	 */
	getCatalystFeatures(): FeatureFlag[] {
		return Array.from(this.features.values()).filter(feature => 
			feature.isTimeGated && feature.earlyAccessOnly
		);
	}

	/**
	 * Update debug settings for development testing
	 */
	updateDebugSettings(settings: DebugSettings): void {
		this.debugSettings = settings;
		// Reinitialize features with new debug settings
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
		isCatalyst: boolean; 
		enabled: string[]; 
		comingSoon: Array<{key: string; availableDate: string; isCatalyst: boolean}> 
	} {
		const enabled: string[] = [];
		const comingSoon: Array<{key: string; availableDate: string; isCatalyst: boolean}> = [];

		for (const [key, feature] of this.features) {
			if (feature.enabled) {
				enabled.push(key);
			} else if (feature.isTimeGated) {
				const config = CATALYST_FEATURES[key];
				if (config) {
					const isCatalystUser = this.getIsCatalyst();
					comingSoon.push({
						key,
						availableDate: isCatalystUser ? config.catalystDate : config.generalDate,
						isCatalyst: isCatalystUser
					});
				}
			}
		}

		return { 
			isCatalyst: this.getIsCatalyst(), 
			enabled, 
			comingSoon 
		};
	}
}