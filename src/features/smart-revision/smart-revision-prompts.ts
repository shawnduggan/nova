/**
 * @file SmartRevisionPrompts - Prompt construction and structured output parsing for Smart Revision
 */

import type {
	SmartRevisionBrief,
	SmartRevisionModelCard,
	SmartRevisionModelResult,
	SmartRevisionPass,
	SmartRevisionRiskLevel,
	SmartRevisionSourceIssue
} from './smart-revision-types';

export interface SmartRevisionPromptInput {
	pass: SmartRevisionPass;
	brief: SmartRevisionBrief;
	selectedText: string;
	sourceIssue?: SmartRevisionSourceIssue;
}

export function buildSmartRevisionPrompts(input: SmartRevisionPromptInput): { systemPrompt: string; userPrompt: string } {
	const issueSection = input.sourceIssue
		? [
			'Source Prose Linter issue:',
			`- Type: ${input.sourceIssue.label}`,
			`- Issue text: ${input.sourceIssue.sourceText}`,
			`- Excerpt: ${input.sourceIssue.excerpt}`,
			`- Explanation: ${input.sourceIssue.explanation}`,
			`- Suggestion: ${input.sourceIssue.suggestion}`
		].join('\n')
		: 'Source Prose Linter issue: none';
	const doNotChange = input.brief.doNotChange.trim() || 'none';
	const audience = input.brief.audience.trim() || 'not specified';
	const goal = input.brief.goal.trim() || 'not specified';
	const customInstruction = input.brief.customInstruction.trim() || 'none';

	return {
		systemPrompt: `You are Nova Smart Revision, a careful editor inside an Obsidian note.

Return ONLY valid JSON. Do not wrap it in Markdown fences.

Schema:
{
  "revisedText": "replacement text for the selected range only",
  "rationale": "one short sentence about the revision pass",
  "meaningRisk": "low" | "medium" | "high",
  "meaningRiskReason": "short reason",
  "cards": [
    {
      "label": "writer-readable editorial move",
      "originalText": "exact substring from the selected text",
      "revisedText": "replacement for that substring",
      "rationale": "why this change helps",
      "risk": "low" | "medium" | "high"
    }
  ]
}

Rules:
- Revise only the selected range. Do not include surrounding commentary.
- Preserve meaning unless the brief explicitly asks otherwise.
- Preserve Markdown, wikilinks, frontmatter, headings, lists, links, code spans, code blocks, blockquotes, and tables.
- Do not add facts, claims, numbers, names, citations, or examples unless the brief explicitly asks.
- Respect the Do Not Change list exactly.
- Prefer surgical edits over broad rewrites.
- Cards must use exact original substrings so Nova can map changes safely.
- Card labels should sound editorial: Split long sentence, Removed hedge, Smoothed transition, Clarified argument.
- If a structural note is better than a rewrite, include a card with identical originalText and revisedText and explain why.`,
		userPrompt: [
			`Revision pass: ${input.pass.label}`,
			`Pass instruction: ${input.pass.prompt}`,
			`Posture: ${input.brief.posture}`,
			`Preserve voice: ${input.brief.preserveVoice ? 'yes' : 'no'}`,
			`Preserve meaning: ${input.brief.preserveMeaning ? 'yes' : 'no'}`,
			`Preserve Markdown: ${input.brief.preserveMarkdown ? 'yes' : 'no'}`,
			`Do not add facts: ${input.brief.doNotAddFacts ? 'yes' : 'no'}`,
			`Audience: ${audience}`,
			`Goal: ${goal}`,
			`Do Not Change: ${doNotChange}`,
			`Custom instruction: ${customInstruction}`,
			issueSection,
			'Selected text:',
			input.selectedText
		].join('\n\n')
	};
}

export function parseSmartRevisionModelResult(rawOutput: string): SmartRevisionModelResult {
	const jsonText = extractFirstJsonObject(rawOutput);
	if (!jsonText) {
		throw new Error('Smart Revision could not read the model response.');
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(jsonText);
	} catch {
		throw new Error('Smart Revision received malformed structured output.');
	}

	if (!isObject(parsed)) {
		throw new Error('Smart Revision received an invalid response shape.');
	}

	const revisedText = getString(parsed, 'revisedText');
	if (!revisedText.trim()) {
		throw new Error('Smart Revision received an empty revision.');
	}

	return {
		revisedText,
		cards: getCards(parsed),
		rationale: getString(parsed, 'rationale').trim(),
		risk: normalizeRisk(getString(parsed, 'meaningRisk')),
		riskReason: getString(parsed, 'meaningRiskReason').trim()
	};
}

export function extractFirstJsonObject(value: string): string | null {
	const firstBrace = value.indexOf('{');
	if (firstBrace < 0) {
		return null;
	}

	let depth = 0;
	let inString = false;
	let escaped = false;
	for (let index = firstBrace; index < value.length; index += 1) {
		const character = value[index];
		if (escaped) {
			escaped = false;
			continue;
		}
		if (character === '\\') {
			escaped = true;
			continue;
		}
		if (character === '"') {
			inString = !inString;
			continue;
		}
		if (inString) {
			continue;
		}
		if (character === '{') {
			depth += 1;
		}
		if (character === '}') {
			depth -= 1;
			if (depth === 0) {
				return value.slice(firstBrace, index + 1);
			}
		}
	}

	return null;
}

function getCards(parsed: Record<string, unknown>): SmartRevisionModelCard[] {
	const cards = parsed.cards;
	if (!Array.isArray(cards)) {
		return [];
	}
	return cards.filter(isObject);
}

function getString(parsed: Record<string, unknown>, key: string): string {
	const value = parsed[key];
	return typeof value === 'string' ? value : '';
}

function normalizeRisk(value: string): SmartRevisionRiskLevel | undefined {
	const normalized = value.toLowerCase().trim();
	if (normalized === 'low' || normalized === 'medium' || normalized === 'high') {
		return normalized;
	}
	return undefined;
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
