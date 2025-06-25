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


	describe('Time-Gated Features', () => {
		test('should have time-gated features disabled before general availability', () => {
			// Commands feature is not yet generally available (future date in config)
			expect(featureManager.isFeatureEnabled('commands')).toBe(false);
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

		test('should correctly identify lifetime access for founding and lifetime licenses', async () => {
			// Test with no license
			expect(featureManager.hasLifetimeAccess()).toBe(false);

			// Test with annual license (not lifetime)
			const annualLicense = await licenseValidator.createTestSupernovaLicense('annual@example.com', 'annual');
			await featureManager.updateSupernovaLicense(annualLicense);
			expect(featureManager.hasLifetimeAccess()).toBe(false);

			// Test with lifetime license
			const lifetimeLicense = await licenseValidator.createTestSupernovaLicense('lifetime@example.com', 'lifetime');
			await featureManager.updateSupernovaLicense(lifetimeLicense);
			expect(featureManager.hasLifetimeAccess()).toBe(true);

			// Test with founding license (should also be lifetime)
			const foundingLicense = await licenseValidator.createTestSupernovaLicense('founding@example.com', 'founding');
			await featureManager.updateSupernovaLicense(foundingLicense);
			expect(featureManager.hasLifetimeAccess()).toBe(true);
		});
	});

	describe('Feature Access Checking', () => {
		test('should handle unknown features gracefully', () => {
			const unknownFeature = featureManager.checkFeatureAccess('unknown-feature');

			expect(unknownFeature.allowed).toBe(false);
			expect(unknownFeature.reason).toContain('not found');
		});

		test('should provide feature summary for time-gated features only', () => {
			const summary = featureManager.getFeatureSummary();

			expect(summary.isSupernova).toBe(false);
			// Only time-gated features are tracked - commands is not yet available
			expect(summary.enabled.length).toBe(0);
			expect(summary.comingSoon.length).toBe(1); // Only commands feature
			expect(summary.comingSoon[0].key).toBe('commands');
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
		test('should return only enabled time-gated features', () => {
			const enabledFeatures = featureManager.getEnabledFeatures();

			// No features are enabled initially (commands not yet available)
			expect(enabledFeatures.length).toBe(0);
		});

		test('should return Supernova early access features', () => {
			const catalystFeatures = featureManager.getSupernovaFeatures();

			expect(catalystFeatures.length).toBe(1); // Only commands feature
			expect(catalystFeatures.some(f => f.key === 'commands')).toBe(true);
			
			// All should be time-gated and early access only
			catalystFeatures.forEach(feature => {
				expect(feature.isTimeGated).toBe(true);
				expect(feature.earlyAccessOnly).toBe(true);
			});
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
		});
	});
});