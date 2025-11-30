/**
 * Rewrite command implementation for Nova
 * Handles generating alternative content at cursor position
 */

import { App } from 'obsidian';
import { DocumentEngine } from '../document-engine';
import { ContextBuilder, GeneratedPrompt } from '../context-builder';
import { AIProviderManager } from '../../ai/provider-manager';
import { EditCommand as EditCommandType, EditResult, DocumentContext } from '../types';
import { StreamingCallback } from './add-command';

export class RewriteCommand {
    constructor(
        private app: App,
        private documentEngine: DocumentEngine,
        private contextBuilder: ContextBuilder,
        private providerManager: AIProviderManager
    ) {}

    /**
     * Execute rewrite command
     */
    async execute(command: EditCommandType, streamingCallback?: StreamingCallback): Promise<EditResult> {
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
            const validation = this.validateCommand(command);
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
                            editType: 'replace' as const
                        };
                    }

                    // Apply the rewrite based on target
                    result = await this.applyRewrite(command, documentContext, content);
                }

                // Log only failures as assistant messages
                // Success will be handled by sidebar's success indicator
                // Failure will also be handled by sidebar's error indicator

                return result;

            } catch (error) {
                return {
                    success: false,
                    error: error instanceof Error ? error.message : 'AI generation failed',
                    editType: 'replace' as const
                };
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
     * Apply rewrite based on command target
     */
    private async applyRewrite(
        command: EditCommandType,
        documentContext: DocumentContext,
        content: string
    ): Promise<EditResult> {
        switch (command.target) {
            case 'document':
                // Replace entire document with rewritten version
                return await this.documentEngine.setDocumentContent(content);

            case 'end':
                // Add rewritten content to end of document
                return await this.documentEngine.applyEdit(
                    content,
                    'end',
                    {
                        scrollToEdit: true,
                        selectNewText: true
                    }
                );

            case 'selection':
                // Rewrite selected content
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
                        error: 'No text selected for rewriting',
                        editType: 'replace'
                    };
                }

            case 'cursor':
                // Insert rewritten content at cursor
                return await this.documentEngine.applyEdit(
                    content,
                    'cursor',
                    {
                        scrollToEdit: true,
                        selectNewText: true
                    }
                );

            default:
                return {
                    success: false,
                    error: `Invalid rewrite target: ${command.target}`,
                    editType: 'replace'
                };
        }
    }

    /**
     * Validate rewrite command
     */
    private validateCommand(command: EditCommandType): { valid: boolean; error?: string } {
        // Validate action is rewrite
        if (command.action !== 'rewrite') {
            return {
                valid: false,
                error: 'Command action must be rewrite'
            };
        }

        // Validate instruction is provided
        if (!command.instruction || command.instruction.trim().length === 0) {
            return {
                valid: false,
                error: 'Rewrite instruction is required'
            };
        }

        return { valid: true };
    }

    /**
     * Execute rewrite command with streaming support
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
                    editType: 'replace'
                };
            }

            // For streaming mode, the document has already been updated via callback
            // Just return success with the final content
            return {
                success: true,
                content: fullContent,
                editType: 'replace',
                appliedAt: documentContext.cursorPosition || { line: 0, ch: 0 }
            };

        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Streaming failed',
                editType: 'replace'
            };
        }
    }
}