/**
 * Multi-document context handler for Nova
 * Parses [[doc]] and +[[doc]] syntax for additional context
 */

import { App, TFile, CachedMetadata } from 'obsidian';
import { ConversationData } from './types';

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

export class MultiDocContextHandler {
    private app: App;
    private persistentContext: Map<string, DocumentReference[]> = new Map();
    private readonly TOKEN_LIMIT = 8000;
    private readonly WARNING_THRESHOLD = 0.8;

    constructor(app: App) {
        this.app = app;
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
     * Build complete context including persistent documents
     */
    async buildContext(
        message: string,
        currentFile: TFile,
        conversationData?: ConversationData
    ): Promise<{
        cleanedMessage: string;
        context: MultiDocContext;
    }> {
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
                // Removing stale file reference
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

        return {
            cleanedMessage,
            context: {
                persistentDocs: allPersistentDocs,
                contextString,
                tokenCount,
                isNearLimit
            }
        };
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
     * Estimate token count (rough approximation)
     */
    private estimateTokens(text: string): number {
        // Rough estimate: ~4 characters per token
        return Math.ceil(text.length / 4);
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