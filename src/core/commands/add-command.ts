/**
 * Add command implementation for Nova
 * Handles adding new content to documents at cursor position
 */

import { App } from 'obsidian';
import { DocumentEngine } from '../document-engine';
import { ContextBuilder, GeneratedPrompt } from '../context-builder';
import { AIProviderManager } from '../../ai/provider-manager';
import { EditCommand as EditCommandType, EditResult, DocumentContext } from '../types';

export interface StreamingCallback {
    (chunk: string, isComplete: boolean): void;
}

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
    async execute(command: EditCommandType, streamingCallback?: StreamingCallback): Promise<EditResult> {
        try {
            // Get document context
            const documentContext = this.documentEngine.getDocumentContext();
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
                // User message already logged by chat input handler

                let content: string;
                let result: EditResult;

                if (streamingCallback) {
                    // Use streaming mode
                    result = await this.executeWithStreaming(command, documentContext, prompt, streamingCallback);
                } else {
                    // Use traditional synchronous mode (fallback)
                    content = await this.providerManager.generateText(
                        prompt.userPrompt,
                        {
                            systemPrompt: prompt.systemPrompt,
                            temperature: prompt.config.temperature,
                            maxTokens: prompt.config.maxTokens
                        }
                    );

                    if (!content || content.trim().length === 0) {
                        return {
                            success: false,
                            error: 'AI provider returned empty content',
                            editType: 'insert' as const
                        };
                    }

                    // Apply the addition based on target
                    result = this.applyAddition(command, documentContext, content);
                }

                // Log only failures as assistant messages
                // Success will be handled by sidebar's success indicator
                // Failure will also be handled by sidebar's error indicator

                return result;

            } catch (error) {
                return {
                    success: false,
                    error: error instanceof Error ? error.message : 'AI generation failed',
                    editType: 'insert' as const
                };
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
    private applyAddition(
        command: EditCommandType,
        documentContext: DocumentContext,
        content: string
    ): EditResult {
        switch (command.target) {
            case 'cursor':
                // Insert content at cursor position
                return this.documentEngine.applyEdit(
                    content,
                    'cursor',
                    {
                        scrollToEdit: true,
                        selectNewText: true
                    }
                );

            case 'end':
                // Append to end of document
                return this.documentEngine.applyEdit(
                    content,
                    'end',
                    {
                        scrollToEdit: true,
                        selectNewText: true
                    }
                );

            case 'document':
                // Add to document (typically append to end)
                return this.documentEngine.applyEdit(
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
                    return this.documentEngine.applyEdit(
                        content,
                        'selection',
                        {
                            scrollToEdit: true,
                            selectNewText: true
                        }
                    );
                } else {
                    // No selection, add at cursor instead
                    return this.documentEngine.applyEdit(
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
                    error: `Invalid add target: ${String(command.target)}`,
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

    /**
     * Execute add command with streaming support
     */
    private async executeWithStreaming(
        command: EditCommandType,
        documentContext: DocumentContext,
        prompt: GeneratedPrompt,
        streamingCallback: StreamingCallback
    ): Promise<EditResult> {
        try {
            // Generate content with streaming
            let fullContent = '';
            
            // Use the streaming generator
            const stream = this.providerManager.generateTextStream(
                prompt.userPrompt,
                {
                    systemPrompt: prompt.systemPrompt,
                    temperature: prompt.config.temperature,
                    maxTokens: prompt.config.maxTokens
                }
            );

            for await (const chunk of stream) {
                if (chunk.content) {
                    fullContent += chunk.content;
                    // Forward to the streaming callback which handles document updates
                    streamingCallback(fullContent, false);
                }
            }
            
            // Signal completion
            streamingCallback(fullContent, true);

            if (!fullContent || fullContent.trim().length === 0) {
                return {
                    success: false,
                    error: 'AI provider returned empty content',
                    editType: 'insert'
                };
            }

            // For streaming mode, the document has already been updated via callback
            // Just return success with the final content
            return {
                success: true,
                content: fullContent,
                editType: 'insert',
                appliedAt: documentContext.cursorPosition || { line: 0, ch: 0 }
            };

        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Streaming failed',
                editType: 'insert'
            };
        }
    }
}