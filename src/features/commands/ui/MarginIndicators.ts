/**
 * MarginIndicators - Intelligent margin indicators for command suggestions
 * Shows contextual command hints in the editor margin with progressive disclosure
 */

import { MarkdownView, Editor } from 'obsidian';
import { Logger } from '../../../utils/logger';
import { SmartVariableResolver } from '../core/SmartVariableResolver';
import { CommandRegistry } from '../core/CommandRegistry';
import { CommandEngine } from '../core/CommandEngine';
import { InsightPanel } from './InsightPanel';
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
    private commandEngine: CommandEngine;
    public insightPanel: InsightPanel;
    private logger = Logger.scope('MarginIndicators');

    // Component state
    private activeEditor: Editor | null = null;
    private activeView: MarkdownView | null = null;
    private indicators = new Map<string, HTMLElement>();
    private currentOpportunities: IndicatorOpportunity[] = [];
    
    // Performance optimization - line-level caching
    private lineAnalysisCache = new Map<number, { hash: string; opportunities: IndicatorOpportunity[] }>();
    private documentHash = '';
    
    // Timing and performance
    private lastAnalysisTime = 0;
    private analysisDebounceTimer: number | null = null;
    private scrollDebounceTimer: number | null = null;
    private readonly ANALYSIS_DEBOUNCE = 3000; // 3 seconds as per spec
    private readonly SCROLL_DEBOUNCE = 100; // 100ms for scroll events
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
    
    // Performance limits
    private readonly MAX_INDICATORS = 20; // Maximum indicators to show at once

    constructor(
        plugin: NovaPlugin,
        variableResolver: SmartVariableResolver,
        commandRegistry: CommandRegistry,
        commandEngine: CommandEngine
    ) {
        this.plugin = plugin;
        this.variableResolver = variableResolver;
        this.commandRegistry = commandRegistry;
        this.commandEngine = commandEngine;
        this.insightPanel = new InsightPanel(plugin, commandEngine);
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
    private async onActiveEditorChange(): Promise<void> {
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
        // Track typing speed
        this.updateTypingSpeed();

        // Clear cache when document changes
        this.clearAnalysisCache();

        // If typing too fast, hide indicators
        if (this.typingSpeed > this.FAST_TYPING_THRESHOLD) {
            this.hideAllIndicators();
            return;
        }

        // Schedule analysis after typing stops
        this.scheduleAnalysis();
    }

    /**
     * Handle scroll events with debouncing
     */
    private onScroll(): void {
        // Clear existing scroll timer
        if (this.scrollDebounceTimer) {
            clearTimeout(this.scrollDebounceTimer);
        }

        // Schedule re-analysis after scroll stops
        this.scrollDebounceTimer = this.plugin.registerInterval(
            window.setTimeout(() => {
                this.scheduleAnalysis();
            }, this.SCROLL_DEBOUNCE)
        );
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
        this.analysisDebounceTimer = this.plugin.registerInterval(
            window.setTimeout(() => {
                this.analyzeCurrentContext();
            }, this.ANALYSIS_DEBOUNCE)
        );
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
            this.logger.info(`Found ${opportunities.length} opportunities:`, opportunities.map(o => `Line ${o.line}: ${o.type} (${o.confidence})`));
            
            // Debug: Log all available commands for each category
            const categoryChecks = ['enhancement', 'quickfix', 'analysis', 'transform'];
            for (const category of categoryChecks) {
                const commands = await this.getCommandsByCategory(category);
                this.logger.debug(`Commands available for ${category}: ${commands.length}`, commands.map(c => c.name));
            }
            
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
        
        // Get visible lines range
        const visibleRange = this.getVisibleLineRange();
        this.logger.debug(`Analyzing lines ${visibleRange.from} to ${visibleRange.to}`);
        
        
        // Pre-load all command categories for efficiency
        const [enhancementCommands, quickFixCommands, metricsCommands, transformCommands] = await Promise.all([
            this.getCommandsByCategory('enhancement'),
            this.getCommandsByCategory('quickfix'),
            this.getCommandsByCategory('analysis'),
            this.getCommandsByCategory('transform')
        ]);
        
        // Debug command availability
        this.logger.debug(`Commands available - Enhancement: ${enhancementCommands.length}, QuickFix: ${quickFixCommands.length}, Metrics: ${metricsCommands.length}, Transform: ${transformCommands.length}`);
        
        // Handle missing commands gracefully 
        // Note: When commands aren't loaded, we still want to show indicators for user feedback
        // but we should log this condition for debugging
        if (enhancementCommands.length === 0) this.logger.warn('No enhancement commands loaded from registry');
        if (quickFixCommands.length === 0) this.logger.warn('No quickfix commands loaded from registry');
        if (metricsCommands.length === 0) this.logger.warn('No metrics commands loaded from registry');
        if (transformCommands.length === 0) this.logger.warn('No transform commands loaded from registry');
        
        // Use the commands directly - the detection logic will handle empty arrays
        const activeEnhancementCommands = enhancementCommands;
        const activeQuickFixCommands = quickFixCommands;
        const activeMetricsCommands = metricsCommands;
        const activeTransformCommands = transformCommands;
        
        // Analyze each visible line (with caching)
        for (let lineNumber = visibleRange.from; lineNumber <= visibleRange.to; lineNumber++) {
            const lineText = this.activeEditor!.getLine(lineNumber);
            if (!lineText || lineText.trim().length === 0) continue;
            
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
            
            // Enhancement opportunities (💡)
            if (this.shouldShowEnhancementIndicators(context, lineText)) {
                lineOpportunities.push({
                    line: lineNumber,
                    column: this.getMarginColumn(),
                    type: 'enhancement',
                    icon: '💡',
                    commands: activeEnhancementCommands.slice(0, 3),
                    confidence: this.calculateConfidence(context, 'enhancement')
                });
            }

            // Quick fix opportunities (⚡)
            if (this.shouldShowQuickFixIndicators(context, lineText)) {
                lineOpportunities.push({
                    line: lineNumber,
                    column: this.getMarginColumn(),
                    type: 'quickfix',
                    icon: '⚡',
                    commands: activeQuickFixCommands.slice(0, 2),
                    confidence: this.calculateConfidence(context, 'quickfix')
                });
            }

            // Transformation opportunities (✨)
            if (this.shouldShowTransformIndicators(context, lineText)) {
                lineOpportunities.push({
                    line: lineNumber,
                    column: this.getMarginColumn(),
                    type: 'transform',
                    icon: '✨',
                    commands: activeTransformCommands.slice(0, 3),
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
        
        // Metrics opportunities (📊) - document-level, place at top
        if (this.shouldShowMetricsIndicators(context)) {
            opportunities.push({
                line: Math.max(0, visibleRange.from),
                column: this.getMarginColumn(),
                type: 'metrics',
                icon: '📊',
                commands: activeMetricsCommands.slice(0, 2),
                confidence: this.calculateConfidence(context, 'metrics')
            });
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
    private clearAnalysisCache(): void {
        this.lineAnalysisCache.clear();
        this.logger.debug('Line analysis cache cleared');
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
     * Check if quick fix indicators should be shown
     */
    private shouldShowQuickFixIndicators(context: SmartContext, currentLine: string): boolean {
        const trimmed = currentLine.trim();
        
        // Skip headers
        if (trimmed.match(/^#+\s/)) return false;
        
        // Skip empty lines
        if (trimmed.length === 0) return false;
        
        // Show for passive voice - improved patterns
        if (currentLine.match(/\b(was|were)\s+\w+ed\b/)) return true;
        if (currentLine.match(/\b(was|were)\s+(written|taken|given|chosen|broken|spoken)/)) return true;
        if (currentLine.match(/\bmade\s+(by|throughout|during)/)) return true;
        if (currentLine.match(/\b(has|have)\s+been\s+\w+ed\b/)) return true;
        if (currentLine.match(/\b(has|have)\s+been\s+(written|taken|given|chosen|broken|spoken)/)) return true;
        
        // Show for weak words
        if (currentLine.match(/\b(very|really|quite|somewhat|rather)\b/i)) return true;
        
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
     * Update visible indicators
     */
    private updateIndicators(opportunities: IndicatorOpportunity[]): void {
        // Clear existing indicators
        this.clearIndicators();
        
        // Store new opportunities
        this.currentOpportunities = opportunities;
        
        // Create new indicators
        this.logger.debug(`Creating ${opportunities.length} indicators`);
        for (const opportunity of opportunities) {
            this.logger.debug(`Creating indicator for line ${opportunity.line}:${opportunity.type}`);
            this.createIndicator(opportunity);
        }
    }

    /**
     * Create a visual indicator
     */
    private createIndicator(opportunity: IndicatorOpportunity): void {
        if (!this.activeView) return;

        // Find the appropriate container (CodeMirror scroller for proper positioning)
        const scrollerEl = this.activeView.containerEl.querySelector('.cm-scroller') as HTMLElement;
        if (!scrollerEl) {
            this.logger.warn('Could not find .cm-scroller for indicator creation');
            return;
        }

        // Validate positioning before creating the indicator
        if (!this.canPositionIndicator(opportunity)) {
            this.logger.debug(`Cannot position indicator for line ${opportunity.line}, skipping creation`);
            return;
        }

        const indicator = scrollerEl.createDiv({
            cls: `nova-margin-indicator nova-margin-indicator-${opportunity.type}`
        });
        
        indicator.textContent = opportunity.icon;
        indicator.setAttribute('data-type', opportunity.type);
        indicator.setAttribute('data-line', opportunity.line.toString());
        
        // Create hover preview element
        this.createHoverPreview(indicator, opportunity);
        
        // Position the indicator (should succeed since we validated above)
        this.positionIndicator(indicator, opportunity);
        
        // Add click event (hover is handled by CSS)
        this.plugin.registerDomEvent(indicator, 'click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.onIndicatorClick(opportunity, indicator);
        });
        
        // Store reference
        const key = `${opportunity.line}-${opportunity.type}`;
        this.indicators.set(key, indicator);
    }

    /**
     * Create hover preview for an indicator
     */
    private createHoverPreview(indicator: HTMLElement, opportunity: IndicatorOpportunity): void {
        // Only create preview if we have commands to show
        if (opportunity.commands.length === 0) {
            return;
        }

        // Get the primary command (first in the list)
        const primaryCommand = opportunity.commands[0];

        // Create preview container following the tooltip pattern
        const preview = indicator.createDiv({
            cls: 'nova-indicator-preview'
        });

        // Create command display
        const commandDiv = preview.createDiv({
            cls: 'nova-preview-command'
        });

        // Add command name
        const commandName = commandDiv.createSpan();
        commandName.textContent = primaryCommand.name;

        // Add description if available  
        if (primaryCommand.description) {
            const description = preview.createDiv({
                cls: 'nova-preview-description'
            });
            description.textContent = primaryCommand.description;
        }

        // Position preview relative to indicator
        this.positionPreview(preview, opportunity);
    }

    /**
     * Position hover preview relative to indicator
     */
    private positionPreview(preview: HTMLElement, _opportunity: IndicatorOpportunity): void {
        // Position to the left of the indicator to avoid covering text
        preview.style.right = '25px'; // Position left of indicator
        preview.style.top = '0px';    // Align with indicator top
        preview.style.transform = 'translateY(-50%)'; // Center vertically
    }

    /**
     * Check if an indicator can be positioned without creating it
     */
    private canPositionIndicator(opportunity: IndicatorOpportunity): boolean {
        if (!this.activeEditor || !this.activeView) return false;

        try {
            // Get the CodeMirror content area
            const contentEl = this.activeView.containerEl.querySelector('.cm-content') as HTMLElement;
            if (!contentEl) return false;

            // Get all line elements
            const lineElements = contentEl.querySelectorAll('.cm-line');
            
            // Calculate frontmatter offset
            const frontmatterOffset = this.calculateFrontmatterOffset();
            
            // Convert editor line number to DOM line index
            const domLineIndex = opportunity.line - frontmatterOffset;
            
            this.logger.debug(`Line ${opportunity.line}: frontmatter offset=${frontmatterOffset}, DOM index=${domLineIndex}, DOM lines available=${lineElements.length}`);
            
            // Validate the DOM line index
            const canPosition = domLineIndex >= 0 && domLineIndex < lineElements.length;
            if (!canPosition) {
                this.logger.debug(`Cannot position line ${opportunity.line}: DOM index ${domLineIndex} outside range 0-${lineElements.length-1}`);
            }
            return canPosition;
        } catch (error) {
            return false;
        }
    }

    /**
     * Position an indicator in the margin
     */
    private positionIndicator(indicator: HTMLElement, opportunity: IndicatorOpportunity): void {
        if (!this.activeEditor || !this.activeView) return;

        try {
            // Get the CodeMirror content area
            const contentEl = this.activeView.containerEl.querySelector('.cm-content') as HTMLElement;
            const scrollerEl = this.activeView.containerEl.querySelector('.cm-scroller') as HTMLElement;
            
            if (!contentEl || !scrollerEl) {
                this.logger.warn('Could not find CodeMirror elements for positioning');
                return;
            }

            // Get all line elements
            const lineElements = contentEl.querySelectorAll('.cm-line');
            
            // Calculate frontmatter offset
            // In Obsidian, frontmatter lines exist in the editor but not in the DOM
            const frontmatterOffset = this.calculateFrontmatterOffset();
            
            // Convert editor line number to DOM line index
            const domLineIndex = opportunity.line - frontmatterOffset;
            
            // Validate the DOM line index
            if (domLineIndex < 0 || domLineIndex >= lineElements.length) {
                this.logger.debug(`Line ${opportunity.line} (DOM index ${domLineIndex}) is outside visible range (0-${lineElements.length-1}), skipping indicator`);
                return;
            }
            
            const targetLineElement = lineElements[domLineIndex] as HTMLElement;
            
            // Get position relative to the scroller
            const lineRect = targetLineElement.getBoundingClientRect();
            const scrollerRect = scrollerEl.getBoundingClientRect();
            
            // Calculate position accounting for scroll
            const topOffset = lineRect.top - scrollerRect.top + scrollerEl.scrollTop;
            const rightOffset = 25; // Distance from right edge
            
            // Position the indicator (only dynamic positioning, CSS handles the rest)
            indicator.style.position = 'absolute';
            indicator.style.top = `${topOffset}px`;
            indicator.style.right = `${rightOffset}px`;
            
            this.logger.debug(`Positioned indicator for editor line ${opportunity.line} at DOM index ${domLineIndex}: top=${topOffset}px`);
            
        } catch (error) {
            this.logger.error('Failed to position indicator:', error);
        }
    }

    /**
     * Calculate how many lines of frontmatter exist
     * Frontmatter exists in the editor but not in the DOM
     */
    private calculateFrontmatterOffset(): number {
        if (!this.activeEditor) return 0;
        
        try {
            // Check if document starts with frontmatter delimiter
            const firstLine = this.activeEditor.getLine(0);
            if (firstLine !== '---') return 0;
            
            // Find the closing delimiter
            for (let i = 1; i < this.activeEditor.lineCount(); i++) {
                const line = this.activeEditor.getLine(i);
                if (line === '---') {
                    // Return the number of frontmatter lines (including delimiters)
                    return i + 1;
                }
            }
            
            // If no closing delimiter found, assume no frontmatter
            return 0;
        } catch (error) {
            this.logger.debug('Error calculating frontmatter offset:', error);
            return 0;
        }
    }


    /**
     * Handle indicator click
     */
    private onIndicatorClick(opportunity: IndicatorOpportunity, clickedIndicator: HTMLElement): void {
        this.logger.info(`Clicked indicator: ${opportunity.type} with ${opportunity.commands.length} commands`);
        
        if (!this.activeView) {
            this.logger.warn('No active view available for InsightPanel');
            return;
        }

        // Show InsightPanel with full intelligence
        if (opportunity.commands.length > 0) {
            this.insightPanel.showPanel(opportunity, clickedIndicator, this.activeView);
        } else {
            this.logger.warn(`No commands available for ${opportunity.type} opportunity`);
        }
    }

    /**
     * Update indicator positions (for scroll events)
     */
    private updateIndicatorPositions(): void {
        if (!this.activeEditor || !this.activeView) return;

        try {
            // Re-position all existing indicators using improved positioning
            for (const [, indicator] of this.indicators.entries()) {
                const lineNumber = parseInt(indicator.getAttribute('data-line') || '0', 10);
                const type = indicator.getAttribute('data-type') as 'enhancement' | 'quickfix' | 'metrics' | 'transform';
                
                if (!isNaN(lineNumber) && type) {
                    const opportunity: IndicatorOpportunity = {
                        line: lineNumber,
                        column: this.getMarginColumn(),
                        type: type,
                        icon: indicator.textContent || '',
                        commands: [], // Not needed for positioning
                        confidence: 0.5 // Not needed for positioning
                    };
                    
                    this.positionIndicator(indicator, opportunity);
                }
            }
        } catch (error) {
            this.logger.error('Failed to update indicator positions:', error);
        }
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
        this.clearAnalysisCache();
        
        if (this.analysisDebounceTimer) {
            clearTimeout(this.analysisDebounceTimer);
            this.analysisDebounceTimer = null;
        }
        
        if (this.scrollDebounceTimer) {
            clearTimeout(this.scrollDebounceTimer);
            this.scrollDebounceTimer = null;
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
        this.insightPanel.cleanup();
        this.activeEditor = null;
        this.activeView = null;
        this.logger.info('MarginIndicators cleaned up');
    }
}