/**
 * @file ContextQuickPanel - Live context preview panel for wikilink references
 *
 * Shows a preview of which documents will be included in context as the user
 * types wikilink references in the input area. Extracted from sidebar-view.ts.
 */

import { App, TFile, setIcon } from 'obsidian';
import { ContextManager } from './context-manager';
import { InputHandler } from './input-handler';
import { TimeoutManager } from '../utils/timeout-manager';

/** Dependencies injected from the parent sidebar view */
export interface ContextQuickPanelDeps {
	app: App;
	inputContainer: HTMLElement;
	inputHandler: InputHandler;
	contextManager: ContextManager;
	timeoutManager: TimeoutManager;
	getCurrentFile: () => TFile | null;
}

export class ContextQuickPanel {
	private deps: ContextQuickPanelDeps;
	private previewEl: HTMLElement | null = null;
	private debounceTimeout: number | null = null;

	private static readonly DEBOUNCE_MS = 300;

	constructor(deps: ContextQuickPanelDeps) {
		this.deps = deps;
	}

	/**
	 * Create the context preview DOM element.
	 * Returns the element so the caller can store a reference.
	 */
	createPreview(): HTMLElement {
		const previewContainer = this.deps.inputContainer.createDiv({
			cls: 'nova-context-preview nova-context-preview-container'
		});

		const previewText = previewContainer.createSpan({
			cls: 'nova-context-preview-text nova-preview-text'
		});
		const iconEl = previewText.createSpan();
		setIcon(iconEl, 'book-open');
		previewText.createSpan({ text: ' Context will include: ' });

		previewContainer.createSpan({
			cls: 'nova-context-preview-list nova-preview-list'
		});

		this.previewEl = previewContainer;
		return previewContainer;
	}

	/**
	 * Debounced update of the live context preview.
	 * Call this on every input change.
	 */
	debouncedUpdate(): void {
		if (this.debounceTimeout) {
			this.deps.timeoutManager.removeTimeout(this.debounceTimeout);
		}

		this.debounceTimeout = this.deps.timeoutManager.addTimeout(() => {
			this.updatePreview();
			this.debounceTimeout = null;
		}, ContextQuickPanel.DEBOUNCE_MS);
	}

	/**
	 * Immediately update the live context preview (no debounce).
	 */
	updatePreview(): void {
		const preview = this.previewEl ?? this.deps.contextManager.contextPreview;
		if (!preview) return;

		const message = this.deps.inputHandler.getTextArea().getValue();
		if (!message) {
			preview.removeClass('show');
			return;
		}

		// Parse document references from current message
		const refPattern = /(\+)?\[\[([^\]]+?)(?:#([^\]]+?))?\]\]/g;
		const foundRefs: Array<{ name: string; property?: string }> = [];
		let match;

		while ((match = refPattern.exec(message)) !== null) {
			const docName = match[2];
			const property = match[3];

			const file = this.findFileByName(docName);
			if (file) {
				foundRefs.push({ name: docName, property });
			}
		}

		// Add existing persistent context for current file
		const currentFile = this.deps.getCurrentFile();
		const persistentDocs = this.deps.contextManager.getPersistentContext(
			currentFile?.path || ''
		);
		persistentDocs.forEach(doc => {
			const exists = foundRefs.some(ref => ref.name === doc.file.basename);
			if (!exists) {
				foundRefs.push({
					name: doc.file.basename,
					property: doc.property
				});
			}
		});

		// Update preview
		if (foundRefs.length > 0) {
			const previewList = preview.querySelector(
				'.nova-context-preview-list'
			) as HTMLElement;
			if (previewList) {
				const docNames = foundRefs.map(ref => {
					const suffix = ref.property ? `#${ref.property}` : '';
					return `${ref.name}${suffix}`;
				});
				previewList.textContent = docNames.join(', ');
			}
			preview.addClass('show');
		} else {
			preview.removeClass('show');
		}
	}

	/**
	 * Hide the preview panel.
	 */
	hide(): void {
		const preview = this.previewEl ?? this.deps.contextManager.contextPreview;
		if (preview) {
			preview.removeClass('show');
		}
	}

	/**
	 * Resolve a filename/path to a TFile using vault and metadata cache.
	 */
	private findFileByName(nameOrPath: string): TFile | null {
		const { app } = this.deps;

		let file = app.vault.getFileByPath(nameOrPath);
		if (!file) {
			file = app.vault.getFileByPath(nameOrPath + '.md');
		}
		if (!file) {
			file = app.metadataCache.getFirstLinkpathDest(nameOrPath, '');
		}
		return file instanceof TFile ? file : null;
	}
}
