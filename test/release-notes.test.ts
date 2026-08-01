import { getRecentReleaseNotes } from '../src/release-notes';

describe('release notes helpers', () => {
	it('returns the current release and two prior authored releases', () => {
		const notes = getRecentReleaseNotes('1.8.3');

		expect(notes.map(note => note.version)).toEqual(['1.8.3', '1.8.2', '1.8.1']);
		expect(notes[0].isCurrent).toBe(true);
		expect(notes[1].isCurrent).toBe(false);
		expect(notes[2].isCurrent).toBe(false);
		expect(notes[0].content).toContain('What\'s New in Nova 1.8.3');
		expect(notes[0].content).toContain('Detached windows now stay in sync');
		expect(notes[1].content).toContain('[Terms of Service](https://novawriter.ai/terms)');
		expect(notes[1].content).toContain('[Privacy Policy](https://novawriter.ai/privacy)');
		expect(notes[1].content).toContain('The optional newsletter is paused');
	});

	it('does not include future authored release notes', () => {
		const notes = getRecentReleaseNotes('1.7.1');

		expect(notes.map(note => note.version)).toEqual(['1.7.1']);
		expect(notes.map(note => note.version)).not.toContain('1.8.0');
		expect(notes.map(note => note.version)).not.toContain('1.8.1');
		expect(notes.map(note => note.version)).not.toContain('1.8.2');
		expect(notes.map(note => note.version)).not.toContain('1.8.3');
	});

	it('honors a custom release count', () => {
		const notes = getRecentReleaseNotes('1.8.1', 2);

		expect(notes.map(note => note.version)).toEqual(['1.8.1', '1.8.0']);
	});
});
