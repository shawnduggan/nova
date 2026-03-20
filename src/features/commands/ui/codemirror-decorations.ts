/**
 * @file CodeMirror decorations for margin indicators
 * Proper implementation using CodeMirror's decoration system
 */

import { StateField, StateEffect, Transaction } from '@codemirror/state';
import { EditorView, Decoration, DecorationSet, WidgetType } from '@codemirror/view';
import { Platform } from 'obsidian';
import { Logger } from '../../../utils/logger';
import type { MarkdownCommand } from '../types';
import type NovaPlugin from '../../../../main';

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

export interface WritingHighlight {
    from: number;
    to: number;
    type: 'long-sentence' | 'very-long-sentence' | 'passive-voice' | 'adverb' | 'weak-intensifier';
    title: string;
}

// State effects for managing indicators
export const addIndicatorEffect = StateEffect.define<IndicatorOpportunity>();
export const removeIndicatorEffect = StateEffect.define<number>(); // line number
export const clearIndicatorsEffect = StateEffect.define<void>();
export const setWritingHighlightsEffect = StateEffect.define<WritingHighlight[]>();
export const clearWritingHighlightsEffect = StateEffect.define<void>();

/**
 * Widget class for margin indicators
 * Renders as a CodeMirror widget positioned by the editor
 */
class IndicatorWidget extends WidgetType {
    private logger = Logger.scope('IndicatorWidget');

    constructor(
        private opportunity: IndicatorOpportunity,
        private onIndicatorClick: (opportunity: IndicatorOpportunity, element: HTMLElement) => void,
        private plugin: NovaPlugin
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

        // Add tooltip/title attribute
        indicator.setAttribute('title', this.getTooltipText());

        // Add issue count if present
        if (this.opportunity.issueCount && this.opportunity.issueCount > 1) {
            indicator.setAttribute('data-count', this.opportunity.issueCount.toString());
            indicator.textContent = this.opportunity.icon + this.opportunity.issueCount;
        }

        // Use Obsidian's registerDomEvent for proper cleanup
        this.plugin.registerDomEvent(indicator, 'click', (event: MouseEvent) => {
            event.preventDefault();
            event.stopPropagation();

            // On mobile, blur any focused element to prevent virtual keyboard from opening
            if (Platform.isMobile && document.activeElement && document.activeElement instanceof HTMLElement) {
                document.activeElement.blur();
            }

            this.onIndicatorClick(this.opportunity, indicator);
            this.logger.debug(`Indicator clicked for line ${this.opportunity.line}`);
        });

        // Add hover class for CSS transitions
        this.plugin.registerDomEvent(indicator, 'mouseenter', () => {
            indicator.addClass('hover');
        });

        this.plugin.registerDomEvent(indicator, 'mouseleave', () => {
            indicator.removeClass('hover');
        });

        this.logger.debug(`Created indicator widget for line ${this.opportunity.line}, type: ${this.opportunity.type}`);

        return indicator;
    }

    /**
     * Get tooltip text based on opportunity type
     */
    private getTooltipText(): string {
        if (this.opportunity.icon === '📝') {
            return 'Click to Smart fill this placeholder with AI';
        }
        if (this.opportunity.icon === '⚡') {
            return 'Click to fix writing quality issues';
        }
        if (this.opportunity.icon === '✨') {
            return 'Click for transformation suggestions';
        }
        return this.opportunity.type || 'Click for suggestions';
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
     * Note: Event listeners registered via plugin.registerDomEvent() are automatically
     * cleaned up when the plugin unloads, so no manual cleanup needed here.
     */
    destroy(dom: HTMLElement): void {
        this.logger.debug(`Destroyed indicator widget for line ${this.opportunity.line}`);
    }
}

/**
 * Factory function to create StateField for managing margin indicator decorations
 * Takes plugin instance for proper event registration
 */
function createIndicatorStateField(plugin: NovaPlugin) {
    return StateField.define<{
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
                
                // Create widget decoration with plugin instance for proper event registration
                const decoration = Decoration.widget({
                    widget: new IndicatorWidget(opportunity, (opp, element) => {
                        // Dispatch custom event for handling clicks
                        // Use document to ensure the event bubbles up properly
                        document.dispatchEvent(new CustomEvent('nova-indicator-click', {
                            detail: { opportunity: opp, element },
                            bubbles: true
                        }));
                    }, plugin),
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
}

function createWritingHighlightStateField() {
    return StateField.define<DecorationSet>({
        create(): DecorationSet {
            return Decoration.none;
        },

        update(decorations, transaction: Transaction) {
            decorations = decorations.map(transaction.changes);

            for (const effect of transaction.effects) {
                if (effect.is(setWritingHighlightsEffect)) {
                    const ranges = effect.value
                        .filter(highlight => highlight.from < highlight.to)
                        .map(highlight => Decoration.mark({
                            class: `nova-writing-highlight nova-writing-highlight--${highlight.type}`,
                            attributes: {
                                'aria-label': highlight.title,
                                'data-writing-type': highlight.type
                            }
                        }).range(highlight.from, highlight.to));

                    decorations = Decoration.set(ranges, true);
                } else if (effect.is(clearWritingHighlightsEffect)) {
                    decorations = Decoration.none;
                }
            }

            return decorations;
        },

        provide: field => EditorView.decorations.from(field)
    });
}

/**
 * Extension for margin indicators
 * Takes plugin instance for proper event listener registration
 * Returns both the extension and the state field for use with CodeMirrorIndicatorManager
 */
export function createIndicatorExtension(plugin: NovaPlugin) {
    const indicatorStateField = createIndicatorStateField(plugin);
    const writingHighlightStateField = createWritingHighlightStateField();

    const extension = [
        indicatorStateField,
        writingHighlightStateField,
        
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
            },

            '.nova-writing-highlight': {
                borderBottomWidth: '1px',
                borderBottomStyle: 'solid',
                cursor: 'help'
            },

            '.nova-writing-highlight--long-sentence': {
                borderBottomColor: 'var(--text-warning)',
                boxShadow: 'inset 0 -1px 0 0 color-mix(in srgb, var(--text-warning) 25%, transparent)'
            },

            '.nova-writing-highlight--very-long-sentence': {
                borderBottomColor: 'var(--text-error)',
                boxShadow: 'inset 0 -1px 0 0 color-mix(in srgb, var(--text-error) 25%, transparent)'
            },

            '.nova-writing-highlight--passive-voice': {
                borderBottomColor: 'var(--interactive-accent)',
                boxShadow: 'inset 0 -1px 0 0 color-mix(in srgb, var(--interactive-accent) 20%, transparent)'
            },

            '.nova-writing-highlight--adverb': {
                borderBottomColor: 'var(--text-accent)',
                boxShadow: 'inset 0 -1px 0 0 color-mix(in srgb, var(--text-accent) 18%, transparent)'
            },

            '.nova-writing-highlight--weak-intensifier': {
                borderBottomColor: 'var(--color-orange)',
                boxShadow: 'inset 0 -1px 0 0 color-mix(in srgb, var(--color-orange) 20%, transparent)'
            }
        })
    ];

    return {
        extension,
        stateField: indicatorStateField,
        writingStateField: writingHighlightStateField
    };
}

/**
 * Helper functions for managing indicators
 */
export class CodeMirrorIndicatorManager {
    private logger = Logger.scope('CodeMirrorIndicatorManager');

    constructor(
        private view: EditorView,
        private stateField: StateField<{ decorations: DecorationSet; opportunities: Map<number, IndicatorOpportunity> }>
    ) {}

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
        return this.view.state.field(this.stateField).opportunities;
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

export class CodeMirrorWritingHighlightManager {
    private logger = Logger.scope('CodeMirrorWritingHighlightManager');

    constructor(
        private view: EditorView,
        private stateField: StateField<DecorationSet>
    ) {}

    updateHighlights(highlights: WritingHighlight[]): void {
        this.view.dispatch({
            effects: [setWritingHighlightsEffect.of(highlights)]
        });
        this.logger.debug(`Updated ${highlights.length} writing highlights`);
    }

    clearHighlights(): void {
        this.view.dispatch({
            effects: [clearWritingHighlightsEffect.of()]
        });
        this.logger.debug('Cleared writing highlights');
    }

    getHighlights(): DecorationSet {
        return this.view.state.field(this.stateField);
    }
}
