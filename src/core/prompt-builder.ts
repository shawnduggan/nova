/**
 * Prompt builder service for Nova
 * Integrates ContextBuilder with document engine and conversation history
 */

import { TFile } from 'obsidian';
import { ContextBuilder, GeneratedPrompt } from './context-builder';
import { DocumentEngine } from './document-engine';
import { ConversationManager } from './conversation-manager';
import { CommandParser } from './command-parser';
import { EditCommand, DocumentContext, PromptConfig, ConversationMessage } from './types';

/**
 * Prompt building service
 */
export class PromptBuilder {
    private contextBuilder: ContextBuilder;
    private documentEngine: DocumentEngine;
    private conversationManager: ConversationManager;
    private commandParser: CommandParser;

    constructor(
        documentEngine: DocumentEngine,
        conversationManager: ConversationManager
    ) {
        this.contextBuilder = new ContextBuilder();
        this.documentEngine = documentEngine;
        this.conversationManager = conversationManager;
        this.commandParser = new CommandParser();
    }

    /**
     * Build prompt for a user message - determines if it's a command or conversation
     */
    async buildPromptForMessage(
        message: string,
        file?: TFile,
        options: Partial<PromptConfig> = {}
    ): Promise<GeneratedPrompt> {
        // Check if this is likely a command based on action words
        const isLikelyCommand = this.isLikelyCommand(message);
        
        if (isLikelyCommand && file) {
            // Try to parse as command
            const parsedCommand = this.commandParser.parseCommand(message);
            return this.buildCommandPrompt(parsedCommand, file, options);
        } else {
            // It's a conversation - build conversation prompt
            return this.buildConversationPrompt(message, file, options);
        }
    }

    /**
     * Check if a message is likely a command vs conversation
     */
    private isLikelyCommand(message: string): boolean {
        const lowerMessage = message.toLowerCase().trim();
        
        // 1. Explicit command syntax (colon commands)
        if (lowerMessage.startsWith(':')) {
            return true;
        }
        
        // 2. Check for action verbs that indicate document modification commands
        const actionVerbs = [
            'add', 'insert', 'append', 'prepend', 'include', 'create', 'write', 'generate',
            'edit', 'modify', 'change', 'update', 'revise', 'improve', 'enhance', 'replace',
            'delete', 'remove', 'eliminate', 'cut', 'erase', 'drop',
            'fix', 'correct', 'proofread', 'polish', 'check',
            'rewrite', 'reword', 'rephrase', 'restructure', 'reorganize'
        ];
        
        // Check if message starts with an action verb (imperative command structure)
        const startsWithAction = actionVerbs.some(verb => {
            const verbPattern = new RegExp(`^${verb}\\b`, 'i');
            return verbPattern.test(lowerMessage);
        });
        
        if (startsWithAction) {
            // Additional filtering: exclude questions and discussions
            const questionIndicators = [
                /^(how|what|why|when|where|which|who|can|could|should|would|will|is|are|am|do|does|did)/i,
                /\?/,  // Contains question mark
                /\b(help|advice|suggest|recommend|think|opinion)\b/i
            ];
            
            // If it's a question or discussion, route to conversation
            const isQuestion = questionIndicators.some(pattern => pattern.test(lowerMessage));
            if (isQuestion) {
                return false;
            }
            
            return true;
        }
        
        // 3. Check for explicit command patterns (for edge cases)
        const explicitCommandPatterns = [
            // Grammar/spelling commands that don't start with action verbs
            /\b(grammar|spell|spelling|proofread|polish)\b.*\b(check|fix|correct)\b/i,
            
            // Metadata commands with different structures
            /\bset\s+(the\s+)?(title|tags|metadata|properties)/i,
            /\bupdate\s+(the\s+)?(title|tags|metadata|properties)/i,
            
            // Tag-specific patterns
            /^(add|set|update|remove)\s+tags?:/i,
            /\b(clean up|cleanup|optimize|improve|review|analyze)\s+.*\btags?\b/i,
            /\b(suggest|recommend)\s+.*\btags?\b/i,
            /^add suggested tags$/i
        ];
        
        // Check if message matches explicit command patterns
        for (const pattern of explicitCommandPatterns) {
            if (pattern.test(lowerMessage)) {
                return true;
            }
        }
        
        // 4. Everything else goes to conversation mode
        return false;
    }

    /**
     * Build prompt for a specific command
     */
    async buildCommandPrompt(
        command: EditCommand,
        file?: TFile,
        options: Partial<PromptConfig> = {}
    ): Promise<GeneratedPrompt> {
        if (!file) {
            throw new Error('File is required for command prompts');
        }

        // Get document context
        const documentContext = await this.getDocumentContext(file);
        
        // Get conversation context if needed
        let conversationContext: string | undefined;
        if (options.includeHistory) {
            const recentMessages = await this.conversationManager.getRecentMessages(file, 5);
            conversationContext = this.formatConversationHistory(recentMessages);
        }

        // Build the prompt
        return this.contextBuilder.buildPrompt(command, documentContext, options, conversationContext);
    }

    /**
     * Build prompt for conversation (non-command messages)
     */
    async buildConversationPrompt(
        message: string,
        file?: TFile,
        options: Partial<PromptConfig> = {}
    ): Promise<GeneratedPrompt> {
        let documentContext: DocumentContext | undefined;
        let recentHistory: ConversationMessage[] = [];

        // Get document context if file is provided
        if (file) {
            documentContext = await this.getDocumentContext(file);
            
            // Get recent conversation history
            recentHistory = await this.conversationManager.getRecentMessages(file, 5);
        }

        // Build conversation-style prompt (not command format)
        const systemPrompt = `You are Nova, an AI writing partner that helps users with their documents and writing tasks.

Key capabilities:
- Answer questions about documents and content
- Provide writing assistance and suggestions
- Help with research and analysis
- Engage in natural conversation about the user's work

Guidelines:
- Provide helpful, accurate responses
- Stay focused on the user's needs
- Be conversational but professional
- Reference document context when relevant`;

        let userPrompt = `USER REQUEST: ${message}`;
        
        // Add document context if available
        if (documentContext && file) {
            userPrompt = `Current document: ${documentContext.filename}

${userPrompt}`;
        }
        
        // Add conversation history if available
        if (recentHistory.length > 0) {
            const historyString = this.formatConversationHistory(recentHistory);
            userPrompt = `RECENT CONVERSATION:
${historyString}

${userPrompt}`;
        }

        return {
            systemPrompt,
            userPrompt,
            context: documentContext?.content || '',
            config: {
                temperature: options.temperature || 0.7,
                maxTokens: options.maxTokens || 2000
            }
        };
    }

    /**
     * Build simple prompt for basic operations
     */
    buildSimplePrompt(instruction: string, context?: string): GeneratedPrompt {
        const systemPrompt = `You are Nova, an AI writing partner that helps users with their documents and writing tasks.

Guidelines:
- Provide helpful, accurate responses
- Stay focused on the user's needs
- Be conversational but professional`;

        let userPrompt = `USER REQUEST: ${instruction}`;
        
        if (context) {
            userPrompt = `Context: ${context}

${userPrompt}`;
        }

        return {
            systemPrompt,
            userPrompt,
            context: context || '',
            config: {
                temperature: 0.7,
                maxTokens: 2000
            }
        };
    }

    /**
     * Get document context for a file
     */
    private async getDocumentContext(file: TFile): Promise<DocumentContext> {
        // Use the document engine's built-in context gathering
        const context = await this.documentEngine.getDocumentContext();
        
        if (!context) {
            // Fallback: create minimal context
            const content = await this.documentEngine.getDocumentContent() || '';
            return {
                file: file,
                filename: file.basename,
                content,
                headings: [],
                selectedText: undefined,
                surroundingLines: undefined
            };
        }

        // Return the context as-is, since it's already in the correct format
        return context;
    }

    /**
     * Format conversation history for context
     */
    private formatConversationHistory(messages: ConversationMessage[]): string {
        if (messages.length === 0) return '';

        let formatted = 'RECENT CONVERSATION:\n';
        messages.forEach(msg => {
            const role = msg.role === 'user' ? 'You' : 'Nova';
            formatted += `${role}: ${msg.content}\n`;
        });

        return formatted;
    }

    /**
     * Validate and optimize prompt before sending to AI
     */
    validateAndOptimizePrompt(prompt: GeneratedPrompt): GeneratedPrompt {
        const validation = this.contextBuilder.validatePrompt(prompt);
        
        if (!validation.valid) {
            // Prompt validation issues - graceful fallback
            
            // Try to fix common issues
            let optimizedPrompt = { ...prompt };
            
            // Truncate if too long
            const tokenCount = this.estimateTokenCount(prompt);
            if (tokenCount > 8000) {
                // Reduce context size more aggressively
                const maxContextLength = Math.floor(prompt.context.length * 0.6);
                optimizedPrompt.context = prompt.context.substring(0, maxContextLength) + '\n[Context truncated...]';
            }
            
            // Clamp temperature
            if (prompt.config.temperature < 0 || prompt.config.temperature > 1) {
                optimizedPrompt.config.temperature = Math.max(0, Math.min(1, prompt.config.temperature));
            }
            
            // Clamp max tokens
            if (prompt.config.maxTokens < 10 || prompt.config.maxTokens > 4000) {
                optimizedPrompt.config.maxTokens = Math.max(10, Math.min(4000, prompt.config.maxTokens));
            }
            
            return optimizedPrompt;
        }

        return prompt;
    }

    /**
     * Get token count estimate for a prompt
     */
    getTokenCount(prompt: GeneratedPrompt): number {
        return this.estimateTokenCount(prompt);
    }

    /**
     * Create prompt for a specific action with minimal context
     */
    async buildQuickPrompt(
        action: EditCommand['action'],
        instruction: string,
        file?: TFile
    ): Promise<GeneratedPrompt> {
        const command: EditCommand = {
            action,
            target: 'document',
            instruction,
            context: undefined
        };

        if (file) {
            return this.buildCommandPrompt(command, file, { 
                maxContextLines: 10,
                includeStructure: false,
                includeHistory: false 
            });
        } else {
            return this.buildSimplePrompt(instruction);
        }
    }

    /**
     * Simple token count estimation
     */
    private estimateTokenCount(prompt: GeneratedPrompt): number {
        // Rough estimation: ~4 characters per token
        const totalText = prompt.systemPrompt + prompt.userPrompt + prompt.context;
        return Math.ceil(totalText.length / 4);
    }

    /**
     * Build prompt with custom system prompt override
     */
    async buildCustomPrompt(
        systemPrompt: string,
        userMessage: string,
        file?: TFile
    ): Promise<GeneratedPrompt> {
        let context = '';
        
        if (file) {
            const documentContext = await this.getDocumentContext(file);
            context = `Document: ${documentContext.filename}\n${documentContext.content}`;
        }

        return {
            systemPrompt,
            userPrompt: userMessage,
            context,
            config: {
                temperature: 0.7,
                maxTokens: 1000
            }
        };
    }
}