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
			// Commands feature is not yet generally available (future date in config)
			expect(featureManager.isFeatureEnabled('commands')).toBe(false);
			
			// Multi-doc context is now a core feature (always available)
			expect(featureManager.isFeatureEnabled('multi-doc-context')).toBe(true);
		});

		test('should provide detailed access information for time-gated features', () => {
			const commandsAccess = featureManager.checkFeatureAccess('commands');
			
			expect(commandsAccess.allowed).toBe(false);
			expect(commandsAccess.isSupernovaFeature).toBe(true);
			expect(commandsAccess.reason).toContain('early access for Supernova supporters');
			expect(commandsAccess.availableDate).toEqual(new Date('2025-09-30'));
		});
	});

	describe('Supernova Supporter Features', () => {
		test('should enable Supernova features for valid Supernova license', async () => {
			const catalystLicense = await licenseValidator.createTestSupernovaLicense('test@example.com', 'annual');
			await featureManager.updateSupernovaLicense(catalystLicense);

			expect(featureManager.isSupernovaSupporter()).toBe(true);
			
			const catalystLicenseObj = featureManager.getSupernovaLicense();
			expect(catalystLicenseObj?.email).toBe('test@example.com');
			expect(catalystLicenseObj?.type).toBe('annual');
		});

		test('should handle invalid Supernova license', async () => {
			await featureManager.updateSupernovaLicense('invalid-license');

			expect(featureManager.isSupernovaSupporter()).toBe(false);
			expect(featureManager.getSupernovaLicense()).toBeNull();
		});

		test('should reset Supernova status when license is removed', async () => {
			// Set up Supernova license first
			const catalystLicense = await licenseValidator.createTestSupernovaLicense('test@example.com', 'lifetime');
			await featureManager.updateSupernovaLicense(catalystLicense);
			expect(featureManager.isSupernovaSupporter()).toBe(true);

			// Remove license
			await featureManager.updateSupernovaLicense(null);
			expect(featureManager.isSupernovaSupporter()).toBe(false);
			expect(featureManager.getSupernovaLicense()).toBeNull();
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

			expect(summary.isSupernova).toBe(false);
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
				forceSupernova: true
			};

			featureManager.updateDebugSettings(debugSettings);

			// With debug mode, time-gated features should be available
			expect(featureManager.isFeatureEnabled('commands')).toBe(true);
			expect(featureManager.isFeatureEnabled('multi-doc-context')).toBe(true);
			expect(featureManager.isSupernovaSupporter()).toBe(true);
		});

		test('should allow date override for testing', () => {
			const debugSettings: DebugSettings = {
				enabled: true,
				overrideDate: '2025-08-01', // Date before commands general availability
				forceSupernova: false
			};

			featureManager.updateDebugSettings(debugSettings);

			// Commands should not be available yet (general date is 2025-09-30)
			expect(featureManager.isFeatureEnabled('commands')).toBe(false);
		});

		test('should return debug settings', () => {
			const debugSettings: DebugSettings = {
				enabled: true,
				overrideDate: '2025-06-01',
				forceSupernova: true
			};

			featureManager.updateDebugSettings(debugSettings);
			const retrievedSettings = featureManager.getDebugSettings();

			expect(retrievedSettings.enabled).toBe(true);
			expect(retrievedSettings.overrideDate).toBe('2025-06-01');
			expect(retrievedSettings.forceSupernova).toBe(true);
		});
	});

	describe('Feature Lists', () => {
		test('should return enabled features', () => {
			const enabledFeatures = featureManager.getEnabledFeatures();

			expect(enabledFeatures.length).toBeGreaterThan(0);
			expect(enabledFeatures.some(f => f.key === 'basic_editing')).toBe(true);
			expect(enabledFeatures.some(f => f.key === 'all_ai_providers')).toBe(true);
		});

		test('should return Supernova early access features', () => {
			const catalystFeatures = featureManager.getSupernovaFeatures();

			expect(catalystFeatures.length).toBeGreaterThan(0);
			expect(catalystFeatures.some(f => f.key === 'commands')).toBe(true);
			// multi-doc-context is now a core feature, not in early access
			
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
		test('should properly handle feature dates with Supernova supporter', async () => {
			// Set up as Supernova supporter
			const catalystLicense = await licenseValidator.createTestSupernovaLicense('test@example.com', 'lifetime');
			await featureManager.updateSupernovaLicense(catalystLicense);

			// Use debug mode to simulate being at the Supernova release date
			const debugSettings: DebugSettings = {
				enabled: true,
				overrideDate: '2025-08-01', // After commands Supernova date (2025-07-31)
				forceSupernova: true
			};
			featureManager.updateDebugSettings(debugSettings);

			// Time-gated features should be available for Supernova supporters
			expect(featureManager.isFeatureEnabled('commands')).toBe(true);
			expect(featureManager.isFeatureEnabled('multi-doc-context')).toBe(true);
		});

		test('should handle general availability dates correctly', () => {
			// Use debug mode to simulate being past general availability
			const debugSettings: DebugSettings = {
				enabled: true,
				overrideDate: '2025-10-01', // Past all general availability dates
				forceSupernova: false
			};
			featureManager.updateDebugSettings(debugSettings);

			// All features should be available to everyone
			expect(featureManager.isFeatureEnabled('commands')).toBe(true);
			expect(featureManager.isFeatureEnabled('multi-doc-context')).toBe(true);
		});
	});
});