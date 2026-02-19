/**
 * @file ContextDocumentList - Document list drawer for context management
 *
 * Renders the persistent-context indicator bar and expandable document drawer
 * that lets users view and manage documents in the current context.
 * Extracted from sidebar-view.ts.
 */

import { TFile, Platform, setIcon, ButtonComponent } from 'obsidian';
import { ContextManager } from './context-manager';
import { MultiDocContext } from './context-manager';
import { InputHandler } from './input-handler';
import { TimeoutManager } from '../utils/timeout-manager';
import { Logger } from '../utils/logger';

/**
 * Function type matching Obsidian's Component.registerDomEvent signature.
 * Uses separate overloads for Document vs HTMLElement targets.
 */
export interface RegisterDomEventFn {
	<K extends keyof DocumentEventMap>(
		el: Document,
		type: K,
		handler: (this: HTMLElement, ev: DocumentEventMap[K]) => void,
		options?: boolean | AddEventListenerOptions
	): void;
	<K extends keyof HTMLElementEventMap>(
		el: HTMLElement,
		type: K,
		handler: (this: HTMLElement, ev: HTMLElementEventMap[K]) => void,
		options?: boolean | AddEventListenerOptions
	): void;
}

/** Dependencies injected from the parent sidebar view */
export interface ContextDocumentListDeps {
	contextManager: ContextManager;
	inputHandler: InputHandler;
	timeoutManager: TimeoutManager;
	registerDomEvent: RegisterDomEventFn;
	getCurrentFile: () => TFile | null;
	getCurrentContext: () => MultiDocContext | null;
	refreshContext: () => Promise<void>;
}

export class ContextDocumentList {
	private deps: ContextDocumentListDeps;
	private isDrawerOpen = false;

	private static readonly HOVER_TIMEOUT_MS = 150;

	constructor(deps: ContextDocumentListDeps) {
		this.deps = deps;
	}

	/**
	 * Set up the global document click handler for closing the context drawer.
	 * Must be called once during sidebar initialization.
	 */
	setupCloseHandler(): void {
		const closeHandler = (e: Event) => {
			const indicator = this.deps.contextManager.contextIndicator;
			if (this.isDrawerOpen && indicator && !indicator.contains(e.target as Node)) {
				this.isDrawerOpen = false;
				const expandedEl = indicator.querySelector('.nova-context-expanded');
				if (expandedEl) {
					expandedEl.removeClass('show');
				}
				indicator.removeClass('drawer-open');
			}
		};

		this.deps.registerDomEvent(document, 'click', closeHandler as (this: HTMLElement, ev: MouseEvent) => void);
	}

	/**
	 * Rebuild the context indicator UI.
	 * Called whenever the context or current file changes.
	 */
	update(): void {
		const indicator = this.deps.contextManager.contextIndicator;
		if (!indicator) return;

		const currentContext = this.deps.getCurrentContext();
		const currentFile = this.deps.getCurrentFile();
		const isMobile = Platform.isMobile;

		// Check if we actually need to recreate the indicator
		const newDocCount = currentContext?.persistentDocs?.length || 0;
		const currentDocCount = indicator.getAttribute('data-doc-count');
		const currentFilePath = indicator.getAttribute('data-file-path');
		const newFilePath = currentFile?.path || '';

		if (
			currentDocCount === newDocCount.toString() &&
			currentFilePath === newFilePath &&
			newDocCount > 0
		) {
			return;
		}

		indicator.empty();

		if (!currentContext || !currentContext.persistentDocs) {
			this.clearIndicator(indicator);
			return;
		}

		const allDocs = currentContext.persistentDocs;

		if (!allDocs || allDocs.length === 0) {
			this.clearIndicator(indicator);
			return;
		}

		// Store doc count and file path to prevent unnecessary recreation
		indicator.setAttribute('data-doc-count', allDocs.length.toString());
		indicator.setAttribute('data-file-path', currentFile?.path || '');

		// Update input container state for mobile spacing
		if (this.deps.inputHandler) {
			this.deps.inputHandler.updateContextState(true);
		}

		// Show as thin line with mobile-optimized sizing
		indicator.addClass('nova-context-indicator-dynamic');
		indicator.addClass('show');

		// ── Summary bar ──────────────────────────────────────────
		const summaryEl = indicator.createDiv({ cls: 'nova-context-summary' });
		const summaryTextEl = summaryEl.createSpan({ cls: 'nova-context-summary-text' });

		const docNames = allDocs
			.filter(doc => doc?.file?.basename)
			.map(doc => doc.file.basename)
			.slice(0, isMobile ? 1 : 2);
		const moreCount =
			allDocs.length > (isMobile ? 1 : 2)
				? ` +${allDocs.length - (isMobile ? 1 : 2)}`
				: '';

		summaryTextEl.addClass('nova-context-summary-text');

		const filenamePartEl = summaryTextEl.createSpan({ cls: 'nova-context-filename-part' });
		const iconSpan = filenamePartEl.createSpan({ cls: 'nova-context-icon-span' });
		setIcon(iconSpan, 'book-open');

		const textSpan = filenamePartEl.createSpan({ cls: 'nova-context-text-span' });
		textSpan.textContent = `${docNames.join(', ')}${moreCount}`;

		const expandIndicatorEl = summaryEl.createSpan({ cls: 'nova-context-expand-indicator' });
		setIcon(expandIndicatorEl, 'more-horizontal');
		if (isMobile) {
			expandIndicatorEl.addClass('is-mobile');
		}
		expandIndicatorEl.setAttr('title', 'Tap to manage documents');

		// Mobile touch feedback
		if (isMobile) {
			this.deps.registerDomEvent(summaryEl, 'touchstart', () => {
				expandIndicatorEl.addClass('pressed');
			});
			this.deps.registerDomEvent(summaryEl, 'touchend', () => {
				this.deps.timeoutManager.addTimeout(() => {
					expandIndicatorEl.removeClass('pressed');
				}, ContextDocumentList.HOVER_TIMEOUT_MS);
			});
		}

		// ── Expanded drawer ──────────────────────────────────────
		const expandedEl = indicator.createDiv({ cls: 'nova-context-expanded' });
		expandedEl.addClass('nova-context-expanded');
		if (isMobile) {
			expandedEl.addClass('is-mobile');
		}

		// Header
		const expandedHeaderEl = expandedEl.createDiv({ cls: 'nova-context-expanded-header' });
		expandedHeaderEl.addClass('nova-context-expanded-header');
		if (isMobile) {
			expandedHeaderEl.addClass('is-mobile');
		}

		const headerTitleEl = expandedHeaderEl.createSpan();
		const titleIconEl = headerTitleEl.createSpan();
		setIcon(titleIconEl, 'book-open');
		headerTitleEl.createSpan({ text: ` Documents (${allDocs.length})` });
		headerTitleEl.addClass('nova-context-header-title');

		// Clear all button
		const clearAllBtnComponent = new ButtonComponent(expandedHeaderEl);
		clearAllBtnComponent
			.setIcon('trash-2')
			.setTooltip('Clear all documents from context')
			.onClick(async () => {
				const file = this.deps.getCurrentFile();
				if (file) {
					this.deps.contextManager
						.clearPersistentContext(file.path)
						.catch(error => {
							Logger.error('Failed to clear persistent context:', error);
						});
					await this.deps.refreshContext().catch(error => {
						Logger.error('Failed to refresh context:', error);
					});
				}
			});

		const clearAllBtn = clearAllBtnComponent.buttonEl;
		clearAllBtn.addClass('nova-context-clear-all-btn');
		if (isMobile) {
			clearAllBtn.addClass('is-mobile');
		}

		if (isMobile) {
			this.deps.registerDomEvent(clearAllBtn, 'touchstart', () => {
				clearAllBtn.addClass('nova-button-pressed');
			});
			this.deps.registerDomEvent(clearAllBtn, 'touchend', () => {
				this.deps.timeoutManager.addTimeout(() => {
					clearAllBtn.removeClass('nova-button-pressed');
				}, ContextDocumentList.HOVER_TIMEOUT_MS);
			});
		}

		// ── Document items ───────────────────────────────────────
		const docListEl = expandedEl.createDiv({ cls: 'nova-context-doc-list' });

		allDocs
			.filter(doc => doc?.file?.basename)
			.forEach((doc, index) => {
				const docItemEl = docListEl.createDiv({ cls: 'nova-context-doc-item' });
				docItemEl.addClass('nova-context-doc-item');
				if (isMobile) {
					docItemEl.addClass('is-mobile');
				}
				if (index >= allDocs.length - 1) {
					docItemEl.addClass('last-item');
				}

				const docInfoEl = docItemEl.createDiv({ cls: 'nova-context-doc-info' });
				docInfoEl.addClass('nova-context-doc-info');

				const iconEl = docInfoEl.createSpan();
				setIcon(iconEl, 'file-text');
				iconEl.addClass('nova-context-doc-icon');

				const nameEl = docInfoEl.createSpan({ cls: 'nova-context-doc-name' });
				const suffix = doc.property ? `#${doc.property}` : '';
				nameEl.textContent = `${doc.file.basename}${suffix}`;
				nameEl.addClass('nova-context-doc-name');
				nameEl.setAttr('title', `${doc.file.path} (read-only for editing)`);

				const readOnlyEl = docInfoEl.createSpan({ cls: 'nova-context-readonly' });
				readOnlyEl.textContent = 'Read-only';
				readOnlyEl.addClass('nova-context-doc-readonly');

				const removeBtn = docItemEl.createEl('button', { cls: 'nova-context-doc-remove' });
				removeBtn.textContent = '×';
				removeBtn.addClass('nova-context-remove-btn');
				if (isMobile) {
					removeBtn.addClass('is-mobile');
				}
				removeBtn.setAttr('title', `Remove ${doc.file.basename}`);

				this.deps.registerDomEvent(removeBtn, 'click', (e: Event) => {
					e.stopPropagation();
					const file = this.deps.getCurrentFile();
					if (file) {
						this.deps.contextManager
							.removePersistentDoc(file.path, doc.file.path)
							.catch(error => {
								Logger.error('Failed to remove persistent doc:', error);
							});
						this.deps.refreshContext().catch(error => {
							Logger.error('Failed to refresh context:', error);
						});
					}
				});

				if (isMobile) {
					this.deps.registerDomEvent(removeBtn, 'touchstart', () => {
						removeBtn.addClass('pressed');
					});
					this.deps.registerDomEvent(removeBtn, 'touchend', () => {
						this.deps.timeoutManager.addTimeout(() => {
							removeBtn.removeClass('pressed');
						}, ContextDocumentList.HOVER_TIMEOUT_MS);
					});
				}
			});

		// Drawer always starts closed on file switch
		this.isDrawerOpen = false;
		expandedEl.removeClass('show');

		// Toggle drawer on summary click
		const toggleExpanded = (e: MouseEvent) => {
			e.stopPropagation();
			this.isDrawerOpen = !this.isDrawerOpen;

			if (this.isDrawerOpen) {
				expandedEl.addClass('show');
				indicator.addClass('drawer-open');
			} else {
				expandedEl.removeClass('show');
				indicator.removeClass('drawer-open');
			}
		};

		this.deps.registerDomEvent(summaryEl, 'click', toggleExpanded);
	}

	/**
	 * Reset the drawer open state (e.g., on file switch).
	 */
	resetDrawerState(): void {
		this.isDrawerOpen = false;
	}

	// ── Private helpers ──────────────────────────────────────────

	private clearIndicator(indicator: HTMLElement): void {
		indicator.removeClass('show');
		indicator.removeAttribute('data-doc-count');
		indicator.removeAttribute('data-file-path');
		if (this.deps.inputHandler) {
			this.deps.inputHandler.updateContextState(false);
		}
	}
}
