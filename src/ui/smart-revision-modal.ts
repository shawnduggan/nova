/**
 * @file SmartRevisionModal - Smart Revision pass, brief, and review surface
 */

import { Editor, EditorPosition, Modal, Notice } from 'obsidian';
import type NovaPlugin from '../../main';
import { SUPERNOVA_PLANS_URL } from '../constants';
import { createSmartRevisionDiff } from '../features/smart-revision/smart-revision-diff';
import { projectAcceptedSmartRevisionText } from '../features/smart-revision/smart-revision-diff';
import { createSmartRevisionImpactReport } from '../features/smart-revision/smart-revision-impact';
import type { SmartRevisionService } from '../features/smart-revision/smart-revision-service';
import {
	DEFAULT_SMART_REVISION_BRIEF,
	SMART_REVISION_PASSES,
	type SmartRevisionBrief,
	type SmartRevisionCard,
	type SmartRevisionImpactReport,
	type SmartRevisionPassId,
	type SmartRevisionPosture,
	type SmartRevisionSession,
	type SmartRevisionTarget
} from '../features/smart-revision/smart-revision-types';
import { TimeoutManager } from '../utils/timeout-manager';

type SmartRevisionModalMode = 'brief' | 'loading' | 'review' | 'error' | 'preview';

interface SmartRevisionLoadingSummaryRow {
	label: string;
	value: string;
}

export interface SmartRevisionModalOptions {
	accessAllowed: boolean;
	plansUrl?: string;
	onComplete?: () => void | Promise<void>;
}

export class SmartRevisionModal extends Modal {
	private mode: SmartRevisionModalMode;
	private brief: SmartRevisionBrief = { ...DEFAULT_SMART_REVISION_BRIEF };
	private session: SmartRevisionSession | null = null;
	private errorMessage = '';
	private hasFocusedInitialBrief = false;
	private readonly timeoutManager = new TimeoutManager();
	private readonly plansUrl: string;
	private readonly onComplete?: () => void | Promise<void>;

	constructor(
		private readonly plugin: NovaPlugin,
		private readonly editor: Editor,
		private readonly target: SmartRevisionTarget,
		private readonly service: SmartRevisionService,
		options: SmartRevisionModalOptions
	) {
		super(plugin.app);
		this.mode = options.accessAllowed ? 'brief' : 'preview';
		this.plansUrl = options.plansUrl ?? SUPERNOVA_PLANS_URL;
		this.onComplete = options.onComplete;
		if (target.sourceIssue) {
			this.brief.passId = this.getDefaultPassForIssue(target.sourceIssue.type);
		}
	}

	onOpen(): void {
		this.contentEl.empty();
		this.contentEl.addClass('nova-smart-revision-modal');
		this.contentEl.setAttribute('tabindex', '-1');
		this.render();
	}

	onClose(): void {
		this.timeoutManager.clearAll();
		this.contentEl.empty();
		this.session = null;
	}

	private render(): void {
		this.contentEl.empty();
		const headerEl = this.contentEl.createDiv({ cls: 'nova-smart-revision-header' });
		headerEl.createDiv({ cls: 'nova-smart-revision-brand', text: 'Nova' });
		headerEl.createEl('h2', { cls: 'nova-smart-revision-title', text: 'Smart revision' });

		if (this.mode === 'preview') {
			this.renderPreview();
			return;
		}
		if (this.mode === 'loading') {
			this.renderLoading();
			return;
		}
		if (this.mode === 'error') {
			this.renderError();
			return;
		}
		if (this.mode === 'review' && this.session) {
			this.renderReview(this.session);
			return;
		}

		this.renderBrief();
	}

	private renderPreview(): void {
		const previewEl = this.contentEl.createDiv({ cls: 'nova-smart-revision-preview' });
		previewEl.createDiv({
			cls: 'nova-smart-revision-preview-copy',
			text: 'Smart Revision is a premium feature unlocked by Supernova. Preview the review shape below without using an AI call.'
		});
		const cardsEl = previewEl.createDiv({ cls: 'nova-smart-revision-card-list' });
		this.renderStaticPreviewCard(cardsEl, 'Split long sentence', 'Grade 11 to 8', 'Low risk');
		this.renderStaticPreviewCard(cardsEl, 'Removed hedge', 'Weak phrases 3 to 1', 'Low risk');
		this.renderStaticPreviewCard(cardsEl, 'Protected claim', 'Numbers unchanged', 'High risk held for review');
		const actionsEl = this.contentEl.createDiv({ cls: 'nova-smart-revision-footer' });
		this.createButton(actionsEl, 'Unlock Smart Revision with Supernova', () => this.openPlans(), true);
		this.createButton(actionsEl, 'Close', () => this.close());
	}

	private openPlans(): void {
		window.open(this.plansUrl, '_blank', 'noopener');
	}

	private renderStaticPreviewCard(container: HTMLElement, label: string, impact: string, risk: string): void {
		const cardEl = container.createDiv({ cls: 'nova-smart-revision-card nova-smart-revision-card--preview' });
		cardEl.createDiv({ cls: 'nova-smart-revision-card-title', text: label });
		cardEl.createDiv({ cls: 'nova-smart-revision-card-meta', text: impact });
		cardEl.createDiv({ cls: 'nova-smart-revision-card-risk', text: risk });
	}

	private renderLoading(): void {
		const loadingEl = this.contentEl.createDiv({ cls: 'nova-smart-revision-loading' });
		const pass = this.getSelectedPass();
		loadingEl.createDiv({ cls: 'nova-smart-revision-loading-title', text: `Preparing ${getSmartRevisionPassLabel(pass.id, pass.label)} revision...` });
		loadingEl.createDiv({ cls: 'nova-smart-revision-loading-copy', text: 'Nova is reviewing the selection with these instructions. The note will not change until you apply accepted cards.' });
		this.renderLoadingSummary(loadingEl);
		const progressEl = loadingEl.createDiv({ cls: 'nova-smart-revision-progress' });
		progressEl.setAttribute('role', 'progressbar');
		progressEl.setAttribute('aria-label', 'Preparing revision pass');
		progressEl.setAttribute('aria-valuetext', 'Generating proposal');
		progressEl.createDiv({ cls: 'nova-smart-revision-progress-bar' });
	}

	private renderLoadingSummary(container: HTMLElement): void {
		const summaryEl = container.createDiv({ cls: 'nova-smart-revision-loading-summary' });
		summaryEl.createDiv({ cls: 'nova-smart-revision-loading-summary-title', text: 'Request summary' });
		const listEl = summaryEl.createEl('ul', { cls: 'nova-smart-revision-loading-summary-list' });
		for (const row of this.getLoadingSummaryRows()) {
			const itemEl = listEl.createEl('li', { cls: 'nova-smart-revision-loading-summary-item' });
			itemEl.createSpan({ cls: 'nova-smart-revision-loading-summary-label', text: `${row.label}: ` });
			itemEl.createSpan({ cls: 'nova-smart-revision-loading-summary-value', text: row.value });
		}
	}

	private getLoadingSummaryRows(): SmartRevisionLoadingSummaryRow[] {
		const pass = this.getSelectedPass();
		const rows: SmartRevisionLoadingSummaryRow[] = [
			{ label: 'Pass', value: getSmartRevisionPassLabel(pass.id, pass.label) },
			{ label: 'Posture', value: formatSmartRevisionPosture(this.brief.posture) }
		];
		const guardrails = this.getActiveGuardrailLabels();
		if (guardrails.length > 0) {
			rows.push({ label: 'Guardrails', value: guardrails.join(', ') });
		}
		this.addBriefSummaryRow(rows, 'Audience', this.brief.audience);
		this.addBriefSummaryRow(rows, 'Goal', this.brief.goal);
		this.addBriefSummaryRow(rows, 'Do not change', this.brief.doNotChange);
		this.addBriefSummaryRow(rows, 'Custom instruction', this.brief.customInstruction);
		return rows;
	}

	private getSelectedPass() {
		return SMART_REVISION_PASSES.find((pass) => pass.id === this.brief.passId) ?? SMART_REVISION_PASSES[0];
	}

	private getActiveGuardrailLabels(): string[] {
		const labels: string[] = [];
		if (this.brief.preserveVoice) {
			labels.push('Voice');
		}
		if (this.brief.preserveMeaning) {
			labels.push('Meaning');
		}
		if (this.brief.preserveMarkdown) {
			labels.push('Markdown');
		}
		if (this.brief.doNotAddFacts) {
			labels.push('No new facts');
		}
		return labels;
	}

	private addBriefSummaryRow(rows: SmartRevisionLoadingSummaryRow[], label: string, value: string): void {
		const normalized = formatBriefSummaryValue(value);
		if (normalized) {
			rows.push({ label, value: normalized });
		}
	}

	private renderError(): void {
		const errorEl = this.contentEl.createDiv({ cls: 'nova-smart-revision-error' });
		errorEl.createDiv({ cls: 'nova-smart-revision-error-title', text: 'Smart revision could not create a safe proposal.' });
		errorEl.createDiv({ cls: 'nova-smart-revision-error-copy', text: this.errorMessage });
		const actionsEl = this.contentEl.createDiv({ cls: 'nova-smart-revision-footer' });
		this.createButton(actionsEl, 'Back', () => {
			this.mode = 'brief';
			this.render();
		});
		this.createButton(actionsEl, 'Close', () => this.close());
	}

	private renderBrief(): void {
		const formEl = this.contentEl.createDiv({ cls: 'nova-smart-revision-form' });
		this.renderPassPicker(formEl);
		this.renderPosturePicker(formEl);
		this.renderBriefToggles(formEl);
		this.renderIntentFields(formEl);

		const actionsEl = this.contentEl.createDiv({ cls: 'nova-smart-revision-footer' });
		this.createButton(actionsEl, 'Cancel', () => this.close());
		this.createButton(actionsEl, 'Generate proposal', () => {
			void this.generateProposal();
		}, true);
		this.focusInitialBrief();
	}

	private renderPassPicker(container: HTMLElement): void {
		const groupEl = container.createDiv({ cls: 'nova-smart-revision-section' });
		groupEl.createDiv({ cls: 'nova-smart-revision-section-title', text: 'Choose a revision pass' });
		const passesEl = groupEl.createDiv({ cls: 'nova-smart-revision-pass-list' });
		for (const pass of SMART_REVISION_PASSES) {
			const selected = this.brief.passId === pass.id;
			const button = passesEl.createEl('button', {
				cls: `nova-smart-revision-pass ${selected ? 'nova-smart-revision-pass--selected' : ''}`
			});
			button.setAttribute('type', 'button');
			button.setAttribute('aria-pressed', selected ? 'true' : 'false');
			button.createSpan({ cls: 'nova-smart-revision-pass-label', text: getSmartRevisionPassLabel(pass.id, pass.label) });
			button.createSpan({ cls: 'nova-smart-revision-pass-desc', text: pass.description });
			this.registerButton(button, () => {
				this.brief.passId = pass.id;
				this.render();
			});
		}
	}

	private focusInitialBrief(): void {
		if (this.hasFocusedInitialBrief) {
			return;
		}
		this.hasFocusedInitialBrief = true;
		this.timeoutManager.addTimeout(() => {
			if (this.mode === 'brief' && this.contentEl.isConnected) {
				this.contentEl.focus({ preventScroll: true });
			}
		}, 75);
	}

	private renderPosturePicker(container: HTMLElement): void {
		const groupEl = container.createDiv({ cls: 'nova-smart-revision-section' });
		groupEl.createDiv({ cls: 'nova-smart-revision-section-title', text: 'How much should Nova change?' });
		const postureEl = groupEl.createDiv({ cls: 'nova-smart-revision-segmented' });
		this.renderPostureButton(postureEl, 'conservative', 'Conservative');
		this.renderPostureButton(postureEl, 'balanced', 'Balanced');
		this.renderPostureButton(postureEl, 'bold', 'Bold');
	}

	private renderPostureButton(container: HTMLElement, value: SmartRevisionPosture, label: string): void {
		const selected = this.brief.posture === value;
		const button = container.createEl('button', {
			cls: `nova-smart-revision-segment ${selected ? 'nova-smart-revision-segment--selected' : ''}`,
			text: label
		});
		button.setAttribute('type', 'button');
		button.setAttribute('aria-pressed', selected ? 'true' : 'false');
		this.registerButton(button, () => {
			this.brief.posture = value;
			this.render();
		});
	}

	private renderBriefToggles(container: HTMLElement): void {
		const groupEl = container.createDiv({ cls: 'nova-smart-revision-section' });
		groupEl.createDiv({ cls: 'nova-smart-revision-section-title', text: 'Guardrails' });
		const togglesEl = groupEl.createDiv({ cls: 'nova-smart-revision-checklist' });
		this.renderToggle(togglesEl, 'Preserve voice', 'preserveVoice');
		this.renderToggle(togglesEl, 'Preserve meaning', 'preserveMeaning');
		this.renderToggle(togglesEl, 'Preserve Markdown', 'preserveMarkdown');
		this.renderToggle(togglesEl, 'Do not add facts', 'doNotAddFacts');
	}

	private renderToggle(container: HTMLElement, label: string, key: keyof Pick<SmartRevisionBrief, 'preserveVoice' | 'preserveMeaning' | 'preserveMarkdown' | 'doNotAddFacts'>): void {
		const labelEl = container.createEl('label', {
			cls: `nova-smart-revision-check ${this.brief[key] ? 'nova-smart-revision-check--checked' : ''}`
		});
		const inputEl = labelEl.createEl('input', { cls: 'nova-smart-revision-check-input' });
		inputEl.setAttribute('type', 'checkbox');
		inputEl.checked = this.brief[key];
		labelEl.createSpan({ cls: 'nova-smart-revision-check-label', text: label });
		this.plugin.registerDomEvent(inputEl, 'change', () => {
			this.brief[key] = inputEl.checked;
			labelEl.classList.toggle('nova-smart-revision-check--checked', inputEl.checked);
		});
	}

	private renderIntentFields(container: HTMLElement): void {
		const detailsEl = container.createEl('details', { cls: 'nova-smart-revision-context' });
		const summaryEl = detailsEl.createEl('summary', { cls: 'nova-smart-revision-context-summary' });
		summaryEl.createSpan({ cls: 'nova-smart-revision-context-title', text: 'Add context' });
		summaryEl.createSpan({ cls: 'nova-smart-revision-context-optional', text: 'Optional' });
		detailsEl.createDiv({ cls: 'nova-smart-revision-context-copy', text: 'Add audience, goals, terms to preserve, or extra direction when the selection needs it.' });
		const fieldsEl = detailsEl.createDiv({ cls: 'nova-smart-revision-context-fields' });
		this.renderTextInput(fieldsEl, 'Audience', 'Who this passage is for', this.brief.audience, (value) => {
			this.brief.audience = value;
		});
		this.renderTextInput(fieldsEl, 'Goal', 'What this passage needs to do', this.brief.goal, (value) => {
			this.brief.goal = value;
		});
		this.renderTextArea(fieldsEl, 'Do not change', 'Names, terms, claims, or phrases to preserve', this.brief.doNotChange, (value) => {
			this.brief.doNotChange = value;
		});
		this.renderTextArea(fieldsEl, 'Custom instruction', 'Optional extra direction for this pass', this.brief.customInstruction, (value) => {
			this.brief.customInstruction = value;
		});
	}

	private renderTextInput(container: HTMLElement, label: string, placeholder: string, value: string, onChange: (value: string) => void): void {
		const fieldEl = container.createDiv({ cls: 'nova-smart-revision-field' });
		fieldEl.createDiv({ cls: 'nova-smart-revision-field-label', text: label });
		const inputEl = fieldEl.createEl('input', { cls: 'nova-smart-revision-input' });
		inputEl.setAttribute('type', 'text');
		inputEl.setAttribute('placeholder', placeholder);
		inputEl.value = value;
		this.plugin.registerDomEvent(inputEl, 'input', () => onChange(inputEl.value));
	}

	private renderTextArea(container: HTMLElement, label: string, placeholder: string, value: string, onChange: (value: string) => void): void {
		const fieldEl = container.createDiv({ cls: 'nova-smart-revision-field' });
		fieldEl.createDiv({ cls: 'nova-smart-revision-field-label', text: label });
		const textareaEl = fieldEl.createEl('textarea', { cls: 'nova-smart-revision-textarea' });
		textareaEl.setAttribute('placeholder', placeholder);
		textareaEl.setAttribute('rows', '3');
		textareaEl.value = value;
		this.plugin.registerDomEvent(textareaEl, 'input', () => onChange(textareaEl.value));
	}

	private async generateProposal(): Promise<void> {
		this.mode = 'loading';
		this.render();
		try {
			this.session = await this.service.generateSession({
				target: this.target,
				brief: { ...this.brief }
			});
			this.mode = 'review';
			this.render();
		} catch (error) {
			this.errorMessage = error instanceof Error ? error.message : 'Unknown Smart Revision error.';
			this.mode = 'error';
			this.render();
		}
	}

	private renderReview(session: SmartRevisionSession): void {
		const projectedText = this.getProjectedRevisionText(session);
		this.renderDiff(session, projectedText);
		this.renderReviewSummary(session, projectedText);
		this.renderCards(session);
		this.renderReviewActions(session);
	}

	private renderReviewSummary(session: SmartRevisionSession, projectedText: string): void {
		const summaryEl = this.contentEl.createDiv({ cls: 'nova-smart-revision-review-summary' });
		summaryEl.createDiv({ cls: 'nova-smart-revision-review-title', text: `${getSmartRevisionPassLabel(session.pass.id, session.pass.label)} summary` });
		if (session.modelRationale) {
			summaryEl.createDiv({ cls: 'nova-smart-revision-review-rationale', text: session.modelRationale });
		}
		this.renderRisk(summaryEl, session.risk.level, `Meaning risk: ${session.risk.level}`);
		this.renderImpactReport(summaryEl, createSmartRevisionImpactReport(session.snapshot.originalText, projectedText));
	}

	private renderRisk(container: HTMLElement, risk: string, text: string): void {
		container.createDiv({
			cls: `nova-smart-revision-risk nova-smart-revision-risk--${risk}`,
			text
		});
	}

	private renderImpactReport(container: HTMLElement, impact: SmartRevisionImpactReport): void {
		const impactEl = container.createDiv({ cls: 'nova-smart-revision-impact' });
		impactEl.createDiv({ cls: 'nova-smart-revision-impact-title', text: impact.summary });
		const metricsEl = impactEl.createDiv({ cls: 'nova-smart-revision-impact-metrics' });
		for (const metric of impact.metrics) {
			const metricEl = metricsEl.createDiv({ cls: `nova-smart-revision-impact-metric ${metric.improved ? 'nova-smart-revision-impact-metric--improved' : ''}` });
			metricEl.createSpan({ cls: 'nova-smart-revision-impact-label', text: metric.label });
			metricEl.createSpan({ cls: 'nova-smart-revision-impact-values', text: `${metric.before} to ${metric.after}` });
		}
	}

	private renderDiff(session: SmartRevisionSession, projectedText: string): void {
		const diffEl = this.contentEl.createDiv({ cls: 'nova-smart-revision-diff' });
		diffEl.createDiv({ cls: 'nova-smart-revision-section-title', text: 'Proposed revision' });
		const bodyEl = diffEl.createDiv({ cls: 'nova-smart-revision-diff-body' });
		for (const segment of createSmartRevisionDiff(session.snapshot.originalText, projectedText)) {
			const span = bodyEl.createSpan({ cls: `nova-smart-revision-diff-segment nova-smart-revision-diff-segment--${segment.type}` });
			span.setText(segment.text);
		}
	}

	private getProjectedRevisionText(session: SmartRevisionSession): string {
		return projectAcceptedSmartRevisionText(session.snapshot.originalText, session.cards);
	}

	private renderCards(session: SmartRevisionSession): void {
		const sectionEl = this.contentEl.createDiv({ cls: 'nova-smart-revision-section' });
		sectionEl.createDiv({ cls: 'nova-smart-revision-section-title', text: 'What changed' });
		const listEl = sectionEl.createDiv({ cls: 'nova-smart-revision-card-list' });
		for (const card of session.cards) {
			this.renderCard(listEl, card);
		}
	}

	private renderCard(container: HTMLElement, card: SmartRevisionCard): void {
		const cardEl = container.createDiv({
			cls: `nova-smart-revision-card nova-smart-revision-card--${card.status} nova-smart-revision-card--risk-${card.risk.level}`
		});
		const headerEl = cardEl.createDiv({ cls: 'nova-smart-revision-card-header' });
		headerEl.createDiv({ cls: 'nova-smart-revision-card-title', text: card.label });
		headerEl.createDiv({ cls: 'nova-smart-revision-card-status', text: card.status });
		cardEl.createDiv({ cls: 'nova-smart-revision-card-rationale', text: card.rationale });
		this.renderCardChangePreview(cardEl, card);
		this.renderRisk(cardEl, card.risk.level, `Risk: ${card.risk.level}`);
		if (card.risk.flags.length > 0) {
			const flagsEl = cardEl.createDiv({ cls: 'nova-smart-revision-card-flags' });
			for (const flag of card.risk.flags.slice(0, 3)) {
				flagsEl.createDiv({ cls: 'nova-smart-revision-card-flag', text: `${flag.label}: ${flag.detail}` });
			}
		}
		const receiptEl = cardEl.createEl('details', { cls: 'nova-smart-revision-receipt' });
		receiptEl.createEl('summary', { text: 'Receipt' });
		if (card.sourceIssueLabel) {
			receiptEl.createDiv({ cls: 'nova-smart-revision-receipt-row', text: `Source issue: ${card.sourceIssueLabel}` });
		}
		receiptEl.createDiv({ cls: 'nova-smart-revision-receipt-row', text: `Changed: ${summarizeChange(card.originalText, card.revisedText)}` });
		if (card.impact) {
			receiptEl.createDiv({ cls: 'nova-smart-revision-receipt-row', text: `Impact: ${card.impact.summary}` });
		}
		const actionsEl = cardEl.createDiv({ cls: 'nova-smart-revision-card-actions' });
		this.createButton(actionsEl, 'Accept', () => this.updateCardStatus(card.id, 'accepted'), card.status === 'accepted');
		this.createButton(actionsEl, 'Reject', () => this.updateCardStatus(card.id, 'rejected'), card.status === 'rejected');
	}

	private renderReviewActions(session: SmartRevisionSession): void {
		const footerEl = this.contentEl.createDiv({ cls: 'nova-smart-revision-footer' });
		this.createButton(footerEl, 'Accept all', () => this.acceptAllSafeCards());
		this.createButton(footerEl, 'Reject all', () => this.rejectAllCards());
		this.createButton(footerEl, 'Restore original', () => {
			void this.restoreSnapshot();
		});
		this.createButton(footerEl, 'Apply accepted', () => {
			void this.applyAcceptedCards(session);
		}, true);
	}

	private renderCardChangePreview(container: HTMLElement, card: SmartRevisionCard): void {
		const changeEl = container.createDiv({ cls: 'nova-smart-revision-card-change' });
		changeEl.createDiv({ cls: 'nova-smart-revision-card-change-label', text: 'Change' });
		const gridEl = changeEl.createDiv({ cls: 'nova-smart-revision-card-change-grid' });
		this.renderCardChangeSnippet(gridEl, 'Before', card.originalText, 'before');
		this.renderCardChangeSnippet(gridEl, 'After', card.revisedText, 'after');
	}

	private renderCardChangeSnippet(container: HTMLElement, label: string, text: string, kind: 'before' | 'after'): void {
		const itemEl = container.createDiv({ cls: 'nova-smart-revision-card-change-item' });
		itemEl.createSpan({ cls: 'nova-smart-revision-card-change-tag', text: label });
		itemEl.createSpan({
			cls: `nova-smart-revision-card-change-text nova-smart-revision-card-change-text--${kind}`,
			text: formatChangeSnippet(text)
		});
	}

	private updateCardStatus(cardId: string, status: SmartRevisionCard['status']): void {
		if (!this.session) {
			return;
		}
		this.session.cards = this.session.cards.map((card) => card.id === cardId ? { ...card, status } : card);
		this.render();
	}

	private acceptAllSafeCards(): void {
		if (!this.session) {
			return;
		}
		let heldCount = 0;
		this.session.cards = this.session.cards.map((card) => {
			if (card.risk.level === 'high') {
				heldCount += 1;
				return card;
			}
			return { ...card, status: 'accepted' };
		});
		if (heldCount > 0) {
			new Notice(`${heldCount} high-risk ${heldCount === 1 ? 'card needs' : 'cards need'} individual review.`, 3000);
		}
		this.render();
	}

	private rejectAllCards(): void {
		if (!this.session) {
			return;
		}
		this.session.cards = this.session.cards.map((card) => ({ ...card, status: 'rejected' }));
		this.render();
	}

	private async applyAcceptedCards(session: SmartRevisionSession): Promise<void> {
		const acceptedCount = session.cards.filter((card) => card.status === 'accepted').length;
		if (acceptedCount === 0) {
			new Notice('Accept at least one revision card first.', 2500);
			return;
		}
		const currentText = this.getRangeText(session.snapshot.range.from, session.snapshot.range.to);
		if (currentText !== session.snapshot.originalText) {
			new Notice('The selected passage changed after revision started. No changes were applied.', 4000);
			return;
		}
		const acceptedText = projectAcceptedSmartRevisionText(session.snapshot.originalText, session.cards);
		if (acceptedText === session.snapshot.originalText) {
			new Notice('No accepted changes to apply.', 2500);
			return;
		}
		this.editor.replaceRange(acceptedText, session.snapshot.range.from, session.snapshot.range.to);
		new Notice(`Applied ${acceptedCount} revision ${acceptedCount === 1 ? 'card' : 'cards'}.`, 2500);
		await this.refreshAfterEditorMutation();
		this.close();
	}

	private async restoreSnapshot(): Promise<void> {
		if (!this.session) {
			this.close();
			return;
		}
		const currentText = this.getRangeText(this.session.snapshot.range.from, this.session.snapshot.range.to);
		if (currentText !== this.session.snapshot.originalText) {
			this.editor.replaceRange(this.session.snapshot.originalText, this.session.snapshot.range.from, this.session.snapshot.range.to);
		}
		new Notice('Original passage restored.', 2000);
		await this.refreshAfterEditorMutation();
		this.close();
	}

	private async refreshAfterEditorMutation(): Promise<void> {
		await this.plugin.writingAnalysisManager?.analyzeNow();
		await this.onComplete?.();
	}

	private createButton(container: HTMLElement, text: string, onClick: () => void | Promise<void>, primary = false): HTMLButtonElement {
		const button = container.createEl('button', {
			cls: primary ? 'nova-smart-revision-button mod-cta' : 'nova-smart-revision-button',
			text
		});
		button.setAttribute('type', 'button');
		this.registerButton(button, onClick);
		return button;
	}

	private registerButton(button: HTMLElement, onClick: () => void | Promise<void>): void {
		this.plugin.registerDomEvent(button, 'click', (event: MouseEvent) => {
			event.preventDefault();
			event.stopPropagation();
			void onClick();
		});
	}

	private getRangeText(from: EditorPosition, to: EditorPosition): string {
		if (from.line === to.line) {
			return this.editor.getLine(from.line).slice(from.ch, to.ch);
		}
		const lines: string[] = [];
		for (let line = from.line; line <= to.line; line += 1) {
			const text = this.editor.getLine(line);
			if (line === from.line) {
				lines.push(text.slice(from.ch));
			} else if (line === to.line) {
				lines.push(text.slice(0, to.ch));
			} else {
				lines.push(text);
			}
		}
		return lines.join('\n');
	}

	private getDefaultPassForIssue(issueType: string): SmartRevisionPassId {
		switch (issueType) {
			case 'adverb':
			case 'weak-intensifier':
			case 'qualifier':
			case 'complex-word':
				return 'tighten';
			case 'repeated-word':
			case 'repeated-phrase':
			case 'sticky-sentence':
			case 'sentence-start':
				return 'flow';
			case 'telling-language':
				return 'more-human';
			default:
				return 'clarity';
		}
	}
}

function summarizeChange(originalText: string, revisedText: string): string {
	const originalWords = countWords(originalText);
	const revisedWords = countWords(revisedText);
	if (originalWords === revisedWords) {
		return `${originalWords} ${originalWords === 1 ? 'word' : 'words'}, wording changed`;
	}
	return `${originalWords} to ${revisedWords} ${revisedWords === 1 ? 'word' : 'words'}`;
}

function formatChangeSnippet(text: string): string {
	const normalized = text.replace(/\s+/g, ' ').trim();
	if (!normalized) {
		return 'No text';
	}
	if (normalized.length <= 140) {
		return normalized;
	}
	return `${normalized.slice(0, 137)}...`;
}

function getSmartRevisionPassLabel(passId: SmartRevisionPassId, fallback: string): string {
	return passId === 'more-human' ? 'Humanize' : fallback;
}

function formatSmartRevisionPosture(posture: SmartRevisionPosture): string {
	switch (posture) {
		case 'conservative':
			return 'Conservative';
		case 'bold':
			return 'Bold';
		default:
			return 'Balanced';
	}
}

function formatBriefSummaryValue(value: string): string {
	const normalized = value.replace(/\s+/g, ' ').trim();
	if (normalized.length <= 140) {
		return normalized;
	}
	return `${normalized.slice(0, 137)}...`;
}

function countWords(text: string): number {
	const matches = text.match(/[A-Za-z0-9]+(?:'[A-Za-z0-9]+)?/g);
	return matches?.length ?? 0;
}
