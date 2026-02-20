/**
 * @file ContextQuickPanel - Collapsible quick panel for context controls
 *
 * Shows auto-context toggles, context document list, and budget bar.
 * Located at the top of the sidebar.
 */

import { App, TFile, Platform, setIcon, ToggleComponent } from 'obsidian';
import { ContextManager, DocumentReference } from './context-manager';
import { InputHandler } from './input-handler';
import { TimeoutManager } from '../utils/timeout-manager';
import { Logger } from '../utils/logger';
import { formatContextUsage, getContextWarningLevel, ContextUsage } from '../core/context-calculator';
import type NovaPlugin from '../../main';

/** Dependencies injected from the parent sidebar view */
export interface ContextQuickPanelDeps {
	app: App;
	plugin: NovaPlugin;
	container: HTMLElement;
	inputHandler: InputHandler;
	contextManager: ContextManager;
	timeoutManager: TimeoutManager;
	getCurrentFile: () => TFile | null;
	getCurrentContext: () => { persistentDocs: DocumentReference[]; totalContextUsage?: ContextUsage } | null;
	refreshContext: () => Promise<void>;
	registerDomEvent: <K extends keyof HTMLElementEventMap>(
		el: HTMLElement | Document, 
		type: K, 
		handler: (this: HTMLElement, ev: HTMLElementEventMap[K]) => void
	) => void;
}

export class ContextQuickPanel {
	private deps: ContextQuickPanelDeps;
	private isExpanded = false;
	private panelEl: HTMLElement | null = null;
	private expandedEl: HTMLElement | null = null;
	private toggleOutgoing: ToggleComponent | null = null;
	private toggleBacklinks: ToggleComponent | null = null;
	private budgetBarEl: HTMLElement | null = null;

	private static readonly COLLAPSED_HEIGHT = 32;

	constructor(deps: ContextQuickPanelDeps) {
		this.deps = deps;
	}

	/**
	 * Create the quick panel in the container
	 */
	createPanel(): HTMLElement {
		this.panelEl = this.deps.container.createDiv({ cls: 'nova-quick-panel' });
		this.panelEl.addClass('nova-quick-panel-collapsed');

		// Collapsed header
		const headerEl = this.panelEl.createDiv({ cls: 'nova-quick-panel-header' });
		
		const chevronEl = headerEl.createSpan({ cls: 'nova-quick-panel-chevron' });
		setIcon(chevronEl, 'chevron-right');
		
		const labelEl = headerEl.createSpan({ cls: 'nova-quick-panel-label' });
		labelEl.textContent = 'Context';

		const infoEl = headerEl.createSpan({ cls: 'nova-quick-panel-info' });
		this.updateCollapsedInfo(infoEl);

		// Toggle expand/collapse on header click
		this.deps.registerDomEvent(headerEl, 'click', () => {
			this.toggleExpanded();
			this.updateCollapsedInfo(infoEl);
		});

		// Expanded content
		this.expandedEl = this.panelEl.createDiv({ cls: 'nova-quick-panel-body' });
		this.expandedEl.addClass('nova-hidden');

		this.renderExpandedContent();

		return this.panelEl;
	}

	/**
	 * Update the panel when context changes
	 */
	update(): void {
		if (!this.panelEl) return;

		// Update collapsed info
		const infoEl = this.panelEl.querySelector('.nova-quick-panel-info') as HTMLElement;
		if (infoEl) {
			this.updateCollapsedInfo(infoEl);
		}

		// Update expanded content if visible
		if (this.isExpanded && this.expandedEl) {
			this.renderDocumentList();
		}
	}

	/**
	 * Toggle expanded state
	 */
	private toggleExpanded(): void {
		this.isExpanded = !this.isExpanded;

		if (!this.panelEl || !this.expandedEl) return;

		const chevronEl = this.panelEl.querySelector('.nova-quick-panel-chevron');

		if (this.isExpanded) {
			this.panelEl.removeClass('nova-quick-panel-collapsed');
			this.panelEl.addClass('nova-quick-panel-expanded');
			this.expandedEl.removeClass('nova-hidden');
			if (chevronEl) setIcon(chevronEl as HTMLElement, 'chevron-down');
			this.renderExpandedContent();
		} else {
			this.panelEl.removeClass('nova-quick-panel-expanded');
			this.panelEl.addClass('nova-quick-panel-collapsed');
			this.expandedEl.addClass('nova-hidden');
			if (chevronEl) setIcon(chevronEl as HTMLElement, 'chevron-right');
		}
	}

	/**
	 * Update the collapsed header info text
	 */
	private updateCollapsedInfo(infoEl: HTMLElement): void {
		const context = this.deps.getCurrentContext();
		const docCount = context?.persistentDocs?.length || 0;
		const totalTokens = context?.totalContextUsage?.totalTokens || 0;
		const contextLimit = context?.totalContextUsage?.contextLimit || 32000;
		const usagePercent = context?.totalContextUsage?.usagePercentage || 0;

		// Format: "3 notes · 12.4K tokens" or similar
		let tokenText: string;
		if (totalTokens >= 1000) {
			tokenText = `${(totalTokens / 1000).toFixed(1)}K`;
		} else {
			tokenText = totalTokens.toString();
		}

		infoEl.textContent = `${docCount} note${docCount !== 1 ? 's' : ''} · ${tokenText} tokens`;

		// Add warning class if near limit
		infoEl.removeClass('nova-context-warning', 'nova-context-danger');
		if (usagePercent >= 90) {
			infoEl.addClass('nova-context-danger');
		} else if (usagePercent >= 75) {
			infoEl.addClass('nova-context-warning');
		}
	}

	/**
	 * Initialize toggles (called once during construction)
	 */
	private initToggles(): void {
		if (!this.expandedEl) return;

		// Toggle section
		const togglesEl = this.expandedEl.createDiv({ cls: 'nova-quick-panel-toggles' });

		// Auto-include linked notes toggle
		const outgoingToggleEl = togglesEl.createDiv({ cls: 'nova-quick-panel-toggle-row' });
		outgoingToggleEl.createSpan({ text: 'Auto-include linked notes', cls: 'nova-quick-panel-toggle-label' });
		
		const settings = this.deps.plugin.settings;
		const outgoingToggle = new ToggleComponent(outgoingToggleEl);
		outgoingToggle.setValue(settings.autoContext?.includeOutgoing ?? true);
		outgoingToggle.onChange(async (value) => {
			if (!settings.autoContext) settings.autoContext = { includeOutgoing: true, includeBacklinks: false };
			settings.autoContext.includeOutgoing = value;
			await this.deps.plugin.saveSettings();
			this.deps.contextManager.updateAutoContextOptions();
			const currentFile = this.deps.getCurrentFile();
			if (currentFile) {
				await this.deps.contextManager.rebuildAutoContext(currentFile);
				await this.deps.refreshContext();
			}
			this.update();
		});
		this.toggleOutgoing = outgoingToggle;

		// Include backlinks toggle
		const backlinkToggleEl = togglesEl.createDiv({ cls: 'nova-quick-panel-toggle-row' });
		backlinkToggleEl.createSpan({ text: 'Include backlinks', cls: 'nova-quick-panel-toggle-label' });
		
		const backlinkToggle = new ToggleComponent(backlinkToggleEl);
		backlinkToggle.setValue(settings.autoContext?.includeBacklinks ?? false);
		backlinkToggle.onChange(async (value) => {
			if (!settings.autoContext) settings.autoContext = { includeOutgoing: true, includeBacklinks: false };
			settings.autoContext.includeBacklinks = value;
			await this.deps.plugin.saveSettings();
			this.deps.contextManager.updateAutoContextOptions();
			const currentFile = this.deps.getCurrentFile();
			if (currentFile) {
				await this.deps.contextManager.rebuildAutoContext(currentFile);
				await this.deps.refreshContext();
			}
			this.update();
		});
		this.toggleBacklinks = backlinkToggle;
	}

	/**
	 * Render the document list only (avoids recreating toggles)
	 */
	private renderDocumentList(): void {
		if (!this.expandedEl) return;

		// Find or create document list container
		let docListContainer = this.expandedEl.querySelector('.nova-quick-panel-doc-container');
		if (!docListContainer) {
			docListContainer = this.expandedEl.createDiv({ cls: 'nova-quick-panel-doc-container' });
		} else {
			(docListContainer as HTMLElement).empty();
		}

		const context = this.deps.getCurrentContext();
		const docs = context?.persistentDocs || [];

		if (docs.length === 0) {
			const emptyEl = (docListContainer as HTMLElement).createDiv({ cls: 'nova-quick-panel-empty' });
			emptyEl.textContent = 'No documents in context. Link notes with [[wikilinks]] or enable auto-context above.';
		} else {
			const docListEl = (docListContainer as HTMLElement).createDiv({ cls: 'nova-quick-panel-doc-list' });

			docs.forEach((doc, index) => {
				const docEl = docListEl.createDiv({ cls: 'nova-quick-panel-doc-item' });
				if (index === docs.length - 1) docEl.addClass('last-item');

				// Document name and source
				const nameEl = docEl.createDiv({ cls: 'nova-quick-panel-doc-name' });
				nameEl.textContent = doc.file.basename;
				if (doc.property) {
					nameEl.textContent += `#${doc.property}`;
				}

				// Source badge
				const sourceEl = docEl.createSpan({ cls: 'nova-quick-panel-doc-source' });
				sourceEl.textContent = doc.source || 'manual';

				// Token count
				const tokenEl = docEl.createSpan({ cls: 'nova-quick-panel-doc-tokens' });
				const tokenCount = doc.tokenCount || 0;
				const fullCount = doc.fullTokenCount;
				if (fullCount && fullCount > tokenCount) {
					tokenEl.textContent = `${tokenCount}/${fullCount}`;
				} else {
					tokenEl.textContent = `${tokenCount}`;
				}

				// Remove button
				const removeEl = docEl.createDiv({ cls: 'nova-quick-panel-doc-remove' });
				setIcon(removeEl, 'x');
				this.deps.registerDomEvent(removeEl, 'click', () => {
					void (async () => {
						await this.deps.contextManager.removeDocument(doc.file);
						await this.deps.refreshContext();
						this.update();
					})();
				});
			});
		}

		// Budget bar
		const budgetEl = this.expandedEl.createDiv({ cls: 'nova-quick-panel-budget' });
		
		const usage = context?.totalContextUsage;
		const totalTokens = usage?.totalTokens || 0;
		const contextLimit = usage?.contextLimit || 32000;
		const usagePercent = Math.min((totalTokens / contextLimit) * 100, 100);

		// Progress bar
		const progressContainerEl = budgetEl.createDiv({ cls: 'nova-budget-bar-container' });
		const progressEl = progressContainerEl.createDiv({ cls: 'nova-budget-bar' });
		progressEl.style.width = `${usagePercent}%`;
		
		// Color based on usage
		progressEl.removeClass('nova-budget-low', 'nova-budget-medium', 'nova-budget-high');
		if (usagePercent >= 90) {
			progressEl.addClass('nova-budget-high');
		} else if (usagePercent >= 75) {
			progressEl.addClass('nova-budget-medium');
		} else {
			progressEl.addClass('nova-budget-low');
		}

		// Token count text
		const budgetTextEl = budgetEl.createDiv({ cls: 'nova-budget-text' });
		budgetTextEl.textContent = `${totalTokens.toLocaleString()} / ${contextLimit.toLocaleString()} tokens`;
	}

	/**
	 * Render the expanded panel content (called once during construction)
	 */
	private renderExpandedContent(): void {
		if (!this.expandedEl) return;

		// Initialize toggles once
		this.initToggles();

		// Render document list (includes budget bar)
		this.renderDocumentList();
	}

	/**
	 * Collapse the panel
	 */
	collapse(): void {
		if (this.isExpanded) {
			this.toggleExpanded();
		}
	}

	/**
	 * Expand the panel
	 */
	expand(): void {
		if (!this.isExpanded) {
			this.toggleExpanded();
		}
	}

	/**
	 * Check if panel is expanded
	 */
	isPanelExpanded(): boolean {
		return this.isExpanded;
	}
}
