/**
 * @jest-environment jsdom
 */

describe('Unified Message System Integration', () => {
    let mockPlugin;
    let mockConversationManager;
    let chatContainer;
    let chatRenderer;

    beforeEach(() => {
        // Reset DOM
        document.body.textContent = '';
        
        // Create chat container with Obsidian extended methods
        chatContainer = document.createElement('div');
        chatContainer.className = 'nova-chat-container';
        document.body.appendChild(chatContainer);
        
        // Add Obsidian extended methods to container
        chatContainer.empty = function() {
            while (this.firstChild) {
                this.removeChild(this.firstChild);
            }
        };
        
        chatContainer.createEl = function(tag, attrs) {
            const el = document.createElement(tag);
            if (attrs?.text) el.textContent = attrs.text;
            if (attrs?.cls) el.className = attrs.cls;
            if (attrs?.attr) {
                Object.entries(attrs.attr).forEach(([key, value]) => {
                    el.setAttribute(key, value);
                });
            }
            
            // Add Obsidian extended methods to created elements
            el.createEl = chatContainer.createEl.bind(el);
            el.createDiv = chatContainer.createDiv.bind(el);
            el.empty = function() { 
                while (this.firstChild) {
                    this.removeChild(this.firstChild);
                }
            };
            
            this.appendChild(el);
            return el;
        };
        
        chatContainer.createDiv = function(attrs) {
            return this.createEl('div', attrs);
        };
        
        // Mock conversation manager
        mockConversationManager = {
            addSystemMessage: jest.fn().mockResolvedValue({
                id: 'test-id',
                role: 'system',
                content: 'test content',
                timestamp: Date.now(),
                metadata: { messageType: 'nova-pill-success' }
            }),
            getRecentMessages: jest.fn()
        };

        // Mock plugin
        mockPlugin = {
            app: {
                workspace: {
                    getActiveFile: () => ({ path: 'test.md', name: 'test.md' })
                }
            },
            conversationManager: mockConversationManager,
            registerInterval: jest.fn((intervalId) => intervalId) // Mock for compliance
        };

        // Add CSS for styling tests
        const style = document.createElement('style');
        style.textContent = `
            .nova-pill-success {
                background: rgba(76, 175, 80, 0.1) !important;
                color: #4caf50 !important;
                text-align: center !important;
                border-radius: 20px !important;
                max-width: 200px !important;
                margin: 0 auto !important;
            }
            .nova-bubble-success {
                background: #f0f9f0 !important;
                color: #2d5a2d !important;
                max-width: 80% !important;
                margin-right: auto !important;
            }
            .nova-bubble-error {
                background: #fef2f2 !important;
                color: #7f1d1d !important;
                max-width: 80% !important;
                margin-right: auto !important;
            }
        `;
        document.head.appendChild(style);

        // Create ChatRenderer instance
        const ChatRenderer = require('../../src/ui/chat-renderer').ChatRenderer;
        chatRenderer = new ChatRenderer(mockPlugin, chatContainer);
        
        jest.clearAllMocks();
    });

    afterEach(() => {
        document.head.textContent = '';
        document.body.textContent = '';
    });

    test('complete flow: short success message with persistence and restoration', async () => {
        const shortMessage = '✓ Done';
        
        // 1. Add short success message with persistence
        chatRenderer.addSuccessMessage(shortMessage, true);
        
        // Verify message appears in DOM with correct styling
        const messageEl = chatContainer.querySelector('.nova-message');
        expect(messageEl).toBeTruthy();
        expect(messageEl.classList.contains('nova-pill-success')).toBe(true);
        expect(messageEl.textContent).toBe(shortMessage);
        
        // Verify persistence was called with correct metadata
        expect(mockConversationManager.addSystemMessage).toHaveBeenCalledWith(
            { path: 'test.md', name: 'test.md' },
            shortMessage,
            { messageType: 'nova-pill-success' }
        );
        
        // 2. Simulate conversation restoration
        mockConversationManager.getRecentMessages.mockResolvedValue([
            {
                id: 'msg1',
                role: 'system',
                content: shortMessage,
                timestamp: Date.now(),
                metadata: {
                    messageType: 'nova-pill-success',
                    source: 'chat'
                }
            }
        ]);
        
        // Clear current messages and restore
        while (chatContainer.firstChild) {
            chatContainer.removeChild(chatContainer.firstChild);
        }
        await chatRenderer.loadConversationHistory({ path: 'test.md', name: 'test.md' });
        
        // Verify restoration maintains styling
        const restoredEl = chatContainer.querySelector('.nova-message');
        expect(restoredEl).toBeTruthy();
        expect(restoredEl.classList.contains('nova-pill-success')).toBe(true);
        expect(restoredEl.textContent).toBe(shortMessage);
    });

    test('complete flow: long error message with persistence and restoration', async () => {
        const longError = 'This is a longer error message that should use bubble styling instead of pill';
        
        // 1. Add long error message with persistence
        chatRenderer.addErrorMessage(longError, true);
        
        // Verify message appears with bubble styling
        const messageEl = chatContainer.querySelector('.nova-message');
        expect(messageEl).toBeTruthy();
        expect(messageEl.classList.contains('nova-bubble-error')).toBe(true);
        expect(messageEl.textContent).toBe('❌ ' + longError);
        
        // Verify persistence with correct metadata
        expect(mockConversationManager.addSystemMessage).toHaveBeenCalledWith(
            { path: 'test.md', name: 'test.md' },
            '❌ ' + longError,
            { messageType: 'nova-bubble-error' }
        );
        
        // 2. Simulate restoration after file switch
        mockConversationManager.getRecentMessages.mockResolvedValue([
            {
                id: 'msg1',
                role: 'system',
                content: '❌ ' + longError,
                timestamp: Date.now(),
                metadata: {
                    messageType: 'nova-bubble-error',
                    source: 'selection'
                }
            }
        ]);
        
        while (chatContainer.firstChild) {
            chatContainer.removeChild(chatContainer.firstChild);
        }
        await chatRenderer.loadConversationHistory({ path: 'test.md', name: 'test.md' });
        
        // Verify restoration maintains bubble styling
        const restoredEl = chatContainer.querySelector('.nova-message');
        expect(restoredEl).toBeTruthy();
        expect(restoredEl.classList.contains('nova-bubble-error')).toBe(true);
        expect(restoredEl.textContent).toBe('❌ ' + longError);
    });

    test('mixed conversation: regular messages and status messages', async () => {
        // Simulate a mixed conversation history
        mockConversationManager.getRecentMessages.mockResolvedValue([
            {
                id: 'msg1',
                role: 'user',
                content: 'Hello Nova',
                timestamp: Date.now()
            },
            {
                id: 'msg2',
                role: 'assistant',
                content: 'Hello! How can I help?',
                timestamp: Date.now()
            },
            {
                id: 'msg3',
                role: 'system',
                content: '✓ Text improved',
                timestamp: Date.now(),
                metadata: {
                    messageType: 'nova-pill-success',
                    source: 'selection'
                }
            },
            {
                id: 'msg4',
                role: 'system',
                content: 'Error: Failed to process the request due to network timeout',
                timestamp: Date.now(),
                metadata: {
                    messageType: 'nova-bubble-error',
                    source: 'chat'
                }
            }
        ]);

        // Mock the addMessage method for regular messages
        chatRenderer.addMessage = jest.fn();

        await chatRenderer.loadConversationHistory({ path: 'test.md', name: 'test.md' });

        // Check that regular messages go through addMessage
        expect(chatRenderer.addMessage).toHaveBeenCalledWith('user', 'Hello Nova');
        expect(chatRenderer.addMessage).toHaveBeenCalledWith('assistant', 'Hello! How can I help?');

        // Check that status messages are restored with styling
        const statusMessages = chatContainer.querySelectorAll('.nova-message');
        expect(statusMessages.length).toBe(2);
        
        expect(statusMessages[0].classList.contains('nova-pill-success')).toBe(true);
        expect(statusMessages[0].textContent).toBe('✓ Text improved');
        
        expect(statusMessages[1].classList.contains('nova-bubble-error')).toBe(true);
        expect(statusMessages[1].textContent).toBe('Error: Failed to process the request due to network timeout');
    });

    test('no duplicates: same styling across components', () => {
        // Test that different components using the unified system produce identical styling
        
        // Add message through ChatRenderer
        chatRenderer.addSuccessMessage('✓ Done', false);
        const chatMessage = chatContainer.querySelector('.nova-message');
        
        // Clear and add message through unified system directly
        while (chatContainer.firstChild) {
            chatContainer.removeChild(chatContainer.firstChild);
        }
        chatRenderer.addStatusMessage('✓ Done', {
            type: 'pill',
            variant: 'success',
            persist: false
        });
        const statusMessage = chatContainer.querySelector('.nova-message');
        
        // Both should have identical CSS classes
        expect(chatMessage.className).toBe(statusMessage.className);
        expect(chatMessage.classList.contains('nova-pill-success')).toBe(true);
        expect(statusMessage.classList.contains('nova-pill-success')).toBe(true);
    });
});