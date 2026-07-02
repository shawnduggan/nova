import {
	extractFirstJsonObject,
	parseSmartRevisionModelResult
} from '../../../src/features/smart-revision/smart-revision-prompts';

describe('Smart Revision structured output parsing', () => {
	test('extracts the first JSON object from surrounding text', () => {
		const json = extractFirstJsonObject('prefix {"revisedText":"Clean text","cards":[]} suffix');

		expect(json).toBe('{"revisedText":"Clean text","cards":[]}');
	});

	test('parses a valid model result', () => {
		const result = parseSmartRevisionModelResult(JSON.stringify({
			revisedText: 'Clean text.',
			rationale: 'Tightened wording.',
			meaningRisk: 'low',
			cards: [{ label: 'Removed hedge', originalText: 'kind of', revisedText: '', rationale: 'Sharper.' }]
		}));

		expect(result.revisedText).toBe('Clean text.');
		expect(result.rationale).toBe('Tightened wording.');
		expect(result.risk).toBe('low');
		expect(result.cards).toHaveLength(1);
	});

	test('preserves revised text boundary whitespace', () => {
		const result = parseSmartRevisionModelResult(JSON.stringify({
			revisedText: '  Clean text.\n',
			cards: []
		}));

		expect(result.revisedText).toBe('  Clean text.\n');
	});

	test('rejects malformed output', () => {
		expect(() => parseSmartRevisionModelResult('not json')).toThrow('could not read');
		expect(() => parseSmartRevisionModelResult('{"cards":[]}')).toThrow('empty revision');
	});
});
