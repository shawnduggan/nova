import { assessSmartRevisionRisk } from '../../../src/features/smart-revision/smart-revision-risk';

describe('Smart Revision meaning risk', () => {
	test('flags changed numbers as high risk', () => {
		const risk = assessSmartRevisionRisk(
			'Revenue grew 12% in 2026.',
			'Revenue grew 18% in 2026.',
			{ doNotChange: '' }
		);

		expect(risk.level).toBe('high');
		expect(risk.flags).toEqual(expect.arrayContaining([
			expect.objectContaining({ id: 'numbers', severity: 'high' })
		]));
	});

	test('flags do-not-change terms as high risk', () => {
		const risk = assessSmartRevisionRisk(
			'Keep Project Orion as the codename.',
			'Keep Project Aurora as the codename.',
			{ doNotChange: 'Project Orion' }
		);

		expect(risk.level).toBe('high');
		expect(risk.flags).toEqual(expect.arrayContaining([
			expect.objectContaining({ id: 'do-not-change:project orion', severity: 'high' })
		]));
	});

	test('treats model self-report as advisory instead of deterministic high risk', () => {
		const risk = assessSmartRevisionRisk(
			'This sentence is wordy.',
			'This sentence is concise.',
			{ doNotChange: '' },
			'high',
			'The model is uncertain.'
		);

		expect(risk.level).toBe('medium');
		expect(risk.flags).toEqual(expect.arrayContaining([
			expect.objectContaining({ id: 'model-advisory', severity: 'medium' })
		]));
	});

	test('ignores common sentence-start words in proper noun checks', () => {
		const risk = assessSmartRevisionRisk(
			'Maybe we should use screenshots.',
			'We should use screenshots.',
			{ doNotChange: '' }
		);

		expect(risk.level).toBe('low');
		expect(risk.flags).not.toEqual(expect.arrayContaining([
			expect.objectContaining({ id: 'proper-nouns' })
		]));
	});
});
