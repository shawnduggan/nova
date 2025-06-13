/**
 * Add command implementation for Nova
 * Handles adding new content to documents
 */

import { App } from 'obsidian';
import { DocumentEngine } from '../document-engine';
import { ContextBuilder } from '../context-builder';
import { AIProviderManager } from '../../ai/provider-manager';
import { EditCommand as EditCommandType, EditResult, DocumentContext } from '../types';

export class AddCommand {
    constructor(
        private app: App,
        private documentEngine: DocumentEngine,
        private contextBuilder: ContextBuilder,
        private providerManager: AIProviderManager
    ) {}

    /**
     * Execute add command
     */
    async execute(command: EditCommandType): Promise<EditResult> {
        try {
            // Get document context
            const documentContext = await this.documentEngine.getDocumentContext();
            if (!documentContext) {
                return {
                    success: false,
                    error: 'No active document found',
                    editType: 'insert'
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
                    editType: 'insert'
                };
            }

            // Get AI completion
            try {
                // Log user request
                await this.documentEngine.addUserMessage(command.instruction, command);

                const content = await this.providerManager.generateText(
                    prompt.userPrompt,
                    {
                        systemPrompt: prompt.systemPrompt,
                        temperature: prompt.config.temperature,
                        maxTokens: prompt.config.maxTokens
                    }
                );

                if (!content || content.trim().length === 0) {
                    const result = {
                        success: false,
                        error: 'AI provider returned empty content',
                        editType: 'insert' as const
                    };
                    
                    // Log failed response
                    await this.documentEngine.addAssistantMessage('Failed to generate content', result);
                    return result;
                }

                // Apply the edit
                let insertPosition;
                try {
                    insertPosition = await this.determineInsertPosition(command, documentContext);
                } catch (error) {
                    // Handle section not found error with better messaging
                    if (error instanceof Error && error.message.includes('not found')) {
                        const errorMessage = this.buildSectionNotFoundError(command.location!, documentContext);
                        const result = {
                            success: false,
                            error: errorMessage,
                            editType: 'insert' as const
                        };
                        await this.documentEngine.addAssistantMessage(errorMessage, result);
                        return result;
                    }
                    throw error;
                }

                const result = await this.documentEngine.applyEdit(
                    content,
                    insertPosition,
                    {
                        scrollToEdit: true,
                        selectNewText: false
                    }
                );

                // Don't log success messages - handled by UI
                if (!result.success) {
                    await this.documentEngine.addAssistantMessage('Failed to add content', result);
                }

                return result;

            } catch (error) {
                const result = {
                    success: false,
                    error: error instanceof Error ? error.message : 'AI generation failed',
                    editType: 'insert' as const
                };
                
                // Log error response
                await this.documentEngine.addAssistantMessage(
                    `Error: ${result.error}`,
                    result
                );
                
                return result;
            }

        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                editType: 'insert'
            };
        }
    }

    /**
     * Determine where to insert new content
     */
    private async determineInsertPosition(
        command: EditCommandType,
        documentContext: DocumentContext
    ): Promise<'cursor' | 'selection' | 'end' | { line: number; ch: number }> {
        switch (command.target) {
            case 'end':
                return 'end';

            case 'section':
                if (command.location) {
                    const section = await this.documentEngine.findSection(command.location);
                    if (section) {
                        // Determine position based on context hints
                        const positionHint = this.extractPositionHint(command.context);
                        
                        switch (positionHint) {
                            case 'section-start':
                                // Add at start of section (right after heading)
                                return { line: section.range.start + 1, ch: 0 };
                            case 'after-heading':
                                // Insert immediately after the heading line
                                return { line: section.range.start + 1, ch: 0 };
                            case 'before-heading':
                                // Insert immediately before the heading line
                                return { line: section.range.start, ch: 0 };
                            case 'section-end':
                            default:
                                // Add at end of section (default behavior)
                                return { line: section.range.end, ch: 0 };
                        }
                    } else {
                        // Section not found - this will be handled by the calling method
                        // which should show appropriate error messages
                        throw new Error(`Section "${command.location}" not found`);
                    }
                }
                // If no location specified, use cursor position
                return 'cursor';

            case 'paragraph':
                // Insert at cursor position
                return 'cursor';

            case 'document':
                // Add at the end of document
                return 'end';

            default:
                return 'cursor';
        }
    }

    /**
     * Validate add command requirements
     */
    validateCommand(command: EditCommandType, hasSelection: boolean): {
        valid: boolean;
        error?: string;
    } {
        // Add command cannot target selection
        if (command.target === 'selection') {
            return {
                valid: false,
                error: 'Cannot add content to a selection. Use "edit" to modify selected text'
            };
        }

        // If targeting a section, location should be provided
        if (command.target === 'section' && !command.location) {
            // This is still valid - we'll add to current section or cursor position
            return { valid: true };
        }

        return { valid: true };
    }

    /**
     * Extract position hint from command context
     */
    private extractPositionHint(context?: string): string | null {
        if (!context) return null;
        
        if (context.includes('Position: Add at the end of the section')) {
            return 'section-end';
        } else if (context.includes('Position: Add at the start of the section')) {
            return 'section-start';
        } else if (context.includes('Position: Insert immediately after the heading line')) {
            return 'after-heading';
        } else if (context.includes('Position: Insert immediately before the heading line')) {
            return 'before-heading';
        }
        
        return null;
    }

    /**
     * Build error message when section is not found, showing available hierarchical paths
     */
    private buildSectionNotFoundError(sectionName: string, documentContext: DocumentContext): string {
        const availablePaths: string[] = [];
        
        // Build hierarchical paths for all headings
        documentContext.headings.forEach((heading, index) => {
            const path = this.buildSectionPath(documentContext.headings, index);
            availablePaths.push(path);
        });
        
        let errorMessage = `Section "${sectionName}" not found.\n\nAvailable sections:`;
        availablePaths.forEach(path => {
            errorMessage += `\n- ${path}`;
        });
        
        errorMessage += `\n\nTip: Use hierarchical paths like "Methods::Data Collection" to target specific nested sections.`;
        
        return errorMessage;
    }

    /**
     * Build hierarchical path for a heading (duplicated from DocumentEngine for error messages)
     */
    private buildSectionPath(headings: any[], targetIndex: number): string {
        const target = headings[targetIndex];
        const path: string[] = [target.text];
        
        // Walk backwards to find parent headings
        for (let i = targetIndex - 1; i >= 0; i--) {
            const heading = headings[i];
            if (heading.level < target.level) {
                path.unshift(heading.text);
                // Only include immediate parent for now (single level up)
                break;
            }
        }
        
        return path.join('::');
    }

    /**
     * Get suggestions for add commands
     */
    getSuggestions(documentContext: DocumentContext): string[] {
        const suggestions: string[] = [
            'Add a conclusion section',
            'Add an introduction',
            'Create a summary',
            'Add examples',
            'Create a methodology section'
        ];

        // Add section-specific suggestions based on existing headings
        if (documentContext.headings.length > 0) {
            const sectionNames = documentContext.headings.map(h => h.text);
            
            if (!sectionNames.some(name => name.toLowerCase().includes('introduction'))) {
                suggestions.unshift('Add an introduction section');
            }
            
            if (!sectionNames.some(name => name.toLowerCase().includes('conclusion'))) {
                suggestions.push('Add a conclusion section');
            }
            
            if (!sectionNames.some(name => name.toLowerCase().includes('summary'))) {
                suggestions.push('Add a summary section');
            }
        }

        return suggestions.slice(0, 8); // Limit to 8 suggestions
    }

    /**
     * Preview what content would be added (without actually adding it)
     */
    async preview(command: EditCommandType): Promise<{
        success: boolean;
        preview?: string;
        position?: string;
        error?: string;
    }> {
        try {
            const documentContext = await this.documentEngine.getDocumentContext();
            if (!documentContext) {
                return {
                    success: false,
                    error: 'No active document found'
                };
            }

            // Determine where content would be placed
            let positionDescription = '';
            switch (command.target) {
                case 'end':
                    positionDescription = 'at the end of the document';
                    break;
                case 'section':
                    if (command.location) {
                        positionDescription = `in the "${command.location}" section`;
                    } else {
                        positionDescription = 'in the current section';
                    }
                    break;
                case 'paragraph':
                    positionDescription = 'at the cursor position';
                    break;
                case 'document':
                    positionDescription = 'at the end of the document';
                    break;
                default:
                    positionDescription = 'at the cursor position';
            }

            return {
                success: true,
                preview: `Will add new content ${positionDescription}`,
                position: positionDescription
            };

        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
}