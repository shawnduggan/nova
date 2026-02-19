/**
 * @file ContextDocumentList - The flat list of context entries with expandable drawer
 */

import { ButtonComponent, Platform, setIcon } from 'obsidian';
import { DocumentReference, MultiDocContext } from './context-manager';
import { Logger } from '../utils/logger';

export interface DocumentListCallbacks {
	onRemoveDocument: (filePath: string) => Promise<void>;
	onClearAllDocuments: () => Promise<void>;
	registerDomEvent: <K extends keyof HTMLElementEventMap>(element: HTMLElement, event: K, handler: (this: HTMLElement, ev: HTMLElementEventMap[K]) => void) => void;
	addTrackedTimeout: (callback: () => void, delay: number) => number;
}

export interface DocumentListState {
	currentContext: MultiDocContext | null;
	currentFilePath: string | null;
}

export class ContextDocumentList {
	private container: HTMLElement;
	private indicatorEl: HTMLElement | null = null;
	private callbacks: DocumentListCallbacks;
	private state: DocumentListState;
	private isDrawerOpen: boolean = false;
	private static readonly HOVER_TIMEOUT_MS = 150;

	constructor(container: HTMLElement, callbacks: DocumentListCallbacks, initialState: DocumentListState) {
		this.container = container;
		this.callbacks = callbacks;
		this.state = initialState;
	}

	/**
	 * Create the document list indicator element
	 */
	create(): HTMLElement {
		this.indicatorEl = this.container.createDiv({ cls: 'nova-context-indicator nova-context-indicator-positioned' });
		return this.indicatorEl;
	}

	/**
	 * Get the indicator element
	 */
	getElement(): HTMLElement | null {
		return this.indicatorEl;
	}

	/**
	 * Update the drawer state from external source (e.g., click outside handler)
	 */
	setDrawerOpen(open: boolean): void {
		this.isDrawerOpen = open;
		if (!open && this.indicatorEl) {
			this.indicatorEl.removeClass('drawer-open');
			const expandedEl = this.indicatorEl.querySelector('.nova-context-expanded');
			if (expandedEl) {
				expandedEl.removeClass('show');
			}
		}
	}

	/**
	 * Check if drawer is currently open
	 */
	isOpen(): boolean {
		return this.isDrawerOpen;
	}

	/**
	 * Update the document list display
	 */
	update(): void {
		if (!this.indicatorEl) {
			return;
		}

		const isMobile = Platform.isMobile;
		const { currentContext, currentFilePath } = this.state;

		// Check if we actually need to recreate the indicator
		const newDocCount = currentContext?.persistentDocs?.length || 0;
		const currentDocCount = this.indicatorEl.getAttribute('data-doc-count');
		const currentStoredPath = this.indicatorEl.getAttribute('data-file-path');
		const newFilePath = currentFilePath || '';
		
		// Only skip recreation if same file AND same doc count
		if (currentDocCount === newDocCount.toString() && 
			currentStoredPath === newFilePath && 
			newDocCount > 0) {
			return;
		}

		this.indicatorEl.empty();
		
		if (!currentContext || !currentContext.persistentDocs) {
			this.indicatorEl.removeClass('show');
			this.indicatorEl.removeAttribute('data-doc-count');
			this.indicatorEl.removeAttribute('data-file-path');
			return;
		}
		
		const allDocs = currentContext.persistentDocs;
		
		if (!allDocs || allDocs.length === 0) {
			this.indicatorEl.removeClass('show');
			this.indicatorEl.removeAttribute('data-doc-count');
			this.indicatorEl.removeAttribute('data-file-path');
			return;
		}

		// Store doc count and file path to prevent unnecessary recreation
		this.indicatorEl.setAttribute('data-doc-count', allDocs.length.toString());
		this.indicatorEl.setAttribute('data-file-path', currentFilePath || '');

		// Show as thin line with mobile-optimized sizing
		this.indicatorEl.addClass('nova-context-indicator-dynamic');
		this.indicatorEl.addClass('show');

		// Single line summary
		const summaryEl = this.indicatorEl.createDiv({ cls: 'nova-context-summary' });
		
		const summaryTextEl = summaryEl.createSpan({ cls: 'nova-context-summary-text' });
		
		const docNames = allDocs.filter(doc => doc?.file?.basename).map(doc => doc.file.basename).slice(0, isMobile ? 1 : 2);
		const moreCount = allDocs.length > (isMobile ? 1 : 2) ? ` +${allDocs.length - (isMobile ? 1 : 2)}` : '';
		
		summaryTextEl.addClass('nova-context-summary-text');
		
		const filenamePartEl = summaryTextEl.createSpan({ cls: 'nova-context-filename-part' });
		const iconSpan = filenamePartEl.createSpan({ cls: 'nova-context-icon-span' });
		setIcon(iconSpan, 'book-open');
		
		const textSpan = filenamePartEl.createSpan({ cls: 'nova-context-text-span' });
		textSpan.textContent = `${docNames.join(', ')}${moreCount}`;
		
		// Mobile-friendly more menu indicator
		const expandIndicatorEl = summaryEl.createSpan({ cls: 'nova-context-expand-indicator' });
		setIcon(expandIndicatorEl, 'more-horizontal');
		if (isMobile) {
			expandIndicatorEl.addClass('is-mobile');
		}
		expandIndicatorEl.setAttr('title', 'Tap to manage documents');
		
		// Visual feedback on mobile
		if (isMobile) {
			this.callbacks.registerDomEvent(summaryEl, 'touchstart', () => {
				expandIndicatorEl.addClass('pressed');
			});
			this.callbacks.registerDomEvent(summaryEl, 'touchend', () => {
				this.callbacks.addTrackedTimeout(() => {
					expandIndicatorEl.removeClass('pressed');
				}, ContextDocumentList.HOVER_TIMEOUT_MS);
			});
		}

		// Expanded state - mobile-responsive overlay
		const expandedEl = this.indicatorEl.createDiv({ cls: 'nova-context-expanded' });
		expandedEl.addClass('nova-context-expanded');
		if (isMobile) {
			expandedEl.addClass('is-mobile');
		}
		
		// Header for expanded state
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
		clearAllBtnComponent.setIcon('trash-2')
			.setTooltip('Clear all documents from context')
			.onClick(async () => {
				await this.callbacks.onClearAllDocuments();
			});
		
		const clearAllBtn = clearAllBtnComponent.buttonEl;
		clearAllBtn.addClass('nova-context-clear-all-btn');
		if (isMobile) {
			clearAllBtn.addClass('is-mobile');
		}
		
		if (isMobile) {
			this.callbacks.registerDomEvent(clearAllBtn, 'touchstart', () => {
				clearAllBtn.addClass('nova-button-pressed');
			});
			this.callbacks.registerDomEvent(clearAllBtn, 'touchend', () => {
				this.callbacks.addTrackedTimeout(() => {
					clearAllBtn.removeClass('nova-button-pressed');
				}, ContextDocumentList.HOVER_TIMEOUT_MS);
			});
		}
		
		// Document list for expanded state
		const docListEl = expandedEl.createDiv({ cls: 'nova-context-doc-list' });
		
		allDocs.filter(doc => doc?.file?.basename).forEach((doc, index) => {
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
			
			this.callbacks.registerDomEvent(removeBtn, 'click', (e: Event) => {
				e.stopPropagation();
				void this.callbacks.onRemoveDocument(doc.file.path);
			});
			
			if (isMobile) {
				this.callbacks.registerDomEvent(removeBtn, 'touchstart', () => {
					removeBtn.addClass('pressed');
				});
				
				this.callbacks.registerDomEvent(removeBtn, 'touchend', () => {
					this.callbacks.addTrackedTimeout(() => {
						removeBtn.removeClass('pressed');
					}, ContextDocumentList.HOVER_TIMEOUT_MS);
				});
			}
		});

		// Drawer always starts closed on file switch
		this.isDrawerOpen = false;
		expandedEl.removeClass('show');

		// Click to expand management overlay
		const toggleExpanded = (e: MouseEvent) => {
			e.stopPropagation();
			this.isDrawerOpen = !this.isDrawerOpen;
			
			if (this.isDrawerOpen) {
				expandedEl.addClass('show');
				this.indicatorEl?.addClass('drawer-open');
			} else {
				expandedEl.removeClass('show');
				this.indicatorEl?.removeClass('drawer-open');
			}
		};
		
		this.callbacks.registerDomEvent(summaryEl, 'click', toggleExpanded);
	}

	/**
	 * Update the state
	 */
	updateState(newState: Partial<DocumentListState>): void {
		this.state = { ...this.state, ...newState };
	}
}
