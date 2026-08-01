import { OpenAIProvider } from '../../../src/ai/providers/openai';
import { ProviderConfig } from '../../../src/ai/types';
import { TimeoutManager } from '../../../src/utils/timeout-manager';

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
        defaultMaxTokens: 4000
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

    test('should apply modern structure even for older models (if configured)', async () => {
        // This test confirms that all models use the modern /responses endpoint
        provider = new OpenAIProvider({
            apiKey: 'test-api-key',
            model: 'gpt-5.2-2025-12-11'
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
        expect(body).toHaveProperty('input');
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

	test.each([
		'gpt-5.6-sol',
		'gpt-5.6-terra',
		'gpt-5.6-luna'
	])('should send %s through the Responses API', async model => {
		provider = new OpenAIProvider({
			apiKey: 'test-api-key',
			model
		}, generalSettings, timeoutManager);

		(requestUrl as jest.Mock).mockResolvedValue({
			status: 200,
			json: { output_text: 'OK' }
		});

		await expect(provider.generateText('Hello')).resolves.toBe('OK');

		const callArgs = (requestUrl as jest.Mock).mock.calls[0][0];
		const body = JSON.parse(callArgs.body);

		expect(callArgs.url).toContain('/responses');
		expect(body).toHaveProperty('model', model);
		expect(body).toHaveProperty('reasoning.effort', 'medium');
	});

    test('returns current OpenAI model list', async () => {
        (requestUrl as jest.Mock).mockResolvedValue({
            status: 200,
            json: { data: [] }
        });

        await expect(provider.getAvailableModels()).resolves.toEqual([
			'gpt-5.6-sol',
			'gpt-5.6-terra',
			'gpt-5.6-luna',
            'gpt-5.5-pro',
            'gpt-5.5',
            'gpt-5.4-pro',
            'gpt-5.4',
            'gpt-5.4-mini',
            'gpt-5.4-nano'
        ]);
    });

	test('does not expose prompts, credentials, endpoints, or response bodies in errors or logs', async () => {
		provider = new OpenAIProvider({
			apiKey: 'private-openai-key',
			baseUrl: 'https://private-openai.example/v1',
			model: 'gpt-5.4'
		}, generalSettings, timeoutManager);
		const errorLog = jest.spyOn(console, 'error').mockImplementation(() => undefined);
		const privateResponse = 'private-openai-response-sentinel';
		(requestUrl as jest.Mock).mockResolvedValue({
			status: 400,
			text: privateResponse,
			headers: { 'x-private': 'private-header-sentinel' },
			json: { error: { message: privateResponse } }
		});

		await expect(provider.complete('private-system-prompt', 'private-user-prompt'))
			.rejects.toThrow('OpenAI API error: 400');
		const serializedLogs = JSON.stringify(errorLog.mock.calls);
		expect(serializedLogs).not.toContain(privateResponse);
		expect(serializedLogs).not.toContain('private-header-sentinel');
		expect(serializedLogs).not.toContain('private-user-prompt');
		expect(serializedLogs).not.toContain('private-openai-key');
		expect(serializedLogs).not.toContain('private-openai.example');
		errorLog.mockRestore();
	});
});
