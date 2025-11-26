import { OpenAIProvider } from '../../../src/ai/providers/openai';
import { ProviderConfig } from '../../../src/ai/types';
import { TimeoutManager } from '../../../src/utils/timeout-manager';
import { Logger } from '../../../src/utils/logger';

// Mock Obsidian's requestUrl
jest.mock('obsidian', () => ({
    requestUrl: jest.fn()
}));

import { requestUrl } from 'obsidian';

describe('OpenAIProvider Modernization', () => {
    let provider: OpenAIProvider;
    let config: ProviderConfig;
    let timeoutManager: TimeoutManager;
    const generalSettings = {
        defaultTemperature: 0.7,
        defaultMaxTokens: 1000
    };

    beforeEach(() => {
        config = {
            apiKey: 'test-api-key',
            model: 'gpt-5'
        };
        timeoutManager = new TimeoutManager();
        provider = new OpenAIProvider(config, generalSettings, timeoutManager);
        jest.clearAllMocks();
    });

    test('should handle array-based content in responses', async () => {
        const mockResponse = {
            status: 200,
            json: {
                id: 'resp_123',
                object: 'response',
                output: [
                    { type: 'reasoning', summary: [] },
                    { 
                        type: 'message', 
                        id: 'msg_123', 
                        content: [
                            { type: 'text', text: 'Hello ' },
                            { type: 'text', text: 'World' }
                        ] 
                    }
                ]
            }
        };

        (requestUrl as jest.Mock).mockResolvedValue(mockResponse);

        const result = await provider.generateText('Hello');
        expect(result).toBe('Hello World');

        const callArgs = (requestUrl as jest.Mock).mock.calls[0][0];
        const body = JSON.parse(callArgs.body);

        // Endpoint check
        expect(callArgs.url).toContain('/responses');

        // Parameter checks
        expect(body).toHaveProperty('input');
        expect(body).not.toHaveProperty('messages');
        expect(body).toHaveProperty('max_output_tokens');
        expect(body).not.toHaveProperty('max_completion_tokens');
        expect(body).not.toHaveProperty('max_tokens');
        expect(body).not.toHaveProperty('temperature');
        expect(body).toHaveProperty('reasoning');
    });

    test('should apply modern structure even for what used to be legacy models (if configured)', async () => {
        // This test confirms that we removed the conditional logic
        // If a user somehow configured 'gpt-4o', it will now be treated as a modern model on the /responses endpoint
        provider = new OpenAIProvider({
            apiKey: 'test-api-key',
            model: 'gpt-4o'
        }, generalSettings, timeoutManager);

        (requestUrl as jest.Mock).mockResolvedValue({
            status: 200,
            json: { output_text: 'Response' }
        });

        const result = await provider.generateText('Hello');
        expect(result).toBe('Response');

        const callArgs = (requestUrl as jest.Mock).mock.calls[0][0];
        const body = JSON.parse(callArgs.body);

        expect(callArgs.url).toContain('/responses');
        expect(body).toHaveProperty('input'); // Even for gpt-4o, we now send 'input'
        expect(body).toHaveProperty('reasoning');
        expect(body.reasoning).toHaveProperty('effort', 'medium'); // Default for non-pro models
    });

    test('should set reasoning.effort to high for -pro models', async () => {
        provider = new OpenAIProvider({
            apiKey: 'test-api-key',
            model: 'gpt-5-pro'
        }, generalSettings, timeoutManager);

        (requestUrl as jest.Mock).mockResolvedValue({
            status: 200,
            json: { output_text: 'Response from pro model' }
        });

        const result = await provider.generateText('Hello pro');
        expect(result).toBe('Response from pro model');

        const callArgs = (requestUrl as jest.Mock).mock.calls[0][0];
        const body = JSON.parse(callArgs.body);

        expect(callArgs.url).toContain('/responses');
        expect(body).toHaveProperty('model', 'gpt-5-pro');
        expect(body).toHaveProperty('reasoning');
        expect(body.reasoning).toHaveProperty('effort', 'high');
    });
});
