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
    /** Documents referenced in current message */
    temporaryDocs: DocumentReference[];
    
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
        const refPattern = /(\+)?\[\[([^\]]+?)(?:#([^\]]+?))?\]\]/g;
        
        let match;
        while ((match = refPattern.exec(message)) !== null) {
            const isPersistent = !!match[1];
            const docName = match[2];
            const property = match[3];
            const rawReference = match[0];

            // Try to find the file
            const file = this.findFile(docName);
            
            if (file) {
                references.push({
                    file,
                    isPersistent,
                    rawReference,
                    property
                });

                // Remove the reference from the message
                cleanedMessage = cleanedMessage.replace(rawReference, '');
            }
        }

        // Clean up extra spaces
        cleanedMessage = cleanedMessage.replace(/\s+/g, ' ').trim();

        // Update persistent context if needed
        const persistentRefs = references.filter(ref => ref.isPersistent);
        if (persistentRefs.length > 0) {
            const existing = this.persistentContext.get(conversationFilePath) || [];
            this.persistentContext.set(conversationFilePath, [...existing, ...persistentRefs]);
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

        // Get persistent context for this conversation
        const persistentDocs = this.persistentContext.get(currentFile.path) || [];

        // Build context string
        const contextParts: string[] = [];
        const allDocs = [...persistentDocs, ...references];
        
        for (const docRef of allDocs) {
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
                temporaryDocs: references.filter(r => !r.isPersistent),
                persistentDocs,
                contextString,
                tokenCount,
                isNearLimit
            }
        };
    }

    /**
     * Get context for a specific document reference
     */
    private async getDocumentContext(docRef: DocumentReference): Promise<string | null> {
        try {
            const { file, property } = docRef;
            
            if (property) {
                // Get specific property from frontmatter
                const cache = this.app.metadataCache.getFileCache(file);
                if (cache?.frontmatter && cache.frontmatter[property]) {
                    return `## ${file.basename} - ${property}\n${cache.frontmatter[property]}`;
                }
                return null;
            } else {
                // Get full document content
                const content = await this.app.vault.read(file);
                const lines = content.split('\n');
                
                // Limit to first 50 lines for context
                const truncatedContent = lines.slice(0, 50).join('\n');
                const wasTruncated = lines.length > 50;
                
                return `## Document: ${file.basename}\n${truncatedContent}${wasTruncated ? '\n\n[... truncated for brevity ...]' : ''}`;
            }
        } catch (error) {
            console.error(`Failed to read context from ${docRef.file.path}:`, error);
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
        const docCount = context.temporaryDocs.length + context.persistentDocs.length;
        const percentage = Math.round((context.tokenCount / this.TOKEN_LIMIT) * 100);
        
        let className = 'nova-context-indicator';
        let tooltip = `Context: ${docCount} document${docCount !== 1 ? 's' : ''}, ~${context.tokenCount} tokens`;
        
        if (context.isNearLimit) {
            className += ' nova-context-warning';
            tooltip += ' (approaching limit)';
        }
        
        const text = `📚 ${docCount} ${percentage}%`;
        
        return { text, className, tooltip };
    }

    /**
     * Format context for display in UI
     */
    formatContextForDisplay(context: MultiDocContext): string[] {
        const items: string[] = [];
        
        // Add persistent documents
        for (const doc of context.persistentDocs) {
            items.push(`+${doc.file.basename}${doc.property ? `#${doc.property}` : ''}`);
        }
        
        // Add temporary documents
        for (const doc of context.temporaryDocs) {
            items.push(`${doc.file.basename}${doc.property ? `#${doc.property}` : ''}`);
        }
        
        return items;
    }
}