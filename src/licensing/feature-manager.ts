import { LicenseValidator } from './license-validator';
import { License, LicenseTier, FeatureFlag, FeatureAccessResult, FeatureTier, DebugSettings } from './types';

export class FeatureManager {
	private features: Map<string, FeatureFlag> = new Map();
	private currentLicense: License | null = null;
	private currentTier: FeatureTier = FeatureTier.CORE;
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
	 * Initialize all feature flags for Core vs SuperNova tiers
	 */
	private initializeFeatureFlags(): void {
		// Core features (always available)
		this.registerFeature({
			key: 'basic_editing',
			requiredTier: FeatureTier.CORE,
			enabled: true,
			description: 'Basic document editing commands (add, edit, delete, grammar, rewrite)'
		});

		this.registerFeature({
			key: 'local_ai_providers',
			requiredTier: FeatureTier.CORE,
			enabled: true,
			description: 'Local AI providers (Ollama, LM Studio)'
		});

		this.registerFeature({
			key: 'file_conversations',
			requiredTier: FeatureTier.CORE,
			enabled: true,
			description: 'File-scoped conversation history'
		});

		this.registerFeature({
			key: 'single_cloud_provider',
			requiredTier: FeatureTier.CORE,
			enabled: true,
			description: 'One cloud AI provider (user choice: Claude, OpenAI, or Google)'
		});

		// SuperNova features (premium only)
		this.registerFeature({
			key: 'unlimited_cloud_ai',
			requiredTier: FeatureTier.SUPERNOVA,
			enabled: false,
			description: 'Unlimited access to all cloud AI providers',
			fallbackBehavior: 'prompt_upgrade'
		});

		this.registerFeature({
			key: 'provider_switching',
			requiredTier: FeatureTier.SUPERNOVA,
			enabled: false,
			description: 'Switch AI providers directly in chat interface',
			fallbackBehavior: 'prompt_upgrade'
		});

		this.registerFeature({
			key: 'mobile_access',
			requiredTier: FeatureTier.SUPERNOVA,
			enabled: false,
			description: 'Mobile device support (iOS/Android)',
			fallbackBehavior: 'prompt_upgrade'
		});

		this.registerFeature({
			key: 'advanced_templates',
			requiredTier: FeatureTier.SUPERNOVA,
			enabled: false,
			description: 'Advanced template integration and custom prompts',
			fallbackBehavior: 'prompt_upgrade'
		});

		this.registerFeature({
			key: 'batch_operations',
			requiredTier: FeatureTier.SUPERNOVA,
			enabled: false,
			description: 'Batch document processing',
			fallbackBehavior: 'limited_usage'
		});

		this.registerFeature({
			key: 'cross_document_context',
			requiredTier: FeatureTier.SUPERNOVA,
			enabled: false,
			description: 'Reference other vault notes during editing',
			fallbackBehavior: 'disable'
		});

		this.registerFeature({
			key: 'priority_support',
			requiredTier: FeatureTier.SUPERNOVA,
			enabled: false,
			description: 'Priority email support and feature requests',
			fallbackBehavior: 'disable'
		});
	}

	/**
	 * Register a new feature flag
	 */
	registerFeature(flag: FeatureFlag): void {
		this.features.set(flag.key, flag);
		this.updateFeatureAvailability();
	}

	/**
	 * Update license and recalculate feature availability
	 */
	async updateLicense(licenseKey: string | null): Promise<void> {
		if (!licenseKey) {
			this.currentLicense = null;
			this.currentTier = FeatureTier.CORE;
		} else {
			const validation = await this.licenseValidator.validateLicense(licenseKey);
			if (validation.valid && validation.license) {
				this.currentLicense = validation.license;
				this.currentTier = validation.license.tier === 'supernova' 
					? FeatureTier.SUPERNOVA 
					: FeatureTier.CORE;
			} else {
				this.currentLicense = null;
				this.currentTier = FeatureTier.CORE;
			}
		}

		this.updateFeatureAvailability();
	}

	/**
	 * Get current user's license tier
	 */
	getCurrentTier(): FeatureTier {
		// Development override
		if (this.debugSettings.enabled && this.debugSettings.overrideTier) {
			return this.debugSettings.overrideTier === 'supernova' 
				? FeatureTier.SUPERNOVA 
				: FeatureTier.CORE;
		}

		return this.currentTier;
	}

	/**
	 * Get current license information
	 */
	getCurrentLicense(): License | null {
		return this.currentLicense;
	}

	/**
	 * Check if a feature is enabled for current tier
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

		const currentTier = this.getCurrentTier();
		const requiredTier = feature.requiredTier;

		return {
			allowed: false,
			reason: `Feature requires ${requiredTier} tier (current: ${currentTier})`,
			fallbackBehavior: feature.fallbackBehavior,
			upgradePrompt: this.getUpgradePrompt(feature)
		};
	}

	/**
	 * Get all features for a specific tier
	 */
	getFeaturesForTier(tier: FeatureTier): FeatureFlag[] {
		return Array.from(this.features.values()).filter(feature => 
			tier === FeatureTier.SUPERNOVA ? true : feature.requiredTier === FeatureTier.CORE
		);
	}

	/**
	 * Update debug settings for development testing
	 */
	updateDebugSettings(settings: DebugSettings): void {
		this.debugSettings = settings;
		this.updateFeatureAvailability();
	}

	/**
	 * Get debug settings
	 */
	getDebugSettings(): DebugSettings {
		return { ...this.debugSettings };
	}

	/**
	 * Update feature availability based on current tier
	 */
	private updateFeatureAvailability(): void {
		const currentTier = this.getCurrentTier();
		
		for (const [key, feature] of this.features) {
			const shouldEnable = currentTier === FeatureTier.SUPERNOVA || 
							   feature.requiredTier === FeatureTier.CORE;
			
			this.features.set(key, { ...feature, enabled: shouldEnable });
		}
	}

	/**
	 * Generate upgrade prompt for blocked feature
	 */
	private getUpgradePrompt(feature: FeatureFlag): string {
		return `${feature.description} is available with Nova SuperNova. ` +
			   `Upgrade to unlock this feature and support Nova development.`;
	}

	/**
	 * Get feature usage summary for current tier
	 */
	getFeatureSummary(): { tier: FeatureTier; enabled: string[]; disabled: string[] } {
		const currentTier = this.getCurrentTier();
		const enabled: string[] = [];
		const disabled: string[] = [];

		for (const [key, feature] of this.features) {
			if (feature.enabled) {
				enabled.push(key);
			} else {
				disabled.push(key);
			}
		}

		return { tier: currentTier, enabled, disabled };
	}
}