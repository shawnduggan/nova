import { FeatureManager } from '../../src/licensing/feature-manager';
import { LicenseValidator } from '../../src/licensing/license-validator';
import { DebugSettings } from '../../src/licensing/types';
import { SUPERNOVA_FEATURES } from '../../src/licensing/feature-config';

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
			expect(featureManager.isFeatureEnabled('smartfill')).toBe(false);
		});

		test('should provide detailed access information for time-gated features', () => {
			const commandsAccess = featureManager.checkFeatureAccess('smartfill');
			
			expect(commandsAccess.allowed).toBe(false);
			expect(commandsAccess.isSupernovaFeature).toBe(true);
			expect(commandsAccess.reason).toContain('early access for Supernova supporters');
			// Test that availableDate exists and is a valid date, not a specific date
			expect(commandsAccess.availableDate).toBeInstanceOf(Date);
			expect(commandsAccess.availableDate?.getTime()).toBeGreaterThan(Date.now());
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
			expect(summary.comingSoon[0].key).toBe('smartfill');
		});
	});

	describe('Debug Settings', () => {
		test('should support debug mode for development', () => {
			const debugSettings: DebugSettings = {
				enabled: true,
				overrideDate: '2026-05-01', // Future date where supernova features are available
				forceSupernova: true
			};

			featureManager.updateDebugSettings(debugSettings);

			// With debug mode, time-gated features should be available
			expect(featureManager.isFeatureEnabled('smartfill')).toBe(true);
			expect(featureManager.isSupernovaSupporter()).toBe(true);
		});

		test('should allow date override for testing', () => {
			const debugSettings: DebugSettings = {
				enabled: true,
				overrideDate: '2026-04-01', // Date before smartfill general availability
				forceSupernova: false
			};

			featureManager.updateDebugSettings(debugSettings);

			// Smart Fill should not be available yet (general date is 2026-05-01)
			expect(featureManager.isFeatureEnabled('smartfill')).toBe(false);
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
			expect(catalystFeatures.some(f => f.key === 'smartfill')).toBe(true);
			
			// All should be time-gated and early access only
			catalystFeatures.forEach(feature => {
				expect(feature.isTimeGated).toBe(true);
				expect(feature.earlyAccessOnly).toBe(true);
			});
		});
	});


	describe('Configuration Validation', () => {
		test('all time-gated features should have valid date formats', () => {
			Object.entries(SUPERNOVA_FEATURES).forEach(([key, config]) => {
				// Check that dates are parseable
				const supernovaDate = new Date(config.supernovaDate);
				const generalDate = new Date(config.generalDate);
				
				expect(supernovaDate.toString()).not.toBe('Invalid Date');
				expect(generalDate.toString()).not.toBe('Invalid Date');
			});
		});

		test('supernova dates should come before general availability dates', () => {
			Object.entries(SUPERNOVA_FEATURES).forEach(([key, config]) => {
				const supernovaDate = new Date(config.supernovaDate);
				const generalDate = new Date(config.generalDate);
				
				expect(supernovaDate.getTime()).toBeLessThan(generalDate.getTime());
			});
		});

		test('all features should have descriptions', () => {
			Object.entries(SUPERNOVA_FEATURES).forEach(([key, config]) => {
				expect(config.description).toBeTruthy();
				expect(config.description.length).toBeGreaterThan(0);
			});
		});
	});

	describe('Time-Gating Logic', () => {
		test('features should be disabled before supernova date for non-supporters', () => {
			// Get any feature from config
			const [featureKey, config] = Object.entries(SUPERNOVA_FEATURES)[0];
			const supernovaDate = new Date(config.supernovaDate);
			
			// Set date to 1 day before supernova date
			supernovaDate.setDate(supernovaDate.getDate() - 1);
			const overrideDate = supernovaDate.toISOString().split('T')[0];

			const debugSettings: DebugSettings = {
				enabled: true,
				overrideDate: overrideDate,
				forceSupernova: false
			};
			featureManager.updateDebugSettings(debugSettings);

			expect(featureManager.isFeatureEnabled(featureKey)).toBe(false);
		});

		test('features should be enabled between supernova and general dates for supporters only', async () => {
			// Get any feature from config
			const [featureKey, config] = Object.entries(SUPERNOVA_FEATURES)[0];
			
			// Set up Supernova supporter
			const license = await licenseValidator.createTestSupernovaLicense('test@example.com', 'lifetime');
			await featureManager.updateSupernovaLicense(license);
			
			// Set date between supernova and general dates
			const supernovaDate = new Date(config.supernovaDate);
			const generalDate = new Date(config.generalDate);
			const midDate = new Date((supernovaDate.getTime() + generalDate.getTime()) / 2);
			const overrideDate = midDate.toISOString().split('T')[0];

			// Test with Supernova supporter
			let debugSettings: DebugSettings = {
				enabled: true,
				overrideDate: overrideDate,
				forceSupernova: true
			};
			featureManager.updateDebugSettings(debugSettings);
			expect(featureManager.isFeatureEnabled(featureKey)).toBe(true);

			// Test without Supernova supporter
			debugSettings = {
				enabled: true,
				overrideDate: overrideDate,
				forceSupernova: false
			};
			featureManager.updateDebugSettings(debugSettings);
			await featureManager.updateSupernovaLicense(null);
			expect(featureManager.isFeatureEnabled(featureKey)).toBe(false);
		});
	});

	describe('Time-Based Feature Release', () => {
		test('should properly handle feature dates with Supernova supporter', async () => {
			// Set up as Supernova supporter
			const catalystLicense = await licenseValidator.createTestSupernovaLicense('test@example.com', 'lifetime');
			await featureManager.updateSupernovaLicense(catalystLicense);

			// Get the actual Supernova date from config and add 1 day
			const commandsConfig = SUPERNOVA_FEATURES['smartfill'];
			const supernovaDate = new Date(commandsConfig.supernovaDate);
			supernovaDate.setDate(supernovaDate.getDate() + 1);
			const overrideDate = supernovaDate.toISOString().split('T')[0];

			// Use debug mode to simulate being after the Supernova release date
			const debugSettings: DebugSettings = {
				enabled: true,
				overrideDate: overrideDate,
				forceSupernova: true
			};
			featureManager.updateDebugSettings(debugSettings);

			// Time-gated features should be available for Supernova supporters
			expect(featureManager.isFeatureEnabled('smartfill')).toBe(true);
		});

		test('should handle general availability dates correctly', () => {
			// Get the actual general date from config and add 1 day
			const commandsConfig = SUPERNOVA_FEATURES['smartfill'];
			const generalDate = new Date(commandsConfig.generalDate);
			generalDate.setDate(generalDate.getDate() + 1);
			const overrideDate = generalDate.toISOString().split('T')[0];

			// Use debug mode to simulate being past general availability
			const debugSettings: DebugSettings = {
				enabled: true,
				overrideDate: overrideDate,
				forceSupernova: false
			};
			featureManager.updateDebugSettings(debugSettings);

			// All features should be available to everyone
			expect(featureManager.isFeatureEnabled('smartfill')).toBe(true);
		});
	});
});