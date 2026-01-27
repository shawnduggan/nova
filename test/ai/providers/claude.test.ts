import { ClaudeProvider } from '../../../src/ai/providers/claude';
import { ProviderConfig } from '../../../src/ai/types';
import { TimeoutManager } from '../../../src/utils/timeout-manager';

// Mock Obsidian's requestUrl function
jest.mock('obsidian', () => ({
    requestUrl: jest.fn()
}));

import { requestUrl } from 'obsidian';

describe('ClaudeProvider', () => {
    let provider: ClaudeProvider;
    let config: ProviderConfig;
    let timeoutManager: TimeoutManager;
    const generalSettings = {
        defaultTemperature: 0.7,
        defaultMaxTokens: 4000
    };

    beforeEach(() => {
        config = {
            apiKey: 'test-api-key',
            model: 'claude-3-haiku-20240307'
        };
        timeoutManager = new TimeoutManager();
        provider = new ClaudeProvider(config, generalSettings, timeoutManager);
        jest.clearAllMocks();
    });

    describe('complete method', () => {
        const mockResponse = {
            status: 200,
            json: {
                content: [{ text: 'Test response from Claude' }]
            }
        };

        beforeEach(() => {
            (requestUrl as jest.Mock).mockResolvedValue(mockResponse);
        });

        test('should call Claude API with correct parameters', async () => {
            const systemPrompt = 'You are a helpful assistant.';
            const userPrompt = 'Hello, how are you?';

            await provider.complete(systemPrompt, userPrompt);

            expect(requestUrl).toHaveBeenCalledWith({
                url: 'https://api.anthropic.com/v1/messages',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': 'test-api-key',
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: 'claude-3-haiku-20240307',
                    max_tokens: 4000,
                    temperature: 0.7,
                    system: systemPrompt,
                    messages: [
                        { role: 'user', content: userPrompt }
                    ]
                }),
                throw: false
            });
        });

        test('should return response text', async () => {
            const result = await provider.complete('System prompt', 'User prompt');
            expect(result).toBe('Test response from Claude');
        });

        test('should use custom options when provided', async () => {
            const options = {
                model: 'claude-3-sonnet-20240229',
                temperature: 0.5,
                maxTokens: 2000
            };

            await provider.complete('System prompt', 'User prompt', options);

            const callArgs = (requestUrl as jest.Mock).mock.calls[0][0];
            const body = JSON.parse(callArgs.body);

            expect(body.model).toBe('claude-3-sonnet-20240229');
            expect(body.temperature).toBe(0.5);
            expect(body.max_tokens).toBe(2000);
        });

        test('should throw error when API key is missing', async () => {
            const providerWithoutKey = new ClaudeProvider({ apiKey: '' }, generalSettings, new TimeoutManager());

            await expect(
                providerWithoutKey.complete('System prompt', 'User prompt')
            ).rejects.toThrow('Claude API key not configured');
        });

        test('should throw error when API response is not ok', async () => {
            (requestUrl as jest.Mock).mockResolvedValue({
                status: 401,
                text: 'Unauthorized'
            });

            await expect(
                provider.complete('System prompt', 'User prompt')
            ).rejects.toThrow('Claude API error: 401 - Unauthorized');
        });

        test('should handle API error response', async () => {
            (requestUrl as jest.Mock).mockRejectedValue(new Error('Network error'));

            await expect(
                provider.complete('System prompt', 'User prompt')
            ).rejects.toThrow(/Network error|Failed to connect/);
        }, 15000); // Increased timeout for retry logic
    });

    describe('isAvailable', () => {
        test('should return true when API key is configured', async () => {
            expect(await provider.isAvailable()).toBe(true);
        });

        test('should return false when API key is missing', async () => {
            const providerWithoutKey = new ClaudeProvider({ apiKey: '' }, generalSettings, new TimeoutManager());
            expect(await providerWithoutKey.isAvailable()).toBe(false);
        });

        test('should return false when API key is undefined', async () => {
            const providerWithoutKey = new ClaudeProvider({}, generalSettings, new TimeoutManager());
            expect(await providerWithoutKey.isAvailable()).toBe(false);
        });
    });

    describe('updateConfig', () => {
        test('should update configuration', () => {
            const newConfig = { apiKey: 'new-key', model: 'claude-3-opus-20240229' };
            provider.updateConfig(newConfig);
            
            expect(provider['config']).toEqual(newConfig);
        });
    });
});