import { requestUrl } from 'obsidian';
import { GoogleProvider } from '../../../src/ai/providers/google';
import { ProviderConfig } from '../../../src/ai/types';
import { TimeoutManager } from '../../../src/utils/timeout-manager';

jest.mock('obsidian', () => ({
	requestUrl: jest.fn()
}));

describe('GoogleProvider', () => {
	let provider: GoogleProvider;
	let config: ProviderConfig;
	let timeoutManager: TimeoutManager;
	const generalSettings = {
		defaultTemperature: 0.7,
		defaultMaxTokens: 4000
	};

	beforeEach(() => {
		config = {
			apiKey: 'test-api-key',
			model: 'gemini-3.5-flash'
		};
		timeoutManager = new TimeoutManager();
		provider = new GoogleProvider(config, generalSettings, timeoutManager);
		jest.clearAllMocks();
	});

	test('returns current Gemini model list', async () => {
		(requestUrl as jest.Mock).mockResolvedValue({
			status: 200,
			json: { models: [] }
		});

		await expect(provider.getAvailableModels()).resolves.toEqual([
			'gemini-3.5-flash',
			'gemini-3.1-pro-preview',
			'gemini-3.1-flash-lite',
			'gemini-3-flash-preview',
			'gemini-2.5-pro',
			'gemini-2.5-flash',
			'gemini-2.5-flash-lite'
		]);
	});

	test('rejects malformed successful responses', async () => {
		(requestUrl as jest.Mock).mockResolvedValue({
			status: 200,
			json: {
				candidates: [{ content: { parts: [{ text: { unexpected: true } }] } }]
			}
		});

		await expect(provider.complete('System prompt', 'User prompt'))
			.rejects.toThrow('Google API returned empty text content');
	});

	test('does not expose prompts, keys, or response bodies in errors or logs', async () => {
		const errorLog = jest.spyOn(console, 'error').mockImplementation(() => undefined);
		const privateResponse = 'private-google-response-sentinel';
		(requestUrl as jest.Mock).mockResolvedValue({
			status: 401,
			text: privateResponse,
			headers: { 'x-private': 'private-header-sentinel' },
			json: { error: { message: privateResponse } }
		});

		await expect(provider.complete('private-system-prompt', 'private-user-prompt'))
			.rejects.toThrow('Google API error: 401 (check the API key in settings)');
		const serializedLogs = JSON.stringify(errorLog.mock.calls);
		expect(serializedLogs).not.toContain(privateResponse);
		expect(serializedLogs).not.toContain('private-header-sentinel');
		expect(serializedLogs).not.toContain('private-user-prompt');
		expect(serializedLogs).not.toContain('test-api-key');
		errorLog.mockRestore();
	});
});
