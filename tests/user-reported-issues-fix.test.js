/**
 * @jest-environment jsdom
 */

describe('User Reported Issues Fix', () => {
    let mockPlugin;
    let mockConversationManager;
    let chatContainer;
    let chatRenderer;

    beforeEach(() => {
        // Reset DOM
        document.body.innerHTML = '';
        
        // Create chat container with Obsidian methods
        chatContainer = document.createElement('div');
        chatContainer.className = 'nova-chat-container';
        
        // Helper to add Obsidian methods to elements
        const addObsidianMethods = (element) => {
            element.createDiv = function(options) {
                const div = document.createElement('div');
                if (options?.cls) div.className = options.cls;
                this.appendChild(div);
                addObsidianMethods(div); // Add methods to created elements
                return div;
            };
            element.createEl = function(tag, options) {
                const el = document.createElement(tag);
                if (options?.cls) el.className = options.cls;
                if (options?.text) el.textContent = options.text;
                this.appendChild(el);
                addObsidianMethods(el); // Add methods to created elements
                return el;
            };
            element.empty = function() {
                this.innerHTML = '';
            };
        };
        
        addObsidianMethods(chatContainer);
        document.body.appendChild(chatContainer);
        
        // Mock conversation manager
        mockConversationManager = {
            getRecentMessages: jest.fn(),
            addUserMessage: jest.fn().mockResolvedValue({}),
            addSystemMessage: jest.fn().mockResolvedValue({})
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
        
        // Add CSS for styling tests
        const style = document.createElement('style');
        style.textContent = `
            .nova-pill-success { background: green; }
            .nova-message-user { background: blue; }
            .nova-message-system { background: gray; }
        `;
        document.head.appendChild(style);
        
        jest.clearAllMocks();
    });

    afterEach(() => {
        document.head.innerHTML = '';
        document.body.innerHTML = '';
    });

    test('ISSUE 1: Menu system messages persist and restore properly', async () => {
        // Simulate menu system (selection context menu) adding success message
        chatRenderer.addSuccessMessage('✓ Text improved via menu', true);
        
        // Verify message persisted with metadata
        expect(mockConversationManager.addSystemMessage).toHaveBeenCalledWith(
            { path: 'test.md', basename: 'test' },
            '✓ Text improved via menu',
            { messageType: 'nova-pill-success' }
        );
        
        // Verify styled message in DOM
        const menuMessage = chatContainer.querySelector('.nova-pill-success');
        expect(menuMessage).toBeTruthy();
        expect(menuMessage.textContent).toBe('✓ Text improved via menu');
        
        // Simulate file switch and return - restore conversation
        mockConversationManager.getRecentMessages.mockResolvedValue([
            {
                id: 'menu-msg',
                role: 'system',
                content: '✓ Text improved via menu',
                timestamp: Date.now(),
                metadata: {
                    messageType: 'nova-pill-success',
                    source: 'selection'
                }
            }
        ]);
        
        chatContainer.empty();
        await chatRenderer.loadConversationHistory({ path: 'test.md', basename: 'test' });
        
        // Verify message restored with correct styling
        const restoredMessage = chatContainer.querySelector('.nova-pill-success');
        expect(restoredMessage).toBeTruthy();
        expect(restoredMessage.textContent).toBe('✓ Text improved via menu');
        
        // Should appear EXACTLY ONCE
        const allSuccessMessages = chatContainer.querySelectorAll('.nova-pill-success');
        expect(allSuccessMessages.length).toBe(1);
    });

    test('ISSUE 2: Chat input messages should NOT be duplicated', async () => {
        const testFile = { path: 'test.md', basename: 'test' };
        
        // Simulate user typing in chat and hitting send
        const userMessage = 'Hello Nova, please help me';
        
        // FIXED flow: persist first, then add to UI
        await mockPlugin.conversationManager.addUserMessage(testFile, userMessage, null);
        chatRenderer.addMessage('user', userMessage);
        
        // Verify single user message in UI
        const userMessages = chatContainer.querySelectorAll('.nova-message-user');
        expect(userMessages.length).toBe(1);
        expect(userMessages[0].textContent).toContain(userMessage);
        
        // Add a success system message from chat flow
        chatRenderer.addSuccessMessage('✓ Chat response generated', true);
        
        // Simulate file switch and restoration
        mockConversationManager.getRecentMessages.mockResolvedValue([
            {
                id: 'user-msg',
                role: 'user',
                content: userMessage,
                timestamp: Date.now()
            },
            {
                id: 'system-msg',
                role: 'system',
                content: '✓ Chat response generated',
                timestamp: Date.now(),
                metadata: {
                    messageType: 'nova-pill-success',
                    source: 'chat'
                }
            }
        ]);
        
        chatContainer.empty();
        await chatRenderer.loadConversationHistory(testFile);
        
        // VERIFY NO DUPLICATION:
        // Should have exactly 1 user message
        const restoredUserMessages = chatContainer.querySelectorAll('.nova-message-user');
        expect(restoredUserMessages.length).toBe(1);
        expect(restoredUserMessages[0].textContent).toContain(userMessage);
        
        // Should have exactly 1 success message with correct styling
        const restoredSuccessMessages = chatContainer.querySelectorAll('.nova-pill-success');
        expect(restoredSuccessMessages.length).toBe(1);
        expect(restoredSuccessMessages[0].textContent).toBe('✓ Chat response generated');
        
        // Should NOT have any system messages with wrong styling
        const wrongStyledMessages = chatContainer.querySelectorAll('.nova-message-system');
        expect(wrongStyledMessages.length).toBe(0);
    });

    test('ISSUE 3: System success messages should NOT appear twice with different styling', async () => {
        const testFile = { path: 'test.md', basename: 'test' };
        
        // Add system success message
        chatRenderer.addSuccessMessage('✓ Operation completed', true);
        
        // Verify single persistence call
        expect(mockConversationManager.addSystemMessage).toHaveBeenCalledTimes(1);
        
        // Simulate conversation restoration
        mockConversationManager.getRecentMessages.mockResolvedValue([
            {
                id: 'success-msg',
                role: 'system',
                content: '✓ Operation completed',
                timestamp: Date.now(),
                metadata: {
                    messageType: 'nova-pill-success',
                    source: 'chat'
                }
            }
        ]);
        
        chatContainer.empty();
        await chatRenderer.loadConversationHistory(testFile);
        
        // VERIFY SINGLE APPEARANCE:
        // Should have exactly 1 success pill with correct styling
        const correctlyStyledMessages = chatContainer.querySelectorAll('.nova-pill-success');
        expect(correctlyStyledMessages.length).toBe(1);
        expect(correctlyStyledMessages[0].textContent).toBe('✓ Operation completed');
        
        // Should NOT have duplicate with wrong styling
        const wronglyStyledMessages = chatContainer.querySelectorAll('.nova-message-system');
        expect(wronglyStyledMessages.length).toBe(0);
        
        // Total system-related messages should be exactly 1
        const allSystemMessages = chatContainer.querySelectorAll('.nova-message[class*="system"], .nova-pill-success, .nova-bubble-success');
        expect(allSystemMessages.length).toBe(1);
    });

    test('ISSUE 4: Mixed conversation should handle all message types correctly', async () => {
        const testFile = { path: 'test.md', basename: 'test' };
        
        // Simulate a complete conversation with mixed message types
        mockConversationManager.getRecentMessages.mockResolvedValue([
            {
                id: 'msg1',
                role: 'user',
                content: 'Please improve this text',
                timestamp: Date.now()
            },
            {
                id: 'msg2',
                role: 'system',
                content: '✓ Text improved',
                timestamp: Date.now(),
                metadata: {
                    messageType: 'nova-pill-success',
                    source: 'selection'  // From menu
                }
            },
            {
                id: 'msg3',
                role: 'assistant',
                content: 'I have improved your text as requested.',
                timestamp: Date.now()
            },
            {
                id: 'msg4',
                role: 'user',
                content: 'Thank you! Can you also fix grammar?',
                timestamp: Date.now()
            },
            {
                id: 'msg5',
                role: 'system',
                content: '✓ Grammar fixed',
                timestamp: Date.now(),
                metadata: {
                    messageType: 'nova-pill-success',
                    source: 'chat'  // From chat
                }
            }
        ]);
        
        // Mock addMessage for regular messages
        const addMessageCalls = [];
        chatRenderer.addMessage = jest.fn((role, content) => {
            addMessageCalls.push({ role, content });
            // Create actual DOM elements for test verification
            const messageEl = chatContainer.createDiv({ cls: `nova-message nova-message-${role}` });
            messageEl.textContent = content;
        });
        
        await chatRenderer.loadConversationHistory(testFile);
        
        // VERIFY CORRECT COUNTS:
        // Regular messages (user/assistant) go through addMessage
        expect(addMessageCalls.length).toBe(3);
        expect(addMessageCalls[0]).toEqual({ role: 'user', content: 'Please improve this text' });
        expect(addMessageCalls[1]).toEqual({ role: 'assistant', content: 'I have improved your text as requested.' });
        expect(addMessageCalls[2]).toEqual({ role: 'user', content: 'Thank you! Can you also fix grammar?' });
        
        // System messages with metadata get styled elements (not through addMessage)
        const styledSystemMessages = chatContainer.querySelectorAll('.nova-pill-success');
        expect(styledSystemMessages.length).toBe(2);
        expect(styledSystemMessages[0].textContent).toBe('✓ Text improved');
        expect(styledSystemMessages[1].textContent).toBe('✓ Grammar fixed');
        
        // Should have correct total of user messages
        const userMessages = chatContainer.querySelectorAll('.nova-message-user');
        expect(userMessages.length).toBe(2);
        
        // Should have correct total of assistant messages  
        const assistantMessages = chatContainer.querySelectorAll('.nova-message-assistant');
        expect(assistantMessages.length).toBe(1);
        
        // NO DUPLICATES OR WRONG STYLING
        expect(mockConversationManager.getRecentMessages).toHaveBeenCalledTimes(1);
    });
});