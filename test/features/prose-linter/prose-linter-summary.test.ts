/**
 * @file ProseLinterSummary Test Suite
 */

import { analyzeWriting } from '../../../src/core/writing-analysis';
import { buildProseLinterSummary } from '../../../src/features/prose-linter/prose-linter-summary';
import type { ProseIssue } from '../../../src/features/prose-linter/prose-linter-types';

describe('buildProseLinterSummary', () => {
	function issue(type: ProseIssue['type']): ProseIssue {
		const id = type + Math.random().toString();
		return {
			id,
			ignoreKey: `test:${id}`,
			type,
			severity: 'warning',
			line: 0,
			startCh: 0,
			endCh: 4,
			excerpt: 'Example',
			sourceText: 'Test',
			explanation: 'Test',
			suggestion: 'Test'
		};
	}

	test('returns target/current grade, issue density, top categories, and closest path', () => {
		const analysis = analyzeWriting('This sentence is simple. This sentence is also simple.');
		const summary = buildProseLinterSummary({
			analysis,
			issues: [
				issue('passive-voice'),
				issue('passive-voice'),
				issue('very-long-sentence'),
				issue('complex-word')
			],
			targetGrade: 8
		});

		expect(summary.targetGrade).toBe(8);
		expect(summary.currentGrade).toBe(analysis.readabilityGrade);
		expect(summary.issueCount).toBe(4);
		expect(summary.issueDensityPerThousandWords).toBeGreaterThan(0);
		expect(summary.topCategories.map((category) => [category.type, category.count])).toEqual([
			['passive-voice', 2],
			['very-long-sentence', 1],
			['complex-word', 1]
		]);
		expect(summary.closestPath).toContain('very long sentences');
	});

	test('respects visible category filters', () => {
		const analysis = analyzeWriting('This sentence is simple.');
		const summary = buildProseLinterSummary({
			analysis,
			issues: [issue('passive-voice'), issue('complex-word')],
			visibleIssueTypes: new Set(['complex-word'])
		});

		expect(summary.issueCount).toBe(1);
		expect(summary.topCategories.map((category) => category.type)).toEqual(['complex-word']);
	});
});
