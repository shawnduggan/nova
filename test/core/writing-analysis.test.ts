/**
 * WritingAnalysis Test Suite
 * Tests for deterministic writing quality analysis
 */

import { analyzeWriting, clearWritingAnalysisCache } from '../../src/core/writing-analysis';

describe('analyzeWriting', () => {
	beforeEach(() => {
		clearWritingAnalysisCache();
	});

	function makeWords(count: number, prefix = 'word'): string {
		return Array.from({ length: count }, (_, index) => `${prefix}${index + 1}`).join(' ');
	}

	describe('frontmatter opt-out', () => {
		test('returns a no-op result when frontmatter opts analysis out with "off"', () => {
			const content = [
				'---',
				' nova-analysis: off',
				' title: Sample',
				'---',
				'This text should not be analyzed.'
			].join('\n');

			const result = analyzeWriting(content);

			expect(result.wordCount).toBe(0);
			expect(result.sentenceCount).toBe(0);
			expect(result.paragraphCount).toBe(0);
			expect(result.readingTimeMinutes).toBe(0);
			expect(result.readabilityGrade).toBe(0);
			expect(result.passiveVoicePercentage).toBe(0);
			expect(result.passiveSentenceCount).toBe(0);
			expect(result.adverbDensity).toBe(0);
			expect(result.weakIntensifierCount).toBe(0);
			expect(result.sentences).toEqual([]);
			expect(result.passiveVoice).toEqual([]);
			expect(result.adverbs).toEqual([]);
			expect(result.weakIntensifiers).toEqual([]);
			expect(result.readabilityLabel).toContain('disabled');
		});

		test('returns a no-op result when frontmatter opts analysis out with "false"', () => {
			const content = [
				'---',
				'nova-analysis: false',
				'---',
				'This text should not be analyzed.'
			].join('\n');

			const result = analyzeWriting(content);
			expect(result.wordCount).toBe(0);
			expect(result.readabilityLabel).toContain('disabled');
		});

		test('handles quoted frontmatter values', () => {
			const content = [
				'---',
				'nova-analysis: "false"',
				'---',
				'This text should not be analyzed.'
			].join('\n');

			const result = analyzeWriting(content);
			expect(result.wordCount).toBe(0);
			expect(result.readabilityLabel).toContain('disabled');
		});

		test('handles single-quoted frontmatter values', () => {
			const content = [
				'---',
				"nova-analysis: 'off'",
				'---',
				'This text should not be analyzed.'
			].join('\n');

			const result = analyzeWriting(content);
			expect(result.wordCount).toBe(0);
			expect(result.readabilityLabel).toContain('disabled');
		});

		test('does not opt out when nova-analysis is true', () => {
			const content = [
				'---',
				'nova-analysis: true',
				'---',
				'This text should be analyzed.'
			].join('\n');

			const result = analyzeWriting(content);
			expect(result.wordCount).toBe(5);
		});

		test('handles document that is entirely frontmatter', () => {
			const content = [
				'---',
				'title: Sample',
				'tags: test',
				'---'
			].join('\n');

			const result = analyzeWriting(content);
			expect(result.wordCount).toBe(0);
			expect(result.sentenceCount).toBe(0);
			expect(result.readabilityLabel).toBe('Not enough text');
		});
	});

	describe('empty and minimal documents', () => {
		test('handles empty string', () => {
			const result = analyzeWriting('');
			expect(result.wordCount).toBe(0);
			expect(result.sentenceCount).toBe(0);
			expect(result.paragraphCount).toBe(0);
			expect(result.readingTimeMinutes).toBe(0);
			expect(result.readabilityGrade).toBe(0);
			expect(result.passiveVoicePercentage).toBe(0);
			expect(result.passiveSentenceCount).toBe(0);
			expect(result.readabilityLabel).toBe('Not enough text');
			expect(result.sentenceLengthStdDev).toBe(0);
			expect(result.veryLongSentencePercentage).toBe(0);
		});

		test('handles whitespace-only document', () => {
			const result = analyzeWriting('   \n\n   \n');
			expect(result.wordCount).toBe(0);
			expect(result.sentenceCount).toBe(0);
			expect(result.paragraphCount).toBe(0);
		});

		test('handles single word without sentence terminator', () => {
			const result = analyzeWriting('Hello');
			expect(result.wordCount).toBe(1);
			expect(result.sentenceCount).toBe(1);
			expect(result.paragraphCount).toBe(1);
		});

		test('handles single word with sentence terminator', () => {
			const result = analyzeWriting('Hello.');
			expect(result.wordCount).toBe(1);
			expect(result.sentenceCount).toBe(1);
		});

		test('computes sentence length standard deviation and very long sentence percentage', () => {
			const content = [
				`${makeWords(5)}.`,
				`${makeWords(15, 'medium')}.`,
				`${makeWords(45, 'long')}.`
			].join(' ');

			const result = analyzeWriting(content);

			expect(result.sentences.map((sentence) => sentence.wordCount)).toEqual([5, 15, 45]);
			expect(result.sentenceLengthStdDev).toBeCloseTo(17, 0);
			expect(result.veryLongSentencePercentage).toBeCloseTo(33.33, 2);
		});
	});

	describe('content blanking', () => {
		test('skips frontmatter, fenced code, and inline code for all metrics', () => {
			const content = [
				'---',
				'title: Sample',
				'---',
				'Outside text is simple and `really`.',
				'',
				'```ts',
				'The draft was written very quickly.',
				'```',
				'',
				'Another outside sentence was written carefully.'
			].join('\n');

			const result = analyzeWriting(content);

			expect(result.wordCount).toBe(11);
			expect(result.sentenceCount).toBe(2);
			expect(result.paragraphCount).toBe(2);
			expect(result.passiveVoice).toHaveLength(1);
			expect(result.adverbs).toHaveLength(1);
			expect(result.weakIntensifierCount).toBe(0);
			expect(result.passiveVoicePercentage).toBe(50);
			expect(result.passiveSentenceCount).toBe(1);
			expect(result.adverbDensity).toBeCloseTo(9.09, 2);
			expect(result.sentences.map((sentence) => sentence.wordCount)).toEqual([5, 6]);
			expect(result.readabilityLabel).toContain('Grade');
		});

		test('handles nested/multiple fenced code blocks', () => {
			const content = [
				'First sentence here.',
				'',
				'```js',
				'const x = 1;',
				'```',
				'',
				'Middle sentence here.',
				'',
				'~~~python',
				'print("hello")',
				'~~~',
				'',
				'Last sentence here.'
			].join('\n');

			const result = analyzeWriting(content);
			expect(result.sentenceCount).toBe(3);
			expect(result.paragraphCount).toBe(3);
		});

		test('handles unclosed fenced code block', () => {
			const content = [
				'First sentence here.',
				'',
				'```js',
				'This was written badly.',
				'More passive voice was used.'
			].join('\n');

			const result = analyzeWriting(content);
			// Everything after the unclosed fence should be blanked
			expect(result.sentenceCount).toBe(1);
			expect(result.passiveVoice).toHaveLength(0);
		});

		test('handles tilde fenced code blocks', () => {
			const content = [
				'Outside text here.',
				'~~~',
				'Inside the really bad code.',
				'~~~',
				'More outside text here.'
			].join('\n');

			const result = analyzeWriting(content);
			expect(result.sentenceCount).toBe(2);
			expect(result.weakIntensifierCount).toBe(0);
		});

		test('blanks inline code spans preserving surrounding text', () => {
			const content = 'Use `really very` to do things quickly.';

			const result = analyzeWriting(content);
			// "really very" is inside backticks, should not be counted as intensifiers
			expect(result.weakIntensifierCount).toBe(0);
			expect(result.adverbs.map((a) => a.word.toLowerCase())).toEqual(['quickly']);
		});
	});

	describe('blockquote handling', () => {
		test('skips weak intensifiers inside block quotes but keeps other metrics', () => {
			const content = '> The report was really written by the team carefully.';

			const result = analyzeWriting(content);

			expect(result.wordCount).toBe(9);
			expect(result.sentenceCount).toBe(1);
			expect(result.passiveVoice).toHaveLength(1);
			expect(result.adverbs).toHaveLength(1); // "carefully" only; "really" is a weak intensifier
			expect(result.weakIntensifierCount).toBe(0);
			expect(result.weakIntensifiers).toEqual([]);
			expect(result.passiveVoicePercentage).toBe(100);
		});

		test('handles nested blockquotes', () => {
			const content = '>> This is very deeply quoted.';

			const result = analyzeWriting(content);
			expect(result.weakIntensifierCount).toBe(0);
		});
	});

	describe('dashboard metrics', () => {
		test('calculates sentence length standard deviation and very long sentence percentage', () => {
			const content = [
				`${makeWords(2, 'short')}.`,
				`${makeWords(6, 'medium')}.`,
				`${makeWords(41, 'verylong')}.`
			].join(' ');

			const result = analyzeWriting(content);

			expect(result.sentenceCount).toBe(3);
			expect(result.sentences.map((sentence) => sentence.wordCount)).toEqual([2, 6, 41]);
			expect(result.sentenceLengthStdDev).toBeCloseTo(17.52, 2);
			expect(result.veryLongSentencePercentage).toBeCloseTo(33.33, 2);
		});
	});

	describe('weak intensifiers', () => {
		test('detects the full weak intensifier list', () => {
			const content = 'very really quite somewhat rather just basically actually literally definitely certainly probably simply extremely absolutely.';

			const result = analyzeWriting(content);

			expect(result.wordCount).toBe(15);
			expect(result.sentenceCount).toBe(1);
			expect(result.weakIntensifierCount).toBe(15);
			expect(result.weakIntensifiers.map((item) => item.word.toLowerCase())).toEqual([
				'very',
				'really',
				'quite',
				'somewhat',
				'rather',
				'just',
				'basically',
				'actually',
				'literally',
				'definitely',
				'certainly',
				'probably',
				'simply',
				'extremely',
				'absolutely'
			]);
		});

		test('provides accurate positions for weak intensifiers', () => {
			const content = 'He is very tall.';

			const result = analyzeWriting(content);
			expect(result.weakIntensifiers).toHaveLength(1);
			expect(result.weakIntensifiers[0].line).toBe(0);
			expect(result.weakIntensifiers[0].startCh).toBe(6);
			expect(result.weakIntensifiers[0].endCh).toBe(10);
			expect(result.weakIntensifiers[0].word).toBe('very');
		});
	});

	describe('passive voice', () => {
		test('detects passive voice with regular past participles (-ed)', () => {
			const content = 'The report was reviewed.';
			const result = analyzeWriting(content);
			expect(result.passiveVoice).toHaveLength(1);
			expect(result.passiveSentenceCount).toBe(1);
			expect(result.passiveVoicePercentage).toBe(100);
		});

		test('detects passive voice with irregular participles', () => {
			const content = 'The letter was written. The choice was made.';
			const result = analyzeWriting(content);
			expect(result.passiveVoice).toHaveLength(2);
			expect(result.passiveSentenceCount).toBe(2);
		});

		test('detects multiple passive constructions in a single sentence', () => {
			const content = 'The report was written and the code was reviewed.';
			const result = analyzeWriting(content);
			// Two matches but only one sentence
			expect(result.passiveVoice).toHaveLength(2);
			expect(result.passiveSentenceCount).toBe(1);
			expect(result.passiveVoicePercentage).toBe(100);
		});

		test('passiveSentenceCount differs from passiveVoice.length with multi-match sentences', () => {
			const content = [
				'The draft was written and the pages were printed.',
				'This is a clean active sentence.'
			].join(' ');

			const result = analyzeWriting(content);
			expect(result.passiveVoice.length).toBe(2);
			expect(result.passiveSentenceCount).toBe(1);
			expect(result.sentenceCount).toBe(2);
			expect(result.passiveVoicePercentage).toBe(50);
		});

		test('does not flag active voice', () => {
			const content = 'The author wrote the report. The team reviewed the code.';
			const result = analyzeWriting(content);
			expect(result.passiveVoice).toHaveLength(0);
			expect(result.passiveSentenceCount).toBe(0);
			expect(result.passiveVoicePercentage).toBe(0);
		});

		test('detects various passive auxiliary forms', () => {
			const content = [
				'It is known.',
				'It was built.',
				'They were chosen.',
				'It has been done.',
				'It is being reviewed.'
			].join(' ');

			const result = analyzeWriting(content);
			expect(result.passiveVoice.length).toBeGreaterThanOrEqual(5);
		});

		test('provides accurate positions for passive voice matches', () => {
			const content = 'The report was written.';
			const result = analyzeWriting(content);
			expect(result.passiveVoice).toHaveLength(1);
			expect(result.passiveVoice[0].line).toBe(0);
			expect(result.passiveVoice[0].startCh).toBe(11);
			expect(result.passiveVoice[0].match).toBe('was written');
		});
	});

	describe('adverbs', () => {
		test('detects -ly adverbs', () => {
			const content = 'She walked quickly and spoke softly.';
			const result = analyzeWriting(content);
			expect(result.adverbs.map((a) => a.word.toLowerCase())).toEqual(['quickly', 'softly']);
		});

		test('excludes non-adverb -ly words', () => {
			const excluded = ['only', 'family', 'early', 'likely', 'lonely', 'friendly',
				'daily', 'holy', 'ugly', 'rely', 'apply', 'supply', 'fly', 'july',
				'rally', 'belly', 'bully', 'fully'];

			const content = excluded.join(' ') + '.';
			const result = analyzeWriting(content);
			expect(result.adverbs).toHaveLength(0);
		});

		test('calculates adverb density correctly', () => {
			// 2 adverbs in 10 words = 20 per 100
			const content = 'She quickly ran and softly spoke to the two others.';
			const result = analyzeWriting(content);
			const adverbCount = result.adverbs.length;
			expect(result.adverbDensity).toBeCloseTo((adverbCount / result.wordCount) * 100, 2);
		});

		test('provides accurate positions for adverbs', () => {
			const content = 'She ran quickly.';
			const result = analyzeWriting(content);
			expect(result.adverbs).toHaveLength(1);
			expect(result.adverbs[0].line).toBe(0);
			expect(result.adverbs[0].startCh).toBe(8);
			expect(result.adverbs[0].endCh).toBe(15);
			expect(result.adverbs[0].word.toLowerCase()).toBe('quickly');
		});
	});

	describe('sentence splitting', () => {
		test('detects passive voice, adverbs, and sentence length thresholds', () => {
			const content = [
				`${makeWords(5)}.`,
				`${makeWords(9)}.`,
				'The report was written carefully.',
				`${makeWords(14)}.`
			].join(' ');

			const result = analyzeWriting(content, {
				longSentenceThreshold: 8,
				veryLongSentenceThreshold: 12
			});

			expect(result.wordCount).toBe(33);
			expect(result.sentenceCount).toBe(4);
			expect(result.sentences.map((sentence) => sentence.wordCount)).toEqual([5, 9, 5, 14]);
			expect(result.sentences.map((sentence) => sentence.severity)).toEqual([
				'ok',
				'long',
				'ok',
				'very-long'
			]);
			expect(result.passiveVoice).toHaveLength(1);
			expect(result.adverbs.map((item) => item.word.toLowerCase())).toEqual(['carefully']);
			expect(result.passiveVoicePercentage).toBe(25);
			expect(result.passiveSentenceCount).toBe(1);
			expect(result.adverbDensity).toBeCloseTo(3.03, 2);
			expect(result.readabilityGrade).toBeGreaterThan(0);
			expect(result.readabilityLabel).toContain('Grade');
		});

		test('handles abbreviations and decimals without splitting sentences incorrectly', () => {
			const content = 'Dr. Smith paid 3.5 dollars. We met e.g. at noon. Another sentence follows.';

			const result = analyzeWriting(content);

			expect(result.sentenceCount).toBe(3);
			expect(result.sentences.map((sentence) => sentence.wordCount)).toHaveLength(3);
			expect(result.sentences[0].line).toBe(0);
			expect(result.sentences[1].line).toBe(0);
			expect(result.sentences[2].line).toBe(0);
		});

		test('splits on exclamation marks', () => {
			const content = 'What a day! It was incredible.';
			const result = analyzeWriting(content);
			expect(result.sentenceCount).toBe(2);
		});

		test('splits on question marks', () => {
			const content = 'Is this working? I think so.';
			const result = analyzeWriting(content);
			expect(result.sentenceCount).toBe(2);
		});

		test('handles multiple consecutive periods (ellipsis-like) within sentences', () => {
			const content = 'The end... is near. Another sentence here.';
			const result = analyzeWriting(content);
			// "The end..." is a sentence, "is near." is ambiguous but should not crash
			expect(result.sentenceCount).toBeGreaterThanOrEqual(2);
		});

		test('handles text ending without period', () => {
			const content = 'First sentence here. Second sentence without a period';
			const result = analyzeWriting(content);
			expect(result.sentenceCount).toBe(2);
		});

		test('handles all abbreviations without false splits', () => {
			const content = 'Mr. Jones and Mrs. Smith met with Dr. Brown at No. 5 St. Mark in the U.S. today.';
			const result = analyzeWriting(content);
			expect(result.sentenceCount).toBe(1);
		});

		test('provides accurate startCh and endCh positions', () => {
			const content = 'Short. Another short one.';
			const result = analyzeWriting(content);
			expect(result.sentences).toHaveLength(2);
			expect(result.sentences[0].startCh).toBe(0);
			expect(result.sentences[1].startCh).toBe(7);
		});

		test('tracks sentence line numbers across multiple lines', () => {
			const content = 'First sentence.\nSecond sentence.\nThird sentence.';
			const result = analyzeWriting(content);
			expect(result.sentences).toHaveLength(3);
			expect(result.sentences[0].line).toBe(0);
			expect(result.sentences[1].line).toBe(1);
			expect(result.sentences[2].line).toBe(2);
		});
	});

	describe('readability', () => {
		test('returns "Not enough text" for empty content', () => {
			const result = analyzeWriting('');
			expect(result.readabilityLabel).toBe('Not enough text');
			expect(result.readabilityGrade).toBe(0);
		});

		test('assigns low grade to simple short sentences', () => {
			// Simple one-syllable words in short sentences → low grade
			const content = 'The cat sat. The dog ran. The sun set.';
			const result = analyzeWriting(content);
			expect(result.readabilityGrade).toBeLessThan(8);
		});

		test('assigns higher grade to complex sentences', () => {
			const content = 'The implementation of the infrastructure modernization initiative necessitated comprehensive reorganization of the organizational communication architecture.';
			const result = analyzeWriting(content);
			expect(result.readabilityGrade).toBeGreaterThan(12);
		});

		test('labels grades correctly', () => {
			// We can't easily control exact grade, but we can check that label includes "Grade"
			const content = 'The cat sat on the mat. The dog ran to the park. She ate the food quickly.';
			const result = analyzeWriting(content);
			expect(result.readabilityLabel).toMatch(/Grade \d+ - /);
		});
	});

	describe('word and paragraph counting', () => {
		test('counts words accurately', () => {
			const content = 'One two three four five.';
			const result = analyzeWriting(content);
			expect(result.wordCount).toBe(5);
		});

		test('counts contractions as single words', () => {
			const content = "Don't can't won't.";
			const result = analyzeWriting(content);
			expect(result.wordCount).toBe(3);
		});

		test('counts paragraphs separated by blank lines', () => {
			const content = 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.';
			const result = analyzeWriting(content);
			expect(result.paragraphCount).toBe(3);
		});

		test('counts consecutive non-empty lines as one paragraph', () => {
			const content = 'Line one.\nLine two.\nLine three.';
			const result = analyzeWriting(content);
			expect(result.paragraphCount).toBe(1);
		});

		test('calculates reading time based on 238 wpm', () => {
			// 238 words = 1 min
			const words = makeWords(238);
			const content = words + '.';
			const result = analyzeWriting(content);
			expect(result.readingTimeMinutes).toBe(1);
		});

		test('rounds reading time up', () => {
			// 239 words = ceil(239/238) = 2 min
			const words = makeWords(239);
			const content = words + '.';
			const result = analyzeWriting(content);
			expect(result.readingTimeMinutes).toBe(2);
		});
	});

	describe('caching', () => {
		test('reuses cached results for unchanged content and options', () => {
			const content = 'The report was written carefully.';

			const first = analyzeWriting(content);
			const second = analyzeWriting(content);
			const third = analyzeWriting(content, { longSentenceThreshold: 12, veryLongSentenceThreshold: 20 });
			const fourth = analyzeWriting(content, { longSentenceThreshold: 12, veryLongSentenceThreshold: 20 });

			expect(first).toBe(second);
			expect(third).toBe(fourth);
			expect(first).not.toBe(third);
		});

		test('produces different results for different thresholds', () => {
			const words = makeWords(30);
			const content = words + '.';

			const defaultResult = analyzeWriting(content);
			const customResult = analyzeWriting(content, { longSentenceThreshold: 10, veryLongSentenceThreshold: 20 });

			expect(defaultResult.sentences[0].severity).toBe('long');
			expect(customResult.sentences[0].severity).toBe('very-long');
		});
	});

	describe('multi-line position tracking', () => {
		test('tracks passive voice positions across lines', () => {
			const content = 'Clean sentence here.\nThe code was written.';
			const result = analyzeWriting(content);
			expect(result.passiveVoice).toHaveLength(1);
			expect(result.passiveVoice[0].line).toBe(1);
		});

		test('tracks adverb positions across lines', () => {
			const content = 'Normal text here.\nShe ran quickly.';
			const result = analyzeWriting(content);
			expect(result.adverbs).toHaveLength(1);
			expect(result.adverbs[0].line).toBe(1);
		});

		test('tracks weak intensifier positions across lines', () => {
			const content = 'Normal text here.\nThis is very important.';
			const result = analyzeWriting(content);
			expect(result.weakIntensifiers).toHaveLength(1);
			expect(result.weakIntensifiers[0].line).toBe(1);
		});
	});

	describe('combined metrics', () => {
		test('handles document with all metric types present', () => {
			const content = [
				'The report was written quickly.',
				'It is very important to note.',
				'She spoke really softly.'
			].join('\n');

			const result = analyzeWriting(content);
			expect(result.passiveVoice.length).toBeGreaterThan(0);
			expect(result.adverbs.length).toBeGreaterThan(0);
			expect(result.weakIntensifierCount).toBeGreaterThan(0);
			expect(result.sentenceCount).toBe(3);
		});

		test('handles realistic prose document', () => {
			const content = [
				'The old house stood at the end of the lane.',
				'Its windows were broken and the door was left ajar.',
				'Nobody had lived there for years.',
				'',
				'Sarah walked slowly up the path.',
				'She hesitated briefly before pushing open the gate.',
				'The garden was completely overgrown.'
			].join('\n');

			const result = analyzeWriting(content);
			expect(result.wordCount).toBeGreaterThan(0);
			expect(result.sentenceCount).toBe(6);
			expect(result.paragraphCount).toBe(2);
			expect(result.passiveVoice.length).toBeGreaterThan(0);
			expect(result.adverbs.length).toBeGreaterThan(0);
			expect(result.readabilityGrade).toBeGreaterThan(0);
		});
	});

	describe('cache bounding', () => {
		test('does not retain analyses across distinct document states', () => {
			const { getCacheSizeForTests, clearWritingAnalysisCache } = require('../../src/core/writing-analysis');
			clearWritingAnalysisCache();

			analyzeWriting('Alpha sentence one. Alpha sentence two.');
			analyzeWriting('Beta sentence one. Beta sentence two.');
			analyzeWriting('Gamma sentence one. Gamma sentence two.');
			analyzeWriting('Delta sentence one. Delta sentence two.');
			analyzeWriting('Epsilon sentence one. Epsilon sentence two.');

			expect(getCacheSizeForTests()).toBeLessThanOrEqual(1);
		});

		test('returns the same reference on repeated calls with identical content', () => {
			const { clearWritingAnalysisCache } = require('../../src/core/writing-analysis');
			clearWritingAnalysisCache();

			const content = 'Stable content for memoization test.';
			const first = analyzeWriting(content);
			const second = analyzeWriting(content);

			expect(second).toBe(first);
		});

		test('returns a fresh analysis object when content changes between calls', () => {
			const { clearWritingAnalysisCache } = require('../../src/core/writing-analysis');
			clearWritingAnalysisCache();

			const first = analyzeWriting('First content for change test.');
			const second = analyzeWriting('Second content for change test.');

			expect(second).not.toBe(first);
			expect(second.wordCount).toBeGreaterThan(0);
		});
	});
});
