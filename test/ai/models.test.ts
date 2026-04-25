import {
	getAvailableModels,
	getContextLimit,
	getModelMaxOutputTokens,
	getProviderTypeForModel
} from '../../src/ai/models';

describe('AI model registry', () => {
	test('includes GPT-5.5 models in the OpenAI picker list', () => {
		const openaiModels = getAvailableModels('openai');

		expect(openaiModels.slice(0, 2)).toEqual([
			{ value: 'gpt-5.5-pro', label: 'GPT-5.5 Pro' },
			{ value: 'gpt-5.5', label: 'GPT-5.5' }
		]);
	});

	test('maps GPT-5.5 models to OpenAI context metadata', () => {
		expect(getProviderTypeForModel('gpt-5.5')).toBe('openai');
		expect(getProviderTypeForModel('gpt-5.5-pro')).toBe('openai');
		expect(getContextLimit('openai', 'gpt-5.5')).toBe(1050000);
		expect(getContextLimit('openai', 'gpt-5.5-pro')).toBe(1050000);
		expect(getModelMaxOutputTokens('openai', 'gpt-5.5')).toBe(128000);
		expect(getModelMaxOutputTokens('openai', 'gpt-5.5-pro')).toBe(128000);
	});
});
