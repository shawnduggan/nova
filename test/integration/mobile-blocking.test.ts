import { AIProviderManager } from '../../src/ai/provider-manager';
import { FeatureManager } from '../../src/licensing/feature-manager';
import { LicenseValidator } from '../../src/licensing/license-validator';
import { NovaSettings, DEFAULT_SETTINGS } from '../../src/settings';
import { Platform } from 'obsidian';

// Mock Obsidian Platform
jest.mock('obsidian', () => ({
    Platform: {
        isMobile: false // Will be toggled in tests
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

describe('Mobile Platform Access Integration Tests', () => {
    let aiProviderManager: AIProviderManager;
    let featureManager: FeatureManager;
    let licenseValidator: LicenseValidator;
    let settings: NovaSettings;

    beforeEach(() => {
        licenseValidator = new LicenseValidator();
        featureManager = new FeatureManager(licenseValidator);
        settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
        aiProviderManager = new AIProviderManager(settings, featureManager);
        
        // Reset platform to desktop
        (Platform as any).isMobile = false;
    });

    describe('Desktop Access (Unrestricted)', () => {
        test('should allow Core tier access on desktop', () => {
            (Platform as any).isMobile = false;
            
            const allowedProviders = aiProviderManager.getAllowedProviders();
            expect(allowedProviders.length).toBeGreaterThan(1); // Should have providers
            expect(allowedProviders).toContain('ollama'); // Primary provider
            expect(allowedProviders).toContain('openai'); // First cloud provider
        });

        test('should allow SuperNova tier access on desktop', async () => {
            (Platform as any).isMobile = false;
            
            const supernovaLicense = await licenseValidator.createTestLicense('test@example.com', 'supernova');
            await featureManager.updateLicense(supernovaLicense);
            
            // Recreate manager with SuperNova tier
            aiProviderManager = new AIProviderManager(settings, featureManager);
            
            const allowedProviders = aiProviderManager.getAllowedProviders();
            expect(allowedProviders).toContain('ollama');
            expect(allowedProviders).toContain('openai');
            expect(allowedProviders).toContain('google');
        });
    });

    describe('Mobile Access Restrictions', () => {
        test('should restrict Core tier users on mobile to upgrade interface', () => {
            (Platform as any).isMobile = true;
            
            // Core tier (default)
            expect(featureManager.getCurrentTier()).toBe('core');
            expect(featureManager.isFeatureEnabled('mobile_access')).toBe(false);
            
            const allowedProviders = aiProviderManager.getAllowedProviders();
            expect(allowedProviders).toEqual(['none']); // Only 'none' provider allowed
        });

        test('should allow SuperNova tier users on mobile', async () => {
            (Platform as any).isMobile = true;
            
            const supernovaLicense = await licenseValidator.createTestLicense('test@example.com', 'supernova');
            await featureManager.updateLicense(supernovaLicense);
            
            expect(featureManager.getCurrentTier()).toBe('supernova');
            expect(featureManager.isFeatureEnabled('mobile_access')).toBe(true);
            
            // Recreate manager with SuperNova tier
            aiProviderManager = new AIProviderManager(settings, featureManager);
            
            const allowedProviders = aiProviderManager.getAllowedProviders();
            expect(allowedProviders.length).toBeGreaterThan(1); // Should have real providers
            expect(allowedProviders).not.toEqual(['none']); // Not just 'none'
        });

        test('should validate mobile access feature flag correctly', () => {
            // Core tier mobile check
            (Platform as any).isMobile = true;
            const coreAccess = featureManager.checkFeatureAccess('mobile_access');
            expect(coreAccess.allowed).toBe(false);
            expect(coreAccess.reason).toContain('Feature requires supernova tier');
            expect(coreAccess.fallbackBehavior).toBe('prompt_upgrade');
        });

        test('should show upgrade interface with Core tier on mobile', async () => {
            // Test mobile restrictions with Core tier - plugin loads but shows upgrade interface
            (Platform as any).isMobile = true;
            
            const currentProviderName = await aiProviderManager.getCurrentProviderName();
            expect(currentProviderName).toBe('None'); // No providers available on mobile for Core tier
            
            // Note: Sidebar would show upgrade interface instead of chat interface
            // Backend restrictions remain the same - only UI/UX has changed
        });
    });

    describe('Platform Switching Scenarios', () => {
        test('should handle platform change from desktop to mobile for Core tier', () => {
            // Start on desktop
            (Platform as any).isMobile = false;
            let allowedProviders = aiProviderManager.getAllowedProviders();
            expect(allowedProviders.length).toBeGreaterThan(1);
            
            // Switch to mobile - providers restricted but UI shows upgrade interface
            (Platform as any).isMobile = true;
            allowedProviders = aiProviderManager.getAllowedProviders();
            expect(allowedProviders).toEqual(['none']); // Backend restriction remains
        });

        test('should handle platform change from mobile to desktop for Core tier', () => {
            // Start on mobile - shows upgrade interface
            (Platform as any).isMobile = true;
            let allowedProviders = aiProviderManager.getAllowedProviders();
            expect(allowedProviders).toEqual(['none']);
            
            // Switch to desktop - full functionality restored
            (Platform as any).isMobile = false;
            allowedProviders = aiProviderManager.getAllowedProviders();
            expect(allowedProviders.length).toBeGreaterThan(1); // Should have providers again
        });

        test('should maintain access on platform changes for SuperNova tier', async () => {
            const supernovaLicense = await licenseValidator.createTestLicense('test@example.com', 'supernova');
            await featureManager.updateLicense(supernovaLicense);
            aiProviderManager = new AIProviderManager(settings, featureManager);
            
            // Test desktop access
            (Platform as any).isMobile = false;
            let allowedProviders = aiProviderManager.getAllowedProviders();
            expect(allowedProviders.length).toBeGreaterThan(1);
            
            // Test mobile access (should still work)
            (Platform as any).isMobile = true;
            allowedProviders = aiProviderManager.getAllowedProviders();
            expect(allowedProviders.length).toBeGreaterThan(1);
            expect(allowedProviders).not.toEqual(['none']);
        });
    });

    describe('Feature Flag Integration', () => {
        test('should respect mobile_access feature flag for Core tier', () => {
            const mobileFeature = featureManager.checkFeatureAccess('mobile_access');
            expect(mobileFeature.allowed).toBe(false);
            expect(mobileFeature.upgradePrompt).toContain('Mobile device support');
        });

        test('should enable mobile_access feature flag for SuperNova tier', async () => {
            const supernovaLicense = await licenseValidator.createTestLicense('test@example.com', 'supernova');
            await featureManager.updateLicense(supernovaLicense);
            
            const mobileFeature = featureManager.checkFeatureAccess('mobile_access');
            expect(mobileFeature.allowed).toBe(true);
        });

        test('should handle debug mode override for mobile access', () => {
            // Enable debug mode and override tier
            const debugSettings = { enabled: true, overrideTier: 'supernova' as const };
            featureManager.updateDebugSettings(debugSettings);
            
            expect(featureManager.getCurrentTier()).toBe('supernova');
            expect(featureManager.isFeatureEnabled('mobile_access')).toBe(true);
            
            // Test with mobile platform
            (Platform as any).isMobile = true;
            aiProviderManager = new AIProviderManager(settings, featureManager);
            
            const allowedProviders = aiProviderManager.getAllowedProviders();
            expect(allowedProviders).not.toEqual(['none']); // Should have providers with debug override
        });
    });

    describe('Edge Cases', () => {
        test('should handle undefined feature manager gracefully', () => {
            const managerWithoutFeatures = new AIProviderManager(settings);
            
            // Should not crash and should allow providers (no restrictions when no feature manager)
            (Platform as any).isMobile = true;
            const allowedProviders = managerWithoutFeatures.getAllowedProviders();
            expect(allowedProviders.length).toBeGreaterThan(0); // Should have providers without feature manager
        });

        test('should handle tier changes on mobile platform', async () => {
            (Platform as any).isMobile = true;
            
            // Start as Core tier - shows upgrade interface
            expect(aiProviderManager.getAllowedProviders()).toEqual(['none']);
            
            // Upgrade to SuperNova
            const supernovaLicense = await licenseValidator.createTestLicense('test@example.com', 'supernova');
            await featureManager.updateLicense(supernovaLicense);
            
            // Create new manager instance (simulating app restart or re-initialization)
            aiProviderManager = new AIProviderManager(settings, featureManager);
            
            // Should now have full access (no more upgrade interface)
            const allowedProviders = aiProviderManager.getAllowedProviders();
            expect(allowedProviders).not.toEqual(['none']);
            expect(allowedProviders.length).toBeGreaterThan(1);
        });
    });
});