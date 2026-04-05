/**
 * @file WritingDashboardView - Vault-wide writing dashboard with scoring, trends, and per-document metrics
 */

import { ItemView, Platform, WorkspaceLeaf, setIcon, setTooltip } from 'obsidian';
import type NovaPlugin from '../../main';
import {
	type DocumentAnalysisSummary,
	type VaultSnapshot,
	VaultAnalyzer
} from '../core/vault-analyzer';
import {
	type WritingScore,
	WRITING_SCORE_MIN_WORDS,
	WRITING_SCORE_THRESHOLDS,
	getWritingScoreValueClass
} from '../core/writing-score';

export const VIEW_TYPE_WRITING_DASHBOARD = 'nova-writing-dashboard';
const INCREMENTAL_RENDER_BATCH_SIZE = 25;
const INITIAL_INCREMENTAL_RENDER_COUNT = 10;
const LOADING_TABLE_ROW_LIMIT = 100;

type SortColumn = 'document' | 'words' | 'score' | 'readability' | 'passive' | 'adverbs';
type SortDirection = 'asc' | 'desc';

interface SummaryMetrics {
	documentCount: number;
	analyzedCount: number;
	totalWords: number;
	averageScore: number | null;
	averagePillars: WritingScore | null;
}

export class WritingDashboardView extends ItemView {
	private readonly plugin: NovaPlugin;
	private readonly analyzer: VaultAnalyzer;
	private readonly summaries = new Map<string, DocumentAnalysisSummary>();
	private history: VaultSnapshot[] = [];
	private abortController: AbortController | null = null;
	private scanVersion = 0;
	private renderQueued = false;
	private isDestroyed = false;
	private isLoading = false;
	private totalFiles = 0;
	private completedFiles = 0;
	private filterText = '';
	private sortColumn: SortColumn = 'score';
	private sortDirection: SortDirection = 'desc';
	private needsManualInitialScan = false;

	private rootEl: HTMLElement | null = null;
	private progressSectionEl: HTMLElement | null = null;
	private progressTextEl: HTMLElement | null = null;
	private progressFillEl: HTMLProgressElement | null = null;
	private summaryGridEl: HTMLElement | null = null;
	private trendsSectionEl: HTMLElement | null = null;
	private sortInfoEl: HTMLElement | null = null;
	private filterInputEl: HTMLInputElement | null = null;
	private tableWrapperEl: HTMLElement | null = null;
	private tableHeadEl: HTMLElement | null = null;
	private tableBodyEl: HTMLElement | null = null;
	private mobileListEl: HTMLElement | null = null;
	private emptyStateEl: HTMLElement | null = null;
	private primaryActionButtonEl: HTMLButtonElement | null = null;
	private primaryActionIconEl: HTMLElement | null = null;
	private headerButtons = new Map<SortColumn, HTMLElement>();

	constructor(leaf: WorkspaceLeaf, plugin: NovaPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.analyzer = new VaultAnalyzer({
			app: plugin.app,
			pluginId: plugin.manifest.id,
			getSettings: () => ({
				dashboard: plugin.settings.dashboard,
				writingAnalysis: plugin.settings.writingAnalysis
			})
		});
	}

	getViewType(): string {
		return VIEW_TYPE_WRITING_DASHBOARD;
	}

	getDisplayText(): string {
		return 'Nova writing dashboard';
	}

	getIcon(): string {
		return 'bar-chart-3';
	}

	async onOpen(): Promise<void> {
		this.isDestroyed = false;
		this.history = await this.analyzer.loadHistory();
		this.buildLayout();
		this.totalFiles = this.app.vault.getMarkdownFiles().length;
		const hasStoredCache = await this.analyzer.hasStoredCache();
		const cachedSummaries = await this.analyzer.loadCachedSummaries();
		this.summaries.clear();
		cachedSummaries.forEach((summary) => this.summaries.set(summary.filePath, summary));
		this.needsManualInitialScan = Platform.isMobile && !hasStoredCache;
		this.scheduleRender();
		if (!this.needsManualInitialScan) {
			void this.runScan(false);
		}
	}

	async onClose(): Promise<void> {
		this.isDestroyed = true;
		this.abortController?.abort();
		this.abortController = null;
		this.rootEl?.empty();
		await Promise.resolve();
	}

	private buildLayout(): void {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.addClass('nova-writing-dashboard-view');
		this.rootEl = container;
		this.registerDomEvent(window, 'resize', () => {
			this.scheduleRender();
		});

		const headerEl = container.createDiv({ cls: 'nova-writing-dashboard-header' });
		const titleGroupEl = headerEl.createDiv({ cls: 'nova-writing-dashboard-title-group' });
		titleGroupEl.createEl('h2', { cls: 'nova-writing-dashboard-title', text: 'Writing dashboard' });
		titleGroupEl.createEl('p', {
			cls: 'nova-writing-dashboard-subtitle',
			text: 'Track how your writing is trending across the vault.'
		});

		const rescanButton = headerEl.createEl('button', {
			cls: 'nova-writing-dashboard-rescan',
			text: 'Rescan'
		});
		rescanButton.setAttribute('type', 'button');
		this.primaryActionButtonEl = rescanButton;
		this.primaryActionIconEl = rescanButton.createSpan({ cls: 'nova-writing-dashboard-rescan-icon' });
		this.updatePrimaryActionButton();
		this.registerDomEvent(rescanButton, 'click', () => {
			void this.runScan(this.summaries.size > 0 || !this.needsManualInitialScan);
		});

		this.progressSectionEl = container.createDiv({ cls: 'nova-writing-dashboard-progress' });
		this.progressTextEl = this.progressSectionEl.createDiv({ cls: 'nova-writing-dashboard-progress-text' });
		this.progressFillEl = this.progressSectionEl.createEl('progress', { cls: 'nova-writing-dashboard-progress-bar' });
		this.progressFillEl.max = 100;
		this.progressFillEl.value = 0;

		this.summaryGridEl = container.createDiv({ cls: 'nova-writing-dashboard-summary-grid' });
		this.trendsSectionEl = container.createDiv({ cls: 'nova-writing-dashboard-trends' });

		const controlsEl = container.createDiv({ cls: 'nova-writing-dashboard-controls' });
		this.filterInputEl = controlsEl.createEl('input', {
			cls: 'nova-writing-dashboard-filter',
			attr: {
				type: 'text',
				placeholder: 'Filter documents...',
				'aria-label': 'Filter documents'
			}
		});
		this.sortInfoEl = controlsEl.createDiv({ cls: 'nova-writing-dashboard-sort-info' });
		this.registerDomEvent(this.filterInputEl, 'input', (event: Event) => {
			const target = event.target as HTMLInputElement;
			this.filterText = target.value;
			this.scheduleRender();
		});

		this.tableWrapperEl = container.createDiv({ cls: 'nova-writing-dashboard-table-wrapper' });
		const tableEl = this.tableWrapperEl.createEl('table', { cls: 'nova-writing-dashboard-table' });
		this.tableHeadEl = tableEl.createEl('thead');
		this.tableBodyEl = tableEl.createEl('tbody');
		this.mobileListEl = container.createDiv({ cls: 'nova-writing-dashboard-mobile-list nova-hidden' });
		this.emptyStateEl = container.createDiv({ cls: 'nova-writing-dashboard-empty' });

		this.buildTableHeaders();
	}

	private buildTableHeaders(): void {
		if (!this.tableHeadEl) {
			return;
		}

		this.tableHeadEl.empty();
		this.headerButtons.clear();

		const headerRow = this.tableHeadEl.createEl('tr');
		const columns: Array<{ key: SortColumn; label: string }> = [
			{ key: 'document', label: 'Document' },
			{ key: 'words', label: 'Words' },
			{ key: 'score', label: 'Score' },
			{ key: 'readability', label: 'Readability' },
			{ key: 'passive', label: 'Passive' },
			{ key: 'adverbs', label: 'Adverbs' }
		];

		columns.forEach((column) => {
			const headerCell = headerRow.createEl('th');
			const headerContent = headerCell.createDiv({ cls: 'nova-writing-dashboard-header-content' });
			const button = headerContent.createSpan({
				cls: 'nova-writing-dashboard-sort-button',
				text: column.label
			});
			button.setAttribute('role', 'button');
			button.setAttribute('tabindex', '0');
			button.setAttribute('aria-label', `Sort by ${column.label.toLowerCase()}`);
			setTooltip(button, `Sort by ${column.label.toLowerCase()}`);
			this.registerPseudoButton(button, () => {
				if (this.sortColumn === column.key) {
					this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
				} else {
					this.sortColumn = column.key;
					this.sortDirection = column.key === 'document' ? 'asc' : 'desc';
				}
				this.scheduleRender();
			});
			this.createHelpIcon(headerContent, this.getColumnTooltip(column.key), `About ${column.label.toLowerCase()}`);
			this.headerButtons.set(column.key, button);
		});
	}

	private registerPseudoButton(element: HTMLElement, onActivate: () => void): void {
		this.registerDomEvent(element, 'click', onActivate);
		this.registerDomEvent(element, 'keydown', (event: KeyboardEvent) => {
			if (event.key === 'Enter' || event.key === ' ') {
				event.preventDefault();
				onActivate();
			}
		});
	}

	private async runScan(forceRescan: boolean): Promise<void> {
		this.scanVersion++;
		const scanVersion = this.scanVersion;
		this.abortController?.abort();
		this.abortController = new AbortController();
		this.isLoading = true;
		this.needsManualInitialScan = false;
		this.completedFiles = 0;
		this.totalFiles = this.app.vault.getMarkdownFiles().length;
		this.updatePrimaryActionButton();

		if (forceRescan) {
			this.summaries.clear();
			await this.analyzer.clearCache();
		}

		this.scheduleRender();

		const results = await this.analyzer.analyzeVault((completed, total, latest) => {
			if (this.isDestroyed || scanVersion !== this.scanVersion || this.abortController?.signal.aborted) {
				return;
			}

			this.completedFiles = completed;
			this.totalFiles = total;
			if (latest) {
				this.summaries.set(latest.filePath, latest);
			}
			this.renderProgress();
			if (this.shouldRenderIncrementally(completed, total)) {
				this.scheduleRender();
			}
		}, this.abortController.signal);

		if (this.isDestroyed || scanVersion !== this.scanVersion || this.abortController.signal.aborted) {
			return;
		}

		this.summaries.clear();
		results.forEach((summary) => this.summaries.set(summary.filePath, summary));
		this.completedFiles = this.totalFiles;
		this.isLoading = false;
		this.history = await this.analyzer.recordSnapshot(results);
		this.updatePrimaryActionButton();
		this.scheduleRender();
	}

	private scheduleRender(): void {
		if (this.renderQueued || this.isDestroyed) {
			return;
		}

		this.renderQueued = true;
		requestAnimationFrame(() => {
			this.renderQueued = false;
			this.render();
		});
	}

	private render(): void {
		this.updatePrimaryActionButton();
		this.renderProgress();
		this.renderSummaryCards();
		this.renderTrends();
		this.renderSortState();
		this.renderTable();
	}

	private shouldRenderIncrementally(completed: number, total: number): boolean {
		if (completed >= total) {
			return true;
		}

		if (completed <= INITIAL_INCREMENTAL_RENDER_COUNT) {
			return true;
		}

		return completed % INCREMENTAL_RENDER_BATCH_SIZE === 0;
	}

	private renderProgress(): void {
		if (!this.progressSectionEl || !this.progressTextEl || !this.progressFillEl) {
			return;
		}

		if (!this.isLoading) {
			this.progressSectionEl.addClass('nova-hidden');
			return;
		}

		this.progressSectionEl.removeClass('nova-hidden');
		this.progressTextEl.textContent = `Analyzing... ${this.completedFiles.toLocaleString()} of ${this.totalFiles.toLocaleString()} files`;
		const percentage = this.totalFiles === 0 ? 0 : Math.min(100, (this.completedFiles / this.totalFiles) * 100);
		this.progressFillEl.value = percentage;
	}

	private renderSummaryCards(): void {
		if (!this.summaryGridEl) {
			return;
		}

		this.summaryGridEl.empty();
		const metrics = this.getSummaryMetrics();
		const scoreDelta = this.getScoreDelta(metrics.averageScore);

		this.createSummaryCard(
			'Writing score',
			metrics.averageScore === null ? '—' : Math.round(metrics.averageScore).toString(),
			scoreDelta,
			metrics.averageScore === null ? undefined : getWritingScoreValueClass(Math.round(metrics.averageScore)),
			'Average composite writing score across scored notes. The score blends clarity, conciseness, variety, and discipline for notes with at least 50 words.'
		);
		this.createSummaryCard(
			'Documents',
			metrics.documentCount.toLocaleString(),
			undefined,
			undefined,
			'Notes currently included in the dashboard after folder exclusions and note-level opt-outs.'
		);
		this.createSummaryCard(
			'Scored',
			metrics.analyzedCount.toLocaleString(),
			undefined,
			undefined,
			'Included notes with at least 50 words, which are eligible for a composite writing score.'
		);
		this.createSummaryCard(
			'Words',
			metrics.totalWords.toLocaleString(),
			undefined,
			undefined,
			'Total words across notes currently included in the dashboard.'
		);
	}

	private createSummaryCard(label: string, value: string, detail?: string, valueClass?: string, tooltip?: string): void {
		if (!this.summaryGridEl) {
			return;
		}

		const cardEl = this.summaryGridEl.createDiv({ cls: 'nova-writing-dashboard-card' });
		if (tooltip) {
			const helpIcon = this.createHelpIcon(cardEl, tooltip, `About ${label.toLowerCase()}`);
			helpIcon.addClass('nova-writing-dashboard-card-help');
		}
		const valueEl = cardEl.createDiv({ cls: 'nova-writing-dashboard-card-value', text: value });
		if (valueClass) {
			valueEl.addClass(valueClass);
		}
		cardEl.createDiv({ cls: 'nova-writing-dashboard-card-label', text: label });
		if (detail) {
			cardEl.createDiv({ cls: 'nova-writing-dashboard-card-detail', text: detail });
		}
	}

	private renderTrends(): void {
		if (!this.trendsSectionEl) {
			return;
		}

		this.trendsSectionEl.empty();
		const metrics = this.getSummaryMetrics();

		const sparklineGridEl = this.trendsSectionEl.createDiv({ cls: 'nova-writing-dashboard-sparklines' });
		this.renderSparklineCard(
			sparklineGridEl,
			'Score trend (30d)',
			this.history.slice(-30).map((entry) => entry.averageCompositeScore),
			false
		);
		this.renderSparklineCard(
			sparklineGridEl,
			'Passive voice (30d)',
			this.history.slice(-30).map((entry) => entry.averagePassiveVoice),
			true
		);

		const pillarsCardEl = this.trendsSectionEl.createDiv({ cls: 'nova-writing-dashboard-pillars-card' });
		pillarsCardEl.createDiv({ cls: 'nova-writing-dashboard-section-title', text: 'Pillar breakdown' });
		const pillarsHelpIcon = this.createHelpIcon(
			pillarsCardEl,
			'How your average writing score is split across clarity, conciseness, variety, and discipline.',
			'About pillar breakdown'
		);
		pillarsHelpIcon.addClass('nova-writing-dashboard-card-help');

		if (!metrics.averagePillars) {
			pillarsCardEl.createDiv({
				cls: 'nova-writing-dashboard-empty-inline',
				text: 'Open the dashboard regularly to build your trend data.'
			});
			return;
		}

		const targetGrade = this.plugin.settings.dashboard.targetReadabilityGrade;
		this.createPillarBar(
			pillarsCardEl,
			'Clarity',
			metrics.averagePillars.clarity,
			`Average readability is scored against target Grade ${targetGrade}. Each grade away reduces Clarity by ${WRITING_SCORE_THRESHOLDS.clarityPointsPerGrade} points`
		);
		this.createPillarBar(
			pillarsCardEl,
			'Conciseness',
			metrics.averagePillars.conciseness,
			`Passive voice scores ${WRITING_SCORE_THRESHOLDS.passiveMaxScore} at 0%, reaching 0 at ${WRITING_SCORE_THRESHOLDS.passiveZeroAtPercentage}%+. Very long sentences score ${WRITING_SCORE_THRESHOLDS.veryLongMaxScore} at 0%, reaching 0 at ${WRITING_SCORE_THRESHOLDS.veryLongZeroAtPercentage}%+`
		);
		this.createPillarBar(
			pillarsCardEl,
			'Variety',
			metrics.averagePillars.variety,
			`Sentence length standard deviation scores full marks in the ${WRITING_SCORE_THRESHOLDS.varietySweetSpotMin}–${WRITING_SCORE_THRESHOLDS.varietySweetSpotMax} sweet spot`
		);
		this.createPillarBar(
			pillarsCardEl,
			'Discipline',
			metrics.averagePillars.discipline,
			`Adverb score is ${WRITING_SCORE_THRESHOLDS.adverbMaxScore} at 0%, reaching 0 at ${WRITING_SCORE_THRESHOLDS.adverbZeroAtPercentage}%+. Weak intensifier score is ${WRITING_SCORE_THRESHOLDS.intensifierMaxScore} at 0, reaching 0 at ${WRITING_SCORE_THRESHOLDS.intensifierZeroAtPer1000}+ per 1000 words`
		);
	}

	private renderSparklineCard(containerEl: HTMLElement, title: string, values: number[], invert: boolean): void {
		const cardEl = containerEl.createDiv({ cls: 'nova-writing-dashboard-sparkline-card' });
		cardEl.createDiv({ cls: 'nova-writing-dashboard-section-title', text: title });
		const helpText = invert
			? 'Trend line for average passive voice. Lower values usually mean tighter prose.'
			: 'Trend line for average composite writing score across scored notes.';
		const helpIcon = this.createHelpIcon(cardEl, helpText, `About ${title.toLowerCase()}`);
		helpIcon.addClass('nova-writing-dashboard-card-help');

		if (values.length < 2) {
			cardEl.createDiv({
				cls: 'nova-writing-dashboard-empty-inline',
				text: 'Open the dashboard regularly to build your trend data.'
			});
			return;
		}

		cardEl.appendChild(this.createSparklineSvg(values, invert));
	}

	private createSparklineSvg(values: number[], invert: boolean): SVGElement {
		const width = 220;
		const height = 72;
		const padding = 10;
		const min = Math.min(...values);
		const max = Math.max(...values);
		const range = max - min || 1;
		const points = values.map((value, index) => {
			const x = padding + (index * (width - padding * 2)) / Math.max(1, values.length - 1);
			const normalized = (value - min) / range;
			const y = invert
				? padding + normalized * (height - padding * 2)
				: height - padding - normalized * (height - padding * 2);
			return `${x},${y}`;
		});

		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
		svg.setAttribute('class', 'nova-writing-dashboard-sparkline');

		const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
		polyline.setAttribute('points', points.join(' '));
		polyline.setAttribute('class', 'nova-writing-dashboard-sparkline-line');
		svg.appendChild(polyline);

		this.appendSparklineDot(svg, points[0]);
		this.appendSparklineDot(svg, points[points.length - 1]);

		this.appendSparklineLabel(svg, padding, height - 4, values[0]);
		this.appendSparklineLabel(svg, width - padding, height - 4, values[values.length - 1], 'end');

		return svg;
	}

	private appendSparklineDot(svg: SVGElement, point: string): void {
		const [cx, cy] = point.split(',');
		const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
		dot.setAttribute('cx', cx);
		dot.setAttribute('cy', cy);
		dot.setAttribute('r', '2.5');
		dot.setAttribute('class', 'nova-writing-dashboard-sparkline-dot');
		svg.appendChild(dot);
	}

	private appendSparklineLabel(svg: SVGElement, x: number, y: number, value: number, anchor: 'start' | 'end' = 'start'): void {
		const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
		label.setAttribute('x', `${x}`);
		label.setAttribute('y', `${y}`);
		label.setAttribute('text-anchor', anchor);
		label.setAttribute('class', 'nova-writing-dashboard-sparkline-label');
		label.textContent = value.toFixed(1);
		svg.appendChild(label);
	}

	private createPillarBar(containerEl: HTMLElement, label: string, value: number, tooltip: string): void {
		const rowEl = containerEl.createDiv({ cls: 'nova-writing-dashboard-pillar-row' });
		setTooltip(rowEl, tooltip);
		rowEl.createDiv({ cls: 'nova-writing-dashboard-pillar-label', text: label });
		const progressEl = rowEl.createEl('progress', { cls: 'nova-writing-dashboard-pillar-progress' });
		progressEl.max = 25;
		progressEl.value = value;
		progressEl.addClass(getWritingScoreValueClass(Math.round(value * 4)));
		rowEl.createDiv({ cls: 'nova-writing-dashboard-pillar-value', text: `${value.toFixed(1)}/25` });
	}

	private renderSortState(): void {
		if (this.sortInfoEl) {
			const directionLabel = this.sortDirection === 'asc' ? 'ascending' : 'descending';
			this.sortInfoEl.textContent = `Sort: ${this.getColumnLabel(this.sortColumn)} (${directionLabel})`;
		}

		this.headerButtons.forEach((button, column) => {
			const arrow = this.sortColumn === column ? (this.sortDirection === 'asc' ? ' ▲' : ' ▼') : '';
			button.textContent = `${this.getColumnLabel(column)}${arrow}`;
		});
	}

	private renderTable(): void {
		if (!this.tableBodyEl || !this.tableWrapperEl || !this.mobileListEl || !this.emptyStateEl) {
			return;
		}

		this.tableBodyEl.empty();
		this.mobileListEl.empty();
		const visibleRows = this.getVisibleSummaries();
		const rows = this.isLoading ? visibleRows.slice(0, LOADING_TABLE_ROW_LIMIT) : visibleRows;

		if (visibleRows.length === 0) {
			const message = this.isLoading
				? 'Scanning vault...'
				: this.needsManualInitialScan
					? 'First-time mobile scans are manual to keep Nova responsive. Tap Start scan when you are ready. Large iCloud-backed vaults may take a while.'
					: 'No eligible notes found. Excluded folders and opted-out notes are skipped.';
			this.emptyStateEl.removeClass('nova-hidden');
			this.emptyStateEl.textContent = message;
			this.tableWrapperEl.addClass('nova-hidden');
			this.mobileListEl.addClass('nova-hidden');
			return;
		}

		this.emptyStateEl.addClass('nova-hidden');

		if (this.shouldUseCompactList()) {
			this.tableWrapperEl.addClass('nova-hidden');
			this.mobileListEl.removeClass('nova-hidden');
			this.renderMobileRows(rows, visibleRows.length > rows.length);
			return;
		}

		this.tableWrapperEl.removeClass('nova-hidden');
		this.mobileListEl.addClass('nova-hidden');

		rows.forEach((summary) => {
			const rowEl = this.tableBodyEl!.createEl('tr');
			const documentCell = rowEl.createEl('td');
			const fileName = this.getSummaryFileName(summary);
			const documentButton = documentCell.createSpan({
				cls: 'nova-writing-dashboard-doc-button',
				text: fileName
			});
			documentButton.setAttribute('role', 'button');
			documentButton.setAttribute('tabindex', '0');
			documentButton.setAttribute('aria-label', `Open ${fileName}`);
			this.registerPseudoButton(documentButton, () => {
				void this.app.workspace.openLinkText(summary.filePath, '');
			});

			this.createMetricCell(rowEl, summary.wordCount.toLocaleString());
			this.createMetricCell(
				rowEl,
				summary.score ? this.formatCompositeScore(summary.score.composite) : '—',
				summary.score ? this.getScoreTooltip(summary) : `Too short to score. Documents need at least ${WRITING_SCORE_MIN_WORDS} words`,
				summary.score ? getWritingScoreValueClass(summary.score.composite) : 'nova-writing-dashboard-value--muted'
			);
			this.createMetricCell(
				rowEl,
				summary.score ? summary.readabilityGrade.toFixed(1) : '—',
				this.getReadabilityTooltip(summary)
			);
			this.createMetricCell(
				rowEl,
				summary.score ? `${summary.passiveVoicePercentage.toFixed(1)}%` : '—',
				this.getPassiveTooltip(summary)
			);
			this.createMetricCell(
				rowEl,
				summary.score ? `${summary.adverbDensity.toFixed(1)}%` : '—',
				this.getAdverbTooltip(summary)
			);
		});

		if (this.isLoading && visibleRows.length > rows.length) {
			const limitedRowEl = this.tableBodyEl.createEl('tr');
			const limitedCell = limitedRowEl.createEl('td', {
				attr: {
					colspan: '6'
				},
				text: `Showing the first ${rows.length.toLocaleString()} matching notes while the scan continues.`
			});
			limitedCell.addClass('nova-writing-dashboard-empty-inline');
		}
	}

	private renderMobileRows(rows: DocumentAnalysisSummary[], isLimited: boolean): void {
		if (!this.mobileListEl) {
			return;
		}

		rows.forEach((summary) => {
			const cardEl = this.mobileListEl!.createDiv({ cls: 'nova-writing-dashboard-mobile-card' });
			const headerEl = cardEl.createDiv({ cls: 'nova-writing-dashboard-mobile-header' });
			const fileName = this.getSummaryFileName(summary);
			const titleEl = headerEl.createSpan({
				cls: 'nova-writing-dashboard-doc-button nova-writing-dashboard-mobile-title',
				text: fileName
			});
			titleEl.setAttribute('role', 'button');
			titleEl.setAttribute('tabindex', '0');
			titleEl.setAttribute('aria-label', `Open ${fileName}`);
			this.registerPseudoButton(titleEl, () => {
				void this.app.workspace.openLinkText(summary.filePath, '');
			});

			const metricsEl = cardEl.createDiv({ cls: 'nova-writing-dashboard-mobile-metrics' });
			this.createMobileMetric(metricsEl, 'Words', summary.wordCount.toLocaleString());
			this.createMobileMetric(
				metricsEl,
				'Score',
				summary.score ? this.formatCompositeScore(summary.score.composite) : '—',
				summary.score ? getWritingScoreValueClass(summary.score.composite) : 'nova-writing-dashboard-value--muted'
			);
			this.createMobileMetric(metricsEl, 'Readability', summary.score ? summary.readabilityGrade.toFixed(1) : '—');
			this.createMobileMetric(metricsEl, 'Passive', summary.score ? `${summary.passiveVoicePercentage.toFixed(1)}%` : '—');
			this.createMobileMetric(metricsEl, 'Adverbs', summary.score ? `${summary.adverbDensity.toFixed(1)}%` : '—');
		});

		if (isLimited) {
			this.mobileListEl.createDiv({
				cls: 'nova-writing-dashboard-empty-inline',
				text: `Showing the first ${rows.length.toLocaleString()} matching notes while the scan continues.`
			});
		}
	}

	private createMobileMetric(containerEl: HTMLElement, label: string, value: string, valueClass?: string): void {
		const metricEl = containerEl.createDiv({ cls: 'nova-writing-dashboard-mobile-metric' });
		metricEl.createDiv({ cls: 'nova-writing-dashboard-mobile-metric-label', text: label });
		const valueEl = metricEl.createDiv({ cls: 'nova-writing-dashboard-mobile-metric-value', text: value });
		if (valueClass) {
			valueEl.addClass(valueClass);
		}
	}

	private shouldUseCompactList(): boolean {
		if (Platform.isMobile) {
			return true;
		}

		if (typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 700px)').matches) {
			return true;
		}

		return (this.rootEl?.clientWidth ?? Number.POSITIVE_INFINITY) < 700;
	}

	private createMetricCell(rowEl: HTMLElement, text: string, tooltip?: string, valueClass?: string): void {
		const cell = rowEl.createEl('td', { text });
		if (tooltip) {
			setTooltip(cell, tooltip);
		}
		if (valueClass) {
			cell.addClass(valueClass);
		}
	}

	private getVisibleSummaries(): DocumentAnalysisSummary[] {
		const normalizedFilter = this.filterText.trim().toLowerCase();
		const filtered = Array.from(this.summaries.values()).filter((summary) => {
			if (!normalizedFilter) {
				return true;
			}

			return this.getSummaryFileName(summary).toLowerCase().includes(normalizedFilter);
		});

		filtered.sort((left, right) => this.compareSummaries(left, right));
		return filtered;
	}

	private compareSummaries(left: DocumentAnalysisSummary, right: DocumentAnalysisSummary): number {
		const leftTooShort = left.score === null;
		const rightTooShort = right.score === null;

		if (leftTooShort || rightTooShort) {
			if (leftTooShort && rightTooShort) {
				return this.getSummaryFileName(left).localeCompare(this.getSummaryFileName(right));
			}

			return leftTooShort ? 1 : -1;
		}

		let value = 0;
		switch (this.sortColumn) {
			case 'document':
				value = this.getSummaryFileName(left).localeCompare(this.getSummaryFileName(right));
				break;
			case 'words':
				value = left.wordCount - right.wordCount;
				break;
			case 'score':
				value = (left.score?.composite ?? 0) - (right.score?.composite ?? 0);
				break;
			case 'readability':
				value = left.readabilityGrade - right.readabilityGrade;
				break;
			case 'passive':
				value = left.passiveVoicePercentage - right.passiveVoicePercentage;
				break;
			case 'adverbs':
				value = left.adverbDensity - right.adverbDensity;
				break;
		}

		if (value === 0) {
			value = this.getSummaryFileName(left).localeCompare(this.getSummaryFileName(right));
		}

		return this.sortDirection === 'asc' ? value : -value;
	}

	private getSummaryMetrics(): SummaryMetrics {
		const allSummaries = Array.from(this.summaries.values());
		const scored = allSummaries.filter((summary) => summary.score !== null);
		const totalWords = allSummaries.reduce((sum, summary) => sum + summary.wordCount, 0);

		if (scored.length === 0) {
			return {
				documentCount: allSummaries.length,
				analyzedCount: 0,
				totalWords,
				averageScore: null,
				averagePillars: null
			};
		}

		const scoreTotals = scored.reduce<WritingScore>((totals, summary) => ({
			composite: totals.composite + (summary.score?.composite ?? 0),
			clarity: totals.clarity + (summary.score?.clarity ?? 0),
			conciseness: totals.conciseness + (summary.score?.conciseness ?? 0),
			variety: totals.variety + (summary.score?.variety ?? 0),
			discipline: totals.discipline + (summary.score?.discipline ?? 0)
		}), {
			composite: 0,
			clarity: 0,
			conciseness: 0,
			variety: 0,
			discipline: 0
		});

		return {
			documentCount: allSummaries.length,
			analyzedCount: scored.length,
			totalWords,
			averageScore: scoreTotals.composite / scored.length,
			averagePillars: {
				composite: scoreTotals.composite / scored.length,
				clarity: scoreTotals.clarity / scored.length,
				conciseness: scoreTotals.conciseness / scored.length,
				variety: scoreTotals.variety / scored.length,
				discipline: scoreTotals.discipline / scored.length
			}
		};
	}

	private getScoreDelta(currentAverage: number | null): string | undefined {
		if (currentAverage === null) {
			return undefined;
		}

		if (this.history.length >= 2 && !this.isLoading) {
			const previous = this.history[this.history.length - 2];
			const latest = this.history[this.history.length - 1];
			const delta = latest.averageCompositeScore - previous.averageCompositeScore;
			return this.formatDelta(delta);
		}

		if (this.history.length >= 1) {
			const previous = this.history[this.history.length - 1].averageCompositeScore;
			return this.formatDelta(currentAverage - previous);
		}

		return undefined;
	}

	private formatDelta(delta: number): string {
		const rounded = Math.round(delta * 10) / 10;
		if (rounded === 0) {
			return 'No change';
		}

		return `${rounded > 0 ? '↑' : '↓'} ${Math.abs(rounded)}`;
	}

	private getScoreTooltip(summary: DocumentAnalysisSummary): string {
		if (!summary.score) {
			return `Too short to score. Documents need at least ${WRITING_SCORE_MIN_WORDS} words`;
		}

		return `Writing score ${this.formatCompositeScore(summary.score.composite)}/100 — Clarity ${this.formatPillarScore(summary.score.clarity)}, Conciseness ${this.formatPillarScore(summary.score.conciseness)}, Variety ${this.formatPillarScore(summary.score.variety)}, Discipline ${this.formatPillarScore(summary.score.discipline)}`;
	}

	private getReadabilityTooltip(summary: DocumentAnalysisSummary): string {
		return `Grade ${summary.readabilityGrade.toFixed(1)} — your target is Grade ${this.plugin.settings.dashboard.targetReadabilityGrade}. Each grade away from target reduces Clarity by ${WRITING_SCORE_THRESHOLDS.clarityPointsPerGrade} points`;
	}

	private getPassiveTooltip(summary: DocumentAnalysisSummary): string {
		return `${summary.passiveVoicePercentage.toFixed(1)}% of sentences use passive voice. Passive voice scores ${WRITING_SCORE_THRESHOLDS.passiveMaxScore} at 0%, reaching 0 at ${WRITING_SCORE_THRESHOLDS.passiveZeroAtPercentage}%+`;
	}

	private getAdverbTooltip(summary: DocumentAnalysisSummary): string {
		return `${summary.adverbDensity.toFixed(1)}% adverb density. Adverb score is ${WRITING_SCORE_THRESHOLDS.adverbMaxScore} at 0%, reaching 0 at ${WRITING_SCORE_THRESHOLDS.adverbZeroAtPercentage}%+`;
	}

	private getColumnLabel(column: SortColumn): string {
		switch (column) {
			case 'document':
				return 'Document';
			case 'words':
				return 'Words';
			case 'score':
				return 'Score';
			case 'readability':
				return 'Readability';
			case 'passive':
				return 'Passive';
			case 'adverbs':
				return 'Adverbs';
		}
	}

	private getColumnTooltip(column: SortColumn): string {
		switch (column) {
			case 'document':
				return 'The note name. Click to open the note.';
			case 'words':
				return 'Word count for the note.';
			case 'score':
				return 'Composite writing score from 0 to 100, combining clarity, conciseness, variety, and discipline. Only notes with at least 50 words receive a score.';
			case 'readability':
				return `Estimated readability grade level for the note. Nova compares this to your target grade of ${this.plugin.settings.dashboard.targetReadabilityGrade}.`;
			case 'passive':
				return 'Percentage of sentences detected as passive voice. Lower is usually better.';
			case 'adverbs':
				return 'Adverb density as a percentage of total words. Lower usually means tighter prose.';
		}
	}

	private formatCompositeScore(score: number): string {
		return score.toLocaleString(undefined, {
			minimumFractionDigits: 0,
			maximumFractionDigits: 2
		});
	}

	private formatPillarScore(score: number): string {
		return score.toLocaleString(undefined, {
			minimumFractionDigits: 0,
			maximumFractionDigits: 1
		});
	}

	private getSummaryFileName(summary: DocumentAnalysisSummary): string {
		if (summary.fileName?.trim()) {
			return summary.fileName;
		}

		const fileNameFromPath = summary.filePath.split('/').pop();
		if (!fileNameFromPath) {
			return summary.filePath;
		}

		return fileNameFromPath.replace(/\.md$/i, '');
	}

	private updatePrimaryActionButton(): void {
		if (!this.primaryActionButtonEl || !this.primaryActionIconEl) {
			return;
		}

		const isInitialMobileScan = this.needsManualInitialScan && !this.isLoading && this.summaries.size === 0;
		const label = isInitialMobileScan ? 'Start scan' : 'Rescan';
		this.primaryActionButtonEl.textContent = label;
		this.primaryActionButtonEl.appendChild(this.primaryActionIconEl);
		this.primaryActionButtonEl.setAttribute('aria-label', `${label} writing dashboard`);
		setIcon(this.primaryActionIconEl, isInitialMobileScan ? 'play' : 'refresh-cw');
	}

	private createHelpIcon(containerEl: HTMLElement, tooltip: string, label: string): HTMLElement {
		const helpIcon = containerEl.createSpan({ cls: 'nova-writing-dashboard-help-icon' });
		helpIcon.setAttribute('aria-label', label);
		helpIcon.setAttribute('role', 'img');
		setIcon(helpIcon, 'help-circle');
		setTooltip(helpIcon, tooltip);
		return helpIcon;
	}
}
