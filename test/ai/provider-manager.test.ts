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
jest.mock('../../src/ai/providers/claude');
jest.mock('../../src/ai/providers/openai');
jest.mock('../../src/ai/providers/google');
jest.mock('../../src/ai/providers/ollama');

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
                    primaryProvider: 'claude',
                    fallbackProviders: ['openai', 'google', 'ollama']
                },
                mobile: {
                    primaryProvider: 'none',
                    fallbackProviders: []
                }
            },
            general: {
                defaultTemperature: 0.7,
                defaultMaxTokens: 1000,
                autoSave: true
            },
            licensing: {
                licenseKey: '',
                debugSettings: {
                    enabled: false
                }
            }
        } as NovaSettings;

        manager = new AIProviderManager(mockSettings, featureManager);
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

            expect(mockProvider.complete).toHaveBeenCalledWith('System prompt', 'User prompt', undefined);
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

            expect(mockProvider.complete).toHaveBeenCalledWith('System prompt', 'User prompt', options);
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

        test('should try fallback providers when primary is unavailable', async () => {
            const claudeProvider = {
                name: 'Claude (Anthropic)',
                isAvailable: jest.fn().mockResolvedValue(false),
                complete: jest.fn()
            };

            const ollamaProvider = {
                name: 'Ollama',
                isAvailable: jest.fn().mockResolvedValue(true),
                complete: jest.fn().mockResolvedValue('Ollama response')
            };

            manager['providers'].set('claude', claudeProvider as any);
            manager['providers'].set('ollama', ollamaProvider as any);

            const result = await manager.complete('System prompt', 'User prompt');

            expect(claudeProvider.isAvailable).toHaveBeenCalled();
            expect(ollamaProvider.isAvailable).toHaveBeenCalled();
            expect(ollamaProvider.complete).toHaveBeenCalledWith('System prompt', 'User prompt', undefined);
            expect(result).toBe('Ollama response');
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

    describe('Provider Access (Catalyst Model)', () => {
        test('should allow all providers for all users', () => {
            // In the Catalyst model, all users have access to all providers
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
            // No provider should be restricted in the Catalyst model
            expect(manager.isProviderAllowed('claude')).toBe(true);
            expect(manager.isProviderAllowed('openai')).toBe(true);
            expect(manager.isProviderAllowed('google')).toBe(true);
            expect(manager.isProviderAllowed('ollama')).toBe(true);
        });

        test('should work the same regardless of Catalyst status', async () => {
            // Test without Catalyst license (default state)
            const limitsWithoutCatalyst = manager.getProviderLimits();
            const providersWithoutCatalyst = manager.getAllowedProviders();
            
            // Add Catalyst license
            const catalystLicense = await licenseValidator.createTestCatalystLicense('test@example.com', 'annual');
            await featureManager.updateCatalystLicense(catalystLicense);
            
            const limitsWithCatalyst = manager.getProviderLimits();
            const providersWithCatalyst = manager.getAllowedProviders();
            
            // Should be identical - Catalyst doesn't affect provider access
            expect(limitsWithCatalyst).toEqual(limitsWithoutCatalyst);
            expect(providersWithCatalyst).toEqual(providersWithoutCatalyst);
            
            expect(limitsWithCatalyst.local).toBe(Infinity);
            expect(limitsWithCatalyst.cloud).toBe(Infinity);
        });

        test('should handle different provider configurations', () => {
            // Mock settings with different provider order
            const reorderedSettings: NovaSettings = {
                ...mockSettings,
                platformSettings: {
                    desktop: {
                        primaryProvider: 'openai',
                        fallbackProviders: ['google', 'claude', 'ollama']
                    },
                    mobile: {
                        primaryProvider: 'claude',
                        fallbackProviders: ['openai', 'google']
                    }
                }
            };
            
            const reorderedManager = new AIProviderManager(reorderedSettings, featureManager);
            const allowedProviders = reorderedManager.getAllowedProviders();
            
            // In Catalyst model, all providers should be allowed regardless of order
            expect(allowedProviders).toContain('openai');
            expect(allowedProviders).toContain('ollama');
            expect(allowedProviders).toContain('google');
            expect(allowedProviders).toContain('claude');
        });
    });
});