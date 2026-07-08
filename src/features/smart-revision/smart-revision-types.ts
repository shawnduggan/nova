/**
 * @file SmartRevisionTypes - Shared types and constants for Smart Revision sessions
 */

import type { EditorPosition } from 'obsidian';
import type { ProseIssue } from '../prose-linter/prose-linter-types';

export type SmartRevisionPassId = 'clarity' | 'tighten' | 'flow' | 'more-human';
export type SmartRevisionPosture = 'conservative' | 'balanced' | 'bold';
export type SmartRevisionRiskLevel = 'low' | 'medium' | 'high';
export type SmartRevisionCardStatus = 'pending' | 'accepted' | 'rejected';

export interface SmartRevisionPass {
	id: SmartRevisionPassId;
	label: string;
	description: string;
	prompt: string;
}

export interface SmartRevisionBrief {
	passId: SmartRevisionPassId;
	posture: SmartRevisionPosture;
	preserveVoice: boolean;
	preserveMeaning: boolean;
	preserveMarkdown: boolean;
	doNotAddFacts: boolean;
	audience: string;
	goal: string;
	doNotChange: string;
	customInstruction: string;
}

export interface SmartRevisionSourceIssue {
	id: string;
	type: ProseIssue['type'];
	label: string;
	excerpt: string;
	sourceText: string;
	targetText: string;
	explanation: string;
	suggestion: string;
	line: number;
	startCh: number;
	endCh: number;
	targetLine: number;
	targetStartCh: number;
	targetEndCh: number;
}

export interface SmartRevisionTarget {
	text: string;
	range: {
		from: EditorPosition;
		to: EditorPosition;
	};
	filePath: string | null;
	sourceIssue?: SmartRevisionSourceIssue;
}

export interface SmartRevisionSnapshot {
	originalText: string;
	range: {
		from: EditorPosition;
		to: EditorPosition;
	};
	filePath: string | null;
	createdAt: number;
}

export interface SmartRevisionRiskFlag {
	id: string;
	label: string;
	severity: SmartRevisionRiskLevel;
	detail: string;
}

export interface SmartRevisionRiskAssessment {
	level: SmartRevisionRiskLevel;
	flags: SmartRevisionRiskFlag[];
	advisoryLevel?: SmartRevisionRiskLevel;
	advisoryReason?: string;
}

export interface SmartRevisionImpactMetric {
	label: string;
	before: string;
	after: string;
	improved: boolean;
	unchanged: boolean;
}

export interface SmartRevisionImpactReport {
	metrics: SmartRevisionImpactMetric[];
	summary: string;
}

export interface SmartRevisionCard {
	id: string;
	label: string;
	originalText: string;
	revisedText: string;
	rationale: string;
	sourceIssueLabel?: string;
	impact?: SmartRevisionImpactReport;
	risk: SmartRevisionRiskAssessment;
	status: SmartRevisionCardStatus;
	startIndex: number;
	endIndex: number;
	disabledReason?: string;
}

export interface SmartRevisionSession {
	id: string;
	pass: SmartRevisionPass;
	brief: SmartRevisionBrief;
	snapshot: SmartRevisionSnapshot;
	revisedText: string;
	cards: SmartRevisionCard[];
	impact: SmartRevisionImpactReport;
	risk: SmartRevisionRiskAssessment;
	modelRationale: string;
}

export interface SmartRevisionModelCard {
	label?: unknown;
	originalText?: unknown;
	revisedText?: unknown;
	rationale?: unknown;
	impact?: unknown;
	risk?: unknown;
}

export interface SmartRevisionModelResult {
	revisedText: string;
	cards: SmartRevisionModelCard[];
	rationale: string;
	risk?: SmartRevisionRiskLevel;
	riskReason?: string;
}

export const SMART_REVISION_PASSES: SmartRevisionPass[] = [
	{
		id: 'clarity',
		label: 'Clarity',
		description: 'Make the passage easier to understand.',
		prompt: 'Focus on comprehension: make referents, logic, and sentence structure easier to follow. Avoid mere shortening unless it improves understanding; keep the writer\'s meaning and emphasis intact.'
	},
	{
		id: 'tighten',
		label: 'Tighten',
		description: 'Remove clutter and weak phrasing.',
		prompt: 'Focus on economy: remove redundancy, hedging, filler, and weak phrasing. Prefer fewer words and stronger verbs; avoid adding transitions, tone polish, or structural rewrites unless needed to preserve meaning.'
	},
	{
		id: 'flow',
		label: 'Flow',
		description: 'Improve rhythm and transitions.',
		prompt: 'Focus on cadence and movement: smooth transitions, sentence rhythm, parallel structure, and paragraph progression. Avoid optimizing for brevity alone; preserve the writer\'s voice and sequence of ideas.'
	},
	{
		id: 'more-human',
		label: 'More Human',
		description: 'Reduce generic AI or corporate tone.',
		prompt: 'Focus on natural, specific language: reduce generic AI, corporate, or over-polished phrasing. Prefer plain human cadence and concrete wording; avoid slang, forced warmth, or changing the writer\'s intent.'
	}
];

export const DEFAULT_SMART_REVISION_BRIEF: SmartRevisionBrief = {
	passId: 'clarity',
	posture: 'balanced',
	preserveVoice: true,
	preserveMeaning: true,
	preserveMarkdown: true,
	doNotAddFacts: true,
	audience: '',
	goal: '',
	doNotChange: '',
	customInstruction: ''
};

export function getSmartRevisionPass(passId: SmartRevisionPassId): SmartRevisionPass {
	return SMART_REVISION_PASSES.find((pass) => pass.id === passId) ?? SMART_REVISION_PASSES[0];
}

export function createSmartRevisionSourceIssue(issue: ProseIssue): SmartRevisionSourceIssue {
	return {
		id: issue.id,
		type: issue.type,
		label: issue.type,
		excerpt: issue.excerpt,
		sourceText: issue.sourceText,
		targetText: issue.sourceText,
		explanation: issue.explanation,
		suggestion: issue.suggestion,
		line: issue.line,
		startCh: issue.startCh,
		endCh: issue.endCh,
		targetLine: issue.line,
		targetStartCh: issue.startCh,
		targetEndCh: issue.endCh
	};
}
