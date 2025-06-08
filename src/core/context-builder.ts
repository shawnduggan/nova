/**
 * Context builder for Nova
 * Generates appropriate prompts for different command types
 */

import { EditCommand, DocumentContext, DocumentSection, PromptConfig, ConversationMessage } from './types';

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
        const basePrompt = `You are Nova, an AI writing partner that helps users edit documents directly. You work with Markdown documents in Obsidian.

IMPORTANT GUIDELINES:
- Provide ONLY the content to be inserted/modified, no explanations or meta-text
- Maintain the document's existing style and tone unless specifically asked to change it
- Preserve formatting, structure, and markdown syntax
- Be concise and focused on the specific request
- Do not add section headers unless specifically requested`;

        const actionSpecificPrompts = {
            add: `
TASK: Add new content to the document.
- Create well-structured, relevant content that fits the document's purpose
- Use appropriate markdown formatting (headings, lists, emphasis)
- Ensure smooth flow with existing content
- Match the document's style and tone`,

            edit: `
TASK: Edit and improve existing content.
- Enhance clarity, readability, and flow
- Preserve the original meaning unless changes are requested
- Improve word choice and sentence structure
- Maintain the original formatting and structure`,

            delete: `
TASK: Remove specified content from the document.
- Identify the exact content to be removed
- Ensure remaining content flows naturally
- Preserve document structure and formatting
- Confirm the deletion is appropriate for the context`,

            grammar: `
TASK: Fix grammar, spelling, and language issues.
- Correct spelling errors, grammar mistakes, and typos
- Improve sentence structure and clarity
- Maintain the original voice and style
- Preserve all formatting and markdown syntax
- Make minimal changes - only fix actual errors`,

            rewrite: `
TASK: Rewrite or restructure content.
- Create new content that serves the same purpose
- Improve organization, clarity, and flow
- Use more effective language and structure
- Maintain key information and concepts
- Adapt to any specified style requirements`
        };

        return basePrompt + actionSpecificPrompts[action];
    }

    /**
     * Build user prompt with specific instructions
     */
    private buildUserPrompt(command: EditCommand, contextInfo: string): string {
        let prompt = `${contextInfo}\n\nUSER REQUEST: ${command.instruction}`;

        // Add specific context if provided
        if (command.context && command.context.trim()) {
            prompt += `\n\nADDITIONAL REQUIREMENTS: ${command.context}`;
        }

        // Add target-specific instructions
        const targetInstructions = this.getTargetInstructions(command);
        if (targetInstructions) {
            prompt += `\n\n${targetInstructions}`;
        }

        // Add action-specific instructions
        const actionInstructions = this.getActionInstructions(command);
        if (actionInstructions) {
            prompt += `\n\n${actionInstructions}`;
        }

        return prompt;
    }

    /**
     * Get target-specific instructions
     */
    private getTargetInstructions(command: EditCommand): string {
        switch (command.target) {
            case 'selection':
                return 'FOCUS: Work with the selected text only. Provide the improved version of the selected content.';
            
            case 'section':
                if (command.location) {
                    return `FOCUS: Work with the "${command.location}" section. ${command.action === 'add' ? 'Add content to this section.' : 'Modify only this section.'}`;
                }
                return 'FOCUS: Work with the current section.';
            
            case 'document':
                return 'FOCUS: Apply changes to the entire document while preserving its structure.';
            
            case 'end':
                return 'FOCUS: Add content at the end of the document. Ensure it flows naturally from existing content.';
            
            case 'paragraph':
                return 'FOCUS: Work with the current paragraph or create a new paragraph.';
            
            default:
                return '';
        }
    }

    /**
     * Get action-specific instructions
     */
    private getActionInstructions(command: EditCommand): string {
        switch (command.action) {
            case 'add':
                return 'OUTPUT: Provide only the new content to be added. Include appropriate headings if adding a section.';
            
            case 'edit':
                return 'OUTPUT: Provide only the improved version of the content.';
            
            case 'delete':
                return 'OUTPUT: Confirm what should be deleted by providing the exact text to remove, or respond "CONFIRMED" if the deletion is clear.';
            
            case 'grammar':
                return 'OUTPUT: Provide only the corrected text with grammar and spelling fixes.';
            
            case 'rewrite':
                return 'OUTPUT: Provide the completely rewritten content that serves the same purpose.';
            
            default:
                return '';
        }
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

        // Add conversation context if available and requested
        if (config.includeHistory && conversationContext && conversationContext.trim()) {
            context += `\n${conversationContext}\n`;
        }

        // Add document structure if requested
        if (config.includeStructure && documentContext.headings.length > 0) {
            context += '\nDOCUMENT STRUCTURE:\n';
            documentContext.headings.forEach(heading => {
                const indent = '  '.repeat(heading.level - 1);
                context += `${indent}- ${heading.text}\n`;
            });
        }

        // Add selected text if available
        if (documentContext.selectedText && command.target === 'selection') {
            context += `\nSELECTED TEXT:\n${documentContext.selectedText}\n`;
        }

        // Add relevant context based on target
        if (command.target === 'section' && command.location) {
            const section = this.findSectionInContent(documentContext.content, command.location);
            if (section) {
                context += `\nCURRENT SECTION "${command.location}":\n${section}\n`;
            }
        } else if (command.target === 'paragraph' && documentContext.surroundingLines) {
            context += '\nCURRENT CONTEXT:\n';
            if (documentContext.surroundingLines.before.length > 0) {
                context += `Before: ${documentContext.surroundingLines.before.join(' ')}\n`;
            }
            if (documentContext.surroundingLines.after.length > 0) {
                context += `After: ${documentContext.surroundingLines.after.join(' ')}\n`;
            }
        }

        // Add limited document content for context
        const contentLines = documentContext.content.split('\n');
        if (contentLines.length > config.maxContextLines) {
            const start = Math.max(0, contentLines.length - config.maxContextLines);
            context += `\nRECENT CONTENT (last ${config.maxContextLines} lines):\n`;
            context += contentLines.slice(start).join('\n');
        } else {
            context += `\nFULL DOCUMENT:\n${documentContext.content}`;
        }

        return context;
    }

    /**
     * Find a specific section in content
     */
    private findSectionInContent(content: string, sectionName: string): string | null {
        const lines = content.split('\n');
        const normalizedSectionName = sectionName.toLowerCase().trim();
        
        let sectionStart = -1;
        let sectionLevel = 0;
        
        // Find the section heading
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
            
            if (headingMatch) {
                const level = headingMatch[1].length;
                const heading = headingMatch[2].toLowerCase().trim();
                
                if (heading === normalizedSectionName || heading.includes(normalizedSectionName)) {
                    sectionStart = i;
                    sectionLevel = level;
                    break;
                }
            }
        }
        
        if (sectionStart === -1) return null;
        
        // Find the end of the section
        let sectionEnd = lines.length;
        for (let i = sectionStart + 1; i < lines.length; i++) {
            const line = lines[i];
            const headingMatch = line.match(/^(#{1,6})\s+/);
            
            if (headingMatch && headingMatch[1].length <= sectionLevel) {
                sectionEnd = i;
                break;
            }
        }
        
        return lines.slice(sectionStart, sectionEnd).join('\n');
    }

    /**
     * Create a simple prompt for basic operations
     */
    buildSimplePrompt(instruction: string, context?: string): GeneratedPrompt {
        const systemPrompt = `You are Nova, an AI writing partner. Provide helpful, concise responses to user requests. Focus on being practical and actionable.`;
        
        let userPrompt = instruction;
        if (context) {
            userPrompt = `Context: ${context}\n\nRequest: ${instruction}`;
        }

        return {
            systemPrompt,
            userPrompt,
            context: context || '',
            config: {
                temperature: 0.7,
                maxTokens: 500
            }
        };
    }

    /**
     * Build prompt for conversation context
     */
    buildConversationPrompt(
        message: string,
        documentContext?: DocumentContext,
        recentHistory: ConversationMessage[] = []
    ): GeneratedPrompt {
        let systemPrompt = `You are Nova, an AI writing partner that helps users with their documents. You can:
- Answer questions about writing and editing
- Provide suggestions for improvement
- Help plan document structure
- Assist with research and content development

Be helpful, concise, and practical in your responses.`;

        let userPrompt = message;
        let context = '';

        // Add document context if available
        if (documentContext) {
            context += `Current document: ${documentContext.filename}\n`;
            
            if (documentContext.headings.length > 0) {
                context += 'Document structure:\n';
                documentContext.headings.forEach(heading => {
                    const indent = '  '.repeat(heading.level - 1);
                    context += `${indent}- ${heading.text}\n`;
                });
            }
        }

        // Add recent conversation history
        if (recentHistory.length > 0) {
            context += '\nRecent conversation:\n';
            recentHistory.slice(-3).forEach(msg => {
                if (msg.role === 'user') {
                    context += `You: ${msg.content}\n`;
                } else if (msg.role === 'assistant') {
                    context += `Nova: ${msg.content}\n`;
                }
            });
        }

        if (context) {
            userPrompt = `${context}\n\nCurrent message: ${message}`;
        }

        return {
            systemPrompt,
            userPrompt,
            context,
            config: {
                temperature: 0.8,
                maxTokens: 800
            }
        };
    }

    /**
     * Estimate token count for a prompt
     */
    estimateTokenCount(prompt: GeneratedPrompt): number {
        // Rough estimation: ~4 characters per token
        const totalText = prompt.systemPrompt + prompt.userPrompt + prompt.context;
        return Math.ceil(totalText.length / 4);
    }

    /**
     * Validate prompt generation
     */
    validatePrompt(prompt: GeneratedPrompt): { valid: boolean; issues: string[] } {
        const issues: string[] = [];

        if (!prompt.systemPrompt || prompt.systemPrompt.trim().length === 0) {
            issues.push('System prompt is empty');
        }

        if (!prompt.userPrompt || prompt.userPrompt.trim().length === 0) {
            issues.push('User prompt is empty');
        }

        const tokenCount = this.estimateTokenCount(prompt);
        if (tokenCount > 8000) {
            issues.push(`Prompt is too long (${tokenCount} tokens, max 8000)`);
        }

        if (prompt.config.temperature < 0 || prompt.config.temperature > 1) {
            issues.push('Temperature must be between 0 and 1');
        }

        if (prompt.config.maxTokens < 10 || prompt.config.maxTokens > 4000) {
            issues.push('Max tokens must be between 10 and 4000');
        }

        return {
            valid: issues.length === 0,
            issues
        };
    }
}