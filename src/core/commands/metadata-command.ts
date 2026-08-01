/**
 * @file MetadataCommand - Handles frontmatter and tag modifications
 */

import { App } from 'obsidian';
import { DocumentEngine } from '../document-engine';
import { Logger } from '../../utils/logger';
import { ContextBuilder } from '../context-builder';
import { AIProviderManager } from '../../ai/provider-manager';
import { EditCommand, EditResult, DocumentContext } from '../types';

/**
 * Handles metadata/property update commands
 */
export class MetadataCommand {
    // Protected fields that should never be modified by AI
    private static readonly PROTECTED_FIELDS = new Set([
        'created', 'date-created', 'created-date', 'creation-date',
        'modified', 'last-modified', 'updated', 'date-modified',
        'id', 'uuid', 'uid', 'permalink', 'url', 'link'
    ]);

    /**
     * Normalize property key for consistent matching
     */
    private normalizeKey(key: string): string {
        return key.toLowerCase().trim();
    }

    /**
     * Normalize tag value: trim, lowercase, handle special characters for Obsidian compatibility
     */
    private normalizeTagValue(tag: string): string {
        return tag
            .trim()
            .toLowerCase()
            .replace(/['']/g, '')           // Remove apostrophes (both straight and curly)
            .replace(/[.\s]+/g, '-')        // Replace periods and spaces with hyphens
            .replace(/[^a-z0-9_\-/]/g, '') // Remove any other invalid characters (keep letters, numbers, _, -, /)
            .replace(/-+/g, '-')            // Collapse multiple hyphens into one
            .replace(/^-|-$/g, '');         // Remove leading/trailing hyphens
    }

    /**
     * Check if a field is protected from AI modification
     */
    private isProtectedField(key: string): boolean {
        return MetadataCommand.PROTECTED_FIELDS.has(this.normalizeKey(key));
    }

    /**
     * Filter AI updates to only include existing, non-protected fields
     */
    private filterUpdatesForExistingFields(updates: Record<string, unknown>, existingFields: Set<string>): Record<string, unknown> {
        const filteredUpdates: Record<string, unknown> = {};
        
        for (const [key, value] of Object.entries(updates)) {
            const normalizedKey = this.normalizeKey(key);
            
            // Skip protected fields
            if (this.isProtectedField(key)) {
                continue;
            }
            
            // Only include fields that exist in the frontmatter
            const matchingExistingKey = Array.from(existingFields).find(existingKey => 
                this.normalizeKey(existingKey) === normalizedKey
            );
            
            if (matchingExistingKey) {
                // Use the original existing field name to maintain formatting
                filteredUpdates[matchingExistingKey] = value;
            }
        }
        
        return filteredUpdates;
    }

    /**
     * Filter AI updates for general metadata operations - allows any non-protected field
     */
    private filterUpdatesForMetadata(updates: Record<string, unknown>, existingFields: Set<string>): Record<string, unknown> {
        const filteredUpdates: Record<string, unknown> = {};
        
        for (const [key, value] of Object.entries(updates)) {
            // Skip protected fields
            if (this.isProtectedField(key)) {
                continue;
            }
            
            // For general metadata operations, allow any non-protected field
            // Always normalize keys for consistency
            const normalizedKey = this.normalizeKey(key);
            
            // Check if field already exists with case-insensitive matching
            const matchingExistingKey = Array.from(existingFields).find(existingKey => 
                this.normalizeKey(existingKey) === normalizedKey
            );
            
            if (matchingExistingKey) {
                // Use the existing field name to maintain original formatting
                filteredUpdates[matchingExistingKey] = value;
            } else {
                // For new fields, use the normalized key to ensure consistency
                filteredUpdates[normalizedKey] = value;
            }
        }
        
        return filteredUpdates;
    }
    constructor(
        private app: App,
        private documentEngine: DocumentEngine,
        private contextBuilder: ContextBuilder,
        private providerManager: AIProviderManager
    ) {}

    /**
     * Execute a metadata update command
     */
    async execute(command: EditCommand): Promise<EditResult> {
        try {
            // Get document context
            const documentContext = this.documentEngine.getDocumentContext();
            if (!documentContext) {
                return {
                    success: false,
                    error: 'No active document found',
                    editType: 'replace'
                };
            }

            // Check if this is a direct tag operation
            const tagResult = await this.handleDirectTagOperation(command.instruction, documentContext);
            if (tagResult) {
                return tagResult;
            }

            // Generate AI prompt with conversation context
            const conversationContext = this.documentEngine.getConversationContext();
            const promptConfig = conversationContext ? { includeHistory: true } : {};
            const prompt = this.contextBuilder.buildPrompt(command, documentContext, promptConfig, conversationContext);
            
            // Validate prompt
            const validation = this.contextBuilder.validatePrompt(prompt);
            if (!validation.valid) {
                return {
                    success: false,
                    error: `Prompt validation failed: ${validation.issues.join(', ')}`,
                    editType: 'replace'
                };
            }

            // Get AI completion
            const aiResponse = await this.providerManager.complete(
                prompt.systemPrompt,
                prompt.userPrompt,
                {
                    temperature: prompt.config.temperature,
                    maxTokens: prompt.config.maxTokens
                }
            );
            
            // Parse the AI response to extract property updates
            const updates = this.parsePropertyUpdates(aiResponse);
            if (!updates || Object.keys(updates).length === 0) {
                Logger.error('Failed to parse metadata updates');
                return {
                    success: false,
                    error: 'No property updates found in AI response',
                    editType: 'replace'
                };
            }
            
            await this.processFrontmatter(documentContext, frontmatter => {
                this.applyMetadataUpdates(frontmatter, updates);
            });
            
            // Generate success message based on updates
            const successMessage = this.generateSuccessMessage(updates);
            
            return {
                success: true,
                editType: 'replace',
                successMessage
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to update metadata: ${(error as Error).message}`,
                editType: 'replace'
            };
        }
    }

    /**
     * Parse AI response to extract property updates
     */
    private parsePropertyUpdates(response: string): Record<string, unknown> | null {
        try {
            // Try to parse as JSON first (in code blocks)
            const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
            if (jsonMatch) {
                const parsed: unknown = JSON.parse(jsonMatch[1]);
                if (isRecord(parsed)) {
                    return this.normalizeAndFilterUpdates(parsed);
                }
                return null;
            }
            
            // Try to parse as direct JSON (no code blocks)
            try {
                const trimmedResponse = response.trim();
                if (trimmedResponse.startsWith('{') && trimmedResponse.endsWith('}')) {
                    const parsed: unknown = JSON.parse(trimmedResponse);
                    if (isRecord(parsed)) {
                        return this.normalizeAndFilterUpdates(parsed);
                    }
                    return null;
                }
            } catch {
                // Not valid JSON, continue to YAML-like parsing
            }
            
            // Try to parse as YAML-like format
            const updates: Record<string, unknown> = {};
            const lines = response.split('\n');
            
            for (const line of lines) {
                // Match patterns like "key: value" or "- key: value"
                const match = line.match(/^[-\s]*([^:]+):\s*(.+)$/);
                if (match) {
                    let key = match[1].trim();
                    const valueString = match[2].trim();
                    
                    // Remove quotes from key if present
                    if ((key.startsWith('"') && key.endsWith('"')) || 
                        (key.startsWith("'") && key.endsWith("'"))) {
                        key = key.slice(1, -1);
                    }
                    
                    // Skip protected fields immediately
                    if (this.isProtectedField(key)) {
                        continue;
                    }
                    
                    // Try to parse value as JSON (for arrays/objects)
                    let value: unknown = valueString;
                    try {
                        value = JSON.parse(valueString);
                    } catch {
                        // If not JSON, treat as string
                        // Remove quotes if present
                        if ((valueString.startsWith('"') && valueString.endsWith('"')) || 
                            (valueString.startsWith("'") && valueString.endsWith("'"))) {
                            value = valueString.slice(1, -1);
                        }
                    }
                    
                    // Normalize tag values if this is a tags field
                    if (this.normalizeKey(key) === 'tags' && Array.isArray(value)) {
                        value = value.map((tag: unknown) => this.normalizeTagValue(String(tag)));
                    } else if (this.normalizeKey(key) === 'tags' && typeof value === 'string') {
                        // Handle comma-separated tag strings
                        value = value.split(',').map(tag => this.normalizeTagValue(tag)).filter(t => t);
                    }
                    
                    // Keep original key from AI response
                    updates[key] = value;
                }
            }
            
            return Object.keys(updates).length > 0 ? updates : null;
        } catch {
            // Failed to parse property updates - graceful fallback
            return null;
        }
    }

    /**
     * Normalize keys and filter out protected fields from updates
     */
    private normalizeAndFilterUpdates(updates: Record<string, unknown>): Record<string, unknown> {
        const filtered: Record<string, unknown> = {};
        
        for (const [key, value] of Object.entries(updates)) {
            // Skip protected fields
            if (this.isProtectedField(key)) {
                continue;
            }
            
            let processedValue = value;
            
            // Normalize tag values if this is a tags field
            if (this.normalizeKey(key) === 'tags' && Array.isArray(value)) {
                processedValue = value.map((tag: unknown) => this.normalizeTagValue(String(tag)));
            } else if (this.normalizeKey(key) === 'tags' && typeof value === 'string') {
                // Handle comma-separated tag strings
                processedValue = value.split(',').map(tag => this.normalizeTagValue(tag)).filter(t => t);
            }
            
            // Keep original key from AI response
            filtered[key] = processedValue;
        }
        
        return filtered;
    }

    private applyMetadataUpdates(frontmatter: Record<string, unknown>, updates: Record<string, unknown>): void {
        const existingFieldNames = new Set(Object.keys(frontmatter));
        const filteredUpdates = this.filterUpdatesForMetadata(updates, existingFieldNames);

        for (const [key, value] of Object.entries(filteredUpdates)) {
            if (value === null || value === undefined) {
                delete frontmatter[key];
            } else {
                frontmatter[key] = value;
            }
        }
    }

    private async processFrontmatter(
        documentContext: DocumentContext,
        update: (frontmatter: Record<string, unknown>) => void
    ): Promise<void> {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile || activeFile.path !== documentContext.file.path) {
            throw new Error('Active document changed before metadata could be applied');
        }

        await this.app.fileManager.processFrontMatter(documentContext.file, update);
    }

    private getTagsFromFrontmatter(frontmatter: Record<string, unknown>): string[] {
        const tagsKey = Object.keys(frontmatter).find(key => this.normalizeKey(key) === 'tags');
        if (!tagsKey) {
            return [];
        }

        const tags = frontmatter[tagsKey];
        if (Array.isArray(tags)) {
            return tags.map(tag => String(tag).trim()).filter(Boolean);
        }

        if (typeof tags === 'string') {
            return tags.split(',').map(tag => tag.trim()).filter(Boolean);
        }

        return [];
    }

    private setFrontmatterTags(frontmatter: Record<string, unknown>, tags: string[]): void {
        const tagsKey = Object.keys(frontmatter).find(key => this.normalizeKey(key) === 'tags') ?? 'tags';
        frontmatter[tagsKey] = tags;
    }

    /**
     * Handle direct tag operations (add, remove, set tags)
     */
    private async handleDirectTagOperation(instruction: string, documentContext: DocumentContext): Promise<EditResult | null> {
        const lowerInstruction = instruction.toLowerCase().trim();
        
        // Parse tag commands with colon format
        const colonMatch = lowerInstruction.match(/^(add|set|update|remove)\s+tags?:\s*(.*)$/);
        if (colonMatch) {
            const action = colonMatch[1];
            const tagString = colonMatch[2];
            const newTags = tagString ? tagString.split(',').map(t => this.normalizeTagValue(t)).filter(t => t) : [];
            
            // If "add tags" with no specific tags, treat as AI-powered suggestion
            if (action === 'add' && newTags.length === 0) {
                return await this.handleAITagOperation('add suggested tags', documentContext);
            }
            
            let message = '';

            await this.processFrontmatter(documentContext, frontmatter => {
                const currentTags = this.getTagsFromFrontmatter(frontmatter);
                let updatedTags: string[] = [];

                switch (action) {
                    case 'add': {
                        const normalizedCurrentTags = currentTags.map(tag => this.normalizeTagValue(tag));
                        const tagsToAdd = newTags.filter(tag => !normalizedCurrentTags.includes(tag));
                        updatedTags = [...currentTags, ...tagsToAdd];
                        message = tagsToAdd.length > 0
                            ? `Added ${tagsToAdd.length} tag${tagsToAdd.length !== 1 ? 's' : ''}: ${tagsToAdd.join(', ')}`
                            : 'No new tags to add (duplicates filtered)';
                        break;
                    }

                    case 'remove': {
                        const beforeCount = currentTags.length;
                        updatedTags = currentTags.filter(tag => !newTags.includes(this.normalizeTagValue(tag)));
                        const removedCount = beforeCount - updatedTags.length;
                        message = removedCount > 0
                            ? `Removed ${removedCount} tag${removedCount !== 1 ? 's' : ''}`
                            : 'No tags found to remove';
                        break;
                    }

                    case 'set':
                    case 'update':
                        updatedTags = [...new Set(newTags)];
                        message = `Set ${updatedTags.length} tag${updatedTags.length !== 1 ? 's' : ''}`;
                        break;
                }

                this.setFrontmatterTags(frontmatter, updatedTags);
            });
            
            return {
                success: true,
                editType: 'replace',
                successMessage: message
            };
        }
        
        // Handle AI-powered tag operations (only when tags are explicitly mentioned, not metadata/frontmatter)
        if ((/\b(clean up|cleanup|optimize|improve|review|analyze)\s+tags?\b/i.test(lowerInstruction) && !/\b(metadata|frontmatter)\b/i.test(lowerInstruction)) ||
            (/\b(suggest|recommend)\s+tags?\b/i.test(lowerInstruction) && !/\b(metadata|frontmatter)\b/i.test(lowerInstruction)) ||
            /^add suggested tags$/i.test(lowerInstruction) ||
            /^add tags$/i.test(lowerInstruction) ||  // Handle simple "add tags" as AI suggestion
            /^update tags$/i.test(lowerInstruction)) {  // Handle "update tags" as AI operation
            
            return await this.handleAITagOperation(instruction, documentContext);
        }
        
        return null;
    }

    /**
     * Handle AI-powered tag operations (suggest, optimize, clean up)
     */
    private async handleAITagOperation(instruction: string, documentContext: DocumentContext): Promise<EditResult> {
        const currentTags = this.getCurrentTags(documentContext.file);
        
        // Build AI prompt for tag operation
        const systemPrompt = `You are an expert at document tagging and metadata organization. Your task is to analyze documents and provide optimal tags.

Rules for tags:
- Tags should be lowercase
- Use hyphens for multi-word tags (e.g., "machine-learning")
- Be specific but not overly granular
- Aim for 5-10 tags per document
- Focus on key concepts, topics, and themes FROM THE ACTUAL DOCUMENT CONTENT
- Tags must be directly relevant to the document's subject matter
- Avoid generic tags like "document" or "text"
- Consider the document's purpose, audience, and main topics
- Extract tags based on the document's actual content, not random topics

IMPORTANT: Base your tag suggestions ONLY on the content provided. Do not invent unrelated tags.

Return ONLY a JSON object with a "tags" array and a "reasoning" field explaining your choices.`;

        let userPrompt = '';
        
        if (/add suggested/i.test(instruction) || /^add tags$/i.test(instruction)) {
            userPrompt = `Carefully analyze the following document and suggest relevant tags based on its actual content.

Current tags: ${currentTags.length > 0 ? currentTags.join(', ') : 'none'}

DOCUMENT TO ANALYZE:
===START OF DOCUMENT===
${documentContext.content}
===END OF DOCUMENT===

Based on the above document content, suggest additional tags that:
1. Reflect the actual topics discussed in the document
2. Capture key concepts, technologies, or themes mentioned
3. Would help with discoverability and organization
4. Are directly relevant to what this document is about

DO NOT suggest tags about topics not mentioned in the document.`;
        } else if (/clean up|cleanup/i.test(instruction)) {
            userPrompt = `Clean up and optimize the tags for this document by analyzing both the current tags and the document content.

Current tags: ${currentTags.join(', ')}

DOCUMENT CONTENT:
===START OF DOCUMENT===
${documentContext.content}
===END OF DOCUMENT===

Tasks:
1. Remove duplicate or redundant tags
2. Consolidate similar tags (e.g., "js" and "javascript")
3. Remove tags that aren't relevant to the document content
4. Standardize tag format (lowercase, hyphenated)
5. Ensure remaining tags accurately reflect the document

Provide a cleaned-up tag list based on the actual document content.`;
        } else if (/optimize|improve|review|analyze|update/i.test(instruction)) {
            userPrompt = `Analyze this document thoroughly and provide an optimized set of tags that accurately represents its content.

Current tags: ${currentTags.length > 0 ? currentTags.join(', ') : 'none'}

DOCUMENT TO ANALYZE:
===START OF DOCUMENT===
${documentContext.content}
===END OF DOCUMENT===

Tasks:
1. Review the document content carefully
2. Remove any tags that aren't relevant to the actual content
3. Add tags for important concepts, topics, or themes that are missing
4. Ensure all tags directly relate to what's discussed in the document
5. Aim for 5-10 highly relevant tags

Provide an optimized tag list that best represents THIS SPECIFIC document's content.`;
        }

        try {
            // Use unified approach for all providers
            const defaultMaxTokens = this.providerManager.getDefaultMaxTokens();
            const aiResponse = await this.providerManager.complete(systemPrompt, userPrompt, {
                temperature: 0.3,
                maxTokens: defaultMaxTokens
            });
            
            // Parse AI response
            const parsed = this.parseAITagResponse(aiResponse);
            if (!parsed || !parsed.tags || parsed.tags.length === 0) {
                return {
                    success: false,
                    error: 'Could not parse AI tag suggestions',
                    editType: 'replace'
                };
            }
            let message = '';
            await this.processFrontmatter(documentContext, frontmatter => {
                const liveTags = this.getTagsFromFrontmatter(frontmatter);
                let updatedTags = [...new Set(parsed.tags)];

                if (/add suggested/i.test(instruction) || /^add tags$/i.test(instruction)) {
                    const normalizedLiveTags = new Set(liveTags.map(tag => this.normalizeTagValue(tag)));
                    const addedTags = updatedTags.filter(tag => !normalizedLiveTags.has(this.normalizeTagValue(tag)));
                    updatedTags = [...liveTags, ...addedTags];
                    message = `Added ${addedTags.length} suggested tag${addedTags.length !== 1 ? 's' : ''}: ${addedTags.join(', ')}`;
                } else if (/clean up|cleanup/i.test(instruction)) {
                    message = `Cleaned up tags: ${liveTags.length} → ${updatedTags.length} tags`;
                } else {
                    message = `Optimized tags: ${updatedTags.length} tag${updatedTags.length !== 1 ? 's' : ''} (was ${liveTags.length})`;
                }

                this.setFrontmatterTags(frontmatter, updatedTags);
            });
            
            return {
                success: true,
                editType: 'replace',
                successMessage: message
            };
        } catch (error) {
            return {
                success: false,
                error: `Failed to process tag operation: ${(error as Error).message}`,
                editType: 'replace'
            };
        }
    }

    private getCurrentTags(file: DocumentContext['file']): string[] {
        const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
        return frontmatter ? this.getTagsFromFrontmatter(frontmatter) : [];
    }

    /**
     * Parse AI response for tag operations
     */
    private parseAITagResponse(response: string): { tags: string[], reasoning?: string } | null {
        try {
            // Clean the response
            const cleanResponse = response.trim();
            
            // Try to extract JSON from response
            const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    const parsed: unknown = JSON.parse(jsonMatch[0]);
                    if (isRecord(parsed) && Array.isArray(parsed.tags)) {
                        return {
                            tags: parsed.tags.map((t: unknown) => this.normalizeTagValue(String(t))).filter((t: string) => t),
                            reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : undefined
                        };
                    }
                } catch {
                    // JSON parse failed, continue to other formats
                }
            }
            
            // Try various list formats
            const patterns = [
                // JSON array: tags: ["tag1", "tag2"]
                /tags?:\s*\[([^\]]+)\]/i,
                // Comma list: Tags: tag1, tag2, tag3
                /tags?:\s*([^\n]+?)(?:\n|$)/i,
                // Bullet list: - tag1\n- tag2
                /(?:tags?:)?\s*(?:\n)?(\s*[-•*]\s*.+(?:\n\s*[-•*]\s*.+)*)/i,
            ];
            
            for (const pattern of patterns) {
                const match = cleanResponse.match(pattern);
                if (match) {
                    const tagString = match[1];
                    let tags: string[] = [];
                    
                    // Handle bullet lists
                    if (tagString.includes('-') || tagString.includes('•') || tagString.includes('*')) {
                        tags = tagString
                            .split(/\n/)
                            .map((line: string) => line.replace(/^\s*[-•*]\s*/, '').trim())
                            .filter((t: string) => t);
                    } else {
                        // Handle comma-separated
                        tags = tagString
                            .split(',')
                            .map((t: string) => t.trim().replace(/["']/g, ''))
                            .filter((t: string) => t);
                    }
                    
                    if (tags.length > 0) {
                        return { 
                            tags: tags.map(t => this.normalizeTagValue(t)).filter(t => t)
                        };
                    }
                }
            }
            
            // Last resort: extract any comma-separated list after "suggest" or "recommend"
            const suggestMatch = cleanResponse.match(/(?:suggest|recommend|propose|here are|tags are)[:\s]+([^.]+)/i);
            if (suggestMatch) {
                const tags = suggestMatch[1]
                    .split(/[,\n]/)
                    .map(t => t.trim().replace(/["']/g, '').replace(/^and\s+/i, ''))
                    .filter(t => t);
                
                if (tags.length > 0) {
                    return { 
                        tags: tags.map(t => this.normalizeTagValue(t)).filter(t => t)
                    };
                }
            }
            
            // Final fallback: treat each line as a tag (for Google's simple format)
            const lines = cleanResponse.split('\n').map(line => line.trim()).filter(line => line);
            const validTags = lines
                .filter(line => {
                    // Filter out lines that are clearly not tags
                    return line.length > 0 && 
                           line.length < 50 && 
                           !line.includes(':') &&
                           !line.toLowerCase().includes('tag') &&
                           !line.toLowerCase().includes('here') &&
                           !line.toLowerCase().includes('suggest');
                })
                .map(line => {
                    // Clean up the line and normalize
                    const cleaned = line
                        .replace(/^[-•*#]\s*/, '') // Remove bullet points and hashtags
                        .replace(/^\d+\.\s*/, '') // Remove numbered lists
                        .trim();
                    return this.normalizeTagValue(cleaned);
                })
                .filter(tag => tag);
            
            if (validTags.length > 0) {
                return { tags: validTags };
            }
            
            Logger.error('Failed to parse AI tag response');
            return null;
        } catch {
            Logger.error('Error parsing AI tag response');
            return null;
        }
    }

    /**
     * Generate success message based on updates
     */
    private generateSuccessMessage(updates: Record<string, unknown>): string {
        const keys = Object.keys(updates);
        if (keys.length === 0) return 'Metadata updated';
        
        if (keys.length === 1) {
            const key = keys[0];
            if (key === 'tags') {
                const count = Array.isArray(updates.tags) ? updates.tags.length : 0;
                return `Updated tags (${count} tag${count !== 1 ? 's' : ''})`;
            }
            return `Updated ${key}`;
        }
        
        return `Updated ${keys.length} properties`;
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
