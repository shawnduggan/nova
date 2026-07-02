import {
	createSmartRevisionDiff,
	projectAcceptedSmartRevisionText
} from '../../../src/features/smart-revision/smart-revision-diff';
import type { SmartRevisionCard } from '../../../src/features/smart-revision/smart-revision-types';

describe('Smart Revision diff helpers', () => {
	test('creates insert and delete segments for changed text', () => {
		const segments = createSmartRevisionDiff('This is very wordy.', 'This is concise.');

		expect(segments).toEqual(expect.arrayContaining([
			expect.objectContaining({ type: 'delete' }),
			expect.objectContaining({ type: 'insert' })
		]));
	});

	test('projects only accepted cards into the final text', () => {
		const cards: SmartRevisionCard[] = [
			createCard('c1', 'very wordy', 'concise', 8, 18, 'accepted'),
			createCard('c2', 'today', 'right now', 19, 24, 'rejected')
		];

		expect(projectAcceptedSmartRevisionText('This is very wordy today.', cards)).toBe('This is concise today.');
	});
});

function createCard(
	id: string,
	originalText: string,
	revisedText: string,
	startIndex: number,
	endIndex: number,
	status: SmartRevisionCard['status']
): SmartRevisionCard {
	return {
		id,
		label: 'Test card',
		originalText,
		revisedText,
		rationale: 'Test rationale',
		risk: { level: 'low', flags: [] },
		status,
		startIndex,
		endIndex
	};
}
