import {
	buildSmartRevisionPrompts,
	extractFirstJsonObject,
	parseSmartRevisionModelResult
} from '../../../src/features/smart-revision/smart-revision-prompts';
import {
	DEFAULT_SMART_REVISION_BRIEF,
	SMART_REVISION_PASSES,
	type SmartRevisionPassId
} from '../../../src/features/smart-revision/smart-revision-types';

describe('Smart Revision prompt construction', () => {
	test('passes distinct focus and avoidance guidance for every revision pass', () => {
		const expectedGuidance: Record<SmartRevisionPassId, string[]> = {
			clarity: ['Focus on comprehension', 'Avoid mere shortening'],
			tighten: ['Focus on economy', 'avoid adding transitions'],
			flow: ['Focus on cadence and movement', 'Avoid optimizing for brevity alone'],
			'more-human': ['Focus on natural, specific language', 'avoid slang']
		};

		const userPrompts = SMART_REVISION_PASSES.map((pass) => {
			const { userPrompt } = buildSmartRevisionPrompts({
				pass,
				brief: { ...DEFAULT_SMART_REVISION_BRIEF, passId: pass.id },
				selectedText: 'This is very unclear and kind of hard to read.'
			});

			expect(userPrompt).toContain(`Revision pass: ${pass.label}`);
			expect(userPrompt).toContain(`Pass instruction: ${pass.prompt}`);
			for (const expected of expectedGuidance[pass.id]) {
				expect(userPrompt).toContain(expected);
			}

			return userPrompt;
		});

		expect(new Set(userPrompts).size).toBe(SMART_REVISION_PASSES.length);
	});
});

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
