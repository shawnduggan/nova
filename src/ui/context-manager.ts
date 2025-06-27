import { App, Platform, TFile, Notice, CachedMetadata } from 'obsidian';
import NovaPlugin from '../../main';
import { ConversationData } from '../core/types';
import { calculateContextUsage, ContextUsage, estimateTokens as calculateTokens } from '../core/context-calculator';

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
	
	/** Estimated token count (for file attachments only) */
	tokenCount: number;
	
	/** Whether we're approaching token limit */
	isNearLimit: boolean;
	
	/** Total context usage calculation including conversation history */
	totalContextUsage?: ContextUsage;
}

/**
 * Handles multi-document context UI and management
 */
export class ContextManager {
	private plugin: NovaPlugin;
	private app: App;
	private container: HTMLElement;
	private persistentContext: Map<string, DocumentReference[]> = new Map();
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
		if (!this.contextPreview) {
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
		if (!currentFile) {
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

			// Calculate total context usage including conversation history
			const fileAttachments = contextParts.map(content => ({ content }));
			const totalContextUsage = await this.calculateTotalContextUsage(fileAttachments);

			const context: MultiDocContext = {
				persistentDocs: allPersistentDocs,
				contextString,
				tokenCount,
				isNearLimit: false, // Legacy field - warnings now handled in sidebar-view.ts
				totalContextUsage: totalContextUsage
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
			}

			return context;
		} catch (error) {
			// Failed to build context - graceful fallback
			return null;
		}
	}

	private updateContextIndicator(context: MultiDocContext): void {
		// Context indicator UI is now fully managed by sidebar-view.ts
		// This method is kept for compatibility but does nothing
		// The sidebar-view.ts updateContextIndicator() method handles all display logic
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
	 * Restore context after chat has been loaded (prevents missing file notifications from being cleared)
	 */
	async restoreContextAfterChatLoad(file: TFile | null): Promise<void> {
		// Restore context from conversation manager if available
		if (file && this.plugin.conversationManager) {
			await this.restoreContextFromConversation(file);
		}
		
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
		if (!this.currentFilePath) {
			return;
		}
		
		// Check if trying to add the current file to its own context
		if (file.path === this.currentFilePath) {
			// Current file is already implicitly in context, skip silently
			return;
		}
		
		// Get current persistent context
		const current = this.persistentContext.get(this.currentFilePath) || [];
		
		// Check if document is already in context
		const exists = current.some(doc => doc.file.path === file.path);
		if (exists) {
			return;
		}
		
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
		
		// Save to conversation manager for persistence
		const currentFile = this.app.vault.getAbstractFileByPath(this.currentFilePath);
		
		if (currentFile && currentFile.path && this.plugin.conversationManager) {
			await this.plugin.conversationManager.addContextDocument(currentFile as TFile, file.path);
		}
		
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
		
		// Save to conversation manager for persistence
		const currentFile = this.app.vault.getAbstractFileByPath(this.currentFilePath);
		if (currentFile && currentFile.path && this.plugin.conversationManager) {
			await this.plugin.conversationManager.removeContextDocument(currentFile as TFile, file.path);
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


			// Calculate total context usage for the stored context
			const fileAttachments = persistentDocs.length > 0 ? 
				[{ content: `Context files: ${persistentDocs.map(d => d.file.basename).join(', ')}` }] : 
				[];
			const totalContextUsage = await this.calculateTotalContextUsage(fileAttachments);

			// Build context object
			this.currentContext = {
				persistentDocs: persistentDocs,
				contextString: '', // Not needed for UI
				tokenCount: totalTokens,
				isNearLimit: false, // Legacy field - warnings now handled in sidebar-view.ts
				totalContextUsage: totalContextUsage
			};

			// Note: UI updates handled by SidebarView to preserve complex drawer functionality

		} catch (error) {
			// Handle context build failures gracefully
			this.currentContext = null;
			this.hideContextIndicator();
		}
	}

	/**
	 * Restore context from conversation manager
	 */
	private async restoreContextFromConversation(file: TFile): Promise<void> {
		if (!this.plugin.conversationManager) {
			return;
		}
		
		try {
			// Get saved context documents from conversation manager
			const savedContextDocs = await this.plugin.conversationManager.getContextDocuments(file);
			
			if (savedContextDocs.length === 0) {
				// No saved context, ensure clean state
				this.persistentContext.delete(file.path);
				return;
			}
			
			// Validate and convert ContextDocumentRefs back to DocumentReferences
			const validDocumentRefs: DocumentReference[] = [];
			const invalidPaths: string[] = [];
			
			for (const contextDoc of savedContextDocs) {
				try {
					// Validate context document structure
					if (!contextDoc || !contextDoc.path || typeof contextDoc.path !== 'string') {
						console.warn('Invalid context document structure:', contextDoc);
						continue;
					}
					
					// Find the actual file in the vault
					const contextFile = this.app.vault.getAbstractFileByPath(contextDoc.path);
					
					if (contextFile && contextFile.path && contextFile instanceof TFile) {
						// File exists - add to valid documents
						validDocumentRefs.push({
							file: contextFile,
							property: contextDoc.property,
							isPersistent: true,
							rawReference: contextDoc.property 
								? `[[${contextFile.basename}#${contextDoc.property}]]`
								: `[[${contextFile.basename}]]`
						});
					} else {
						// File missing - track for cleanup
						invalidPaths.push(contextDoc.path);
					}
				} catch (docError) {
					// Skip corrupted individual context documents
					console.warn('Error processing context document, skipping:', docError);
				}
			}
			
			// Clean up missing files from conversation storage and show notice
			if (invalidPaths.length > 0) {
				await this.cleanupMissingFiles(file, invalidPaths);
				this.showMissingFilesNotice(invalidPaths);
			}
			
			// Update persistent context with validated documents
			if (validDocumentRefs.length > 0) {
				this.persistentContext.set(file.path, validDocumentRefs);
			} else {
				// No valid files - clear context
				this.persistentContext.delete(file.path);
			}
			
		} catch (error) {
			// Graceful fallback on restoration errors
			console.warn('Failed to restore context from conversation:', error);
			// Ensure clean state on error
			this.persistentContext.delete(file.path);
		}
	}

	/**
	 * Clean up missing files from conversation storage
	 */
	private async cleanupMissingFiles(file: TFile, invalidPaths: string[]): Promise<void> {
		if (!this.plugin.conversationManager) return;
		
		try {
			// Remove each invalid path from conversation storage
			for (const invalidPath of invalidPaths) {
				await this.plugin.conversationManager.removeContextDocument(file, invalidPath);
			}
		} catch (error) {
			// Graceful fallback if cleanup fails
			console.warn('Failed to cleanup missing files from conversation:', error);
		}
	}

	/**
	 * Show notice and chat message about missing context files
	 */
	private showMissingFilesNotice(missingFiles: string[]): void {
		if (missingFiles.length === 0) return;
		
		try {
			let noticeMessage: string;
			let chatMessage: string;
			
			if (missingFiles.length === 1) {
				noticeMessage = `⚠️ Context file no longer available: ${missingFiles[0]}`;
				chatMessage = `Context file no longer available: ${missingFiles[0]}`;
			} else {
				// Limit display to avoid overly long notices
				const displayFiles = missingFiles.slice(0, 3);
				const remainingCount = missingFiles.length - displayFiles.length;
				
				if (remainingCount > 0) {
					noticeMessage = `⚠️ ${missingFiles.length} context files no longer available: ${displayFiles.join(', ')} and ${remainingCount} more`;
					chatMessage = `${missingFiles.length} context files no longer available: ${displayFiles.join(', ')} and ${remainingCount} more`;
				} else {
					noticeMessage = `⚠️ ${missingFiles.length} context files no longer available: ${displayFiles.join(', ')}`;
					chatMessage = `${missingFiles.length} context files no longer available: ${displayFiles.join(', ')}`;
				}
			}
			
			// Show temporary notice for immediate feedback
			new Notice(noticeMessage, ContextManager.NOTICE_DURATION_MS);
			
			// Add permanent chat message for conversation history
			if (this.sidebarView && typeof this.sidebarView.addWarningMessage === 'function') {
				this.sidebarView.addWarningMessage(chatMessage);
			}
		} catch (error) {
			// Graceful fallback if notice or chat message fails
			console.warn('Failed to show missing files notification:', error);
		}
	}

	/**
	 * Validate all context documents for a file and return results
	 */
	async validateContextDocuments(file: TFile): Promise<{
		validFiles: string[];
		missingFiles: string[];
		totalCount: number;
	}> {
		if (!this.plugin.conversationManager) {
			return { validFiles: [], missingFiles: [], totalCount: 0 };
		}

		try {
			const savedContextDocs = await this.plugin.conversationManager.getContextDocuments(file);
			const validFiles: string[] = [];
			const missingFiles: string[] = [];

			for (const contextDoc of savedContextDocs) {
				const contextFile = this.app.vault.getAbstractFileByPath(contextDoc.path);
				
				if (contextFile && contextFile.path) {
					validFiles.push(contextDoc.path);
				} else {
					missingFiles.push(contextDoc.path);
				}
			}

			return {
				validFiles,
				missingFiles,
				totalCount: savedContextDocs.length
			};
		} catch (error) {
			// Graceful fallback
			return { validFiles: [], missingFiles: [], totalCount: 0 };
		}
	}

	/**
	 * Schedule async persistence update
	 */
	private async schedulePersistenceUpdate(conversationFilePath: string, references: DocumentReference[]): Promise<void> {
		// Run async save in background
		const conversationFile = this.app.vault.getAbstractFileByPath(conversationFilePath);
		if (conversationFile && conversationFile.path && this.plugin.conversationManager) {
			// Convert DocumentReferences to ContextDocumentRefs
			const contextRefs = references.map(ref => ({
				path: ref.file.path,
				property: ref.property,
				addedAt: Date.now()
			}));
			
			// Save all context documents
			await this.plugin.conversationManager.setContextDocuments(conversationFile as TFile, contextRefs);
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
			
			// Schedule async save to conversation manager
			this.schedulePersistenceUpdate(conversationFilePath, updatedPersistent);
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
	 * Calculate total context usage including conversation history
	 */
	async calculateTotalContextUsage(
		fileAttachments: Array<{content: string}> = [],
		currentInput: string = '',
		recentResponse: string = ''
	): Promise<ContextUsage> {
		// Try to get actual provider and model - no hardcoded defaults
		let providerType: string | null = null;
		let model: string | null = null;
		let conversationHistory: Array<{content: string}> = [];
		
		try {
			// Try to get actual provider and model
			const detectedProviderType = await this.plugin.aiProviderManager?.getCurrentProviderType();
			if (detectedProviderType) {
				providerType = detectedProviderType;
				
				// Get model from provider manager
				if (this.plugin.aiProviderManager) {
					try {
						const currentModel = this.plugin.aiProviderManager.getCurrentModel();
						if (currentModel) {
							model = currentModel;
						}
					} catch (error) {
						console.warn('Failed to get current model:', error);
					}
				}
			}
			
			// If no provider or model configured, return minimal context usage
			if (!providerType || !model) {
				return {
					totalTokens: 0,
					contextLimit: 32000, // Generic fallback context size
					usagePercentage: 0,
					breakdown: {
						conversationHistory: 0,
						fileAttachments: 0,
						currentInput: 0,
						recentResponse: 0
					}
				} as ContextUsage;
			}
			
			// Get conversation history for current file
			if (this.currentFilePath && this.plugin.conversationManager) {
				const currentFile = this.app.vault.getAbstractFileByPath(this.currentFilePath) as TFile;
				if (currentFile) {
					const conversation = await this.plugin.conversationManager.getConversation(currentFile);
					conversationHistory = (conversation?.messages || []).map(msg => ({ content: msg.content }));
				}
			}
			
		} catch (error) {
			console.warn('Error during context calculation setup, using defaults:', error);
		}
		
		// Always calculate context usage with fallback values
		const ollamaDefaultContext = this.plugin?.settings?.aiProviders?.ollama?.contextSize || 32000;
		
		const usage = calculateContextUsage(
			providerType!,
			model!,
			conversationHistory,
			fileAttachments,
			currentInput,
			recentResponse,
			ollamaDefaultContext
		);
		
		return usage;
	}

	/**
	 * Clear persistent context for a conversation
	 */
	async clearPersistentContext(filePath: string): Promise<void> {
		this.persistentContext.delete(filePath);
		
		// Also clear from conversation manager
		const conversationFile = this.app.vault.getAbstractFileByPath(filePath);
		if (conversationFile && conversationFile.path && this.plugin.conversationManager) {
			await this.plugin.conversationManager.clearContextDocuments(conversationFile as TFile);
		}
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
	async removePersistentDoc(filePath: string, docToRemove: string): Promise<void> {
		const current = this.persistentContext.get(filePath) || [];
		const filtered = current.filter(ref => ref.file.path !== docToRemove);
		
		if (filtered.length > 0) {
			this.persistentContext.set(filePath, filtered);
		} else {
			this.persistentContext.delete(filePath);
		}
		
		// Also remove from conversation manager
		const conversationFile = this.app.vault.getAbstractFileByPath(filePath);
		if (conversationFile && conversationFile.path && this.plugin.conversationManager) {
			await this.plugin.conversationManager.removeContextDocument(conversationFile as TFile, docToRemove);
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
		
		let className = 'nova-context-indicator';
		let tooltip = `Context: ${docCount} document${docCount !== 1 ? 's' : ''}, ~${context.tokenCount} tokens (files only)`;
		
		const text = `${docCount} docs`;
		
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