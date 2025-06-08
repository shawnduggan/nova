/**
 * Edit command implementation for Nova
 * Handles modifying and improving existing content
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

                // Don't log success messages - handled by UI
                if (!result.success) {
                    await this.documentEngine.addAssistantMessage('Failed to edit content', result);
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
                return await this.documentEngine.applyEdit(
                    content,
                    'selection',
                    {
                        scrollToEdit: true,
                        selectNewText: true
                    }
                );

            case 'section':
                if (command.location) {
                    const section = await this.documentEngine.findSection(command.location);
                    if (section) {
                        // Replace the entire section content (excluding heading)
                        const newSectionContent = `${section.heading}\n\n${content}`;
                        
                        // Calculate the position to replace from heading line to section end
                        const startPos = { line: section.range.start, ch: 0 };
                        const endPos = { line: section.range.end + 1, ch: 0 };
                        
                        const editor = this.documentEngine.getActiveEditor();
                        if (!editor) {
                            return {
                                success: false,
                                error: 'No active editor',
                                editType: 'replace'
                            };
                        }

                        editor.replaceRange(newSectionContent, startPos, endPos);
                        
                        return {
                            success: true,
                            content: newSectionContent,
                            editType: 'replace',
                            appliedAt: startPos
                        };
                    } else {
                        return {
                            success: false,
                            error: `Section "${command.location}" not found`,
                            editType: 'replace'
                        };
                    }
                }
                // Fall through to paragraph if no location specified
                
            case 'paragraph':
                return await this.documentEngine.applyEdit(
                    content,
                    'cursor',
                    {
                        scrollToEdit: true,
                        selectNewText: true
                    }
                );

            case 'document':
                return await this.documentEngine.setDocumentContent(content);

            case 'end':
                // For edit commands targeting end, treat as adding to end
                return await this.documentEngine.applyEdit(
                    content,
                    'end',
                    {
                        scrollToEdit: true,
                        selectNewText: false
                    }
                );

            default:
                return {
                    success: false,
                    error: 'Invalid edit target',
                    editType: 'replace'
                };
        }
    }

    /**
     * Validate edit command requirements
     */
    validateCommand(command: EditCommandType, hasSelection: boolean): {
        valid: boolean;
        error?: string;
    } {
        // Check if selection is required but not available
        if (command.target === 'selection' && !hasSelection) {
            return {
                valid: false,
                error: 'This command requires text to be selected first'
            };
        }

        // Check if location is required but not provided for section edits
        if (command.target === 'section' && command.action === 'edit' && command.location) {
            // Location is provided, which is good for section edits
            return { valid: true };
        }

        return { valid: true };
    }

    /**
     * Get suggestions for edit commands
     */
    getSuggestions(documentContext: DocumentContext, hasSelection: boolean): string[] {
        const suggestions: string[] = [];

        if (hasSelection) {
            suggestions.push(
                'Make this more concise',
                'Make this more professional',
                'Make this more detailed',
                'Improve clarity and flow',
                'Make this more formal',
                'Simplify this text',
                'Expand on this point',
                'Make this more engaging'
            );
        } else {
            suggestions.push(
                'Improve the writing style',
                'Make the document more professional',
                'Enhance clarity throughout',
                'Improve the introduction',
                'Polish the conclusion',
                'Make it more concise',
                'Add more detail',
                'Improve the flow between sections'
            );

            // Add section-specific suggestions
            if (documentContext.headings.length > 0) {
                documentContext.headings.forEach(heading => {
                    suggestions.push(`Improve the "${heading.text}" section`);
                });
            }
        }

        return suggestions.slice(0, 10); // Limit to 10 suggestions
    }

    /**
     * Preview what would be edited
     */
    async preview(command: EditCommandType): Promise<{
        success: boolean;
        preview?: string;
        affectedContent?: string;
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

            let affectedContent = '';
            let previewText = '';

            switch (command.target) {
                case 'selection':
                    if (documentContext.selectedText) {
                        affectedContent = documentContext.selectedText;
                        previewText = 'Will edit the selected text';
                    } else {
                        return {
                            success: false,
                            error: 'No text is currently selected'
                        };
                    }
                    break;

                case 'section':
                    if (command.location) {
                        const section = await this.documentEngine.findSection(command.location);
                        if (section) {
                            affectedContent = section.content;
                            previewText = `Will edit the entire "${command.location}" section`;
                        } else {
                            return {
                                success: false,
                                error: `Section "${command.location}" not found`
                            };
                        }
                    } else {
                        previewText = 'Will edit content at cursor position';
                    }
                    break;

                case 'paragraph':
                    previewText = 'Will edit content at cursor position';
                    // Get surrounding context
                    if (documentContext.surroundingLines) {
                        const currentLine = documentContext.cursorPosition?.line ?? 0;
                        const editor = this.documentEngine.getActiveEditor();
                        if (editor) {
                            affectedContent = editor.getLine(currentLine);
                        }
                    }
                    break;

                case 'document':
                    affectedContent = documentContext.content;
                    previewText = 'Will edit the entire document';
                    break;

                case 'end':
                    previewText = 'Will add edited content at the end of the document';
                    break;

                default:
                    return {
                        success: false,
                        error: 'Invalid edit target'
                    };
            }

            return {
                success: true,
                preview: previewText,
                affectedContent: affectedContent.length > 200 ? 
                    affectedContent.substring(0, 200) + '...' : 
                    affectedContent
            };

        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Get edit targets available for current context
     */
    getAvailableTargets(documentContext: DocumentContext): EditCommandType['target'][] {
        const targets: EditCommandType['target'][] = ['paragraph', 'document', 'end'];

        if (documentContext.selectedText) {
            targets.unshift('selection');
        }

        if (documentContext.headings.length > 0) {
            targets.splice(-2, 0, 'section'); // Insert before 'document' and 'end'
        }

        return targets;
    }

    /**
     * Estimate the scope of changes
     */
    async estimateScope(command: EditCommandType): Promise<{
        charactersAffected: number;
        linesAffected: number;
        scopeDescription: string;
    }> {
        const documentContext = await this.documentEngine.getDocumentContext();
        if (!documentContext) {
            return {
                charactersAffected: 0,
                linesAffected: 0,
                scopeDescription: 'No document available'
            };
        }

        let charactersAffected = 0;
        let linesAffected = 0;
        let scopeDescription = '';

        switch (command.target) {
            case 'selection':
                if (documentContext.selectedText) {
                    charactersAffected = documentContext.selectedText.length;
                    linesAffected = documentContext.selectedText.split('\n').length;
                    scopeDescription = 'Selected text only';
                }
                break;

            case 'section':
                if (command.location) {
                    const section = await this.documentEngine.findSection(command.location);
                    if (section) {
                        charactersAffected = section.content.length;
                        linesAffected = section.range.end - section.range.start;
                        scopeDescription = `"${command.location}" section`;
                    }
                }
                break;

            case 'paragraph':
                // Estimate single paragraph
                charactersAffected = 100; // Rough estimate
                linesAffected = 1;
                scopeDescription = 'Current paragraph';
                break;

            case 'document':
                charactersAffected = documentContext.content.length;
                linesAffected = documentContext.content.split('\n').length;
                scopeDescription = 'Entire document';
                break;

            case 'end':
                charactersAffected = 0; // New content
                linesAffected = 0;
                scopeDescription = 'New content at end';
                break;
        }

        return {
            charactersAffected,
            linesAffected,
            scopeDescription
        };
    }
}