/**
 * @file ProseLinterView - Dedicated current-note Prose Linter view
 */

import { Editor, ItemView, MarkdownView, Platform, TFile, WorkspaceLeaf } from 'obsidian';
import type NovaPlugin from '../../main';
import { VIEW_TYPE_PROSE_LINTER } from '../constants';
import { analyzeWriting, hashContent, MAX_PROSE_LINTER_ANALYSIS_CHAR_LENGTH, type WritingAnalysis } from '../core/writing-analysis';
import { createAnalysisRunToken } from '../core/writing-analysis-runner';
import { buildProseIssues } from '../features/prose-linter/prose-linter-issues';
import { createProseIssuePage, PROSE_LINTER_INITIAL_VISIBLE_COUNT } from '../features/prose-linter/prose-linter-rendering';
import { runBudgetedProseLinter, type ProseLinterRunnerState } from '../features/prose-linter/prose-linter-runner';
import type { ProseIgnoredIssueRecord } from '../features/prose-linter/prose-linter-store';
import {
	GENERAL_PROSE_CONFIG,
	PROSE_ISSUE_LABELS,
	type ProseIssue,
	type ProseIssueType
} from '../features/prose-linter/prose-linter-types';
import type { SmartRevisionSourceIssue } from '../features/smart-revision/smart-revision-types';
import { WRITING_ANALYSIS_UPDATED_EVENT, type WritingAnalysisUpdateDetail } from './writing-analysis-manager';

export { VIEW_TYPE_PROSE_LINTER };

interface ProseLinterRenderState {
	file: TFile | null;
	content: string;
	analysis: WritingAnalysis | null;
	issues: ProseIssue[];
	deepState: ProseLinterRunnerState;
	deferredRuleIds: string[];
	oversized: boolean;
	disabledByFrontmatter: boolean;
}

interface ProseLinterCategoryGroup {
	key: string;
	issueTypes: ProseIssueType[];
	displayType: ProseIssueType;
	singular: string;
	plural: string;
}

const PROSE_LINTER_CATEGORY_GROUPS: ProseLinterCategoryGroup[] = [
	{
		key: 'very-hard',
		issueTypes: ['very-long-sentence'],
		displayType: 'very-long-sentence',
		singular: 'very hard sentence',
		plural: 'very hard sentences'
	},
	{
		key: 'hard',
		issueTypes: ['long-sentence'],
		displayType: 'long-sentence',
		singular: 'hard sentence',
		plural: 'hard sentences'
	},
	{
		key: 'repetition',
		issueTypes: ['repeated-word', 'repeated-phrase', 'sticky-sentence', 'sentence-start'],
		displayType: 'repeated-phrase',
		singular: 'repeated phrase',
		plural: 'repeated phrases'
	},
	{
		key: 'passive',
		issueTypes: ['passive-voice'],
		displayType: 'passive-voice',
		singular: 'passive voice issue',
		plural: 'passive voice issues'
	},
	{
		key: 'weakeners',
		issueTypes: ['adverb', 'weak-intensifier', 'qualifier', 'telling-language'],
		displayType: 'adverb',
		singular: 'weakener',
		plural: 'weakeners'
	},
	{
		key: 'alternatives',
		issueTypes: ['complex-word'],
		displayType: 'complex-word',
		singular: 'complex word',
		plural: 'complex words'
	}
];
const PROSE_LINTER_MAX_EDITOR_HIGHLIGHTS = 500;

export class ProseLinterView extends ItemView {
	private readonly plugin: NovaPlugin;
	private rootEl: HTMLElement | null = null;
	private summaryEl: HTMLElement | null = null;
	private categoriesEl: HTMLElement | null = null;
	private ignoredEl: HTMLElement | null = null;
	private listEl: HTMLElement | null = null;
	private emptyEl: HTMLElement | null = null;
	private statusEl: HTMLElement | null = null;

	private hiddenIssueTypes = new Set<ProseIssueType>();
	private ignoredIssueIds = new Set<string>();
	private visibleCount = PROSE_LINTER_INITIAL_VISIBLE_COUNT;
	private lastContentHash = '';
	private state: ProseLinterRenderState = {
		file: null,
		content: '',
		analysis: null,
		issues: [],
		deepState: 'complete',
		deferredRuleIds: [],
		oversized: false,
		disabledByFrontmatter: false
	};

	constructor(leaf: WorkspaceLeaf, plugin: NovaPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.app = plugin.app;
	}

	getViewType(): string {
		return VIEW_TYPE_PROSE_LINTER;
	}

	getDisplayText(): string {
		return 'Nova prose linter';
	}

	getIcon(): string {
		return 'list-checks';
	}

	async onOpen(): Promise<void> {
		await this.plugin.proseLinterStore.load();
		this.buildLayout();
		this.activateReviewIfShown();
		this.registerEvent(this.app.workspace.on('file-open', () => {
			void this.refresh();
		}));
		this.registerEvent(this.app.workspace.on('active-leaf-change', () => {
			void this.refresh();
		}));
		this.registerDomEvent(document, WRITING_ANALYSIS_UPDATED_EVENT as keyof DocumentEventMap, (event: Event) => {
			this.handleWritingAnalysisUpdated(event);
		});
		await this.refresh();
		this.activateReviewIfShown();
	}

	async onClose(): Promise<void> {
		this.plugin.writingAnalysisManager?.setProseLinterReviewActive(false);
		this.plugin.writingAnalysisManager?.clearProseLinterHighlights(this.state.file?.path);
		this.rootEl?.empty();
		await Promise.resolve();
	}

	onResize(): void {
		this.activateReviewIfShown();
	}

	async refresh(forceOversized = false): Promise<void> {
		const file = this.getCurrentFile();
		if (!file) {
			this.state = {
				file: null,
				content: '',
				analysis: null,
				issues: [],
				deepState: 'complete',
				deferredRuleIds: [],
				oversized: false,
				disabledByFrontmatter: false
			};
			this.render();
			return;
		}

		const content = await this.getCurrentContent(file);
		const contentHash = hashContent(content);
		if (contentHash !== this.lastContentHash) {
			this.visibleCount = PROSE_LINTER_INITIAL_VISIBLE_COUNT;
			this.lastContentHash = contentHash;
		}

		if (!forceOversized && content.length > MAX_PROSE_LINTER_ANALYSIS_CHAR_LENGTH) {
			this.state = {
				file,
				content,
				analysis: null,
				issues: [],
				deepState: 'pending',
				deferredRuleIds: [],
				oversized: true,
				disabledByFrontmatter: false
			};
			this.render();
			return;
		}

		const analysis = analyzeWriting(content, {
			longSentenceThreshold: GENERAL_PROSE_CONFIG.longSentenceWords,
			veryLongSentenceThreshold: GENERAL_PROSE_CONFIG.veryLongSentenceWords
		});
		const disabledByFrontmatter = analysis.readabilityLabel.includes('disabled');
		const runToken = this.plugin.writingAnalysisManager?.getActiveRunToken() ??
			createAnalysisRunToken(file.path, contentHash, 0);
		const deepResult = disabledByFrontmatter
			? { issues: [], state: 'complete' as ProseLinterRunnerState, deferredRuleIds: [] }
			: runBudgetedProseLinter({
				content,
				config: GENERAL_PROSE_CONFIG,
				filePath: file.path,
				runToken,
				isStale: (token) => {
					const active = this.plugin.writingAnalysisManager?.getActiveRunToken();
					return Boolean(active && active.sequence > token.sequence && active.filePath !== token.filePath);
				}
		});
		const ignoredIssueTypes = this.plugin.proseLinterStore.getIgnoredIssueTypes(file.path);
		const candidateIssues = disabledByFrontmatter
			? []
			: buildProseIssues({
				analysis,
				content,
				filePath: file.path,
				deepIssues: deepResult.issues,
				ignoredIssueIds: this.ignoredIssueIds,
				ignoredIssueTypes
			});
		const ignoredIssueKeys = this.plugin.proseLinterStore.getIgnoredIssueKeys(file.path, candidateIssues);
		const issues = candidateIssues.filter((issue) => !ignoredIssueKeys.has(issue.ignoreKey));

		this.state = {
			file,
			content,
			analysis,
			issues,
			deepState: deepResult.state,
			deferredRuleIds: deepResult.deferredRuleIds,
			oversized: false,
			disabledByFrontmatter
		};
		this.render();
	}

	private buildLayout(): void {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.addClass('nova-prose-linter-view');
		this.registerDomEvent(container, 'click', () => {
			this.activateReviewIfShown();
		});
		this.rootEl = container;

		const headerEl = container.createDiv({ cls: 'nova-prose-linter-header' });
		headerEl.createDiv({ cls: 'nova-prose-linter-brand', text: 'Nova' });
		headerEl.createEl('h2', { cls: 'nova-prose-linter-title', text: 'Prose linter' });

		this.summaryEl = container.createDiv({ cls: 'nova-prose-linter-summary' });
		this.categoriesEl = container.createDiv({ cls: 'nova-prose-linter-categories' });
		this.statusEl = container.createDiv({ cls: 'nova-prose-linter-status' });
		this.ignoredEl = container.createDiv({ cls: 'nova-prose-linter-ignored' });
		this.listEl = container.createDiv({ cls: 'nova-prose-linter-list' });
		this.emptyEl = container.createDiv({ cls: 'nova-prose-linter-empty' });
	}

	private render(): void {
		this.renderSummary();
		this.renderCategories();
		this.renderStatus();
		this.renderIgnoredItems();
		this.renderIssues();
		this.syncEditorHighlights();
	}

	private renderSummary(): void {
		if (!this.summaryEl) {
			return;
		}
		this.summaryEl.empty();

		if (!this.state.file) {
			this.summaryEl.createDiv({ cls: 'nova-prose-linter-summary-empty', text: 'Open a markdown note to review prose.' });
			return;
		}

		if (this.state.oversized) {
			this.summaryEl.createDiv({
				cls: 'nova-prose-linter-summary-empty',
				text: 'This note is large. Run analysis when you are ready.'
			});
			const analyzeButton = this.summaryEl.createEl('button', {
				cls: 'nova-prose-linter-button nova-prose-linter-button--primary',
				text: 'Analyze note'
			});
			analyzeButton.setAttribute('type', 'button');
			this.registerButtonActivation(analyzeButton, () => {
				void this.refresh(true);
			});
			return;
		}

		if (!this.state.analysis) {
			this.summaryEl.createDiv({ cls: 'nova-prose-linter-summary-empty', text: 'Waiting for analysis.' });
			return;
		}

		this.summaryEl.createDiv({
			cls: 'nova-prose-linter-readout',
			text: `Grade ${Math.round(this.state.analysis.readabilityGrade)} · ${this.state.analysis.wordCount.toLocaleString()} ${this.state.analysis.wordCount === 1 ? 'word' : 'words'}`
		});
	}

	private renderCategories(): void {
		if (!this.categoriesEl) {
			return;
		}
		this.categoriesEl.empty();

		const issuePool = this.createIssuePage(Number.MAX_SAFE_INTEGER, false).issues;
		if (!this.state.file || this.state.oversized || this.state.disabledByFrontmatter || issuePool.length === 0) {
			return;
		}

		for (const group of PROSE_LINTER_CATEGORY_GROUPS) {
			const count = issuePool.filter((issue) => group.issueTypes.includes(issue.type)).length;
			if (count === 0) {
				continue;
			}

			const hidden = group.issueTypes.every((type) => this.hiddenIssueTypes.has(type));
			const cardEl = this.categoriesEl.createEl('button', {
				cls: `nova-prose-linter-category nova-prose-linter-category--${group.key} nova-prose-linter-row--${group.displayType} ${hidden ? 'nova-prose-linter-category--muted' : ''}`
			});
			cardEl.setAttribute('type', 'button');
			cardEl.setAttribute('aria-pressed', hidden ? 'false' : 'true');
			cardEl.setAttribute('aria-label', `${hidden ? 'Show' : 'Hide'} ${count === 1 ? group.singular : group.plural}`);
			cardEl.createSpan({ cls: 'nova-prose-linter-category-count', text: count.toLocaleString() });
			cardEl.createSpan({ cls: 'nova-prose-linter-category-label', text: count === 1 ? group.singular : group.plural });
			this.registerButtonActivation(cardEl, () => {
				this.toggleCategoryGroup(group);
			});
		}
	}

	private renderStatus(): void {
		if (!this.statusEl) {
			return;
		}
		this.statusEl.empty();
		if (this.state.disabledByFrontmatter) {
			this.statusEl.setText('Writing analysis is turned off for this note via frontmatter.');
			return;
		}
		if (this.state.deepState === 'pending') {
			this.statusEl.setText('Some deeper checks are deferred so typing stays responsive.');
			return;
		}
		this.statusEl.setText('');
	}

	private renderIssues(): void {
		if (!this.listEl || !this.emptyEl) {
			return;
		}

		this.listEl.empty();
		this.emptyEl.empty();
		const page = this.createIssuePage(this.visibleCount);

		if (!this.state.file) {
			this.emptyEl.setText('Open a markdown note to review prose.');
			return;
		}
		if (this.state.oversized) {
			this.emptyEl.setText('Large-note analysis is manual to keep Nova responsive.');
			return;
		}
		if (page.issues.length === 0) {
			let emptyText = 'No prose issues found.';
			if (this.state.disabledByFrontmatter) {
				emptyText = 'Analysis is disabled for this note.';
			} else if (this.hiddenIssueTypes.size > 0) {
				emptyText = 'No visible prose issues.';
			}
			this.emptyEl.setText(emptyText);
			return;
		}

		page.issues.forEach((issue) => {
			this.renderIssueRow(issue);
		});

		if (page.hasMore) {
			const loadMoreButton = this.listEl.createEl('button', {
				cls: 'nova-prose-linter-load-more',
				text: `Show ${page.nextVisibleCount - page.visibleCount} more`
			});
			loadMoreButton.setAttribute('type', 'button');
			this.registerButtonActivation(loadMoreButton, () => {
				this.visibleCount = page.nextVisibleCount;
				this.renderIssues();
			});
		}
	}

	private renderIssueRow(issue: ProseIssue): void {
		if (!this.listEl) {
			return;
		}

		const rowEl = this.listEl.createDiv({
			cls: `nova-prose-linter-row nova-prose-linter-row--${issue.severity} nova-prose-linter-row--${issue.type}`
		});
		rowEl.createDiv({ cls: 'nova-prose-linter-row-label', text: PROSE_ISSUE_LABELS[issue.type] });
		rowEl.createDiv({ cls: 'nova-prose-linter-row-excerpt', text: issue.excerpt });
		rowEl.createDiv({ cls: 'nova-prose-linter-row-explanation', text: issue.explanation });
		rowEl.createDiv({ cls: 'nova-prose-linter-row-suggestion', text: issue.suggestion });

		const actionsEl = rowEl.createDiv({ cls: 'nova-prose-linter-row-actions' });
		this.createRowButton(actionsEl, 'Jump', () => this.jumpToIssue(issue), true);
		this.createRowButton(actionsEl, 'Smart revision', () => {
			this.startSmartRevision(issue);
		});
		this.createRowButton(actionsEl, 'Ignore', () => {
			void this.ignoreIssue(issue);
		});

		if (issue.replacement && this.canApplyReplacement(issue)) {
			this.createRowButton(actionsEl, 'Apply', () => this.applyReplacement(issue));
		}
	}

	private renderIgnoredItems(): void {
		if (!this.ignoredEl) {
			return;
		}
		this.ignoredEl.empty();
		this.ignoredEl.addClass('nova-prose-linter-ignored--empty');

		if (!this.state.file || this.state.oversized || this.state.disabledByFrontmatter) {
			return;
		}

		const ignoredIssues = this.plugin.proseLinterStore.getIgnoredIssues(this.state.file.path);
		if (ignoredIssues.length === 0) {
			return;
		}
		this.ignoredEl.removeClass('nova-prose-linter-ignored--empty');

		const headerEl = this.ignoredEl.createDiv({ cls: 'nova-prose-linter-ignored-header' });
		headerEl.createSpan({
			cls: 'nova-prose-linter-ignored-title',
			text: `${ignoredIssues.length.toLocaleString()} ignored ${ignoredIssues.length === 1 ? 'item' : 'items'}`
		});
		headerEl.createSpan({
			cls: 'nova-prose-linter-ignored-subtitle',
			text: 'Restore items when you want them back in this note.'
		});

		const listEl = this.ignoredEl.createDiv({ cls: 'nova-prose-linter-ignored-list' });
		ignoredIssues.forEach((ignoredIssue) => {
			this.renderIgnoredIssueRow(listEl, ignoredIssue);
		});
	}

	private renderIgnoredIssueRow(container: HTMLElement, ignoredIssue: ProseIgnoredIssueRecord): void {
		const rowEl = container.createDiv({ cls: 'nova-prose-linter-ignored-row' });
		rowEl.createDiv({
			cls: 'nova-prose-linter-ignored-label',
			text: `${ignoredIssue.label} · line ${ignoredIssue.line + 1}`
		});
		this.createRowButton(rowEl, 'Restore', () => {
			void this.restoreIssue(ignoredIssue.key);
		});
	}

	private createRowButton(container: HTMLElement, text: string, onClick: () => void | Promise<void>, primary = false): void {
		const button = container.createEl('button', {
			cls: primary ? 'nova-prose-linter-row-button nova-prose-linter-row-button--primary' : 'nova-prose-linter-row-button',
			text
		});
		button.setAttribute('type', 'button');
		this.registerButtonActivation(button, () => {
			void onClick();
		});
	}

	private registerButtonActivation(button: HTMLElement, onActivate: () => void | Promise<void>): void {
		let handledPointerActivation = false;
		const activateFromPointer = (event: MouseEvent | PointerEvent): void => {
			if (event.button !== 0) {
				return;
			}
			handledPointerActivation = true;
			event.preventDefault();
			event.stopPropagation();
			void onActivate();
		};

		this.registerDomEvent(button, 'pointerdown', activateFromPointer);
		this.registerDomEvent(button, 'mousedown', (event: MouseEvent) => {
			if (handledPointerActivation) {
				event.preventDefault();
				event.stopPropagation();
				return;
			}
			activateFromPointer(event);
		});
		this.registerDomEvent(button, 'click', (event: MouseEvent) => {
			event.preventDefault();
			event.stopPropagation();
			if (handledPointerActivation) {
				handledPointerActivation = false;
				return;
			}
			void onActivate();
		});
	}

	private createIssuePage(visibleCount: number, includeHidden = true) {
		return createProseIssuePage({
			issues: this.state.issues,
			visibleCount,
			hiddenIssueTypes: includeHidden ? this.hiddenIssueTypes : new Set<ProseIssueType>(),
			ignoredIssueIds: this.ignoredIssueIds,
			ignoredIssueKeys: this.plugin.proseLinterStore.getIgnoredIssueKeys(this.state.file?.path ?? null),
			ignoredIssueTypes: this.plugin.proseLinterStore.getIgnoredIssueTypes(this.state.file?.path ?? null)
		});
	}

	private async ignoreIssue(issue: ProseIssue): Promise<void> {
		if (!this.state.file) {
			this.ignoredIssueIds.add(issue.id);
			this.render();
			return;
		}
		await this.plugin.proseLinterStore.ignoreIssue(this.state.file.path, issue);
		await this.refresh(true);
	}

	private async restoreIssue(ignoreKey: string): Promise<void> {
		if (!this.state.file) {
			return;
		}
		await this.plugin.proseLinterStore.restoreIssue(this.state.file.path, ignoreKey);
		await this.refresh(true);
	}

	private toggleCategoryGroup(group: ProseLinterCategoryGroup): void {
		const shouldHide = group.issueTypes.some((type) => !this.hiddenIssueTypes.has(type));
		for (const type of group.issueTypes) {
			if (shouldHide) {
				this.hiddenIssueTypes.add(type);
			} else {
				this.hiddenIssueTypes.delete(type);
			}
		}
		this.visibleCount = PROSE_LINTER_INITIAL_VISIBLE_COUNT;
		this.render();
	}

	private syncEditorHighlights(): void {
		if (!this.state.file || this.state.oversized || this.state.disabledByFrontmatter) {
			this.plugin.writingAnalysisManager?.clearProseLinterHighlights(this.state.file?.path);
			return;
		}
		const issues = this.createIssuePage(PROSE_LINTER_MAX_EDITOR_HIGHLIGHTS).issues;
		if (issues.length === 0) {
			this.plugin.writingAnalysisManager?.setProseLinterIssues(this.state.file.path, hashContent(this.state.content), []);
		} else {
			this.plugin.writingAnalysisManager?.setProseLinterIssues(this.state.file.path, hashContent(this.state.content), issues);
		}
	}

	private jumpToIssue(issue: ProseIssue): void {
		const editor = this.getActiveEditor();
		if (!editor || !this.isIssueRangeValid(editor, issue)) {
			return;
		}
		const from = { line: issue.line, ch: issue.startCh };
		const to = { line: issue.line, ch: issue.endCh };
		if (!Platform.isMobile) {
			editor.focus();
		}
		editor.setSelection(from, to);
		editor.scrollIntoView({ from, to }, true);
	}

	private applyReplacement(issue: ProseIssue): void {
		const editor = this.getActiveEditor();
		if (!editor || !issue.replacement || !this.canApplyReplacement(issue)) {
			return;
		}
		editor.replaceRange(issue.replacement.replacement, { line: issue.line, ch: issue.startCh }, { line: issue.line, ch: issue.endCh });
		void this.refresh(true);
	}

	private startSmartRevision(issue: ProseIssue): void {
		const editor = this.getActiveEditor();
		if (!editor || !this.isIssueRangeValid(editor, issue)) {
			return;
		}
		const current = editor.getLine(issue.line).slice(issue.startCh, issue.endCh);
		if (current !== issue.sourceText) {
			return;
		}
		const target = this.getSmartRevisionIssueTarget(editor, issue);
		if (!target) {
			return;
		}
		const sourceIssue: SmartRevisionSourceIssue = {
			id: issue.id,
			type: issue.type,
			label: PROSE_ISSUE_LABELS[issue.type],
			excerpt: issue.excerpt,
			sourceText: issue.sourceText,
			targetText: target.text,
			explanation: issue.explanation,
			suggestion: issue.suggestion,
			line: issue.line,
			startCh: issue.startCh,
			endCh: issue.endCh,
			targetLine: target.line,
			targetStartCh: target.startCh,
			targetEndCh: target.endCh
		};
		this.plugin.openSmartRevisionForIssue(editor, sourceIssue, async () => {
			await this.refresh(true);
		});
	}

	private getSmartRevisionIssueTarget(editor: Editor, issue: ProseIssue): { text: string; line: number; startCh: number; endCh: number } | null {
		const lineText = editor.getLine(issue.line);
		const excerpt = issue.excerpt.trim();
		const excerptStartCh = excerpt ? lineText.indexOf(excerpt) : -1;
		if (excerptStartCh >= 0 && excerpt.length > issue.sourceText.trim().length) {
			return {
				text: excerpt,
				line: issue.line,
				startCh: excerptStartCh,
				endCh: excerptStartCh + excerpt.length
			};
		}
		return {
			text: issue.sourceText,
			line: issue.line,
			startCh: issue.startCh,
			endCh: issue.endCh
		};
	}

	private canApplyReplacement(issue: ProseIssue): boolean {
		const editor = this.getActiveEditor();
		if (!editor || !issue.replacement || !this.isIssueRangeValid(editor, issue)) {
			return false;
		}
		const current = editor.getLine(issue.line).slice(issue.startCh, issue.endCh);
		return current === issue.replacement.source;
	}

	private isIssueRangeValid(editor: Editor, issue: ProseIssue): boolean {
		if (issue.line < 0 || issue.line >= editor.lineCount()) {
			return false;
		}
		const line = editor.getLine(issue.line);
		return issue.startCh >= 0 && issue.endCh <= line.length && issue.endCh > issue.startCh;
	}

	private getCurrentFile(): TFile | null {
		return this.plugin.writingAnalysisManager?.getActiveFile() ??
			this.app.workspace.getActiveViewOfType(MarkdownView)?.file ??
			null;
	}

	private async getCurrentContent(file: TFile): Promise<string> {
		return this.plugin.writingAnalysisManager?.getActiveContent() ??
			this.app.workspace.getActiveViewOfType(MarkdownView)?.editor?.getValue() ??
			await this.app.vault.cachedRead(file);
	}

	private getActiveEditor(): Editor | null {
		return this.plugin.writingAnalysisManager?.getActiveEditor() ??
			this.app.workspace.getActiveViewOfType(MarkdownView)?.editor ??
			null;
	}

	private handleWritingAnalysisUpdated(event: Event): void {
		const detail = (event as CustomEvent<WritingAnalysisUpdateDetail>).detail;
		if (detail.filePath === this.state.file?.path || (!detail.filePath && !this.state.file)) {
			void this.refresh();
		}
	}

	private activateReviewIfShown(): void {
		if (!this.isProseLinterShown()) {
			return;
		}

		this.plugin.writingAnalysisManager?.setProseLinterReviewActive(true);
		this.syncEditorHighlights();
	}

	private isProseLinterShown(): boolean {
		const topmostState = this.isRootTopmostNovaSurface('.nova-prose-linter-view');
		if (topmostState !== null) {
			return topmostState;
		}

		const view = this as unknown as { isShown?: () => boolean };
		if (typeof view.isShown !== 'function') {
			return true;
		}
		if (view.isShown()) {
			return true;
		}
		return Boolean(this.rootEl && (this.rootEl.offsetParent || this.rootEl.getClientRects().length > 0));
	}

	private isRootTopmostNovaSurface(expectedSelector: string): boolean | null {
		if (!this.rootEl) {
			return null;
		}

		if (this.rootEl.getClientRects().length === 0) {
			return this.isCompetingNovaSurfaceVisible(expectedSelector) ? false : null;
		}

		const ownerDocument = this.rootEl.ownerDocument;
		if (typeof ownerDocument.elementFromPoint !== 'function') {
			return null;
		}

		const rect = this.rootEl.getBoundingClientRect();
		if (rect.width <= 0 || rect.height <= 0) {
			return null;
		}

		const samplePoints = this.getRootSamplePoints(rect);
		for (const point of samplePoints) {
			const topElement = ownerDocument.elementFromPoint(point.x, point.y);
			const novaSurface = topElement?.closest('.nova-prose-linter-view, .nova-sidebar-container');
			if (!novaSurface) {
				continue;
			}

			return novaSurface === this.rootEl && novaSurface.matches(expectedSelector);
		}

		return null;
	}

	private isCompetingNovaSurfaceVisible(expectedSelector: string): boolean {
		const competingSelector = expectedSelector === '.nova-prose-linter-view'
			? '.nova-sidebar-container'
			: '.nova-prose-linter-view';

		return Array.from(this.rootEl?.ownerDocument.querySelectorAll(competingSelector) ?? [])
			.some(element => this.isElementVisible(element));
	}

	private isElementVisible(element: Element): boolean {
		if (element.getClientRects().length === 0) {
			return false;
		}

		const ownerWindow = element.ownerDocument.defaultView;
		if (!ownerWindow) {
			return true;
		}

		const style = ownerWindow.getComputedStyle(element);
		return style.display !== 'none' && style.visibility !== 'hidden';
	}

	private getRootSamplePoints(rect: DOMRect): Array<{ x: number; y: number }> {
		const left = rect.left + Math.min(Math.max(rect.width / 2, 24), Math.max(rect.width - 1, 0));
		const right = rect.right - Math.min(24, Math.max(rect.width - 1, 0));
		const centerX = rect.left + rect.width / 2;
		const top = rect.top + Math.min(96, Math.max(rect.height - 1, 0));
		const centerY = rect.top + rect.height / 2;

		return [
			{ x: centerX, y: top },
			{ x: left, y: centerY },
			{ x: right, y: centerY }
		];
	}
}
