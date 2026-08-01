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
		(requestUrl as jest.Mock).mockResolvedValue({ status: 200, json: { models: [] } });

		await expect(provider.isAvailable()).resolves.toBe(true);
		expect(requestUrl).toHaveBeenCalledWith({
			url: 'http://localhost:11434/api/tags',
			method: 'GET',
			headers: { 'Content-Type': 'application/json' },
			throw: false
		});
	});

	test('checks availability without requiring a configured model', async () => {
		config.model = '';
		(requestUrl as jest.Mock).mockResolvedValue({ status: 200, json: { models: [] } });

		await expect(provider.isAvailable()).resolves.toBe(true);
	});

	test('returns false when availability check cannot reach Ollama', async () => {
		(requestUrl as jest.Mock).mockRejectedValue(new Error('Connection refused'));

		await expect(provider.isAvailable()).resolves.toBe(false);
	});

	test('fetches available model names from Ollama tags', async () => {
		(requestUrl as jest.Mock).mockResolvedValue({
			status: 200,
			json: {
				models: [
					{ name: 'llama3.1:8b' },
					{ name: 'qwen3:14b' },
					{ name: 'llama3.1:8b' },
					{ name: ' ' },
					{ digest: 'missing-name' }
				]
			}
		});

		await expect(provider.getAvailableModels()).resolves.toEqual(['llama3.1:8b', 'qwen3:14b']);
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

	test('rejects malformed successful generate responses', async () => {
		(requestUrl as jest.Mock).mockResolvedValue({
			status: 200,
			json: { response: { unexpected: true } }
		});

		await expect(provider.generateText('Hello'))
			.rejects.toThrow('Ollama API: Unexpected response format');
	});

	test('rejects malformed successful chat responses', async () => {
		(requestUrl as jest.Mock).mockResolvedValue({
			status: 200,
			json: { message: { content: { unexpected: true } } }
		});

		await expect(provider.chatCompletion([{ role: 'user', content: 'Hello' }]))
			.rejects.toThrow('Ollama API: Unexpected response format');
	});

	test('does not expose prompts, endpoints, or response bodies in errors or logs', async () => {
		config.baseUrl = 'https://private-ollama.example/';
		const errorLog = jest.spyOn(console, 'error').mockImplementation(() => undefined);
		const privateResponse = 'private-ollama-response-sentinel';
		(requestUrl as jest.Mock).mockResolvedValue({
			status: 500,
			text: privateResponse,
			headers: { 'x-private': 'private-header-sentinel' }
		});

		await expect(provider.complete('private-system-prompt', 'private-user-prompt'))
			.rejects.toThrow('Ollama API error: 500');
		const serializedLogs = JSON.stringify(errorLog.mock.calls);
		expect(serializedLogs).not.toContain(privateResponse);
		expect(serializedLogs).not.toContain('private-header-sentinel');
		expect(serializedLogs).not.toContain('private-user-prompt');
		expect(serializedLogs).not.toContain('private-ollama.example');
		errorLog.mockRestore();
	});
});
