import { getRecentReleaseNotes } from '../src/release-notes';

describe('release notes helpers', () => {
	it('returns the current release and two prior authored releases', () => {
		const notes = getRecentReleaseNotes('1.5.5');

		expect(notes.map(note => note.version)).toEqual(['1.5.5', '1.5.4', '1.5.3']);
		expect(notes[0].isCurrent).toBe(true);
		expect(notes[1].isCurrent).toBe(false);
		expect(notes[2].isCurrent).toBe(false);
		expect(notes[0].content).toContain('What\'s New in Nova 1.5.5');
	});

	it('does not include future authored release notes', () => {
		const notes = getRecentReleaseNotes('1.5.4');

		expect(notes.map(note => note.version)).toEqual(['1.5.4', '1.5.3', '1.5.2']);
	});

	it('honors a custom release count', () => {
		const notes = getRecentReleaseNotes('1.5.5', 2);

		expect(notes.map(note => note.version)).toEqual(['1.5.5', '1.5.4']);
	});
});
