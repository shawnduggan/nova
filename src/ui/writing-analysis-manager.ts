/**
 * @file WritingAnalysisManager - Coordinates deterministic writing analysis for the active Markdown editor
 */

import { MarkdownView, TFile } from 'obsidian';
import { EditorView } from '@codemirror/view';
import { analyzeWriting, hasWritingAnalysisOptOut, type WritingAnalysis } from '../core/writing-analysis';
import { CodeMirrorWritingHighlightManager, type WritingHighlight } from '../features/commands/ui/codemirror-decorations';
import { VIEW_TYPE_NOVA_SIDEBAR } from '../constants';
import { Logger } from '../utils/logger';
import { TimeoutManager } from '../utils/timeout-manager';
import type NovaPlugin from '../../main';

export const WRITING_ANALYSIS_UPDATED_EVENT = 'nova-writing-analysis-updated';

export interface WritingAnalysisUpdateDetail {
    analysis: WritingAnalysis | null;
    filePath: string | null;
    eligible: boolean;
    highlightsVisible: boolean;
    disabledByFrontmatter: boolean;
}

export class WritingAnalysisManager {
    private static readonly ANALYSIS_DEBOUNCE_MS = 500;

    private plugin: NovaPlugin;
    private logger = Logger.scope('WritingAnalysisManager');
    private timeoutManager = new TimeoutManager();
    private activeView: MarkdownView | null = null;
    private highlightManager: CodeMirrorWritingHighlightManager | null = null;
    private latestAnalysis: WritingAnalysis | null = null;
    private highlightsVisible = true;
    private disabledByFrontmatter = false;
    private observedEditors = new WeakSet<HTMLElement>();
    private pendingAnalysisTimeout: number | null = null;
    private currentLeafViewType: string | null = null;

    constructor(plugin: NovaPlugin) {
        this.plugin = plugin;
    }

    init(): void {
        this.plugin.registerEvent(
            this.plugin.app.workspace.on('active-leaf-change', (leaf) => {
                this.currentLeafViewType = leaf?.view.getViewType() ?? null;
                void this.refreshForActiveView(true);
            })
        );

        this.plugin.registerEvent(
            this.plugin.app.workspace.on('file-open', () => {
                void this.refreshForActiveView(true);
            })
        );

        void this.refreshForActiveView(true);
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
            this.clearHighlights();
            this.emitUpdate(false);
            return;
        }

        const viewChanged = activeView !== this.activeView;
        this.activeView = activeView;

        if (viewChanged) {
            this.setupHighlightManager();
            this.setupEditorListeners();
        }

        if (force || viewChanged) {
            await this.runAnalysis();
        }
    }

    updateSettings(): void {
        if (!this.plugin.settings.writingAnalysis.enabled) {
            this.latestAnalysis = null;
            this.disabledByFrontmatter = false;
            this.clearHighlights();
            this.emitUpdate(this.isEligibleView(this.activeView));
            return;
        }

        void this.runAnalysis();
    }

    scheduleAnalysis(): void {
        if (!this.plugin.settings.writingAnalysis.enabled || !this.isEligibleView(this.activeView)) {
            return;
        }

        if (this.pendingAnalysisTimeout) {
            this.timeoutManager.removeTimeout(this.pendingAnalysisTimeout);
        }

        this.pendingAnalysisTimeout = this.timeoutManager.addTimeout(() => {
            this.pendingAnalysisTimeout = null;
            void this.runAnalysis();
        }, WritingAnalysisManager.ANALYSIS_DEBOUNCE_MS);
    }

    async analyzeNow(): Promise<void> {
        if (this.pendingAnalysisTimeout) {
            this.timeoutManager.removeTimeout(this.pendingAnalysisTimeout);
            this.pendingAnalysisTimeout = null;
        }
        await this.runAnalysis();
    }

    getLatestAnalysis(): WritingAnalysis | null {
        return this.latestAnalysis;
    }

    getActiveFile(): TFile | null {
        return this.activeView?.file ?? null;
    }

    isEligibleActiveFile(): boolean {
        return this.isEligibleView(this.activeView);
    }

    isHighlightsVisible(): boolean {
        return this.highlightsVisible;
    }

    isDisabledByFrontmatter(): boolean {
        return this.disabledByFrontmatter;
    }

    setHighlightsVisible(visible: boolean): void {
        this.highlightsVisible = visible;
        this.applyHighlights();
        this.emitUpdate(this.isEligibleView(this.activeView));
    }

    cleanup(): void {
        this.timeoutManager.clearAll();
        this.pendingAnalysisTimeout = null;
        this.clearHighlights();
        this.activeView = null;
        this.highlightManager = null;
        this.latestAnalysis = null;
    }

    private async runAnalysis(): Promise<void> {
        if (!this.plugin.settings.writingAnalysis.enabled || !this.isEligibleView(this.activeView)) {
            this.latestAnalysis = null;
            this.disabledByFrontmatter = false;
            this.clearHighlights();
            this.emitUpdate(false);
            return;
        }

        try {
            const activeView = this.activeView;
            const file = activeView.file;
            if (!file) {
                this.latestAnalysis = null;
                this.clearHighlights();
                this.emitUpdate(false);
                return;
            }

            const content = activeView.editor?.getValue() ?? await this.plugin.app.vault.cachedRead(file);

            this.disabledByFrontmatter = hasWritingAnalysisOptOut(content);
            if (this.disabledByFrontmatter) {
                this.latestAnalysis = null;
                this.clearHighlights();
                this.emitUpdate(true);
                return;
            }

            this.latestAnalysis = analyzeWriting(content, {
                longSentenceThreshold: this.plugin.settings.writingAnalysis.longSentenceThreshold,
                veryLongSentenceThreshold: this.plugin.settings.writingAnalysis.veryLongSentenceThreshold
            });

            this.applyHighlights();
            this.emitUpdate(true);
        } catch (error) {
            this.logger.error('Failed to analyze writing:', error);
        }
    }

    private emitUpdate(eligible: boolean): void {
        document.dispatchEvent(new CustomEvent(WRITING_ANALYSIS_UPDATED_EVENT, {
            detail: {
                analysis: this.latestAnalysis,
                filePath: this.activeView?.file?.path ?? null,
                eligible,
                highlightsVisible: this.highlightsVisible,
                disabledByFrontmatter: this.disabledByFrontmatter
            } satisfies WritingAnalysisUpdateDetail
        }));
    }

    private applyHighlights(): void {
        if (!this.highlightManager || !this.latestAnalysis || !this.highlightsVisible) {
            this.clearHighlights();
            return;
        }

        const highlights = this.buildHighlights(this.latestAnalysis);
        this.highlightManager.updateHighlights(highlights);
    }

    private buildHighlights(analysis: WritingAnalysis): WritingHighlight[] {
        const highlights: WritingHighlight[] = [];
        const settings = this.plugin.settings.writingAnalysis;

        if (settings.highlightLongSentences) {
            analysis.sentences.forEach(sentence => {
                if (sentence.severity === 'ok') {
                    return;
                }

                const highlight = this.createHighlight(
                    sentence.line,
                    sentence.startCh,
                    sentence.endCh,
                    sentence.severity === 'very-long' ? 'very-long-sentence' : 'long-sentence',
                    `This sentence has ${sentence.wordCount} words. Consider splitting it.`
                );

                if (highlight) {
                    highlights.push(highlight);
                }
            });
        }

        if (settings.highlightPassiveVoice) {
            analysis.passiveVoice.forEach(match => {
                const highlight = this.createHighlight(
                    match.line,
                    match.startCh,
                    match.endCh,
                    'passive-voice',
                    'Passive voice detected. Consider rewriting in active voice.'
                );

                if (highlight) {
                    highlights.push(highlight);
                }
            });
        }

        if (settings.highlightAdverbs) {
            analysis.adverbs.forEach(match => {
                const highlight = this.createHighlight(
                    match.line,
                    match.startCh,
                    match.endCh,
                    'adverb',
                    `'${match.word}' - consider whether this adverb is necessary.`
                );

                if (highlight) {
                    highlights.push(highlight);
                }
            });
        }

        if (settings.highlightWeakIntensifiers) {
            analysis.weakIntensifiers.forEach(match => {
                const highlight = this.createHighlight(
                    match.line,
                    match.startCh,
                    match.endCh,
                    'weak-intensifier',
                    `'${match.word}' - consider removing or using a stronger word.`
                );

                if (highlight) {
                    highlights.push(highlight);
                }
            });
        }

        return highlights;
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

    private clearHighlights(): void {
        this.highlightManager?.clearHighlights();
    }

    private setupHighlightManager(): void {
        const cm = this.getEditorView();
        if (!cm) {
            this.highlightManager = null;
            return;
        }

        this.highlightManager = new CodeMirrorWritingHighlightManager(cm, this.plugin.writingAnalysisStateField);
    }

    private setupEditorListeners(): void {
        if (!this.activeView) {
            return;
        }

        const editorEl = this.activeView.containerEl.querySelector<HTMLElement>('.cm-editor');
        if (!editorEl || this.observedEditors.has(editorEl)) {
            return;
        }

        this.observedEditors.add(editorEl);
        this.plugin.registerDomEvent(editorEl, 'input', () => {
            this.scheduleAnalysis();
        });
    }

    private getEditorView(): EditorView | null {
        const editorWithCm = this.activeView?.editor as { cm?: EditorView } | undefined;
        return editorWithCm?.cm ?? null;
    }

    private isEligibleView(view: MarkdownView | null): view is MarkdownView {
        return Boolean(view?.file && view.file.extension === 'md' && view.editor);
    }

    private shouldPreserveCurrentAnalysis(): boolean {
        if (!this.activeView || !this.isEligibleView(this.activeView)) {
            return false;
        }

        return this.currentLeafViewType === VIEW_TYPE_NOVA_SIDEBAR;
    }
}
