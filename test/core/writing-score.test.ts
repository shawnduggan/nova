/**
 * @file WritingScore Test Suite
 */

import {
	calculateWritingScore,
	getWritingScoreLabel,
	scoreClarityPillar,
	scoreConcisenessPillar,
	scoreDisciplinePillar,
	scoreVarietyPillar
} from '../../src/core/writing-score';

describe('writing score helpers', () => {
	test('returns a perfect score for ideal analysis metrics', () => {
		const score = calculateWritingScore({
			readabilityGrade: 8,
			passiveVoicePercentage: 0,
			veryLongSentencePercentage: 0,
			sentenceLengthStdDev: 7,
			adverbDensity: 0,
			weakIntensifierCount: 0,
			wordCount: 100
		});

		expect(score).toEqual({
			composite: 100,
			clarity: 25,
			conciseness: 25,
			variety: 25,
			discipline: 25
		});
		expect(getWritingScoreLabel(score.composite)).toBe('Excellent');
	});

	test('scores clarity based on distance from target grade', () => {
		expect(scoreClarityPillar(8, 8)).toBe(25);
		expect(scoreClarityPillar(10, 8)).toBe(19);
		expect(scoreClarityPillar(20, 8)).toBe(0);
	});

	test('scores conciseness, variety, and discipline at boundaries', () => {
		expect(scoreConcisenessPillar(0, 0)).toBe(25);
		expect(scoreConcisenessPillar(30, 20)).toBe(0);
		expect(scoreVarietyPillar(4)).toBe(25);
		expect(scoreVarietyPillar(2)).toBe(13);
		expect(scoreVarietyPillar(20)).toBe(9);
		expect(scoreDisciplinePillar(0, 0)).toBe(25);
		expect(scoreDisciplinePillar(5, 20)).toBe(0);
	});

	test('maps composite scores to labels', () => {
		expect(getWritingScoreLabel(85)).toBe('Excellent');
		expect(getWritingScoreLabel(70)).toBe('Good');
		expect(getWritingScoreLabel(45)).toBe('Fair');
		expect(getWritingScoreLabel(20)).toBe('Needs Work');
	});
});
