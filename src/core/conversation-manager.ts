/**
 * Conversation Manager for Nova
 * Handles file-scoped conversation storage and retrieval
 */

import { TFile } from 'obsidian';
import { ConversationData, ConversationMessage, EditCommand, EditResult, EditAction } from './types';

export interface DataStore {
    loadData(key: string): Promise<any>;
    saveData(key: string, data: any): Promise<void>;
}

export class ConversationManager {
    private conversations: Map<string, ConversationData> = new Map();
    private maxMessagesPerFile = 100; // Limit conversation history
    private storageKey = 'nova-conversations';
    private cleanupInterval: number | null = null;

    constructor(private dataStore: DataStore) {
        this.loadConversations();
        this.startPeriodicCleanup();
    }

    /**
     * Load conversations from plugin data
     */
    private async loadConversations(): Promise<void> {
        try {
            const data = await this.dataStore.loadData(this.storageKey);
            if (data && Array.isArray(data)) {
                for (const conversation of data) {
                    this.conversations.set(conversation.filePath, conversation);
                }
            }
        } catch (error) {
            // Failed to load conversation data - graceful fallback
        }
    }

    /**
     * Save conversations to plugin data
     */
    private async saveConversations(): Promise<void> {
        try {
            const conversationsArray = Array.from(this.conversations.values());
            await this.dataStore.saveData(this.storageKey, conversationsArray);
        } catch (error) {
            // Failed to save conversation data - graceful fallback
        }
    }

    /**
     * Get conversation for a specific file
     */
    getConversation(file: TFile): ConversationData {
        const filePath = file.path;
        
        if (!this.conversations.has(filePath)) {
            // Create new conversation for this file
            const newConversation: ConversationData = {
                filePath,
                messages: [],
                lastUpdated: Date.now(),
                metadata: {
                    editCount: 0,
                    commandFrequency: {
                        add: 0,
                        edit: 0,
                        delete: 0,
                        grammar: 0,
                        rewrite: 0,
                        metadata: 0
                    }
                }
            };
            this.conversations.set(filePath, newConversation);
        }

        return this.conversations.get(filePath)!;
    }

    /**
     * Add a user message to the conversation
     */
    async addUserMessage(
        file: TFile, 
        content: string, 
        command?: EditCommand
    ): Promise<ConversationMessage> {
        
        const conversation = this.getConversation(file);
        
        const message: ConversationMessage = {
            id: this.generateMessageId(),
            role: 'user',
            content,
            timestamp: Date.now(),
            command
        };

        conversation.messages.push(message);
        conversation.lastUpdated = Date.now();

        // Update command frequency if command provided
        if (command && conversation.metadata) {
            conversation.metadata.commandFrequency[command.action]++;
        }

        await this.trimAndSave(conversation);
        return message;
    }

    /**
     * Add an assistant response to the conversation
     */
    async addAssistantMessage(
        file: TFile,
        content: string,
        result?: EditResult
    ): Promise<ConversationMessage> {
        const conversation = this.getConversation(file);
        
        const message: ConversationMessage = {
            id: this.generateMessageId(),
            role: 'assistant',
            content,
            timestamp: Date.now(),
            result
        };

        conversation.messages.push(message);
        conversation.lastUpdated = Date.now();

        // Increment edit count if result indicates successful edit
        if (result?.success && conversation.metadata) {
            conversation.metadata.editCount++;
        }

        await this.trimAndSave(conversation);
        return message;
    }

    /**
     * Add a system message to the conversation
     */
    async addSystemMessage(
        file: TFile, 
        content: string, 
        metadata?: { messageType?: string; source?: 'chat' | 'selection' | 'command' }
    ): Promise<ConversationMessage> {
        
        const conversation = this.getConversation(file);
        
        const message: ConversationMessage = {
            id: this.generateMessageId(),
            role: 'system',
            content,
            timestamp: Date.now(),
            metadata
        };

        conversation.messages.push(message);
        conversation.lastUpdated = Date.now();

        await this.trimAndSave(conversation);
        return message;
    }

    /**
     * Get recent messages for context
     */
    getRecentMessages(file: TFile, count: number = 10): ConversationMessage[] {
        const conversation = this.getConversation(file);
        return conversation.messages.slice(-count);
    }

    /**
     * Get messages by role
     */
    getMessagesByRole(file: TFile, role: ConversationMessage['role']): ConversationMessage[] {
        const conversation = this.getConversation(file);
        return conversation.messages.filter(msg => msg.role === role);
    }

    /**
     * Get conversation context for AI prompts
     */
    getConversationContext(file: TFile, maxMessages: number = 6): string {
        const messages = this.getRecentMessages(file, maxMessages);
        
        if (messages.length === 0) {
            return '';
        }

        const contextLines = messages.map(msg => {
            const timestamp = new Date(msg.timestamp).toLocaleTimeString();
            let line = `[${timestamp}] ${msg.role.toUpperCase()}: ${msg.content}`;
            
            if (msg.command) {
                line += ` (Command: ${msg.command.action} ${msg.command.target})`;
            }
            
            if (msg.result) {
                line += ` (Result: ${msg.result.success ? 'success' : 'failed'})`;
            }
            
            return line;
        });

        return `Previous conversation:\n${contextLines.join('\n')}\n`;
    }

    /**
     * Clear conversation for a file
     */
    async clearConversation(file: TFile): Promise<void> {
        const conversation = this.getConversation(file);
        conversation.messages = [];
        conversation.lastUpdated = Date.now();
        
        if (conversation.metadata) {
            conversation.metadata.editCount = 0;
            conversation.metadata.commandFrequency = {
                add: 0,
                edit: 0,
                delete: 0,
                grammar: 0,
                rewrite: 0,
                metadata: 0
            };
        }

        await this.saveConversations();
    }

    /**
     * Get conversation statistics
     */
    getStats(file: TFile): {
        messageCount: number;
        editCount: number;
        mostUsedCommand: EditAction | null;
        conversationAge: number;
    } {
        const conversation = this.getConversation(file);
        
        let mostUsedCommand: EditAction | null = null;
        let maxCount = 0;
        
        if (conversation.metadata) {
            for (const [action, count] of Object.entries(conversation.metadata.commandFrequency)) {
                if (count > maxCount) {
                    maxCount = count;
                    mostUsedCommand = action as EditAction;
                }
            }
        }

        const conversationAge = conversation.messages.length > 0 
            ? Date.now() - conversation.messages[0].timestamp
            : 0;

        return {
            messageCount: conversation.messages.length,
            editCount: conversation.metadata?.editCount || 0,
            mostUsedCommand,
            conversationAge
        };
    }


    /**
     * Export conversation for a file
     */
    exportConversation(file: TFile): string {
        const conversation = this.getConversation(file);
        const lines = [`# Conversation History for ${file.name}`, ''];

        for (const message of conversation.messages) {
            const timestamp = new Date(message.timestamp).toLocaleString();
            lines.push(`## ${message.role.toUpperCase()} (${timestamp})`);
            lines.push(message.content);
            
            if (message.command) {
                lines.push(`*Command: ${message.command.action} ${message.command.target}*`);
            }
            
            if (message.result) {
                lines.push(`*Result: ${message.result.success ? 'Success' : 'Failed'}*`);
                if (message.result.error) {
                    lines.push(`*Error: ${message.result.error}*`);
                }
            }
            
            lines.push('');
        }

        return lines.join('\n');
    }

    /**
     * Generate unique message ID
     */
    private generateMessageId(): string {
        return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Trim conversation to max length and save
     */
    private async trimAndSave(conversation: ConversationData): Promise<void> {
        if (conversation.messages.length > this.maxMessagesPerFile) {
            // Keep the most recent messages
            conversation.messages = conversation.messages.slice(-this.maxMessagesPerFile);
        }
        
        await this.saveConversations();
    }

    /**
     * Get all conversation file paths
     */
    getAllConversationFiles(): string[] {
        return Array.from(this.conversations.keys());
    }

    /**
     * Check if file has active conversation
     */
    hasConversation(file: TFile): boolean {
        const conversation = this.conversations.get(file.path);
        return conversation ? conversation.messages.length > 0 : false;
    }

    /**
     * Update conversation file path (for file renames)
     */
    async updateFilePath(oldPath: string, newPath: string): Promise<void> {
        const conversation = this.conversations.get(oldPath);
        if (conversation) {
            conversation.filePath = newPath;
            this.conversations.delete(oldPath);
            this.conversations.set(newPath, conversation);
            await this.saveConversations();
        }
    }

    /**
     * Start periodic cleanup of old conversations
     */
    private startPeriodicCleanup(): void {
        // Clean up every 24 hours
        this.cleanupInterval = window.setInterval(() => {
            this.cleanupOldConversations(7 * 24 * 60 * 60 * 1000); // 7 days
        }, 24 * 60 * 60 * 1000);
    }

    /**
     * Clean up conversations older than the specified age
     */
    private async cleanupOldConversations(maxAge: number): Promise<void> {
        const now = Date.now();
        let cleaned = false;

        for (const [filePath, conversation] of this.conversations.entries()) {
            // Check if conversation is old based on last message
            if (conversation.messages.length > 0) {
                const lastMessage = conversation.messages[conversation.messages.length - 1];
                const age = now - lastMessage.timestamp;
                
                if (age > maxAge) {
                    this.conversations.delete(filePath);
                    cleaned = true;
                }
            }
        }

        if (cleaned) {
            await this.saveConversations();
        }
    }

    /**
     * Cleanup method to call when plugin is disabled
     */
    cleanup(): void {
        if (this.cleanupInterval !== null) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }
}