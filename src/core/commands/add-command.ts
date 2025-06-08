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
                const result = await this.documentEngine.applyEdit(
                    content,
                    await this.determineInsertPosition(command, documentContext),
                    {
                        scrollToEdit: true,
                        selectNewText: false
                    }
                );

                // Log successful response
                await this.documentEngine.addAssistantMessage(
                    result.success ? 'Added content successfully' : 'Failed to add content',
                    result
                );

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
                        // Add content at the end of the section
                        return { line: section.range.end, ch: 0 };
                    }
                }
                // Fallback to cursor position
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