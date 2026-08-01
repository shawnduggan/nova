/**
 * @file InsightPanel - Full intelligence panel for command selection
 * Shows multiple approach options with clear action buttons
 * Positioned near text without covering content
 */

import { MarkdownView, FuzzySuggestModal, FuzzyMatch, App, Editor, Platform } from 'obsidian';
import { Logger } from '../../../utils/logger';
import { TimeoutManager } from '../../../utils/timeout-manager';
import { CommandEngine } from '../core/CommandEngine';
import { INSIGHT_PANEL, OPPORTUNITY_TITLES, COMMANDS, CSS_CLASSES, CM_SELECTORS } from '../constants';
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

export class InsightPanel {
    private plugin: NovaPlugin;
    private commandEngine: CommandEngine;
    private logger = Logger.scope('InsightPanel');
    private timeoutManager = new TimeoutManager();

    // Panel state
    private activePanel: HTMLElement | null = null;
    private activeView: MarkdownView | null = null;
    private currentOpportunity: IndicatorOpportunity | null = null;

    // Settings
    private readonly MAX_VISIBLE_COMMANDS = INSIGHT_PANEL.MAX_VISIBLE_COMMANDS;

    constructor(
        plugin: NovaPlugin,
        commandEngine: CommandEngine
    ) {
        this.plugin = plugin;
        this.commandEngine = commandEngine;
    }

    /**
     * Check if the panel is currently active
     */
    isActive(): boolean {
        return this.activePanel !== null;
    }

    /**
     * Get the active panel element (for global event handlers)
     */
    getActivePanel(): HTMLElement | null {
        return this.activePanel;
    }

    /**
     * Show InsightPanel for a clicked indicator
     */
    showPanel(
        opportunity: IndicatorOpportunity, 
        triggerElement: HTMLElement,
        activeView: MarkdownView
    ): void {
        this.logger.info(`Opening InsightPanel for ${opportunity.type} with ${opportunity.commands.length} commands`);
        
        // Clean up any existing panel
        this.hidePanel();

        this.currentOpportunity = opportunity;
        this.activeView = activeView;

        // Create panel element
        this.createPanel(triggerElement, opportunity);
        
        // Set up scroll-specific handler (global click/key handlers are registered once in main plugin)
        this.setupScrollHandler();
        
        // Animate in after next frame for smooth transition
        this.timeoutManager.addTimeout(() => {
            if (this.activePanel) {
                this.activePanel.addClass('visible');
            }
        }, 0); // Next frame equivalent
    }

    /**
     * Hide the current panel
     */
    hidePanel(): void {
        if (this.activePanel) {
            this.activePanel.removeClass('visible');
            
            // Store reference for cleanup
            const panelToRemove = this.activePanel;
            
            // Immediately clear the reference so new panels can be created
            this.activePanel = null;
            
            // Remove after animation completes
            this.timeoutManager.addTimeout(() => {
                if (panelToRemove) {
                    panelToRemove.remove();
                }
            }, INSIGHT_PANEL.ANIMATION_DURATION);
        }

        this.currentOpportunity = null;
        this.activeView = null;
    }

    /**
     * Create the panel element
     */
    private createPanel(triggerElement: HTMLElement, opportunity: IndicatorOpportunity): void {
        if (!this.activeView) return;

        // Find the CodeMirror scroller (same pattern as MarginIndicators)
        const scrollerEl = this.activeView.containerEl.querySelector(CM_SELECTORS.SCROLLER) as HTMLElement;
        if (!scrollerEl) {
            this.logger.warn('Could not find .cm-scroller for panel creation');
            return;
        }

        // Create panel
        this.activePanel = scrollerEl.createDiv({
            cls: CSS_CLASSES.INSIGHT_PANEL
        });

        // Create header
        this.createHeader(this.activePanel, opportunity);

        // Create content with command options
        this.createContent(this.activePanel, opportunity);

        // Create footer with "Show More" if needed
        if (opportunity.commands.length > this.MAX_VISIBLE_COMMANDS) {
            this.createFooter(this.activePanel, opportunity);
        }

        // Position the panel
        this.positionPanel(this.activePanel, triggerElement);
    }

    /**
     * Create panel header
     */
    private createHeader(panel: HTMLElement, opportunity: IndicatorOpportunity): void {
        const header = panel.createDiv({ cls: CSS_CLASSES.PANEL_HEADER });
        
        const icon = header.createSpan({ cls: 'nova-insight-panel-icon' });
        icon.textContent = opportunity.icon.replace(/\d+$/, '');

        const title = header.createSpan({ cls: 'nova-insight-panel-title' });
        
        title.textContent = this.getOpportunityTitle(opportunity.type);
    }

    /**
     * Create panel content with command options
     */
    private createContent(panel: HTMLElement, opportunity: IndicatorOpportunity): void {
        const content = panel.createDiv({ cls: CSS_CLASSES.PANEL_CONTENT });

        if (opportunity.fillInstruction) {
            this.createMarkerOption(content, opportunity);
        } else {
            // Fallback to generic commands
            const commandsToShow = opportunity.commands.slice(0, this.MAX_VISIBLE_COMMANDS);
            for (const command of commandsToShow) {
                this.createCommandOption(content, command);
            }
        }
    }

    /**
     * Create option for Nova marker (<!-- nova: instruction -->)
     */
    private createMarkerOption(container: HTMLElement, opportunity: IndicatorOpportunity): void {
        const option = container.createDiv({ cls: CSS_CLASSES.COMMAND_OPTION });

        // Header shows the marker instruction
        const header = option.createDiv({ cls: 'nova-command-option-header' });

        const instructionText = header.createDiv({ cls: 'nova-marker-instruction' });
        const instruction = opportunity.fillInstruction || 'Placeholder';
        instructionText.textContent = instruction.length > 60 ? instruction.substring(0, 57) + '...' : instruction;

        const actionButton = header.createSpan({
            cls: CSS_CLASSES.COMMAND_ACTION,
            text: 'Smart fill'
        });

        // On mobile, add class for always-visible styling
        if (Platform.isMobile) {
            actionButton.addClass('mobile-visible');
        }

        // Add accessibility attributes
        actionButton.setAttr('role', 'button');
        actionButton.setAttr('tabindex', '0');

        // Description
        const description = option.createDiv({ cls: CSS_CLASSES.COMMAND_DESCRIPTION });
        description.textContent = 'Use /fill command to generate content for this placeholder';

        // Register click handler to run /fill
        this.plugin.registerDomEvent(option, 'click', async (event) => {
            event.stopPropagation();
            this.hidePanel();
            await this.plugin.executeFilWithProcessingState();
        });
    }

    /**
     * Create footer with "Show More" button
     */
    private createFooter(panel: HTMLElement, opportunity: IndicatorOpportunity): void {
        const footer = panel.createDiv({ cls: CSS_CLASSES.PANEL_FOOTER });
        
        const showMoreButton = footer.createDiv({ 
            cls: CSS_CLASSES.SHOW_MORE_BUTTON,
            text: COMMANDS.SHOW_MORE_TEXT_TEMPLATE.replace('{count}', opportunity.commands.length.toString())
        });

        // Register click handler for "Show More"
        this.plugin.registerDomEvent(showMoreButton, 'click', (event) => {
            event.stopPropagation();
            this.openFullCommandModal(opportunity);
        });
    }

    /**
     * Create a command option element
     */
    private createCommandOption(container: HTMLElement, command: MarkdownCommand): void {
        const option = container.createDiv({ cls: CSS_CLASSES.COMMAND_OPTION });

        // Header with name and action button
        const header = option.createDiv({ cls: 'nova-command-option-header' });
        
        const name = header.createSpan({ cls: CSS_CLASSES.COMMAND_NAME });
        name.textContent = command.name;

        const actionButton = header.createSpan({
            cls: CSS_CLASSES.COMMAND_ACTION,
            text: COMMANDS.APPLY_BUTTON_TEXT
        });

        // On mobile, add class for always-visible styling
        if (Platform.isMobile) {
            actionButton.addClass('mobile-visible');
        }

        // Add accessibility attributes
        actionButton.setAttr('role', 'button');
        actionButton.setAttr('tabindex', '0');

        // Description
        if (command.description) {
            const description = option.createDiv({ cls: CSS_CLASSES.COMMAND_DESCRIPTION });
            description.textContent = command.description;
        }

        // Register click handler for the entire option
        this.plugin.registerDomEvent(option, 'click', (event) => {
            event.stopPropagation();
            void this.executeCommand(command);
        });
    }

    /**
     * Position panel relative to trigger element (copy MarginIndicators positioning logic)
     */
    private positionPanel(panel: HTMLElement, triggerElement: HTMLElement): void {
        if (!this.activeView) return;

        try {
            const scrollerEl = this.activeView.containerEl.querySelector(CM_SELECTORS.SCROLLER) as HTMLElement;
            if (!scrollerEl) return;

            // Get trigger element position
            const triggerRect = triggerElement.getBoundingClientRect();
            const scrollerRect = scrollerEl.getBoundingClientRect();

            // Calculate position relative to scroller
            const relativeTop = triggerRect.top - scrollerRect.top + scrollerEl.scrollTop;
            const relativeRight = scrollerRect.right - triggerRect.right;

            // Position panel to the left of the indicator (same as hover preview)
            // TODO: Replace with CodeMirror decorations/gutters when refactoring UI
            this.setInitialPanelPosition(panel, relativeTop, relativeRight + INSIGHT_PANEL.TRIGGER_OFFSET);
            
            // Ensure panel doesn't go off-screen
            this.adjustPanelPosition(panel, scrollerEl);

            this.logger.debug(`Positioned InsightPanel at top=${relativeTop}px, right=${relativeRight + INSIGHT_PANEL.TRIGGER_OFFSET}px`);
            
        } catch (error) {
            this.logger.error('Failed to position InsightPanel:', error);
        }
    }

    /**
     * Adjust panel position to stay within viewport
     */
    private adjustPanelPosition(panel: HTMLElement, scrollerEl: HTMLElement): void {
        // Get panel dimensions
        const panelRect = panel.getBoundingClientRect();
        const scrollerRect = scrollerEl.getBoundingClientRect();

        // Adjust if panel extends beyond scroller bounds
        if (panelRect.bottom > scrollerRect.bottom) {
            const overflow = panelRect.bottom - scrollerRect.bottom;
            // Get current top value from CSS custom property
            const currentTopStyle = getComputedStyle(panel).getPropertyValue('--panel-top');
            const currentTop = parseInt(currentTopStyle || '0', 10);
            this.updatePanelTop(panel, Math.max(0, currentTop - overflow - INSIGHT_PANEL.EDGE_PADDING));
        }

        if (panelRect.left < scrollerRect.left) {
            // If panel extends too far left, position it to the right of the indicator instead
            this.movePanelToRight(panel, INSIGHT_PANEL.DEFAULT_POSITION);
        }
    }

    /**
     * Set up scroll handler to dismiss the panel (scroller events are panel-specific)
     */
    private setupScrollHandler(): void {
        if (!this.activeView) return;

        // Dismiss on scroll (panel would become mispositioned)
        const scrollerEl = this.activeView.containerEl.querySelector(CM_SELECTORS.SCROLLER) as HTMLElement;
        if (scrollerEl) {
            this.plugin.registerDomEvent(scrollerEl, 'scroll', () => {
                this.hidePanel();
            });
        }
    }

    /**
     * Open full command selection modal
     */
    private openFullCommandModal(opportunity: IndicatorOpportunity): void {
        if (!opportunity.commands.length) return;

        // Hide the panel first
        this.hidePanel();

        // Open full command modal (copy pattern from command-system.ts)
        const modal = new CommandSelectionModal(
            this.plugin.app,
            opportunity.commands,
            (command) => { void this.executeCommand(command); }
        );
        modal.open();
    }

    /**
     * Execute a selected command
     */
    private async executeCommand(command: MarkdownCommand): Promise<void> {
        this.logger.info(`Executing command: ${command.name}`);
        
        try {
            // Ensure we have the opportunity context and active view BEFORE hiding panel
            if (!this.currentOpportunity || !this.activeView || !this.activeView.editor) {
                this.logger.error('Missing context for command execution');
                return;
            }

            // Capture context before hiding panel (which clears the state)
            const opportunity = this.currentOpportunity;
            const activeView = this.activeView;
            const editor = activeView.editor;

            // Now hide panel
            this.hidePanel();

            // Auto-select the relevant line text before building context
            this.selectOpportunityText(editor, opportunity);

            // Build smart context for command execution (now with selected text)
            const context = this.plugin.smartVariableResolver?.buildSmartContext();
            if (!context) {
                this.logger.error('Could not build smart context for command execution');
                return;
            }

            // Use CommandEngine to execute the command
            await this.commandEngine.executeCommand(command, context);
            
            // Trigger immediate indicator refresh for better UX
            if (this.plugin.marginIndicators) {
                // Clear all cache since command may affect multiple lines
                this.plugin.marginIndicators.clearAnalysisCache();
                // Trigger immediate re-analysis
                void this.plugin.marginIndicators.analyzeCurrentContext();
            }
        } catch (error) {
            this.logger.error(`Failed to execute command ${command.name}:`, error);
        }
    }

    /**
     * Select the appropriate text based on the opportunity context
     */
    private selectOpportunityText(editor: Editor, opportunity: IndicatorOpportunity): void {
        try {
            const lineNumber = opportunity.line;
            
            // Verify the line still exists (document may have changed)
            const totalLines = editor.lineCount();
            if (lineNumber >= totalLines) {
                this.logger.warn(`Line ${lineNumber} no longer exists (document has ${totalLines} lines)`);
                return;
            }

            // Get the line content
            const lineContent = editor.getLine(lineNumber);
            if (!lineContent.trim()) {
                this.logger.warn(`Line ${lineNumber} is empty, cannot select text`);
                return;
            }

            // Select the entire line (excluding newline)
            const lineStart = { line: lineNumber, ch: 0 };
            const lineEnd = { line: lineNumber, ch: lineContent.length };
            
            // Set the selection in the editor
            editor.setSelection(lineStart, lineEnd);
            
            this.logger.debug(`Selected line ${lineNumber} for command execution`);
            
        } catch (error) {
            this.logger.error('Failed to select opportunity text:', error);
            // Don't throw - let command execution continue, it may work without selection
        }
    }

    /**
     * Get display title for opportunity type
     */
    private getOpportunityTitle(type: string): string {
        return OPPORTUNITY_TITLES[type as keyof typeof OPPORTUNITY_TITLES] || COMMANDS.DEFAULT_TITLE;
    }

    /**
     * Set initial position for panel using CodeMirror-based coordinates
     * 
     * Uses CodeMirror's coordinate system for accurate positioning relative to text.
     * This is the proper approach for editor-relative positioning in CodeMirror 6.
     */
    private setInitialPanelPosition(panel: HTMLElement, top: number, right: number): void {
        panel.setCssProps({
            '--panel-top': `${top}px`,
            '--panel-right': `${right}px`,
            '--panel-left': 'auto'
        });
    }

    /**
     * Update panel top position using CodeMirror coordinates
     */
    private updatePanelTop(panel: HTMLElement, top: number): void {
        panel.setCssProps({ '--panel-top': `${top}px` });
    }

    /**
     * Move panel to right side using CodeMirror coordinates
     */
    private movePanelToRight(panel: HTMLElement, left: number): void {
        panel.setCssProps({
            '--panel-right': 'auto',
            '--panel-left': `${left}px`
        });
    }

    /**
     * Clean up when component is destroyed
     */
    cleanup(): void {
        this.hidePanel();
        this.timeoutManager.clearAll();
        this.logger.info('InsightPanel cleaned up');
    }
}

/**
 * Modal for full command selection (copy of CommandModal pattern from command-system.ts)
 */
class CommandSelectionModal extends FuzzySuggestModal<MarkdownCommand> {
    private commands: MarkdownCommand[];
    private onSelect: (command: MarkdownCommand) => void;

    constructor(app: App, commands: MarkdownCommand[], onSelect: (command: MarkdownCommand) => void) {
        super(app);
        this.commands = commands;
        this.onSelect = onSelect;
        this.setPlaceholder(COMMANDS.SEARCH_PLACEHOLDER);
    }

    getItems(): MarkdownCommand[] {
        return this.commands;
    }

    getItemText(command: MarkdownCommand): string {
        return command.name;
    }

    onChooseItem(command: MarkdownCommand): void {
        this.onSelect(command);
    }

    renderSuggestion(match: FuzzyMatch<MarkdownCommand>, el: HTMLElement): void {
        const container = el.createDiv({ cls: 'suggestion-content' });
        
        const titleEl = container.createDiv({ cls: 'suggestion-title' });
        titleEl.textContent = match.item.name;
        
        if (match.item.description) {
            const noteEl = container.createDiv({ cls: 'suggestion-note' });
            noteEl.textContent = match.item.description;
        }
    }
}
