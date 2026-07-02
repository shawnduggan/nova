/**
 * @file SmartRevisionDiff - Diff rendering and safe card composition helpers
 */

import type { SmartRevisionCard } from './smart-revision-types';

export type SmartRevisionDiffSegmentType = 'equal' | 'insert' | 'delete';

export interface SmartRevisionDiffSegment {
	type: SmartRevisionDiffSegmentType;
	text: string;
}

interface Token {
	raw: string;
	key: string;
}

export function createSmartRevisionDiff(originalText: string, revisedText: string): SmartRevisionDiffSegment[] {
	if (originalText === revisedText) {
		return [{ type: 'equal', text: originalText }];
	}

	const originalTokens = tokenize(originalText);
	const revisedTokens = tokenize(revisedText);
	if (originalTokens.length === 0) {
		return [{ type: 'insert', text: revisedText }];
	}
	if (revisedTokens.length === 0) {
		return [{ type: 'delete', text: originalText }];
	}
	if (originalTokens.length * revisedTokens.length > 160_000) {
		return [
			{ type: 'delete', text: originalText },
			{ type: 'insert', text: revisedText }
		];
	}

	const table = buildLcsTable(originalTokens, revisedTokens);
	const segments = backtrackDiff(originalTokens, revisedTokens, table);
	return mergeAdjacentSegments(segments);
}

export function projectAcceptedSmartRevisionText(originalText: string, cards: SmartRevisionCard[]): string {
	const orderedCards = [...cards].sort((left, right) => left.startIndex - right.startIndex);
	let cursor = 0;
	let output = '';

	for (const card of orderedCards) {
		if (card.disabledReason || card.startIndex < cursor || card.endIndex > originalText.length) {
			continue;
		}
		output += originalText.slice(cursor, card.startIndex);
		output += card.status === 'accepted' ? card.revisedText : originalText.slice(card.startIndex, card.endIndex);
		cursor = card.endIndex;
	}

	output += originalText.slice(cursor);
	return output;
}

export function findUniqueRange(source: string, target: string): { startIndex: number; endIndex: number } | null {
	if (!target) {
		return null;
	}
	const startIndex = source.indexOf(target);
	if (startIndex < 0 || source.indexOf(target, startIndex + target.length) >= 0) {
		return null;
	}
	return {
		startIndex,
		endIndex: startIndex + target.length
	};
}

export function rangesOverlap(
	left: { startIndex: number; endIndex: number },
	right: { startIndex: number; endIndex: number }
): boolean {
	return left.startIndex < right.endIndex && right.startIndex < left.endIndex;
}

function tokenize(text: string): Token[] {
	const tokens: Token[] = [];
	const regex = /(\s+|[A-Za-z0-9]+(?:'[A-Za-z0-9]+)?|[^\sA-Za-z0-9]+)/g;
	let match: RegExpExecArray | null;
	regex.lastIndex = 0;
	while ((match = regex.exec(text)) !== null) {
		const raw = match[0];
		tokens.push({
			raw,
			key: /\s+/.test(raw) ? ' ' : raw.toLowerCase()
		});
	}
	return tokens;
}

function buildLcsTable(left: Token[], right: Token[]): number[][] {
	const table: number[][] = Array.from({ length: left.length + 1 }, () => Array(right.length + 1).fill(0));

	for (let leftIndex = left.length - 1; leftIndex >= 0; leftIndex -= 1) {
		for (let rightIndex = right.length - 1; rightIndex >= 0; rightIndex -= 1) {
			table[leftIndex][rightIndex] = left[leftIndex].key === right[rightIndex].key
				? table[leftIndex + 1][rightIndex + 1] + 1
				: Math.max(table[leftIndex + 1][rightIndex], table[leftIndex][rightIndex + 1]);
		}
	}

	return table;
}

function backtrackDiff(left: Token[], right: Token[], table: number[][]): SmartRevisionDiffSegment[] {
	const segments: SmartRevisionDiffSegment[] = [];
	let leftIndex = 0;
	let rightIndex = 0;

	while (leftIndex < left.length && rightIndex < right.length) {
		if (left[leftIndex].key === right[rightIndex].key) {
			segments.push({ type: 'equal', text: right[rightIndex].raw });
			leftIndex += 1;
			rightIndex += 1;
		} else if (table[leftIndex + 1][rightIndex] >= table[leftIndex][rightIndex + 1]) {
			segments.push({ type: 'delete', text: left[leftIndex].raw });
			leftIndex += 1;
		} else {
			segments.push({ type: 'insert', text: right[rightIndex].raw });
			rightIndex += 1;
		}
	}

	while (leftIndex < left.length) {
		segments.push({ type: 'delete', text: left[leftIndex].raw });
		leftIndex += 1;
	}
	while (rightIndex < right.length) {
		segments.push({ type: 'insert', text: right[rightIndex].raw });
		rightIndex += 1;
	}

	return segments;
}

function mergeAdjacentSegments(segments: SmartRevisionDiffSegment[]): SmartRevisionDiffSegment[] {
	const merged: SmartRevisionDiffSegment[] = [];
	for (const segment of segments) {
		const previous = merged[merged.length - 1];
		if (previous?.type === segment.type) {
			previous.text += segment.text;
		} else {
			merged.push({ ...segment });
		}
	}
	return merged.filter((segment) => segment.text.length > 0);
}
