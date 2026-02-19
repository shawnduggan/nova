/**
 * @file ContextQuickPanel - The collapsible context preview panel at top of sidebar
 */

import { setIcon } from 'obsidian';
import { ContextManager } from './context-manager';
import { Logger } from '../utils/logger';

export interface QuickPanelDependencies {
	getInputValue: () => string;
	getPersistentContext: (filePath: string) => Array<{ file: { basename: string }; property?: string }>;
	getCurrentFilePath: () => string | null;
	findFileByName: (name: string) => { basename: string } | null;
}

export class ContextQuickPanel {
	private container: HTMLElement;
	private previewEl: HTMLElement | null = null;
	private dependencies: QuickPanelDependencies;

	constructor(container: HTMLElement, dependencies: QuickPanelDependencies) {
		this.container = container;
		this.dependencies = dependencies;
	}

	/**
	 * Create the preview panel element
	 */
	create(): HTMLElement {
		const previewContainer = this.container.createDiv({ cls: 'nova-context-preview nova-context-preview-container' });

		const previewText = previewContainer.createSpan({ cls: 'nova-context-preview-text nova-preview-text' });
		const iconEl = previewText.createSpan();
		setIcon(iconEl, 'book-open');
		previewText.createSpan({ text: ' Context will include: ' });

		previewContainer.createSpan({ cls: 'nova-context-preview-list nova-preview-list' });

		this.previewEl = previewContainer;
		return previewContainer;
	}

	/**
	 * Get the preview element
	 */
	getElement(): HTMLElement | null {
		return this.previewEl;
	}

	/**
	 * Update the preview based on current input and persistent context
	 */
	update(): void {
		if (!this.previewEl) {
			return;
		}

		const message = this.dependencies.getInputValue();
		if (!message) {
			this.previewEl.removeClass('show');
			return;
		}

		// Parse document references from current message
		const refPattern = /(\+)?\[\[([^\]]+?)(?:#([^\]]+?))?\]\]/g;
		const foundRefs: Array<{name: string, property?: string}> = [];
		let match;

		while ((match = refPattern.exec(message)) !== null) {
			const docName = match[2];
			const property = match[3];
			
			// Try to find the file to validate it exists
			const file = this.dependencies.findFileByName(docName);
			if (file) {
				foundRefs.push({
					name: docName,
					property
				});
			}
		}

		// Add existing persistent context for current file
		const currentFilePath = this.dependencies.getCurrentFilePath();
		if (currentFilePath) {
			const persistentDocs = this.dependencies.getPersistentContext(currentFilePath);
			persistentDocs.forEach(doc => {
				// Only add if not already in foundRefs to avoid duplicates
				const exists = foundRefs.some(ref => ref.name === doc.file.basename);
				if (!exists) {
					foundRefs.push({
						name: doc.file.basename,
						property: doc.property
					});
				}
			});
		}

		// Update preview
		if (foundRefs.length > 0) {
			const previewList = this.previewEl.querySelector('.nova-context-preview-list') as HTMLElement;
			if (previewList) {
				const docNames = foundRefs.map(ref => {
					const suffix = ref.property ? `#${ref.property}` : '';
					return `${ref.name}${suffix}`;
				});
				previewList.textContent = docNames.join(', ');
			}
			this.previewEl.addClass('show');
		} else {
			this.previewEl.removeClass('show');
		}
	}

	/**
	 * Hide the preview panel
	 */
	hide(): void {
		if (this.previewEl) {
			this.previewEl.removeClass('show');
		}
	}
}
