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
                content: [{ type: 'text', text: 'Test response from Claude' }]
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

        test('returns text when a non-text content block appears first', async () => {
            (requestUrl as jest.Mock).mockResolvedValueOnce({
                status: 200,
                json: {
                    content: [
                        { type: 'thinking', thinking: 'Internal reasoning' },
                        { type: 'text', text: 'Structured response' }
                    ]
                }
            });

            await expect(provider.complete('System prompt', 'User prompt'))
                .resolves.toBe('Structured response');
        });

        test('combines multiple text content blocks in order', async () => {
            (requestUrl as jest.Mock).mockResolvedValueOnce({
                status: 200,
                json: {
                    content: [
                        { type: 'text', text: 'First' },
                        { type: 'thinking', thinking: 'Internal reasoning' },
                        { type: 'text', text: ' second' }
                    ]
                }
            });

            await expect(provider.complete('System prompt', 'User prompt'))
                .resolves.toBe('First second');
        });

        test('throws a clear error when the response has no text content', async () => {
            (requestUrl as jest.Mock).mockResolvedValueOnce({
                status: 200,
                json: {
                    content: [{ type: 'thinking', thinking: 'Internal reasoning' }]
                }
            });

            await expect(provider.complete('System prompt', 'User prompt'))
                .rejects.toThrow('Claude API response did not include text content.');
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

        test('omits temperature for Claude Opus 4.7 (Anthropic deprecated the parameter)', async () => {
            await provider.complete('System prompt', 'User prompt', {
                model: 'claude-opus-4-7',
                temperature: 0.5
            });

            const callArgs = (requestUrl as jest.Mock).mock.calls[0][0];
            const body = JSON.parse(callArgs.body);

            expect(body.model).toBe('claude-opus-4-7');
            expect(body).not.toHaveProperty('temperature');
        });

        test('omits temperature for Claude Opus 4.8', async () => {
            await provider.complete('System prompt', 'User prompt', {
                model: 'claude-opus-4-8',
                temperature: 0.5
            });

            const callArgs = (requestUrl as jest.Mock).mock.calls[0][0];
            const body = JSON.parse(callArgs.body);

            expect(body.model).toBe('claude-opus-4-8');
            expect(body).not.toHaveProperty('temperature');
        });

        test('omits temperature for Claude Opus 5', async () => {
            await provider.complete('System prompt', 'User prompt', {
                model: 'claude-opus-5',
                temperature: 0.5
            });

            const callArgs = (requestUrl as jest.Mock).mock.calls[0][0];
            const body = JSON.parse(callArgs.body);

            expect(body.model).toBe('claude-opus-5');
            expect(body).not.toHaveProperty('temperature');
        });

        test('omits temperature for Claude Sonnet 5', async () => {
            await provider.complete('System prompt', 'User prompt', {
                model: 'claude-sonnet-5',
                temperature: 0.5
            });

            const callArgs = (requestUrl as jest.Mock).mock.calls[0][0];
            const body = JSON.parse(callArgs.body);

            expect(body.model).toBe('claude-sonnet-5');
            expect(body).not.toHaveProperty('temperature');
        });

        test.each([undefined, 32])('accepts a Fable response without changing the requested budget (%s)', async (maxTokens) => {
            (requestUrl as jest.Mock).mockResolvedValueOnce({
                status: 200,
                json: {
                    stop_reason: 'end_turn',
                    content: [
                        { type: 'thinking', thinking: '', signature: 'opaque-signature' },
                        { type: 'text', text: 'Fable response' }
                    ]
                }
            });

            await expect(provider.complete('System prompt', 'User prompt', {
                model: 'claude-fable-5-1',
                temperature: 0.5,
                maxTokens
            })).resolves.toBe('Fable response');

            const body = JSON.parse((requestUrl as jest.Mock).mock.calls[0][0].body);
            expect(body.model).toBe('claude-fable-5-1');
            expect(body.max_tokens).toBe(maxTokens ?? generalSettings.defaultMaxTokens);
            expect(body).not.toHaveProperty('temperature');
            expect(body).not.toHaveProperty('thinking');
            expect(body).not.toHaveProperty('fallbacks');
            expect(requestUrl).toHaveBeenCalledTimes(1);
        });

        test.each([
            { label: 'empty', content: [] },
            { label: 'partial text', content: [{ type: 'text', text: 'Partial response that must not be accepted' }] }
        ])('rejects a Fable refusal without returning partial text or retrying ($label)', async ({ content }) => {
            (requestUrl as jest.Mock).mockResolvedValueOnce({
                status: 200,
                json: {
                    stop_reason: 'refusal',
                    stop_details: { type: 'refusal', category: 'cyber', explanation: 'private-refusal-detail' },
                    content
                }
            });

            await expect(provider.complete('System prompt', 'User prompt', {
                model: 'claude-fable-5-1',
                maxTokens: 32
            })).rejects.toThrow('Claude API request was declined by the model. Try revising your request.');
            expect(requestUrl).toHaveBeenCalledTimes(1);
            const body = JSON.parse((requestUrl as jest.Mock).mock.calls[0][0].body);
            expect(body.max_tokens).toBe(32);
            expect(body).not.toHaveProperty('fallbacks');
        });

        test.each([
            { label: 'empty', content: [] },
            { label: 'thinking only', content: [{ type: 'thinking', thinking: '', signature: 'opaque-signature' }] },
            { label: 'truncated text', content: [{ type: 'text', text: 'Truncated answer' }] }
        ])('reports an exhausted Fable output budget without increasing it ($label)', async ({ content }) => {
            (requestUrl as jest.Mock).mockResolvedValueOnce({
                status: 200,
                json: { stop_reason: 'max_tokens', content }
            });

            await expect(provider.complete('System prompt', 'User prompt', {
                model: 'claude-fable-5-1',
                maxTokens: 32
            })).rejects.toThrow('Claude API response reached the output token limit before completing.');
            expect(requestUrl).toHaveBeenCalledTimes(1);
            const body = JSON.parse((requestUrl as jest.Mock).mock.calls[0][0].body);
            expect(body.max_tokens).toBe(32);
            expect(body).not.toHaveProperty('fallbacks');
        });

        test('should throw error when API key is missing', async () => {
            const providerWithoutKey = new ClaudeProvider({ apiKey: '' }, generalSettings, new TimeoutManager());

            await expect(
                providerWithoutKey.complete('System prompt', 'User prompt')
            ).rejects.toThrow('Claude API key not configured');
        });

        test('should throw error when API response is not ok', async () => {
            const errorLog = jest.spyOn(console, 'error').mockImplementation(() => undefined);
            const privateResponse = 'Unauthorized private-response-sentinel';
            (requestUrl as jest.Mock).mockResolvedValue({
                status: 401,
                text: privateResponse,
                headers: { 'x-private': 'private-header-sentinel' }
            });

            await expect(provider.complete('private-system-prompt', 'private-user-prompt'))
                .rejects.toThrow('Claude API error: 401');
            const serializedLogs = JSON.stringify(errorLog.mock.calls);
            expect(serializedLogs).not.toContain(privateResponse);
            expect(serializedLogs).not.toContain('private-header-sentinel');
            expect(serializedLogs).not.toContain('private-user-prompt');
            expect(serializedLogs).not.toContain('test-api-key');
            errorLog.mockRestore();
        });

        test('should handle API error response', async () => {
            (requestUrl as jest.Mock).mockRejectedValue(new Error('Network error'));

            await expect(
                provider.complete('System prompt', 'User prompt')
            ).rejects.toThrow('Claude API request failed');
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

    describe('getAvailableModels', () => {
        test('returns the current curated Claude models and caches the result', async () => {
            (requestUrl as jest.Mock).mockResolvedValue({
                status: 200,
                json: { content: [{ text: 'ok' }] }
            });

            const models = [
                'claude-fable-5-1',
                'claude-opus-5',
                'claude-sonnet-5',
                'claude-haiku-4-5-20251001'
            ];
            await expect(provider.getAvailableModels()).resolves.toEqual(models);
            await expect(provider.getAvailableModels()).resolves.toEqual(models);
            expect(requestUrl).toHaveBeenCalledTimes(1);
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
