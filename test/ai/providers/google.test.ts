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
});
