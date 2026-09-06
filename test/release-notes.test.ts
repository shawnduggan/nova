import { getRecentReleaseNotes } from '../src/release-notes';

describe('release notes helpers', () => {
	it('returns the current release and two prior authored releases', () => {
		const notes = getRecentReleaseNotes('1.8.5');

		expect(notes.map(note => note.version)).toEqual(['1.8.5', '1.8.4', '1.8.3']);
		expect(notes[0].isCurrent).toBe(true);
		expect(notes[1].isCurrent).toBe(false);
		expect(notes[2].isCurrent).toBe(false);
		expect(notes[0].content).toContain('What\'s New in Nova 1.8.5');
		expect(notes[0].content).toContain('Four new cloud models are available');
		expect(notes[1].content).toContain('AI provider responses fail safely');
		expect(notes[2].content).toContain('Detached windows now stay in sync');
	});

	it('does not include future authored release notes', () => {
		const notes = getRecentReleaseNotes('1.8.1');

		expect(notes.map(note => note.version)).toEqual(['1.8.1']);
		expect(notes.map(note => note.version)).not.toContain('1.8.5');
		expect(notes.map(note => note.version)).not.toContain('1.8.2');
		expect(notes.map(note => note.version)).not.toContain('1.8.3');
		expect(notes.map(note => note.version)).not.toContain('1.8.4');
	});

	it('honors a custom release count', () => {
		const notes = getRecentReleaseNotes('1.8.2', 2);

		expect(notes.map(note => note.version)).toEqual(['1.8.2', '1.8.1']);
	});
});
