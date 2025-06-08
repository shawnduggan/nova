/**
 * Grammar command implementation for Nova
 * Handles grammar checking and correction of content
 */

import { App } from 'obsidian';
import { DocumentEngine } from '../document-engine';
import { ContextBuilder } from '../context-builder';
import { AIProviderManager } from '../../ai/provider-manager';
import { EditCommand as EditCommandType, EditResult, DocumentContext } from '../types';

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

            // Generate AI prompt for grammar correction with conversation context
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

            // Get AI completion for grammar correction
            try {
                // Log user request
                await this.documentEngine.addUserMessage(command.instruction, command);

                const correctedContent = await this.providerManager.generateText(
                    prompt.userPrompt,
                    {
                        systemPrompt: prompt.systemPrompt,
                        temperature: 0.3, // Lower temperature for grammar corrections
                        maxTokens: prompt.config.maxTokens
                    }
                );

                if (!correctedContent || correctedContent.trim().length === 0) {
                    const result = {
                        success: false,
                        error: 'AI provider returned empty content',
                        editType: 'replace' as const
                    };
                    
                    // Log failed response
                    await this.documentEngine.addAssistantMessage('Failed to generate corrected content', result);
                    return result;
                }

                // Apply the grammar correction based on target
                const result = await this.applyGrammarCorrection(command, documentContext, correctedContent);

                // Don't log success messages - handled by UI
                if (!result.success) {
                    await this.documentEngine.addAssistantMessage('Failed to correct grammar', result);
                }

                return result;

            } catch (error) {
                const result = {
                    success: false,
                    error: error instanceof Error ? error.message : 'Grammar correction failed',
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
     * Apply grammar correction based on command target
     */
    private async applyGrammarCorrection(
        command: EditCommandType,
        documentContext: DocumentContext,
        correctedContent: string
    ): Promise<EditResult> {
        switch (command.target) {
            case 'selection':
                return await this.documentEngine.applyEdit(
                    correctedContent,
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
                        const newSectionContent = `${section.heading}\n\n${correctedContent}`;
                        
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
                // Apply grammar correction to current paragraph
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

                    // Replace the paragraph with corrected content
                    const startPos = { line: startLine, ch: 0 };
                    const endPos = { line: endLine, ch: editor.getLine(endLine).length };
                    
                    editor.replaceRange(correctedContent, startPos, endPos);
                    
                    return {
                        success: true,
                        content: correctedContent,
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
                return await this.documentEngine.setDocumentContent(correctedContent);

            case 'end':
                // For grammar commands targeting end, treat as adding corrected content to end
                return await this.documentEngine.applyEdit(
                    correctedContent,
                    'end',
                    {
                        scrollToEdit: true,
                        selectNewText: false
                    }
                );

            default:
                return {
                    success: false,
                    error: 'Invalid grammar correction target',
                    editType: 'replace'
                };
        }
    }

    /**
     * Validate grammar command requirements
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
        if (command.target === 'section' && command.action === 'grammar' && command.location) {
            // Location is provided, which is good for section grammar correction
            return { valid: true };
        }

        return { valid: true };
    }

    /**
     * Get suggestions for grammar commands
     */
    getSuggestions(documentContext: DocumentContext, hasSelection: boolean): string[] {
        const suggestions: string[] = [];

        if (hasSelection) {
            suggestions.push(
                'Fix grammar in selected text',
                'Correct spelling and punctuation',
                'Improve sentence structure',
                'Fix capitalization errors',
                'Correct verb tenses',
                'Fix subject-verb agreement',
                'Improve readability'
            );
        } else {
            suggestions.push(
                'Check grammar throughout document',
                'Fix spelling errors',
                'Correct punctuation',
                'Improve sentence structure',
                'Fix grammatical errors in current paragraph',
                'Check for common mistakes',
                'Proofread the document'
            );

            // Add section-specific grammar suggestions
            if (documentContext.headings.length > 0) {
                documentContext.headings.forEach(heading => {
                    suggestions.push(`Check grammar in "${heading.text}" section`);
                });
            }
        }

        return suggestions.slice(0, 10); // Limit to 10 suggestions
    }

    /**
     * Preview what would be grammar-corrected
     */
    async preview(command: EditCommandType): Promise<{
        success: boolean;
        preview?: string;
        affectedContent?: string;
        potentialIssues?: string[];
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
            const potentialIssues: string[] = [];

            switch (command.target) {
                case 'selection':
                    if (documentContext.selectedText) {
                        affectedContent = documentContext.selectedText;
                        previewText = 'Will check grammar in the selected text';
                        
                        // Basic grammar issue detection
                        potentialIssues.push(...this.detectPotentialIssues(affectedContent));
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
                            previewText = `Will check grammar in the "${command.location}" section`;
                            potentialIssues.push(...this.detectPotentialIssues(affectedContent));
                        } else {
                            return {
                                success: false,
                                error: `Section "${command.location}" not found`
                            };
                        }
                    } else {
                        previewText = 'Will check grammar at cursor position';
                    }
                    break;

                case 'paragraph':
                    previewText = 'Will check grammar in the current paragraph';
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
                            potentialIssues.push(...this.detectPotentialIssues(affectedContent));
                        }
                    }
                    break;

                case 'document':
                    affectedContent = documentContext.content;
                    previewText = 'Will check grammar throughout the entire document';
                    potentialIssues.push(...this.detectPotentialIssues(affectedContent));
                    break;

                case 'end':
                    previewText = 'Will add grammar-corrected content at the end of the document';
                    break;

                default:
                    return {
                        success: false,
                        error: 'Invalid grammar correction target'
                    };
            }

            return {
                success: true,
                preview: previewText,
                affectedContent: affectedContent.length > 200 ? 
                    affectedContent.substring(0, 200) + '...' : 
                    affectedContent,
                potentialIssues: potentialIssues.slice(0, 5) // Limit to 5 issues
            };

        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Detect potential grammar issues in text
     */
    private detectPotentialIssues(text: string): string[] {
        const issues: string[] = [];
        
        // Basic pattern matching for common issues
        const patterns = [
            { pattern: /\bi\s/gi, issue: 'Lowercase "i" should be capitalized' },
            { pattern: /\.\s*[a-z]/g, issue: 'Sentence should start with capital letter' },
            { pattern: /\s{2,}/g, issue: 'Multiple spaces detected' },
            { pattern: /[.!?]{2,}/g, issue: 'Multiple punctuation marks' },
            { pattern: /\s+[.!?,:;]/g, issue: 'Space before punctuation' },
            { pattern: /[.!?]\w/g, issue: 'Missing space after punctuation' },
            { pattern: /\bteh\b/gi, issue: 'Common typo: "teh" should be "the"' },
            { pattern: /\band\s+and\b/gi, issue: 'Duplicate "and"' },
            { pattern: /\bthe\s+the\b/gi, issue: 'Duplicate "the"' },
            { pattern: /\bis\s+is\b/gi, issue: 'Duplicate "is"' }
        ];

        patterns.forEach(({ pattern, issue }) => {
            if (pattern.test(text)) {
                issues.push(issue);
            }
        });

        return issues;
    }

    /**
     * Get grammar check targets available for current context
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
     * Estimate the scope of grammar correction
     */
    async estimateScope(command: EditCommandType): Promise<{
        charactersAffected: number;
        linesAffected: number;
        scopeDescription: string;
        estimatedIssues: number;
    }> {
        const documentContext = await this.documentEngine.getDocumentContext();
        if (!documentContext) {
            return {
                charactersAffected: 0,
                linesAffected: 0,
                scopeDescription: 'No document available',
                estimatedIssues: 0
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

        // Estimate potential issues
        const estimatedIssues = this.detectPotentialIssues(contentToAnalyze).length;

        return {
            charactersAffected,
            linesAffected,
            scopeDescription,
            estimatedIssues
        };
    }
}