/**
 * @file SmartRevisionImpact - Before/after local writing-analysis impact helpers
 */

import { analyzeWriting, type WritingAnalysis } from '../../core/writing-analysis';
import type { SmartRevisionImpactMetric, SmartRevisionImpactReport } from './smart-revision-types';

export function createSmartRevisionImpactReport(originalText: string, revisedText: string): SmartRevisionImpactReport {
	const before = analyzeWriting(originalText);
	const after = analyzeWriting(revisedText);
	const metrics: SmartRevisionImpactMetric[] = [
		createNumericMetric('Readability grade', roundGrade(before.readabilityGrade), roundGrade(after.readabilityGrade), 'lower'),
		createNumericMetric('Long sentences', countLongSentences(before), countLongSentences(after), 'lower'),
		createNumericMetric('Very long sentences', countVeryLongSentences(before), countVeryLongSentences(after), 'lower'),
		createNumericMetric('Weak phrases', before.weakIntensifierCount, after.weakIntensifierCount, 'lower'),
		createNumericMetric('Passive voice', before.passiveSentenceCount, after.passiveSentenceCount, 'lower'),
		createNumericMetric('Adverbs', before.adverbs.length, after.adverbs.length, 'lower')
	];
	const improvedCount = metrics.filter((metric) => metric.improved).length;
	const unchangedCount = metrics.filter((metric) => metric.unchanged).length;
	const summary = improvedCount > 0
		? `${improvedCount} ${improvedCount === 1 ? 'measure' : 'measures'} improved`
		: unchangedCount === metrics.length ? 'No local metrics changed' : 'Mixed local impact';

	return { metrics, summary };
}

function countLongSentences(analysis: WritingAnalysis): number {
	return analysis.sentences.filter((sentence) => sentence.severity === 'long' || sentence.severity === 'very-long').length;
}

function countVeryLongSentences(analysis: WritingAnalysis): number {
	return analysis.sentences.filter((sentence) => sentence.severity === 'very-long').length;
}

function roundGrade(value: number): number {
	return Math.max(0, Math.round(value));
}

function createNumericMetric(
	label: string,
	before: number,
	after: number,
	direction: 'lower' | 'higher'
): SmartRevisionImpactMetric {
	const improved = direction === 'lower' ? after < before : after > before;
	const unchanged = after === before;
	return {
		label,
		before: before.toLocaleString(),
		after: after.toLocaleString(),
		improved,
		unchanged
	};
}
