/**
 * @file ContextDocumentList - Flat list of context entries in the sidebar
 * Extracted from sidebar-view.ts as part of sidebar architecture refactor
 */

import { App, TFile } from 'obsidian';
import NovaPlugin from '../../main';

/**
 * ContextDocumentList displays a flat list of context documents
 * in the sidebar for easy management and visibility.
 * 
 * This is a placeholder implementation extracted from NovaSidebarView.
 * Full implementation will be completed as part of the Auto-Context System.
 */
export class ContextDocumentList {
	private containerEl: HTMLElement;
	private plugin: NovaPlugin;
	private app: App;
	private documents: Array<{ file: TFile; property?: string }> = [];

	constructor(
		plugin: NovaPlugin,
		app: App,
		parentContainer: HTMLElement
	) {
		this.plugin = plugin;
		this.app = app;
		this.containerEl = parentContainer.createDiv({ cls: 'nova-context-document-list' });
	}

	/**
	 * Get the container element for the document list
	 */
	getContainer(): HTMLElement {
		return this.containerEl;
	}

	/**
	 * Set the documents to display
	 */
	setDocuments(docs: Array<{ file: TFile; property?: string }>): void {
		this.documents = [...docs];
		this.render();
	}

	/**
	 * Add a document to the list
	 */
	addDocument(file: TFile, property?: string): void {
		// Check if already exists
		if (!this.documents.some(d => d.file.path === file.path)) {
			this.documents.push({ file, property });
			this.render();
		}
	}

	/**
	 * Remove a document from the list
	 */
	removeDocument(filePath: string): void {
		this.documents = this.documents.filter(d => d.file.path !== filePath);
		this.render();
	}

	/**
	 * Clear all documents from the list
	 */
	clear(): void {
		this.documents = [];
		this.render();
	}

	/**
	 * Get current documents
	 */
	getDocuments(): Array<{ file: TFile; property?: string }> {
		return [...this.documents];
	}

	/**
	 * Render the document list
	 */
	private render(): void {
		this.containerEl.empty();
		
		if (this.documents.length === 0) {
			this.containerEl.removeClass('has-documents');
			return;
		}

		this.containerEl.addClass('has-documents');
		
		// Render document items
		this.documents.forEach(doc => {
			const itemEl = this.containerEl.createDiv({ cls: 'nova-context-doc-item' });
			itemEl.createSpan({ text: doc.file.basename, cls: 'nova-context-doc-name' });
			if (doc.property) {
				itemEl.createSpan({ text: `#${doc.property}`, cls: 'nova-context-doc-property' });
			}
		});
	}

	/**
	 * Show the document list
	 */
	show(): void {
		this.containerEl.addClass('show');
	}

	/**
	 * Hide the document list
	 */
	hide(): void {
		this.containerEl.removeClass('show');
	}

	/**
	 * Destroy and clean up the list
	 */
	destroy(): void {
		this.containerEl.empty();
		this.containerEl.remove();
	}
}
