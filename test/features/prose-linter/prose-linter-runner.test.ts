/**
 * @file ProseLinterRunner Test Suite
 */

import { createAnalysisRunToken } from '../../../src/core/writing-analysis-runner';
import { runBudgetedProseLinter } from '../../../src/features/prose-linter/prose-linter-runner';
import { GENERAL_PROSE_CONFIG, type ProseIssue } from '../../../src/features/prose-linter/prose-linter-types';

describe('runBudgetedProseLinter', () => {
	const token = createAnalysisRunToken('note.md', 'hash', 1);
	const issue: ProseIssue = {
		id: 'issue',
		ignoreKey: 'test:qualifier',
		type: 'qualifier',
		severity: 'suggestion',
		line: 0,
		startCh: 0,
		endCh: 5,
		excerpt: 'Maybe',
		sourceText: 'Maybe',
		explanation: 'Test',
		suggestion: 'Test'
	};

	test('runs rules under budget and returns complete state', () => {
		let now = 0;
		const result = runBudgetedProseLinter({
			content: 'Maybe this works.',
			config: GENERAL_PROSE_CONFIG,
			filePath: 'note.md',
			runToken: token,
			budgetMs: 10,
			now: () => now++,
			rules: [
				{ id: 'one', run: () => [issue] },
				{ id: 'two', run: () => [] }
			]
		});

		expect(result.state).toBe('complete');
		expect(result.issues).toEqual([issue]);
		expect(result.deferredRuleIds).toEqual([]);
	});

	test('returns pending state when the budget is exceeded before remaining rules', () => {
		let calls = 0;
		const result = runBudgetedProseLinter({
			content: 'Maybe this works.',
			config: GENERAL_PROSE_CONFIG,
			filePath: 'note.md',
			runToken: token,
			budgetMs: 2,
			now: () => calls++ * 3,
			rules: [
				{ id: 'one', run: () => [issue] },
				{ id: 'two', run: () => [] }
			]
		});

		expect(result.state).toBe('pending');
		expect(result.issues).toEqual([issue]);
		expect(result.deferredRuleIds).toEqual(['two']);
	});

	test('rejects stale work before running more rules', () => {
		let stale = false;
		const result = runBudgetedProseLinter({
			content: 'Maybe this works.',
			config: GENERAL_PROSE_CONFIG,
			filePath: 'note.md',
			runToken: token,
			isStale: () => {
				const wasStale = stale;
				stale = true;
				return wasStale;
			},
			rules: [
				{ id: 'one', run: () => [issue] },
				{ id: 'two', run: () => [] }
			]
		});

		expect(result.state).toBe('stale');
		expect(result.issues).toEqual([]);
		expect(result.deferredRuleIds).toEqual(['two']);
	});
});
