/**
 * @file MarginIndicators - Intelligent margin indicators for command suggestions
 * Shows contextual command hints in the editor margin with progressive disclosure
 * Now supports `<!-- nova: instruction -->` markers for the /fill command
 */

import { MarkdownView, Editor } from 'obsidian';
import { EditorView } from '@codemirror/view';
import { NOVA_INDICATOR_CLICK_EVENT } from '../../../constants';
import { Logger } from '../../../utils/logger';
import { TimeoutManager } from '../../../utils/timeout-manager';
import { onWorkspaceEvent } from '../../../utils/workspace-events';
import { CommandEngine, MarkerInsight } from '../core/CommandEngine';
import { InsightPanel } from './InsightPanel';
import { CodeMirrorIndicatorManager } from './codemirror-decorations';
import type { MarkdownCommand } from '../types';
import type NovaPlugin from '../../../../main';

interface IndicatorOpportunity {
    line: number;
    column: number;
    type: 'enhancement' | 'metrics' | 'transform';
    icon: string;
    commands: MarkdownCommand[];
    confidence: number;
    fillInstruction?: string;
}

export class MarginIndicators {
    private plugin: NovaPlugin;
    private commandEngine: CommandEngine;
    public insightPanel: InsightPanel;
    private logger = Logger.scope('MarginIndicators');
    private timeoutManager = new TimeoutManager();

    // Component state
    private activeEditor: Editor | null = null;
    private activeView: MarkdownView | null = null;
    private indicatorManager: CodeMirrorIndicatorManager | null = null;
    private currentOpportunities: IndicatorOpportunity[] = [];
    private pendingIndicatorAnalysisTimeout: number | null = null;
    private observedEditorEls = new WeakSet<HTMLElement>();
    private observedScrollerEls = new WeakSet<HTMLElement>();

    // Settings
    private enabled = true;
    private intensityLevel: 'off' | 'minimal' | 'balanced' | 'aggressive' = 'balanced';

    // Performance limits
    private readonly MAX_INDICATORS = 20; // Maximum indicators to show at once

    constructor(
        plugin: NovaPlugin,
        _variableResolver: unknown,
        commandEngine: CommandEngine,
        _smartTimingEngine: unknown
    ) {
        this.plugin = plugin;
        this.commandEngine = commandEngine;
        this.insightPanel = new InsightPanel(plugin, commandEngine);

        // Initialize settings from plugin configuration
        this.updateSettings();
    }

    /**
     * Initialize the margin indicators system
     */
    init(): void {
        this.logger.info('Initializing MarginIndicators');

        // Register for workspace events
        this.plugin.registerEvent(
            this.plugin.app.workspace.on('active-leaf-change', () => {
                this.onActiveEditorChange();
            })
        );

        // Register for file change events
        this.plugin.registerEvent(
            this.plugin.app.workspace.on('file-open', () => {
                this.onActiveEditorChange();
            })
        );

        // Set up workspace event listener for indicator clicks (once only)
        this.plugin.registerEvent(onWorkspaceEvent(this.plugin.app.workspace, NOVA_INDICATOR_CLICK_EVENT, (detail: {
                opportunity: IndicatorOpportunity;
                element: HTMLElement;
            }) => {
            const { opportunity, element } = detail;
            this.onIndicatorClick(opportunity, element);
        }));

        // Initialize with current active editor
        this.onActiveEditorChange();

        this.logger.info('MarginIndicators initialized');
    }

    /**
     * Handle active editor changes
     */
    private onActiveEditorChange(): void {
        // Clean up previous editor
        this.cleanupCurrentEditor();

        // Get new active editor
        const activeView = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView) {
            this.activeEditor = null;
            this.activeView = null;
            return;
        }

        // Note: Deferred view handling would go here if needed
        // Current MarkdownView interface doesn't expose isDeferred/loadIfDeferred

        if (!activeView.editor) {
            this.activeEditor = null;
            this.activeView = null;
            return;
        }

        this.activeView = activeView;
        this.activeEditor = activeView.editor;

        // Set up CodeMirror indicator manager
        this.setupCodeMirrorManager();

        if (this.enabled) {
            this.setupEditorListeners();
            void this.analyzeCurrentContext(); // Immediate analysis on editor change
        }
    }

    /**
     * Set up event listeners for the current editor
     */
    private setupEditorListeners(): void {
        if (!this.activeEditor || !this.activeView) return;

        // Listen for editor changes
        const editorEl = this.activeView.containerEl.querySelector('.cm-editor') as HTMLElement;
        const scrollerEl = this.activeView.containerEl.querySelector('.cm-scroller') as HTMLElement;
        
        if (editorEl && !this.observedEditorEls.has(editorEl)) {
            this.observedEditorEls.add(editorEl);
            // Listen for cursor position changes
            this.plugin.registerDomEvent(
                editorEl,
                'click',
                () => this.analyzeCurrentContext() // Immediate analysis on cursor change
            );
        }

        // Listen for scroll events (to re-analyze visible content)
        if (scrollerEl && !this.observedScrollerEls.has(scrollerEl)) {
            this.observedScrollerEls.add(scrollerEl);
            this.plugin.registerDomEvent(
                scrollerEl,
                'scroll',
                () => this.onScroll()
            );
        }
    }

    private scheduleIndicatorAnalysis(delay: number): void {
        if (this.pendingIndicatorAnalysisTimeout !== null) {
            this.timeoutManager.removeTimeout(this.pendingIndicatorAnalysisTimeout);
        }

        this.pendingIndicatorAnalysisTimeout = this.timeoutManager.addTimeout(() => {
            this.pendingIndicatorAnalysisTimeout = null;
            void this.analyzeCurrentContext();
        }, delay);
    }

    /**
     * Handle scroll events with debouncing
     */
    private onScroll(): void {
        this.scheduleIndicatorAnalysis(150);
    }


    /**
     * Analyze current context and show relevant indicators
     */
    public analyzeCurrentContext(): void {
        if (!this.activeEditor || !this.enabled) return;

        try {
            this.logger.debug('Analyzing context for margin indicators...');

            // Get current line for analysis
            const cursor = this.activeEditor.getCursor();
            this.logger.debug(`Analyzing line ${cursor.line}`);

            // Find opportunities (including markers)
            const opportunities = this.findOpportunities();
            this.logger.debug(`Found ${opportunities.length} opportunities:`, opportunities.map(o => `Line ${o.line}: ${o.type} (${o.confidence})`));

            // Update indicators
            this.updateIndicators(opportunities);

        } catch (error) {
            this.logger.error('Failed to analyze context for indicators:', error);
        }
    }

    /**
     * Find command opportunities based on context
     * Now includes marker detection for `<!-- nova: instruction -->` patterns
     */
    private findOpportunities(): IndicatorOpportunity[] {
        const opportunities: IndicatorOpportunity[] = [];

        // Get visible lines range
        const visibleRange = this.getVisibleLineRange();
        this.logger.debug(`Analyzing lines ${visibleRange.from} to ${visibleRange.to}`);

        // First, detect any markers in the document (if both features are enabled)
        // Fill markers require BOTH margin indicators AND Smart Fill to be enabled
        const smartFillEnabled = this.plugin.featureManager?.isFeatureEnabled('smartfill') ?? true;

        if (this.enabled && smartFillEnabled) {
            const markers = this.detectVisibleMarkers(visibleRange);

            // Add marker-based opportunities for visible Smart Fill markers.
            // Fill markers are explicit user-placed markers that need to be clickable
            for (const marker of markers) {
                opportunities.push({
                    line: marker.line,
                    column: this.getMarginColumn(),
                    type: 'enhancement',
                    icon: '📝',
                    commands: [], // No commands needed - markers use /fill
                    confidence: 1.0, // High confidence for explicit markers
                    fillInstruction: marker.instruction
                });
            }
        }

        // Filter by intensity level and confidence
        return this.filterOpportunitiesByIntensity(opportunities);
    }

    private detectVisibleMarkers(visibleRange: { from: number; to: number }): MarkerInsight[] {
        if (!this.activeEditor) {
            return [];
        }

        const lineCount = this.activeEditor.lineCount();
        if (lineCount <= 0) {
            return [];
        }

        const from = Math.max(0, Math.min(visibleRange.from, lineCount - 1));
        const to = Math.max(from, Math.min(visibleRange.to, lineCount - 1));
        const visibleLines: string[] = [];

        for (let lineNumber = from; lineNumber <= to; lineNumber++) {
            visibleLines.push(this.activeEditor.getLine(lineNumber));
        }

        const visibleContent = visibleLines.join('\n');
        return this.commandEngine.detectMarkers(visibleContent).map(marker => ({
            ...marker,
            line: marker.line + from,
            endLine: marker.endLine + from
        }));
    }

    /**
     * Get the range of visible lines in the editor viewport
     */
    private getVisibleLineRange(): { from: number; to: number } {
        if (!this.activeEditor || !this.activeView) {
            return { from: 0, to: 0 };
        }

        try {
            const scrollerEl = this.activeView.containerEl.querySelector('.cm-scroller') as HTMLElement;
            const contentEl = this.activeView.containerEl.querySelector('.cm-content') as HTMLElement;
            
            if (!scrollerEl || !contentEl) {
                this.logger.warn('Could not find CodeMirror elements for viewport calculation');
                return { from: 0, to: 0 };
            }

            // Calculate line height from actual elements
            const lineElements = contentEl.querySelectorAll('.cm-line');
            let lineHeight = 20; // Fallback
            
            if (lineElements.length > 0) {
                const firstLine = lineElements[0] as HTMLElement;
                lineHeight = firstLine.getBoundingClientRect().height;
            }

            // Get viewport information
            const scrollTop = scrollerEl.scrollTop;
            const viewportHeight = scrollerEl.clientHeight;
            const lineCount = this.activeEditor.lineCount();

            // Calculate visible line range with buffer
            const buffer = 5; // Lines to analyze beyond visible area for smooth scrolling
            const firstVisibleLine = Math.max(0, Math.floor(scrollTop / lineHeight) - buffer);
            const lastVisibleLine = Math.min(
                lineCount - 1,
                Math.ceil((scrollTop + viewportHeight) / lineHeight) + buffer
            );

            this.logger.debug(`Viewport: scroll=${scrollTop}, height=${viewportHeight}, lineHeight=${lineHeight}`);
            this.logger.debug(`Visible range: ${firstVisibleLine}-${lastVisibleLine} (buffer=${buffer})`);

            return {
                from: firstVisibleLine,
                to: lastVisibleLine
            };
        } catch (error) {
            this.logger.error('Failed to get visible line range:', error);
            return { from: 0, to: 0 };
        }
    }

    /**
     * Clear the line analysis cache
     */
    public clearAnalysisCache(): void {
        this.logger.debug('No margin prose cache to clear');
    }

    /**
     * Clear cache for a specific line (public method for external calls)
     */
    public clearLineCacheForLine(lineNumber: number): void {
        this.logger.debug(`No margin prose cache for line ${lineNumber}`);
    }

    /**
     * Filter opportunities based on intensity level and performance limits
     */
    private filterOpportunitiesByIntensity(opportunities: IndicatorOpportunity[]): IndicatorOpportunity[] {
        const confidenceThresholds = {
            'minimal': 0.8,
            'balanced': 0.6,
            'aggressive': 0.4,
            'off': 1.1 // Never show
        };
        
        const threshold = confidenceThresholds[this.intensityLevel];
        
        // Debug: Log opportunity details with line numbers
        this.logger.debug(`Intensity level: ${this.intensityLevel}, threshold: ${threshold}`);
        this.logger.debug(`Opportunity details:`, opportunities.map(o => `Line ${o.line}:${o.type}:${o.confidence}`));
        
        let filtered = opportunities.filter(opp => opp.confidence >= threshold);
        this.logger.debug(`After filtering: ${filtered.length} opportunities`);
        
        // Sort by confidence (highest first) and limit to max indicators
        filtered.sort((a, b) => b.confidence - a.confidence);
        
        if (filtered.length > this.MAX_INDICATORS) {
            this.logger.debug(`Limiting indicators from ${filtered.length} to ${this.MAX_INDICATORS} for performance`);
            filtered = filtered.slice(0, this.MAX_INDICATORS);
        }
        
        return filtered;
    }

    /**
     * Get margin column position for indicators
     */
    private getMarginColumn(): number {
        // Position indicators in the right margin
        // This will be adjusted based on editor width
        return 80; // Approximate character position for right margin
    }

    /**
     * Update visible indicators using CodeMirror decorations
     */
    private updateIndicators(opportunities: IndicatorOpportunity[]): void {
        // Store new opportunities
        this.currentOpportunities = opportunities;
        
        // Update indicators using CodeMirror manager
        if (this.indicatorManager) {
            this.logger.debug(`Updating ${opportunities.length} indicators via CodeMirror decorations`);
            this.indicatorManager.updateIndicators(opportunities);
        } else {
            this.logger.warn('CodeMirror indicator manager not available');
        }
    }



    /**
     * Set up CodeMirror indicator manager for current editor
     */
    private setupCodeMirrorManager(): void {
        if (!this.activeView) {
            this.indicatorManager = null;
            return;
        }

        try {
            // Get the CodeMirror EditorView from the Obsidian editor
            const editorWithCm = this.activeView.editor as { cm?: EditorView };
            const cm = editorWithCm.cm;
            if (cm) {
                this.indicatorManager = new CodeMirrorIndicatorManager(cm, this.plugin.indicatorStateField);
                this.logger.debug('Set up CodeMirror indicator manager');
            } else {
                this.logger.warn('Could not access CodeMirror EditorView');
                this.indicatorManager = null;
            }
        } catch (error) {
            this.logger.error('Failed to set up CodeMirror manager:', error);
            this.indicatorManager = null;
        }
    }

    /**
     * Handle indicator click events from CodeMirror decorations
     */
    private onIndicatorClick(opportunity: IndicatorOpportunity, clickedElement: HTMLElement): void {
        this.logger.info(`Clicked indicator: ${opportunity.type} with ${opportunity.commands.length} commands`);

        if (!this.activeView) {
            this.logger.warn('No active view available for InsightPanel');
            return;
        }

        // Check if this is a fill opportunity (marker-based)
        const isFillOpportunity = opportunity.icon === '📝' || !!opportunity.fillInstruction;

        if (isFillOpportunity) {
            // Execute fill for just this specific marker
            this.logger.info(`Executing fill for single marker at line ${opportunity.line + 1}`);
            void this.plugin.executeFillSingleWithProcessingState(opportunity.line, opportunity.fillInstruction);
            return;
        }

        // Show InsightPanel with full intelligence for other opportunities
        const hasCommands = opportunity.commands.length > 0;

        if (hasCommands) {
            this.insightPanel.showPanel(opportunity, clickedElement, this.activeView);
        } else {
            this.logger.warn(`No commands or issues available for ${opportunity.type} opportunity`);
        }
    }





    /**
     * Hide all indicators using CodeMirror decorations
     */
    private hideAllIndicators(): void {
        if (this.indicatorManager) {
            this.indicatorManager.clearIndicators();
            this.logger.debug('Cleared all indicators via CodeMirror');
        }
    }

    /**
     * Show all indicators using CodeMirror decorations
     */
    private showAllIndicators(): void {
        if (this.indicatorManager && this.currentOpportunities.length > 0) {
            this.indicatorManager.updateIndicators(this.currentOpportunities);
            this.logger.debug('Restored all indicators via CodeMirror');
        }
    }


    /**
     * Clear all indicators using CodeMirror decorations
     */
    public clearIndicators(): void {
        if (this.indicatorManager) {
            this.indicatorManager.clearIndicators();
        }
        this.currentOpportunities = [];
    }

    /**
     * Update settings from plugin configuration
     */
    updateSettings(): void {
        const commands = this.plugin.settings.commands;
        if (commands) {
            this.intensityLevel = commands.suggestionMode;
            this.enabled = commands.suggestionMode !== 'off';
            
            this.logger.debug(`Settings updated: intensityLevel=${this.intensityLevel}, enabled=${this.enabled}`);
            
            // If disabled, clear all indicators
            if (!this.enabled) {
                this.clearIndicators();
            }
        } else {
            // Fallback to defaults
            this.logger.warn('No commands settings found, using defaults');
            this.intensityLevel = 'balanced';
            this.enabled = true;
        }
    }

    /**
     * Clean up current editor listeners and indicators
     */
    private cleanupCurrentEditor(): void {
        if (this.pendingIndicatorAnalysisTimeout !== null) {
            this.timeoutManager.removeTimeout(this.pendingIndicatorAnalysisTimeout);
            this.pendingIndicatorAnalysisTimeout = null;
        }
        this.clearIndicators();
        this.clearAnalysisCache();
        this.indicatorManager = null;
    }

    /**
     * Enable or disable the indicator system
     */
    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
        
        if (enabled) {
            this.onActiveEditorChange();
        } else {
            this.cleanupCurrentEditor();
        }
        
        this.logger.info(`MarginIndicators ${enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * Set intensity level
     */
    setIntensityLevel(level: 'off' | 'minimal' | 'balanced' | 'aggressive'): void {
        this.intensityLevel = level;
        
        if (level === 'off') {
            this.setEnabled(false);
        } else {
            this.setEnabled(true);
            void this.analyzeCurrentContext(); // Re-analyze with new intensity
        }
        
        this.logger.info(`MarginIndicators intensity set to: ${level}`);
    }

    /**
     * Get current opportunities (for debugging)
     */
    getCurrentOpportunities(): IndicatorOpportunity[] {
        return [...this.currentOpportunities];
    }

    /**
     * Cleanup method for plugin unload
     */
    cleanup(): void {
        this.cleanupCurrentEditor();
        this.timeoutManager.clearAll();
        this.insightPanel.cleanup();
        this.activeEditor = null;
        this.activeView = null;
        this.logger.info('MarginIndicators cleaned up');
    }
}
