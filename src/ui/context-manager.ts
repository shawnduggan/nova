/**
 * @file ContextManager - Manages multi-document context in sidebar
 */

import { App, TFile, Notice } from 'obsidian';
import NovaPlugin from '../../main';
import { calculateContextUsage, ContextUsage } from '../core/context-calculator';
import { Logger } from '../utils/logger';

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
	private sidebarView: { addWarningMessage: (message: string) => void } | null = null; // Reference to NovaSidebarView for adding files
	private static readonly NOTICE_DURATION_MS = 5000;

	constructor(plugin: NovaPlugin, app: App, container: HTMLElement) {
		this.plugin = plugin;
		this.app = app;
		this.container = container;
	}

	setSidebarView(sidebarView: { addWarningMessage: (message: string) => void }): void {
		this.sidebarView = sidebarView;
	}

	createContextIndicator(): void {
		this.contextIndicator = this.container.createDiv({ cls: 'nova-context-indicator nova-context-indicator-positioned' });
	}

	createContextPreview(): HTMLElement {
		const previewContainer = this.container.createDiv({ cls: 'nova-context-preview' });

		previewContainer.createSpan({ text: 'Context: ', cls: 'nova-preview-label' });

		previewContainer.createSpan({ cls: 'nova-context-preview-list nova-preview-files' });

		return previewContainer;
	}

	updateLiveContextPreview(message: string): void {
		if (!this.contextPreview) {
			return;
		}

		// Validate we have a current file set
		if (!this.currentFilePath) {
			this.contextPreview.removeClass('show');
			return;
		}

		if (!message) {
			this.contextPreview.removeClass('show');
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
			this.contextPreview.removeClass('show');
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

		this.contextPreview.addClass('show');
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
		const operationId = Date.now().toString() + Math.random().toString(36).substring(2, 11);
		this.currentOperationId = operationId;
		
		// Track current file path for validation
		const targetFilePath = currentFile.path;
		
		// Validate the requested file matches our current tracked file
		if (this.currentFilePath !== targetFilePath) {
			return null;
		}

		try {
			// Parse current message
			const { references } = this.parseMessage(message, currentFile.path);

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
				if (!docRef?.file || !this.app.vault.getFileByPath(docRef.file.path)) {
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
		} catch (_) {
			// Failed to build context - graceful fallback
			return null;
		}
	}

	private updateContextIndicator(_context: MultiDocContext): void {
		// Context indicator UI is now fully managed by sidebar-view.ts
		// This method is kept for compatibility but does nothing
		// The sidebar-view.ts updateContextIndicator() method handles all display logic
	}


	hideContextPreview(): void {
		if (this.contextPreview) {
			this.contextPreview.removeClass('show');
		}
	}

	hideContextIndicator(): void {
		if (this.contextIndicator) {
			this.contextIndicator.removeClass('show');
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
		const currentFile = this.app.vault.getFileByPath(this.currentFilePath);
		
		if (currentFile && this.plugin.conversationManager) {
			await this.plugin.conversationManager.addContextDocument(currentFile, file.path);
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
		const currentFile = this.app.vault.getFileByPath(this.currentFilePath);
		if (currentFile && this.plugin.conversationManager) {
			await this.plugin.conversationManager.removeContextDocument(currentFile, file.path);
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
				const currentFile = this.app.vault.getFileByPath(this.currentFilePath);
				if (currentFile) {
					const currentContent = await this.app.vault.read(currentFile);
					totalTokens += Math.ceil(currentContent.length / 4);
				}
			} catch (_) {
				// Skip if can't read current file
			}
			
			// Add persistent docs tokens
			for (const doc of persistentDocs) {
				try {
					const content = await this.app.vault.read(doc.file);
					totalTokens += Math.ceil(content.length / 4);
				} catch (_) {
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

		} catch (_) {
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
			const savedContextDocs = this.plugin.conversationManager.getContextDocuments(file);
			
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
						Logger.warn('Invalid context document structure:', contextDoc);
						continue;
					}
					
					// Find the actual file in the vault
					const contextFile = this.app.vault.getFileByPath(contextDoc.path);
					
					if (contextFile && contextFile.path) {
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
					Logger.warn('Error processing context document, skipping:', docError);
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
			Logger.warn('Failed to restore context from conversation:', error);
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
			Logger.warn('Failed to cleanup missing files from conversation:', error);
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
			Logger.warn('Failed to show missing files notification:', error);
		}
	}

	/**
	 * Validate all context documents for a file and return results
	 */
	validateContextDocuments(file: TFile): {
		validFiles: string[];
		missingFiles: string[];
		totalCount: number;
	} {
		if (!this.plugin.conversationManager) {
			return { validFiles: [], missingFiles: [], totalCount: 0 };
		}

		try {
			const savedContextDocs = this.plugin.conversationManager.getContextDocuments(file);
			const validFiles: string[] = [];
			const missingFiles: string[] = [];

			for (const contextDoc of savedContextDocs) {
				const contextFile = this.app.vault.getFileByPath(contextDoc.path);
				
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
		} catch (_) {
			// Graceful fallback
			return { validFiles: [], missingFiles: [], totalCount: 0 };
		}
	}

	/**
	 * Schedule async persistence update
	 */
	private async schedulePersistenceUpdate(conversationFilePath: string, references: DocumentReference[]): Promise<void> {
		// Run async save in background
		const conversationFile = this.app.vault.getFileByPath(conversationFilePath);
		if (conversationFile && this.plugin.conversationManager) {
			// Convert DocumentReferences to ContextDocumentRefs
			const contextRefs = references.map(ref => ({
				path: ref.file.path,
				property: ref.property,
				addedAt: Date.now()
			}));
			
			// Save all context documents
			await this.plugin.conversationManager.setContextDocuments(conversationFile, contextRefs);
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
			this.schedulePersistenceUpdate(conversationFilePath, updatedPersistent).catch(error => {
				Logger.error('Failed to persist context update:', error);
			});
		}

		return { cleanedMessage, references };
	}

	/**
	 * Get full document context including metadata/properties
	 */
	private async getFullDocumentContext(file: TFile, includeContent: boolean = true, maxLines: number = 50): Promise<string | null> {
		try {
			const contextParts: string[] = [];
			
			// Add document header
			contextParts.push(`## Document: ${file.basename}`);
			
			// Get and add metadata/properties if available
			const cache = this.app.metadataCache.getFileCache(file);
			if (cache?.frontmatter && Object.keys(cache.frontmatter).length > 0) {
				contextParts.push('\n### Properties/Metadata:');
				for (const [key, value] of Object.entries(cache.frontmatter)) {
					// Format the property value (handle arrays, objects, etc.)
					const formattedValue = typeof value === 'object' ? JSON.stringify(value) : value;
					contextParts.push(`- ${key}: ${String(formattedValue)}`);
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
		} catch (_) {
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
			if (!file || !this.app.vault.getFileByPath(file.path)) {
				// File no longer exists - graceful fallback
				return null;
			}
			
			if (property) {
				// Get specific property from frontmatter
				const cache = this.app.metadataCache.getFileCache(file);
				if (cache?.frontmatter && cache.frontmatter[property]) {
					return `## ${file.basename} - ${property}\n${String(cache.frontmatter[property])}`;
				}
				return null;
			} else {
				// Get full document context with metadata
				return this.getFullDocumentContext(file);
			}
		} catch (_) {
			// Failed to read context - graceful fallback
			return null;
		}
	}

	/**
	 * Find a file by name or path efficiently using Obsidian APIs
	 */
	private findFile(nameOrPath: string): TFile | null {
		// First try exact path match
		let file = this.app.vault.getFileByPath(nameOrPath);
		
		if (!file) {
			// Try with .md extension
			file = this.app.vault.getFileByPath(nameOrPath + '.md');
		}
		
		if (!file) {
			// Use MetadataCache for efficient linkpath resolution instead of iterating all files
			// Safely call the method with fallback for older Obsidian versions or tests
			if (this.app.metadataCache.getFirstLinkpathDest) {
				file = this.app.metadataCache.getFirstLinkpathDest(nameOrPath, '');
			}
		}
		
		return file;
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
						Logger.warn('Failed to get current model:', error);
					}
				}
			}
			
			// If no provider or model configured, return minimal context usage
			if (!providerType || !model) {
				const fallbackUsage: ContextUsage = {
					totalTokens: 0,
					contextLimit: 32000, // Generic fallback context size
					usagePercentage: 0,
					breakdown: {
						conversationHistory: 0,
						fileAttachments: 0,
						currentInput: 0,
						recentResponse: 0
					}
				};
				return fallbackUsage;
			}
			
			// Get conversation history for current file
			if (this.currentFilePath && this.plugin.conversationManager) {
				const currentFile = this.app.vault.getFileByPath(this.currentFilePath);
				if (currentFile) {
					const conversation = this.plugin.conversationManager.getConversation(currentFile);
					conversationHistory = (conversation?.messages || []).map(msg => ({ content: msg.content }));
				}
			}
			
		} catch (error) {
			Logger.warn('Error during context calculation setup, using defaults:', error);
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
		const conversationFile = this.app.vault.getFileByPath(filePath);
		if (conversationFile && this.plugin.conversationManager) {
			await this.plugin.conversationManager.clearContextDocuments(conversationFile);
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
		const conversationFile = this.app.vault.getFileByPath(filePath);
		if (conversationFile && this.plugin.conversationManager) {
			await this.plugin.conversationManager.removeContextDocument(conversationFile, docToRemove);
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
		
		const className = 'nova-context-indicator';
		const tooltip = `Context: ${docCount} document${docCount !== 1 ? 's' : ''}, ~${context.tokenCount} tokens (files only)`;
		
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