import {
	getAvailableModels,
	getContextLimit,
	getModelMaxOutputTokens,
	getProviderTypeForModel
} from '../../src/ai/models';
import type { NovaSettings } from '../../src/settings';

function createSettingsWithOllama(ollama: NovaSettings['aiProviders']['ollama']): NovaSettings {
	return {
		aiProviders: {
			claude: {},
			openai: {},
			google: {},
			ollama,
			'openai-compatible': {
				baseUrl: '',
				model: '',
				models: [],
				modelsLastRefreshed: null,
				contextSize: 32000
			}
		},
		platformSettings: {
			desktop: { selectedModel: '' },
			mobile: { selectedModel: 'none' }
		},
		general: {
			defaultTemperature: 0.7,
			defaultMaxTokens: 4000,
			showReleaseNotes: true,
			lastSeenVersion: '',
			customPromptHistory: []
		},
		licensing: {
			supernovaLicenseKey: '',
			debugSettings: { enabled: false }
		},
		commands: {
			suggestionMode: 'balanced',
			responseTime: 'normal',
			hideWhileTyping: true,
			enabledDocumentTypes: []
		},
		writingAnalysis: {
			enabled: true,
			longSentenceThreshold: 25,
			veryLongSentenceThreshold: 35,
			showStatsPanel: true
		},
		dashboard: {
			excludeFolders: [],
			targetReadabilityGrade: 8
		}
	};
}

describe('AI model registry', () => {
	test('includes current Claude models in the Claude picker list', () => {
		const claudeModels = getAvailableModels('claude');

		expect(claudeModels[0]).toEqual({ value: 'claude-opus-4-8', label: 'Claude Opus 4.8' });
		expect(claudeModels[1]).toEqual({ value: 'claude-sonnet-5', label: 'Claude Sonnet 5' });
	});

	test('maps current Claude models to Claude context metadata', () => {
		expect(getProviderTypeForModel('claude-opus-4-8')).toBe('claude');
		expect(getProviderTypeForModel('claude-sonnet-5')).toBe('claude');
		expect(getContextLimit('claude', 'claude-opus-4-8')).toBe(1000000);
		expect(getContextLimit('claude', 'claude-sonnet-5')).toBe(1000000);
		expect(getModelMaxOutputTokens('claude', 'claude-opus-4-8')).toBe(128000);
		expect(getModelMaxOutputTokens('claude', 'claude-sonnet-5')).toBe(128000);
	});

	test('includes current GPT models in the OpenAI picker list', () => {
		const openaiModels = getAvailableModels('openai');

		expect(openaiModels).toEqual([
			{ value: 'gpt-5.5-pro', label: 'GPT-5.5 Pro' },
			{ value: 'gpt-5.5', label: 'GPT-5.5' },
			{ value: 'gpt-5.4-pro', label: 'GPT-5.4 Pro' },
			{ value: 'gpt-5.4', label: 'GPT-5.4' },
			{ value: 'gpt-5.4-mini', label: 'GPT-5.4 mini' },
			{ value: 'gpt-5.4-nano', label: 'GPT-5.4 nano' }
		]);
	});

	test('maps current GPT models to OpenAI context metadata', () => {
		expect(getProviderTypeForModel('gpt-5.5')).toBe('openai');
		expect(getProviderTypeForModel('gpt-5.5-pro')).toBe('openai');
		expect(getProviderTypeForModel('gpt-5.4-mini')).toBe('openai');
		expect(getProviderTypeForModel('gpt-5.4-nano')).toBe('openai');
		expect(getContextLimit('openai', 'gpt-5.5')).toBe(1050000);
		expect(getContextLimit('openai', 'gpt-5.5-pro')).toBe(1050000);
		expect(getContextLimit('openai', 'gpt-5.4-mini')).toBe(400000);
		expect(getContextLimit('openai', 'gpt-5.4-nano')).toBe(400000);
		expect(getModelMaxOutputTokens('openai', 'gpt-5.5')).toBe(128000);
		expect(getModelMaxOutputTokens('openai', 'gpt-5.5-pro')).toBe(128000);
		expect(getModelMaxOutputTokens('openai', 'gpt-5.4-mini')).toBe(128000);
		expect(getModelMaxOutputTokens('openai', 'gpt-5.4-nano')).toBe(128000);
	});

	test('keeps legacy GPT models mapped without showing them in the OpenAI picker', () => {
		const openaiModels = getAvailableModels('openai').map(model => model.value);

		expect(openaiModels).not.toContain('gpt-5.2-2025-12-11');
		expect(openaiModels).not.toContain('gpt-5-pro');
		expect(getProviderTypeForModel('gpt-5.2-2025-12-11')).toBe('openai');
		expect(getProviderTypeForModel('gpt-5-pro')).toBe('openai');
	});

	test('includes current Gemini models in the Google picker list', () => {
		expect(getAvailableModels('google')).toEqual([
			{ value: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
			{ value: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro (Preview)' },
			{ value: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash-Lite' },
			{ value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash (Preview)' },
			{ value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
			{ value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
			{ value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite' }
		]);
	});

	test('maps current Gemini models to Google context metadata', () => {
		expect(getProviderTypeForModel('gemini-3.5-flash')).toBe('google');
		expect(getProviderTypeForModel('gemini-3.1-flash-lite')).toBe('google');
		expect(getContextLimit('google', 'gemini-3.5-flash')).toBe(1048576);
		expect(getContextLimit('google', 'gemini-3.1-flash-lite')).toBe(1048576);
		expect(getModelMaxOutputTokens('google', 'gemini-3.5-flash')).toBe(65536);
		expect(getModelMaxOutputTokens('google', 'gemini-3.1-flash-lite')).toBe(65536);
	});

	test('keeps the shut-down Gemini Flash-Lite preview mapped without showing it in the Google picker', () => {
		const googleModels = getAvailableModels('google').map(model => model.value);

		expect(googleModels).not.toContain('gemini-3.1-flash-lite-preview');
		expect(getProviderTypeForModel('gemini-3.1-flash-lite-preview')).toBe('google');
	});

	test('returns cached Ollama models for the model picker', () => {
		const settings = createSettingsWithOllama({
			baseUrl: 'http://localhost:11434',
			model: 'llama3.1:8b',
			models: ['qwen3:14b', 'gemma3:12b'],
			modelsLastRefreshed: '2026-05-12T10:30:00.000Z'
		});

		expect(getAvailableModels('ollama', settings)).toEqual([
			{ value: 'qwen3:14b', label: 'qwen3:14b' },
			{ value: 'gemma3:12b', label: 'gemma3:12b' },
			{ value: 'llama3.1:8b', label: 'llama3.1:8b' }
		]);
		expect(getProviderTypeForModel('qwen3:14b', settings)).toBe('ollama');
	});

	test('keeps a legacy saved Ollama model when cache is empty', () => {
		const settings = createSettingsWithOllama({
			baseUrl: 'http://localhost:11434',
			model: 'llama3.1:8b',
			models: [],
			modelsLastRefreshed: null
		});

		expect(getAvailableModels('ollama', settings)).toEqual([
			{ value: 'llama3.1:8b', label: 'llama3.1:8b' }
		]);
	});

	test('returns only the selected OpenAI-compatible model for the model picker', () => {
		const settings = createSettingsWithOllama({
			baseUrl: 'http://localhost:11434',
			model: '',
			models: [],
			modelsLastRefreshed: null
		});
		settings.aiProviders['openai-compatible'] = {
			baseUrl: 'https://openrouter.ai/api/v1',
			model: 'manual-compatible-model',
			models: ['compatible-model-b', 'compatible-model-a'],
			modelsLastRefreshed: '2026-06-12T10:30:00.000Z',
			contextSize: 64000
		};

		expect(getAvailableModels('openai-compatible', settings)).toEqual([
			{ value: 'manual-compatible-model', label: 'manual-compatible-model' }
		]);
		expect(getProviderTypeForModel('manual-compatible-model', settings)).toBe('openai-compatible');
		expect(getProviderTypeForModel('compatible-model-a', settings)).toBeNull();
	});

	test('hides discovered OpenAI-compatible models until a model is selected', () => {
		const settings = createSettingsWithOllama({
			baseUrl: 'http://localhost:11434',
			model: '',
			models: [],
			modelsLastRefreshed: null
		});
		settings.aiProviders['openai-compatible'] = {
			baseUrl: 'https://openrouter.ai/api/v1',
			model: '',
			models: Array.from({ length: 51 }, (_, index) => `provider/model-${index}`),
			modelsLastRefreshed: '2026-06-12T10:30:00.000Z',
			contextSize: 64000
		};

		expect(getAvailableModels('openai-compatible', settings)).toEqual([]);
	});

	test('keeps the sidebar to the selected OpenAI-compatible model even when discovery is large', () => {
		const settings = createSettingsWithOllama({
			baseUrl: 'http://localhost:11434',
			model: '',
			models: [],
			modelsLastRefreshed: null
		});
		settings.aiProviders['openai-compatible'] = {
			baseUrl: 'https://openrouter.ai/api/v1',
			model: 'qwen/qwen3.7-plus',
			models: [
				'zeta/model-z',
				'qwen/qwen2.5',
				'openai/gpt-4o',
				'qwen/qwen3.7-plus',
				'qwen/qwen3'
			],
			modelsLastRefreshed: '2026-06-12T10:30:00.000Z',
			contextSize: 64000
		};
		settings.aiProviders['openai-compatible'].models.push(
			...Array.from({ length: 51 }, (_, index) => `other/model-${index}`)
		);

		expect(getAvailableModels('openai-compatible', settings)).toEqual([
			{ value: 'qwen/qwen3.7-plus', label: 'qwen/qwen3.7-plus' }
		]);
	});

	test('uses the OpenAI-compatible fallback context metadata', () => {
		expect(getContextLimit('openai-compatible', 'unknown-compatible-model')).toBe(32000);
		expect(getModelMaxOutputTokens('openai-compatible', 'unknown-compatible-model')).toBe(4096);
	});
});
