/**
 * @file WritingStatsPanel - Collapsible sidebar panel for deterministic writing analysis metrics
 */

import { setIcon } from 'obsidian';
import type { WritingAnalysis } from '../core/writing-analysis';

export interface WritingStatsPanelState {
    analysis: WritingAnalysis | null;
    eligible: boolean;
    visible: boolean;
    highlightsVisible: boolean;
    disabledByFrontmatter: boolean;
}

export interface WritingStatsPanelDeps {
    container: HTMLElement;
    registerDomEvent: <K extends keyof HTMLElementEventMap>(
        el: HTMLElement | Document,
        type: K,
        handler: (this: HTMLElement, ev: HTMLElementEventMap[K]) => void
    ) => void;
    onToggleHighlights: () => void;
    onAnalyze: () => void;
}

export class WritingStatsPanel {
    private deps: WritingStatsPanelDeps;
    private panelEl: HTMLElement | null = null;
    private bodyEl: HTMLElement | null = null;
    private isExpanded = false;
    private lastState: WritingStatsPanelState | null = null;

    constructor(deps: WritingStatsPanelDeps) {
        this.deps = deps;
    }

    createPanel(): HTMLElement {
        this.panelEl = this.deps.container.createDiv({ cls: 'nova-writing-panel nova-writing-panel-collapsed' });

        const headerEl = this.panelEl.createDiv({ cls: 'nova-writing-panel-header' });
        const chevronEl = headerEl.createSpan({ cls: 'nova-writing-panel-chevron' });
        setIcon(chevronEl, 'chevron-right');

        const labelEl = headerEl.createSpan({ cls: 'nova-writing-panel-label' });
        labelEl.textContent = 'Writing';

        const infoEl = headerEl.createSpan({ cls: 'nova-writing-panel-info' });
        infoEl.textContent = 'Waiting for analysis';

        this.deps.registerDomEvent(headerEl, 'click', () => {
            this.toggleExpanded();
        });

        this.bodyEl = this.panelEl.createDiv({ cls: 'nova-writing-panel-body nova-hidden' });
        this.deps.registerDomEvent(this.bodyEl, 'mousedown', (event: MouseEvent) => {
            event.stopPropagation();
        });

        return this.panelEl;
    }

    update(state: WritingStatsPanelState): void {
        if (!this.panelEl || !this.bodyEl) {
            return;
        }

        this.lastState = state;

        if (!state.visible || !state.eligible) {
            this.panelEl.addClass('nova-hidden');
            return;
        }

        this.panelEl.removeClass('nova-hidden');

        const infoEl = this.panelEl.querySelector<HTMLElement>('.nova-writing-panel-info');
        if (infoEl) {
            infoEl.textContent = this.getCollapsedText(state);
        }

        if (this.isExpanded) {
            this.renderExpandedContent(state);
        }
    }

    private toggleExpanded(): void {
        this.isExpanded = !this.isExpanded;

        if (!this.panelEl || !this.bodyEl) {
            return;
        }

        const chevronEl = this.panelEl.querySelector<HTMLElement>('.nova-writing-panel-chevron');
        if (this.isExpanded) {
            this.panelEl.removeClass('nova-writing-panel-collapsed');
            this.panelEl.addClass('nova-writing-panel-expanded');
            this.bodyEl.removeClass('nova-hidden');
            if (chevronEl) {
                setIcon(chevronEl, 'chevron-down');
            }
            if (this.lastState) {
                this.renderExpandedContent(this.lastState);
            }
        } else {
            this.panelEl.removeClass('nova-writing-panel-expanded');
            this.panelEl.addClass('nova-writing-panel-collapsed');
            this.bodyEl.addClass('nova-hidden');
            if (chevronEl) {
                setIcon(chevronEl, 'chevron-right');
            }
        }
    }

    private renderExpandedContent(state: WritingStatsPanelState): void {
        if (!this.bodyEl) {
            return;
        }

        this.bodyEl.empty();

        if (state.disabledByFrontmatter) {
            const disabledEl = this.bodyEl.createDiv({ cls: 'nova-writing-panel-empty' });
            disabledEl.textContent = 'Writing analysis is turned off for this note via frontmatter.';
            this.renderActions(state.highlightsVisible);
            return;
        }

        if (!state.analysis) {
            const emptyEl = this.bodyEl.createDiv({ cls: 'nova-writing-panel-empty' });
            emptyEl.textContent = 'Open a markdown note to analyze writing.';
            this.renderActions(state.highlightsVisible);
            return;
        }

        const metricsEl = this.bodyEl.createDiv({ cls: 'nova-writing-panel-metrics' });
        this.createMetricRow(metricsEl, 'Readability', `${this.formatGrade(state.analysis.readabilityGrade)} (${state.analysis.readabilityLabel.replace(/^Grade \d+\s*[-–—]\s*/, '')})`, this.getReadabilityClass(state.analysis.readabilityGrade));
        this.createMetricRow(metricsEl, 'Words', this.formatCount(state.analysis.wordCount));
        this.createMetricRow(metricsEl, 'Sentences', this.formatCount(state.analysis.sentenceCount));
        this.createMetricRow(metricsEl, 'Reading time', `${state.analysis.readingTimeMinutes} min`);
        this.createMetricRow(
            metricsEl,
            'Passive voice',
            `${Math.round(state.analysis.passiveVoicePercentage)}% (${state.analysis.passiveSentenceCount} of ${state.analysis.sentenceCount} sentences)`,
            this.getPassiveClass(state.analysis.passiveVoicePercentage)
        );
        this.createMetricRow(
            metricsEl,
            'Adverbs',
            `${state.analysis.adverbDensity.toFixed(1)} per 100 words`,
            this.getAdverbClass(state.analysis.adverbDensity)
        );
        this.createMetricRow(
            metricsEl,
            'Intensifiers',
            `${state.analysis.weakIntensifierCount} found`,
            this.getIntensifierClass(state.analysis.weakIntensifierCount)
        );

        this.renderActions(state.highlightsVisible);
    }

    private renderActions(highlightsVisible: boolean): void {
        if (!this.bodyEl) {
            return;
        }

        const actionsEl = this.bodyEl.createDiv({ cls: 'nova-writing-panel-actions' });

        const toggleButton = actionsEl.createEl('button', {
            cls: 'nova-writing-panel-button',
            text: highlightsVisible ? 'Hide highlights' : 'Show highlights'
        });
        toggleButton.setAttribute('type', 'button');
        toggleButton.setAttribute('aria-label', highlightsVisible ? 'Hide writing highlights' : 'Show writing highlights');

        const analyzeButton = actionsEl.createEl('button', {
            cls: 'nova-writing-panel-button',
            text: 'Analyze'
        });
        analyzeButton.setAttribute('type', 'button');
        analyzeButton.setAttribute('aria-label', 'Analyze writing now');

        this.deps.registerDomEvent(toggleButton, 'click', (event: MouseEvent) => {
            event.preventDefault();
            event.stopPropagation();
            this.deps.onToggleHighlights();
        });

        this.deps.registerDomEvent(analyzeButton, 'click', (event: MouseEvent) => {
            event.preventDefault();
            event.stopPropagation();
            this.deps.onAnalyze();
        });
    }

    private createMetricRow(container: HTMLElement, label: string, value: string, valueClass?: string): void {
        const rowEl = container.createDiv({ cls: 'nova-writing-panel-row' });
        rowEl.createSpan({ cls: 'nova-writing-panel-row-label', text: label });

        const valueEl = rowEl.createSpan({ cls: 'nova-writing-panel-row-value', text: value });
        if (valueClass) {
            valueEl.addClass(valueClass);
        }
    }

    private getCollapsedText(state: WritingStatsPanelState): string {
        if (state.disabledByFrontmatter) {
            return 'Disabled for this note';
        }

        if (!state.analysis) {
            return 'Waiting for analysis';
        }

        return `${this.formatGrade(state.analysis.readabilityGrade)} · ${this.formatCount(state.analysis.wordCount)} words · ${state.analysis.readingTimeMinutes} min`;
    }

    private formatGrade(grade: number): string {
        return `Grade ${Math.max(0, Math.round(grade))}`;
    }

    private formatCount(count: number): string {
        return count.toLocaleString();
    }

    private getReadabilityClass(grade: number): string {
        if (grade <= 10) {
            return 'nova-writing-panel-value--good';
        }
        if (grade <= 14) {
            return 'nova-writing-panel-value--warn';
        }
        return 'nova-writing-panel-value--bad';
    }

    private getPassiveClass(percentage: number): string {
        if (percentage <= 5) {
            return 'nova-writing-panel-value--good';
        }
        if (percentage <= 15) {
            return 'nova-writing-panel-value--warn';
        }
        return 'nova-writing-panel-value--bad';
    }

    private getAdverbClass(density: number): string {
        if (density <= 2) {
            return 'nova-writing-panel-value--good';
        }
        if (density <= 4) {
            return 'nova-writing-panel-value--warn';
        }
        return 'nova-writing-panel-value--bad';
    }

    private getIntensifierClass(count: number): string {
        if (count <= 3) {
            return 'nova-writing-panel-value--good';
        }
        if (count <= 8) {
            return 'nova-writing-panel-value--warn';
        }
        return 'nova-writing-panel-value--bad';
    }
}
