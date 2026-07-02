import { SmartRevisionService } from '../../../src/features/smart-revision/smart-revision-service';
import { DEFAULT_SMART_REVISION_BRIEF } from '../../../src/features/smart-revision/smart-revision-types';

describe('SmartRevisionService', () => {
	test('creates a mapped card session when model cards compose safely', async () => {
		const service = new SmartRevisionService(createProvider({
			revisedText: 'This is clear.',
			rationale: 'Tightened wording.',
			meaningRisk: 'low',
			cards: [{
				label: 'Simplified phrase',
				originalText: 'very unclear',
				revisedText: 'clear',
				rationale: 'Direct wording.',
				risk: 'low'
			}]
		}) as never);

		const session = await service.generateSession({
			target: {
				text: 'This is very unclear.',
				range: { from: { line: 0, ch: 0 }, to: { line: 0, ch: 21 } },
				filePath: 'note.md'
			},
			brief: { ...DEFAULT_SMART_REVISION_BRIEF },
			now: () => 10
		});

		expect(session.cards).toHaveLength(1);
		expect(session.cards[0]).toEqual(expect.objectContaining({
			label: 'Simplified phrase',
			startIndex: 8,
			endIndex: 20,
			status: 'accepted'
		}));
		expect(session.risk.level).toBe('low');
		expect(session.impact.metrics.length).toBeGreaterThan(0);
	});

	test('keeps high-risk generated cards pending by default', async () => {
		const service = new SmartRevisionService(createProvider({
			revisedText: 'Revenue grew 18%.',
			rationale: 'Updated the metric.',
			meaningRisk: 'high',
			cards: [{
				label: 'Changed number',
				originalText: '12%',
				revisedText: '18%',
				rationale: 'Adjusted the stated growth rate.',
				risk: 'high'
			}]
		}) as never);

		const session = await service.generateSession({
			target: {
				text: 'Revenue grew 12%.',
				range: { from: { line: 0, ch: 0 }, to: { line: 0, ch: 17 } },
				filePath: 'note.md'
			},
			brief: { ...DEFAULT_SMART_REVISION_BRIEF },
			now: () => 10
		});

		expect(session.cards).toHaveLength(1);
		expect(session.cards[0]).toEqual(expect.objectContaining({
			label: 'Changed number',
			status: 'pending'
		}));
		expect(session.risk.level).toBe('high');
	});

	test('falls back to a whole-passage card when model cards do not map', async () => {
		const service = new SmartRevisionService(createProvider({
			revisedText: 'This is clear.',
			rationale: 'Tightened wording.',
			meaningRisk: 'low',
			cards: [{
				label: 'Bad map',
				originalText: 'missing phrase',
				revisedText: 'clear',
				rationale: 'Direct wording.'
			}]
		}) as never);

		const session = await service.generateSession({
			target: {
				text: 'This is very unclear.',
				range: { from: { line: 0, ch: 0 }, to: { line: 0, ch: 21 } },
				filePath: 'note.md'
			},
			brief: { ...DEFAULT_SMART_REVISION_BRIEF },
			now: () => 10
		});

		expect(session.cards).toHaveLength(1);
		expect(session.cards[0]).toEqual(expect.objectContaining({
			label: 'Revised passage',
			originalText: 'This is very unclear.',
			revisedText: 'This is clear.'
		}));
	});

	test('fails safely on malformed model output', async () => {
		const provider = {
			complete: jest.fn(async () => 'no json')
		};
		const service = new SmartRevisionService(provider as never);

		await expect(service.generateSession({
			target: {
				text: 'This is rough.',
				range: { from: { line: 0, ch: 0 }, to: { line: 0, ch: 14 } },
				filePath: 'note.md'
			},
			brief: { ...DEFAULT_SMART_REVISION_BRIEF }
		})).rejects.toThrow('could not read');
	});
});

function createProvider(response: unknown) {
	return {
		complete: jest.fn(async () => JSON.stringify(response))
	};
}
