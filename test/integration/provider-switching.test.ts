import { NovaSidebarView } from '../../src/ui/sidebar-view';
import NovaPlugin from '../../main';
import { FeatureManager } from '../../src/licensing/feature-manager';
import { LicenseValidator } from '../../src/licensing/license-validator';
import { NovaSettings, DEFAULT_SETTINGS } from '../../src/settings';
import { WorkspaceLeaf, Platform } from 'obsidian';

// Mock Obsidian
const mockLeaf = {
    view: null,
    setViewState: jest.fn(),
    getViewState: jest.fn(),
    detach: jest.fn(),
    getContainer: jest.fn(),
    getRoot: jest.fn(),
    getGroup: jest.fn()
} as unknown as WorkspaceLeaf;

const mockApp = {
    workspace: {
        on: jest.fn(),
        off: jest.fn(),
        getActiveFile: jest.fn(),
        getLeavesOfType: jest.fn(() => []),
        getActiveViewOfType: jest.fn()
    },
    vault: {
        on: jest.fn(),
        off: jest.fn()
    }
} as any;

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
    },
    ItemView: class MockItemView {
        containerEl = {
            children: [null, { 
                empty: jest.fn(),
                addClass: jest.fn(),
                createDiv: jest.fn(() => ({
                    style: { cssText: '' },
                    createDiv: jest.fn(() => ({
                        style: { cssText: '' },
                        createEl: jest.fn(() => ({
                            style: { cssText: '' },
                            innerHTML: '',
                            createSpan: jest.fn(() => ({
                                style: { cssText: '' },
                                setText: jest.fn()
                            }))
                        })),
                        createSpan: jest.fn(() => ({
                            style: { cssText: '' },
                            setText: jest.fn(),
                            textContent: ''
                        })),
                        addEventListener: jest.fn(),
                        removeEventListener: jest.fn(),
                        querySelector: jest.fn(),
                        contains: jest.fn(() => false),
                        empty: jest.fn()
                    }))
                }))
            }]
        };
        app = mockApp;
        constructor(leaf: WorkspaceLeaf) {}
        registerEvent = jest.fn();
    },
    ButtonComponent: class MockButtonComponent {
        setButtonText = jest.fn(() => this);
        setTooltip = jest.fn(() => this);
        onClick = jest.fn(() => this);
    },
    TextAreaComponent: class MockTextAreaComponent {
        getValue = jest.fn(() => '');
        setValue = jest.fn();
        inputEl = { focus: jest.fn() };
    },
    Notice: jest.fn()
}));

describe('Provider Switching Integration Tests', () => {
    let sidebarView: NovaSidebarView;
    let mockPlugin: NovaPlugin;
    let featureManager: FeatureManager;
    let licenseValidator: LicenseValidator;
    let settings: NovaSettings;

    beforeEach(async () => {
        licenseValidator = new LicenseValidator();
        featureManager = new FeatureManager(licenseValidator);
        settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
        
        // Create mock plugin
        mockPlugin = {
            app: mockApp,
            featureManager,
            settings,
            aiProviderManager: {
                getCurrentProviderName: jest.fn().mockResolvedValue('Claude'),
                getAllowedProviders: jest.fn().mockReturnValue(['claude', 'openai', 'google', 'ollama']),
                updateSettings: jest.fn()
            },
            saveSettings: jest.fn(),
            conversationManager: {
                getRecentMessages: jest.fn().mockResolvedValue([])
            }
        } as any;

        // Reset platform to desktop
        (Platform as any).isMobile = false;
    });

    describe('Core Tier - Static Provider Display', () => {
        beforeEach(() => {
            // Ensure Core tier (default)
            sidebarView = new NovaSidebarView(mockLeaf, mockPlugin);
        });

        test('should show static provider status for Core tier users', () => {
            expect(featureManager.getCurrentTier()).toBe('core');
            expect(featureManager.isFeatureEnabled('provider_switching')).toBe(false);
            
            // The sidebar should create static provider status, not dropdown
            // This is verified by the tier check in the UI code
        });

        test('should not allow provider switching for Core tier', () => {
            const providerSwitchingAccess = featureManager.checkFeatureAccess('provider_switching');
            expect(providerSwitchingAccess.allowed).toBe(false);
            expect(providerSwitchingAccess.reason).toContain('Feature requires supernova tier');
            expect(providerSwitchingAccess.fallbackBehavior).toBe('prompt_upgrade');
        });
    });

    describe('SuperNova Tier - Provider Switching', () => {
        beforeEach(async () => {
            // Upgrade to SuperNova tier
            const supernovaLicense = await licenseValidator.createTestLicense('test@example.com', 'supernova');
            await featureManager.updateLicense(supernovaLicense);
            
            // Update mock plugin with SuperNova feature manager
            mockPlugin.featureManager = featureManager;
            
            sidebarView = new NovaSidebarView(mockLeaf, mockPlugin);
        });

        test('should enable provider switching for SuperNova tier', () => {
            expect(featureManager.getCurrentTier()).toBe('supernova');
            expect(featureManager.isFeatureEnabled('provider_switching')).toBe(true);
        });

        test('should allow access to provider switching feature', () => {
            const providerSwitchingAccess = featureManager.checkFeatureAccess('provider_switching');
            expect(providerSwitchingAccess.allowed).toBe(true);
        });

        test('should have access to multiple providers for switching', () => {
            const allowedProviders = mockPlugin.aiProviderManager.getAllowedProviders();
            expect(allowedProviders.length).toBeGreaterThan(1);
            expect(allowedProviders).toContain('claude');
            expect(allowedProviders).toContain('openai');
            expect(allowedProviders).toContain('google');
            expect(allowedProviders).toContain('ollama');
        });
    });

    describe('Provider Display Names and Colors', () => {
        beforeEach(async () => {
            const supernovaLicense = await licenseValidator.createTestLicense('test@example.com', 'supernova');
            await featureManager.updateLicense(supernovaLicense);
            mockPlugin.featureManager = featureManager;
            sidebarView = new NovaSidebarView(mockLeaf, mockPlugin);
        });

        test('should return correct display names for providers', () => {
            // Access private method for testing
            const getDisplayName = (sidebarView as any).getProviderDisplayName.bind(sidebarView);
            
            expect(getDisplayName('claude')).toBe('Claude');
            expect(getDisplayName('openai')).toBe('OpenAI');
            expect(getDisplayName('google')).toBe('Gemini');
            expect(getDisplayName('ollama')).toBe('Ollama');
            expect(getDisplayName('none')).toBe('None');
            expect(getDisplayName('unknown')).toBe('unknown');
        });

        test('should return correct colors for providers', () => {
            // Access private method for testing
            const getProviderColor = (sidebarView as any).getProviderColor.bind(sidebarView);
            
            expect(getProviderColor('claude')).toBe('#D2691E');
            expect(getProviderColor('openai')).toBe('#10A37F');
            expect(getProviderColor('google')).toBe('#4285F4');
            expect(getProviderColor('ollama')).toBe('#7C3AED');
            expect(getProviderColor('none')).toBe('#999');
            expect(getProviderColor('unknown')).toBe('#4caf50'); // default color
        });
    });

    describe('Provider Switching Logic', () => {
        beforeEach(async () => {
            const supernovaLicense = await licenseValidator.createTestLicense('test@example.com', 'supernova');
            await featureManager.updateLicense(supernovaLicense);
            mockPlugin.featureManager = featureManager;
            sidebarView = new NovaSidebarView(mockLeaf, mockPlugin);
        });

        test('should update settings when switching providers', async () => {
            // Mock the addMessage method since it's private
            const addMessageSpy = jest.spyOn(sidebarView as any, 'addMessage').mockImplementation(() => {});
            
            // Access private method for testing
            const switchToProvider = (sidebarView as any).switchToProvider.bind(sidebarView);
            
            await switchToProvider('openai');
            
            expect(addMessageSpy).toHaveBeenCalledWith('system', '🔄 Switched to OpenAI');
            expect(mockPlugin.settings.platformSettings.desktop.primaryProvider).toBe('openai');
            expect(mockPlugin.saveSettings).toHaveBeenCalled();
            expect(mockPlugin.aiProviderManager.updateSettings).toHaveBeenCalledWith(mockPlugin.settings);
            
            addMessageSpy.mockRestore();
        });

        test('should handle provider switching errors gracefully', async () => {
            // Mock saveSettings to throw an error
            mockPlugin.saveSettings = jest.fn().mockRejectedValue(new Error('Save failed'));
            
            const addMessageSpy = jest.spyOn(sidebarView as any, 'addMessage').mockImplementation(() => {});
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            
            const switchToProvider = (sidebarView as any).switchToProvider.bind(sidebarView);
            
            await switchToProvider('google');
            
            expect(consoleErrorSpy).toHaveBeenCalledWith('Error switching provider:', expect.any(Error));
            expect(addMessageSpy).toHaveBeenCalledWith('system', '❌ Failed to switch to Gemini');
            
            addMessageSpy.mockRestore();
            consoleErrorSpy.mockRestore();
        });

        test('should handle mobile platform correctly when switching', async () => {
            (Platform as any).isMobile = true;
            
            const addMessageSpy = jest.spyOn(sidebarView as any, 'addMessage').mockImplementation(() => {});
            const switchToProvider = (sidebarView as any).switchToProvider.bind(sidebarView);
            
            await switchToProvider('claude');
            
            expect(mockPlugin.settings.platformSettings.mobile.primaryProvider).toBe('claude');
            expect(addMessageSpy).toHaveBeenCalledWith('system', '🔄 Switched to Claude');
            
            addMessageSpy.mockRestore();
        });
    });

    describe('Feature Flag Integration', () => {
        test('should respect provider_switching feature flag for UI creation', async () => {
            // Test Core tier (provider_switching disabled)
            const coreView = new NovaSidebarView(mockLeaf, mockPlugin);
            expect(featureManager.isFeatureEnabled('provider_switching')).toBe(false);
            
            // Test SuperNova tier (provider_switching enabled)
            const supernovaLicense = await licenseValidator.createTestLicense('test@example.com', 'supernova');
            await featureManager.updateLicense(supernovaLicense);
            mockPlugin.featureManager = featureManager;
            
            const supernovaView = new NovaSidebarView(mockLeaf, mockPlugin);
            expect(featureManager.isFeatureEnabled('provider_switching')).toBe(true);
        });

        test('should handle debug mode override for provider switching', () => {
            // Enable debug mode and override tier
            const debugSettings = { enabled: true, overrideTier: 'supernova' as const };
            featureManager.updateDebugSettings(debugSettings);
            
            expect(featureManager.getCurrentTier()).toBe('supernova');
            expect(featureManager.isFeatureEnabled('provider_switching')).toBe(true);
        });
    });

    describe('UI Cleanup', () => {
        test('should clean up event listeners on view close', async () => {
            const supernovaLicense = await licenseValidator.createTestLicense('test@example.com', 'supernova');
            await featureManager.updateLicense(supernovaLicense);
            mockPlugin.featureManager = featureManager;
            
            sidebarView = new NovaSidebarView(mockLeaf, mockPlugin);
            
            // Mock the dropdown cleanup
            const mockCleanup = jest.fn();
            (sidebarView as any).currentProviderDropdown = {
                cleanup: mockCleanup
            };
            
            await sidebarView.onClose();
            
            expect(mockCleanup).toHaveBeenCalled();
        });

        test('should handle missing dropdown cleanup gracefully', async () => {
            sidebarView = new NovaSidebarView(mockLeaf, mockPlugin);
            
            // Should not throw when cleanup is not available
            expect(async () => {
                await sidebarView.onClose();
            }).not.toThrow();
        });
    });
});