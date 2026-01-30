/**
 * @file SmartVariableResolver - Intelligent resolution of template variables
 * Handles context-aware variable resolution based on cursor position, selection, and document analysis
 */

import { Editor, MarkdownView, EditorPosition } from 'obsidian';
import { Logger } from '../../../utils/logger';
import type { SmartContext, TemplateVariable } from '../types';
import type NovaPlugin from '../../../../main';

export class SmartVariableResolver {
    private plugin: NovaPlugin;
    private logger = Logger.scope('SmartVariableResolver');

    constructor(plugin: NovaPlugin) {
        this.plugin = plugin;
    }

    /**
     * Build comprehensive smart context from the current editor state
     */
    buildSmartContext(): SmartContext | null {
        const activeView = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView || !activeView.editor) {
            this.logger.warn('No active markdown editor found');
            return null;
        }

        const editor = activeView.editor;
        const file = activeView.file;
        
        if (!file) {
            this.logger.warn('No file associated with active editor');
            return null;
        }

        try {
            const document = editor.getValue();
            const selection = editor.getSelection();
            const cursor = editor.getCursor();
            
            const context: SmartContext = {
                selection: selection,
                document: document,
                title: file.basename,
                documentType: this.detectDocumentType(document, file.path),
                cursorContext: this.getCursorContext(editor, cursor),
                metrics: this.calculateMetrics(document),
                audienceLevel: this.inferAudienceLevel(document)
            };

            this.logger.debug('Built smart context', {
                hasSelection: !!selection,
                documentLength: document.length,
                documentType: context.documentType
            });

            return context;
            
        } catch (error) {
            this.logger.error('Failed to build smart context:', error);
            return null;
        }
    }

    /**
     * Detect the type of document based on content and metadata
     */
    private detectDocumentType(content: string, filePath: string): SmartContext['documentType'] {
        // Check file path patterns
        if (filePath.includes('/blog/') || filePath.includes('/posts/')) {
            return 'blog';
        }
        if (filePath.includes('/research/') || filePath.includes('/papers/')) {
            return 'academic';
        }
        if (filePath.includes('/docs/') || filePath.includes('/documentation/')) {
            return 'technical';
        }

        // Content-based detection
        const lowerContent = content.toLowerCase();
        
        // Academic indicators
        const academicTerms = ['abstract', 'methodology', 'literature review', 'hypothesis', 'conclusion', 'bibliography'];
        const academicScore = academicTerms.reduce((score, term) => 
            score + (lowerContent.includes(term) ? 1 : 0), 0);
            
        if (academicScore >= 2) {
            return 'academic';
        }

        // Technical indicators
        const technicalTerms = ['api', 'function', 'configuration', 'installation', 'documentation', 'parameters'];
        const technicalScore = technicalTerms.reduce((score, term) => 
            score + (lowerContent.includes(term) ? 1 : 0), 0);
            
        if (technicalScore >= 2) {
            return 'technical';
        }

        // Creative writing indicators
        const creativeTerms = ['character', 'dialogue', 'scene', 'plot', 'story', 'narrative'];
        const creativeScore = creativeTerms.reduce((score, term) => 
            score + (lowerContent.includes(term) ? 1 : 0), 0);
            
        if (creativeScore >= 2) {
            return 'creative';
        }

        // Blog indicators
        const blogTerms = ['share', 'experience', 'thoughts', 'today', 'recently', 'personal'];
        const blogScore = blogTerms.reduce((score, term) => 
            score + (lowerContent.includes(term) ? 1 : 0), 0);
            
        if (blogScore >= 2) {
            return 'blog';
        }

        return 'notes';
    }

    /**
     * Get context around the cursor position
     */
    private getCursorContext(editor: Editor, cursor: EditorPosition): string {
        const line = editor.getLine(cursor.line);
        const paragraph = this.getCurrentParagraph(editor, cursor.line);
        
        // If we have a paragraph, use it; otherwise use the current line
        return paragraph.trim() || line.trim();
    }

    /**
     * Get the current paragraph containing the cursor
     */
    private getCurrentParagraph(editor: Editor, currentLine: number): string {
        const lines: string[] = [];
        
        // Find start of paragraph (work backwards)
        let startLine = currentLine;
        while (startLine > 0) {
            const line = editor.getLine(startLine - 1).trim();
            if (line === '') break; // Empty line indicates paragraph break
            startLine--;
        }

        // Find end of paragraph (work forwards)
        let endLine = currentLine;
        const totalLines = editor.lineCount();
        while (endLine < totalLines - 1) {
            const line = editor.getLine(endLine + 1).trim();
            if (line === '') break; // Empty line indicates paragraph break
            endLine++;
        }

        // Collect all lines in the paragraph
        for (let i = startLine; i <= endLine; i++) {
            const line = editor.getLine(i);
            if (line.trim() !== '') {
                lines.push(line);
            }
        }

        return lines.join(' ');
    }

    /**
     * Calculate document metrics
     */
    private calculateMetrics(content: string): SmartContext['metrics'] {
        const words = content.split(/\s+/).filter(word => word.length > 0);
        const wordCount = words.length;
        
        // Simple reading level calculation (Flesch-Kincaid approximation)
        const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const avgWordsPerSentence = sentences.length > 0 ? wordCount / sentences.length : 0;
        const avgSyllablesPerWord = this.estimateAverageSyllables(words);
        
        const fleschScore = 206.835 - (1.015 * avgWordsPerSentence) - (84.6 * avgSyllablesPerWord);
        const readingLevel = this.fleschScoreToLevel(fleschScore);
        
        // Tone detection
        const tone = this.detectTone(content);

        return {
            wordCount,
            readingLevel,
            tone
        };
    }

    /**
     * Estimate average syllables per word (simplified)
     */
    private estimateAverageSyllables(words: string[]): number {
        if (words.length === 0) return 1;
        
        const totalSyllables = words.reduce((total, word) => {
            return total + this.countSyllables(word);
        }, 0);
        
        return totalSyllables / words.length;
    }

    /**
     * Count syllables in a word (simplified algorithm)
     */
    private countSyllables(word: string): number {
        word = word.toLowerCase();
        if (word.length <= 3) return 1;
        
        const vowels = 'aeiouy';
        let syllableCount = 0;
        let previousWasVowel = false;
        
        for (let i = 0; i < word.length; i++) {
            const isVowel = vowels.includes(word[i]);
            if (isVowel && !previousWasVowel) {
                syllableCount++;
            }
            previousWasVowel = isVowel;
        }
        
        // Handle silent 'e'
        if (word.endsWith('e')) {
            syllableCount--;
        }
        
        return Math.max(1, syllableCount);
    }

    /**
     * Convert Flesch reading score to level
     */
    private fleschScoreToLevel(score: number): string {
        if (score >= 90) return 'Elementary';
        if (score >= 80) return 'Middle School';
        if (score >= 70) return 'High School';
        if (score >= 60) return 'College';
        if (score >= 50) return 'Graduate';
        return 'Professional';
    }

    /**
     * Detect document tone
     */
    private detectTone(content: string): string {
        const lowerContent = content.toLowerCase();
        
        // Formal indicators
        const formalTerms = ['therefore', 'furthermore', 'however', 'consequently', 'nevertheless'];
        const formalScore = formalTerms.reduce((score, term) => 
            score + (lowerContent.includes(term) ? 1 : 0), 0);

        // Casual indicators
        const casualTerms = ['really', 'pretty', 'kind of', 'sort of', 'gonna', "i'm", "you're"];
        const casualScore = casualTerms.reduce((score, term) => 
            score + (lowerContent.includes(term) ? 1 : 0), 0);

        // Technical indicators
        const technicalTerms = ['implement', 'configure', 'execute', 'parameter', 'algorithm'];
        const technicalScore = technicalTerms.reduce((score, term) => 
            score + (lowerContent.includes(term) ? 1 : 0), 0);

        if (technicalScore > formalScore && technicalScore > casualScore) {
            return 'Technical';
        }
        if (formalScore > casualScore) {
            return 'Formal';
        }
        if (casualScore > 0) {
            return 'Casual';
        }
        
        return 'Neutral';
    }

    /**
     * Infer audience level from content complexity
     */
    private inferAudienceLevel(content: string): SmartContext['audienceLevel'] {
        const lowerContent = content.toLowerCase();
        
        // Expert level indicators
        const expertTerms = ['methodology', 'paradigm', 'architecture', 'implementation', 'optimization'];
        const expertScore = expertTerms.reduce((score, term) => 
            score + (lowerContent.includes(term) ? 1 : 0), 0);

        // Beginner level indicators
        const beginnerTerms = ['introduction', 'basics', 'getting started', 'simple', 'easy'];
        const beginnerScore = beginnerTerms.reduce((score, term) => 
            score + (lowerContent.includes(term) ? 1 : 0), 0);

        // Intermediate indicators
        const intermediateTerms = ['advanced', 'detailed', 'comprehensive', 'in-depth'];
        const intermediateScore = intermediateTerms.reduce((score, term) => 
            score + (lowerContent.includes(term) ? 1 : 0), 0);

        if (expertScore >= 2) return 'expert';
        if (beginnerScore >= 2) return 'beginner';
        if (intermediateScore >= 1) return 'intermediate';
        
        return 'general';
    }

    /**
     * Resolve a single variable using smart context
     */
    resolveVariable(
        variable: TemplateVariable,
        context: SmartContext
    ): string {
        switch (variable.resolver) {
            case 'selection':
                return context.selection || this.getSmartSelection(context) || variable.defaultValue || '';
                
            case 'document':
                return context.document || variable.defaultValue || '';
                
            case 'cursor':
                return context.cursorContext || variable.defaultValue || '';
                
            case 'computed':
                return this.computeVariable(variable.name, context);
                
            case 'user_input':
            default:
                // For user input, we'll return a placeholder for now
                // Later this will trigger input modals
                return variable.defaultValue || `[${variable.name}]`;
        }
    }

    /**
     * Get smart selection - if no selection, intelligently choose relevant text
     */
    private getSmartSelection(context: SmartContext): string {
        if (context.selection) {
            return context.selection;
        }

        // If no selection, use cursor context (current paragraph)
        return context.cursorContext;
    }

    /**
     * Compute special variables
     */
    private computeVariable(variableName: string, context: SmartContext): string {
        switch (variableName) {
            case 'title':
                return context.title;
                
            case 'document_type':
                return context.documentType;
                
            case 'metrics':
                return `Word count: ${context.metrics.wordCount}, Reading level: ${context.metrics.readingLevel}, Tone: ${context.metrics.tone}`;
                
            case 'audience_level':
                return context.audienceLevel;
                
            case 'word_count':
                return context.metrics.wordCount.toString();
                
            case 'reading_level':
                return context.metrics.readingLevel;
                
            case 'tone':
                return context.metrics.tone;
                
            case 'text':
                // Smart text selection - prefer selection, fallback to cursor context
                return context.selection || context.cursorContext;
                
            default:
                this.logger.warn(`Unknown computed variable: ${variableName}`);
                return '';
        }
    }

    /**
     * Resolve all variables for a command template
     */
    resolveAllVariables(
        variables: TemplateVariable[],
        context: SmartContext
    ): Record<string, string> {
        const resolved: Record<string, string> = {};

        for (const variable of variables) {
            try {
                const value = this.resolveVariable(variable, context);
                resolved[variable.name] = value;
                
                this.logger.debug(`Resolved variable ${variable.name}:`, {
                    resolver: variable.resolver,
                    valueLength: value.length
                });
                
            } catch (error) {
                this.logger.error(`Failed to resolve variable ${variable.name}:`, error);
                resolved[variable.name] = variable.defaultValue || '';
            }
        }

        return resolved;
    }

    /**
     * Validate that all required variables have been resolved
     */
    validateResolvedVariables(
        variables: TemplateVariable[], 
        resolved: Record<string, string>
    ): { isValid: boolean; missingRequired: string[] } {
        const missingRequired: string[] = [];

        for (const variable of variables) {
            if (variable.required) {
                const value = resolved[variable.name];
                if (!value || value.trim() === '' || value.startsWith('[')) {
                    missingRequired.push(variable.name);
                }
            }
        }

        return {
            isValid: missingRequired.length === 0,
            missingRequired
        };
    }

    /**
     * Get variable suggestions based on context
     */
    getVariableSuggestions(context: SmartContext): Record<string, string> {
        return {
            selection: context.selection ? `"${context.selection.substring(0, 50)}..."` : 'No text selected',
            document_type: `Detected as ${context.documentType}`,
            audience_level: `Writing for ${context.audienceLevel} audience`,
            word_count: `${context.metrics.wordCount} words`,
            tone: `Current tone: ${context.metrics.tone}`,
            reading_level: `${context.metrics.readingLevel} level`
        };
    }
}