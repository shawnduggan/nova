/**
 * @file WritingAnalysis - Deterministic writing quality analysis helpers
 */

export interface WritingAnalysis {
	wordCount: number;
	sentenceCount: number;
	paragraphCount: number;
	readingTimeMinutes: number;
	readabilityGrade: number;
	readabilityLabel: string;
	passiveVoicePercentage: number;
	passiveSentenceCount: number;
	adverbDensity: number;
	weakIntensifierCount: number;
	sentenceLengthStdDev: number;
	veryLongSentencePercentage: number;
	sentences: SentenceAnalysis[];
	passiveVoice: PassiveVoiceMatch[];
	adverbs: AdverbMatch[];
	weakIntensifiers: WeakIntensifierMatch[];
}

export interface SentenceAnalysis {
	line: number;
	startCh: number;
	endCh: number;
	wordCount: number;
	severity: 'ok' | 'long' | 'very-long';
}

export interface PassiveVoiceMatch {
	line: number;
	startCh: number;
	endCh: number;
	match: string;
}

export interface AdverbMatch {
	line: number;
	startCh: number;
	endCh: number;
	word: string;
}

export interface WeakIntensifierMatch {
	line: number;
	startCh: number;
	endCh: number;
	word: string;
}

export interface WritingAnalysisOptions {
	longSentenceThreshold?: number;
	veryLongSentenceThreshold?: number;
}

interface LineInfo {
	text: string;
	start: number;
	length: number;
}

interface FrontmatterInfo {
	startLine: number;
	endLine: number;
	optOut: boolean;
}

const DEFAULT_LONG_SENTENCE_THRESHOLD = 25;
const DEFAULT_VERY_LONG_SENTENCE_THRESHOLD = 40;
// Inclusive cap: docs with length > this value skip live analysis.
// analyzeNow() bypasses the gate and always produces analysis.
export const MAX_LIVE_ANALYSIS_CHAR_LENGTH = 50_000;

const WEAK_INTENSIFIERS = new Set([
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

const ABBREVIATIONS = [
	'mr.',
	'mrs.',
	'ms.',
	'dr.',
	'prof.',
	'sr.',
	'jr.',
	'st.',
	'mt.',
	'no.',
	'rep.',
	'sen.',
	'gov.',
	'pres.',
	'inc.',
	'ltd.',
	'etc.',
	'e.g.',
	'i.e.',
	'vs.',
	'u.s.',
	'u.k.'
];

const IRREGULAR_PARTICIPLES = [
	'built',
	'bought',
	'caught',
	'chosen',
	'done',
	'drawn',
	'driven',
	'eaten',
	'fallen',
	'felt',
	'found',
	'given',
	'gone',
	'grown',
	'heard',
	'held',
	'hidden',
	'hit',
	'hung',
	'kept',
	'known',
	'laid',
	'led',
	'left',
	'lost',
	'made',
	'meant',
	'met',
	'paid',
	'put',
	'read',
	'ridden',
	'run',
	'said',
	'seen',
	'sent',
	'set',
	'shown',
	'shut',
	'sold',
	'spent',
	'spoken',
	'stood',
	'struck',
	'taken',
	'taught',
	'thought',
	'told',
	'understood',
	'won',
	'worn',
	'written'
];

const passiveRegex = new RegExp(
	'\\b(is|was|were|been|being|are|am|be)\\s+(?:\\w+\\s+)?((?:\\w+ed)|(?:\\w+en)|(?:' +
	IRREGULAR_PARTICIPLES.join('|') +
	'))\\b',
	'gi'
);

const wordRegex = /[A-Za-z0-9]+(?:'[A-Za-z0-9]+)?/g;
const adverbRegex = /\b([A-Za-z]+ly)\b/gi;

let lastCacheKey: string | null = null;
let lastCachedAnalysis: WritingAnalysis | null = null;

export function analyzeWriting(content: string, options: WritingAnalysisOptions = {}): WritingAnalysis {
	const longSentenceThreshold = options.longSentenceThreshold ?? DEFAULT_LONG_SENTENCE_THRESHOLD;
	const veryLongSentenceThreshold = options.veryLongSentenceThreshold ?? DEFAULT_VERY_LONG_SENTENCE_THRESHOLD;
	const cacheKey = buildCacheKey(content, longSentenceThreshold, veryLongSentenceThreshold);
	if (lastCacheKey === cacheKey && lastCachedAnalysis) {
		return lastCachedAnalysis;
	}

	const lines = content.split('\n');
	const lineInfos = buildLineInfos(lines);
	const frontmatter = detectFrontmatter(lines);
	if (frontmatter?.optOut) {
		const noOp = createNoOpAnalysis('Analysis disabled by frontmatter');
		lastCacheKey = cacheKey;
		lastCachedAnalysis = noOp;
		return noOp;
	}

	const normalizedLines = lines.map((line) => line);
	const quoteLineFlags = new Array<boolean>(lines.length).fill(false);

	blankFrontmatter(normalizedLines, frontmatter);
	blankFencedCodeBlocks(normalizedLines);
	blankInlineCode(normalizedLines);
	markBlockquotes(normalizedLines, quoteLineFlags);

	const normalizedContent = normalizedLines.join('\n');
	const sentenceSpans = splitSentences(normalizedContent, lineInfos, longSentenceThreshold, veryLongSentenceThreshold);
	const passiveSpans = findPassiveVoiceSpans(normalizedContent, lineInfos);
	const passiveVoice = passiveSpans.map((span) => span.match);
	const adverbs = findAdverbs(normalizedContent, lineInfos);
	const weakIntensifiers = findWeakIntensifiers(normalizedContent, lineInfos, quoteLineFlags);

	const wordCount = countWords(normalizedContent);
	const sentenceCount = sentenceSpans.length;
	const paragraphCount = countParagraphs(normalizedLines);
	const readingTimeMinutes = wordCount > 0 ? Math.ceil(wordCount / 238) : 0;
	const readabilityGrade = calculateReadabilityGrade(normalizedContent, wordCount, sentenceCount);
	const readabilityLabel = formatReadabilityLabel(readabilityGrade, wordCount, sentenceCount);
	const passiveSentenceCount = countPassiveSentences(sentenceSpans, passiveSpans);
	const passiveVoicePercentage = sentenceCount > 0 ? (passiveSentenceCount / sentenceCount) * 100 : 0;
	const adverbDensity = wordCount > 0 ? (adverbs.length / wordCount) * 100 : 0;
	const sentences = sentenceSpans.map((span) => span.analysis);
	const sentenceLengthStdDev = calculateSentenceLengthStdDev(sentences);
	const veryLongSentencePercentage = calculateVeryLongSentencePercentage(sentences);

	const analysis: WritingAnalysis = {
		wordCount,
		sentenceCount,
		paragraphCount,
		readingTimeMinutes,
		readabilityGrade,
		readabilityLabel,
		passiveVoicePercentage,
		passiveSentenceCount,
		adverbDensity,
		weakIntensifierCount: weakIntensifiers.length,
		sentenceLengthStdDev,
		veryLongSentencePercentage,
		sentences,
		passiveVoice,
		adverbs,
		weakIntensifiers
	};

	lastCacheKey = cacheKey;
	lastCachedAnalysis = analysis;
	return analysis;
}

function buildCacheKey(content: string, longSentenceThreshold: number, veryLongSentenceThreshold: number): string {
	return `${hashContent(content)}:${longSentenceThreshold}:${veryLongSentenceThreshold}`;
}

export function hashContent(content: string): string {
	let hash = 2166136261;
	for (let i = 0; i < content.length; i++) {
		hash ^= content.charCodeAt(i);
		hash = Math.imul(hash, 16777619);
	}
	return (hash >>> 0).toString(16);
}

export function hasWritingAnalysisOptOut(content: string): boolean {
	const lines = content.split('\n');
	return detectFrontmatter(lines)?.optOut ?? false;
}

export function clearWritingAnalysisCache(): void {
	lastCacheKey = null;
	lastCachedAnalysis = null;
}

export function getCacheSizeForTests(): number {
	return lastCachedAnalysis === null ? 0 : 1;
}

function createNoOpAnalysis(label: string): WritingAnalysis {
	return {
		wordCount: 0,
		sentenceCount: 0,
		paragraphCount: 0,
		readingTimeMinutes: 0,
		readabilityGrade: 0,
		readabilityLabel: label,
		passiveVoicePercentage: 0,
		passiveSentenceCount: 0,
		adverbDensity: 0,
		weakIntensifierCount: 0,
		sentenceLengthStdDev: 0,
		veryLongSentencePercentage: 0,
		sentences: [],
		passiveVoice: [],
		adverbs: [],
		weakIntensifiers: []
	};
}

function buildLineInfos(lines: string[]): LineInfo[] {
	const infos: LineInfo[] = [];
	let start = 0;

	for (const line of lines) {
		infos.push({
			text: line,
			start,
			length: line.length
		});
		start += line.length + 1;
	}

	return infos;
}

function detectFrontmatter(lines: string[]): FrontmatterInfo | null {
	let startLine = 0;
	while (startLine < lines.length && lines[startLine].trim() === '') {
		startLine++;
	}

	if (startLine >= lines.length || lines[startLine].trim() !== '---') {
		return null;
	}

	let endLine = -1;
	for (let i = startLine + 1; i < lines.length; i++) {
		if (lines[i].trim() === '---') {
			endLine = i;
			break;
		}
	}

	if (endLine === -1) {
		return null;
	}

	let optOut = false;
	for (let i = startLine + 1; i < endLine; i++) {
		const match = lines[i].match(/^\s*([A-Za-z0-9_-]+)\s*:\s*(.*?)\s*$/);
		if (!match) {
			continue;
		}

		const key = match[1].toLowerCase();
		if (key !== 'nova-analysis') {
			continue;
		}

		const rawValue = stripQuotes(match[2]).toLowerCase();
		if (rawValue === 'false' || rawValue === 'off') {
			optOut = true;
		}
	}

	return {
		startLine,
		endLine,
		optOut
	};
}

function stripQuotes(value: string): string {
	const trimmed = value.trim();
	if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith('\'') && trimmed.endsWith('\''))) {
		return trimmed.slice(1, -1);
	}

	return trimmed;
}

function blankFrontmatter(lines: string[], frontmatter: FrontmatterInfo | null): void {
	if (!frontmatter) {
		return;
	}

	for (let i = frontmatter.startLine; i <= frontmatter.endLine; i++) {
		lines[i] = spaces(lines[i].length);
	}
}

function blankFencedCodeBlocks(lines: string[]): void {
	let inFence = false;
	let fenceChar = '';
	let fenceLength = 0;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const trimmed = line.trimStart();
		const fenceMatch = trimmed.match(/^(`{3,}|~{3,})/);

		if (!inFence) {
			if (!fenceMatch) {
				continue;
			}

			inFence = true;
			fenceChar = fenceMatch[1][0];
			fenceLength = fenceMatch[1].length;
			lines[i] = spaces(line.length);
			continue;
		}

		lines[i] = spaces(line.length);
		if (fenceMatch && fenceMatch[1][0] === fenceChar && fenceMatch[1].length >= fenceLength) {
			inFence = false;
			fenceChar = '';
			fenceLength = 0;
		}
	}
}

function blankInlineCode(lines: string[]): void {
	for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
		const line = lines[lineIndex];
		// Fast-path: lines without a backtick cannot contain inline code.
		// Skips the per-char split/join allocation for the common case.
		if (line.indexOf('`') === -1) {
			continue;
		}

		const chars = line.split('');
		let cursor = 0;
		while (cursor < chars.length) {
			if (chars[cursor] !== '`') {
				cursor++;
				continue;
			}

			let runLength = 1;
			while (cursor + runLength < chars.length && chars[cursor + runLength] === '`') {
				runLength++;
			}

			let matchIndex = -1;
			for (let search = cursor + runLength; search < chars.length; search++) {
				if (chars[search] !== '`') {
					continue;
				}

				let closingLength = 1;
				while (search + closingLength < chars.length && chars[search + closingLength] === '`') {
					closingLength++;
				}

				if (closingLength === runLength) {
					matchIndex = search;
					break;
				}

				search += closingLength - 1;
			}

			if (matchIndex === -1) {
				cursor += runLength;
				continue;
			}

			for (let i = cursor; i < matchIndex + runLength; i++) {
				chars[i] = ' ';
			}
			cursor = matchIndex + runLength;
		}

		lines[lineIndex] = chars.join('');
	}
}

function markBlockquotes(lines: string[], quoteLineFlags: boolean[]): void {
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const match = line.match(/^(\s*>+\s?)/);
		if (!match) {
			continue;
		}

		quoteLineFlags[i] = true;
		const chars = line.split('');
		for (let j = 0; j < match[1].length; j++) {
			chars[j] = ' ';
		}
		lines[i] = chars.join('');
	}
}

interface SentenceSpan {
	startIndex: number;
	endIndex: number;
	analysis: SentenceAnalysis;
}

function splitSentences(
	text: string,
	lineInfos: LineInfo[],
	longSentenceThreshold: number,
	veryLongSentenceThreshold: number
): SentenceSpan[] {
	const sentences: SentenceSpan[] = [];
	let start = findNextTextIndex(text, 0);

	while (start < text.length) {
		const end = findSentenceEnd(text, start);
		if (end === -1) {
			const finalEnd = text.length;
			pushSentence(sentences, text, lineInfos, start, finalEnd, longSentenceThreshold, veryLongSentenceThreshold);
			break;
		}

		pushSentence(sentences, text, lineInfos, start, end + 1, longSentenceThreshold, veryLongSentenceThreshold);
		start = findNextTextIndex(text, end + 1);
	}

	return sentences;
}

function pushSentence(
	sentences: SentenceSpan[],
	text: string,
	lineInfos: LineInfo[],
	start: number,
	endExclusive: number,
	longSentenceThreshold: number,
	veryLongSentenceThreshold: number
): void {
	const trimmedStart = skipWhitespace(text, start);
	const trimmedEnd = trimEndWhitespace(text, endExclusive);
	if (trimmedStart >= trimmedEnd) {
		return;
	}

	const sentenceText = text.slice(trimmedStart, trimmedEnd);
	const wordCount = countWords(sentenceText);
	if (wordCount === 0) {
		return;
	}

	const startPos = indexToPosition(trimmedStart, lineInfos);
	const severity: SentenceAnalysis['severity'] =
		wordCount > veryLongSentenceThreshold ? 'very-long' : wordCount > longSentenceThreshold ? 'long' : 'ok';

	sentences.push({
		startIndex: trimmedStart,
		endIndex: trimmedEnd,
		analysis: {
			line: startPos.line,
			startCh: startPos.ch,
			endCh: indexToPosition(trimmedEnd, lineInfos).ch,
			wordCount,
			severity
		}
	});
}

function findSentenceEnd(text: string, start: number): number {
	for (let i = start; i < text.length; i++) {
		const char = text[i];

		if (char === '\n') {
			return i;
		}

		if (char !== '.' && char !== '!' && char !== '?') {
			continue;
		}

		if (char === '.' && isDecimalPoint(text, i)) {
			continue;
		}

		if (char === '.' && isAbbreviationBoundary(text, i)) {
			continue;
		}

		let end = i;
		while (end + 1 < text.length && isSentenceCloser(text[end + 1])) {
			end++;
		}
		return end;
	}

	return -1;
}

function isSentenceCloser(char: string): boolean {
	return char === '"' || char === '\'' || char === ')' || char === ']' || char === '}' || char === '”' || char === '’';
}

function isDecimalPoint(text: string, index: number): boolean {
	return index > 0 && index + 1 < text.length && isDigit(text[index - 1]) && isDigit(text[index + 1]);
}

function isAbbreviationBoundary(text: string, index: number): boolean {
	const windowStart = Math.max(0, index - 6);
	const windowEnd = Math.min(text.length, index + 6);
	const window = text.slice(windowStart, windowEnd).toLowerCase();
	for (const abbreviation of ABBREVIATIONS) {
		const found = window.indexOf(abbreviation);
		if (found === -1) {
			continue;
		}

		const absoluteStart = windowStart + found;
		const absoluteEnd = absoluteStart + abbreviation.length - 1;
		if (index >= absoluteStart && index <= absoluteEnd) {
			return true;
		}
	}

	return false;
}

interface PassiveMatchSpan {
	startIndex: number;
	endIndex: number;
	match: PassiveVoiceMatch;
}

function findPassiveVoiceSpans(text: string, lineInfos: LineInfo[]): PassiveMatchSpan[] {
	const spans: PassiveMatchSpan[] = [];
	passiveRegex.lastIndex = 0;

	let match: RegExpExecArray | null;
	while ((match = passiveRegex.exec(text)) !== null) {
		const startIndex = match.index;
		const endIndex = startIndex + match[0].length;
		const startPos = indexToPosition(startIndex, lineInfos);
		const endPos = indexToPosition(endIndex, lineInfos);
		spans.push({
			startIndex,
			endIndex,
			match: {
				line: startPos.line,
				startCh: startPos.ch,
				endCh: endPos.ch,
				match: match[0]
			}
		});
	}

	return spans;
}

function findAdverbs(text: string, lineInfos: LineInfo[]): AdverbMatch[] {
	const matches: AdverbMatch[] = [];
	adverbRegex.lastIndex = 0;

	let match: RegExpExecArray | null;
	while ((match = adverbRegex.exec(text)) !== null) {
		const word = match[1];
		if (isExcludedAdverb(word) || WEAK_INTENSIFIERS.has(word.toLowerCase())) {
			continue;
		}

		const startPos = indexToPosition(match.index, lineInfos);
		const endPos = indexToPosition(match.index + match[0].length, lineInfos);
		matches.push({
			line: startPos.line,
			startCh: startPos.ch,
			endCh: endPos.ch,
			word
		});
	}

	return matches;
}

function findWeakIntensifiers(text: string, lineInfos: LineInfo[], quoteLineFlags: boolean[]): WeakIntensifierMatch[] {
	const matches: WeakIntensifierMatch[] = [];
	const pattern = /\b([A-Za-z]+)\b/gi;
	pattern.lastIndex = 0;

	let match: RegExpExecArray | null;
	while ((match = pattern.exec(text)) !== null) {
		const word = match[1].toLowerCase();
		if (!WEAK_INTENSIFIERS.has(word)) {
			continue;
		}

		const startPos = indexToPosition(match.index, lineInfos);
		if (quoteLineFlags[startPos.line]) {
			continue;
		}
		const endPos = indexToPosition(match.index + match[0].length, lineInfos);

		matches.push({
			line: startPos.line,
			startCh: startPos.ch,
			endCh: endPos.ch,
			word: match[0]
		});
	}

	return matches;
}

function countWords(text: string): number {
	const matches = text.match(wordRegex);
	return matches ? matches.length : 0;
}

function countParagraphs(lines: string[]): number {
	let paragraphs = 0;
	let inParagraph = false;

	for (const line of lines) {
		if (line.trim().length === 0) {
			inParagraph = false;
			continue;
		}

		if (!inParagraph) {
			paragraphs++;
			inParagraph = true;
		}
	}

	return paragraphs;
}

function calculateSentenceLengthStdDev(sentences: SentenceAnalysis[]): number {
	if (sentences.length < 2) {
		return 0;
	}

	const wordCounts = sentences.map((sentence) => sentence.wordCount);
	const mean = wordCounts.reduce((sum, count) => sum + count, 0) / wordCounts.length;
	const variance = wordCounts.reduce((sum, count) => sum + (count - mean) ** 2, 0) / wordCounts.length;

	return roundToTwoDecimals(Math.sqrt(variance));
}

function calculateVeryLongSentencePercentage(sentences: SentenceAnalysis[]): number {
	if (sentences.length === 0) {
		return 0;
	}

	const veryLongCount = sentences.filter((sentence) => sentence.severity === 'very-long').length;
	return roundToTwoDecimals((veryLongCount / sentences.length) * 100);
}

function calculateReadabilityGrade(text: string, wordCount: number, sentenceCount: number): number {
	if (wordCount === 0 || sentenceCount === 0) {
		return 0;
	}

	let syllableCount = 0;
	const words = text.match(wordRegex) || [];
	for (const word of words) {
		syllableCount += countSyllables(word);
	}

	const grade = 0.39 * (wordCount / sentenceCount) + 11.8 * (syllableCount / wordCount) - 15.59;
	return Math.max(0, roundToTwoDecimals(grade));
}

function formatReadabilityLabel(grade: number, wordCount: number, sentenceCount: number): string {
	if (wordCount === 0 || sentenceCount === 0) {
		return 'Not enough text';
	}

	const rounded = Math.round(grade);
	let descriptor = 'advanced';
	if (grade <= 5) {
		descriptor = 'very easy to read';
	} else if (grade <= 8) {
		descriptor = 'easy to read';
	} else if (grade <= 11) {
		descriptor = 'standard';
	} else if (grade <= 14) {
		descriptor = 'academic';
	}

	return `Grade ${rounded} - ${descriptor}`;
}

function countPassiveSentences(sentences: SentenceSpan[], passiveSpans: PassiveMatchSpan[]): number {
	if (sentences.length === 0 || passiveSpans.length === 0) {
		return 0;
	}

	// Linear sweep: both sentences and passiveSpans are in ascending index order
	// (produced by a left-to-right regex/parse), so we walk both in tandem and
	// count each sentence that contains at least one passive span.
	let count = 0;
	let passiveCursor = 0;
	for (const sentence of sentences) {
		while (passiveCursor < passiveSpans.length && passiveSpans[passiveCursor].endIndex <= sentence.startIndex) {
			passiveCursor++;
		}
		if (passiveCursor >= passiveSpans.length) {
			break;
		}
		if (passiveSpans[passiveCursor].startIndex < sentence.endIndex) {
			count++;
		}
	}

	return count;
}

function countSyllables(word: string): number {
	const normalized = word.toLowerCase().replace(/[^a-z]/g, '');
	if (normalized.length === 0) {
		return 0;
	}

	const exceptions: Record<string, number> = {
		queue: 1,
		people: 2,
		business: 2,
		every: 2,
		fire: 1,
		our: 1,
		hour: 2,
		one: 1,
		two: 1,
		three: 1,
		four: 1,
		five: 1,
		six: 1,
		seven: 2,
		eight: 1,
		nine: 1,
		ten: 1
	};

	if (Object.prototype.hasOwnProperty.call(exceptions, normalized)) {
		return exceptions[normalized];
	}

	let count = 0;
	let previousWasVowel = false;
	for (let i = 0; i < normalized.length; i++) {
		const isVowel = isVowelLetter(normalized[i]);
		if (isVowel && !previousWasVowel) {
			count++;
		}
		previousWasVowel = isVowel;
	}

	if (normalized.endsWith('e') && !normalized.endsWith('le') && count > 1) {
		count--;
	}

	if (normalized.endsWith('le') && normalized.length > 2 && !isVowelLetter(normalized[normalized.length - 3])) {
		count++;
	}

	if (normalized.endsWith('ed') && count > 1 && !normalized.endsWith('ted') && !normalized.endsWith('ded')) {
		count--;
	}

	if (normalized.endsWith('es') && count > 1 && !normalized.endsWith('les') && !normalized.endsWith('ses')) {
		count--;
	}

	return Math.max(1, count);
}

function isVowelLetter(char: string): boolean {
	return char === 'a' || char === 'e' || char === 'i' || char === 'o' || char === 'u' || char === 'y';
}

function isDigit(char: string): boolean {
	return char >= '0' && char <= '9';
}

function isExcludedAdverb(word: string): boolean {
	const lower = word.toLowerCase();
	return lower === 'only' || lower === 'family' || lower === 'early' || lower === 'likely' || lower === 'lonely' ||
		lower === 'friendly' || lower === 'daily' || lower === 'holy' || lower === 'ugly' || lower === 'rely' ||
		lower === 'apply' || lower === 'supply' || lower === 'fly' || lower === 'july' || lower === 'rally' ||
		lower === 'belly' || lower === 'bully' || lower === 'fully';
}

function indexToPosition(index: number, lineInfos: LineInfo[]): { line: number; ch: number } {
	if (lineInfos.length === 0) {
		return { line: 0, ch: 0 };
	}

	if (index >= lineInfos[lineInfos.length - 1].start + lineInfos[lineInfos.length - 1].length) {
		const last = lineInfos[lineInfos.length - 1];
		return { line: lineInfos.length - 1, ch: last.length };
	}

	let low = 0;
	let high = lineInfos.length - 1;
	while (low <= high) {
		const mid = Math.floor((low + high) / 2);
		const line = lineInfos[mid];
		const nextStart = mid + 1 < lineInfos.length ? lineInfos[mid + 1].start : Number.POSITIVE_INFINITY;

		if (index < line.start) {
			high = mid - 1;
			continue;
		}

		if (index >= nextStart) {
			low = mid + 1;
			continue;
		}

		return { line: mid, ch: index - line.start };
	}

	return { line: lineInfos.length - 1, ch: lineInfos[lineInfos.length - 1].length };
}

function findNextTextIndex(text: string, start: number): number {
	let cursor = start;
	while (cursor < text.length && /\s/.test(text[cursor])) {
		cursor++;
	}
	return cursor;
}

function skipWhitespace(text: string, start: number): number {
	return findNextTextIndex(text, start);
}

function trimEndWhitespace(text: string, endExclusive: number): number {
	let cursor = endExclusive;
	while (cursor > 0 && /\s/.test(text[cursor - 1])) {
		cursor--;
	}
	return cursor;
}

function spaces(length: number): string {
	return ' '.repeat(length);
}

function roundToTwoDecimals(value: number): number {
	return Math.round(value * 100) / 100;
}
