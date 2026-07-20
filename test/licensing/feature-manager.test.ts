import { FEATURE_SMART_REVISION, FEATURE_SMARTFILL } from '../../src/constants';
import { FEATURE_CONFIGS } from '../../src/licensing/feature-config';
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

	describe('Core features', () => {
		test('should enable Smart Fill for everyone', () => {
			expect(featureManager.isFeatureEnabled(FEATURE_SMARTFILL)).toBe(true);
		});

		test('should provide allowed access information for Smart Fill', () => {
			const access = featureManager.checkFeatureAccess(FEATURE_SMARTFILL);

			expect(access.allowed).toBe(true);
			expect(access.reason).toBeUndefined();
		});
	});

	describe('Supernova supporter features', () => {
		test('should keep Smart Revision gated for non-supporters', () => {
			expect(featureManager.isFeatureEnabled(FEATURE_SMART_REVISION)).toBe(false);
		});

		test('should report upgrade-required access for Smart Revision', () => {
			const access = featureManager.checkFeatureAccess(FEATURE_SMART_REVISION);

			expect(access).toEqual(expect.objectContaining({
				allowed: false,
				access: 'permanent',
				isSupernovaFeature: true,
				upgradeRequired: true
			}));
			expect(access.reason).toContain('premium feature requires Supernova');
			expect(access.reason).toContain('Free Nova keeps');
			expect(access).not.toHaveProperty('availableDate');
		});

		test('should enable Smart Revision for valid Supernova licenses', async () => {
			const license = await licenseValidator.createTestSupernovaLicense('test@example.com', 'annual');
			await featureManager.updateSupernovaLicense(license);

			expect(featureManager.isSupernovaSupporter()).toBe(true);
			expect(featureManager.isFeatureEnabled(FEATURE_SMART_REVISION)).toBe(true);

			const licenseObject = featureManager.getSupernovaLicense();
			expect(licenseObject?.email).toBe('test@example.com');
			expect(licenseObject?.type).toBe('annual');
		});

		test('should handle invalid Supernova licenses', async () => {
			await featureManager.updateSupernovaLicense('invalid-license');

			expect(featureManager.isSupernovaSupporter()).toBe(false);
			expect(featureManager.isFeatureEnabled(FEATURE_SMART_REVISION)).toBe(false);
			expect(featureManager.getSupernovaLicense()).toBeNull();
		});

		test('should reset Supernova status when license is removed', async () => {
			const license = await licenseValidator.createTestSupernovaLicense('test@example.com', 'lifetime');
			await featureManager.updateSupernovaLicense(license);
			expect(featureManager.isSupernovaSupporter()).toBe(true);
			expect(featureManager.isFeatureEnabled(FEATURE_SMART_REVISION)).toBe(true);

			await featureManager.updateSupernovaLicense(null);
			expect(featureManager.isSupernovaSupporter()).toBe(false);
			expect(featureManager.isFeatureEnabled(FEATURE_SMART_REVISION)).toBe(false);
			expect(featureManager.getSupernovaLicense()).toBeNull();
		});

		test('should correctly identify lifetime access for founding and lifetime licenses', async () => {
			expect(featureManager.hasLifetimeAccess()).toBe(false);

			const annualLicense = await licenseValidator.createTestSupernovaLicense('annual@example.com', 'annual');
			await featureManager.updateSupernovaLicense(annualLicense);
			expect(featureManager.hasLifetimeAccess()).toBe(false);

			const lifetimeLicense = await licenseValidator.createTestSupernovaLicense('lifetime@example.com', 'lifetime');
			await featureManager.updateSupernovaLicense(lifetimeLicense);
			expect(featureManager.hasLifetimeAccess()).toBe(true);

			const foundingLicense = await licenseValidator.createTestSupernovaLicense('founding@example.com', 'founding');
			await featureManager.updateSupernovaLicense(foundingLicense);
			expect(featureManager.hasLifetimeAccess()).toBe(true);
		});
	});

	describe('Feature access checking', () => {
		test('should handle unknown features gracefully', () => {
			const access = featureManager.checkFeatureAccess('unknown-feature');

			expect(access.allowed).toBe(false);
			expect(access.reason).toContain('not found');
		});

		test('should provide a policy summary without coming-soon dates', () => {
			const summary = featureManager.getFeatureSummary();

			expect(summary.isSupernova).toBe(false);
			expect(summary.enabled).toContain(FEATURE_SMARTFILL);
			expect(summary.enabled).not.toContain(FEATURE_SMART_REVISION);
			expect(summary.supernovaOnly).toEqual([FEATURE_SMART_REVISION]);
			expect(summary).not.toHaveProperty('comingSoon');
		});
	});

	describe('Debug settings', () => {
		test('should force Supernova status in debug mode', () => {
			const debugSettings: DebugSettings = {
				enabled: true,
				forceSupernova: true
			};

			featureManager.updateDebugSettings(debugSettings);

			expect(featureManager.isSupernovaSupporter()).toBe(true);
			expect(featureManager.isFeatureEnabled(FEATURE_SMART_REVISION)).toBe(true);
			expect(featureManager.isFeatureEnabled(FEATURE_SMARTFILL)).toBe(true);
		});

		test('should return debug settings without date overrides', () => {
			const debugSettings: DebugSettings = {
				enabled: true,
				forceSupernova: true
			};

			featureManager.updateDebugSettings(debugSettings);
			const retrievedSettings = featureManager.getDebugSettings();

			expect(retrievedSettings).toEqual(debugSettings);
			expect(retrievedSettings).not.toHaveProperty('overrideDate');
		});
	});

	describe('Feature lists', () => {
		test('should return enabled core features without a license', () => {
			const enabledFeatures = featureManager.getEnabledFeatures();

			expect(enabledFeatures).toHaveLength(1);
			expect(enabledFeatures).toEqual(expect.arrayContaining([
				expect.objectContaining({
					key: FEATURE_SMARTFILL,
					access: 'core',
					supernovaOnly: false
				})
			]));
		});

		test('should return permanent Supernova features', () => {
			const supernovaFeatures = featureManager.getSupernovaFeatures();

			expect(supernovaFeatures).toEqual([
				expect.objectContaining({
					key: FEATURE_SMART_REVISION,
					access: 'permanent',
					supernovaOnly: true
				})
			]);
		});
	});

	describe('Configuration validation', () => {
		test('should define Smart Fill as core and Smart Revision as permanent Supernova', () => {
			expect(FEATURE_CONFIGS[FEATURE_SMARTFILL]).toEqual(expect.objectContaining({
				access: 'core',
				category: 'core'
			}));
			expect(FEATURE_CONFIGS[FEATURE_SMART_REVISION]).toEqual(expect.objectContaining({
				access: 'permanent',
				category: 'advanced-revision'
			}));
		});

		test('should not use feature release dates', () => {
			Object.entries(FEATURE_CONFIGS).forEach(([key, config]) => {
				expect(config).not.toHaveProperty('supernovaDate');
				expect(config).not.toHaveProperty('generalDate');
				expect(key).toBeTruthy();
			});
		});

		test('should have descriptions for every configured feature', () => {
			Object.entries(FEATURE_CONFIGS).forEach(([key, config]) => {
				expect(config.description).toBeTruthy();
				expect(config.description.length).toBeGreaterThan(0);
				expect(config.category).toMatch(/^(core|advanced-revision)$/);
				expect(key).toBeTruthy();
			});
		});
	});
});
