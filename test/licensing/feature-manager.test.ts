import { FeatureManager } from '../../src/licensing/feature-manager';
import { LicenseValidator } from '../../src/licensing/license-validator';
import { FeatureTier } from '../../src/licensing/types';

describe('FeatureManager', () => {
	let featureManager: FeatureManager;
	let licenseValidator: LicenseValidator;

	beforeEach(() => {
		licenseValidator = new LicenseValidator();
		featureManager = new FeatureManager(licenseValidator);
	});

	describe('Feature Flag Initialization', () => {
		test('should initialize with Core tier features enabled', () => {
			expect(featureManager.getCurrentTier()).toBe(FeatureTier.CORE);
			expect(featureManager.isFeatureEnabled('basic_editing')).toBe(true);
			expect(featureManager.isFeatureEnabled('local_ai_providers')).toBe(true);
			expect(featureManager.isFeatureEnabled('file_conversations')).toBe(true);
			expect(featureManager.isFeatureEnabled('single_cloud_provider')).toBe(true);
		});

		test('should initialize with SuperNova features disabled', () => {
			expect(featureManager.isFeatureEnabled('unlimited_cloud_ai')).toBe(false);
			expect(featureManager.isFeatureEnabled('provider_switching')).toBe(false);
			expect(featureManager.isFeatureEnabled('mobile_access')).toBe(false);
			expect(featureManager.isFeatureEnabled('advanced_templates')).toBe(false);
			expect(featureManager.isFeatureEnabled('batch_operations')).toBe(false);
			expect(featureManager.isFeatureEnabled('cross_document_context')).toBe(false);
			expect(featureManager.isFeatureEnabled('priority_support')).toBe(false);
		});

		test('should have correct feature summary for Core tier', () => {
			const summary = featureManager.getFeatureSummary();
			
			expect(summary.tier).toBe(FeatureTier.CORE);
			expect(summary.enabled).toContain('basic_editing');
			expect(summary.enabled).toContain('local_ai_providers');
			expect(summary.enabled).toContain('file_conversations');
			expect(summary.enabled).toContain('single_cloud_provider');
			
			expect(summary.disabled).toContain('unlimited_cloud_ai');
			expect(summary.disabled).toContain('provider_switching');
			expect(summary.disabled).toContain('mobile_access');
		});
	});

	describe('License Updates', () => {
		test('should upgrade to SuperNova tier with valid license', async () => {
			const supernovaLicense = await licenseValidator.createTestLicense('test@example.com', 'supernova');
			
			await featureManager.updateLicense(supernovaLicense);
			
			expect(featureManager.getCurrentTier()).toBe(FeatureTier.SUPERNOVA);
			expect(featureManager.getCurrentLicense()?.tier).toBe('supernova');
			expect(featureManager.getCurrentLicense()?.email).toBe('test@example.com');
		});

		test('should enable SuperNova features with valid license', async () => {
			const supernovaLicense = await licenseValidator.createTestLicense('test@example.com', 'supernova');
			
			await featureManager.updateLicense(supernovaLicense);
			
			// All Core features should still be enabled
			expect(featureManager.isFeatureEnabled('basic_editing')).toBe(true);
			expect(featureManager.isFeatureEnabled('local_ai_providers')).toBe(true);
			
			// SuperNova features should now be enabled
			expect(featureManager.isFeatureEnabled('unlimited_cloud_ai')).toBe(true);
			expect(featureManager.isFeatureEnabled('provider_switching')).toBe(true);
			expect(featureManager.isFeatureEnabled('mobile_access')).toBe(true);
			expect(featureManager.isFeatureEnabled('advanced_templates')).toBe(true);
			expect(featureManager.isFeatureEnabled('batch_operations')).toBe(true);
			expect(featureManager.isFeatureEnabled('cross_document_context')).toBe(true);
			expect(featureManager.isFeatureEnabled('priority_support')).toBe(true);
		});

		test('should remain Core tier with Core license', async () => {
			const coreLicense = await licenseValidator.createTestLicense('test@example.com', 'core');
			
			await featureManager.updateLicense(coreLicense);
			
			expect(featureManager.getCurrentTier()).toBe(FeatureTier.CORE);
			expect(featureManager.getCurrentLicense()?.tier).toBe('core');
			
			// Core features enabled
			expect(featureManager.isFeatureEnabled('basic_editing')).toBe(true);
			
			// SuperNova features disabled
			expect(featureManager.isFeatureEnabled('unlimited_cloud_ai')).toBe(false);
			expect(featureManager.isFeatureEnabled('provider_switching')).toBe(false);
		});

		test('should fallback to Core tier with invalid license', async () => {
			await featureManager.updateLicense('invalid-license-key');
			
			expect(featureManager.getCurrentTier()).toBe(FeatureTier.CORE);
			expect(featureManager.getCurrentLicense()).toBeNull();
			
			// Should behave like Core tier
			expect(featureManager.isFeatureEnabled('basic_editing')).toBe(true);
			expect(featureManager.isFeatureEnabled('unlimited_cloud_ai')).toBe(false);
		});

		test('should fallback to Core tier with null license', async () => {
			// First set a SuperNova license
			const supernovaLicense = await licenseValidator.createTestLicense('test@example.com', 'supernova');
			await featureManager.updateLicense(supernovaLicense);
			expect(featureManager.getCurrentTier()).toBe(FeatureTier.SUPERNOVA);
			
			// Then clear the license
			await featureManager.updateLicense(null);
			
			expect(featureManager.getCurrentTier()).toBe(FeatureTier.CORE);
			expect(featureManager.getCurrentLicense()).toBeNull();
			expect(featureManager.isFeatureEnabled('unlimited_cloud_ai')).toBe(false);
		});
	});

	describe('Feature Access Checking', () => {
		test('should allow access to Core features', () => {
			const access = featureManager.checkFeatureAccess('basic_editing');
			
			expect(access.allowed).toBe(true);
			expect(access.reason).toBeUndefined();
		});

		test('should block access to SuperNova features in Core tier', () => {
			const access = featureManager.checkFeatureAccess('unlimited_cloud_ai');
			
			expect(access.allowed).toBe(false);
			expect(access.reason).toContain('requires supernova tier');
			expect(access.fallbackBehavior).toBe('prompt_upgrade');
			expect(access.upgradePrompt).toContain('Nova SuperNova');
		});

		test('should allow access to SuperNova features with valid license', async () => {
			const supernovaLicense = await licenseValidator.createTestLicense('test@example.com', 'supernova');
			await featureManager.updateLicense(supernovaLicense);
			
			const access = featureManager.checkFeatureAccess('unlimited_cloud_ai');
			
			expect(access.allowed).toBe(true);
			expect(access.reason).toBeUndefined();
		});

		test('should handle unknown feature keys', () => {
			const access = featureManager.checkFeatureAccess('nonexistent_feature');
			
			expect(access.allowed).toBe(false);
			expect(access.reason).toContain('not found');
		});

		test('should provide appropriate fallback behaviors', () => {
			const promptUpgrade = featureManager.checkFeatureAccess('unlimited_cloud_ai');
			expect(promptUpgrade.fallbackBehavior).toBe('prompt_upgrade');
			
			const limitedUsage = featureManager.checkFeatureAccess('batch_operations');
			expect(limitedUsage.fallbackBehavior).toBe('limited_usage');
			
			const disable = featureManager.checkFeatureAccess('cross_document_context');
			expect(disable.fallbackBehavior).toBe('disable');
		});
	});

	describe('Debug Mode', () => {
		test('should override tier in debug mode', () => {
			featureManager.updateDebugSettings({ 
				enabled: true, 
				overrideTier: 'supernova' 
			});
			
			expect(featureManager.getCurrentTier()).toBe(FeatureTier.SUPERNOVA);
			expect(featureManager.isFeatureEnabled('unlimited_cloud_ai')).toBe(true);
		});

		test('should allow switching between tiers in debug mode', () => {
			// Start with SuperNova override
			featureManager.updateDebugSettings({ 
				enabled: true, 
				overrideTier: 'supernova' 
			});
			expect(featureManager.getCurrentTier()).toBe(FeatureTier.SUPERNOVA);
			
			// Switch to Core override
			featureManager.updateDebugSettings({ 
				enabled: true, 
				overrideTier: 'core' 
			});
			expect(featureManager.getCurrentTier()).toBe(FeatureTier.CORE);
			expect(featureManager.isFeatureEnabled('unlimited_cloud_ai')).toBe(false);
		});

		test('should disable debug mode and use real license', async () => {
			// Set debug mode to SuperNova
			featureManager.updateDebugSettings({ 
				enabled: true, 
				overrideTier: 'supernova' 
			});
			expect(featureManager.getCurrentTier()).toBe(FeatureTier.SUPERNOVA);
			
			// Disable debug mode
			featureManager.updateDebugSettings({ enabled: false });
			expect(featureManager.getCurrentTier()).toBe(FeatureTier.CORE);
		});

		test('should get and set debug settings', () => {
			const settings = { enabled: true, overrideTier: 'supernova' as const };
			featureManager.updateDebugSettings(settings);
			
			const retrieved = featureManager.getDebugSettings();
			expect(retrieved.enabled).toBe(true);
			expect(retrieved.overrideTier).toBe('supernova');
		});
	});

	describe('Feature Management', () => {
		test('should register custom features', () => {
			featureManager.registerFeature({
				key: 'custom_feature',
				requiredTier: FeatureTier.SUPERNOVA,
				enabled: false,
				description: 'Custom test feature'
			});
			
			expect(featureManager.isFeatureEnabled('custom_feature')).toBe(false);
			expect(featureManager.checkFeatureAccess('custom_feature').allowed).toBe(false);
		});

		test('should get features for specific tier', () => {
			const coreFeatures = featureManager.getFeaturesForTier(FeatureTier.CORE);
			const supernovaFeatures = featureManager.getFeaturesForTier(FeatureTier.SUPERNOVA);
			
			expect(coreFeatures.length).toBeGreaterThan(0);
			expect(supernovaFeatures.length).toBeGreaterThan(coreFeatures.length);
			
			// Check that Core features are included in SuperNova
			const coreFeatureKeys = coreFeatures.map(f => f.key);
			const supernovaFeatureKeys = supernovaFeatures.map(f => f.key);
			
			coreFeatureKeys.forEach(key => {
				expect(supernovaFeatureKeys).toContain(key);
			});
		});
	});

	describe('Integration with LicenseValidator', () => {
		test('should work with expired licenses', async () => {
			// Create an expired license manually
			const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
			const issuedAt = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
			
			const email = 'test@example.com';
			const tier = 'supernova';
			const data = `${email}|${tier}|${yesterday.toISOString()}|${issuedAt.toISOString()}`;
			const encoder = new TextEncoder();
			const keyData = encoder.encode('nova-license-signing-key-2025');
			const messageData = encoder.encode(data);
			
			const cryptoKey = await crypto.subtle.importKey(
				'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
			);
			
			const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
			const signatureHex = Array.from(new Uint8Array(signature))
				.map(b => b.toString(16).padStart(2, '0')).join('');
			
			const expiredLicense = btoa(`${email}|${tier}|${yesterday.toISOString()}|${issuedAt.toISOString()}|${signatureHex}`);
			
			await featureManager.updateLicense(expiredLicense);
			
			// Should fall back to Core tier
			expect(featureManager.getCurrentTier()).toBe(FeatureTier.CORE);
			expect(featureManager.getCurrentLicense()).toBeNull();
		});

		test('should work with lifetime licenses', async () => {
			const lifetimeLicense = await licenseValidator.createTestLicense('test@example.com', 'supernova', true);
			
			await featureManager.updateLicense(lifetimeLicense);
			
			expect(featureManager.getCurrentTier()).toBe(FeatureTier.SUPERNOVA);
			expect(featureManager.getCurrentLicense()?.expiresAt).toBeNull();
		});

		test('should work with annual licenses', async () => {
			const annualLicense = await licenseValidator.createTestLicense('test@example.com', 'supernova', false);
			
			await featureManager.updateLicense(annualLicense);
			
			expect(featureManager.getCurrentTier()).toBe(FeatureTier.SUPERNOVA);
			expect(featureManager.getCurrentLicense()?.expiresAt).not.toBeNull();
		});
	});
});