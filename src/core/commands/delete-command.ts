/**
 * Delete command implementation for Nova
 * Handles removing content from documents
 */

import { App } from 'obsidian';
import { DocumentEngine } from '../document-engine';
import { ContextBuilder } from '../context-builder';
import { AIProviderManager } from '../../ai/provider-manager';
import { EditCommand as EditCommandType, EditResult, DocumentContext } from '../types';

export class DeleteCommand {
    constructor(
        private app: App,
        private documentEngine: DocumentEngine,
        private contextBuilder: ContextBuilder,
        private providerManager: AIProviderManager
    ) {}

    /**
     * Execute delete command
     */
    async execute(command: EditCommandType): Promise<EditResult> {
        try {
            // Get document context
            const documentContext = await this.documentEngine.getDocumentContext();
            if (!documentContext) {
                return {
                    success: false,
                    error: 'No active document found',
                    editType: 'delete'
                };
            }

            // Validate command requirements
            const validation = this.validateCommand(command, !!documentContext.selectedText);
            if (!validation.valid) {
                return {
                    success: false,
                    error: validation.error,
                    editType: 'delete'
                };
            }

            // For smart deletion, we may need AI to determine what to delete
            if (command.instruction && command.instruction.trim().length > 0) {
                // Generate AI prompt to identify what should be deleted
                const prompt = this.contextBuilder.buildPrompt(command, documentContext);
                
                // Validate prompt
                const promptValidation = this.contextBuilder.validatePrompt(prompt);
                if (!promptValidation.valid) {
                    return {
                        success: false,
                        error: `Prompt validation failed: ${promptValidation.issues.join(', ')}`,
                        editType: 'delete'
                    };
                }

                try {
                    // Ask AI what content should be deleted
                    const aiResponse = await this.providerManager.generateText(
                        prompt.userPrompt,
                        {
                            systemPrompt: prompt.systemPrompt,
                            temperature: prompt.config.temperature,
                            maxTokens: prompt.config.maxTokens
                        }
                    );

                    // Parse AI response to determine deletion action
                    // For MVP, we'll proceed with the target-based deletion
                } catch (error) {
                    return {
                        success: false,
                        error: error instanceof Error ? error.message : 'AI analysis failed',
                        editType: 'delete'
                    };
                }
            }

            // Apply the deletion based on target
            return await this.applyDeletion(command, documentContext);

        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                editType: 'delete'
            };
        }
    }

    /**
     * Apply deletion based on command target
     */
    private async applyDeletion(
        command: EditCommandType,
        documentContext: DocumentContext
    ): Promise<EditResult> {
        switch (command.target) {
            case 'selection':
                if (documentContext.selectedText) {
                    return await this.documentEngine.applyEdit(
                        '',
                        'selection',
                        {
                            scrollToEdit: true,
                            selectNewText: false
                        }
                    );
                } else {
                    return {
                        success: false,
                        error: 'No text selected for deletion',
                        editType: 'delete'
                    };
                }

            case 'section':
                if (command.location) {
                    const section = await this.documentEngine.findSection(command.location);
                    if (section) {
                        // Delete the entire section including heading
                        const startPos = { line: section.range.start, ch: 0 };
                        const endPos = { line: section.range.end + 1, ch: 0 };
                        
                        const editor = this.documentEngine.getActiveEditor();
                        if (!editor) {
                            return {
                                success: false,
                                error: 'No active editor',
                                editType: 'delete'
                            };
                        }

                        editor.replaceRange('', startPos, endPos);
                        
                        return {
                            success: true,
                            content: '',
                            editType: 'delete',
                            appliedAt: startPos
                        };
                    } else {
                        return {
                            success: false,
                            error: `Section "${command.location}" not found`,
                            editType: 'delete'
                        };
                    }
                } else {
                    return {
                        success: false,
                        error: 'Section name required for section deletion',
                        editType: 'delete'
                    };
                }

            case 'paragraph':
                // Delete current paragraph at cursor position
                if (documentContext.cursorPosition) {
                    const editor = this.documentEngine.getActiveEditor();
                    if (!editor) {
                        return {
                            success: false,
                            error: 'No active editor',
                            editType: 'delete'
                        };
                    }

                    const currentLine = documentContext.cursorPosition.line;
                    const lineContent = editor.getLine(currentLine);
                    
                    // Find paragraph boundaries (empty lines or heading markers)
                    let startLine = currentLine;
                    let endLine = currentLine;
                    
                    // Find start of paragraph
                    while (startLine > 0) {
                        const prevLine = editor.getLine(startLine - 1);
                        if (prevLine.trim() === '' || prevLine.startsWith('#')) {
                            break;
                        }
                        startLine--;
                    }
                    
                    // Find end of paragraph
                    const lineCount = editor.lineCount();
                    while (endLine < lineCount - 1) {
                        const nextLine = editor.getLine(endLine + 1);
                        if (nextLine.trim() === '' || nextLine.startsWith('#')) {
                            break;
                        }
                        endLine++;
                    }

                    // Delete the paragraph
                    const startPos = { line: startLine, ch: 0 };
                    const endPos = { line: endLine + 1, ch: 0 };
                    
                    editor.replaceRange('', startPos, endPos);
                    
                    return {
                        success: true,
                        content: '',
                        editType: 'delete',
                        appliedAt: startPos
                    };
                } else {
                    return {
                        success: false,
                        error: 'No cursor position available',
                        editType: 'delete'
                    };
                }

            case 'document':
                // Clear entire document content
                return await this.documentEngine.setDocumentContent('');

            case 'end':
                // Delete content from end - not meaningful for delete command
                return {
                    success: false,
                    error: 'Cannot delete from end of document. Use a different target.',
                    editType: 'delete'
                };

            default:
                return {
                    success: false,
                    error: 'Invalid deletion target',
                    editType: 'delete'
                };
        }
    }

    /**
     * Validate delete command requirements
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

        // Check if location is required for section deletion
        if (command.target === 'section' && !command.location) {
            return {
                valid: false,
                error: 'Section name required for section deletion'
            };
        }

        // Validate target is appropriate for deletion
        if (command.target === 'end') {
            return {
                valid: false,
                error: 'Cannot delete from end of document. Use a different target.'
            };
        }

        return { valid: true };
    }

    /**
     * Get suggestions for delete commands
     */
    getSuggestions(documentContext: DocumentContext, hasSelection: boolean): string[] {
        const suggestions: string[] = [];

        if (hasSelection) {
            suggestions.push(
                'Delete the selected text',
                'Remove this content',
                'Clear the selection'
            );
        } else {
            suggestions.push(
                'Delete the current paragraph',
                'Remove empty sections',
                'Clear redundant content',
                'Delete duplicate information'
            );

            // Add section-specific deletion suggestions
            if (documentContext.headings.length > 0) {
                documentContext.headings.forEach(heading => {
                    suggestions.push(`Delete the "${heading.text}" section`);
                });
            }
        }

        return suggestions.slice(0, 8); // Limit to 8 suggestions
    }

    /**
     * Preview what would be deleted
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
                        previewText = 'Will delete the selected text';
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
                            affectedContent = `${section.heading}\n\n${section.content}`;
                            previewText = `Will delete the entire "${command.location}" section`;
                        } else {
                            return {
                                success: false,
                                error: `Section "${command.location}" not found`
                            };
                        }
                    } else {
                        return {
                            success: false,
                            error: 'Section name required for preview'
                        };
                    }
                    break;

                case 'paragraph':
                    previewText = 'Will delete the current paragraph';
                    // Get current paragraph content
                    if (documentContext.cursorPosition) {
                        const editor = this.documentEngine.getActiveEditor();
                        if (editor) {
                            const currentLine = documentContext.cursorPosition.line;
                            let paragraphLines: string[] = [];
                            
                            // Find paragraph boundaries
                            let startLine = currentLine;
                            let endLine = currentLine;
                            
                            // Find start of paragraph
                            while (startLine > 0) {
                                const prevLine = editor.getLine(startLine - 1);
                                if (prevLine.trim() === '' || prevLine.startsWith('#')) {
                                    break;
                                }
                                startLine--;
                            }
                            
                            // Find end of paragraph
                            const lineCount = editor.lineCount();
                            while (endLine < lineCount - 1) {
                                const nextLine = editor.getLine(endLine + 1);
                                if (nextLine.trim() === '' || nextLine.startsWith('#')) {
                                    break;
                                }
                                endLine++;
                            }

                            // Get paragraph content
                            for (let i = startLine; i <= endLine; i++) {
                                paragraphLines.push(editor.getLine(i));
                            }
                            affectedContent = paragraphLines.join('\n');
                        }
                    }
                    break;

                case 'document':
                    affectedContent = documentContext.content;
                    previewText = 'Will delete all document content';
                    break;

                case 'end':
                    return {
                        success: false,
                        error: 'Cannot delete from end of document'
                    };

                default:
                    return {
                        success: false,
                        error: 'Invalid deletion target'
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
     * Get delete targets available for current context
     */
    getAvailableTargets(documentContext: DocumentContext): EditCommandType['target'][] {
        const targets: EditCommandType['target'][] = ['paragraph', 'document'];

        if (documentContext.selectedText) {
            targets.unshift('selection');
        }

        if (documentContext.headings.length > 0) {
            targets.splice(-1, 0, 'section'); // Insert before 'document'
        }

        return targets;
    }

    /**
     * Estimate the scope of deletion
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
                        charactersAffected = section.content.length + section.heading.length;
                        linesAffected = section.range.end - section.range.start + 1;
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
                charactersAffected = 0;
                linesAffected = 0;
                scopeDescription = 'Invalid target for deletion';
                break;
        }

        return {
            charactersAffected,
            linesAffected,
            scopeDescription
        };
    }
}