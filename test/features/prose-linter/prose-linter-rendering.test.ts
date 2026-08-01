/**
 * @file ProseLinterRendering Test Suite
 */

import { createProseIssuePage } from '../../../src/features/prose-linter/prose-linter-rendering';
import type { ProseIssue } from '../../../src/features/prose-linter/prose-linter-types';

describe('createProseIssuePage', () => {
	function issue(index: number, type: ProseIssue['type'] = 'adverb'): ProseIssue {
		return {
			id: `issue-${index}`,
			ignoreKey: `test:${type}:${index}`,
			type,
			severity: 'suggestion',
			line: index,
			startCh: 0,
			endCh: 4,
			excerpt: 'Test',
			sourceText: 'Test',
			explanation: 'Test',
			suggestion: 'Test'
		};
	}

	test('bounds large issue sets and exposes load-more state', () => {
		const issues = Array.from({ length: 125 }, (_, index) => issue(index));
		const page = createProseIssuePage({ issues });

		expect(page.issues).toHaveLength(50);
		expect(page.totalVisibleIssues).toBe(125);
		expect(page.hasMore).toBe(true);
		expect(page.nextVisibleCount).toBe(100);
	});

	test('filters hidden, ignored, and type-ignored issues before pagination', () => {
		const issues = [
			issue(0, 'adverb'),
			issue(1, 'passive-voice'),
			issue(2, 'complex-word')
		];
		const page = createProseIssuePage({
			issues,
			hiddenIssueTypes: new Set(['adverb']),
			ignoredIssueIds: new Set(['issue-1']),
			ignoredIssueTypes: new Set(['complex-word'])
		});

		expect(page.issues).toEqual([]);
		expect(page.totalVisibleIssues).toBe(0);
		expect(page.hasMore).toBe(false);
	});
});
