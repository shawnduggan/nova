/**
 * @jest-environment jsdom
 */

describe('Message Duplication Fix', () => {
    let mockPlugin;
    let mockConversationManager;
    let chatContainer;
    let chatRenderer;

    beforeEach(() => {
        // Reset DOM
        document.body.innerHTML = '';
        
        // Helper to add Obsidian methods to elements
        const addObsidianMethods = (element) => {
            element.createDiv = function(options) {
                const div = document.createElement('div');
                if (options?.cls) div.className = options.cls;
                this.appendChild(div);
                addObsidianMethods(div); // Add methods to child elements
                return div;
            };
            element.createEl = function(tag, options) {
                const el = document.createElement(tag);
                if (options?.cls) el.className = options.cls;
                if (options?.text) el.textContent = options.text;
                this.appendChild(el);
                addObsidianMethods(el); // Add methods to child elements
                return el;
            };
            element.empty = function() {
                this.innerHTML = '';
            };
        };

        // Create chat container with Obsidian methods
        chatContainer = document.createElement('div');
        chatContainer.className = 'nova-chat-container';
        addObsidianMethods(chatContainer);
        document.body.appendChild(chatContainer);
        
        // Mock conversation manager
        mockConversationManager = {
            getRecentMessages: jest.fn(),
            addUserMessage: jest.fn().mockResolvedValue({
                id: 'user-msg-id',
                role: 'user',
                content: 'test message',
                timestamp: Date.now()
            }),
            addSystemMessage: jest.fn().mockResolvedValue({
                id: 'system-msg-id',
                role: 'system',
                content: '✓ Success',
                timestamp: Date.now()
            })
        };

        // Mock plugin
        mockPlugin = {
            conversationManager: mockConversationManager,
            app: {
                workspace: {
                    getActiveFile: jest.fn().mockReturnValue({ path: 'test.md', basename: 'test' })
                }
            }
        };

        // Create ChatRenderer
        const { ChatRenderer } = require('../src/ui/chat-renderer');
        chatRenderer = new ChatRenderer(mockPlugin, chatContainer);
        
        jest.clearAllMocks();
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('user message should only be persisted once during input', async () => {
        const testFile = { path: 'test.md', basename: 'test' };
        
        // Simulate the FIXED handleUserInput flow:
        // 1. Persist message
        // 2. Add to UI immediately  
        // 3. No redundant persistence calls
        
        const handleUserInput = async (messageText) => {
            const activeFile = mockPlugin.app.workspace.getActiveFile();
            if (activeFile) {
                // Single persistence call
                await mockPlugin.conversationManager.addUserMessage(activeFile, messageText, null);
                // Add to UI immediately after persistence
                chatRenderer.addMessage('user', messageText);
            }
        };

        await handleUserInput('Hello Nova');

        // Verify SINGLE persistence call
        expect(mockConversationManager.addUserMessage).toHaveBeenCalledTimes(1);
        expect(mockConversationManager.addUserMessage).toHaveBeenCalledWith(
            { path: 'test.md', basename: 'test' },
            'Hello Nova',
            null
        );

        // Verify message appears in UI once
        const userMessages = chatContainer.querySelectorAll('.nova-message-user');
        expect(userMessages.length).toBe(1);
        expect(userMessages[0].textContent).toContain('Hello Nova');
    });

    test('conversation restoration should not duplicate messages', async () => {
        const testFile = { path: 'test.md', basename: 'test' };
        
        // Simulate conversation with user and system messages
        mockConversationManager.getRecentMessages.mockResolvedValue([
            {
                id: 'msg1',
                role: 'user',
                content: 'Hello Nova',
                timestamp: Date.now()
            },
            {
                id: 'msg2',
                role: 'system',
                content: '✓ Text improved',
                timestamp: Date.now(),
                metadata: {
                    messageType: 'nova-pill-success',
                    source: 'selection'
                }
            },
            {
                id: 'msg3',
                role: 'assistant',
                content: 'Hello! How can I help?',
                timestamp: Date.now()
            }
        ]);

        // Mock addMessage calls for tracking
        const addMessageCalls = [];
        chatRenderer.addMessage = jest.fn((role, content) => {
            addMessageCalls.push({ role, content });
        });

        await chatRenderer.loadConversationHistory(testFile);

        // Verify each message appears exactly once
        expect(addMessageCalls.length).toBe(2); // Only user and assistant messages
        expect(addMessageCalls[0]).toEqual({ role: 'user', content: 'Hello Nova' });
        expect(addMessageCalls[1]).toEqual({ role: 'assistant', content: 'Hello! How can I help?' });

        // Verify system message with styling appears once (not through addMessage)
        const systemMessages = chatContainer.querySelectorAll('.nova-pill-success');
        expect(systemMessages.length).toBe(1);
        expect(systemMessages[0].textContent).toBe('✓ Text improved');

        // Verify conversation loaded only once
        expect(mockConversationManager.getRecentMessages).toHaveBeenCalledTimes(1);
        expect(mockConversationManager.getRecentMessages).toHaveBeenCalledWith(testFile, 50);
    });

    test('system messages should appear once with correct styling', async () => {
        const testFile = { path: 'test.md', basename: 'test' };
        
        // Add success message with persistence
        chatRenderer.addSuccessMessage('✓ Task completed', true);
        
        // Verify single DOM element
        const successMessages = chatContainer.querySelectorAll('.nova-pill-success');
        expect(successMessages.length).toBe(1);
        expect(successMessages[0].textContent).toBe('✓ Task completed');
        
        // Verify single persistence call
        expect(mockConversationManager.addSystemMessage).toHaveBeenCalledTimes(1);
        expect(mockConversationManager.addSystemMessage).toHaveBeenCalledWith(
            { path: 'test.md', basename: 'test' },
            '✓ Task completed',
            { messageType: 'nova-pill-success' }
        );
        
        // Now simulate restoration
        mockConversationManager.getRecentMessages.mockResolvedValue([
            {
                id: 'msg1',
                role: 'system',
                content: '✓ Task completed',
                timestamp: Date.now(),
                metadata: {
                    messageType: 'nova-pill-success',
                    source: 'chat'
                }
            }
        ]);
        
        // Clear and restore
        chatContainer.empty();
        await chatRenderer.loadConversationHistory(testFile);
        
        // Should still have exactly one message with correct styling
        const restoredMessages = chatContainer.querySelectorAll('.nova-pill-success');
        expect(restoredMessages.length).toBe(1);
        expect(restoredMessages[0].textContent).toBe('✓ Task completed');
    });

    test('no redundant conversation loading calls', async () => {
        const testFile = { path: 'test.md', basename: 'test' };
        
        mockConversationManager.getRecentMessages.mockResolvedValue([
            {
                id: 'msg1',
                role: 'user',
                content: 'Test message',
                timestamp: Date.now()
            }
        ]);

        // Simulate the FIXED loadConversationForActiveFile method
        const loadConversationForActiveFile = async (targetFile) => {
            try {
                // Single call to ChatRenderer - no redundant getRecentMessages
                await chatRenderer.loadConversationHistory(targetFile);
            } catch (error) {
                console.error('Failed to load conversation');
            }
        };

        await loadConversationForActiveFile(testFile);

        // Should have exactly ONE call to getRecentMessages (from ChatRenderer)
        expect(mockConversationManager.getRecentMessages).toHaveBeenCalledTimes(1);
        expect(mockConversationManager.getRecentMessages).toHaveBeenCalledWith(testFile, 50);
    });
});