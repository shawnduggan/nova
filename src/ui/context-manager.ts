import { App, Platform, TFile, Notice } from 'obsidian';
import NovaPlugin from '../../main';
import { MultiDocContextHandler, MultiDocContext } from '../core/multi-doc-context';

/**
 * Handles multi-document context UI and management
 */
export class ContextManager {
	private plugin: NovaPlugin;
	private app: App;
	private container: HTMLElement;
	private multiDocHandler: MultiDocContextHandler;
	public contextIndicator!: HTMLElement;
	public contextPreview!: HTMLElement;
	private currentContext: MultiDocContext | null = null;
	private sidebarView: any; // Reference to NovaSidebarView for adding files
	private static readonly NOTICE_DURATION_MS = 5000;

	constructor(plugin: NovaPlugin, app: App, container: HTMLElement) {
		this.plugin = plugin;
		this.app = app;
		this.container = container;
		this.multiDocHandler = new MultiDocContextHandler(app);
	}

	setSidebarView(sidebarView: any): void {
		this.sidebarView = sidebarView;
	}

	createContextIndicator(): void {
		this.contextIndicator = this.container.createDiv({ cls: 'nova-context-indicator' });
		this.contextIndicator.style.cssText = `
			position: absolute;
			top: -2px;
			right: var(--size-4-3);
			background: var(--background-primary);
			border: 1px solid var(--background-modifier-border);
			border-radius: var(--radius-s);
			padding: var(--size-2-1) var(--size-2-2);
			font-size: var(--font-ui-smaller);
			color: var(--text-muted);
			display: none;
			z-index: 100;
			max-width: 200px;
			box-shadow: var(--shadow-s);
		`;
	}

	createContextPreview(): HTMLElement {
		const previewContainer = this.container.createDiv({ cls: 'nova-context-preview' });
		previewContainer.style.cssText = `
			background: var(--background-modifier-hover);
			border: 1px solid var(--background-modifier-border);
			border-radius: var(--radius-s);
			padding: var(--size-2-2) var(--size-2-3);
			margin-bottom: var(--size-2-2);
			font-size: var(--font-ui-small);
			display: none;
		`;

		const previewLabel = previewContainer.createSpan({ text: 'Context: ' });
		previewLabel.style.cssText = 'color: var(--text-muted); font-weight: 600;';

		const previewList = previewContainer.createSpan({ cls: 'nova-context-preview-list' });
		previewList.style.cssText = 'color: var(--interactive-accent);';

		return previewContainer;
	}

	updateLiveContextPreview(message: string): void {
		if (!this.contextPreview || !this.plugin.featureManager.isFeatureEnabled('multi-doc-context')) {
			return;
		}

		if (!message) {
			this.contextPreview.style.display = 'none';
			return;
		}

		// Parse document references from current message
		const refPattern = /(\+)?\[\[([^\]]+?)(?:#([^\]]+?))?\]\]/g;
		const foundRefs: Array<{name: string, property?: string}> = [];
		let match;

		while ((match = refPattern.exec(message)) !== null) {
			const docName = match[2];
			const property = match[3];
			foundRefs.push({ name: docName, property });
		}

		if (foundRefs.length === 0) {
			this.contextPreview.style.display = 'none';
			return;
		}

		// Update preview display
		const previewList = this.contextPreview.querySelector('.nova-context-preview-list') as HTMLElement;
		if (previewList) {
			const refsText = foundRefs.map(ref => 
				ref.property ? `${ref.name}#${ref.property}` : ref.name
			).join(', ');
			previewList.textContent = refsText;
		}

		this.contextPreview.style.display = 'block';
	}

	async buildContext(message: string, currentFile: TFile | null): Promise<MultiDocContext | null> {
		if (!this.plugin.featureManager.isFeatureEnabled('multi-doc-context') || !currentFile) {
			return null;
		}

		try {
			const result = await this.multiDocHandler.buildContext(message, currentFile);
			this.currentContext = result.context;

			if (result.context?.persistentDocs.length) {
				this.updateContextIndicator(result.context);
				
				// Check token limit
				if (result.context.isNearLimit) {
					new Notice('⚠️ Approaching token limit. Consider removing some documents from context.', ContextManager.NOTICE_DURATION_MS);
				}
			}

			return result.context;
		} catch (error) {
			// Failed to build context - graceful fallback
			return null;
		}
	}

	private updateContextIndicator(context: MultiDocContext): void {
		if (!this.contextIndicator) return;

		const docCount = context.persistentDocs.length;
		if (docCount > 0) {
			this.contextIndicator.textContent = `${docCount} doc${docCount > 1 ? 's' : ''}`;
			this.contextIndicator.style.display = 'block';

			// Add expand functionality
			this.contextIndicator.style.cursor = 'pointer';
			this.contextIndicator.onclick = () => {
				this.showContextDetails(context);
			};

			// Add hover effect
			this.contextIndicator.addEventListener('mouseenter', () => {
				this.contextIndicator.style.background = 'var(--interactive-hover)';
			});

			this.contextIndicator.addEventListener('mouseleave', () => {
				this.contextIndicator.style.background = 'var(--background-primary)';
			});
		} else {
			this.contextIndicator.style.display = 'none';
		}
	}

	private showContextDetails(context: MultiDocContext): void {
		// Create modal or expanded view
		const modal = this.container.createDiv({ cls: 'nova-context-modal' });
		modal.style.cssText = `
			position: fixed;
			top: 0;
			left: 0;
			right: 0;
			bottom: 0;
			background: rgba(0, 0, 0, 0.5);
			display: flex;
			align-items: center;
			justify-content: center;
			z-index: 10000;
		`;

		const content = modal.createDiv();
		content.style.cssText = `
			background: var(--background-primary);
			border: 1px solid var(--background-modifier-border);
			border-radius: var(--radius-s);
			padding: var(--size-4-4);
			max-width: 80%;
			max-height: 80%;
			overflow-y: auto;
			box-shadow: var(--shadow-s);
		`;

		const header = content.createEl('h3', { text: 'Context Documents' });
		header.style.cssText = 'margin-top: 0; margin-bottom: var(--size-4-3);';

		context.persistentDocs.forEach(doc => {
			const docEl = content.createDiv();
			docEl.style.cssText = `
				padding: var(--size-2-2);
				margin-bottom: var(--size-2-2);
				background: var(--background-modifier-hover);
				border-radius: var(--radius-xs);
			`;

			const nameEl = docEl.createEl('div', { text: doc.file.basename });
			nameEl.style.cssText = 'font-weight: 600; margin-bottom: var(--size-2-1);';

			if (doc.property) {
				const propEl = docEl.createEl('div', { text: `Property: ${doc.property}` });
				propEl.style.cssText = 'font-size: var(--font-ui-smaller); color: var(--text-muted);';
			}

			// Show file path as preview since content isn't directly available
			const previewEl = docEl.createEl('div', { text: doc.file.path });
			previewEl.style.cssText = 'font-size: var(--font-ui-smaller); color: var(--text-muted); margin-top: var(--size-2-1);';
		});

		// Button container
		const buttonContainer = content.createDiv();
		buttonContainer.style.cssText = `
			margin-top: var(--size-4-3);
			display: flex;
			gap: var(--size-2-2);
			justify-content: flex-end;
		`;


		// Close button
		const closeBtn = buttonContainer.createEl('button', { text: 'Close' });
		closeBtn.style.cssText = `
			padding: var(--size-2-2) var(--size-4-3);
			background: var(--background-secondary);
			color: var(--text-normal);
			border: 1px solid var(--background-modifier-border);
			border-radius: var(--radius-s);
			cursor: pointer;
		`;

		closeBtn.onclick = () => modal.remove();
		modal.onclick = (e) => {
			if (e.target === modal) modal.remove();
		};
	}

	hideContextPreview(): void {
		if (this.contextPreview) {
			this.contextPreview.style.display = 'none';
		}
	}

	hideContextIndicator(): void {
		if (this.contextIndicator) {
			this.contextIndicator.style.display = 'none';
		}
	}

	clearCurrentContext(): void {
		this.currentContext = null;
		this.hideContextIndicator();
		this.hideContextPreview();
	}

	getCurrentContext(): MultiDocContext | null {
		return this.currentContext;
	}


	cleanup(): void {
		this.clearCurrentContext();
		if (this.contextIndicator) {
			this.contextIndicator.remove();
		}
		if (this.contextPreview) {
			this.contextPreview.remove();
		}
	}
}