import { FeatureManager } from '../../src/licensing/feature-manager';
import { LicenseValidator } from '../../src/licensing/license-validator';
import { DebugSettings } from '../../src/licensing/types';

describe('FeatureManager', () => {
	let featureManager: FeatureManager;
	let licenseValidator: LicenseValidator;

	beforeEach(() => {
		licenseValidator = new LicenseValidator();
		featureManager = new FeatureManager(licenseValidator);
	});

	describe('Core Features (Always Available)', () => {
		test('should have all core features enabled by default', () => {
			// Core features are always available to all users
			expect(featureManager.isFeatureEnabled('basic_editing')).toBe(true);
			expect(featureManager.isFeatureEnabled('all_ai_providers')).toBe(true);
			expect(featureManager.isFeatureEnabled('file_conversations')).toBe(true);
			expect(featureManager.isFeatureEnabled('provider_switching')).toBe(true);
			expect(featureManager.isFeatureEnabled('mobile_access')).toBe(true);
			expect(featureManager.isFeatureEnabled('api_key_config')).toBe(true);
			expect(featureManager.isFeatureEnabled('sidebar_chat')).toBe(true);
			expect(featureManager.isFeatureEnabled('document_context')).toBe(true);
		});

		test('should support legacy feature keys', () => {
			// Legacy features from tier-based system should all be enabled
			expect(featureManager.isFeatureEnabled('local_ai_providers')).toBe(true);
			expect(featureManager.isFeatureEnabled('single_cloud_provider')).toBe(true);
			expect(featureManager.isFeatureEnabled('unlimited_cloud_ai')).toBe(true);
			expect(featureManager.isFeatureEnabled('advanced_templates')).toBe(true);
			expect(featureManager.isFeatureEnabled('batch_operations')).toBe(true);
			expect(featureManager.isFeatureEnabled('cross_document_context')).toBe(true);
			expect(featureManager.isFeatureEnabled('priority_support')).toBe(true);
		});
	});

	describe('Time-Gated Features', () => {
		test('should have time-gated features disabled before general availability', () => {
			// These features are not yet generally available (past June 2025 in config)
			expect(featureManager.isFeatureEnabled('command-system')).toBe(false);
			expect(featureManager.isFeatureEnabled('multi-doc-context')).toBe(false);
			expect(featureManager.isFeatureEnabled('auto-input')).toBe(false);
			expect(featureManager.isFeatureEnabled('command-button')).toBe(false);
			expect(featureManager.isFeatureEnabled('custom-commands')).toBe(false);
			expect(featureManager.isFeatureEnabled('enhanced-providers')).toBe(false);
		});

		test('should provide detailed access information for time-gated features', () => {
			const commandSystemAccess = featureManager.checkFeatureAccess('command-system');
			
			expect(commandSystemAccess.allowed).toBe(false);
			expect(commandSystemAccess.isCatalystFeature).toBe(true);
			expect(commandSystemAccess.reason).toContain('early access for Catalyst supporters');
			expect(commandSystemAccess.availableDate).toEqual(new Date('2025-09-15'));
		});
	});

	describe('Catalyst Supporter Features', () => {
		test('should enable Catalyst features for valid Catalyst license', async () => {
			const catalystLicense = await licenseValidator.createTestCatalystLicense('test@example.com', 'annual');
			await featureManager.updateCatalystLicense(catalystLicense);

			expect(featureManager.getIsCatalystSupporter()).toBe(true);
			
			const catalystLicenseObj = featureManager.getCatalystLicense();
			expect(catalystLicenseObj?.email).toBe('test@example.com');
			expect(catalystLicenseObj?.type).toBe('annual');
		});

		test('should handle invalid Catalyst license', async () => {
			await featureManager.updateCatalystLicense('invalid-license');

			expect(featureManager.getIsCatalystSupporter()).toBe(false);
			expect(featureManager.getCatalystLicense()).toBeNull();
		});

		test('should reset Catalyst status when license is removed', async () => {
			// Set up Catalyst license first
			const catalystLicense = await licenseValidator.createTestCatalystLicense('test@example.com', 'lifetime');
			await featureManager.updateCatalystLicense(catalystLicense);
			expect(featureManager.getIsCatalystSupporter()).toBe(true);

			// Remove license
			await featureManager.updateCatalystLicense(null);
			expect(featureManager.getIsCatalystSupporter()).toBe(false);
			expect(featureManager.getCatalystLicense()).toBeNull();
		});
	});

	describe('Feature Access Checking', () => {
		test('should allow access to core features', () => {
			const basicEditingAccess = featureManager.checkFeatureAccess('basic_editing');
			const providersAccess = featureManager.checkFeatureAccess('all_ai_providers');

			expect(basicEditingAccess.allowed).toBe(true);
			expect(providersAccess.allowed).toBe(true);
		});

		test('should handle unknown features gracefully', () => {
			const unknownFeature = featureManager.checkFeatureAccess('unknown-feature');

			expect(unknownFeature.allowed).toBe(false);
			expect(unknownFeature.reason).toContain('not found');
		});

		test('should provide feature summary', () => {
			const summary = featureManager.getFeatureSummary();

			expect(summary.isCatalyst).toBe(false);
			expect(summary.enabled.length).toBeGreaterThan(0);
			expect(summary.comingSoon.length).toBeGreaterThan(0);
			
			// Check that core features are in enabled list
			expect(summary.enabled).toContain('basic_editing');
			expect(summary.enabled).toContain('all_ai_providers');
		});
	});

	describe('Debug Settings', () => {
		test('should support debug mode for development', () => {
			const debugSettings: DebugSettings = {
				enabled: true,
				overrideDate: '2025-12-01', // Future date where all features are available
				forceCatalyst: true
			};

			featureManager.updateDebugSettings(debugSettings);

			// With debug mode, time-gated features should be available
			expect(featureManager.isFeatureEnabled('command-system')).toBe(true);
			expect(featureManager.isFeatureEnabled('multi-doc-context')).toBe(true);
			expect(featureManager.getIsCatalystSupporter()).toBe(true);
		});

		test('should allow date override for testing', () => {
			const debugSettings: DebugSettings = {
				enabled: true,
				overrideDate: '2025-07-01', // Date when auto-input is generally available
				forceCatalyst: false
			};

			featureManager.updateDebugSettings(debugSettings);

			// auto-input should be available (general date is 2025-07-15)
			expect(featureManager.isFeatureEnabled('auto-input')).toBe(false);
			
			// But command-system should not be (general date is 2025-09-15)
			expect(featureManager.isFeatureEnabled('command-system')).toBe(false);
		});

		test('should return debug settings', () => {
			const debugSettings: DebugSettings = {
				enabled: true,
				overrideDate: '2025-06-01',
				forceCatalyst: true
			};

			featureManager.updateDebugSettings(debugSettings);
			const retrievedSettings = featureManager.getDebugSettings();

			expect(retrievedSettings.enabled).toBe(true);
			expect(retrievedSettings.overrideDate).toBe('2025-06-01');
			expect(retrievedSettings.forceCatalyst).toBe(true);
		});
	});

	describe('Feature Lists', () => {
		test('should return enabled features', () => {
			const enabledFeatures = featureManager.getEnabledFeatures();

			expect(enabledFeatures.length).toBeGreaterThan(0);
			expect(enabledFeatures.some(f => f.key === 'basic_editing')).toBe(true);
			expect(enabledFeatures.some(f => f.key === 'all_ai_providers')).toBe(true);
		});

		test('should return Catalyst early access features', () => {
			const catalystFeatures = featureManager.getCatalystFeatures();

			expect(catalystFeatures.length).toBeGreaterThan(0);
			expect(catalystFeatures.some(f => f.key === 'command-system')).toBe(true);
			expect(catalystFeatures.some(f => f.key === 'multi-doc-context')).toBe(true);
			
			// All should be time-gated and early access only
			catalystFeatures.forEach(feature => {
				expect(feature.isTimeGated).toBe(true);
				expect(feature.earlyAccessOnly).toBe(true);
			});
		});
	});

	describe('Legacy Compatibility', () => {
		test('should maintain compatibility with old API calls', () => {
			// These methods don't exist anymore but the feature manager should handle 
			// legacy feature checks gracefully through isFeatureEnabled
			expect(featureManager.isFeatureEnabled('provider_switching')).toBe(true);
			expect(featureManager.isFeatureEnabled('mobile_access')).toBe(true);
			expect(featureManager.isFeatureEnabled('unlimited_cloud_ai')).toBe(true);
		});
	});

	describe('Time-Based Feature Release', () => {
		test('should properly handle feature dates with Catalyst supporter', async () => {
			// Set up as Catalyst supporter
			const catalystLicense = await licenseValidator.createTestCatalystLicense('test@example.com', 'lifetime');
			await featureManager.updateCatalystLicense(catalystLicense);

			// Use debug mode to simulate being at the Catalyst release date
			const debugSettings: DebugSettings = {
				enabled: true,
				overrideDate: '2025-06-15', // Catalyst date for all features
				forceCatalyst: true
			};
			featureManager.updateDebugSettings(debugSettings);

			// All time-gated features should be available for Catalyst supporters
			expect(featureManager.isFeatureEnabled('command-system')).toBe(true);
			expect(featureManager.isFeatureEnabled('multi-doc-context')).toBe(true);
			expect(featureManager.isFeatureEnabled('auto-input')).toBe(true);
		});

		test('should handle general availability dates correctly', () => {
			// Use debug mode to simulate being past general availability
			const debugSettings: DebugSettings = {
				enabled: true,
				overrideDate: '2025-10-01', // Past all general availability dates
				forceCatalyst: false
			};
			featureManager.updateDebugSettings(debugSettings);

			// All features should be available to everyone
			expect(featureManager.isFeatureEnabled('command-system')).toBe(true);
			expect(featureManager.isFeatureEnabled('multi-doc-context')).toBe(true);
			expect(featureManager.isFeatureEnabled('auto-input')).toBe(true);
		});
	});
});