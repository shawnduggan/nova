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
- Do not add section headers unless specifically requested

CRITICAL POSITIONING RULES:
- When a specific location is mentioned (section, header, heading), ALWAYS target that location, NOT the cursor position
- Understand spatial relationships: "after [section]" means after the section's content, "before [header]" means before the header line
- "Under [heading]" means immediately after the heading line
- Location references OVERRIDE cursor position - ignore where the cursor is when location is specified
- Only use cursor position when NO specific location is mentioned`;

        const actionSpecificPrompts = {
            add: `
TASK: Add new content to the document.
- Create well-structured, relevant content that fits the document's purpose
- Use appropriate markdown formatting (headings, lists, emphasis)
- Ensure smooth flow with existing content
- Match the document's style and tone

POSITIONING FOR ADD:
- If a section/header is specified, add content WITHIN that section (not at cursor)
- "Add after [section]" = add at the end of that section's content
- "Add under [heading]" = add immediately after the heading line
- "Add before [section]" = add just before the section header
- Pay attention to section boundaries and respect document structure`,

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
- Adapt to any specified style requirements`,

            metadata: `
TASK: Update document metadata/properties.
- Modify, add, or remove frontmatter properties
- Handle tags, titles, dates, and custom properties
- Maintain proper YAML formatting
- Preserve existing properties unless specifically changing them
- Provide ONLY the property updates in JSON format`
        };

        return basePrompt + actionSpecificPrompts[action];
    }

    /**
     * Build user prompt with specific instructions
     */
    private buildUserPrompt(command: EditCommand, contextInfo: string): string {
        let prompt = `${contextInfo}\n\nUSER REQUEST: ${command.instruction}`;

        // Add explicit location override reminder
        if (command.target === 'section' && command.location) {
            prompt += `\n\n🎯 LOCATION OVERRIDE: You are working with the "${command.location}" section. IGNORE any cursor position or surrounding context - focus ONLY on the specified section.`;
        }

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
                    const actionGuidance = {
                        'add': 'Add content WITHIN this section, after the section header and before any subsections.',
                        'edit': 'Modify ONLY the content of this section, preserving the section header.',
                        'delete': 'Remove content from this section only.',
                        'rewrite': 'Rewrite the content of this section, keeping the section header.',
                        'grammar': 'Fix grammar and spelling in this section only.',
                        'metadata': 'Update metadata related to this section.'
                    };
                    return `FOCUS: Target the "${command.location}" section specifically. ${actionGuidance[command.action] || 'Modify only this section.'} IGNORE cursor position - work with the named section.`;
                }
                return 'FOCUS: Work with the current section around the cursor.';
            
            case 'document':
                return 'FOCUS: Apply changes to the entire document while preserving its structure.';
            
            case 'end':
                return 'FOCUS: Add content at the very end of the document, after all existing content. Ensure it flows naturally.';
            
            case 'paragraph':
                return 'FOCUS: Work with the current paragraph where the cursor is located, or create a new paragraph.';
            
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
            
            case 'metadata':
                return 'OUTPUT: Provide ONLY a JSON object with the property updates. Example: {"title": "New Title", "tags": ["tag1", "tag2"], "date": "2025-01-01"}';
            
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
                context += `\n=== TARGET SECTION "${command.location}" ===\n${section}\n=== END TARGET SECTION ===\n`;
                context += `\nIMPORTANT: Work with the TARGET SECTION above, NOT the cursor position. The section "${command.location}" is your focus area.\n`;
            } else {
                context += `\nTARGET SECTION "${command.location}" NOT FOUND.\n\nAvailable sections with hierarchical paths:\n`;
                documentContext.headings.forEach((heading, index) => {
                    const path = this.buildSectionPath(documentContext.headings, index);
                    context += `- ${path}\n`;
                });
                context += `\nTip: Use hierarchical paths like "Methods::Data Collection" to target specific nested sections.\n`;
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
     * Build hierarchical path for a heading
     */
    private buildSectionPath(headings: any[], targetIndex: number): string {
        const target = headings[targetIndex];
        const path: string[] = [target.text];
        
        // Walk backwards to find parent headings
        for (let i = targetIndex - 1; i >= 0; i--) {
            const heading = headings[i];
            if (heading.level < target.level) {
                path.unshift(heading.text);
                // Only include immediate parent for now (single level up)
                break;
            }
        }
        
        return path.join('::');
    }

    /**
     * Find a specific section in content
     */
    private findSectionInContent(content: string, sectionName: string): string | null {
        const lines = content.split('\n');
        const normalizedSectionName = sectionName.toLowerCase().trim();
        
        // Extract headings like in DocumentEngine
        const headings: any[] = [];
        lines.forEach((line, index) => {
            const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
            if (headingMatch) {
                headings.push({
                    text: headingMatch[2],
                    level: headingMatch[1].length,
                    line: index
                });
            }
        });
        
        // Check if this is a hierarchical path (contains ::)
        if (normalizedSectionName.includes('::')) {
            // Find headings that match the hierarchical path
            for (let i = 0; i < headings.length; i++) {
                const sectionPath = this.buildSectionPath(headings, i);
                
                if (sectionPath.toLowerCase() === normalizedSectionName) {
                    return this.extractSectionContent(lines, headings, i);
                }
            }
            return null;
        } else {
            // Simple section name - find first match (backwards compatible)
            const headingIndex = headings.findIndex(h => 
                h.text.toLowerCase().includes(normalizedSectionName)
            );

            if (headingIndex === -1) return null;

            return this.extractSectionContent(lines, headings, headingIndex);
        }
    }

    /**
     * Extract section content from lines and heading info
     */
    private extractSectionContent(lines: string[], headings: any[], headingIndex: number): string {
        const heading = headings[headingIndex];
        const nextHeading = headings[headingIndex + 1];
        const sectionEnd = nextHeading ? nextHeading.line : lines.length;
        
        return lines.slice(heading.line, sectionEnd).join('\n');
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
- Directly modify documents when users request specific actions (like adding content, editing sections, etc.)

IMPORTANT: When users request document actions (e.g., "add a paragraph about X", "append lorem ipsum after heading Y", "insert bullet points"), you should provide the actual content to be added/modified, not just explain what should be done.

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