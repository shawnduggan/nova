/**
 * Rewrite command implementation for Nova
 * Handles rewriting content with different styles and approaches
 */

import { App } from 'obsidian';
import { DocumentEngine } from '../document-engine';
import { ContextBuilder } from '../context-builder';
import { AIProviderManager } from '../../ai/provider-manager';
import { EditCommand as EditCommandType, EditResult, DocumentContext } from '../types';

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

            // Generate AI prompt for rewriting with conversation context
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

            // Get AI completion for rewriting
            try {
                // Log user request
                await this.documentEngine.addUserMessage(command.instruction, command);

                const rewrittenContent = await this.providerManager.generateText(
                    prompt.userPrompt,
                    {
                        systemPrompt: prompt.systemPrompt,
                        temperature: prompt.config.temperature,
                        maxTokens: prompt.config.maxTokens
                    }
                );

                if (!rewrittenContent || rewrittenContent.trim().length === 0) {
                    const result = {
                        success: false,
                        error: 'AI provider returned empty content',
                        editType: 'replace' as const
                    };
                    
                    // Log failed response
                    await this.documentEngine.addAssistantMessage('Failed to generate rewritten content', result);
                    return result;
                }

                // Apply the rewrite based on target
                const result = await this.applyRewrite(command, documentContext, rewrittenContent);

                // Don't log success messages - handled by UI
                if (!result.success) {
                    await this.documentEngine.addAssistantMessage('Failed to rewrite content', result);
                }

                return result;

            } catch (error) {
                const result = {
                    success: false,
                    error: error instanceof Error ? error.message : 'Rewrite generation failed',
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
     * Apply rewrite based on command target
     */
    private async applyRewrite(
        command: EditCommandType,
        documentContext: DocumentContext,
        rewrittenContent: string
    ): Promise<EditResult> {
        switch (command.target) {
            case 'selection':
                return await this.documentEngine.applyEdit(
                    rewrittenContent,
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
                        // Replace section content while preserving heading
                        const newSectionContent = `${section.heading}\n\n${rewrittenContent}`;
                        
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
                // Apply rewrite to current paragraph
                if (documentContext.cursorPosition) {
                    const editor = this.documentEngine.getActiveEditor();
                    if (!editor) {
                        return {
                            success: false,
                            error: 'No active editor',
                            editType: 'replace'
                        };
                    }

                    const currentLine = documentContext.cursorPosition.line;
                    
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

                    // Replace the paragraph with rewritten content
                    const startPos = { line: startLine, ch: 0 };
                    const endPos = { line: endLine, ch: editor.getLine(endLine).length };
                    
                    editor.replaceRange(rewrittenContent, startPos, endPos);
                    
                    return {
                        success: true,
                        content: rewrittenContent,
                        editType: 'replace',
                        appliedAt: startPos
                    };
                } else {
                    return {
                        success: false,
                        error: 'No cursor position available',
                        editType: 'replace'
                    };
                }

            case 'document':
                return await this.documentEngine.setDocumentContent(rewrittenContent);

            case 'end':
                // For rewrite commands targeting end, treat as adding rewritten content to end
                return await this.documentEngine.applyEdit(
                    rewrittenContent,
                    'end',
                    {
                        scrollToEdit: true,
                        selectNewText: false
                    }
                );

            default:
                return {
                    success: false,
                    error: 'Invalid rewrite target',
                    editType: 'replace'
                };
        }
    }

    /**
     * Validate rewrite command requirements
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

        // For section targets, location should be provided for better accuracy
        if (command.target === 'section' && command.action === 'rewrite' && command.location) {
            // Location is provided, which is good for section rewriting
            return { valid: true };
        }

        return { valid: true };
    }

    /**
     * Get suggestions for rewrite commands
     */
    getSuggestions(documentContext: DocumentContext, hasSelection: boolean): string[] {
        const suggestions: string[] = [];

        if (hasSelection) {
            suggestions.push(
                'Rewrite in a more formal tone',
                'Rewrite in a casual tone',
                'Make this more concise',
                'Expand with more detail',
                'Rewrite for clarity',
                'Simplify the language',
                'Make it more engaging',
                'Rewrite in bullet points',
                'Convert to narrative form'
            );
        } else {
            suggestions.push(
                'Rewrite the current paragraph',
                'Rewrite in a different style',
                'Make the writing more engaging',
                'Simplify complex language',
                'Rewrite for different audience',
                'Convert to more formal tone',
                'Make the content more concise'
            );

            // Add section-specific rewrite suggestions
            if (documentContext.headings.length > 0) {
                documentContext.headings.forEach(heading => {
                    suggestions.push(`Rewrite the "${heading.text}" section`);
                });
            }
        }

        return suggestions.slice(0, 10); // Limit to 10 suggestions
    }

    /**
     * Preview what would be rewritten
     */
    async preview(command: EditCommandType): Promise<{
        success: boolean;
        preview?: string;
        affectedContent?: string;
        rewriteStyle?: string;
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
            const rewriteStyle = this.inferRewriteStyle(command.instruction);

            switch (command.target) {
                case 'selection':
                    if (documentContext.selectedText) {
                        affectedContent = documentContext.selectedText;
                        previewText = `Will rewrite the selected text`;
                        if (rewriteStyle) {
                            previewText += ` (${rewriteStyle})`;
                        }
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
                            previewText = `Will rewrite the "${command.location}" section`;
                            if (rewriteStyle) {
                                previewText += ` (${rewriteStyle})`;
                            }
                        } else {
                            return {
                                success: false,
                                error: `Section "${command.location}" not found`
                            };
                        }
                    } else {
                        previewText = 'Will rewrite content at cursor position';
                    }
                    break;

                case 'paragraph':
                    previewText = 'Will rewrite the current paragraph';
                    if (rewriteStyle) {
                        previewText += ` (${rewriteStyle})`;
                    }
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
                    previewText = 'Will rewrite the entire document';
                    if (rewriteStyle) {
                        previewText += ` (${rewriteStyle})`;
                    }
                    break;

                case 'end':
                    previewText = 'Will add rewritten content at the end of the document';
                    if (rewriteStyle) {
                        previewText += ` (${rewriteStyle})`;
                    }
                    break;

                default:
                    return {
                        success: false,
                        error: 'Invalid rewrite target'
                    };
            }

            return {
                success: true,
                preview: previewText,
                affectedContent: affectedContent.length > 200 ? 
                    affectedContent.substring(0, 200) + '...' : 
                    affectedContent,
                rewriteStyle
            };

        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Infer rewrite style from instruction
     */
    private inferRewriteStyle(instruction: string): string {
        const lowerInstruction = instruction.toLowerCase();
        
        if (lowerInstruction.includes('formal')) return 'formal tone';
        if (lowerInstruction.includes('casual') || lowerInstruction.includes('informal')) return 'casual tone';
        if (lowerInstruction.includes('concise') || lowerInstruction.includes('shorter')) return 'more concise';
        if (lowerInstruction.includes('expand') || lowerInstruction.includes('detail')) return 'more detailed';
        if (lowerInstruction.includes('simple') || lowerInstruction.includes('simplify')) return 'simplified language';
        if (lowerInstruction.includes('engaging') || lowerInstruction.includes('interesting')) return 'more engaging';
        if (lowerInstruction.includes('professional')) return 'professional tone';
        if (lowerInstruction.includes('bullet') || lowerInstruction.includes('list')) return 'bullet point format';
        if (lowerInstruction.includes('narrative') || lowerInstruction.includes('story')) return 'narrative style';
        if (lowerInstruction.includes('technical')) return 'technical style';
        if (lowerInstruction.includes('creative')) return 'creative style';
        
        return '';
    }

    /**
     * Get rewrite targets available for current context
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
     * Estimate the scope of rewriting
     */
    async estimateScope(command: EditCommandType): Promise<{
        charactersAffected: number;
        linesAffected: number;
        scopeDescription: string;
        rewriteComplexity: 'low' | 'medium' | 'high';
    }> {
        const documentContext = await this.documentEngine.getDocumentContext();
        if (!documentContext) {
            return {
                charactersAffected: 0,
                linesAffected: 0,
                scopeDescription: 'No document available',
                rewriteComplexity: 'low'
            };
        }

        let charactersAffected = 0;
        let linesAffected = 0;
        let scopeDescription = '';
        let contentToAnalyze = '';

        switch (command.target) {
            case 'selection':
                if (documentContext.selectedText) {
                    charactersAffected = documentContext.selectedText.length;
                    linesAffected = documentContext.selectedText.split('\n').length;
                    scopeDescription = 'Selected text only';
                    contentToAnalyze = documentContext.selectedText;
                }
                break;

            case 'section':
                if (command.location) {
                    const section = await this.documentEngine.findSection(command.location);
                    if (section) {
                        charactersAffected = section.content.length;
                        linesAffected = section.range.end - section.range.start;
                        scopeDescription = `"${command.location}" section`;
                        contentToAnalyze = section.content;
                    }
                }
                break;

            case 'paragraph':
                // Estimate single paragraph
                charactersAffected = 100; // Rough estimate
                linesAffected = 1;
                scopeDescription = 'Current paragraph';
                // For estimation purposes, use surrounding context
                if (documentContext.surroundingLines) {
                    contentToAnalyze = documentContext.surroundingLines.before.join('\n') + 
                                    '\n' + documentContext.surroundingLines.after.join('\n');
                }
                break;

            case 'document':
                charactersAffected = documentContext.content.length;
                linesAffected = documentContext.content.split('\n').length;
                scopeDescription = 'Entire document';
                contentToAnalyze = documentContext.content;
                break;

            case 'end':
                charactersAffected = 0; // New content
                linesAffected = 0;
                scopeDescription = 'New content at end';
                break;
        }

        // Determine rewrite complexity based on content length and instruction
        const rewriteComplexity = this.estimateComplexity(contentToAnalyze, command.instruction);

        return {
            charactersAffected,
            linesAffected,
            scopeDescription,
            rewriteComplexity
        };
    }

    /**
     * Estimate rewrite complexity
     */
    private estimateComplexity(content: string, instruction: string): 'low' | 'medium' | 'high' {
        const contentLength = content.length;
        const lowerInstruction = instruction.toLowerCase();
        
        // Base complexity on content length
        let complexity: 'low' | 'medium' | 'high' = 'low';
        if (contentLength > 1000) complexity = 'high';
        else if (contentLength > 300) complexity = 'medium';
        
        // Adjust based on instruction complexity
        const complexInstructions = [
            'restructure', 'reorganize', 'completely rewrite', 'transform',
            'change style', 'different audience', 'technical', 'academic'
        ];
        
        if (complexInstructions.some(term => lowerInstruction.includes(term))) {
            if (complexity === 'low') complexity = 'medium';
            else if (complexity === 'medium') complexity = 'high';
        }
        
        return complexity;
    }
}