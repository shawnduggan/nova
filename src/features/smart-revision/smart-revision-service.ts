/**
 * @file SmartRevisionService - Generates safe Smart Revision sessions from AI proposals
 */

import type { AIProviderManager } from '../../ai/provider-manager';
import { Logger } from '../../utils/logger';
import { findUniqueRange, projectAcceptedSmartRevisionText, rangesOverlap } from './smart-revision-diff';
import { createSmartRevisionImpactReport } from './smart-revision-impact';
import { buildSmartRevisionPrompts, parseSmartRevisionModelResult } from './smart-revision-prompts';
import { assessSmartRevisionRisk, compareRisk } from './smart-revision-risk';
import {
	getSmartRevisionPass,
	type SmartRevisionBrief,
	type SmartRevisionCard,
	type SmartRevisionModelCard,
	type SmartRevisionModelResult,
	type SmartRevisionRiskAssessment,
	type SmartRevisionRiskLevel,
	type SmartRevisionSession,
	type SmartRevisionTarget
} from './smart-revision-types';

export const MAX_SMART_REVISION_SELECTION_CHARS = 12_000;

export interface GenerateSmartRevisionSessionInput {
	target: SmartRevisionTarget;
	brief: SmartRevisionBrief;
	now?: () => number;
}

export class SmartRevisionService {
	constructor(private readonly aiProviderManager: AIProviderManager) {}

	async generateSession(input: GenerateSmartRevisionSessionInput): Promise<SmartRevisionSession> {
		const originalText = input.target.text;
		if (!originalText.trim()) {
			throw new Error('Select prose before starting Smart Revision.');
		}
		if (originalText.length > MAX_SMART_REVISION_SELECTION_CHARS) {
			throw new Error('Smart Revision works best on shorter passages. Select a smaller section and try again.');
		}

		const pass = getSmartRevisionPass(input.brief.passId);
		const prompts = buildSmartRevisionPrompts({
			pass,
			brief: input.brief,
			selectedText: originalText,
			sourceIssue: input.target.sourceIssue
		});
		const rawOutput = await this.aiProviderManager.complete(prompts.systemPrompt, prompts.userPrompt);
		const modelResult = parseSmartRevisionModelResult(rawOutput);
		const cards = this.buildCards(originalText, modelResult, input.brief);
		const impact = createSmartRevisionImpactReport(originalText, modelResult.revisedText);
		const risk = this.combineRisk(
			assessSmartRevisionRisk(
				originalText,
				modelResult.revisedText,
				input.brief,
				modelResult.risk,
				modelResult.riskReason
			),
			cards.map((card) => card.risk)
		);

		return {
			id: `smart-revision-${(input.now ?? Date.now)()}`,
			pass,
			brief: { ...input.brief },
			snapshot: {
				originalText,
				range: {
					from: { ...input.target.range.from },
					to: { ...input.target.range.to }
				},
				filePath: input.target.filePath,
				createdAt: (input.now ?? Date.now)()
			},
			revisedText: modelResult.revisedText,
			cards,
			impact,
			risk,
			modelRationale: modelResult.rationale
		};
	}

	private buildCards(
		originalText: string,
		modelResult: SmartRevisionModelResult,
		brief: SmartRevisionBrief
	): SmartRevisionCard[] {
		const candidateCards = this.buildMappedModelCards(originalText, modelResult, brief);
		if (candidateCards.length > 0 && this.allAcceptedTextMatchesRevision(originalText, candidateCards, modelResult.revisedText)) {
			return candidateCards.map((card) => ({ ...card, status: getInitialCardStatus(card.risk) }));
		}

		if (candidateCards.length > 0) {
			Logger.debug('Smart Revision falling back to whole-passage card because model cards did not compose cleanly', {
				cardCount: candidateCards.length
			});
		}

		return [this.createFallbackCard(originalText, modelResult, brief)];
	}

	private buildMappedModelCards(
		originalText: string,
		modelResult: SmartRevisionModelResult,
		brief: SmartRevisionBrief
	): SmartRevisionCard[] {
		const cards: SmartRevisionCard[] = [];
		for (const [index, modelCard] of modelResult.cards.entries()) {
			const original = getModelString(modelCard, 'originalText').trim();
			const revised = getModelString(modelCard, 'revisedText').trim();
			if (!original || !revised || original === revised) {
				continue;
			}
			const range = findUniqueRange(originalText, original);
			if (!range || cards.some((card) => rangesOverlap(card, range))) {
				return [];
			}
			const risk = assessSmartRevisionRisk(
				original,
				revised,
				brief,
				parseModelRisk(modelCard),
				undefined
			);
			cards.push({
				id: `card-${index + 1}`,
				label: getModelString(modelCard, 'label').trim() || 'Revised phrase',
				originalText: original,
				revisedText: revised,
				rationale: getModelString(modelCard, 'rationale').trim() || 'Nova adjusted this phrasing for the selected revision pass.',
				impact: createSmartRevisionImpactReport(original, revised),
				risk,
				status: 'accepted',
				startIndex: range.startIndex,
				endIndex: range.endIndex
			});
		}
		return cards.sort((left, right) => left.startIndex - right.startIndex);
	}

	private allAcceptedTextMatchesRevision(originalText: string, cards: SmartRevisionCard[], revisedText: string): boolean {
		const projected = projectAcceptedSmartRevisionText(originalText, cards);
		return normalizeComparableText(projected) === normalizeComparableText(revisedText);
	}

	private createFallbackCard(
		originalText: string,
		modelResult: SmartRevisionModelResult,
		brief: SmartRevisionBrief
	): SmartRevisionCard {
		const risk = assessSmartRevisionRisk(originalText, modelResult.revisedText, brief, modelResult.risk, modelResult.riskReason);
		return {
			id: 'card-1',
			label: 'Revised passage',
			originalText,
			revisedText: modelResult.revisedText,
			rationale: modelResult.rationale || 'Nova revised the selected passage as one reviewable change.',
			impact: createSmartRevisionImpactReport(originalText, modelResult.revisedText),
			risk,
			status: getInitialCardStatus(risk),
			startIndex: 0,
			endIndex: originalText.length
		};
	}

	private combineRisk(overallRisk: SmartRevisionRiskAssessment, cardRisks: SmartRevisionRiskAssessment[]): SmartRevisionRiskAssessment {
		const highestCardRisk = cardRisks.reduce<SmartRevisionRiskLevel>((highest, risk) => {
			return compareRisk(risk.level, highest) > 0 ? risk.level : highest;
		}, overallRisk.level);

		return {
			...overallRisk,
			level: highestCardRisk,
			flags: [
				...overallRisk.flags,
				...cardRisks.flatMap((risk) => risk.flags)
			]
		};
	}
}

function getModelString(card: SmartRevisionModelCard, key: keyof SmartRevisionModelCard): string {
	const value = card[key];
	return typeof value === 'string' ? value : '';
}

function parseModelRisk(card: SmartRevisionModelCard): SmartRevisionRiskLevel | undefined {
	const value = getModelString(card, 'risk').toLowerCase().trim();
	if (value === 'low' || value === 'medium' || value === 'high') {
		return value;
	}
	return undefined;
}

function getInitialCardStatus(risk: SmartRevisionRiskAssessment): SmartRevisionCard['status'] {
	return risk.level === 'high' ? 'pending' : 'accepted';
}

function normalizeComparableText(value: string): string {
	return value.replace(/\s+/g, ' ').trim();
}
