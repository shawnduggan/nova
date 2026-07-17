/**
 * @jest-environment jsdom
 */

jest.mock('obsidian', () => ({ setIcon: jest.fn() }));

describe('Unified Message System Integration', () => {
    let mockPlugin;
    let mockConversationManager;
    let chatContainer;
    let chatRenderer;

    beforeEach(() => {
        jest.useFakeTimers();

        // Reset DOM
        document.body.textContent = '';
        
        // Create chat container with Obsidian extended methods
        chatContainer = document.createElement('div');
        chatContainer.className = 'nova-chat-container';
        chatContainer.scrollTo = jest.fn();
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
            el.addClass = function(...classes) {
                this.classList.add(...classes);
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
        chatRenderer.cleanup();
        jest.clearAllTimers();
        jest.useRealTimers();
        document.head.textContent = '';
        document.body.textContent = '';
    });

	test('success acknowledgement replaces welcome, never persists, and returns to welcome after fading', () => {
        const shortMessage = '✓ Done';

        chatRenderer.addWelcomeMessage();
        expect(chatContainer.querySelectorAll('.nova-welcome')).toHaveLength(1);

        chatRenderer.addSuccessMessage(shortMessage);

        const messageEl = chatContainer.querySelector('.nova-message');
        expect(messageEl).toBeTruthy();
        expect(messageEl.classList.contains('nova-pill-success')).toBe(true);
        expect(messageEl.classList.contains('nova-message-ephemeral')).toBe(true);
        expect(messageEl.textContent).toBe(shortMessage);
        expect(chatContainer.querySelector('.nova-welcome')).toBeNull();
        expect(mockConversationManager.addSystemMessage).not.toHaveBeenCalled();

        jest.advanceTimersByTime(3000);
        expect(messageEl.classList.contains('is-fading')).toBe(true);
        jest.advanceTimersByTime(250);

        expect(chatContainer.querySelector('.nova-message')).toBeNull();
        expect(chatContainer.querySelectorAll('.nova-welcome')).toHaveLength(1);
	});

	test('welcome renders the greeting and instructions as separate hierarchy levels', () => {
		chatRenderer.addWelcomeMessage();

		expect(chatContainer.querySelector('.nova-welcome-greeting').textContent)
			.toBe("Hi! I'm Nova, your writing partner.");
		expect(chatContainer.querySelector('.nova-welcome-instructions').textContent)
			.toBe('Select text and right-click to transform it, or chat below to add content at your cursor.');
		expect(chatContainer.querySelector('.nova-welcome-text')).toBeNull();
	});

	test('legacy success acknowledgement does not restore or suppress the welcome', () => {
        mockConversationManager.getRecentMessages.mockReturnValue([
            {
                id: 'msg1',
                role: 'system',
				content: '✓ Done',
                timestamp: Date.now(),
                metadata: {
                    messageType: 'nova-pill-success',
                    source: 'chat'
                }
            }
        ]);

        chatRenderer.loadConversationHistory({ path: 'test.md', name: 'test.md' });

        expect(chatContainer.querySelector('.nova-message')).toBeNull();
        expect(chatContainer.querySelectorAll('.nova-welcome')).toHaveLength(1);
    });

    test('new success acknowledgement replaces an older transient acknowledgement', () => {
        chatRenderer.addSuccessMessage('First acknowledgement');
        chatRenderer.addSuccessMessage('Second acknowledgement');

        const transientMessages = chatContainer.querySelectorAll('.nova-message-ephemeral');
        expect(transientMessages).toHaveLength(1);
        expect(transientMessages[0].textContent).toBe('✓ Second acknowledgement');
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
        mockConversationManager.getRecentMessages.mockReturnValue([
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
        chatRenderer.loadConversationHistory({ path: 'test.md', name: 'test.md' });

        // Verify restoration maintains bubble styling
        const restoredEl = chatContainer.querySelector('.nova-message');
        expect(restoredEl).toBeTruthy();
        expect(restoredEl.classList.contains('nova-bubble-error')).toBe(true);
        expect(restoredEl.textContent).toBe('❌ ' + longError);
    });

    test('mixed conversation: regular messages and status messages', async () => {
        // Simulate a mixed conversation history
        mockConversationManager.getRecentMessages.mockReturnValue([
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

        chatRenderer.loadConversationHistory({ path: 'test.md', name: 'test.md' });

        // Check that regular messages go through addMessage
        expect(chatRenderer.addMessage).toHaveBeenCalledWith('user', 'Hello Nova');
        expect(chatRenderer.addMessage).toHaveBeenCalledWith('assistant', 'Hello! How can I help?');

        // Legacy success is skipped while the genuine error is restored.
        const statusMessages = chatContainer.querySelectorAll('.nova-message');
        expect(statusMessages.length).toBe(1);
        expect(statusMessages[0].classList.contains('nova-bubble-error')).toBe(true);
        expect(statusMessages[0].textContent).toBe('Error: Failed to process the request due to network timeout');
        expect(chatContainer.querySelector('.nova-welcome')).toBeNull();
    });

    test('success wrapper adds transient semantics to the shared success styling', () => {
        chatRenderer.addSuccessMessage('✓ Done');
        const chatMessage = chatContainer.querySelector('.nova-message');

        while (chatContainer.firstChild) {
            chatContainer.removeChild(chatContainer.firstChild);
        }
        chatRenderer.addStatusMessage('✓ Done', {
            type: 'pill',
            variant: 'success',
            persist: false
        });
        const statusMessage = chatContainer.querySelector('.nova-message');

        expect(chatMessage.classList.contains('nova-pill-success')).toBe(true);
        expect(chatMessage.classList.contains('nova-message-ephemeral')).toBe(true);
        expect(statusMessage.classList.contains('nova-pill-success')).toBe(true);
        expect(statusMessage.classList.contains('nova-message-ephemeral')).toBe(false);
    });

    test('welcome is exclusive with restored and live conversation messages', () => {
        mockConversationManager.getRecentMessages.mockReturnValue([]);
        chatRenderer.loadConversationHistory({ path: 'empty.md', name: 'empty.md' });
        expect(chatContainer.querySelectorAll('.nova-welcome')).toHaveLength(1);

        chatRenderer.addMessage('user', 'Hi');
        expect(chatContainer.querySelector('.nova-welcome')).toBeNull();
        expect(chatContainer.querySelectorAll('.nova-message')).toHaveLength(1);

        chatRenderer.clearChat(true);
        expect(chatContainer.querySelectorAll('.nova-welcome')).toHaveLength(1);
        expect(chatContainer.querySelector('.nova-message')).toBeNull();

        mockConversationManager.getRecentMessages.mockReturnValue([
            { id: 'user', role: 'user', content: 'History', timestamp: Date.now() },
            { id: 'assistant', role: 'assistant', content: 'Response', timestamp: Date.now() }
        ]);
        chatRenderer.loadConversationHistory({ path: 'history.md', name: 'history.md' });

        expect(chatContainer.querySelector('.nova-welcome')).toBeNull();
        expect(chatContainer.querySelectorAll('.nova-message')).toHaveLength(2);
    });
});
