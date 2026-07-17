import { getRecentReleaseNotes } from '../src/release-notes';

describe('release notes helpers', () => {
	it('returns the current release and two prior authored releases', () => {
		const notes = getRecentReleaseNotes('1.8.1');

		expect(notes.map(note => note.version)).toEqual(['1.8.1', '1.8.0', '1.7.1']);
		expect(notes[0].isCurrent).toBe(true);
		expect(notes[1].isCurrent).toBe(false);
		expect(notes[2].isCurrent).toBe(false);
		expect(notes[0].content).toContain('What\'s New in Nova 1.8.1');
	});

	it('does not include future authored release notes', () => {
		const notes = getRecentReleaseNotes('1.7.0');

		expect(notes.map(note => note.version)).toEqual(['1.7.0', '1.6.3']);
		expect(notes.map(note => note.version)).not.toContain('1.8.0');
		expect(notes.map(note => note.version)).not.toContain('1.8.1');
	});

	it('honors a custom release count', () => {
		const notes = getRecentReleaseNotes('1.8.1', 2);

		expect(notes.map(note => note.version)).toEqual(['1.8.1', '1.8.0']);
	});
});
