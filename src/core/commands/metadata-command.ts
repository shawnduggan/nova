/**
 * Metadata command handler for Nova
 * Handles updating document properties/frontmatter
 */

import { App } from 'obsidian';
import { DocumentEngine } from '../document-engine';
import { ContextBuilder } from '../context-builder';
import { AIProviderManager } from '../../ai/provider-manager';
import { EditCommand, EditResult } from '../types';

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
            
            return {
                success: true,
                content: updatedContent,
                appliedAt: { line: 0, ch: 0 },
                editType: 'replace'
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
            console.error('Failed to parse property updates:', error);
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
}