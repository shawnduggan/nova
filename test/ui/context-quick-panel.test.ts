/**
 * @file ContextQuickPanel tests - Verifies collapsed context summary behavior
 */

import { TFile } from 'obsidian';
import { formatCollapsedContextInfo } from '../../src/ui/context-quick-panel';
import { DocumentReference } from '../../src/ui/context-manager';

function createDocumentReference(path: string, tokenCount = 0): DocumentReference {
	const file = new TFile(path);
	return {
		file,
		isPersistent: true,
		rawReference: `[[${file.basename}]]`,
		tokenCount
	};
}

describe('formatCollapsedContextInfo', () => {
	const currentFile = new TFile('notes/current.md');

	it('counts the active note with its aggregate token estimate', () => {
		expect(formatCollapsedContextInfo(currentFile, {
			persistentDocs: [],
			tokenCount: 7
		})).toBe('1 note · 7 tokens');
	});

	it('counts additional notes while using aggregate context tokens', () => {
		expect(formatCollapsedContextInfo(currentFile, {
			persistentDocs: [
				createDocumentReference('notes/first.md', 900),
				createDocumentReference('notes/second.md', 700)
			],
			tokenCount: 1450
		})).toBe('3 notes · 1.4K tokens');
	});

	it('does not double-count the active note if it is also referenced', () => {
		expect(formatCollapsedContextInfo(currentFile, {
			persistentDocs: [
				createDocumentReference('notes/current.md', 25),
				createDocumentReference('notes/second.md', 50)
			],
			tokenCount: 75
		})).toBe('2 notes · 75 tokens');
	});

	it('reports zero only when no built active context exists', () => {
		expect(formatCollapsedContextInfo(null, null)).toBe('0 notes · 0 tokens');
		expect(formatCollapsedContextInfo(currentFile, null)).toBe('0 notes · 0 tokens');
	});
});
