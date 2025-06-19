import { App, Platform, TFile, Notice, CachedMetadata } from 'obsidian';
import NovaPlugin from '../../main';
import { ConversationData } from '../core/types';

export interface DocumentReference {
	/** The file being referenced */
	file: TFile;
	
	/** Whether this is persistent context (+[[doc]]) */
	isPersistent: boolean;
	
	/** The raw reference text (e.g., "[[My Document]]") */
	rawReference: string;
	
	/** Specific property to extract (e.g., "[[doc#property]]") */
	property?: string;
}

export interface MultiDocContext {
	/** Documents in persistent context */
	persistentDocs: DocumentReference[];
	
	/** Combined context string */
	contextString: string;
	
	/** Estimated token count */
	tokenCount: number;
	
	/** Whether we're approaching token limit */
	isNearLimit: boolean;
}

/**
 * Handles multi-document context UI and management
 */
export class ContextManager {
	private plugin: NovaPlugin;
	private app: App;
	private container: HTMLElement;
	private persistentContext: Map<string, DocumentReference[]> = new Map();
	private readonly TOKEN_LIMIT = 8000;
	private readonly WARNING_THRESHOLD = 0.8;
	public contextIndicator!: HTMLElement;
	public contextPreview!: HTMLElement;
	private currentContext: MultiDocContext | null = null;
	private currentFilePath: string | null = null; // Track current file for validation
	private currentOperationId: string | null = null; // Track current async operation
	private sidebarView: any; // Reference to NovaSidebarView for adding files
	private static readonly NOTICE_DURATION_MS = 5000;

	constructor(plugin: NovaPlugin, app: App, container: HTMLElement) {
		this.plugin = plugin;
		this.app = app;
		this.container = container;
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
			// Parse current message
			const { cleanedMessage, references } = this.parseMessage(message, currentFile.path);

			// Get existing persistent context for this conversation
			const existingPersistent = this.persistentContext.get(currentFile.path) || [];
			
			// Add new references to persistent context (all references are now persistent)
			if (references.length > 0) {
				const updatedPersistent = [...existingPersistent];
				
				// Add new references that aren't already in persistent context
				for (const ref of references) {
					const exists = updatedPersistent.some(existing => existing.file.path === ref.file.path);
					if (!exists) {
						updatedPersistent.push(ref);
					}
				}
				
				this.persistentContext.set(currentFile.path, updatedPersistent);
			}
			
			// Get final persistent context (including newly added docs)
			const rawPersistentDocs = this.persistentContext.get(currentFile.path) || [];
			
			// Filter out any stale file references (files that no longer exist)
			const allPersistentDocs = rawPersistentDocs.filter(docRef => {
				if (!docRef?.file || !this.app.vault.getAbstractFileByPath(docRef.file.path)) {
					return false;
				}
				return true;
			});
			
			// Update the persistent context to remove stale references
			if (allPersistentDocs.length !== rawPersistentDocs.length) {
				if (allPersistentDocs.length > 0) {
					this.persistentContext.set(currentFile.path, allPersistentDocs);
				} else {
					this.persistentContext.delete(currentFile.path);
				}
			}

			// Build context string from all documents
			const contextParts: string[] = [];
			
			// ALWAYS include current file content and metadata first (implicit context)
			const currentFileContext = await this.getFullDocumentContext(currentFile, true, 100);
			if (currentFileContext) {
				contextParts.push(currentFileContext);
			}
			
			// Then add all persistent documents with their metadata
			for (const docRef of allPersistentDocs) {
				const contextPart = await this.getDocumentContext(docRef);
				if (contextPart) {
					contextParts.push(contextPart);
				}
			}

			const contextString = contextParts.join('\n\n---\n\n');
			const tokenCount = this.estimateTokens(contextString);
			const isNearLimit = tokenCount > (this.TOKEN_LIMIT * this.WARNING_THRESHOLD);

			const context: MultiDocContext = {
				persistentDocs: allPersistentDocs,
				contextString,
				tokenCount,
				isNearLimit
			};
			
			// Validate operation is still current and file hasn't changed
			if (this.currentOperationId !== operationId || 
				!this.currentFilePath || 
				this.currentFilePath !== targetFilePath) {
				return null;
			}

			this.currentContext = context;

			if (context?.persistentDocs.length) {
				this.updateContextIndicator(context);
				
				// Check token limit
				if (context.isNearLimit) {
					new Notice('⚠️ Approaching token limit. Consider removing some documents from context.', ContextManager.NOTICE_DURATION_MS);
				}
			}

			return context;
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
		
		// Note: Drawer visibility is determined by context presence
		// UI will show drawer if file has context documents
		
		// Load context data and update indicator
		await this.refreshContextFromStorage();
	}

	/**
	 * Check if drawer should be visible (has context documents)
	 */
	isDrawerVisible(): boolean {
		const context = this.getCurrentContext();
		return (context?.persistentDocs?.length || 0) > 0;
	}

	/**
	 * Add document to context for current file
	 */
	async addDocument(file: TFile): Promise<void> {
		if (!this.currentFilePath) return;
		
		// Get current persistent context
		const current = this.persistentContext.get(this.currentFilePath) || [];
		
		// Check if document is already in context
		const exists = current.some(doc => doc.file.path === file.path);
		if (exists) return;
		
		// Add the document
		const newRef: DocumentReference = { 
			file, 
			property: undefined,
			isPersistent: true,
			rawReference: `[[${file.basename}]]`
		};
		const updated = [...current, newRef];
		
		// Update persistent context directly
		this.persistentContext.set(this.currentFilePath, updated);
		
		// Refresh context and indicator
		await this.refreshContextFromStorage();
	}

	/**
	 * Remove document from context for current file
	 */
	async removeDocument(file: TFile): Promise<void> {
		if (!this.currentFilePath) return;
		
		// Remove the document from persistent context
		const current = this.persistentContext.get(this.currentFilePath) || [];
		const filtered = current.filter(ref => ref.file.path !== file.path);
		
		if (filtered.length > 0) {
			this.persistentContext.set(this.currentFilePath, filtered);
		} else {
			this.persistentContext.delete(this.currentFilePath);
		}
		
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
			const persistentDocs = this.persistentContext.get(this.currentFilePath) || [];
			
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

	/**
	 * Parse a message for document references
	 */
	parseMessage(message: string, conversationFilePath: string): {
		cleanedMessage: string;
		references: DocumentReference[];
	} {
		const references: DocumentReference[] = [];
		let cleanedMessage = message;

		// Pattern to match [[doc]] and +[[doc]] with optional property
		// Note: All document references are now persistent for simplified UX
		const refPattern = /(\+)?\[\[([^\]]+?)(?:#([^\]]+?))?\]\]/g;
		
		let match;
		while ((match = refPattern.exec(message)) !== null) {
			const docName = match[2];
			const property = match[3];
			const rawReference = match[0];

			// Try to find the file
			const file = this.findFile(docName);
			
			if (file) {
				references.push({
					file,
					isPersistent: true, // All references are now persistent
					rawReference,
					property
				});
			}
		}

		// Remove all found references from message
		for (const ref of references) {
			cleanedMessage = cleanedMessage.replace(ref.rawReference, ' ');
		}

		// Clean up excessive spaces but preserve necessary spacing
		cleanedMessage = cleanedMessage.replace(/\s{2,}/g, ' ').trim();

		// Update persistent context if needed
		const persistentRefs = references.filter(ref => ref.isPersistent);
		if (persistentRefs.length > 0) {
			const existing = this.persistentContext.get(conversationFilePath) || [];
			const updatedPersistent = [...existing];
			
			// Add new references that aren't already in persistent context
			for (const ref of persistentRefs) {
				const exists = updatedPersistent.some(existing => existing.file.path === ref.file.path);
				if (!exists) {
					updatedPersistent.push(ref);
				}
			}
			
			this.persistentContext.set(conversationFilePath, updatedPersistent);
		}

		return { cleanedMessage, references };
	}

	/**
	 * Get full document context including metadata/properties
	 */
	private async getFullDocumentContext(file: TFile, includeContent: boolean = true, maxLines: number = 50): Promise<string | null> {
		try {
			let contextParts: string[] = [];
			
			// Add document header
			contextParts.push(`## Document: ${file.basename}`);
			
			// Get and add metadata/properties if available
			const cache = this.app.metadataCache.getFileCache(file);
			if (cache?.frontmatter && Object.keys(cache.frontmatter).length > 0) {
				contextParts.push('\n### Properties/Metadata:');
				for (const [key, value] of Object.entries(cache.frontmatter)) {
					// Format the property value (handle arrays, objects, etc.)
					const formattedValue = typeof value === 'object' ? JSON.stringify(value) : value;
					contextParts.push(`- ${key}: ${formattedValue}`);
				}
			}
			
			// Add content if requested
			if (includeContent) {
				const content = await this.app.vault.read(file);
				if (content) {
					const lines = content.split('\n');
					
					// Skip frontmatter in content display (between --- markers)
					let contentStartIndex = 0;
					if (lines[0] === '---') {
						for (let i = 1; i < lines.length; i++) {
							if (lines[i] === '---') {
								contentStartIndex = i + 1;
								break;
							}
						}
					}
					
					const contentLines = lines.slice(contentStartIndex);
					const truncatedContent = contentLines.slice(0, maxLines).join('\n');
					const wasTruncated = contentLines.length > maxLines;
					
					contextParts.push('\n### Content:');
					contextParts.push(truncatedContent);
					if (wasTruncated) {
						contextParts.push('\n[... truncated for brevity ...]');
					}
				}
			}
			
			return contextParts.join('\n');
		} catch (error) {
			// Failed to read full context - graceful fallback
			return null;
		}
	}

	/**
	 * Get context for a specific document reference
	 */
	private async getDocumentContext(docRef: DocumentReference): Promise<string | null> {
		try {
			const { file, property } = docRef;
			
			// Validate that the file still exists in the vault
			if (!file || !this.app.vault.getAbstractFileByPath(file.path)) {
				// File no longer exists - graceful fallback
				return null;
			}
			
			if (property) {
				// Get specific property from frontmatter
				const cache = this.app.metadataCache.getFileCache(file);
				if (cache?.frontmatter && cache.frontmatter[property]) {
					return `## ${file.basename} - ${property}\n${cache.frontmatter[property]}`;
				}
				return null;
			} else {
				// Get full document context with metadata
				return this.getFullDocumentContext(file);
			}
		} catch (error) {
			// Failed to read context - graceful fallback
			return null;
		}
	}

	/**
	 * Find a file by name or path
	 */
	private findFile(nameOrPath: string): TFile | null {
		// First try exact path match
		let file = this.app.vault.getAbstractFileByPath(nameOrPath);
		
		if (!file || !(file instanceof TFile)) {
			// Try with .md extension
			file = this.app.vault.getAbstractFileByPath(nameOrPath + '.md');
		}
		
		if (!file || !(file instanceof TFile)) {
			// Search by basename
			const files = this.app.vault.getMarkdownFiles();
			file = files.find(f => 
				f.basename === nameOrPath || 
				f.name === nameOrPath ||
				f.path.endsWith('/' + nameOrPath) ||
				f.path.endsWith('/' + nameOrPath + '.md')
			) || null;
		}
		
		return file instanceof TFile ? file : null;
	}

	/**
	 * Estimate token count (rough approximation)
	 */
	private estimateTokens(text: string): number {
		// Rough estimate: ~4 characters per token
		return Math.ceil(text.length / 4);
	}

	/**
	 * Clear persistent context for a conversation
	 */
	clearPersistentContext(filePath: string): void {
		this.persistentContext.delete(filePath);
	}

	/**
	 * Get persistent context for a conversation
	 */
	getPersistentContext(filePath: string): DocumentReference[] {
		return this.persistentContext.get(filePath) || [];
	}

	/**
	 * Remove a specific document from persistent context
	 */
	removePersistentDoc(filePath: string, docToRemove: string): void {
		const current = this.persistentContext.get(filePath) || [];
		const filtered = current.filter(ref => ref.file.path !== docToRemove);
		
		if (filtered.length > 0) {
			this.persistentContext.set(filePath, filtered);
		} else {
			this.persistentContext.delete(filePath);
		}
	}

	/**
	 * Get visual indicators for context state
	 */
	getContextIndicators(context: MultiDocContext): {
		text: string;
		className: string;
		tooltip: string;
	} {
		const docCount = context.persistentDocs.length;
		const percentage = Math.round((context.tokenCount / this.TOKEN_LIMIT) * 100);
		
		let className = 'nova-context-indicator';
		let tooltip = `Context: ${docCount} document${docCount !== 1 ? 's' : ''}, ~${context.tokenCount} tokens`;
		
		if (context.isNearLimit) {
			className += ' nova-context-warning';
			tooltip += ' (approaching limit)';
		}
		
		const text = `${docCount} docs ${percentage}%`;
		
		return { text, className, tooltip };
	}

	/**
	 * Format context for display in UI
	 */
	formatContextForDisplay(context: MultiDocContext): string[] {
		const items: string[] = [];
		
		// Add persistent documents
		for (const doc of context.persistentDocs) {
			items.push(`${doc.file.basename}${doc.property ? `#${doc.property}` : ''}`);
		}
		
		return items;
	}
}