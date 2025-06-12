import { AIProviderManager } from '../../src/ai/provider-manager';
import { FeatureManager } from '../../src/licensing/feature-manager';
import { LicenseValidator } from '../../src/licensing/license-validator';
import { NovaSettings, DEFAULT_SETTINGS } from '../../src/settings';
import { ProviderType } from '../../src/ai/types';

describe('Provider Switching in Supernova Model', () => {
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

    describe('Provider Switching Access', () => {
        test('should allow provider switching for all users', () => {
            // Provider switching is now a core feature available to everyone
            expect(featureManager.isFeatureEnabled('provider_switching')).toBe(true);
            
            const access = featureManager.checkFeatureAccess('provider_switching');
            expect(access.allowed).toBe(true);
        });

        test('should not have tier-based restrictions', () => {
            // No user should be restricted from provider switching
            const access = featureManager.checkFeatureAccess('provider_switching');
            
            expect(access.allowed).toBe(true);
            expect(access.reason).toBeUndefined();
        });
    });

    describe('Provider Configuration', () => {
        test('should allow configuration of any provider', async () => {
            const providers: ProviderType[] = ['claude', 'openai', 'google', 'ollama'];
            
            for (const provider of providers) {
                settings.platformSettings.desktop.primaryProvider = provider;
                
                // Should not throw any errors
                expect(() => {
                    providerManager.updateSettings(settings);
                }).not.toThrow();
                
                // Should be allowed
                expect(providerManager.isProviderAllowed(provider)).toBe(true);
            }
        });

        test('should handle multiple providers simultaneously', () => {
            // Configure multiple providers
            settings.platformSettings.desktop.primaryProvider = 'claude';
            settings.platformSettings.desktop.fallbackProviders = ['openai', 'google', 'ollama'];
            settings.platformSettings.mobile.primaryProvider = 'openai';
            settings.platformSettings.mobile.fallbackProviders = ['claude', 'google'];
            
            expect(() => {
                providerManager.updateSettings(settings);
            }).not.toThrow();
            
            // All should be allowed
            expect(providerManager.isProviderAllowed('claude')).toBe(true);
            expect(providerManager.isProviderAllowed('openai')).toBe(true);
            expect(providerManager.isProviderAllowed('google')).toBe(true);
            expect(providerManager.isProviderAllowed('ollama')).toBe(true);
        });
    });

    describe('Cross-Platform Provider Switching', () => {
        test('should allow different providers on different platforms', () => {
            // Desktop with local provider
            settings.platformSettings.desktop.primaryProvider = 'ollama';
            settings.platformSettings.desktop.fallbackProviders = ['claude', 'openai'];
            
            // Mobile with cloud provider
            settings.platformSettings.mobile.primaryProvider = 'claude';
            settings.platformSettings.mobile.fallbackProviders = ['openai', 'google'];
            
            expect(() => {
                providerManager.updateSettings(settings);
            }).not.toThrow();
        });

        test('should work regardless of Supernova status', async () => {
            // Test without Supernova license
            settings.platformSettings.desktop.primaryProvider = 'claude';
            providerManager.updateSettings(settings);
            expect(providerManager.isProviderAllowed('claude')).toBe(true);
            
            // Test with Supernova license
            const catalystLicense = await licenseValidator.createTestSupernovaLicense('test@example.com', 'annual');
            await featureManager.updateSupernovaLicense(catalystLicense);
            
            settings.platformSettings.desktop.primaryProvider = 'openai';
            providerManager.updateSettings(settings);
            expect(providerManager.isProviderAllowed('openai')).toBe(true);
            
            // Both should work the same way
            expect(providerManager.isProviderAllowed('claude')).toBe(true);
            expect(providerManager.isProviderAllowed('openai')).toBe(true);
        });
    });

    describe('Provider Availability Checks', () => {
        test('should return all providers as available', () => {
            const allowedProviders = providerManager.getAllowedProviders();
            
            expect(allowedProviders).toEqual(['claude', 'openai', 'google', 'ollama']);
        });

        test('should have unlimited provider limits', () => {
            const limits = providerManager.getProviderLimits();
            
            expect(limits.local).toBe(Infinity);
            expect(limits.cloud).toBe(Infinity);
        });
    });

    describe('Legacy Compatibility', () => {
        test('should handle legacy provider restriction checks', () => {
            // These features were previously restricted but should now be available
            expect(featureManager.isFeatureEnabled('unlimited_cloud_ai')).toBe(true);
            expect(featureManager.isFeatureEnabled('provider_switching')).toBe(true);
            
            const unlimitedAccess = featureManager.checkFeatureAccess('unlimited_cloud_ai');
            const switchingAccess = featureManager.checkFeatureAccess('provider_switching');
            
            expect(unlimitedAccess.allowed).toBe(true);
            expect(switchingAccess.allowed).toBe(true);
        });

        test('should not have fallback behavior restrictions', () => {
            // Old tier system had fallback behaviors like 'prompt_upgrade'
            // These should no longer exist
            const access = featureManager.checkFeatureAccess('provider_switching');
            
            expect(access.allowed).toBe(true);
            expect(access.reason).toBeUndefined();
        });
    });

    describe('Future Feature Integration', () => {
        test('should support future enhanced provider features', () => {
            // Enhanced provider management is a time-gated feature
            expect(featureManager.isFeatureEnabled('enhanced-providers')).toBe(false);
            
            const access = featureManager.checkFeatureAccess('enhanced-providers');
            expect(access.isSupernovaFeature).toBe(true);
            expect(access.allowed).toBe(false);
        });

        test('should enable enhanced features for Supernova supporters', async () => {
            // Set up Supernova license
            const catalystLicense = await licenseValidator.createTestSupernovaLicense('test@example.com', 'lifetime');
            await featureManager.updateSupernovaLicense(catalystLicense);
            
            // Use debug mode to simulate being at the Supernova release date
            featureManager.updateDebugSettings({
                enabled: true,
                overrideDate: '2025-06-15', // Supernova early access date
                forceSupernova: true
            });
            
            // Enhanced provider features should be available
            expect(featureManager.isFeatureEnabled('enhanced-providers')).toBe(true);
        });
    });

    describe('Error Handling', () => {
        test('should handle invalid provider types gracefully', () => {
            // Try to set an invalid provider
            const invalidProvider = 'invalid-provider' as ProviderType;
            
            // The provider manager should handle this gracefully
            expect(providerManager.isProviderAllowed(invalidProvider)).toBe(true); // Returns true for unknown providers in Supernova model
        });

        test('should handle provider switching when no providers are configured', () => {
            // Clear all provider configurations
            settings.aiProviders.claude.apiKey = '';
            settings.aiProviders.openai.apiKey = '';
            settings.aiProviders.google.apiKey = '';
            settings.aiProviders.ollama.baseUrl = '';
            
            providerManager.updateSettings(settings);
            
            // Should still be allowed to switch, even if not configured
            expect(featureManager.isFeatureEnabled('provider_switching')).toBe(true);
        });
    });
});