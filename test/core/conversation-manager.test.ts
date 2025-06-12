/**
 * Tests for ConversationManager
 */

import { ConversationManager, DataStore } from '../../src/core/conversation-manager';
import { EditCommand, EditResult, ConversationMessage } from '../../src/core/types';
import { TFile } from '../mocks/obsidian-mock';

describe('ConversationManager', () => {
    let conversationManager: ConversationManager;
    let mockDataStore: DataStore;
    let mockFile: TFile;
    let savedData: any = null;

    beforeEach(() => {
        savedData = null;
        
        // Mock data store
        mockDataStore = {
            loadData: jest.fn().mockResolvedValue(null),
            saveData: jest.fn().mockImplementation((key, data) => {
                savedData = data;
                return Promise.resolve();
            })
        };
        
        mockFile = new TFile('test-document.md');
        conversationManager = new ConversationManager(mockDataStore);
    });

    describe('initialization', () => {
        it('should initialize with empty conversations', () => {
            expect(conversationManager).toBeDefined();
            expect(mockDataStore.loadData).toHaveBeenCalledWith('nova-conversations');
        });

        it('should load existing conversations from data store', async () => {
            const existingConversations = [{
                filePath: 'existing.md',
                messages: [{
                    id: 'msg_1',
                    role: 'user' as const,
                    content: 'Hello',
                    timestamp: Date.now()
                }],
                lastUpdated: Date.now(),
                metadata: {
                    editCount: 1,
                    commandFrequency: { add: 1, edit: 0, delete: 0, grammar: 0, rewrite: 0 }
                }
            }];

            const mockDataStoreWithData = {
                loadData: jest.fn().mockResolvedValue(existingConversations),
                saveData: jest.fn().mockResolvedValue(undefined)
            };
            
            const newManager = new ConversationManager(mockDataStoreWithData);
            await new Promise(resolve => setTimeout(resolve, 0)); // Wait for async load
            
            const conversation = newManager.getConversation(new TFile('existing.md'));
            expect(conversation.messages).toHaveLength(1);
            expect(conversation.messages[0].content).toBe('Hello');
        });
    });

    describe('getConversation', () => {
        it('should create new conversation for new file', () => {
            const conversation = conversationManager.getConversation(mockFile);
            
            expect(conversation).toBeDefined();
            expect(conversation.filePath).toBe('test-document.md');
            expect(conversation.messages).toEqual([]);
            expect(conversation.metadata?.editCount).toBe(0);
            expect(conversation.metadata?.commandFrequency).toEqual({
                add: 0, edit: 0, delete: 0, grammar: 0, rewrite: 0, metadata: 0
            });
        });

        it('should return existing conversation for known file', () => {
            const conversation1 = conversationManager.getConversation(mockFile);
            const conversation2 = conversationManager.getConversation(mockFile);
            
            expect(conversation1).toBe(conversation2);
        });
    });

    describe('addUserMessage', () => {
        it('should add user message to conversation', async () => {
            const message = await conversationManager.addUserMessage(mockFile, 'Test message');
            
            expect(message.role).toBe('user');
            expect(message.content).toBe('Test message');
            expect(message.id).toBeDefined();
            expect(message.timestamp).toBeCloseTo(Date.now(), -2);
            
            const conversation = conversationManager.getConversation(mockFile);
            expect(conversation.messages).toHaveLength(1);
            expect(conversation.messages[0]).toBe(message);
        });

        it('should add user message with command', async () => {
            const command: EditCommand = {
                action: 'add',
                target: 'selection',
                instruction: 'Add some text'
            };
            
            const message = await conversationManager.addUserMessage(mockFile, 'Test message', command);
            
            expect(message.command).toBe(command);
            
            const conversation = conversationManager.getConversation(mockFile);
            expect(conversation.metadata?.commandFrequency.add).toBe(1);
        });

        it('should save conversation after adding message', async () => {
            await conversationManager.addUserMessage(mockFile, 'Test message');
            
            expect(mockDataStore.saveData).toHaveBeenCalledWith('nova-conversations', expect.any(Array));
            expect(savedData).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    filePath: 'test-document.md',
                    messages: expect.arrayContaining([
                        expect.objectContaining({
                            role: 'user',
                            content: 'Test message'
                        })
                    ])
                })
            ]));
        });
    });

    describe('addAssistantMessage', () => {
        it('should add assistant message to conversation', async () => {
            const message = await conversationManager.addAssistantMessage(mockFile, 'Assistant response');
            
            expect(message.role).toBe('assistant');
            expect(message.content).toBe('Assistant response');
            
            const conversation = conversationManager.getConversation(mockFile);
            expect(conversation.messages).toHaveLength(1);
            expect(conversation.messages[0]).toBe(message);
        });

        it('should add assistant message with result', async () => {
            const result: EditResult = {
                success: true,
                content: 'Modified content',
                editType: 'replace'
            };
            
            const message = await conversationManager.addAssistantMessage(mockFile, 'Done', result);
            
            expect(message.result).toBe(result);
            
            const conversation = conversationManager.getConversation(mockFile);
            expect(conversation.metadata?.editCount).toBe(1);
        });

        it('should not increment edit count for failed results', async () => {
            const result: EditResult = {
                success: false,
                error: 'Something went wrong',
                editType: 'replace'
            };
            
            await conversationManager.addAssistantMessage(mockFile, 'Failed', result);
            
            const conversation = conversationManager.getConversation(mockFile);
            expect(conversation.metadata?.editCount).toBe(0);
        });
    });

    describe('addSystemMessage', () => {
        it('should add system message to conversation', async () => {
            const message = await conversationManager.addSystemMessage(mockFile, 'System notification');
            
            expect(message.role).toBe('system');
            expect(message.content).toBe('System notification');
            
            const conversation = conversationManager.getConversation(mockFile);
            expect(conversation.messages).toHaveLength(1);
            expect(conversation.messages[0]).toBe(message);
        });
    });

    describe('getRecentMessages', () => {
        beforeEach(async () => {
            // Add multiple messages
            await conversationManager.addUserMessage(mockFile, 'Message 1');
            await conversationManager.addAssistantMessage(mockFile, 'Response 1');
            await conversationManager.addUserMessage(mockFile, 'Message 2');
            await conversationManager.addAssistantMessage(mockFile, 'Response 2');
            await conversationManager.addUserMessage(mockFile, 'Message 3');
        });

        it('should return recent messages in order', () => {
            const recent = conversationManager.getRecentMessages(mockFile, 3);
            
            expect(recent).toHaveLength(3);
            expect(recent[0].content).toBe('Message 2');
            expect(recent[1].content).toBe('Response 2');
            expect(recent[2].content).toBe('Message 3');
        });

        it('should default to 10 messages', () => {
            const recent = conversationManager.getRecentMessages(mockFile);
            
            expect(recent).toHaveLength(5); // We only have 5 messages
        });

        it('should handle empty conversation', () => {
            const emptyFile = new TFile('empty.md');
            const recent = conversationManager.getRecentMessages(emptyFile);
            
            expect(recent).toEqual([]);
        });
    });

    describe('getMessagesByRole', () => {
        beforeEach(async () => {
            await conversationManager.addUserMessage(mockFile, 'User 1');
            await conversationManager.addAssistantMessage(mockFile, 'Assistant 1');
            await conversationManager.addSystemMessage(mockFile, 'System 1');
            await conversationManager.addUserMessage(mockFile, 'User 2');
        });

        it('should filter messages by user role', () => {
            const userMessages = conversationManager.getMessagesByRole(mockFile, 'user');
            
            expect(userMessages).toHaveLength(2);
            expect(userMessages[0].content).toBe('User 1');
            expect(userMessages[1].content).toBe('User 2');
        });

        it('should filter messages by assistant role', () => {
            const assistantMessages = conversationManager.getMessagesByRole(mockFile, 'assistant');
            
            expect(assistantMessages).toHaveLength(1);
            expect(assistantMessages[0].content).toBe('Assistant 1');
        });

        it('should filter messages by system role', () => {
            const systemMessages = conversationManager.getMessagesByRole(mockFile, 'system');
            
            expect(systemMessages).toHaveLength(1);
            expect(systemMessages[0].content).toBe('System 1');
        });
    });

    describe('getConversationContext', () => {
        beforeEach(async () => {
            const command: EditCommand = {
                action: 'add',
                target: 'selection',
                instruction: 'Add text'
            };
            
            const result: EditResult = {
                success: true,
                content: 'Added content',
                editType: 'insert'
            };

            await conversationManager.addUserMessage(mockFile, 'Add some text', command);
            await conversationManager.addAssistantMessage(mockFile, 'Added successfully', result);
        });

        it('should generate context string from recent messages', () => {
            const context = conversationManager.getConversationContext(mockFile);
            
            expect(context).toContain('Previous conversation:');
            expect(context).toContain('USER: Add some text');
            expect(context).toContain('ASSISTANT: Added successfully');
            expect(context).toContain('Command: add selection');
            expect(context).toContain('Result: success');
        });

        it('should return empty string for empty conversation', () => {
            const emptyFile = new TFile('empty.md');
            const context = conversationManager.getConversationContext(emptyFile);
            
            expect(context).toBe('');
        });

        it('should limit messages by maxMessages parameter', () => {
            const context = conversationManager.getConversationContext(mockFile, 1);
            
            expect(context).toContain('ASSISTANT: Added successfully');
            expect(context).not.toContain('USER: Add some text');
        });
    });

    describe('clearConversation', () => {
        beforeEach(async () => {
            await conversationManager.addUserMessage(mockFile, 'Test message');
        });

        it('should clear all messages from conversation', async () => {
            await conversationManager.clearConversation(mockFile);
            
            const conversation = conversationManager.getConversation(mockFile);
            expect(conversation.messages).toEqual([]);
            expect(conversation.metadata?.editCount).toBe(0);
            expect(conversation.metadata?.commandFrequency).toEqual({
                add: 0, edit: 0, delete: 0, grammar: 0, rewrite: 0, metadata: 0
            });
        });

        it('should save after clearing', async () => {
            await conversationManager.clearConversation(mockFile);
            
            expect(mockDataStore.saveData).toHaveBeenCalled();
        });
    });

    describe('getStats', () => {
        beforeEach(async () => {
            const addCommand: EditCommand = { action: 'add', target: 'selection', instruction: 'Add' };
            const editCommand: EditCommand = { action: 'edit', target: 'selection', instruction: 'Edit' };
            const result: EditResult = { success: true, content: 'Content', editType: 'replace' };

            await conversationManager.addUserMessage(mockFile, 'Message 1', addCommand);
            await conversationManager.addAssistantMessage(mockFile, 'Response 1', result);
            await conversationManager.addUserMessage(mockFile, 'Message 2', addCommand);
            await conversationManager.addAssistantMessage(mockFile, 'Response 2', result);
            await conversationManager.addUserMessage(mockFile, 'Message 3', editCommand);
        });

        it('should return conversation statistics', async () => {
            // Add a small delay to ensure timestamp difference
            await new Promise(resolve => setTimeout(resolve, 1));
            
            const stats = conversationManager.getStats(mockFile);
            
            expect(stats.messageCount).toBe(5);
            expect(stats.editCount).toBe(2);
            expect(stats.mostUsedCommand).toBe('add');
            expect(stats.conversationAge).toBeGreaterThanOrEqual(0);
        });

        it('should handle empty conversation', () => {
            const emptyFile = new TFile('empty.md');
            const stats = conversationManager.getStats(emptyFile);
            
            expect(stats.messageCount).toBe(0);
            expect(stats.editCount).toBe(0);
            expect(stats.mostUsedCommand).toBe(null);
            expect(stats.conversationAge).toBe(0);
        });
    });

    describe('cleanup', () => {
        it('should have cleanup functionality', () => {
            // Cleanup functionality is now private and automatic
            // Just test that the cleanup method exists
            expect(conversationManager.cleanup).toBeDefined();
            expect(typeof conversationManager.cleanup).toBe('function');
        });
    });

    describe('exportConversation', () => {
        beforeEach(async () => {
            const command: EditCommand = { action: 'add', target: 'selection', instruction: 'Add text' };
            const result: EditResult = { success: true, content: 'Added', editType: 'insert' };

            await conversationManager.addUserMessage(mockFile, 'Hello', command);
            await conversationManager.addAssistantMessage(mockFile, 'Hi there', result);
        });

        it('should export conversation as markdown', () => {
            const exported = conversationManager.exportConversation(mockFile);
            
            expect(exported).toContain('# Conversation History for test-document.md');
            expect(exported).toContain('## USER');
            expect(exported).toContain('## ASSISTANT');
            expect(exported).toContain('Hello');
            expect(exported).toContain('Hi there');
            expect(exported).toContain('*Command: add selection*');
            expect(exported).toContain('*Result: Success*');
        });
    });

    describe('hasConversation', () => {
        it('should return false for file without messages', () => {
            expect(conversationManager.hasConversation(mockFile)).toBe(false);
        });

        it('should return true for file with messages', async () => {
            await conversationManager.addUserMessage(mockFile, 'Test');
            expect(conversationManager.hasConversation(mockFile)).toBe(true);
        });
    });

    describe('updateFilePath', () => {
        beforeEach(async () => {
            await conversationManager.addUserMessage(mockFile, 'Test message');
        });

        it('should update conversation file path', async () => {
            const oldPath = 'test-document.md';
            const newPath = 'renamed-document.md';
            
            await conversationManager.updateFilePath(oldPath, newPath);
            
            const conversation = conversationManager.getConversation(new TFile(newPath));
            expect(conversation.filePath).toBe(newPath);
            expect(conversation.messages).toHaveLength(1);
            expect(conversation.messages[0].content).toBe('Test message');
        });
    });

    describe('message trimming', () => {
        it('should trim conversation when exceeding max messages', async () => {
            // Set a low max for testing
            const manager = conversationManager as any;
            const originalMax = manager.maxMessagesPerFile;
            manager.maxMessagesPerFile = 3;

            // Add more messages than the limit
            for (let i = 1; i <= 5; i++) {
                await conversationManager.addUserMessage(mockFile, `Message ${i}`);
            }

            const conversation = conversationManager.getConversation(mockFile);
            expect(conversation.messages).toHaveLength(3);
            expect(conversation.messages[0].content).toBe('Message 3');
            expect(conversation.messages[2].content).toBe('Message 5');

            // Restore original max
            manager.maxMessagesPerFile = originalMax;
        });
    });

    describe('getAllConversationFiles', () => {
        it('should return all conversation file paths', async () => {
            const file1 = new TFile('file1.md');
            const file2 = new TFile('file2.md');
            
            await conversationManager.addUserMessage(file1, 'Message 1');
            await conversationManager.addUserMessage(file2, 'Message 2');
            
            const files = conversationManager.getAllConversationFiles();
            expect(files).toContain('file1.md');
            expect(files).toContain('file2.md');
            expect(files).toHaveLength(2);
        });
    });
});