/**
 * @file WritingAnalysisManager - Coordinates deterministic writing analysis for the active Markdown editor
 */

import { Component, Editor, MarkdownView, TFile, WorkspaceLeaf } from 'obsidian';
import { EditorView } from '@codemirror/view';
import { analyzeWriting, hashContent, hasWritingAnalysisOptOut, MAX_WRITING_ANALYSIS_CHAR_LENGTH, type WritingAnalysis } from '../core/writing-analysis';
import { createAnalysisRunToken, isStaleAnalysisRun, type AnalysisRunToken } from '../core/writing-analysis-runner';
import { CodeMirrorWritingHighlightManager, type WritingHighlight } from '../features/commands/ui/codemirror-decorations';
import { PROSE_ISSUE_LABELS, type ProseIssue, type ProseIssueRange } from '../features/prose-linter/prose-linter-types';
import {
    NOVA_WRITING_ANALYSIS_UPDATED_EVENT,
    VIEW_TYPE_NOVA_SIDEBAR,
    VIEW_TYPE_PROSE_LINTER
} from '../constants';
import { VIEW_TYPE_WRITING_DASHBOARD } from './writing-dashboard-view';
import { Logger } from '../utils/logger';
import { TimeoutManager } from '../utils/timeout-manager';
import type NovaPlugin from '../../main';

export const WRITING_ANALYSIS_UPDATED_EVENT = NOVA_WRITING_ANALYSIS_UPDATED_EVENT;

export interface WritingAnalysisUpdateDetail {
    analysis: WritingAnalysis | null;
    filePath: string | null;
    eligible: boolean;
    disabledByFrontmatter: boolean;
    oversized: boolean;
    stale: boolean;
    runToken: AnalysisRunToken;
}

interface EditorFocusSnapshot {
    filePath: string;
    editorDom: HTMLElement;
    restoreFocus: () => void;
}

export class WritingAnalysisManager {
    private plugin: NovaPlugin;
    private logger = Logger.scope('WritingAnalysisManager');
    private timeoutManager = new TimeoutManager();
    private activeView: MarkdownView | null = null;
    private highlightManager: CodeMirrorWritingHighlightManager | null = null;
    private latestAnalysis: WritingAnalysis | null = null;
    private disabledByFrontmatter = false;
    private oversizedActiveNote = false;
    private analysisStale = false;
    private currentLeafViewType: string | null = null;
    private analysisSequence = 0;
    private activeRunToken: AnalysisRunToken = createAnalysisRunToken(null, '', 0);
    private proseLinterHighlights: WritingHighlight[] | null = null;
    private proseLinterHighlightFilePath: string | null = null;
    private proseLinterHighlightContentHash: string | null = null;
    private proseLinterReviewActive = false;
    private pendingReviewModeReconcileTimeout: number | null = null;
    private interactionDocumentLifecycles = new Map<Document, Component>();
    private activeSurfaceDocument: Document | null = null;

    constructor(plugin: NovaPlugin) {
        this.plugin = plugin;
    }

    init(): void {
        this.plugin.registerEvent(
            this.plugin.app.workspace.on('active-leaf-change', (leaf) => {
                this.handleActiveLeafChange(leaf ?? null);
            })
        );

        this.plugin.registerEvent(
            this.plugin.app.workspace.on('file-open', () => {
                void this.refreshForActiveView(true);
            })
        );

        this.plugin.registerEvent(
            this.plugin.app.workspace.on('editor-change', (editor) => {
                this.handleEditorChange(editor);
            })
        );

        this.plugin.registerEvent(
            this.plugin.app.workspace.on('layout-change', () => {
                this.registerKnownWorkspaceDocuments();
                this.scheduleProseLinterReviewReconcile();
            })
        );

        this.plugin.registerEvent(
            this.plugin.app.workspace.on('resize', () => {
                this.scheduleProseLinterReviewReconcile();
            })
        );

        this.plugin.registerEvent(
            this.plugin.app.workspace.on('window-open', (_workspaceWindow, ownerWindow) => {
                this.registerInteractionDocument(ownerWindow.document);
            })
        );

        this.plugin.registerEvent(
            this.plugin.app.workspace.on('window-close', (_workspaceWindow, ownerWindow) => {
                this.unregisterInteractionDocument(ownerWindow.document);
                this.scheduleProseLinterReviewReconcile();
            })
        );

        this.registerKnownWorkspaceDocuments();
        this.reconcileProseLinterReviewMode();
        void this.refreshForActiveView(false);
    }

    async refreshForActiveView(force = false): Promise<void> {
        const activeView = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);

        if (!this.isEligibleView(activeView)) {
            // Keep the current analysis visible only when focus moved into
            // Nova's own sidebar. Other workspace views, such as the writing
            // dashboard, should clear the panel.
            if (this.shouldPreserveCurrentAnalysis()) {
                return;
            }
            this.activeView = null;
            this.highlightManager = null;
            this.latestAnalysis = null;
            this.disabledByFrontmatter = false;
            this.oversizedActiveNote = false;
            this.analysisStale = false;
            this.invalidateAnalysisRun(null);
            this.clearHighlights();
            this.emitUpdate(false);
            return;
        }

        const viewChanged = activeView !== this.activeView;
        this.activeView = activeView;

        if (viewChanged) {
            this.setupHighlightManager();
        }

        if (force || viewChanged) {
            await this.runAnalysis();
        }
    }

    updateSettings(): void {
        if (!this.plugin.settings.writingAnalysis.enabled) {
            this.latestAnalysis = null;
            this.disabledByFrontmatter = false;
            this.oversizedActiveNote = false;
            this.analysisStale = false;
            this.invalidateAnalysisRun(this.activeView?.file?.path ?? null);
            this.clearHighlights();
            this.emitUpdate(this.isEligibleView(this.activeView));
            return;
        }

        void this.runAnalysis();
    }

    async analyzeNow(): Promise<void> {
        await this.runAnalysis();
    }

    getLatestAnalysis(): WritingAnalysis | null {
        return this.latestAnalysis;
    }

    getActiveFile(): TFile | null {
        return this.activeView?.file ?? null;
    }

    getActiveEditor(): Editor | null {
        return this.activeView?.editor ?? null;
    }

    getActiveContent(): string | null {
        return this.activeView?.editor?.getValue() ?? null;
    }

    isEligibleActiveFile(): boolean {
        return this.isEligibleView(this.activeView);
    }

    isDisabledByFrontmatter(): boolean {
        return this.disabledByFrontmatter;
    }

    isActiveFileOversized(): boolean {
        return this.oversizedActiveNote;
    }

    isAnalysisStale(): boolean {
        return this.analysisStale;
    }

    getActiveRunToken(): AnalysisRunToken {
        return this.activeRunToken;
    }

    setProseLinterIssues(filePath: string, contentHash: string, issues: ProseIssue[]): void {
        if (!this.isCurrentProseLinterTarget(filePath, contentHash)) {
            return;
        }

        this.proseLinterHighlights = issues
            .flatMap(issue => this.createHighlightsForIssue(issue))
            .filter((highlight): highlight is WritingHighlight => Boolean(highlight));
        this.proseLinterHighlightFilePath = filePath;
        this.proseLinterHighlightContentHash = contentHash;
        this.applyHighlights();
    }

    clearProseLinterHighlights(filePath?: string): void {
        if (filePath && this.proseLinterHighlightFilePath && this.proseLinterHighlightFilePath !== filePath) {
            return;
        }
        this.proseLinterHighlights = null;
        this.proseLinterHighlightFilePath = null;
        this.proseLinterHighlightContentHash = null;
        this.applyHighlights();
    }

    setProseLinterReviewActive(active: boolean): void {
        if (this.proseLinterReviewActive === active) {
            return;
        }
        this.proseLinterReviewActive = active;
        this.applyHighlights();
    }

    cleanup(): void {
        this.timeoutManager.clearAll();
        this.pendingReviewModeReconcileTimeout = null;
        this.clearHighlights();
        this.proseLinterHighlights = null;
        this.proseLinterHighlightFilePath = null;
        this.proseLinterHighlightContentHash = null;
        this.activeView = null;
        this.highlightManager = null;
        this.latestAnalysis = null;
        this.oversizedActiveNote = false;
        this.analysisStale = false;
        for (const ownerDocument of this.interactionDocumentLifecycles.keys()) {
            this.unregisterInteractionDocument(ownerDocument);
        }
        this.activeSurfaceDocument = null;
        this.invalidateAnalysisRun(null);
    }

    private async runAnalysis(): Promise<void> {
        const focusSnapshot = this.captureEditorFocusSnapshot();

        if (!this.plugin.settings.writingAnalysis.enabled || !this.isEligibleView(this.activeView)) {
            this.latestAnalysis = null;
            this.disabledByFrontmatter = false;
            this.oversizedActiveNote = false;
            this.analysisStale = false;
            this.invalidateAnalysisRun(this.activeView?.file?.path ?? null);
            this.clearProseLinterHighlights(this.activeView?.file?.path);
            this.clearHighlights();
            this.emitUpdate(false);
            this.restoreEditorFocusIfLost(focusSnapshot);
            return;
        }

        try {
            const activeView = this.activeView;
            const file = activeView.file;
            if (!file) {
                this.latestAnalysis = null;
                this.disabledByFrontmatter = false;
                this.oversizedActiveNote = false;
                this.analysisStale = false;
                this.invalidateAnalysisRun(null);
                this.clearHighlights();
                this.emitUpdate(false);
                this.restoreEditorFocusIfLost(focusSnapshot);
                return;
            }
            const runStartToken = this.startAnalysisRun(file.path);

            const editorLength = this.getEditorDocumentLength();
            if (editorLength !== null && editorLength > MAX_WRITING_ANALYSIS_CHAR_LENGTH) {
                this.markActiveFileOversized(runStartToken);
                this.restoreEditorFocusIfLost(focusSnapshot);
                return;
            }

            const content = activeView.editor?.getValue() ?? await this.plugin.app.vault.cachedRead(file);
            if (content.length > MAX_WRITING_ANALYSIS_CHAR_LENGTH) {
                this.markActiveFileOversized(runStartToken);
                this.restoreEditorFocusIfLost(focusSnapshot);
                return;
            }

            const candidateToken = createAnalysisRunToken(file.path, hashContent(content), runStartToken.sequence);
            this.clearStaleProseLinterHighlights(candidateToken);
            if (this.isCandidateRunStale(candidateToken, content)) {
                this.restoreEditorFocusIfLost(focusSnapshot);
                return;
            }

            this.disabledByFrontmatter = hasWritingAnalysisOptOut(content);
            if (this.disabledByFrontmatter) {
                this.latestAnalysis = null;
                this.oversizedActiveNote = false;
                this.analysisStale = false;
                this.activeRunToken = candidateToken;
                this.clearHighlights();
                this.emitUpdate(true);
                this.restoreEditorFocusIfLost(focusSnapshot);
                return;
            }

            this.latestAnalysis = analyzeWriting(content, {
                longSentenceThreshold: this.plugin.settings.writingAnalysis.longSentenceThreshold,
                veryLongSentenceThreshold: this.plugin.settings.writingAnalysis.veryLongSentenceThreshold
            });
            if (this.isCandidateRunStale(candidateToken, content)) {
                this.restoreEditorFocusIfLost(focusSnapshot);
                return;
            }

            this.activeRunToken = candidateToken;
            this.oversizedActiveNote = false;
            this.analysisStale = false;
            this.applyHighlights();
            this.emitUpdate(true);
            this.restoreEditorFocusIfLost(focusSnapshot);
        } catch (error) {
            this.logger.error('Failed to analyze writing:', error);
            this.restoreEditorFocusIfLost(focusSnapshot);
        }
    }

    private markActiveFileOversized(runToken?: AnalysisRunToken): void {
        const filePath = this.activeView?.file?.path ?? null;
        const alreadyOversized = this.oversizedActiveNote &&
            this.activeRunToken.filePath === filePath &&
            !this.latestAnalysis &&
            !this.disabledByFrontmatter;

        this.latestAnalysis = null;
        this.disabledByFrontmatter = false;
        this.oversizedActiveNote = true;
        this.analysisStale = false;

        if (runToken) {
            this.activeRunToken = runToken;
        } else if (!alreadyOversized) {
            this.startAnalysisRun(filePath);
        }

        this.clearProseLinterHighlights(filePath ?? undefined);
        this.clearHighlights();

        if (!alreadyOversized || runToken) {
            this.emitUpdate(true);
        }
    }

    private emitUpdate(eligible: boolean): void {
        this.plugin.app.workspace.trigger(WRITING_ANALYSIS_UPDATED_EVENT, {
            analysis: this.latestAnalysis,
            filePath: this.activeView?.file?.path ?? null,
            eligible,
            disabledByFrontmatter: this.disabledByFrontmatter,
            oversized: this.oversizedActiveNote,
            stale: this.analysisStale,
            runToken: this.activeRunToken
        } satisfies WritingAnalysisUpdateDetail);
    }

    private handleEditorChange(editor: Editor): void {
        if (
            !this.plugin.settings.writingAnalysis.enabled ||
            !this.isEligibleView(this.activeView) ||
            editor !== this.activeView.editor ||
            this.analysisStale ||
            (!this.latestAnalysis && !this.disabledByFrontmatter)
        ) {
            return;
        }

        this.analysisStale = true;
        this.clearProseLinterHighlights(this.activeView.file?.path);
        this.clearHighlights();
        this.emitUpdate(true);
    }

    private applyHighlights(): void {
        if (!this.highlightManager) {
            this.clearHighlights();
            return;
        }

        if (this.proseLinterReviewActive) {
            const proseLinterHighlights = this.getCurrentProseLinterHighlights();
            if (proseLinterHighlights) {
                this.highlightManager.updateHighlights(proseLinterHighlights);
            } else {
                this.clearHighlights();
            }
            return;
        }

        this.clearHighlights();
    }

    private createHighlight(
        lineNumber: number,
        startCh: number,
        endCh: number,
        type: WritingHighlight['type'],
        title: string
    ): WritingHighlight | null {
        const cm = this.getEditorView();
        if (!cm) {
            return null;
        }

        const oneBasedLine = lineNumber + 1;
        if (oneBasedLine < 1 || oneBasedLine > cm.state.doc.lines) {
            return null;
        }

        const line = cm.state.doc.line(oneBasedLine);
        const from = Math.max(line.from, Math.min(line.to, line.from + startCh));
        const to = Math.max(from, Math.min(line.to, line.from + endCh));

        if (to <= from) {
            return null;
        }

        return { from, to, type, title };
    }

    private createHighlightsForIssue(issue: ProseIssue): Array<WritingHighlight | null> {
        const title = `${PROSE_ISSUE_LABELS[issue.type]}: ${issue.suggestion}`;
        const ranges = this.getHighlightRanges(issue);
        return ranges.map(range => this.createHighlight(
            range.line,
            range.startCh,
            range.endCh,
            issue.type,
            title
        ));
    }

    private getHighlightRanges(issue: ProseIssue): ProseIssueRange[] {
        if (issue.relatedRanges && issue.relatedRanges.length > 0) {
            return issue.relatedRanges;
        }
        return [{
            line: issue.line,
            startCh: issue.startCh,
            endCh: issue.endCh
        }];
    }

    private clearHighlights(): void {
        this.highlightManager?.clearHighlights();
    }

    private getCurrentProseLinterHighlights(): WritingHighlight[] | null {
        if (!this.proseLinterHighlights) {
            return null;
        }

        const activeFilePath = this.activeView?.file?.path ?? null;
        const activeContent = this.activeView?.editor?.getValue() ?? null;
        if (
            !activeContent ||
            activeFilePath !== this.proseLinterHighlightFilePath ||
            hashContent(activeContent) !== this.proseLinterHighlightContentHash
        ) {
            this.proseLinterHighlights = null;
            this.proseLinterHighlightFilePath = null;
            this.proseLinterHighlightContentHash = null;
            return null;
        }

        return this.proseLinterHighlights;
    }

    private clearStaleProseLinterHighlights(candidateToken: AnalysisRunToken): void {
        if (
            this.proseLinterHighlights &&
            (
                this.proseLinterHighlightFilePath !== candidateToken.filePath ||
                this.proseLinterHighlightContentHash !== candidateToken.contentHash
            )
        ) {
            this.proseLinterHighlights = null;
            this.proseLinterHighlightFilePath = null;
            this.proseLinterHighlightContentHash = null;
        }
    }

    private isCurrentProseLinterTarget(filePath: string, contentHash: string): boolean {
        const activeFilePath = this.activeView?.file?.path ?? null;
        const activeContent = this.activeView?.editor?.getValue() ?? null;
        return Boolean(activeContent && activeFilePath === filePath && hashContent(activeContent) === contentHash);
    }

    private setupHighlightManager(): void {
        const cm = this.getEditorView();
        if (!cm) {
            this.highlightManager = null;
            return;
        }

        this.highlightManager = new CodeMirrorWritingHighlightManager(cm, this.plugin.writingAnalysisStateField);
    }

    private getEditorView(): EditorView | null {
        const editorWithCm = this.activeView?.editor as { cm?: EditorView } | undefined;
        return editorWithCm?.cm ?? null;
    }

    private getEditorDocumentLength(): number | null {
        const cm = this.getEditorView();
        return typeof cm?.state.doc.length === 'number' ? cm.state.doc.length : null;
    }

    private captureEditorFocusSnapshot(): EditorFocusSnapshot | null {
        const activeView = this.activeView;
        const filePath = activeView?.file?.path;
        const cm = this.getEditorView();
        const editorDom = cm?.dom;
        const focusedElement = editorDom?.ownerDocument.activeElement;

        if (!filePath || !cm || !editorDom || !focusedElement || !editorDom.contains(focusedElement)) {
            return null;
        }

        return {
            filePath,
            editorDom,
            restoreFocus: () => cm.focus()
        };
    }

    private restoreEditorFocusIfLost(snapshot: EditorFocusSnapshot | null): void {
        if (!snapshot || this.activeView?.file?.path !== snapshot.filePath) {
            return;
        }

        const activeElement = snapshot.editorDom.ownerDocument.activeElement;
        if (!activeElement || snapshot.editorDom.contains(activeElement) || this.hasMeaningfulFocus(activeElement)) {
            return;
        }

        snapshot.restoreFocus();
    }

    private hasMeaningfulFocus(element: Element): boolean {
        if (element === element.ownerDocument.body || element === element.ownerDocument.documentElement) {
            return false;
        }

        const tagName = element.tagName.toLowerCase();
        if (
            tagName === 'input' ||
            tagName === 'textarea' ||
            tagName === 'select' ||
            tagName === 'button' ||
            tagName === 'a' ||
            (element as HTMLElement).isContentEditable
        ) {
            return true;
        }

        return Boolean(element.closest(
            '.nova-sidebar-container, ' +
            '.nova-prose-linter-container, ' +
            '.workspace-tab-header, ' +
            '.workspace-ribbon, ' +
            '.nav-files-container'
        ));
    }

    private isEligibleView(view: MarkdownView | null): view is MarkdownView {
        return Boolean(view?.file && view.file.extension === 'md' && view.editor);
    }

    private shouldPreserveCurrentAnalysis(): boolean {
        if (!this.activeView || !this.isEligibleView(this.activeView)) {
            return false;
        }

        // Preserve analysis for any non-document view (file explorer, search,
        // graph, Nova sidebar, etc.). Only clear when switching to the writing
        // dashboard, which has its own analysis display.
        return this.currentLeafViewType !== VIEW_TYPE_WRITING_DASHBOARD;
    }

    private handleActiveLeafChange(leaf: WorkspaceLeaf | null): void {
        this.currentLeafViewType = leaf?.view.getViewType() ?? null;
        const ownerDocument = (leaf?.view as { containerEl?: HTMLElement } | undefined)?.containerEl?.ownerDocument;
        if (ownerDocument) {
            this.activeSurfaceDocument = ownerDocument;
            this.registerInteractionDocument(ownerDocument);
        }

        if (this.currentLeafViewType === VIEW_TYPE_PROSE_LINTER) {
            this.setProseLinterReviewActive(true);
        } else if (this.currentLeafViewType !== 'markdown') {
            this.setProseLinterReviewActive(false);
        }

        void this.refreshForActiveView(false);
    }

    private handleWorkspaceInteraction(event: Event): void {
        const targetNode = event.target as Node | null;
        if (targetNode?.ownerDocument) {
            this.activeSurfaceDocument = targetNode.ownerDocument;
        }

        const clickedViewType = this.getClickedNovaViewType(event.target);
        if (clickedViewType === VIEW_TYPE_PROSE_LINTER) {
            this.setProseLinterReviewActive(true);
            this.scheduleProseLinterReviewReconcile();
            return;
        }

        if (clickedViewType === VIEW_TYPE_NOVA_SIDEBAR) {
            this.setProseLinterReviewActive(false);
        }

        this.scheduleProseLinterReviewReconcile();
    }

    private getClickedNovaViewType(target: EventTarget | null): string | null {
        const targetElement = target as Element | null;
        if (typeof targetElement?.closest !== 'function') {
            return null;
        }

        const clickedSurfaceViewType = this.getNovaSurfaceViewTypeFromElement(targetElement);
        if (clickedSurfaceViewType) {
            return clickedSurfaceViewType;
        }

        const labeledAncestorViewType = this.getNovaViewTypeFromLabeledAncestors(targetElement);
        if (labeledAncestorViewType) {
            return labeledAncestorViewType;
        }

        const tabHeader = targetElement.closest('.workspace-tab-header');
        if (!tabHeader) {
            return null;
        }

        const label = [
            tabHeader.getAttribute('aria-label'),
            tabHeader.getAttribute('title'),
            tabHeader.textContent
        ]
            .filter((value): value is string => Boolean(value))
            .join(' ')
            .toLowerCase();

        if (label.includes('prose linter')) {
            return VIEW_TYPE_PROSE_LINTER;
        }

        if (label.includes('nova')) {
            return VIEW_TYPE_NOVA_SIDEBAR;
        }

        return null;
    }

    private getNovaViewTypeFromLabeledAncestors(target: Element): string | null {
        let element: Element | null = target;
        let depth = 0;

        while (element && depth < 8) {
            const viewType = this.getNovaViewTypeFromLabel([
                element.getAttribute('aria-label'),
                element.getAttribute('title')
            ]);
            if (viewType) {
                return viewType;
            }

            element = element.parentElement;
            depth++;
        }

        return null;
    }

    private getNovaViewTypeFromLabel(labels: Array<string | null>): string | null {
        const label = labels
            .filter((value): value is string => Boolean(value))
            .join(' ')
            .toLowerCase();

        if (label.includes('prose linter')) {
            return VIEW_TYPE_PROSE_LINTER;
        }

        if (label === 'nova' || label.includes('nova sidebar')) {
            return VIEW_TYPE_NOVA_SIDEBAR;
        }

        return null;
    }

    private reconcileProseLinterReviewMode(): void {
        const ownerDocument = this.getActiveSurfaceDocument();
        const topVisibleSurface = this.getTopVisibleNovaSurfaceViewType(ownerDocument);
        if (topVisibleSurface === VIEW_TYPE_PROSE_LINTER) {
            this.setProseLinterReviewActive(true);
            return;
        }

        if (topVisibleSurface === VIEW_TYPE_NOVA_SIDEBAR) {
            this.setProseLinterReviewActive(false);
            return;
        }

        const visibleNovaSurface = this.getVisibleNovaSurfaceViewType(ownerDocument);
        if (visibleNovaSurface === VIEW_TYPE_PROSE_LINTER) {
            this.setProseLinterReviewActive(true);
            return;
        }

        if (visibleNovaSurface === VIEW_TYPE_NOVA_SIDEBAR) {
            this.setProseLinterReviewActive(false);
            return;
        }

        if (this.currentLeafViewType === VIEW_TYPE_PROSE_LINTER) {
            this.setProseLinterReviewActive(true);
            return;
        }

        if (this.currentLeafViewType === VIEW_TYPE_NOVA_SIDEBAR || this.currentLeafViewType === VIEW_TYPE_WRITING_DASHBOARD) {
            this.setProseLinterReviewActive(false);
        }
    }

    private scheduleProseLinterReviewReconcile(): void {
        if (this.pendingReviewModeReconcileTimeout !== null) {
            this.timeoutManager.removeTimeout(this.pendingReviewModeReconcileTimeout);
        }

        this.pendingReviewModeReconcileTimeout = this.timeoutManager.addTimeout(() => {
            this.pendingReviewModeReconcileTimeout = null;
            this.reconcileProseLinterReviewMode();
        }, 0);
    }

    private getVisibleNovaSurfaceViewType(ownerDocument: Document): string | null {
        const proseLinterVisible = this.isAnyElementVisible('.nova-prose-linter-view', ownerDocument);
        const sidebarVisible = this.isAnyElementVisible('.nova-sidebar-container', ownerDocument);

        if (proseLinterVisible && !sidebarVisible) {
            return VIEW_TYPE_PROSE_LINTER;
        }

        if (sidebarVisible && !proseLinterVisible) {
            return VIEW_TYPE_NOVA_SIDEBAR;
        }

        return null;
    }

    private getTopVisibleNovaSurfaceViewType(ownerDocument: Document): string | null {
        if (typeof ownerDocument.elementFromPoint !== 'function') {
            return null;
        }

        const ownerWindow = ownerDocument.defaultView ?? window;
        const viewportWidth = ownerDocument.documentElement.clientWidth || ownerWindow.innerWidth;
        const viewportHeight = ownerDocument.documentElement.clientHeight || ownerWindow.innerHeight;
        const samplePoints = this.getRightPaneSamplePoints(viewportWidth, viewportHeight);

        for (const point of samplePoints) {
            const topElement = ownerDocument.elementFromPoint(point.x, point.y);
            const viewType = this.getNovaSurfaceViewTypeFromElement(topElement);
            if (viewType) {
                return viewType;
            }
        }

        return null;
    }

    private getRightPaneSamplePoints(viewportWidth: number, viewportHeight: number): Array<{ x: number; y: number }> {
        const xOffsets = [80, 160, 260];
        const yPositions = [
            96,
            180,
            Math.round(viewportHeight / 2),
            Math.max(0, viewportHeight - 160)
        ];
        const points: Array<{ x: number; y: number }> = [];

        for (const xOffset of xOffsets) {
            const x = viewportWidth - xOffset;
            if (x < 0 || x > viewportWidth) {
                continue;
            }
            for (const y of yPositions) {
                if (y < 0 || y > viewportHeight) {
                    continue;
                }
                points.push({ x, y });
            }
        }

        return points;
    }

    private getNovaSurfaceViewTypeFromElement(element: Element | null): string | null {
        if (!element) {
            return null;
        }

        if (element.closest('.nova-prose-linter-view')) {
            return VIEW_TYPE_PROSE_LINTER;
        }

        if (element.closest('.nova-sidebar-container')) {
            return VIEW_TYPE_NOVA_SIDEBAR;
        }

        return null;
    }

    private isAnyElementVisible(selector: string, ownerDocument: Document): boolean {
        return Array.from(ownerDocument.querySelectorAll(selector)).some(element => this.isElementVisible(element));
    }

    private getActiveSurfaceDocument(): Document {
        return this.activeSurfaceDocument ??
            this.activeView?.containerEl?.ownerDocument ??
            this.plugin.app.workspace.containerEl?.ownerDocument ??
            document;
    }

    private registerKnownWorkspaceDocuments(): void {
        const workspace = this.plugin.app.workspace;
        this.registerInteractionDocument(workspace.containerEl?.ownerDocument ?? document);
        workspace.iterateAllLeaves((leaf) => {
            const ownerDocument = (leaf.view as { containerEl?: HTMLElement }).containerEl?.ownerDocument;
            if (ownerDocument) {
                this.registerInteractionDocument(ownerDocument);
            }
        });
    }

    private registerInteractionDocument(ownerDocument: Document): void {
        if (this.interactionDocumentLifecycles.has(ownerDocument)) {
            return;
        }
        const lifecycle = this.plugin.addChild(new Component());
        this.interactionDocumentLifecycles.set(ownerDocument, lifecycle);

        lifecycle.registerDomEvent(ownerDocument, 'click', (event: MouseEvent) => {
            this.handleWorkspaceInteraction(event);
        }, { capture: true });
        lifecycle.registerDomEvent(ownerDocument, 'pointerdown', (event: PointerEvent) => {
            this.handleWorkspaceInteraction(event);
        }, { capture: true });
        lifecycle.registerDomEvent(ownerDocument, 'focusin', (event: FocusEvent) => {
            this.handleWorkspaceInteraction(event);
        }, { capture: true });
    }

    private unregisterInteractionDocument(ownerDocument: Document): void {
        const lifecycle = this.interactionDocumentLifecycles.get(ownerDocument);
        if (!lifecycle) {
            return;
        }

        this.interactionDocumentLifecycles.delete(ownerDocument);
        this.plugin.removeChild(lifecycle);
        if (this.activeSurfaceDocument === ownerDocument) {
            this.activeSurfaceDocument = null;
        }
    }

    private isElementVisible(element: Element): boolean {
        const htmlElement = element as HTMLElement;
        if (htmlElement.getClientRects().length === 0) {
            return false;
        }

        const ownerWindow = element.ownerDocument.defaultView;
        if (!ownerWindow) {
            return true;
        }

        const style = ownerWindow.getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden';
    }

    private startAnalysisRun(filePath: string | null): AnalysisRunToken {
        this.analysisSequence++;
        this.activeRunToken = createAnalysisRunToken(filePath, '', this.analysisSequence);
        return this.activeRunToken;
    }

    private invalidateAnalysisRun(filePath: string | null): void {
        this.analysisSequence++;
        this.activeRunToken = createAnalysisRunToken(filePath, '', this.analysisSequence);
    }

    private isCandidateRunStale(candidateToken: AnalysisRunToken, candidateContent: string): boolean {
        const currentFilePath = this.activeView?.file?.path ?? null;
        const currentContent = this.activeView?.editor?.getValue() ?? candidateContent;
        const currentToken = createAnalysisRunToken(currentFilePath, hashContent(currentContent), this.analysisSequence);
        return isStaleAnalysisRun(currentToken, candidateToken);
    }
}
