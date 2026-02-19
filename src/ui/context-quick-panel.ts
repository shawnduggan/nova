/**
 * @file ContextQuickPanel - Collapsible panel showing context summary at top of sidebar
 */

import { Platform, setIcon, ButtonComponent } from 'obsidian';
import type { MultiDocContext } from './context-manager';

export interface ContextQuickPanelCallbacks {
    onRefreshContext: () => Promise<void>;
    onRemoveDocument: (docPath: string) => Promise<void>;
    onClearAllDocuments: () => Promise<void>;
}

export class ContextQuickPanel {
    private container: HTMLElement;
    private contextIndicator: HTMLElement;
    private isDrawerOpen: boolean = false;
    private currentContext: MultiDocContext | null = null;
    private currentFilePath: string = '';
    private callbacks: ContextQuickPanelCallbacks;
    private timeoutManager: { addTimeout: (fn: () => void, ms: number) => number; removeTimeout: (id: number) => void };

    constructor(
        container: HTMLElement,
        callbacks: ContextQuickPanelCallbacks,
        timeoutManager: { addTimeout: (fn: () => void, ms: number) => number; removeTimeout: (id: number) => void }
    ) {
        this.container = container;
        this.callbacks = callbacks;
        this.timeoutManager = timeoutManager;
        this.contextIndicator = container.createDiv({ cls: 'nova-context-indicator nova-context-indicator-positioned' });
    }

    /**
     * Get the context indicator element for external access
     */
    getContextIndicator(): HTMLElement {
        return this.contextIndicator;
    }

    /**
     * Update the panel with new context
     */
    update(currentContext: MultiDocContext | null, currentFilePath: string): void {
        this.currentContext = currentContext;
        this.currentFilePath = currentFilePath;
        this.render();
    }

    /**
     * Render the context indicator
     */
    private render(): void {
        const isMobile = Platform.isMobile;
        
        // Check if we actually need to recreate the indicator
        const newDocCount = this.currentContext?.persistentDocs?.length || 0;
        const currentDocCount = this.contextIndicator.getAttribute('data-doc-count');
        const storedFilePath = this.contextIndicator.getAttribute('data-file-path');
        
        // Only skip recreation if same file AND same doc count
        if (currentDocCount === newDocCount.toString() && 
            storedFilePath === this.currentFilePath && 
            newDocCount > 0) {
            return;
        }

        this.contextIndicator.empty();
        
        if (!this.currentContext || !this.currentContext.persistentDocs) {
            this.contextIndicator.removeClass('show');
            this.contextIndicator.removeAttribute('data-doc-count');
            this.contextIndicator.removeAttribute('data-file-path');
            return;
        }
        
        const allDocs = this.currentContext.persistentDocs;
        
        if (!allDocs || allDocs.length === 0) {
            this.contextIndicator.removeClass('show');
            this.contextIndicator.removeAttribute('data-doc-count');
            this.contextIndicator.removeAttribute('data-file-path');
            return;
        }

        // Store doc count and file path to prevent unnecessary recreation
        this.contextIndicator.setAttribute('data-doc-count', allDocs.length.toString());
        this.contextIndicator.setAttribute('data-file-path', this.currentFilePath);

        // Show as thin line with mobile-optimized sizing
        this.contextIndicator.addClass('nova-context-indicator-dynamic');
        this.contextIndicator.addClass('show');
        
        // Single line summary
        const summaryEl = this.contextIndicator.createDiv({ cls: 'nova-context-summary' });
        
        const summaryTextEl = summaryEl.createSpan({ cls: 'nova-context-summary-text' });
        
        const docNames = allDocs.filter(doc => doc?.file?.basename).map(doc => doc.file.basename).slice(0, isMobile ? 1 : 2);
        const moreCount = allDocs.length > (isMobile ? 1 : 2) ? ` +${allDocs.length - (isMobile ? 1 : 2)}` : '';
        
        summaryTextEl.addClass('nova-context-summary-text');
        
        // Create filename part that can truncate
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
        
        // Visual feedback on the whole summary line
        if (isMobile) {
            this.registerDomEvent(summaryEl, 'touchstart', () => {
                expandIndicatorEl.addClass('pressed');
            });
            this.registerDomEvent(summaryEl, 'touchend', () => {
                this.timeoutManager?.addTimeout(() => {
                    expandIndicatorEl.removeClass('pressed');
                }, 150);
            });
        }

        // Create expanded section
        const expandedEl = this.contextIndicator.createDiv({ cls: 'nova-context-expanded' });
        expandedEl.addClass('nova-context-expanded');
        
        // Header with title and clear all button
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
        const clearAllBtnComponent = new (require('obsidian').ButtonComponent)(expandedHeaderEl);
        clearAllBtnComponent.setIcon('trash-2')
            .setTooltip('Clear all documents from context')
            .onClick(async () => {
                await this.callbacks.onClearAllDocuments();
                await this.callbacks.onRefreshContext();
            });
        
        const clearAllBtn = clearAllBtnComponent.buttonEl;
        clearAllBtn.addClass('nova-context-clear-all-btn');
        if (isMobile) {
            clearAllBtn.addClass('is-mobile');
        }
        
        // Touch-friendly feedback
        if (isMobile) {
            this.registerDomEvent(clearAllBtn, 'touchstart', () => {
                clearAllBtn.addClass('nova-button-pressed');
            });
            this.registerDomEvent(clearAllBtn, 'touchend', () => {
                this.timeoutManager?.addTimeout(() => {
                    clearAllBtn.removeClass('nova-button-pressed');
                }, 150);
            });
        }
        
        // Document list
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
            
            this.registerDomEvent(removeBtn, 'click', (e: Event) => {
                e.stopPropagation();
                void this.callbacks.onRemoveDocument(doc.file.path);
                void this.callbacks.onRefreshContext();
            });
            
            if (isMobile) {
                this.registerDomEvent(removeBtn, 'touchstart', () => {
                    removeBtn.addClass('pressed');
                });
                
                this.registerDomEvent(removeBtn, 'touchend', () => {
                    this.timeoutManager?.addTimeout(() => {
                        removeBtn.removeClass('pressed');
                    }, 150);
                });
            }
        });

        // Drawer always starts closed
        this.isDrawerOpen = false;
        expandedEl.removeClass('show');

        // Toggle expanded
        const toggleExpanded = (e: MouseEvent) => {
            e.stopPropagation();
            this.isDrawerOpen = !this.isDrawerOpen;
            
            if (this.isDrawerOpen) {
                expandedEl.addClass('show');
                this.contextIndicator.addClass('drawer-open');
            } else {
                expandedEl.removeClass('show');
                this.contextIndicator.removeClass('drawer-open');
            }
        };
        
        this.registerDomEvent(summaryEl, 'click', toggleExpanded as (e: Event) => void);
    }

    /**
     * Register DOM event helper
     */
    private registerDomEvent(element: HTMLElement, event: string, handler: (e: Event) => void): void {
        element.addEventListener(event, handler);
    }

    /**
     * Check if drawer is open
     */
    getIsDrawerOpen(): boolean {
        return this.isDrawerOpen;
    }
}
