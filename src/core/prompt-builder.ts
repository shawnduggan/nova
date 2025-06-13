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
        // Check for common command action words
        const commandWords = [
            'add', 'create', 'write', 'insert', 'include', 'generate',
            'edit', 'modify', 'change', 'update', 'revise', 'improve', 'enhance',
            'delete', 'remove', 'eliminate', 'cut', 'erase',
            'fix', 'correct', 'grammar', 'spell', 'proofread', 'polish',
            'rewrite', 'reword', 'rephrase', 'restructure', 'reorganize'
        ];
        
        const lowerMessage = message.toLowerCase();
        return commandWords.some(word => lowerMessage.includes(word));
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

        return this.contextBuilder.buildConversationPrompt(message, documentContext, recentHistory);
    }

    /**
     * Build simple prompt for basic operations
     */
    buildSimplePrompt(instruction: string, context?: string): GeneratedPrompt {
        return this.contextBuilder.buildSimplePrompt(instruction, context);
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
            const tokenCount = this.contextBuilder.estimateTokenCount(prompt);
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
        return this.contextBuilder.estimateTokenCount(prompt);
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
            location: undefined,
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