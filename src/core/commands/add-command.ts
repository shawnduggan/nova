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

                // Apply the edit at simplified position
                const insertPosition = this.determineInsertPosition(command);

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
     * Determine where to insert new content (simplified for cursor-only editing)
     */
    private determineInsertPosition(
        command: EditCommandType
    ): 'cursor' | 'selection' | 'end' {
        switch (command.target) {
            case 'end':
                return 'end';
            case 'document':
                return 'end';
            case 'cursor':
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

        return { valid: true };
    }


    /**
     * Get suggestions for add commands
     */
    getSuggestions(): string[] {
        return [
            'Add content at cursor',
            'Add conclusion at end',
            'Add introduction at end',
            'Create a summary',
            'Add examples here',
            'Add methodology section'
        ];
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
                case 'document':
                    positionDescription = 'at the end of the document';
                    break;
                case 'cursor':
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