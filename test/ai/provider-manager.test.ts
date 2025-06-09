import { AIProviderManager } from '../../src/ai/provider-manager';
import { NovaSettings } from '../../src/settings';
import { Platform } from 'obsidian';

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

    beforeEach(() => {
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

        manager = new AIProviderManager(mockSettings);
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

            const openaiProvider = {
                name: 'OpenAI',
                isAvailable: jest.fn().mockResolvedValue(true),
                complete: jest.fn().mockResolvedValue('OpenAI response')
            };

            manager['providers'].set('claude', claudeProvider as any);
            manager['providers'].set('openai', openaiProvider as any);

            const result = await manager.complete('System prompt', 'User prompt');

            expect(claudeProvider.isAvailable).toHaveBeenCalled();
            expect(openaiProvider.isAvailable).toHaveBeenCalled();
            expect(openaiProvider.complete).toHaveBeenCalledWith('System prompt', 'User prompt', undefined);
            expect(result).toBe('OpenAI response');
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
});