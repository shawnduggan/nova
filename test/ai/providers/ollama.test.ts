import { requestUrl } from 'obsidian';
import { OllamaProvider } from '../../../src/ai/providers/ollama';
import { ProviderConfig } from '../../../src/ai/types';
import { TimeoutManager } from '../../../src/utils/timeout-manager';

jest.mock('obsidian', () => ({
	requestUrl: jest.fn()
}));

describe('OllamaProvider', () => {
	let provider: OllamaProvider;
	let config: ProviderConfig;
	let timeoutManager: TimeoutManager;
	const generalSettings = {
		defaultTemperature: 0.7,
		defaultMaxTokens: 4000
	};

	beforeEach(() => {
		config = {
			baseUrl: 'http://localhost:11434/',
			model: 'llama3.1'
		};
		timeoutManager = new TimeoutManager();
		provider = new OllamaProvider(config, generalSettings, timeoutManager);
		jest.clearAllMocks();
	});

	test('normalizes trailing slashes for availability checks', async () => {
		(requestUrl as jest.Mock).mockResolvedValue({ status: 200 });

		await expect(provider.isAvailable()).resolves.toBe(true);
		expect(requestUrl).toHaveBeenCalledWith({
			url: 'http://localhost:11434/api/tags',
			method: 'GET',
			headers: { 'Content-Type': 'application/json' }
		});
	});

	test('normalizes trailing slashes for chat requests', async () => {
		(requestUrl as jest.Mock).mockResolvedValue({
			status: 200,
			json: {
				message: {
					content: 'Hello from Ollama'
				}
			}
		});

		await expect(
			provider.chatCompletion([{ role: 'user', content: 'Hi' }])
		).resolves.toBe('Hello from Ollama');

		const callArgs = (requestUrl as jest.Mock).mock.calls[0][0];
		expect(callArgs.url).toBe('http://localhost:11434/api/chat');
	});
});
