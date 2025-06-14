/**
 * Context builder for Nova
 * Generates appropriate prompts for cursor-only editing
 */

import { EditCommand, DocumentContext, PromptConfig } from './types';

/**
 * Generated prompt for AI completion
 */
export interface GeneratedPrompt {
    /** System prompt for AI context */
    systemPrompt: string;
    
    /** User prompt with specific instructions */
    userPrompt: string;
    
    /** Additional context for the AI */
    context: string;
    
    /** Configuration for AI generation */
    config: {
        temperature: number;
        maxTokens: number;
    };
}

/**
 * Context builder for generating AI prompts
 */
export class ContextBuilder {
    private defaultConfig: PromptConfig = {
        maxContextLines: 20,
        includeStructure: true,
        includeHistory: false,
        temperature: 0.7,
        maxTokens: 1000
    };

    /**
     * Build prompt for a specific command
     */
    buildPrompt(
        command: EditCommand,
        documentContext: DocumentContext,
        options: Partial<PromptConfig> = {},
        conversationContext?: string
    ): GeneratedPrompt {
        const config = { ...this.defaultConfig, ...options };
        
        const systemPrompt = this.buildSystemPrompt(command.action, config);
        const contextInfo = this.buildContextInfo(documentContext, command, config, conversationContext);
        const userPrompt = this.buildUserPrompt(command, contextInfo);
        
        return {
            systemPrompt,
            userPrompt,
            context: contextInfo,
            config: {
                temperature: config.temperature || 0.7,
                maxTokens: config.maxTokens || 1000
            }
        };
    }

    /**
     * Build system prompt based on action type
     */
    private buildSystemPrompt(action: EditCommand['action'], config: PromptConfig): string {
        const basePrompt = `You are Nova, an AI writing partner that helps users edit documents at their cursor position. You work with Markdown documents in Obsidian.

IMPORTANT GUIDELINES:
- Provide ONLY the content to be inserted/modified, no explanations or meta-text
- Maintain the document's existing style and tone unless specifically asked to change it
- Preserve formatting, structure, and markdown syntax
- Work at the user's cursor position - every edit happens where they are focused
- Do not add headers unless specifically requested
- Focus on the user's immediate editing context`;

        const actionSpecificPrompts = {
            'add': `

ACTION: ADD CONTENT
- Generate new content to insert at the specified location
- Match the style and tone of surrounding content
- Ensure proper formatting and structure`,

            'edit': `

ACTION: EDIT CONTENT  
- Improve, modify, or enhance the specified content
- Preserve the original intent while following user instructions
- Apply style, tone, or structural changes as requested`,

            'delete': `

ACTION: DELETE CONTENT
- Confirm what should be deleted by providing the exact text to remove
- Be precise about deletion boundaries
- Respond "CONFIRMED" if the deletion is clear`,

            'grammar': `

ACTION: GRAMMAR & SPELLING
- Fix grammar, spelling, and punctuation errors
- Improve clarity while preserving meaning
- Maintain the original tone and style`,

            'rewrite': `

ACTION: REWRITE CONTENT
- Generate alternative content that serves the same purpose
- Apply requested style, tone, or structural changes
- Create fresh content while maintaining core meaning`,

            'metadata': `

ACTION: UPDATE METADATA
- Modify frontmatter properties, tags, or document metadata
- Follow YAML formatting conventions
- Update only the specified metadata fields`
        };

        return basePrompt + (actionSpecificPrompts[action] || '');
    }

    /**
     * Build context information for the prompt
     */
    private buildContextInfo(
        documentContext: DocumentContext,
        command: EditCommand,
        config: PromptConfig,
        conversationContext?: string
    ): string {
        let context = `DOCUMENT: ${documentContext.filename}\n`;

        // Add document structure if enabled
        if (config.includeStructure && documentContext.headings.length > 0) {
            context += `DOCUMENT STRUCTURE:\n`;
            const structure = this.buildDocumentStructure(documentContext.headings);
            context += structure + '\n';
        }

        // Add cursor context based on target
        context += this.buildTargetContext(command, documentContext);

        // Add conversation context if available
        if (conversationContext && config.includeHistory) {
            context += `\nCONVERSATION CONTEXT:\n${conversationContext}\n`;
        }

        // Add full document content
        context += `\nFULL DOCUMENT:\n${documentContext.content}\n`;

        return context;
    }

    /**
     * Build target-specific context
     */
    private buildTargetContext(command: EditCommand, documentContext: DocumentContext): string {
        switch (command.target) {
            case 'selection':
                if (documentContext.selectedText) {
                    return `\nSELECTED TEXT:\n${documentContext.selectedText}\n`;
                }
                return `\nNo text currently selected.\n`;

            case 'cursor':
                if (documentContext.surroundingLines) {
                    const context = `\nCURSOR CONTEXT:\n`;
                    const before = documentContext.surroundingLines.before.join('\n');
                    const after = documentContext.surroundingLines.after.join('\n');
                    return context + `Before cursor:\n${before}\n\nAfter cursor:\n${after}\n`;
                }
                return `\nCursor position context not available.\n`;

            case 'document':
                return `\nTargeting entire document.\n`;

            case 'end':
                return `\nTargeting end of document.\n`;

            default:
                return `\nWorking at cursor position.\n`;
        }
    }

    /**
     * Build user prompt with instructions
     */
    private buildUserPrompt(command: EditCommand, contextInfo: string): string {
        let prompt = contextInfo;
        
        prompt += `\nUSER REQUEST: ${command.instruction}\n`;

        // Add context from command if available
        if (command.context) {
            prompt += `ADDITIONAL REQUIREMENTS: ${command.context}\n`;
        }

        // Add target-specific focus
        prompt += this.getFocusInstructions(command);

        // Add output instructions based on action
        prompt += this.getOutputInstructions(command);

        return prompt;
    }

    /**
     * Get focus instructions based on target
     */
    private getFocusInstructions(command: EditCommand): string {
        const actionGuidance = {
            'add': 'Add new content',
            'edit': 'Modify existing content', 
            'delete': 'Remove specified content',
            'rewrite': 'Generate alternative content',
            'grammar': 'Fix grammar and spelling',
            'metadata': 'Update document metadata'
        };

        switch (command.target) {
            case 'selection':
                return `\nFOCUS: ${actionGuidance[command.action]} in the selected text.\n`;

            case 'cursor':
                return `\nFOCUS: ${actionGuidance[command.action]} at the current cursor position.\n`;

            case 'document':
                return `\nFOCUS: ${actionGuidance[command.action]} for the entire document.\n`;

            case 'end':
                return `\nFOCUS: Add content at the very end of the document, after all existing content. Ensure it flows naturally.\n`;

            default:
                return `\nFOCUS: ${actionGuidance[command.action]} at the cursor position.\n`;
        }
    }

    /**
     * Get output instructions based on action
     */
    private getOutputInstructions(command: EditCommand): string {
        switch (command.action) {
            case 'add':
                return 'OUTPUT: Provide only the new content to be added.';

            case 'edit':
                return 'OUTPUT: Provide only the improved version of the content.';

            case 'delete':
                return 'OUTPUT: Confirm what should be deleted by providing the exact text to remove, or respond "CONFIRMED" if the deletion is clear.';

            case 'grammar':
                return 'OUTPUT: Provide the corrected version with proper grammar and spelling.';

            case 'rewrite':
                return 'OUTPUT: Provide the completely rewritten content that serves the same purpose.';

            case 'metadata':
                return 'OUTPUT: Provide the updated metadata in proper YAML format.';

            default:
                return 'OUTPUT: Provide only the requested content changes.';
        }
    }

    /**
     * Build document structure from headings
     */
    private buildDocumentStructure(headings: DocumentContext['headings']): string {
        return headings.map(heading => {
            const indent = '  '.repeat(heading.level - 1);
            return `${indent}- ${heading.text}`;
        }).join('\n');
    }

    /**
     * Validate generated prompt
     */
    validatePrompt(prompt: GeneratedPrompt): { valid: boolean; issues: string[] } {
        const issues: string[] = [];

        if (!prompt.systemPrompt || prompt.systemPrompt.trim().length === 0) {
            issues.push('System prompt is empty');
        }

        if (!prompt.userPrompt || prompt.userPrompt.trim().length === 0) {
            issues.push('User prompt is empty');
        }

        if (prompt.userPrompt.length > 10000) {
            issues.push('User prompt is too long (>10000 characters)');
        }

        return {
            valid: issues.length === 0,
            issues
        };
    }
}