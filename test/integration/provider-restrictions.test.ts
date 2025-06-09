import { AIProviderManager } from '../../src/ai/provider-manager';
import { FeatureManager } from '../../src/licensing/feature-manager';
import { LicenseValidator } from '../../src/licensing/license-validator';
import { NovaSettings, DEFAULT_SETTINGS } from '../../src/settings';
import { ProviderType } from '../../src/ai/types';
import { Platform } from 'obsidian';

// Mock Obsidian
jest.mock('obsidian', () => ({
    Platform: {
        isMobile: false
    },
    PluginSettingTab: class MockPluginSettingTab {
        constructor(app: any, plugin: any) {}
        display() {}
    },
    Setting: class MockSetting {
        setName() { return this; }
        setDesc() { return this; }
        addText() { return this; }
        addToggle() { return this; }
        addDropdown() { return this; }
        addSlider() { return this; }
    }
}));

describe('Provider Restrictions Integration Tests', () => {
    let aiProviderManager: AIProviderManager;
    let featureManager: FeatureManager;
    let licenseValidator: LicenseValidator;
    let settings: NovaSettings;

    beforeEach(() => {
        licenseValidator = new LicenseValidator();
        featureManager = new FeatureManager(licenseValidator);
        settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
        aiProviderManager = new AIProviderManager(settings, featureManager);
    });

    describe('Core Tier Provider Restrictions', () => {
        test('should limit Core tier to 1 local + 1 cloud provider', () => {
            // Default is Core tier
            const allowedProviders = aiProviderManager.getAllowedProviders();
            const limits = aiProviderManager.getProviderLimits();

            expect(limits.local).toBe(1);
            expect(limits.cloud).toBe(1);

            // Count unique provider types
            const uniqueProviders = [...new Set(allowedProviders)];
            const localProviders = uniqueProviders.filter(p => p === 'ollama');
            const cloudProviders = uniqueProviders.filter(p => ['claude', 'openai', 'google'].includes(p));

            expect(localProviders).toHaveLength(1);
            expect(cloudProviders).toHaveLength(1);
        });

        test('should allow only first configured providers', () => {
            // Default settings have ollama as primary and openai as first fallback cloud
            const allowedProviders = aiProviderManager.getAllowedProviders();
            
            expect(allowedProviders).toContain('ollama'); // Primary local provider
            expect(allowedProviders).toContain('openai'); // First cloud provider in fallbacks
            expect(allowedProviders).not.toContain('google'); // Blocked second cloud
            expect(allowedProviders).not.toContain('claude'); // Not in default settings
        });

        test('should preserve provider priority order', () => {
            // Test with different provider order
            const reorderedSettings: NovaSettings = {
                ...settings,
                platformSettings: {
                    desktop: {
                        primaryProvider: 'google',
                        fallbackProviders: ['openai', 'claude', 'ollama']
                    },
                    mobile: {
                        primaryProvider: 'none',
                        fallbackProviders: []
                    }
                }
            };

            const reorderedManager = new AIProviderManager(reorderedSettings, featureManager);
            const allowedProviders = reorderedManager.getAllowedProviders();

            expect(allowedProviders).toContain('google'); // First cloud provider
            expect(allowedProviders).toContain('ollama'); // Local provider
            expect(allowedProviders).not.toContain('openai'); // Blocked second cloud
            expect(allowedProviders).not.toContain('claude'); // Blocked third cloud
        });

        test('should validate provider selections correctly', () => {
            expect(aiProviderManager.isProviderAllowed('ollama')).toBe(true); // Primary local
            expect(aiProviderManager.isProviderAllowed('openai')).toBe(true); // First cloud
            expect(aiProviderManager.isProviderAllowed('google')).toBe(false); // Second cloud - blocked
            expect(aiProviderManager.isProviderAllowed('claude')).toBe(false); // Not configured
        });
    });

    describe('SuperNova Tier Provider Freedom', () => {
        beforeEach(async () => {
            const supernovaLicense = await licenseValidator.createTestLicense('test@example.com', 'supernova');
            await featureManager.updateLicense(supernovaLicense);
            
            // Recreate manager with SuperNova tier
            aiProviderManager = new AIProviderManager(settings, featureManager);
        });

        test('should allow unlimited providers for SuperNova tier', () => {
            const limits = aiProviderManager.getProviderLimits();
            expect(limits.local).toBe(Infinity);
            expect(limits.cloud).toBe(Infinity);
        });

        test('should allow all configured providers for SuperNova tier', () => {
            const allowedProviders = aiProviderManager.getAllowedProviders();
            
            // SuperNova should allow all providers in the settings
            expect(allowedProviders).toContain('ollama'); // Primary
            expect(allowedProviders).toContain('openai'); // In fallbacks
            expect(allowedProviders).toContain('google'); // In fallbacks
            // claude not in default settings, so won't appear
        });

        test('should validate configured providers as allowed', () => {
            expect(aiProviderManager.isProviderAllowed('ollama')).toBe(true);
            expect(aiProviderManager.isProviderAllowed('openai')).toBe(true);
            expect(aiProviderManager.isProviderAllowed('google')).toBe(true);
            // claude not in default settings
        });
    });

    describe('Provider Type Classification', () => {
        test('should correctly classify local vs cloud providers', () => {
            // Create a custom settings to test classification
            const testSettings: NovaSettings = {
                ...settings,
                platformSettings: {
                    desktop: {
                        primaryProvider: 'ollama',
                        fallbackProviders: ['claude', 'openai', 'google']
                    },
                    mobile: {
                        primaryProvider: 'none',
                        fallbackProviders: []
                    }
                }
            };

            const testManager = new AIProviderManager(testSettings, featureManager);
            const allowedProviders = testManager.getAllowedProviders();

            // Should allow 1 local (ollama) + 1 cloud (claude - first in fallbacks)
            expect(allowedProviders).toContain('ollama');
            expect(allowedProviders).toContain('claude');
            expect(allowedProviders).not.toContain('openai');
            expect(allowedProviders).not.toContain('google');
        });

        test('should handle settings with only cloud providers', () => {
            const cloudOnlySettings: NovaSettings = {
                ...settings,
                platformSettings: {
                    desktop: {
                        primaryProvider: 'claude',
                        fallbackProviders: ['openai', 'google']
                    },
                    mobile: {
                        primaryProvider: 'none',
                        fallbackProviders: []
                    }
                }
            };

            const cloudOnlyManager = new AIProviderManager(cloudOnlySettings, featureManager);
            const allowedProviders = cloudOnlyManager.getAllowedProviders();

            // Should allow only 1 cloud provider (claude), no local providers
            expect(allowedProviders).toContain('claude');
            expect(allowedProviders).not.toContain('openai');
            expect(allowedProviders).not.toContain('google');
            expect(allowedProviders).not.toContain('ollama');
        });

        test('should handle settings with only local providers', () => {
            const localOnlySettings: NovaSettings = {
                ...settings,
                platformSettings: {
                    desktop: {
                        primaryProvider: 'ollama',
                        fallbackProviders: []
                    },
                    mobile: {
                        primaryProvider: 'none',
                        fallbackProviders: []
                    }
                }
            };

            const localOnlyManager = new AIProviderManager(localOnlySettings, featureManager);
            const allowedProviders = localOnlyManager.getAllowedProviders();

            // Should allow only 1 local provider (ollama), no cloud providers
            expect(allowedProviders).toContain('ollama');
            expect(allowedProviders).not.toContain('claude');
            expect(allowedProviders).not.toContain('openai');
            expect(allowedProviders).not.toContain('google');
        });
    });

    describe('Dynamic Tier Changes', () => {
        test('should update restrictions when tier changes', async () => {
            // Start with Core tier restrictions
            expect(aiProviderManager.getProviderLimits().cloud).toBe(1);
            expect(aiProviderManager.isProviderAllowed('google')).toBe(false); // Second cloud provider blocked

            // Upgrade to SuperNova
            const supernovaLicense = await licenseValidator.createTestLicense('test@example.com', 'supernova');
            await featureManager.updateLicense(supernovaLicense);

            // Create new manager with updated feature manager
            aiProviderManager = new AIProviderManager(settings, featureManager);

            // Should now allow unlimited providers
            expect(aiProviderManager.getProviderLimits().cloud).toBe(Infinity);
            expect(aiProviderManager.isProviderAllowed('google')).toBe(true); // Now allowed
        });

        test('should downgrade restrictions when license expires', async () => {
            // Start with SuperNova license
            const supernovaLicense = await licenseValidator.createTestLicense('test@example.com', 'supernova');
            await featureManager.updateLicense(supernovaLicense);
            aiProviderManager = new AIProviderManager(settings, featureManager);
            
            expect(aiProviderManager.isProviderAllowed('google')).toBe(true);

            // Simulate license expiration by clearing license
            await featureManager.updateLicense(null);
            aiProviderManager = new AIProviderManager(settings, featureManager);

            // Should revert to Core tier restrictions
            expect(aiProviderManager.getProviderLimits().cloud).toBe(1);
            expect(aiProviderManager.isProviderAllowed('google')).toBe(false); // Back to blocked
        });
    });

    describe('Edge Cases', () => {
        test('should handle empty provider lists gracefully', () => {
            const emptySettings: NovaSettings = {
                ...settings,
                platformSettings: {
                    desktop: {
                        primaryProvider: 'none',
                        fallbackProviders: []
                    },
                    mobile: {
                        primaryProvider: 'none',
                        fallbackProviders: []
                    }
                }
            };

            const emptyManager = new AIProviderManager(emptySettings, featureManager);
            const allowedProviders = emptyManager.getAllowedProviders();

            expect(allowedProviders).toContain('none');
            expect(allowedProviders).toHaveLength(1);
        });

        test('should handle manager without feature manager', () => {
            const managerWithoutFeatures = new AIProviderManager(settings);
            
            // Should not apply restrictions without feature manager
            expect(() => managerWithoutFeatures.getAllowedProviders()).not.toThrow();
            expect(() => managerWithoutFeatures.getProviderLimits()).not.toThrow();
        });

        test('should maintain none provider in allowed list', () => {
            const settingsWithNone: NovaSettings = {
                ...settings,
                platformSettings: {
                    desktop: {
                        primaryProvider: 'none',
                        fallbackProviders: ['claude', 'openai', 'google', 'ollama']
                    },
                    mobile: {
                        primaryProvider: 'none',
                        fallbackProviders: []
                    }
                }
            };

            const managerWithNone = new AIProviderManager(settingsWithNone, featureManager);
            const allowedProviders = managerWithNone.getAllowedProviders();

            expect(allowedProviders).toContain('none');
            expect(allowedProviders).toContain('claude'); // First cloud provider
            expect(allowedProviders).toContain('ollama'); // Local provider
        });
    });
});