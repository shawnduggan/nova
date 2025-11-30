/**
 * Grammar command implementation for Nova
 * Handles fixing grammar and spelling at cursor position
 */

import { App } from 'obsidian';
import { DocumentEngine } from '../document-engine';
import { ContextBuilder, GeneratedPrompt } from '../context-builder';
import { AIProviderManager } from '../../ai/provider-manager';
import { EditCommand as EditCommandType, EditResult, DocumentContext } from '../types';
import { StreamingCallback } from './add-command';

export class GrammarCommand {
    constructor(
        private app: App,
        private documentEngine: DocumentEngine,
        private contextBuilder: ContextBuilder,
        private providerManager: AIProviderManager
    ) {}

    /**
     * Execute grammar command
     */
    async execute(command: EditCommandType, streamingCallback?: StreamingCallback): Promise<EditResult> {
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

                    // Apply the grammar fix based on target
                    result = this.applyGrammarFix(command, documentContext, content);
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
     * Apply grammar fix based on command target
     */
    private applyGrammarFix(
        command: EditCommandType,
        documentContext: DocumentContext,
        content: string
    ): EditResult {
        switch (command.target) {
            case 'selection':
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
                    return {
                        success: false,
                        error: 'No text selected for grammar correction',
                        editType: 'replace'
                    };
                }

            case 'document':
                // Replace entire document with corrected version
                return this.documentEngine.setDocumentContent(content);

            case 'cursor':
                // Grammar correction at cursor doesn't make much sense, 
                // suggest selecting text instead
                return {
                    success: false,
                    error: 'Please select text to correct grammar, or use "document" to fix entire document',
                    editType: 'replace'
                };

            case 'end':
                // Grammar correction at end doesn't make sense
                return {
                    success: false,
                    error: 'Grammar correction requires selecting text or specifying "document"',
                    editType: 'replace'
                };

            default:
                return {
                    success: false,
                    error: `Invalid grammar target: ${command.target}`,
                    editType: 'replace'
                };
        }
    }

    /**
     * Validate grammar command
     */
    private validateCommand(
        command: EditCommandType, 
        hasSelection: boolean
    ): { valid: boolean; error?: string } {
        // Validate action is grammar
        if (command.action !== 'grammar') {
            return {
                valid: false,
                error: 'Command action must be grammar'
            };
        }

        // For grammar, we need either selection or document target
        if (command.target === 'selection' && !hasSelection) {
            return {
                valid: false,
                error: 'Please select text to correct grammar'
            };
        }

        if (command.target !== 'selection' && command.target !== 'document') {
            return {
                valid: false,
                error: 'Grammar correction requires selecting text or targeting entire document'
            };
        }

        return { valid: true };
    }

    /**
     * Execute grammar command with streaming support
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