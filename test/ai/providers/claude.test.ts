import { ClaudeProvider } from '../../../src/ai/providers/claude';
import { ProviderConfig } from '../../../src/ai/types';

// Mock fetch globally
global.fetch = jest.fn();

describe('ClaudeProvider', () => {
    let provider: ClaudeProvider;
    let config: ProviderConfig;

    beforeEach(() => {
        config = {
            apiKey: 'test-api-key',
            model: 'claude-3-haiku-20240307',
            temperature: 0.7,
            maxTokens: 1000
        };
        provider = new ClaudeProvider(config);
        jest.clearAllMocks();
    });

    describe('complete method', () => {
        const mockResponse = {
            ok: true,
            json: jest.fn().mockResolvedValue({
                content: [{ text: 'Test response from Claude' }]
            })
        };

        beforeEach(() => {
            (global.fetch as jest.Mock).mockResolvedValue(mockResponse);
        });

        test('should call Claude API with correct parameters', async () => {
            const systemPrompt = 'You are a helpful assistant.';
            const userPrompt = 'Hello, how are you?';

            await provider.complete(systemPrompt, userPrompt);

            expect(global.fetch).toHaveBeenCalledWith('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': 'test-api-key',
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: 'claude-3-haiku-20240307',
                    max_tokens: 1000,
                    temperature: 0.7,
                    system: systemPrompt,
                    messages: [
                        { role: 'user', content: userPrompt }
                    ]
                })
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

            const callArgs = (global.fetch as jest.Mock).mock.calls[0][1];
            const body = JSON.parse(callArgs.body);

            expect(body.model).toBe('claude-3-sonnet-20240229');
            expect(body.temperature).toBe(0.5);
            expect(body.max_tokens).toBe(2000);
        });

        test('should throw error when API key is missing', async () => {
            const providerWithoutKey = new ClaudeProvider({ apiKey: '' });
            
            await expect(
                providerWithoutKey.complete('System prompt', 'User prompt')
            ).rejects.toThrow('Claude API key not configured');
        });

        test('should throw error when API response is not ok', async () => {
            (global.fetch as jest.Mock).mockResolvedValue({
                ok: false,
                statusText: 'Unauthorized'
            });

            await expect(
                provider.complete('System prompt', 'User prompt')
            ).rejects.toThrow('Claude API error: Unauthorized');
        });

        test('should handle API error response', async () => {
            (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

            await expect(
                provider.complete('System prompt', 'User prompt')
            ).rejects.toThrow('Network error');
        });
    });

    describe('isAvailable', () => {
        test('should return true when API key is configured', async () => {
            expect(await provider.isAvailable()).toBe(true);
        });

        test('should return false when API key is missing', async () => {
            const providerWithoutKey = new ClaudeProvider({ apiKey: '' });
            expect(await providerWithoutKey.isAvailable()).toBe(false);
        });

        test('should return false when API key is undefined', async () => {
            const providerWithoutKey = new ClaudeProvider({});
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