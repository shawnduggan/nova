/**
 * @file WritingScore - Composite writing score helpers for dashboard analysis
 */

import type { WritingAnalysis } from './writing-analysis';

export const WRITING_SCORE_MIN_WORDS = 50;
export const DEFAULT_TARGET_READABILITY_GRADE = 8;

export const WRITING_SCORE_THRESHOLDS = {
	clarityPointsPerGrade: 3,
	passiveMaxScore: 15,
	passiveZeroAtPercentage: 30,
	veryLongMaxScore: 10,
	veryLongZeroAtPercentage: 20,
	varietySweetSpotMin: 4,
	varietySweetSpotMax: 12,
	varietyPenaltyAboveSweetSpot: 2,
	adverbMaxScore: 15,
	adverbZeroAtPercentage: 5,
	intensifierMaxScore: 10,
	intensifierZeroAtPer1000: 20
} as const;

export interface WritingScore {
	composite: number;
	clarity: number;
	conciseness: number;
	variety: number;
	discipline: number;
}

export type WritingScoreLabel = 'Excellent' | 'Good' | 'Fair' | 'Needs Work';

export function scoreClarityPillar(readabilityGrade: number, targetGrade: number): number {
	return Math.max(0, 25 - Math.abs(readabilityGrade - targetGrade) * WRITING_SCORE_THRESHOLDS.clarityPointsPerGrade);
}

export function scoreConcisenessPillar(passiveVoicePercentage: number, veryLongSentencePercentage: number): number {
	const passiveScore = Math.max(
		0,
		WRITING_SCORE_THRESHOLDS.passiveMaxScore -
			passiveVoicePercentage * (WRITING_SCORE_THRESHOLDS.passiveMaxScore / WRITING_SCORE_THRESHOLDS.passiveZeroAtPercentage)
	);
	const lengthScore = Math.max(
		0,
		WRITING_SCORE_THRESHOLDS.veryLongMaxScore -
			veryLongSentencePercentage *
				(WRITING_SCORE_THRESHOLDS.veryLongMaxScore / WRITING_SCORE_THRESHOLDS.veryLongZeroAtPercentage)
	);

	return Math.min(25, Math.round(passiveScore + lengthScore));
}

export function scoreVarietyPillar(sentenceLengthStdDev: number): number {
	if (
		sentenceLengthStdDev >= WRITING_SCORE_THRESHOLDS.varietySweetSpotMin &&
		sentenceLengthStdDev <= WRITING_SCORE_THRESHOLDS.varietySweetSpotMax
	) {
		return 25;
	}

	if (sentenceLengthStdDev < WRITING_SCORE_THRESHOLDS.varietySweetSpotMin) {
		return Math.round((sentenceLengthStdDev / WRITING_SCORE_THRESHOLDS.varietySweetSpotMin) * 25);
	}

	return Math.max(
		0,
		Math.round(
			25 -
				(sentenceLengthStdDev - WRITING_SCORE_THRESHOLDS.varietySweetSpotMax) *
					WRITING_SCORE_THRESHOLDS.varietyPenaltyAboveSweetSpot
		)
	);
}

export function scoreDisciplinePillar(adverbDensity: number, weakIntensifiersPer1000: number): number {
	const adverbScore = Math.max(
		0,
		WRITING_SCORE_THRESHOLDS.adverbMaxScore -
			adverbDensity * (WRITING_SCORE_THRESHOLDS.adverbMaxScore / WRITING_SCORE_THRESHOLDS.adverbZeroAtPercentage)
	);
	const intensifierScore = Math.max(
		0,
		WRITING_SCORE_THRESHOLDS.intensifierMaxScore -
			weakIntensifiersPer1000 *
				(WRITING_SCORE_THRESHOLDS.intensifierMaxScore / WRITING_SCORE_THRESHOLDS.intensifierZeroAtPer1000)
	);

	return Math.min(25, Math.round(adverbScore + intensifierScore));
}

export function calculateWritingScore(
	analysis: Pick<
		WritingAnalysis,
		'readabilityGrade' | 'passiveVoicePercentage' | 'veryLongSentencePercentage' | 'sentenceLengthStdDev' | 'adverbDensity' | 'weakIntensifierCount' | 'wordCount'
	>,
	targetGrade: number = DEFAULT_TARGET_READABILITY_GRADE
): WritingScore {
	const clarity = scoreClarityPillar(analysis.readabilityGrade, targetGrade);
	const conciseness = scoreConcisenessPillar(
		analysis.passiveVoicePercentage,
		analysis.veryLongSentencePercentage ?? 0
	);
	const variety = scoreVarietyPillar(analysis.sentenceLengthStdDev ?? 0);
	const weakIntensifiersPer1000 = analysis.wordCount > 0 ? (analysis.weakIntensifierCount / analysis.wordCount) * 1000 : 0;
	const discipline = scoreDisciplinePillar(analysis.adverbDensity, weakIntensifiersPer1000);

	return {
		composite: clarity + conciseness + variety + discipline,
		clarity,
		conciseness,
		variety,
		discipline
	};
}

export function getWritingScoreLabel(score: number): WritingScoreLabel {
	if (score >= 80) {
		return 'Excellent';
	}

	if (score >= 60) {
		return 'Good';
	}

	if (score >= 40) {
		return 'Fair';
	}

	return 'Needs Work';
}

export function getWritingScoreValueClass(score: number): string {
	if (score >= 80) {
		return 'nova-writing-dashboard-value--good';
	}

	if (score >= 60) {
		return 'nova-writing-dashboard-value--accent';
	}

	if (score >= 40) {
		return 'nova-writing-dashboard-value--warn';
	}

	return 'nova-writing-dashboard-value--bad';
}
