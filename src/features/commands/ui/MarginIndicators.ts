/**
 * MarginIndicators - Intelligent margin indicators for command suggestions
 * Shows contextual command hints in the editor margin with progressive disclosure
 */

import { MarkdownView, Editor } from 'obsidian';
import { Logger } from '../../../utils/logger';
import { SmartVariableResolver } from '../core/SmartVariableResolver';
import { CommandRegistry } from '../core/CommandRegistry';
import type { SmartContext, MarkdownCommand } from '../types';
import type NovaPlugin from '../../../../main';

interface IndicatorOpportunity {
    line: number;
    column: number;
    type: 'enhancement' | 'quickfix' | 'metrics' | 'transform';
    icon: string;
    commands: MarkdownCommand[];
    confidence: number;
}

export class MarginIndicators {
    private plugin: NovaPlugin;
    private variableResolver: SmartVariableResolver;
    private commandRegistry: CommandRegistry;
    private logger = Logger.scope('MarginIndicators');

    // Component state
    private activeEditor: Editor | null = null;
    private activeView: MarkdownView | null = null;
    private indicators = new Map<string, HTMLElement>();
    private currentOpportunities: IndicatorOpportunity[] = [];
    
    // Timing and performance
    private lastAnalysisTime = 0;
    private analysisDebounceTimer: number | null = null;
    private readonly ANALYSIS_DEBOUNCE = 3000; // 3 seconds as per spec
    private readonly MIN_ANALYSIS_INTERVAL = 1000; // Minimum 1 second between analyses
    
    // User activity tracking
    private typingSpeed = 0;
    private lastKeystrokeTime = 0;
    private keystrokeCount = 0;
    private readonly TYPING_SPEED_WINDOW = 60000; // 1 minute window
    private readonly FAST_TYPING_THRESHOLD = 30; // WPM

    // Settings
    private enabled = true;
    private intensityLevel: 'off' | 'minimal' | 'balanced' | 'aggressive' = 'balanced';

    constructor(
        plugin: NovaPlugin,
        variableResolver: SmartVariableResolver,
        commandRegistry: CommandRegistry
    ) {
        this.plugin = plugin;
        this.variableResolver = variableResolver;
        this.commandRegistry = commandRegistry;
    }

    /**
     * Initialize the margin indicators system
     */
    async init(): Promise<void> {
        this.logger.info('Initializing MarginIndicators');
        
        // Ensure command index is built
        await this.commandRegistry.buildIndex();
        this.logger.info('Command index built');
        
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
     * Handle active editor changes
     */
    private onActiveEditorChange(): void {
        // Clean up previous editor
        this.cleanupCurrentEditor();

        // Get new active editor
        const activeView = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView || !activeView.editor) {
            this.activeEditor = null;
            this.activeView = null;
            return;
        }

        this.activeView = activeView;
        this.activeEditor = activeView.editor;
        
        if (this.enabled) {
            this.setupEditorListeners();
            this.scheduleAnalysis();
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
                () => this.scheduleAnalysis()
            );
        }

        // Listen for scroll events (to update indicator positions)
        if (scrollerEl) {
            this.plugin.registerDomEvent(
                scrollerEl,
                'scroll',
                () => this.updateIndicatorPositions()
            );
        }
    }

    /**
     * Handle editor input events
     */
    private onEditorInput(): void {
        // Track typing speed
        this.updateTypingSpeed();

        // If typing too fast, hide indicators
        if (this.typingSpeed > this.FAST_TYPING_THRESHOLD) {
            this.hideAllIndicators();
            return;
        }

        // Schedule analysis after typing stops
        this.scheduleAnalysis();
    }

    /**
     * Update typing speed calculation
     */
    private updateTypingSpeed(): void {
        const now = Date.now();
        
        // Reset if too much time has passed
        if (now - this.lastKeystrokeTime > this.TYPING_SPEED_WINDOW) {
            this.keystrokeCount = 0;
        }

        this.keystrokeCount++;
        this.lastKeystrokeTime = now;

        // Calculate WPM (assuming 5 characters per word)
        const timeMinutes = Math.min(this.TYPING_SPEED_WINDOW, now - (this.lastKeystrokeTime - this.TYPING_SPEED_WINDOW)) / 60000;
        this.typingSpeed = timeMinutes > 0 ? (this.keystrokeCount / 5) / timeMinutes : 0;
    }

    /**
     * Schedule analysis with debouncing
     */
    private scheduleAnalysis(): void {
        // Clear existing timer
        if (this.analysisDebounceTimer) {
            clearTimeout(this.analysisDebounceTimer);
        }

        // Don't analyze too frequently
        const now = Date.now();
        if (now - this.lastAnalysisTime < this.MIN_ANALYSIS_INTERVAL) {
            return;
        }

        // Schedule new analysis
        this.analysisDebounceTimer = window.setTimeout(() => {
            this.analyzeCurrentContext();
        }, this.ANALYSIS_DEBOUNCE);
    }

    /**
     * Analyze current context and show relevant indicators
     */
    private async analyzeCurrentContext(): Promise<void> {
        if (!this.activeEditor || !this.enabled) return;

        try {
            this.lastAnalysisTime = Date.now();
            this.logger.info('Analyzing context for margin indicators...');
            
            // Build smart context
            const context = await this.variableResolver.buildSmartContext();
            if (!context) {
                this.logger.warn('No smart context available');
                return;
            }

            this.logger.info('Smart context built:', {
                hasSelection: !!context.selection,
                documentType: context.documentType,
                wordCount: context.metrics.wordCount
            });

            // Get current line for analysis
            const cursor = this.activeEditor!.getCursor();
            const currentLine = this.activeEditor!.getLine(cursor.line);
            this.logger.info(`Analyzing line ${cursor.line}: "${currentLine}"`);

            // Find opportunities
            const opportunities = await this.findOpportunities(context);
            this.logger.info(`Found ${opportunities.length} opportunities:`, opportunities.map(o => `${o.type} (${o.confidence})`));
            
            // Update indicators
            this.updateIndicators(opportunities);
            
        } catch (error) {
            this.logger.error('Failed to analyze context for indicators:', error);
        }
    }

    /**
     * Find command opportunities based on context
     */
    private async findOpportunities(context: SmartContext): Promise<IndicatorOpportunity[]> {
        const opportunities: IndicatorOpportunity[] = [];
        
        // Get cursor position for line-based analysis
        const cursor = this.activeEditor!.getCursor();
        const currentLine = this.activeEditor!.getLine(cursor.line);
        
        // Enhancement opportunities (💡)
        const showEnhancement = this.shouldShowEnhancementIndicators(context, currentLine);
        this.logger.debug(`Enhancement check: ${showEnhancement} for line: "${currentLine}"`);
        if (showEnhancement) {
            const enhancementCommands = await this.getCommandsByCategory('enhancement');
            this.logger.debug(`Enhancement commands found: ${enhancementCommands.length}`);
            if (enhancementCommands.length > 0) {
                opportunities.push({
                    line: cursor.line,
                    column: this.getMarginColumn(),
                    type: 'enhancement',
                    icon: '💡',
                    commands: enhancementCommands.slice(0, 3),
                    confidence: this.calculateConfidence(context, 'enhancement')
                });
            }
        }

        // Quick fix opportunities (⚡)
        if (this.shouldShowQuickFixIndicators(context, currentLine)) {
            const quickFixCommands = await this.getCommandsByCategory('quickfix');
            if (quickFixCommands.length > 0) {
                opportunities.push({
                    line: cursor.line,
                    column: this.getMarginColumn(),
                    type: 'quickfix',
                    icon: '⚡',
                    commands: quickFixCommands.slice(0, 2),
                    confidence: this.calculateConfidence(context, 'quickfix')
                });
            }
        }

        // Metrics opportunities (📊)
        if (this.shouldShowMetricsIndicators(context)) {
            const metricsCommands = await this.getCommandsByCategory('analysis');
            if (metricsCommands.length > 0) {
                opportunities.push({
                    line: Math.max(0, cursor.line - 2),
                    column: this.getMarginColumn(),
                    type: 'metrics',
                    icon: '📊',
                    commands: metricsCommands.slice(0, 2),
                    confidence: this.calculateConfidence(context, 'metrics')
                });
            }
        }

        // Transformation opportunities (✨)
        if (this.shouldShowTransformIndicators(context, currentLine)) {
            const transformCommands = await this.getCommandsByCategory('transform');
            if (transformCommands.length > 0) {
                opportunities.push({
                    line: cursor.line,
                    column: this.getMarginColumn(),
                    type: 'transform',
                    icon: '✨',
                    commands: transformCommands.slice(0, 3),
                    confidence: this.calculateConfidence(context, 'transform')
                });
            }
        }

        // Filter by intensity level and confidence
        return this.filterOpportunitiesByIntensity(opportunities);
    }

    /**
     * Check if enhancement indicators should be shown
     */
    private shouldShowEnhancementIndicators(context: SmartContext, currentLine: string): boolean {
        // Show for bullet points that could be expanded
        if (currentLine.trim().match(/^[-*+]\s+/)) return true;
        
        // Show for short paragraphs that could use examples
        if (currentLine.length > 20 && currentLine.length < 100 && !currentLine.includes('example')) return true;
        
        // Show for statements that could use stronger hooks
        if (currentLine.includes('I think') || currentLine.includes('maybe') || currentLine.includes('perhaps')) return true;
        
        return false;
    }

    /**
     * Check if quick fix indicators should be shown
     */
    private shouldShowQuickFixIndicators(context: SmartContext, currentLine: string): boolean {
        // Show for passive voice
        if (currentLine.match(/\b(was|were|is|are|been)\s+\w+ed\b/)) return true;
        
        // Show for weak words
        if (currentLine.match(/\b(very|really|quite|somewhat|rather)\b/i)) return true;
        
        // Show for unclear references
        if (currentLine.match(/\b(this|that|it|they)\b/) && !context.selection) return true;
        
        return false;
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
        // Show for academic writing that could use different perspectives
        if (context.documentType === 'academic' && currentLine.length > 50) return true;
        
        // Show for "telling" that could be "showing"
        if (currentLine.match(/\b(felt|thought|believed|knew|realized)\b/)) return true;
        
        return false;
    }

    /**
     * Get commands by category from registry
     */
    private async getCommandsByCategory(category: string): Promise<MarkdownCommand[]> {
        try {
            // Map our indicator categories to command categories
            const categoryMap: Record<string, string> = {
                'enhancement': 'writing',
                'quickfix': 'editing',
                'analysis': 'analysis',
                'transform': 'transformation'
            };
            
            const commandCategory = categoryMap[category] || 'writing';
            return await this.commandRegistry.getCommandsByCategory(commandCategory);
        } catch (error) {
            this.logger.error(`Failed to get commands for category ${category}:`, error);
            return [];
        }
    }

    /**
     * Calculate confidence score for an opportunity
     */
    private calculateConfidence(context: SmartContext, type: string): number {
        let confidence = 0.5; // Base confidence
        
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
     * Filter opportunities based on intensity level
     */
    private filterOpportunitiesByIntensity(opportunities: IndicatorOpportunity[]): IndicatorOpportunity[] {
        const confidenceThresholds = {
            'minimal': 0.8,
            'balanced': 0.6,
            'aggressive': 0.4,
            'off': 1.1 // Never show
        };
        
        const threshold = confidenceThresholds[this.intensityLevel];
        return opportunities.filter(opp => opp.confidence >= threshold);
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
     * Update visible indicators
     */
    private updateIndicators(opportunities: IndicatorOpportunity[]): void {
        // Clear existing indicators
        this.clearIndicators();
        
        // Store new opportunities
        this.currentOpportunities = opportunities;
        
        // Create new indicators
        for (const opportunity of opportunities) {
            this.createIndicator(opportunity);
        }
    }

    /**
     * Create a visual indicator
     */
    private createIndicator(opportunity: IndicatorOpportunity): void {
        if (!this.activeView) return;

        const indicator = this.activeView.containerEl.createDiv({
            cls: `nova-margin-indicator nova-margin-indicator-${opportunity.type}`
        });
        
        indicator.textContent = opportunity.icon;
        indicator.setAttribute('data-type', opportunity.type);
        indicator.setAttribute('data-line', opportunity.line.toString());
        
        // Position the indicator
        this.positionIndicator(indicator, opportunity);
        
        // Add hover events
        this.plugin.registerDomEvent(indicator, 'mouseenter', () => {
            this.onIndicatorHover(indicator, opportunity);
        });
        
        this.plugin.registerDomEvent(indicator, 'mouseleave', () => {
            this.onIndicatorLeave(indicator);
        });
        
        this.plugin.registerDomEvent(indicator, 'click', () => {
            this.onIndicatorClick(opportunity);
        });
        
        // Store reference
        const key = `${opportunity.line}-${opportunity.type}`;
        this.indicators.set(key, indicator);
    }

    /**
     * Position an indicator in the margin
     */
    private positionIndicator(indicator: HTMLElement, opportunity: IndicatorOpportunity): void {
        if (!this.activeEditor) return;

        // Get editor dimensions and line height
        const editorEl = this.activeView!.containerEl.querySelector('.cm-editor') as HTMLElement;
        if (!editorEl) return;

        const lineHeight = 20; // Approximate line height
        const topOffset = opportunity.line * lineHeight;
        
        // Position in right margin
        indicator.style.position = 'absolute';
        indicator.style.top = `${topOffset}px`;
        indicator.style.right = '20px';
        indicator.style.fontSize = '14px';
        indicator.style.opacity = '0.4';
        indicator.style.cursor = 'pointer';
        indicator.style.zIndex = '100';
        indicator.style.transition = 'opacity 0.2s ease';
        indicator.style.userSelect = 'none';
    }

    /**
     * Handle indicator hover
     */
    private onIndicatorHover(indicator: HTMLElement, opportunity: IndicatorOpportunity): void {
        // Increase opacity on hover
        indicator.style.opacity = '0.8';
        
        // Future: Show preview tooltip (will be implemented with hover preview system)
        this.logger.debug(`Hovered indicator: ${opportunity.type} at line ${opportunity.line}`);
    }

    /**
     * Handle indicator leave
     */
    private onIndicatorLeave(indicator: HTMLElement): void {
        indicator.style.opacity = '0.4';
    }

    /**
     * Handle indicator click
     */
    private onIndicatorClick(opportunity: IndicatorOpportunity): void {
        this.logger.info(`Clicked indicator: ${opportunity.type} with ${opportunity.commands.length} commands`);
        
        // Future: Open InsightPanel with command options
        // For now, just log the available commands
        for (const command of opportunity.commands) {
            this.logger.debug(`Available command: ${command.name} - ${command.description}`);
        }
    }

    /**
     * Update indicator positions (for scroll events)
     */
    private updateIndicatorPositions(): void {
        // Future: Update positions when editor scrolls
        // For now, this is a placeholder
    }

    /**
     * Hide all indicators
     */
    private hideAllIndicators(): void {
        for (const indicator of this.indicators.values()) {
            indicator.style.display = 'none';
        }
    }

    /**
     * Show all indicators
     */
    private showAllIndicators(): void {
        for (const indicator of this.indicators.values()) {
            indicator.style.display = 'block';
        }
    }

    /**
     * Clear all indicators
     */
    private clearIndicators(): void {
        for (const indicator of this.indicators.values()) {
            indicator.remove();
        }
        this.indicators.clear();
    }

    /**
     * Clean up current editor listeners and indicators
     */
    private cleanupCurrentEditor(): void {
        this.clearIndicators();
        this.currentOpportunities = [];
        
        if (this.analysisDebounceTimer) {
            clearTimeout(this.analysisDebounceTimer);
            this.analysisDebounceTimer = null;
        }
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
            this.scheduleAnalysis(); // Re-analyze with new intensity
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
        this.activeEditor = null;
        this.activeView = null;
        this.logger.info('MarginIndicators cleaned up');
    }
}