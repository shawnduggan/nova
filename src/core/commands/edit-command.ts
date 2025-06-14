/**
 * Edit command implementation for Nova
 * Handles modifying and improving existing content at cursor position
 */

import { App } from 'obsidian';
import { DocumentEngine } from '../document-engine';
import { ContextBuilder } from '../context-builder';
import { AIProviderManager } from '../../ai/provider-manager';
import { EditCommand as EditCommandType, EditResult, DocumentContext } from '../types';

export class EditCommand {
    constructor(
        private app: App,
        private documentEngine: DocumentEngine,
        private contextBuilder: ContextBuilder,
        private providerManager: AIProviderManager
    ) {}

    /**
     * Execute edit command
     */
    async execute(command: EditCommandType): Promise<EditResult> {
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

            // Validate command requirements
            const validation = this.validateCommand(command, !!documentContext.selectedText);
            if (!validation.valid) {
                return {
                    success: false,
                    error: validation.error,
                    editType: 'replace'
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
                    editType: 'replace'
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
                        editType: 'replace' as const
                    };
                    
                    // Log failed response
                    await this.documentEngine.addAssistantMessage('Failed to generate content', result);
                    return result;
                }

                // Apply the edit based on target
                const result = await this.applyEdit(command, documentContext, content);

                // Log result for conversation context
                if (!result.success) {
                    await this.documentEngine.addAssistantMessage('Failed to edit content', result);
                } else {
                    await this.documentEngine.addAssistantMessage('Content edited successfully', result);
                }

                return result;

            } catch (error) {
                const result = {
                    success: false,
                    error: error instanceof Error ? error.message : 'AI generation failed',
                    editType: 'replace' as const
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
                editType: 'replace'
            };
        }
    }

    /**
     * Apply edit based on command target
     */
    private async applyEdit(
        command: EditCommandType,
        documentContext: DocumentContext,
        content: string
    ): Promise<EditResult> {
        switch (command.target) {
            case 'selection':
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
                    return {
                        success: false,
                        error: 'No text selected for editing',
                        editType: 'replace'
                    };
                }

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

            case 'document':
                // Replace entire document
                return await this.documentEngine.setDocumentContent(content);

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

            default:
                return {
                    success: false,
                    error: `Invalid edit target: ${command.target}`,
                    editType: 'replace'
                };
        }
    }

    /**
     * Validate edit command
     */
    private validateCommand(
        command: EditCommandType, 
        hasSelection: boolean
    ): { valid: boolean; error?: string } {
        // Check if selection is required but not available
        if (command.target === 'selection' && !hasSelection) {
            return {
                valid: false,
                error: 'Please select text to edit'
            };
        }

        // Validate action is edit
        if (command.action !== 'edit') {
            return {
                valid: false,
                error: 'Command action must be edit'
            };
        }

        // Validate instruction is provided
        if (!command.instruction || command.instruction.trim().length === 0) {
            return {
                valid: false,
                error: 'Edit instruction is required'
            };
        }

        return { valid: true };
    }
}