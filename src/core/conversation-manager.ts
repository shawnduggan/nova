/**
 * Conversation Manager for Nova
 * Handles file-scoped conversation storage and retrieval
 */

import { TFile } from 'obsidian';
import { ConversationData, ConversationMessage, EditCommand, EditResult, EditAction, ContextDocumentRef } from './types';
import { Logger } from '../utils/logger';

export interface DataStore {
    loadData(key: string): Promise<any>;
    saveData(key: string, data: any): Promise<void>;
    registerInterval(intervalId: number): number;
}

export class ConversationManager {
    private conversations: Map<string, ConversationData> = new Map();
    private maxMessagesPerFile = 100; // Limit conversation history
    private storageKey = 'nova-conversations';
    private cleanupInterval: number | null = null;
    private initializePromise: Promise<void>;

    constructor(private dataStore: DataStore) {
        this.initializePromise = this.initialize();
    }

    private async initialize(): Promise<void> {
        await this.loadConversations();
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
                    try {
                        // Validate and sanitize conversation data
                        const sanitizedConversation = this.sanitizeConversationData(conversation);
                        this.conversations.set(sanitizedConversation.filePath, sanitizedConversation);
                    } catch (error) {
                        // Skip corrupted individual conversations
                        Logger.warn(`Skipped corrupted conversation for file: ${conversation?.filePath || 'unknown'}`, error);
                    }
                }
            }
        } catch (error) {
            // Failed to load conversation data - graceful fallback
            Logger.error('ConversationManager.loadConversations: Load failed:', error);
        }
    }

    /**
     * Sanitize and validate conversation data
     */
    private sanitizeConversationData(conversation: any): ConversationData {
        // Ensure required fields exist and are valid
        if (!conversation.filePath || typeof conversation.filePath !== 'string') {
            throw new Error('Invalid or missing filePath');
        }

        // Ensure messages array exists and is valid
        const messages = Array.isArray(conversation.messages) ? conversation.messages : [];

        // Ensure contextDocuments array exists and is valid
        let contextDocuments: ContextDocumentRef[] = [];
        if (Array.isArray(conversation.contextDocuments)) {
            contextDocuments = conversation.contextDocuments
                .filter((doc: any) => this.isValidContextDocument(doc))
                .map((doc: any) => this.sanitizeContextDocument(doc));
        }

        // Ensure basic structure
        return {
            filePath: conversation.filePath,
            messages,
            lastUpdated: typeof conversation.lastUpdated === 'number' ? conversation.lastUpdated : Date.now(),
            contextDocuments,
            metadata: conversation.metadata || {
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
    }

    /**
     * Validate context document structure
     */
    private isValidContextDocument(doc: any): boolean {
        return doc && 
               typeof doc.path === 'string' && 
               doc.path.trim().length > 0;
    }

    /**
     * Sanitize context document data
     */
    private sanitizeContextDocument(doc: any): ContextDocumentRef {
        return {
            path: doc.path,
            property: typeof doc.property === 'string' ? doc.property : undefined,
            addedAt: typeof doc.addedAt === 'number' ? doc.addedAt : Date.now()
        };
    }

    /**
     * Save conversations to plugin data
     */
    private async saveConversations(): Promise<void> {
        try {
            const conversationsArray = Array.from(this.conversations.values());
            await this.dataStore.saveData(this.storageKey, conversationsArray);
        } catch (error) {
            Logger.error('ConversationManager.saveConversations: Save failed:', error);
        }
    }

    /**
     * Get conversation for a specific file
     */
    getConversation(file: TFile): ConversationData {
        // Note: This method is synchronous and used by other methods that await initializePromise
        const filePath = file.path;
        
        if (!this.conversations.has(filePath)) {
            // Create new conversation for this file
            const newConversation: ConversationData = {
                filePath,
                messages: [],
                lastUpdated: Date.now(),
                contextDocuments: [],
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

        // Ensure backward compatibility - add contextDocuments if missing
        const conversation = this.conversations.get(filePath)!;
        if (!conversation.contextDocuments) {
            conversation.contextDocuments = [];
        }

        return conversation;
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
        // Do NOT clear contextDocuments - those are managed separately from the drawer
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
        return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
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
        this.cleanupInterval = this.dataStore.registerInterval(window.setInterval(() => {
            this.cleanupOldConversations(7 * 24 * 60 * 60 * 1000).catch(error => {
                Logger.error('Failed to cleanup old conversations:', error);
            }); // 7 days
        }, 24 * 60 * 60 * 1000));
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
     * Add a context document to the conversation
     */
    async addContextDocument(file: TFile, contextPath: string, property?: string): Promise<void> {
        await this.initializePromise; // Ensure initialization is complete
        
        const conversation = this.getConversation(file);
        
        // Check if document already in context
        const exists = conversation.contextDocuments?.some(doc => 
            doc.path === contextPath && doc.property === property
        );
        
        if (!exists) {
            const contextDoc: ContextDocumentRef = {
                path: contextPath,
                property,
                addedAt: Date.now()
            };
            
            conversation.contextDocuments?.push(contextDoc);
            conversation.lastUpdated = Date.now();
            
            await this.saveConversations();
        }
    }

    /**
     * Remove a context document from the conversation
     */
    async removeContextDocument(file: TFile, contextPath: string, property?: string): Promise<void> {
        const conversation = this.getConversation(file);
        
        if (conversation.contextDocuments) {
            conversation.contextDocuments = conversation.contextDocuments.filter(doc =>
                !(doc.path === contextPath && doc.property === property)
            );
            conversation.lastUpdated = Date.now();
            await this.saveConversations();
        }
    }

    /**
     * Get all context documents for a conversation
     */
    async getContextDocuments(file: TFile): Promise<ContextDocumentRef[]> {
        await this.initializePromise; // Ensure initialization is complete
        const conversation = this.getConversation(file);
        return conversation.contextDocuments || [];
    }

    /**
     * Clear all context documents for a conversation
     */
    async clearContextDocuments(file: TFile): Promise<void> {
        const conversation = this.getConversation(file);
        conversation.contextDocuments = [];
        conversation.lastUpdated = Date.now();
        await this.saveConversations();
    }

    /**
     * Update context documents (replace entire list)
     */
    async setContextDocuments(file: TFile, documents: ContextDocumentRef[]): Promise<void> {
        const conversation = this.getConversation(file);
        conversation.contextDocuments = documents;
        conversation.lastUpdated = Date.now();
        await this.saveConversations();
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