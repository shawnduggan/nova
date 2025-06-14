/**
 * Add command implementation for Nova
 * Handles adding new content to documents at cursor position
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

            // Validate command requirements
            const validation = this.validateCommand(command);
            if (!validation.valid) {
                return {
                    success: false,
                    error: validation.error,
                    editType: 'insert'
                };
            }

            // Generate AI prompt with conversation context
            const conversationContext = this.documentEngine.getConversationContext();
            const promptConfig = conversationContext ? { includeHistory: true } : {};
            const prompt = this.contextBuilder.buildPrompt(command, documentContext, promptConfig, conversationContext);
            
            // Validate prompt
            const promptValidation = this.contextBuilder.validatePrompt(prompt);
            if (!promptValidation.valid) {
                return {
                    success: false,
                    error: `Prompt validation failed: ${promptValidation.issues.join(', ')}`,
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

                // Apply the addition based on target
                const result = await this.applyAddition(command, documentContext, content);

                // Log result for conversation context
                if (!result.success) {
                    await this.documentEngine.addAssistantMessage('Failed to add content', result);
                } else {
                    await this.documentEngine.addAssistantMessage('Content added successfully', result);
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
     * Apply addition based on command target
     */
    private async applyAddition(
        command: EditCommandType,
        documentContext: DocumentContext,
        content: string
    ): Promise<EditResult> {
        switch (command.target) {
            case 'cursor':
                // Insert content at cursor position
                return await this.documentEngine.applyEdit(
                    content,
                    'cursor',
                    {
                        scrollToEdit: true,
                        selectNewText: true
                    }
                );

            case 'end':
                // Append to end of document
                return await this.documentEngine.applyEdit(
                    content,
                    'end',
                    {
                        scrollToEdit: true,
                        selectNewText: true
                    }
                );

            case 'document':
                // Add to document (typically append to end)
                return await this.documentEngine.applyEdit(
                    content,
                    'end',
                    {
                        scrollToEdit: true,
                        selectNewText: true
                    }
                );

            case 'selection':
                // Replace selection with new content
                if (documentContext.selectedText) {
                    return await this.documentEngine.applyEdit(
                        content,
                        'selection',
                        {
                            scrollToEdit: true,
                            selectNewText: true
                        }
                    );
                } else {
                    // No selection, add at cursor instead
                    return await this.documentEngine.applyEdit(
                        content,
                        'cursor',
                        {
                            scrollToEdit: true,
                            selectNewText: true
                        }
                    );
                }

            default:
                return {
                    success: false,
                    error: `Invalid add target: ${command.target}`,
                    editType: 'insert'
                };
        }
    }

    /**
     * Validate add command
     */
    private validateCommand(command: EditCommandType): { valid: boolean; error?: string } {
        // Validate action is add
        if (command.action !== 'add') {
            return {
                valid: false,
                error: 'Command action must be add'
            };
        }

        // Validate instruction is provided
        if (!command.instruction || command.instruction.trim().length === 0) {
            return {
                valid: false,
                error: 'Add instruction is required'
            };
        }

        return { valid: true };
    }
}