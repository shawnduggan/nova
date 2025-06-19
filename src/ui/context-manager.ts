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
	private currentFilePath: string | null = null; // Track current file for validation
	private currentOperationId: string | null = null; // Track current async operation
	private sidebarView: any; // Reference to NovaSidebarView for adding files
	private drawerStates: Map<string, boolean> = new Map(); // File-scoped drawer state
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

		// Validate we have a current file set
		if (!this.currentFilePath) {
			this.contextPreview.style.display = 'none';
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

		// Validate we have a current file set for validation
		if (!this.currentFilePath) {
			return null;
		}

		// Generate operation ID to prevent race conditions
		const operationId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
		this.currentOperationId = operationId;
		
		// Track current file path for validation
		const targetFilePath = currentFile.path;
		
		// Validate the requested file matches our current tracked file
		if (this.currentFilePath !== targetFilePath) {
			return null;
		}

		try {
			const result = await this.multiDocHandler.buildContext(message, currentFile);
			
			// Validate operation is still current and file hasn't changed
			if (this.currentOperationId !== operationId || 
				!this.currentFilePath || 
				this.currentFilePath !== targetFilePath) {
				return null;
			}

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
		this.currentFilePath = null;
		this.currentOperationId = null;
		this.hideContextIndicator();
		this.hideContextPreview();
	}

	/**
	 * Set current file and immediately clear context to prevent bleeding
	 * This should be called synchronously when file switches occur
	 */
	setCurrentFile(file: TFile | null): void {
		const newFilePath = file?.path || null;
		
		if (this.currentFilePath !== newFilePath) {
			// Immediately clear context state to prevent bleeding
			this.currentContext = null;
			this.currentOperationId = null; // Cancel any pending operations
			this.hideContextIndicator();
			this.hideContextPreview();
		}
		
		this.currentFilePath = newFilePath;
	}

	getCurrentContext(): MultiDocContext | null {
		return this.currentContext;
	}

	getCurrentFilePath(): string | null {
		return this.currentFilePath;
	}

	/**
	 * Initialize context for a new file (drawer always starts closed)
	 */
	async initializeForFile(file: TFile | null): Promise<void> {
		const newFilePath = file?.path || null;
		
		// Set current file and clear any stale context
		if (this.currentFilePath !== newFilePath) {
			this.currentContext = null;
			this.currentOperationId = null;
			this.hideContextIndicator();
			this.hideContextPreview();
		}
		
		this.currentFilePath = newFilePath;
		
		// Always start with drawer closed for new files
		if (newFilePath) {
			this.drawerStates.set(newFilePath, false);
		}
		
		// Load context data and update indicator
		await this.refreshContextFromStorage();
	}

	/**
	 * Get drawer state for current file
	 */
	getDrawerState(): boolean {
		if (!this.currentFilePath) return false;
		return this.drawerStates.get(this.currentFilePath) || false;
	}

	/**
	 * Set drawer state for current file
	 */
	setDrawerState(expanded: boolean): void {
		if (!this.currentFilePath) return;
		this.drawerStates.set(this.currentFilePath, expanded);
	}

	/**
	 * Add document to context for current file
	 */
	async addDocument(file: TFile): Promise<void> {
		if (!this.currentFilePath) return;
		
		// Get current persistent context
		const current = this.multiDocHandler.getPersistentContext(this.currentFilePath) || [];
		
		// Check if document is already in context
		const exists = current.some(doc => doc.file.path === file.path);
		if (exists) return;
		
		// Add the document
		const newRef = { file, property: undefined };
		const updated = [...current, newRef];
		
		// Update persistent context directly (following existing pattern)
		(this.multiDocHandler as any).persistentContext.set(this.currentFilePath, updated);
		
		// Refresh context and indicator
		await this.refreshContextFromStorage();
	}

	/**
	 * Remove document from context for current file
	 */
	async removeDocument(file: TFile): Promise<void> {
		if (!this.currentFilePath) return;
		
		// Use the existing method
		this.multiDocHandler.removePersistentDoc(this.currentFilePath, file.path);
		
		// Refresh context and indicator
		await this.refreshContextFromStorage();
	}

	/**
	 * Update indicator based on current context state
	 * Note: SidebarView handles actual UI updates to preserve complex drawer functionality
	 */
	updateIndicator(): void {
		// State is managed here, but UI updates are handled by SidebarView
		// This method exists for API completeness but doesn't update UI directly
	}

	/**
	 * Private method to refresh context from storage and update indicator
	 */
	private async refreshContextFromStorage(): Promise<void> {
		if (!this.currentFilePath) {
			this.currentContext = null;
			this.hideContextIndicator();
			return;
		}

		try {
			// Get persistent context for current file
			const persistentDocs = this.multiDocHandler.getPersistentContext(this.currentFilePath) || [];
			
			if (persistentDocs.length === 0) {
				this.currentContext = null;
				this.hideContextIndicator();
				return;
			}

			// Calculate token count
			let totalTokens = 0;
			
			// Add current file tokens
			try {
				const currentFile = this.app.vault.getAbstractFileByPath(this.currentFilePath);
				if (currentFile instanceof TFile) {
					const currentContent = await this.app.vault.read(currentFile);
					totalTokens += Math.ceil(currentContent.length / 4);
				}
			} catch (error) {
				// Skip if can't read current file
			}
			
			// Add persistent docs tokens
			for (const doc of persistentDocs) {
				try {
					const content = await this.app.vault.read(doc.file);
					totalTokens += Math.ceil(content.length / 4);
				} catch (error) {
					// Skip files that can't be read
				}
			}

			// Get token limit from settings
			const tokenLimit = this.plugin.settings.general.defaultMaxTokens || 8000;

			// Build context object
			this.currentContext = {
				persistentDocs: persistentDocs,
				contextString: '', // Not needed for UI
				tokenCount: totalTokens,
				isNearLimit: totalTokens > (tokenLimit * 0.8) // 80% threshold
			};

			// Note: UI updates handled by SidebarView to preserve complex drawer functionality

			// Check token limit
			if (this.currentContext.isNearLimit) {
				new Notice('⚠️ Approaching token limit. Consider removing some documents from context.', ContextManager.NOTICE_DURATION_MS);
			}

		} catch (error) {
			// Handle context build failures gracefully
			this.currentContext = null;
			this.hideContextIndicator();
		}
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