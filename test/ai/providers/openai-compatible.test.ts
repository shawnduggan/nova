import { requestUrl } from 'obsidian';
import {
	OpenAICompatibleProvider,
	isLocalOpenAICompatibleBaseUrl,
	normalizeOpenAICompatibleBaseUrl
} from '../../../src/ai/providers/openai-compatible';
import { ProviderConfig } from '../../../src/ai/types';
import { TimeoutManager } from '../../../src/utils/timeout-manager';

jest.mock('obsidian', () => ({
	requestUrl: jest.fn()
}));

describe('OpenAICompatibleProvider', () => {
	let config: ProviderConfig;
	let provider: OpenAICompatibleProvider;
	let timeoutManager: TimeoutManager;
	const generalSettings = {
		defaultTemperature: 0.7,
		defaultMaxTokens: 4000
	};

	beforeEach(() => {
		config = {
			baseUrl: 'http://localhost:1234/v1/',
			model: 'qwen2.5-14b-instruct'
		};
		timeoutManager = new TimeoutManager();
		provider = new OpenAICompatibleProvider(config, generalSettings, timeoutManager);
		jest.clearAllMocks();
	});

	test('normalizes only trailing resource suffixes', () => {
		expect(normalizeOpenAICompatibleBaseUrl('http://localhost:1234/v1/')).toBe('http://localhost:1234/v1');
		expect(normalizeOpenAICompatibleBaseUrl('http://localhost:1234/v1/chat/completions')).toBe('http://localhost:1234/v1');
		expect(normalizeOpenAICompatibleBaseUrl('https://example.com/v1thinking')).toBe('https://example.com/v1thinking');
	});

	test('omits authorization when API key is blank', async () => {
		(requestUrl as jest.Mock).mockResolvedValue({
			status: 200,
			json: {
				choices: [{ message: { content: 'Hello from a compatible endpoint' } }]
			},
			text: ''
		});

		await expect(provider.chatCompletion([{ role: 'user', content: 'Hi' }])).resolves.toBe('Hello from a compatible endpoint');

		expect(requestUrl).toHaveBeenCalledWith({
			url: 'http://localhost:1234/v1/chat/completions',
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				model: 'qwen2.5-14b-instruct',
				messages: [{ role: 'user', content: 'Hi' }],
				temperature: 0.7,
				max_tokens: 4000,
				stream: false
			}),
			throw: false
		});
	});

	test('adds authorization when API key is configured', async () => {
		config.apiKey = 'secret-token';
		(requestUrl as jest.Mock).mockResolvedValue({
			status: 200,
			json: {
				choices: [{ message: { content: [{ text: 'Authorized' }] } }]
			},
			text: ''
		});

		await expect(provider.chatCompletion([{ role: 'user', content: 'Hi' }], { temperature: 0, maxTokens: 4 })).resolves.toBe('Authorized');

		const callArgs = (requestUrl as jest.Mock).mock.calls[0][0];
		expect(callArgs.headers).toEqual({
			'Content-Type': 'application/json',
			Authorization: 'Bearer secret-token'
		});
		expect(JSON.parse(callArgs.body)).toMatchObject({
			temperature: 0,
			max_tokens: 4
		});
	});

	test('requires a selected model before runtime availability', () => {
		config.model = '';
		config.models = ['discovered-model'];
		expect(provider.isAvailable()).toBe(false);

		config.model = 'discovered-model';
		expect(provider.isAvailable()).toBe(true);
	});

	test('parses common /models response shapes', async () => {
		(requestUrl as jest.Mock).mockResolvedValueOnce({
			status: 200,
			json: {
				data: [
					{ id: 'model-a' },
					{ id: 'model-b' },
					{ id: 'model-a' }
				]
			},
			text: ''
		});

		await expect(provider.getAvailableModels()).resolves.toEqual(['model-a', 'model-b']);

		provider.clearModelCache();
		(requestUrl as jest.Mock).mockResolvedValueOnce({
			status: 200,
			json: {
				models: ['model-c', { name: 'model-d' }, { model: 'model-e' }, { missing: true }]
			},
			text: ''
		});

		await expect(provider.getAvailableModels()).resolves.toEqual(['model-c', 'model-d', 'model-e']);
	});

	test('detects local and private URLs for mobile gating', () => {
		expect(isLocalOpenAICompatibleBaseUrl('http://localhost:1234/v1')).toBe(true);
		expect(isLocalOpenAICompatibleBaseUrl('http://127.0.0.1:1234/v1')).toBe(true);
		expect(isLocalOpenAICompatibleBaseUrl('http://10.0.0.2:1234/v1')).toBe(true);
		expect(isLocalOpenAICompatibleBaseUrl('http://172.20.0.2:1234/v1')).toBe(true);
		expect(isLocalOpenAICompatibleBaseUrl('http://192.168.1.10:1234/v1')).toBe(true);
		expect(isLocalOpenAICompatibleBaseUrl('http://studio.local:1234/v1')).toBe(true);
		expect(isLocalOpenAICompatibleBaseUrl('http://studio:1234/v1')).toBe(true);
		expect(isLocalOpenAICompatibleBaseUrl('https://openrouter.ai/api/v1')).toBe(false);
	});

	test('does not expose prompts, credentials, endpoints, or response bodies in errors or logs', async () => {
		config.baseUrl = 'https://private-endpoint.example/v1';
		config.apiKey = 'private-compatible-key';
		const errorLog = jest.spyOn(console, 'error').mockImplementation(() => undefined);
		const privateResponse = 'private-compatible-response-sentinel';
		(requestUrl as jest.Mock).mockResolvedValue({
			status: 500,
			text: privateResponse,
			headers: { 'x-private': 'private-header-sentinel' },
			json: { error: { message: privateResponse } }
		});

		const thrown = await provider.complete('private-system-prompt', 'private-user-prompt')
			.catch(error => error as Error);

		expect(thrown).toBeInstanceOf(Error);
		expect(thrown.message).toBe('OpenAI-compatible API error: 500');
		const serializedLogs = JSON.stringify(errorLog.mock.calls);
		expect(serializedLogs).not.toContain(privateResponse);
		expect(serializedLogs).not.toContain('private-header-sentinel');
		expect(serializedLogs).not.toContain('private-user-prompt');
		expect(serializedLogs).not.toContain('private-compatible-key');
		expect(serializedLogs).not.toContain('private-endpoint.example');
		errorLog.mockRestore();
	});
});
