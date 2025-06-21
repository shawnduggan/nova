/**
 * Metadata command handler for Nova
 * Handles updating document properties/frontmatter
 */

import { App } from 'obsidian';
import { DocumentEngine } from '../document-engine';
import { ContextBuilder } from '../context-builder';
import { AIProviderManager } from '../../ai/provider-manager';
import { EditCommand, EditResult, DocumentContext } from '../types';

/**
 * Handles metadata/property update commands
 */
export class MetadataCommand {
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
            const documentContext = await this.documentEngine.getDocumentContext();
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
                // Log for debugging
                console.error('Failed to parse metadata updates. AI response:', aiResponse);
                return {
                    success: false,
                    error: 'No property updates found in AI response',
                    editType: 'replace'
                };
            }
            
            // Update or create frontmatter
            const updatedContent = this.updateFrontmatter(documentContext.content, updates);
            
            // Write the updated content back to the file directly
            await this.app.vault.modify(documentContext.file, updatedContent);
            
            // Generate success message based on updates
            const successMessage = this.generateSuccessMessage(updates);
            
            return {
                success: true,
                content: updatedContent,
                appliedAt: { line: 0, ch: 0 },
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
    private parsePropertyUpdates(response: string): Record<string, any> | null {
        try {
            // Try to parse as JSON first
            const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[1]);
            }
            
            // Try to parse as YAML-like format
            const updates: Record<string, any> = {};
            const lines = response.split('\n');
            
            for (const line of lines) {
                // Match patterns like "key: value" or "- key: value"
                const match = line.match(/^[-\s]*([^:]+):\s*(.+)$/);
                if (match) {
                    const key = match[1].trim();
                    let value = match[2].trim();
                    
                    // Try to parse value as JSON (for arrays/objects)
                    try {
                        value = JSON.parse(value);
                    } catch {
                        // If not JSON, treat as string
                        // Remove quotes if present
                        if ((value.startsWith('"') && value.endsWith('"')) || 
                            (value.startsWith("'") && value.endsWith("'"))) {
                            value = value.slice(1, -1);
                        }
                    }
                    
                    updates[key] = value;
                }
            }
            
            return Object.keys(updates).length > 0 ? updates : null;
        } catch (error) {
            // Failed to parse property updates - graceful fallback
            return null;
        }
    }

    /**
     * Update or create frontmatter in document content
     */
    private updateFrontmatter(content: string, updates: Record<string, any>): string {
        const lines = content.split('\n');
        
        // Check if frontmatter exists
        if (lines[0] === '---') {
            // Find the closing ---
            let endIndex = -1;
            for (let i = 1; i < lines.length; i++) {
                if (lines[i] === '---') {
                    endIndex = i;
                    break;
                }
            }
            
            if (endIndex > 0) {
                // Parse existing frontmatter
                const existingProps: Record<string, any> = {};
                for (let i = 1; i < endIndex; i++) {
                    const match = lines[i].match(/^([^:]+):\s*(.*)$/);
                    if (match) {
                        const key = match[1].trim();
                        let value = match[2].trim();
                        
                        // Try to parse as JSON
                        try {
                            value = JSON.parse(value);
                        } catch {
                            // Keep as string
                        }
                        
                        existingProps[key] = value;
                    }
                }
                
                // Merge updates with existing properties
                const mergedProps = { ...existingProps, ...updates };
                
                // Rebuild frontmatter
                const newFrontmatter = ['---'];
                for (const [key, value] of Object.entries(mergedProps)) {
                    if (value === null || value === undefined) {
                        // Skip null/undefined values (allows deletion)
                        continue;
                    }
                    
                    const formattedValue = typeof value === 'object' 
                        ? JSON.stringify(value)
                        : String(value);
                    
                    newFrontmatter.push(`${key}: ${formattedValue}`);
                }
                newFrontmatter.push('---');
                
                // Replace old frontmatter with new
                return [
                    ...newFrontmatter,
                    ...lines.slice(endIndex + 1)
                ].join('\n');
            }
        }
        
        // No frontmatter exists, create new
        const newFrontmatter = ['---'];
        for (const [key, value] of Object.entries(updates)) {
            if (value === null || value === undefined) {
                continue;
            }
            
            const formattedValue = typeof value === 'object' 
                ? JSON.stringify(value)
                : String(value);
            
            newFrontmatter.push(`${key}: ${formattedValue}`);
        }
        newFrontmatter.push('---', '');
        
        // Add frontmatter to beginning of document
        return newFrontmatter.join('\n') + content;
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
            const newTags = tagString ? tagString.split(',').map(t => t.trim()).filter(t => t) : [];
            
            // If "add tags" with no specific tags, treat as AI-powered suggestion
            if (action === 'add' && newTags.length === 0) {
                return await this.handleAITagOperation('add suggested tags', documentContext);
            }
            
            // Get current tags
            const currentTags = this.getCurrentTags(documentContext.content);
            
            let updatedTags: string[] = [];
            let message = '';
            
            switch (action) {
                case 'add':
                    // Add new tags without duplicates
                    const tagsToAdd = newTags.filter(tag => 
                        !currentTags.some(existing => existing.toLowerCase() === tag.toLowerCase())
                    );
                    updatedTags = [...currentTags, ...tagsToAdd];
                    message = tagsToAdd.length > 0 
                        ? `Added ${tagsToAdd.length} tag${tagsToAdd.length !== 1 ? 's' : ''}: ${tagsToAdd.join(', ')}`
                        : 'No new tags to add (duplicates filtered)';
                    break;
                    
                case 'remove':
                    // Remove specified tags
                    const lowerNewTags = newTags.map(t => t.toLowerCase());
                    const beforeCount = currentTags.length;
                    updatedTags = currentTags.filter(tag => 
                        !lowerNewTags.includes(tag.toLowerCase())
                    );
                    const removedCount = beforeCount - updatedTags.length;
                    message = removedCount > 0
                        ? `Removed ${removedCount} tag${removedCount !== 1 ? 's' : ''}`
                        : 'No tags found to remove';
                    break;
                    
                case 'set':
                case 'update':
                    // Replace all tags
                    updatedTags = [...new Set(newTags.map(t => t.toLowerCase()))];
                    message = `Set ${updatedTags.length} tag${updatedTags.length !== 1 ? 's' : ''}`;
                    break;
            }
            
            // Update content
            const updates = { tags: updatedTags };
            const updatedContent = this.updateFrontmatter(documentContext.content, updates);
            await this.app.vault.modify(documentContext.file, updatedContent);
            
            return {
                success: true,
                content: updatedContent,
                appliedAt: { line: 0, ch: 0 },
                editType: 'replace',
                successMessage: message
            };
        }
        
        // Handle AI-powered tag operations
        if (/\b(clean up|cleanup|optimize|improve|review|analyze)\s+.*\btags?\b/i.test(lowerInstruction) ||
            /\b(suggest|recommend)\s+.*\btags?\b/i.test(lowerInstruction) ||
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
        const currentTags = this.getCurrentTags(documentContext.content);
        
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
                // Show the actual AI response in the error for debugging
                const preview = aiResponse.length > 100 
                    ? aiResponse.substring(0, 100) + '...' 
                    : aiResponse;
                return {
                    success: false,
                    error: `Could not parse AI tag suggestions. AI response: "${preview}"`,
                    editType: 'replace'
                };
            }
            
            // Update tags
            const updates = { tags: parsed.tags };
            const updatedContent = this.updateFrontmatter(documentContext.content, updates);
            await this.app.vault.modify(documentContext.file, updatedContent);
            
            // Generate appropriate message
            let message = '';
            if (/add suggested/i.test(instruction) || /^add tags$/i.test(instruction)) {
                const addedTags = parsed.tags.filter(tag => 
                    !currentTags.some(existing => existing.toLowerCase() === tag.toLowerCase())
                );
                message = `Added ${addedTags.length} suggested tag${addedTags.length !== 1 ? 's' : ''}: ${addedTags.join(', ')}`;
            } else if (/clean up|cleanup/i.test(instruction)) {
                message = `Cleaned up tags: ${currentTags.length} → ${parsed.tags.length} tags`;
            } else {
                message = `Optimized tags: ${parsed.tags.length} tag${parsed.tags.length !== 1 ? 's' : ''} (was ${currentTags.length})`;
            }
            
            return {
                success: true,
                content: updatedContent,
                appliedAt: { line: 0, ch: 0 },
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

    /**
     * Get current tags from document content
     */
    private getCurrentTags(content: string): string[] {
        if (!content) return [];
        
        const lines = content.split('\n');
        
        if (lines.length > 0 && lines[0] === '---') {
            let inFrontmatter = true;
            for (let i = 1; i < lines.length && inFrontmatter; i++) {
                if (lines[i] === '---') {
                    break;
                }
                
                const tagMatch = lines[i].match(/^tags:\s*(.*)$/);
                if (tagMatch) {
                    const tagValue = tagMatch[1].trim();
                    
                    if (!tagValue) return [];
                    
                    // Try parsing as JSON array
                    try {
                        const parsed = JSON.parse(tagValue);
                        if (Array.isArray(parsed)) {
                            return parsed.filter(t => t);
                        }
                    } catch {
                        // Not JSON, try comma-separated
                        return tagValue.split(',').map(t => t.trim()).filter(t => t);
                    }
                }
            }
        }
        
        // No frontmatter or no tags found
        return [];
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
                    const parsed = JSON.parse(jsonMatch[0]);
                    if (parsed.tags && Array.isArray(parsed.tags)) {
                        return {
                            tags: parsed.tags.map((t: any) => String(t).toLowerCase().trim().replace(/\s+/g, '-')).filter((t: string) => t),
                            reasoning: parsed.reasoning
                        };
                    }
                } catch (e) {
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
                    let tagString = match[1];
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
                            tags: tags.map(t => t.toLowerCase().trim().replace(/\s+/g, '-')).filter(t => t)
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
                        tags: tags.map(t => t.toLowerCase().trim()).filter(t => t)
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
                    // Clean up the line and convert spaces to hyphens
                    return line.toLowerCase()
                        .replace(/^[-•*#]\s*/, '') // Remove bullet points and hashtags
                        .replace(/^\d+\.\s*/, '') // Remove numbered lists
                        .trim()
                        .replace(/\s+/g, '-'); // Convert spaces to hyphens
                })
                .filter(tag => tag);
            
            if (validTags.length > 0) {
                return { tags: validTags };
            }
            
            // If we still can't parse, log the response for debugging
            console.error('Failed to parse AI tag response:', cleanResponse);
            return null;
        } catch (error) {
            console.error('Error parsing AI tag response:', error, 'Response was:', response);
            return null;
        }
    }

    /**
     * Generate success message based on updates
     */
    private generateSuccessMessage(updates: Record<string, any>): string {
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