import { NovaSidebarView, VIEW_TYPE_NOVA_SIDEBAR } from '../../src/ui/sidebar-view';
import { WorkspaceLeaf } from 'obsidian';
import NovaPlugin from '../../main';

// Mock the entire Obsidian module
jest.mock('obsidian');

describe('NovaSidebarView', () => {
    let sidebar: NovaSidebarView;
    let mockLeaf: WorkspaceLeaf;
    let mockPlugin: NovaPlugin;

    beforeEach(() => {
        // Mock leaf
        mockLeaf = new WorkspaceLeaf();
        
        // Mock plugin with essential services
        mockPlugin = {
            settings: {
                platformSettings: {
                    desktop: { primaryProvider: 'claude' },
                    mobile: { primaryProvider: 'claude' }
                }
            },
            aiProviderManager: {
                generateText: jest.fn().mockResolvedValue('AI response'),
                getCurrentProviderName: jest.fn().mockResolvedValue('Claude'),
                complete: jest.fn().mockResolvedValue('AI response')
            },
            promptBuilder: {
                buildPromptForMessage: jest.fn().mockResolvedValue({
                    systemPrompt: 'System prompt',
                    userPrompt: 'User prompt',
                    context: 'Context',
                    config: { temperature: 0.7, maxTokens: 1000 }
                })
            },
            commandParser: {
                parseCommand: jest.fn().mockReturnValue({
                    action: 'unknown',
                    target: 'document',
                    instruction: 'test command'
                })
            },
            conversationManager: {
                getRecentMessages: jest.fn().mockResolvedValue([]),
                clearConversation: jest.fn().mockResolvedValue(undefined),
                addUserMessage: jest.fn().mockResolvedValue(undefined),
                addAssistantMessage: jest.fn().mockResolvedValue(undefined)
            },
            documentEngine: {
                getActiveFile: jest.fn().mockReturnValue(null)
            },
            addCommandHandler: {
                execute: jest.fn().mockResolvedValue({ success: true })
            },
            editCommandHandler: {
                execute: jest.fn().mockResolvedValue({ success: true })
            },
            deleteCommandHandler: {
                execute: jest.fn().mockResolvedValue({ success: true })
            },
            grammarCommandHandler: {
                execute: jest.fn().mockResolvedValue({ success: true })
            },
            rewriteCommandHandler: {
                execute: jest.fn().mockResolvedValue({ success: true })
            },
            app: {
                workspace: {
                    activeEditor: null,
                    getActiveFile: jest.fn().mockReturnValue(null),
                    on: jest.fn().mockReturnValue({ unsubscribe: jest.fn() })
                }
            }
        } as any;
        
        // Create sidebar instance
        sidebar = new NovaSidebarView(mockLeaf, mockPlugin);
    });

    describe('View Basics', () => {
        it('should return correct view type', () => {
            expect(sidebar.getViewType()).toBe(VIEW_TYPE_NOVA_SIDEBAR);
        });

        it('should return correct display text', () => {
            expect(sidebar.getDisplayText()).toBe('Nova AI');
        });

        it('should return correct icon', () => {
            expect(sidebar.getIcon()).toBe('nova-star');
        });
    });

    describe('AI Provider Integration', () => {
        it('should build prompts using PromptBuilder', async () => {
            const message = 'test message';
            const mockFile = { path: 'test.md', basename: 'test' };
            
            mockPlugin.documentEngine.getActiveFile = jest.fn().mockReturnValue(mockFile);
            
            await sidebar.sendMessage(message);
            
            expect(mockPlugin.promptBuilder.buildPromptForMessage).toHaveBeenCalledWith(
                message,
                mockFile
            );
        });

        it('should handle messages without active file', async () => {
            mockPlugin.documentEngine.getActiveFile = jest.fn().mockReturnValue(null);
            
            await sidebar.sendMessage('test message');
            
            expect(mockPlugin.promptBuilder.buildPromptForMessage).toHaveBeenCalledWith(
                'test message',
                undefined
            );
        });
    });

    describe('Command Execution', () => {
        it('should route add commands correctly', async () => {
            // For command tests, the sidebar implementation uses isLikelyCommand internally
            mockPlugin.commandParser.parseCommand = jest.fn().mockReturnValue({
                action: 'add',
                target: 'document',
                instruction: 'test'
            });
            
            await sidebar.sendMessage('add a section');
            
            expect(mockPlugin.addCommandHandler.execute).toHaveBeenCalled();
        });

        it('should route edit commands correctly', async () => {
            // For command tests, the sidebar implementation uses isLikelyCommand internally
            mockPlugin.commandParser.parseCommand = jest.fn().mockReturnValue({
                action: 'edit',
                target: 'selection',
                instruction: 'test'
            });
            
            await sidebar.sendMessage('edit this');
            
            expect(mockPlugin.editCommandHandler.execute).toHaveBeenCalled();
        });

        it('should handle unknown command actions', async () => {
            // For command tests, the sidebar implementation uses isLikelyCommand internally
            mockPlugin.commandParser.parseCommand = jest.fn().mockReturnValue({
                action: 'unknown',
                target: 'document',
                instruction: 'test'
            });
            
            const result = await sidebar.sendMessage('unknown command');
            
            expect(result).toBeUndefined();
            expect(mockPlugin.addCommandHandler.execute).not.toHaveBeenCalled();
        });
    });

    describe('Conversation Management', () => {
        it('should store messages when file is active', async () => {
            const mockFile = { path: 'test.md', basename: 'test' };
            mockPlugin.documentEngine.getActiveFile = jest.fn().mockReturnValue(mockFile);
            
            await sidebar.sendMessage('test message');
            
            expect(mockPlugin.conversationManager.addUserMessage).toHaveBeenCalledWith(
                mockFile,
                'test message',
                expect.any(Object)
            );
        });

        it('should not store messages when no active file', async () => {
            mockPlugin.documentEngine.getActiveFile = jest.fn().mockReturnValue(null);
            
            await sidebar.sendMessage('test message');
            
            expect(mockPlugin.conversationManager.addUserMessage).not.toHaveBeenCalled();
        });

        it('should load conversation history', async () => {
            const mockFile = { path: 'test.md', basename: 'test' };
            const mockMessages = [
                { role: 'user', content: 'Hello', timestamp: Date.now() },
                { role: 'assistant', content: 'Hi there', timestamp: Date.now() }
            ];
            
            mockPlugin.conversationManager.getRecentMessages = jest.fn().mockResolvedValue(mockMessages);
            
            await sidebar.loadConversationHistory(mockFile);
            
            expect(mockPlugin.conversationManager.getRecentMessages).toHaveBeenCalledWith(mockFile, 50);
        });
    });
});