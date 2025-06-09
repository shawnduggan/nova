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

    describe('Provider Restrictions (Core Tier)', () => {
        test('should limit Core tier to 1 local + 1 cloud provider', () => {
            // Core tier by default
            const allowedProviders = manager.getAllowedProviders();
            const limits = manager.getProviderLimits();
            
            expect(limits.local).toBe(1);
            expect(limits.cloud).toBe(1);
            
            // Should only allow first cloud provider (claude) and first local (none in fallbacks)
            expect(allowedProviders).toContain('claude');
            expect(allowedProviders).not.toContain('openai');
            expect(allowedProviders).not.toContain('google');
        });

        test('should allow unlimited providers for SuperNova tier', async () => {
            const supernovaLicense = await licenseValidator.createTestLicense('test@example.com', 'supernova');
            await featureManager.updateLicense(supernovaLicense);
            
            // Recreate manager with SuperNova tier
            manager = new AIProviderManager(mockSettings, featureManager);
            
            const limits = manager.getProviderLimits();
            expect(limits.local).toBe(Infinity);
            expect(limits.cloud).toBe(Infinity);
            
            const allowedProviders = manager.getAllowedProviders();
            expect(allowedProviders).toContain('claude');
            expect(allowedProviders).toContain('openai');
            expect(allowedProviders).toContain('google');
            expect(allowedProviders).toContain('ollama');
        });

        test('should check if specific provider is allowed', () => {
            expect(manager.isProviderAllowed('claude')).toBe(true);
            expect(manager.isProviderAllowed('openai')).toBe(false); // Second cloud provider blocked
            expect(manager.isProviderAllowed('google')).toBe(false); // Third cloud provider blocked
            expect(manager.isProviderAllowed('ollama')).toBe(true);
        });

        test('should preserve provider order in restrictions', () => {
            // Mock settings with different order
            const reorderedSettings: NovaSettings = {
                ...mockSettings,
                platformSettings: {
                    desktop: {
                        primaryProvider: 'openai',
                        fallbackProviders: ['google', 'claude', 'ollama']
                    },
                    mobile: {
                        primaryProvider: 'none',
                        fallbackProviders: []
                    }
                }
            };
            
            const reorderedManager = new AIProviderManager(reorderedSettings, featureManager);
            const allowedProviders = reorderedManager.getAllowedProviders();
            
            // Should allow first cloud (openai) and first local (ollama)
            expect(allowedProviders).toContain('openai');
            expect(allowedProviders).toContain('ollama');
            expect(allowedProviders).not.toContain('google');
            expect(allowedProviders).not.toContain('claude');
        });
    });
});