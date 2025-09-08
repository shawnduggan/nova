/**
 * CodeMirror decorations for margin indicators
 * Proper implementation using CodeMirror's decoration system
 */

import { StateField, StateEffect, Transaction } from '@codemirror/state';
import { EditorView, Decoration, DecorationSet, WidgetType } from '@codemirror/view';
import { Logger } from '../../../utils/logger';
import type { MarkdownCommand } from '../types';

// Types
interface IndicatorOpportunity {
    line: number;
    column: number;
    type: 'enhancement' | 'quickfix' | 'metrics' | 'transform';
    icon: string;
    commands: MarkdownCommand[];
    confidence: number;
    specificIssues?: Array<{
        matchedText: string;
        startIndex: number;
        endIndex: number;
        description: string;
        suggestedFix?: string;
    }>;
    issueCount?: number;
}

// State effects for managing indicators
export const addIndicatorEffect = StateEffect.define<IndicatorOpportunity>();
export const removeIndicatorEffect = StateEffect.define<number>(); // line number
export const clearIndicatorsEffect = StateEffect.define<void>();

/**
 * Widget class for margin indicators
 * Renders as a CodeMirror widget positioned by the editor
 */
class IndicatorWidget extends WidgetType {
    private logger = Logger.scope('IndicatorWidget');

    constructor(
        private opportunity: IndicatorOpportunity,
        private onIndicatorClick: (opportunity: IndicatorOpportunity, element: HTMLElement) => void
    ) {
        super();
    }

    toDOM(): HTMLElement {
        const indicator = document.createElement('span');
        indicator.className = 'nova-margin-indicator';
        indicator.textContent = this.opportunity.icon;
        
        // Add data attributes for styling and identification
        indicator.setAttribute('data-type', this.opportunity.type);
        indicator.setAttribute('data-line', this.opportunity.line.toString());
        indicator.setAttribute('data-confidence', this.opportunity.confidence.toString());
        
        // Add issue count if present
        if (this.opportunity.issueCount && this.opportunity.issueCount > 1) {
            indicator.setAttribute('data-count', this.opportunity.issueCount.toString());
            indicator.textContent = this.opportunity.icon + this.opportunity.issueCount;
        }
        
        // Add click handler
        indicator.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.onIndicatorClick(this.opportunity, indicator);
            this.logger.debug(`Indicator clicked for line ${this.opportunity.line}`);
        });
        
        // Add hover class for CSS transitions
        indicator.addEventListener('mouseenter', () => {
            indicator.addClass('hover');
        });
        
        indicator.addEventListener('mouseleave', () => {
            indicator.removeClass('hover');
        });

        this.logger.debug(`Created indicator widget for line ${this.opportunity.line}, type: ${this.opportunity.type}`);
        
        return indicator;
    }

    /**
     * Called when the widget needs to be updated
     */
    updateDOM(dom: HTMLElement): boolean {
        // Update the element if needed
        const newText = this.opportunity.issueCount && this.opportunity.issueCount > 1
            ? this.opportunity.icon + this.opportunity.issueCount
            : this.opportunity.icon;
        
        if (dom.textContent !== newText) {
            dom.textContent = newText;
        }
        
        return true;
    }

    /**
     * Compare widgets for equality (for efficient updates)
     */
    eq(other: IndicatorWidget): boolean {
        return this.opportunity.line === other.opportunity.line &&
               this.opportunity.type === other.opportunity.type &&
               this.opportunity.confidence === other.opportunity.confidence &&
               this.opportunity.issueCount === other.opportunity.issueCount;
    }

    /**
     * Destroy the widget (cleanup)
     */
    destroy(dom: HTMLElement): void {
        this.logger.debug(`Destroyed indicator widget for line ${this.opportunity.line}`);
    }
}

/**
 * StateField for managing margin indicator decorations
 */
export const indicatorStateField = StateField.define<{
    decorations: DecorationSet;
    opportunities: Map<number, IndicatorOpportunity>;
}>({
    create(): { decorations: DecorationSet; opportunities: Map<number, IndicatorOpportunity> } {
        return {
            decorations: Decoration.none,
            opportunities: new Map()
        };
    },

    update(state, transaction: Transaction) {
        let { decorations, opportunities } = state;
        
        // Map decorations through document changes
        decorations = decorations.map(transaction.changes);
        
        // Process state effects
        for (const effect of transaction.effects) {
            if (effect.is(addIndicatorEffect)) {
                const opportunity = effect.value;
                
                // Calculate position from line number (convert 0-based to 1-based)
                const lineNum = opportunity.line + 1;
                if (lineNum < 1 || lineNum > transaction.newDoc.lines) {
                    continue; // Skip invalid line numbers
                }
                const line = transaction.newDoc.line(lineNum);
                const pos = line.to; // Position at end of line
                
                // Create widget decoration
                const decoration = Decoration.widget({
                    widget: new IndicatorWidget(opportunity, (opp, element) => {
                        // Dispatch custom event for handling clicks
                        // Use document to ensure the event bubbles up properly
                        document.dispatchEvent(new CustomEvent('nova-indicator-click', {
                            detail: { opportunity: opp, element },
                            bubbles: true
                        }));
                    }),
                    side: 1, // Position after the line content
                    block: false
                });
                
                // Add to decoration set
                decorations = decorations.update({
                    add: [decoration.range(pos)]
                });
                
                // Update opportunities map
                opportunities = new Map(opportunities);
                opportunities.set(opportunity.line, opportunity);
                
            } else if (effect.is(removeIndicatorEffect)) {
                const lineNumber = effect.value;
                
                // Remove from opportunities
                opportunities = new Map(opportunities);
                opportunities.delete(lineNumber);
                
                // Remove decorations for this line (convert 0-based to 1-based)
                const lineNum = lineNumber + 1;
                if (lineNum >= 1 && lineNum <= transaction.newDoc.lines) {
                    const line = transaction.newDoc.line(lineNum);
                    decorations = decorations.update({
                        filter: (from, to) => !(from >= line.from && to <= line.to)
                    });
                }
                
            } else if (effect.is(clearIndicatorsEffect)) {
                // Clear all decorations and opportunities
                decorations = Decoration.none;
                opportunities = new Map();
            }
        }
        
        return { decorations, opportunities };
    },

    provide: field => EditorView.decorations.from(field, state => state.decorations)
});

/**
 * Extension for margin indicators
 */
export function createIndicatorExtension() {
    return [
        indicatorStateField,
        
        // Theme for styling indicators
        EditorView.theme({
            '.nova-margin-indicator': {
                position: 'absolute',
                right: '25px',
                fontSize: '14px',
                lineHeight: '20px',
                opacity: '0.6',
                cursor: 'pointer',
                userSelect: 'none',
                transition: 'opacity 0.2s ease',
                zIndex: '10'
            },
            
            '.nova-margin-indicator:hover, .nova-margin-indicator.hover': {
                opacity: '1.0'
            },
            
            '.nova-margin-indicator[data-type="enhancement"]': {
                color: 'var(--text-accent)'
            },
            
            '.nova-margin-indicator[data-type="quickfix"]': {
                color: 'var(--text-warning)'
            },
            
            '.nova-margin-indicator[data-type="metrics"]': {
                color: 'var(--text-muted)'
            },
            
            '.nova-margin-indicator[data-type="transform"]': {
                color: 'var(--text-success)'
            }
        })
    ];
}

/**
 * Helper functions for managing indicators
 */
export class CodeMirrorIndicatorManager {
    private logger = Logger.scope('CodeMirrorIndicatorManager');

    constructor(private view: EditorView) {}

    /**
     * Add or update an indicator
     */
    addIndicator(opportunity: IndicatorOpportunity): void {
        this.view.dispatch({
            effects: [addIndicatorEffect.of(opportunity)]
        });
        this.logger.debug(`Added indicator for line ${opportunity.line}, type: ${opportunity.type}`);
    }

    /**
     * Remove an indicator
     */
    removeIndicator(lineNumber: number): void {
        this.view.dispatch({
            effects: [removeIndicatorEffect.of(lineNumber)]
        });
        this.logger.debug(`Removed indicator for line ${lineNumber}`);
    }

    /**
     * Clear all indicators
     */
    clearIndicators(): void {
        this.view.dispatch({
            effects: [clearIndicatorsEffect.of()]
        });
        this.logger.debug('Cleared all indicators');
    }

    /**
     * Get current opportunities
     */
    getOpportunities(): Map<number, IndicatorOpportunity> {
        return this.view.state.field(indicatorStateField).opportunities;
    }

    /**
     * Update multiple indicators at once
     */
    updateIndicators(opportunities: IndicatorOpportunity[]): void {
        const effects = [
            clearIndicatorsEffect.of(),
            ...opportunities.map(opp => addIndicatorEffect.of(opp))
        ];
        
        this.view.dispatch({ effects });
        this.logger.debug(`Updated ${opportunities.length} indicators`);
    }
}