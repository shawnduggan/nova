import { requestUrl } from 'obsidian';
import { getAvailableModels } from '../../src/ai/models';
import { ClaudeProvider } from '../../src/ai/providers/claude';
import { GoogleProvider } from '../../src/ai/providers/google';
import { OpenAIProvider } from '../../src/ai/providers/openai';
import { AIGenerationOptions, AIProvider, ProviderType } from '../../src/ai/types';
import { TimeoutManager } from '../../src/utils/timeout-manager';

jest.mock('obsidian', () => ({
	requestUrl: jest.fn()
}));

const LIVE_TESTS_ENABLED = process.env.NOVA_LIVE_MODEL_TESTS === '1';
const INCLUDE_SLOW_MODELS = process.env.NOVA_LIVE_MODEL_INCLUDE_SLOW === '1';
const PROVIDER_FILTER = process.env.NOVA_LIVE_MODEL_PROVIDER;
const MODEL_FILTER = process.env.NOVA_LIVE_MODEL_FILTER;
const LIVE_TEST_TIMEOUT_MS = INCLUDE_SLOW_MODELS ? 180000 : 90000;

type LiveProviderType = Extract<ProviderType, 'claude' | 'openai' | 'google'>;

interface LiveProviderCase {
	providerType: LiveProviderType;
	displayName: string;
	envNames: string[];
	createProvider: (apiKey: string, model: string) => AIProvider;
}

const SLOW_MODELS = new Set([
	'claude-opus-4-8',
	'claude-opus-4-7',
	'claude-opus-4-6',
	'gpt-5.5-pro',
	'gpt-5.4-pro'
]);

const GENERAL_SETTINGS = {
	defaultTemperature: 0.2,
	defaultMaxTokens: 128
};

function getEnvValue(names: string[]): string | undefined {
	for (const name of names) {
		const value = process.env[name]?.trim();
		if (value) {
			return value;
		}
	}

	return undefined;
}

function getSelectedModels(providerType: LiveProviderType): string[] {
	return getAvailableModels(providerType)
		.map(model => model.value)
		.filter(model => INCLUDE_SLOW_MODELS || !SLOW_MODELS.has(model))
		.filter(model => !MODEL_FILTER || model.includes(MODEL_FILTER));
}

async function requestUrlViaFetch(request: { url: string; method?: string; headers?: Record<string, string>; body?: string }): Promise<unknown> {
	const response = await globalThis.fetch(request.url, {
		method: request.method || 'GET',
		headers: request.headers,
		body: request.body
	});
	const text = await response.text();
	const headers: Record<string, string> = {};
	response.headers.forEach((value, key) => { headers[key] = value; });

	let json: unknown = {};
	if (text.trim()) {
		try {
			json = JSON.parse(text);
		} catch {
			json = {};
		}
	}

	return {
		status: response.status,
		headers,
		text,
		json
	};
}

const providerCases: LiveProviderCase[] = [
	{
		providerType: 'claude',
		displayName: 'Claude',
		envNames: ['ANTHROPIC_API_KEY', 'CLAUDE_API_KEY'],
		createProvider: (apiKey, model) => new ClaudeProvider({ apiKey, model }, GENERAL_SETTINGS, new TimeoutManager())
	},
	{
		providerType: 'openai',
		displayName: 'OpenAI',
		envNames: ['OPENAI_API_KEY'],
		createProvider: (apiKey, model) => new OpenAIProvider({ apiKey, model }, GENERAL_SETTINGS, new TimeoutManager())
	},
	{
		providerType: 'google',
		displayName: 'Google Gemini',
		envNames: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
		createProvider: (apiKey, model) => new GoogleProvider({ apiKey, model }, GENERAL_SETTINGS, new TimeoutManager())
	}
].filter(providerCase => !PROVIDER_FILTER || providerCase.providerType === PROVIDER_FILTER);

const describeLive = LIVE_TESTS_ENABLED ? describe : describe.skip;

describeLive('live configured cloud model smoke tests', () => {
	beforeAll(() => {
		jest.setTimeout(LIVE_TEST_TIMEOUT_MS);
		(requestUrl as jest.Mock).mockImplementation(requestUrlViaFetch);
	});

	for (const providerCase of providerCases) {
		describe(providerCase.displayName, () => {
			const apiKey = getEnvValue(providerCase.envNames);
			const models = apiKey ? getSelectedModels(providerCase.providerType) : [];

			if (!apiKey) {
				test.skip(`set ${providerCase.envNames.join(' or ')} to smoke test ${providerCase.displayName}`, () => undefined);
				return;
			}

			if (models.length === 0) {
				test.skip(`no ${providerCase.displayName} models matched current live test filters`, () => undefined);
				return;
			}

			test.each(models)('%s returns a non-empty response', async model => {
				const provider = providerCase.createProvider(apiKey, model);
				const options: AIGenerationOptions = { model, maxTokens: 128 };

				const response = await provider.complete(
					'You are a health check. Reply with exactly OK and no extra text.',
					'Reply with exactly OK.',
					options
				);

				expect(response.trim().length).toBeGreaterThan(0);
				expect(response.toLowerCase()).toContain('ok');
			}, LIVE_TEST_TIMEOUT_MS);
		});
	}
});
