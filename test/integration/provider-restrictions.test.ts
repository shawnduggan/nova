import { AIProviderManager } from '../../src/ai/provider-manager';
import { FeatureManager } from '../../src/licensing/feature-manager';
import { LicenseValidator } from '../../src/licensing/license-validator';
import { NovaSettings, DEFAULT_SETTINGS } from '../../src/settings';

describe('Provider Access in Supernova Model', () => {
    let providerManager: AIProviderManager;
    let featureManager: FeatureManager;
    let licenseValidator: LicenseValidator;
    let settings: NovaSettings;

    beforeEach(() => {
        licenseValidator = new LicenseValidator();
        featureManager = new FeatureManager(licenseValidator);
        settings = { ...DEFAULT_SETTINGS };
        providerManager = new AIProviderManager(settings, featureManager);
    });

    describe('Provider Availability', () => {
        test('should allow all providers for all users', () => {
            // In the Supernova model, all providers are available to all users
            const allowedProviders = providerManager.getAllowedProviders();
            
            expect(allowedProviders).toContain('claude');
            expect(allowedProviders).toContain('openai');
            expect(allowedProviders).toContain('google');
            expect(allowedProviders).toContain('ollama');
        });

        test('should not restrict any provider', () => {
            // No provider should be restricted in the Supernova model
            expect(providerManager.isProviderAllowed('claude')).toBe(true);
            expect(providerManager.isProviderAllowed('openai')).toBe(true);
            expect(providerManager.isProviderAllowed('google')).toBe(true);
            expect(providerManager.isProviderAllowed('ollama')).toBe(true);
        });

        test('should have no provider limits', () => {
            const limits = providerManager.getProviderLimits();
            
            expect(limits.local).toBe(Infinity);
            expect(limits.cloud).toBe(Infinity);
        });
    });

    describe('Supernova Status Impact', () => {
        test('should have same provider access regardless of Supernova status', async () => {
            // Test without Supernova license
            const providersWithoutSupernova = providerManager.getAllowedProviders();
            
            // Add Supernova license
            const catalystLicense = await licenseValidator.createTestSupernovaLicense('test@example.com', 'annual');
            await featureManager.updateSupernovaLicense(catalystLicense);
            
            const providersWithSupernova = providerManager.getAllowedProviders();
            
            // Should be identical - Supernova doesn't affect core provider access
            expect(providersWithSupernova).toEqual(providersWithoutSupernova);
            expect(providersWithSupernova).toContain('claude');
            expect(providersWithSupernova).toContain('openai');
            expect(providersWithSupernova).toContain('google');
            expect(providersWithSupernova).toContain('ollama');
        });

        test('should allow provider switching for all users', () => {
            // Provider switching is a core feature, available to everyone
            expect(featureManager.isFeatureEnabled('provider_switching')).toBe(true);
            
            const providerSwitchingAccess = featureManager.checkFeatureAccess('provider_switching');
            expect(providerSwitchingAccess.allowed).toBe(true);
        });
    });

    describe('Platform-Specific Behavior', () => {
        test('should work on desktop with all providers', async () => {
            // Desktop should have access to all providers including local ones
            settings.platformSettings.desktop.primaryProvider = 'ollama';
            settings.platformSettings.desktop.fallbackProviders = ['claude', 'openai', 'google'];
            
            providerManager.updateSettings(settings);
            
            // Should work without any restrictions
            expect(() => providerManager.updateSettings(settings)).not.toThrow();
        });

        test('should work on mobile with cloud providers', async () => {
            // Mobile should have access to cloud providers
            settings.platformSettings.mobile.primaryProvider = 'claude';
            settings.platformSettings.mobile.fallbackProviders = ['openai', 'google'];
            
            providerManager.updateSettings(settings);
            
            // Should work without any restrictions
            expect(() => providerManager.updateSettings(settings)).not.toThrow();
        });
    });

    describe('Legacy Feature Compatibility', () => {
        test('should treat legacy features as enabled', () => {
            // These were tier-restricted features that are now available to everyone
            expect(featureManager.isFeatureEnabled('unlimited_cloud_ai')).toBe(true);
            expect(featureManager.isFeatureEnabled('mobile_access')).toBe(true);
            expect(featureManager.isFeatureEnabled('provider_switching')).toBe(true);
            expect(featureManager.isFeatureEnabled('advanced_templates')).toBe(true);
            expect(featureManager.isFeatureEnabled('batch_operations')).toBe(true);
            expect(featureManager.isFeatureEnabled('cross_document_context')).toBe(true);
            expect(featureManager.isFeatureEnabled('priority_support')).toBe(true);
        });

        test('should handle legacy access checks gracefully', () => {
            // Old code might check these features - they should all be allowed
            const unlimitedCloudAccess = featureManager.checkFeatureAccess('unlimited_cloud_ai');
            const mobileAccess = featureManager.checkFeatureAccess('mobile_access');
            const providerSwitchingAccess = featureManager.checkFeatureAccess('provider_switching');
            
            expect(unlimitedCloudAccess.allowed).toBe(true);
            expect(mobileAccess.allowed).toBe(true);
            expect(providerSwitchingAccess.allowed).toBe(true);
        });
    });

    describe('Future Feature Gates', () => {
        test('should handle new time-gated features appropriately', () => {
            // These are the new features that will be time-gated for Supernova early access
            expect(featureManager.isFeatureEnabled('command-system')).toBe(false);
            expect(featureManager.isFeatureEnabled('multi-doc-context')).toBe(false);
            expect(featureManager.isFeatureEnabled('enhanced-providers')).toBe(false);
            
            const commandSystemAccess = featureManager.checkFeatureAccess('command-system');
            expect(commandSystemAccess.allowed).toBe(false);
            expect(commandSystemAccess.isSupernovaFeature).toBe(true);
        });

        test('should enable time-gated features for Supernova supporters with debug mode', async () => {
            // Set up Supernova license
            const catalystLicense = await licenseValidator.createTestSupernovaLicense('test@example.com', 'lifetime');
            await featureManager.updateSupernovaLicense(catalystLicense);
            
            // Use debug mode to simulate being at the Supernova release date
            featureManager.updateDebugSettings({
                enabled: true,
                overrideDate: '2025-06-15', // Supernova date
                forceSupernova: true
            });
            
            // Time-gated features should now be available
            expect(featureManager.isFeatureEnabled('command-system')).toBe(true);
            expect(featureManager.isFeatureEnabled('multi-doc-context')).toBe(true);
            expect(featureManager.isFeatureEnabled('enhanced-providers')).toBe(true);
        });
    });
});