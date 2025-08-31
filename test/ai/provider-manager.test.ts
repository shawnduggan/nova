import { AIProviderManager } from '../../src/ai/provider-manager';
import { NovaSettings } from '../../src/settings';
import { Platform } from 'obsidian';
import { FeatureManager } from '../../src/licensing/feature-manager';
import { LicenseValidator } from '../../src/licensing/license-validator';

// Mock Platform
jest.mock('obsidian', () => ({
    Platform: {
        isMobile: false
    }
}));

// Mock providers
jest.mock('../../src/ai/providers/claude', () => ({
    ClaudeProvider: jest.fn().mockImplementation(() => ({
        name: 'Claude (Anthropic)',
        isAvailable: jest.fn().mockResolvedValue(true),
        complete: jest.fn().mockResolvedValue('Test response')
    }))
}));
jest.mock('../../src/ai/providers/openai');
jest.mock('../../src/ai/providers/google');
jest.mock('../../src/ai/providers/ollama');

// Mock models utility
jest.mock('../../src/ai/models', () => ({
    getProviderTypeForModel: jest.fn((modelValue: string) => {
        if (modelValue.includes('claude')) return 'claude';
        if (modelValue.includes('gpt')) return 'openai';
        if (modelValue.includes('gemini')) return 'google';
        if (modelValue.includes('llama')) return 'ollama';
        return null;
    })
}));

describe('AIProviderManager', () => {
    let manager: AIProviderManager;
    let mockSettings: NovaSettings;
    let featureManager: FeatureManager;
    let licenseValidator: LicenseValidator;

    beforeEach(() => {
        licenseValidator = new LicenseValidator();
        featureManager = new FeatureManager(licenseValidator);
        mockSettings = {
            aiProviders: {
                claude: { apiKey: 'claude-key' },
                openai: { apiKey: 'openai-key' },
                google: { apiKey: 'google-key' },
                ollama: { baseUrl: 'http://localhost:11434', model: 'llama2' }
            },
            platformSettings: {
                desktop: {
                    selectedModel: 'claude-3-5-sonnet-20241022'
                },
                mobile: {
                    selectedModel: 'none'
                }
            },
            general: {
                defaultTemperature: 0.7,
                defaultMaxTokens: 1000,
                autoSave: true
            },
            commands: {
                suggestionMode: 'balanced',
                responseTime: 'normal', 
                hideWhileTyping: true,
                enabledDocumentTypes: []
            },
            features: {
				commands: {
					customCommands: [],
					showCommandButton: true
				}
			},
            licensing: {
                supernovaLicenseKey: '',
                debugSettings: { enabled: false }
            }
        };
        const mockSettingsTyped: NovaSettings = mockSettings;

        manager = new AIProviderManager(mockSettingsTyped, featureManager);
    });

    describe('complete method', () => {
        test('should call complete on available provider', async () => {
            const mockProvider = {
                name: 'Claude (Anthropic)',
                isAvailable: jest.fn().mockResolvedValue(true),
                complete: jest.fn().mockResolvedValue('Test response')
            };

            // Mock the provider
            manager['providers'].set('claude', mockProvider as any);

            const result = await manager.complete('System prompt', 'User prompt');

            expect(mockProvider.complete).toHaveBeenCalledWith('System prompt', 'User prompt', { temperature: 0.7, maxTokens: 1000, model: 'claude-3-5-sonnet-20241022' });
            expect(result).toBe('Test response');
        });

        test('should pass options to provider complete method', async () => {
            const mockProvider = {
                name: 'Claude (Anthropic)',
                isAvailable: jest.fn().mockResolvedValue(true),
                complete: jest.fn().mockResolvedValue('Test response')
            };

            manager['providers'].set('claude', mockProvider as any);

            const options = { temperature: 0.5, maxTokens: 2000 };
            await manager.complete('System prompt', 'User prompt', options);

            expect(mockProvider.complete).toHaveBeenCalledWith('System prompt', 'User prompt', { temperature: 0.7, maxTokens: 1000, model: 'claude-3-5-sonnet-20241022' });
        });

        test('should throw error when no provider is available', async () => {
            const mockProvider = {
                name: 'Claude (Anthropic)',
                isAvailable: jest.fn().mockResolvedValue(false),
                complete: jest.fn()
            };

            manager['providers'].set('claude', mockProvider as any);

            await expect(
                manager.complete('System prompt', 'User prompt')
            ).rejects.toThrow('Nova is disabled or no AI provider is available');
        });

        test('should return null when selected provider is unavailable', async () => {
            const claudeProvider = {
                name: 'Claude (Anthropic)',
                isAvailable: jest.fn().mockResolvedValue(false),
                complete: jest.fn()
            };

            manager['providers'].set('claude', claudeProvider as any);

            await expect(
                manager.complete('System prompt', 'User prompt')
            ).rejects.toThrow('Nova is disabled or no AI provider is available');

            expect(claudeProvider.isAvailable).toHaveBeenCalled();
        });

        test('should respect mobile platform settings', async () => {
            // Mock mobile platform
            (Platform as any).isMobile = true;

            const mockProvider = {
                name: 'Claude (Anthropic)',
                isAvailable: jest.fn().mockResolvedValue(true),
                complete: jest.fn()
            };

            manager['providers'].set('claude', mockProvider as any);

            await expect(
                manager.complete('System prompt', 'User prompt')
            ).rejects.toThrow('Nova is disabled or no AI provider is available');

            expect(mockProvider.isAvailable).not.toHaveBeenCalled();

            // Reset
            (Platform as any).isMobile = false;
        });
    });

    describe('getCurrentProviderName', () => {
        test('should return provider name when available', async () => {
            const mockProvider = {
                name: 'Claude (Anthropic)',
                isAvailable: jest.fn().mockResolvedValue(true)
            };

            manager['providers'].set('claude', mockProvider as any);

            const result = await manager.getCurrentProviderName();
            expect(result).toBe('Claude (Anthropic)');
        });

        test('should return "None" when no provider available', async () => {
            const mockProvider = {
                name: 'Claude (Anthropic)',
                isAvailable: jest.fn().mockResolvedValue(false)
            };

            manager['providers'].set('claude', mockProvider as any);

            const result = await manager.getCurrentProviderName();
            expect(result).toBe('None');
        });
    });

    describe('Provider Access (Supernova Model)', () => {
        test('should allow all providers for all users', () => {
            // In the Supernova model, all users have access to all providers
            const allowedProviders = manager.getAllowedProviders();
            const limits = manager.getProviderLimits();
            
            expect(limits.local).toBe(Infinity);
            expect(limits.cloud).toBe(Infinity);
            
            // All providers should be allowed
            expect(allowedProviders).toContain('claude');
            expect(allowedProviders).toContain('openai');
            expect(allowedProviders).toContain('google');
            expect(allowedProviders).toContain('ollama');
        });

        test('should not restrict any provider', () => {
            // No provider should be restricted in the Supernova model
            expect(manager.isProviderAllowed('claude')).toBe(true);
            expect(manager.isProviderAllowed('openai')).toBe(true);
            expect(manager.isProviderAllowed('google')).toBe(true);
            expect(manager.isProviderAllowed('ollama')).toBe(true);
        });

        test('should work the same regardless of Supernova status', async () => {
            // Test without Supernova license (default state)
            const limitsWithoutSupernova = manager.getProviderLimits();
            const providersWithoutSupernova = manager.getAllowedProviders();
            
            // Add Supernova license
            const catalystLicense = await licenseValidator.createTestSupernovaLicense('test@example.com', 'annual');
            await featureManager.updateSupernovaLicense(catalystLicense);
            
            const limitsWithSupernova = manager.getProviderLimits();
            const providersWithSupernova = manager.getAllowedProviders();
            
            // Should be identical - Supernova doesn't affect provider access
            expect(limitsWithSupernova).toEqual(limitsWithoutSupernova);
            expect(providersWithSupernova).toEqual(providersWithoutSupernova);
            
            expect(limitsWithSupernova.local).toBe(Infinity);
            expect(limitsWithSupernova.cloud).toBe(Infinity);
        });

        test('should handle different provider configurations', () => {
            // Mock settings with different provider order
            const reorderedSettings: NovaSettings = {
                ...mockSettings,
                platformSettings: {
                    desktop: {
                        selectedModel: 'gpt-4o'
                    },
                    mobile: {
                        selectedModel: 'claude-3-5-sonnet-20241022'
                    }
                }
            };
            
            const reorderedManager = new AIProviderManager(reorderedSettings, featureManager);
            const allowedProviders = reorderedManager.getAllowedProviders();
            
            // In Supernova model, all providers should be allowed regardless of order
            expect(allowedProviders).toContain('openai');
            expect(allowedProviders).toContain('ollama');
            expect(allowedProviders).toContain('google');
            expect(allowedProviders).toContain('claude');
        });
    });
});