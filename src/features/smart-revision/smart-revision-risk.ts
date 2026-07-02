/**
 * @file SmartRevisionRisk - Deterministic meaning-risk checks for Smart Revision
 */

import type {
	SmartRevisionBrief,
	SmartRevisionRiskAssessment,
	SmartRevisionRiskFlag,
	SmartRevisionRiskLevel
} from './smart-revision-types';

const MONTH_NAMES = [
	'january',
	'february',
	'march',
	'april',
	'may',
	'june',
	'july',
	'august',
	'september',
	'october',
	'november',
	'december',
	'jan',
	'feb',
	'mar',
	'apr',
	'jun',
	'jul',
	'aug',
	'sep',
	'oct',
	'nov',
	'dec'
];

const NEGATIONS = [
	'no',
	'not',
	'never',
	'none',
	'without',
	'cannot',
	"can't",
	"won't",
	"isn't",
	"aren't",
	"wasn't",
	"weren't",
	"don't",
	"doesn't",
	"didn't",
	"hasn't",
	"haven't",
	"hadn't"
];

const PROPER_NOUN_STOPWORDS = new Set([
	'a',
	'an',
	'and',
	'as',
	'at',
	'but',
	'by',
	'for',
	'from',
	'he',
	'here',
	'however',
	'i',
	'if',
	'in',
	'it',
	'maybe',
	'of',
	'on',
	'or',
	'she',
	'so',
	'that',
	'the',
	'there',
	'these',
	'they',
	'this',
	'those',
	'to',
	'we',
	'when',
	'while',
	'with',
	'without',
	'you'
]);

export function assessSmartRevisionRisk(
	originalText: string,
	revisedText: string,
	brief: Pick<SmartRevisionBrief, 'doNotChange'>,
	advisoryLevel?: SmartRevisionRiskLevel,
	advisoryReason?: string
): SmartRevisionRiskAssessment {
	const flags: SmartRevisionRiskFlag[] = [];

	pushSetChangeFlag(flags, 'numbers', 'Numbers changed', extractNumbers(originalText), extractNumbers(revisedText), 'high');
	pushSetChangeFlag(flags, 'dates', 'Dates changed', extractDates(originalText), extractDates(revisedText), 'high');
	pushSetChangeFlag(flags, 'wikilinks', 'Wikilinks changed', extractWikilinks(originalText), extractWikilinks(revisedText), 'high');
	pushSetChangeFlag(flags, 'markdown-links', 'Markdown links changed', extractMarkdownLinks(originalText), extractMarkdownLinks(revisedText), 'high');
	pushSetChangeFlag(flags, 'quoted-text', 'Quoted text changed', extractQuotedText(originalText), extractQuotedText(revisedText), 'high');
	pushSetChangeFlag(flags, 'negations', 'Negation changed', extractNegations(originalText), extractNegations(revisedText), 'medium');
	pushSetChangeFlag(flags, 'proper-nouns', 'Names or proper nouns changed', extractProperNouns(originalText), extractProperNouns(revisedText), 'medium');

	for (const term of parseDoNotChangeTerms(brief.doNotChange)) {
		const beforeCount = countTerm(originalText, term);
		const afterCount = countTerm(revisedText, term);
		if (beforeCount !== afterCount) {
			flags.push({
				id: `do-not-change:${term.toLowerCase()}`,
				label: 'Protected term changed',
				severity: 'high',
				detail: `"${term}" was listed as do not change but its occurrence count changed.`
			});
		}
	}

	const deterministicLevel = flags.reduce<SmartRevisionRiskLevel>((level, flag) => {
		return compareRisk(flag.severity, level) > 0 ? flag.severity : level;
	}, 'low');
	const advisoryFlag = advisoryLevel && advisoryLevel !== 'low'
		? [{
			id: 'model-advisory',
			label: 'Model advisory',
			severity: advisoryLevel === 'high' ? 'medium' as const : advisoryLevel,
			detail: advisoryReason || `The model self-reported ${advisoryLevel} meaning risk.`
		}]
		: [];
	const level = advisoryFlag.reduce<SmartRevisionRiskLevel>((current, flag) => {
		return compareRisk(flag.severity, current) > 0 ? flag.severity : current;
	}, deterministicLevel);

	return {
		level,
		flags: [...flags, ...advisoryFlag],
		advisoryLevel,
		advisoryReason
	};
}

export function parseDoNotChangeTerms(value: string): string[] {
	const seen = new Set<string>();
	const terms: string[] = [];
	value
		.split(/[\n,;]/)
		.map((term) => term.trim())
		.filter(Boolean)
		.forEach((term) => {
			const key = term.toLowerCase();
			if (!seen.has(key)) {
				seen.add(key);
				terms.push(term);
			}
		});
	return terms;
}

export function compareRisk(left: SmartRevisionRiskLevel, right: SmartRevisionRiskLevel): number {
	return riskRank(left) - riskRank(right);
}

function riskRank(level: SmartRevisionRiskLevel): number {
	switch (level) {
		case 'high':
			return 2;
		case 'medium':
			return 1;
		case 'low':
			return 0;
	}
}

function pushSetChangeFlag(
	flags: SmartRevisionRiskFlag[],
	id: string,
	label: string,
	before: string[],
	after: string[],
	severity: SmartRevisionRiskLevel
): void {
	const beforeKey = normalizeSet(before);
	const afterKey = normalizeSet(after);
	if (beforeKey === afterKey) {
		return;
	}
	flags.push({
		id,
		label,
		severity,
		detail: describeSetChange(before, after)
	});
}

function normalizeSet(values: string[]): string {
	return [...values]
		.map((value) => value.toLowerCase())
		.sort()
		.join('|');
}

function describeSetChange(before: string[], after: string[]): string {
	const removed = before.filter((value) => !after.some((candidate) => candidate.toLowerCase() === value.toLowerCase()));
	const added = after.filter((value) => !before.some((candidate) => candidate.toLowerCase() === value.toLowerCase()));
	const parts: string[] = [];
	if (removed.length > 0) {
		parts.push(`Removed: ${removed.slice(0, 4).join(', ')}`);
	}
	if (added.length > 0) {
		parts.push(`Added: ${added.slice(0, 4).join(', ')}`);
	}
	return parts.join(' · ') || 'Values changed.';
}

function extractNumbers(text: string): string[] {
	return uniqueMatches(text, /\b\d+(?:[.,]\d+)*(?:%|st|nd|rd|th)?\b/g);
}

function extractDates(text: string): string[] {
	const monthPattern = MONTH_NAMES.join('|');
	return uniqueMatches(text.toLowerCase(), new RegExp(`\\b(?:${monthPattern})\\.?\\s+\\d{1,2}(?:,\\s*\\d{4})?|\\b\\d{4}-\\d{2}-\\d{2}\\b|\\b\\d{1,2}/\\d{1,2}/\\d{2,4}\\b`, 'gi'));
}

function extractWikilinks(text: string): string[] {
	return uniqueMatches(text, /\[\[[^\]]+\]\]/g);
}

function extractMarkdownLinks(text: string): string[] {
	return uniqueMatches(text, /\[[^\]]+\]\([^)]+\)/g);
}

function extractQuotedText(text: string): string[] {
	return uniqueMatches(text, /"[^"]+"|'[^']+'|“[^”]+”|‘[^’]+’/g);
}

function extractNegations(text: string): string[] {
	const pattern = new RegExp(`\\b(?:${NEGATIONS.map(escapeRegExp).join('|')})\\b`, 'gi');
	return uniqueMatches(text.toLowerCase(), pattern);
}

function extractProperNouns(text: string): string[] {
	const matches = uniqueMatches(text, /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g);
	return matches.filter((value) => {
		const normalized = value.toLowerCase();
		return !MONTH_NAMES.includes(normalized) && !PROPER_NOUN_STOPWORDS.has(normalized);
	});
}

function uniqueMatches(text: string, regex: RegExp): string[] {
	const seen = new Set<string>();
	const values: string[] = [];
	let match: RegExpExecArray | null;
	regex.lastIndex = 0;
	while ((match = regex.exec(text)) !== null) {
		const value = match[0].trim();
		const key = value.toLowerCase();
		if (value && !seen.has(key)) {
			seen.add(key);
			values.push(value);
		}
	}
	return values;
}

function countTerm(text: string, term: string): number {
	const pattern = new RegExp(escapeRegExp(term), 'gi');
	return uniqueMatchCount(text, pattern);
}

function uniqueMatchCount(text: string, regex: RegExp): number {
	let count = 0;
	regex.lastIndex = 0;
	while (regex.exec(text) !== null) {
		count += 1;
	}
	return count;
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
