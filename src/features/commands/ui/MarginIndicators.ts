/**
 * MarginIndicators - Intelligent margin indicators for command suggestions
 * Shows contextual command hints in the editor margin with progressive disclosure
 * Now supports `<!-- nova: instruction -->` markers for the /fill command
 */

import { MarkdownView, Editor } from 'obsidian';
import { EditorView } from '@codemirror/view';
import { Logger } from '../../../utils/logger';
import { TimeoutManager } from '../../../utils/timeout-manager';
import { SmartVariableResolver } from '../core/SmartVariableResolver';
import { CommandEngine, MarkerInsight } from '../core/CommandEngine';
import { SmartTimingEngine } from '../core/SmartTimingEngine';
import { InsightPanel } from './InsightPanel';
import { CodeMirrorIndicatorManager } from './codemirror-decorations';
import type { SmartContext, MarkdownCommand, TimingDecision, TypingMetrics } from '../types';
import type NovaPlugin from '../../../../main';

interface SpecificIssue {
    matchedText: string;
    startIndex: number;
    endIndex: number;
    description: string;
    suggestedFix?: string;
}

interface IndicatorOpportunity {
    line: number;
    column: number;
    type: 'enhancement' | 'quickfix' | 'metrics' | 'transform';
    icon: string;
    commands: MarkdownCommand[];
    confidence: number;
    // Enhanced context for specific fixes
    specificIssues?: SpecificIssue[];
    issueCount?: number;
}

export class MarginIndicators {
    private plugin: NovaPlugin;
    private variableResolver: SmartVariableResolver;
    private commandEngine: CommandEngine;
    private smartTimingEngine: SmartTimingEngine;
    public insightPanel: InsightPanel;
    private logger = Logger.scope('MarginIndicators');
    private timeoutManager = new TimeoutManager();

    // Component state
    private activeEditor: Editor | null = null;
    private activeView: MarkdownView | null = null;
    private indicatorManager: CodeMirrorIndicatorManager | null = null;
    private currentOpportunities: IndicatorOpportunity[] = [];

    // Performance optimization - line-level caching
    private lineAnalysisCache = new Map<number, { hash: string; opportunities: IndicatorOpportunity[] }>();
    private documentHash = '';

    // Settings
    private enabled = true;
    private intensityLevel: 'off' | 'minimal' | 'balanced' | 'aggressive' = 'balanced';

    // Performance limits
    private readonly MAX_INDICATORS = 20; // Maximum indicators to show at once

    constructor(
        plugin: NovaPlugin,
        variableResolver: SmartVariableResolver,
        commandEngine: CommandEngine,
        smartTimingEngine: SmartTimingEngine
    ) {
        this.plugin = plugin;
        this.variableResolver = variableResolver;
        this.commandEngine = commandEngine;
        this.smartTimingEngine = smartTimingEngine;
        this.insightPanel = new InsightPanel(plugin, commandEngine);

        // Initialize settings from plugin configuration
        this.updateSettings();
    }

    /**
     * Initialize the margin indicators system
     */
    init(): void {
        this.logger.info('Initializing MarginIndicators');

        // Set up SmartTimingEngine subscriptions
        this.setupTimingEventListeners();

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

        // Initialize with current active editor
        this.onActiveEditorChange();

        this.logger.info('MarginIndicators initialized');
    }

    /**
     * Set up SmartTimingEngine event listeners
     */
    private setupTimingEventListeners(): void {
        // Subscribe to timing decisions
        this.smartTimingEngine.on('timing-decision', (decision: TimingDecision) => {
            if (decision.shouldShow) {
                this.logger.debug(`Timing decision: ${decision.reason}`);
                if (decision.nextCheckDelay && decision.nextCheckDelay > 0) {
                    // Decision indicates we should schedule analysis
                    // The SmartTimingEngine handles the scheduling
                } else {
                    // Immediate analysis requested (e.g., after scroll)
                    void this.analyzeCurrentContext();
                }
            } else {
                this.logger.debug(`Timing decision to hide: ${decision.reason}`);
                this.hideAllIndicators();
            }
        });

        // Subscribe to typing metrics for logging/debugging
        this.smartTimingEngine.on('typing-metrics-updated', (metrics: TypingMetrics) => {
            this.logger.debug(`Typing metrics: ${metrics.currentWPM.toFixed(1)} WPM, fast: ${metrics.isTypingFast}`);
        });

        // Subscribe to analysis scheduling events
        this.smartTimingEngine.on('analysis-scheduled', (delay: number) => {
            this.logger.debug(`Analysis scheduled in ${delay}ms`);
            // Schedule our actual analysis to run after the delay
            this.timeoutManager.addTimeout(() => {
                void this.analyzeCurrentContext();
            }, delay);
        });
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
        
        if (editorEl) {
            this.plugin.registerDomEvent(
                editorEl,
                'input',
                () => this.onEditorInput()
            );

            // Listen for cursor position changes
            this.plugin.registerDomEvent(
                editorEl,
                'click',
                () => this.analyzeCurrentContext() // Immediate analysis on cursor change
            );
        }

        // Listen for scroll events (to re-analyze visible content)
        if (scrollerEl) {
            this.plugin.registerDomEvent(
                scrollerEl,
                'scroll',
                () => this.onScroll()
            );
        }
    }

    /**
     * Handle editor input events
     */
    private onEditorInput(): void {
        // Clear cache when document changes
        this.clearAnalysisCache();

        // Update document type for context-aware timing
        if (this.activeView?.file) {
            const context = this.variableResolver.buildSmartContext();
            if (context) {
                this.smartTimingEngine.setDocumentType(context.documentType);
            }
        }

        // Delegate timing decisions to SmartTimingEngine
        this.smartTimingEngine.onEditorInput();
    }

    /**
     * Handle scroll events with debouncing
     */
    private onScroll(): void {
        // Delegate scroll timing decisions to SmartTimingEngine
        this.smartTimingEngine.onScroll();
    }


    /**
     * Analyze current context and show relevant indicators
     */
    public analyzeCurrentContext(): void {
        if (!this.activeEditor || !this.enabled) return;

        try {
            this.logger.debug('Analyzing context for margin indicators...');

            // Build smart context
            const context = this.variableResolver.buildSmartContext();
            if (!context) {
                this.logger.warn('No smart context available');
                return;
            }

            // Update SmartTimingEngine with current document type for context-aware timing
            this.smartTimingEngine.setDocumentType(context.documentType);

            this.logger.debug('Smart context built:', {
                hasSelection: !!context.selection,
                documentType: context.documentType,
                wordCount: context.metrics.wordCount
            });

            // Get current line for analysis
            const cursor = this.activeEditor.getCursor();
            const currentLine = this.activeEditor.getLine(cursor.line);
            this.logger.debug(`Analyzing line ${cursor.line}: "${currentLine}"`);

            // Find opportunities (including markers)
            const opportunities = this.findOpportunities(context);
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
    private findOpportunities(context: SmartContext): IndicatorOpportunity[] {
        const opportunities: IndicatorOpportunity[] = [];

        // Get visible lines range
        const visibleRange = this.getVisibleLineRange();
        this.logger.debug(`Analyzing lines ${visibleRange.from} to ${visibleRange.to}`);

        // First, detect any markers in the document (if both features are enabled)
        // Fill markers require BOTH margin indicators AND Smart Fill to be enabled
        const smartFillEnabled = this.plugin.featureManager?.isFeatureEnabled('commands') ?? true;

        if (this.enabled && smartFillEnabled) {
            const documentContent = context.document;
            const markers = this.commandEngine.detectMarkers(documentContent);

            // Add marker-based opportunities (show regardless of visible range when enabled)
            // Fill markers are explicit user-placed markers that need to be clickable
            for (const marker of markers) {
                opportunities.push({
                    line: marker.line,
                    column: this.getMarginColumn(),
                    type: 'enhancement',
                    icon: '📝',
                    commands: [], // No commands needed - markers use /fill
                    confidence: 1.0, // High confidence for explicit markers
                    specificIssues: [{
                        matchedText: `<!-- nova: ${marker.instruction.substring(0, 30)}${marker.instruction.length > 30 ? '...' : ''} -->`,
                        startIndex: marker.position,
                        endIndex: marker.position + marker.length,
                        description: marker.instruction,
                        suggestedFix: 'Use /fill to generate content'
                    }],
                    issueCount: 1
                });
            }
        }

        // Analyze each visible line for writing quality issues (with caching)
        for (let lineNumber = visibleRange.from; lineNumber <= visibleRange.to; lineNumber++) {
            const lineText = this.activeEditor!.getLine(lineNumber);
            if (!lineText || lineText.trim().length === 0) continue;

            // Skip lines that are markers (already handled above)
            if (lineText.match(/<!--\s*nova:/i)) continue;

            // Check cache first
            const lineHash = this.hashLine(lineText);
            const cached = this.lineAnalysisCache.get(lineNumber);

            if (cached && cached.hash === lineHash) {
                // Use cached results
                opportunities.push(...cached.opportunities);
                continue;
            }

            // Analyze line and cache results
            const lineOpportunities: IndicatorOpportunity[] = [];

            // Quick fix opportunities (⚡) - Writing quality issues
            const quickFixIssues = this.findQuickFixIssues(context, lineText);
            if (quickFixIssues.length > 0) {
                const issueCount = quickFixIssues.length;

                lineOpportunities.push({
                    line: lineNumber,
                    column: this.getMarginColumn(),
                    type: 'quickfix',
                    icon: '⚡',
                    commands: [], // Commands are embedded in specificIssues
                    confidence: this.calculateConfidence(context, 'quickfix'),
                    specificIssues: quickFixIssues,
                    issueCount
                });
            }

            // Transformation opportunities (✨) - "show don't tell"
            if (this.shouldShowTransformIndicators(context, lineText)) {
                lineOpportunities.push({
                    line: lineNumber,
                    column: this.getMarginColumn(),
                    type: 'transform',
                    icon: '✨',
                    commands: [],
                    confidence: this.calculateConfidence(context, 'transform')
                });
            }

            // Cache the results
            this.lineAnalysisCache.set(lineNumber, {
                hash: lineHash,
                opportunities: lineOpportunities
            });

            opportunities.push(...lineOpportunities);
        }

        // Filter by intensity level and confidence
        return this.filterOpportunitiesByIntensity(opportunities);
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
     * Generate a simple hash for a line of text
     */
    private hashLine(text: string): string {
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            const char = text.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString();
    }

    /**
     * Clear the line analysis cache
     */
    public clearAnalysisCache(): void {
        this.lineAnalysisCache.clear();
        this.logger.debug('Line analysis cache cleared');
    }

    /**
     * Clear cache for a specific line (public method for external calls)
     */
    public clearLineCacheForLine(lineNumber: number): void {
        this.lineAnalysisCache.delete(lineNumber);
        this.logger.debug(`Cleared cache for line ${lineNumber}`);
    }

    /**
     * Check if enhancement indicators should be shown
     */
    private shouldShowEnhancementIndicators(context: SmartContext, currentLine: string): boolean {
        const trimmed = currentLine.trim();
        
        // Skip headers
        if (trimmed.match(/^#+\s/)) return false;
        
        // Skip empty lines
        if (trimmed.length === 0) return false;
        
        // Show for bullet points that could be expanded
        if (trimmed.match(/^[-*+]\s+/)) return true;
        
        // Show for statements that could use stronger hooks
        if (currentLine.toLowerCase().includes('i think') || 
            currentLine.toLowerCase().includes('maybe') || 
            currentLine.toLowerCase().includes('perhaps')) return true;
        
        return false;
    }

    /**
     * Find specific quick fix issues on a line with their positions
     */
    private findQuickFixIssues(context: SmartContext, currentLine: string): SpecificIssue[] {
        const trimmed = currentLine.trim();
        const issues: SpecificIssue[] = [];
        
        // Skip headers and empty lines
        if (trimmed.match(/^#+\s/) || trimmed.length === 0) return issues;
        
        // Detect passive voice patterns with positions
        const passivePatterns = [
            { pattern: /\b(was|were)\s+(\w+ed)\b/g, type: 'passive', description: 'passive voice detected' },
            { pattern: /\b(was|were)\s+(written|taken|given|chosen|broken|spoken)\b/g, type: 'passive', description: 'passive voice detected' },
            { pattern: /\bmade\s+(by|throughout|during)\b/g, type: 'passive', description: 'passive construction' },
            { pattern: /\b(has|have)\s+been\s+(\w+ed)\b/g, type: 'passive', description: 'passive voice detected' },
            { pattern: /\b(has|have)\s+been\s+(written|taken|given|chosen|broken|spoken)\b/g, type: 'passive', description: 'passive voice detected' }
        ];
        
        // Find all passive voice instances
        passivePatterns.forEach(({ pattern, type, description }) => {
            let match;
            while ((match = pattern.exec(currentLine)) !== null) {
                const matchedText = match[0];
                const suggestedFix = this.getSuggestedFix(matchedText, type);
                
                issues.push({
                    matchedText,
                    startIndex: match.index,
                    endIndex: match.index + matchedText.length,
                    description: `${description}: '${matchedText}'`,
                    suggestedFix
                });
            }
        });
        
        // Detect weak words
        const weakWordPattern = /\b(very|really|quite|somewhat|rather)\b/gi;
        let match;
        while ((match = weakWordPattern.exec(currentLine)) !== null) {
            const matchedText = match[0];
            issues.push({
                matchedText,
                startIndex: match.index,
                endIndex: match.index + matchedText.length,
                description: `weak intensifier: '${matchedText}'`,
                suggestedFix: this.getSuggestedFix(matchedText, 'weak')
            });
        }
        
        return issues;
    }
    
    /**
     * Get suggested fix for specific text patterns
     */
    private getSuggestedFix(matchedText: string, issueType: string): string {
        const text = matchedText.toLowerCase();
        
        switch (issueType) {
            case 'passive':
                if (text.includes('was written')) return 'wrote';
                if (text.includes('were written')) return 'wrote';
                if (text.includes('was taken')) return 'took';
                if (text.includes('were taken')) return 'took';
                if (text.includes('was given')) return 'gave';
                if (text.includes('were given')) return 'gave';
                if (text.includes('was reviewed')) return 'reviewed';
                if (text.includes('were reviewed')) return 'reviewed';
                return 'use active voice';
                
            case 'weak':
                if (text === 'very') return 'remove or use stronger adjective';
                if (text === 'really') return 'remove or be specific';
                if (text === 'quite') return 'remove or be specific';
                if (text === 'somewhat') return 'be more specific';
                if (text === 'rather') return 'be more specific';
                return 'use stronger language';
                
            default:
                return 'improve';
        }
    }

    /**
     * Check if quick fix indicators should be shown (legacy method for backward compatibility)
     */
    private shouldShowQuickFixIndicators(context: SmartContext, currentLine: string): boolean {
        const issues = this.findQuickFixIssues(context, currentLine);
        return issues.length > 0;
    }

    /**
     * Check if metrics indicators should be shown
     */
    private shouldShowMetricsIndicators(context: SmartContext): boolean {
        // Show for documents over certain length
        return context.metrics.wordCount > 500;
    }

    /**
     * Check if transform indicators should be shown
     */
    private shouldShowTransformIndicators(context: SmartContext, currentLine: string): boolean {
        const trimmed = currentLine.trim();
        
        // Skip headers
        if (trimmed.match(/^#+\s/)) return false;
        
        // Skip empty lines
        if (trimmed.length === 0) return false;
        
        // Show for "telling" that could be "showing"
        if (currentLine.match(/\b(felt|thought|believed|knew|realized)\b/)) return true;
        
        return false;
    }

    /**
     * Calculate confidence score for an opportunity
     */
    private calculateConfidence(context: SmartContext, type: string): number {
        let confidence = 0.7; // Base confidence (raised for testing/development)
        
        // Adjust based on document type
        if (context.documentType === 'academic' && type === 'enhancement') confidence += 0.2;
        if (context.documentType === 'blog' && type === 'quickfix') confidence += 0.3;
        
        // Adjust based on selection
        if (context.selection && context.selection.length > 10) confidence += 0.2;
        
        // Adjust based on cursor context quality
        if (context.cursorContext && context.cursorContext.length > 20) confidence += 0.1;
        
        return Math.min(1.0, confidence);
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

                // Set up event listener for indicator clicks
                this.plugin.registerDomEvent(document, 'nova-indicator-click' as keyof DocumentEventMap, (event: Event) => {
                    const customEvent = event as CustomEvent;
                    const { opportunity, element } = customEvent.detail;
                    this.onIndicatorClick(opportunity, element);
                });
                
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
        const isFillOpportunity = opportunity.icon === '📝' ||
            opportunity.specificIssues?.some(issue => issue.suggestedFix?.includes('/fill'));

        if (isFillOpportunity) {
            // Execute fill for just this specific marker
            this.logger.info(`Executing fill for single marker at line ${opportunity.line + 1}`);
            const instruction = opportunity.specificIssues?.[0]?.description;
            void this.commandEngine.executeFillSingle(opportunity.line, instruction);
            return;
        }

        // Show InsightPanel with full intelligence for other opportunities
        // For quickfix opportunities, the commands are in specificIssues, not commands array
        const hasCommands = opportunity.commands.length > 0;
        const hasSpecificIssues = (opportunity.specificIssues?.length ?? 0) > 0;

        if (hasCommands || hasSpecificIssues) {
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
        this.clearIndicators();
        this.clearAnalysisCache();
        this.indicatorManager = null;
        
        // Timer cleanup is now handled by SmartTimingEngine
        this.smartTimingEngine.cancelPendingAnalysis();
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
        this.smartTimingEngine.cleanup();
        this.activeEditor = null;
        this.activeView = null;
        this.logger.info('MarginIndicators cleaned up');
    }
}