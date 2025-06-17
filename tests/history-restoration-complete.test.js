/**
 * @jest-environment jsdom
 */

describe('Complete History Restoration Flow', () => {
    let mockPlugin;
    let mockConversationManager;
    let chatContainer;
    let chatRenderer;

    beforeEach(() => {
        // Reset DOM and create chat container
        document.body.innerHTML = '';
        chatContainer = document.createElement('div');
        chatContainer.className = 'nova-chat-container';
        
        // Add Obsidian HTMLElement methods
        const addObsidianMethods = (element) => {
            element.createDiv = function(options) {
                const div = document.createElement('div');
                if (options?.cls) div.className = options.cls;
                this.appendChild(div);
                addObsidianMethods(div); // Add methods to created element
                return div;
            };
            element.createEl = function(tag, options) {
                const el = document.createElement(tag);
                if (options?.cls) el.className = options.cls;
                if (options?.text) el.textContent = options.text;
                this.appendChild(el);
                addObsidianMethods(el); // Add methods to created element
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
            addSystemMessage: jest.fn().mockResolvedValue({
                id: 'msg-id',
                role: 'system',
                content: 'test',
                timestamp: Date.now()
            })
        };

        // Mock plugin
        mockPlugin = {
            conversationManager: mockConversationManager,
            app: {
                workspace: {
                    getActiveFile: jest.fn().mockReturnValue({ path: 'test.md' })
                }
            }
        };

        // Add CSS for styling
        const style = document.createElement('style');
        style.textContent = `
            .nova-pill-success { background: green; color: #4caf50; text-align: center; }
            .nova-bubble-error { background: red; color: #7f1d1d; text-align: left; }
        `;
        document.head.appendChild(style);

        // Create ChatRenderer
        const { ChatRenderer } = require('../src/ui/chat-renderer');
        chatRenderer = new ChatRenderer(mockPlugin, chatContainer);
        
        jest.clearAllMocks();
    });

    afterEach(() => {
        document.head.innerHTML = '';
        document.body.innerHTML = '';
    });

    test('complete flow: add message -> switch file -> return -> message restored', async () => {
        const testFile1 = { path: 'file1.md', basename: 'file1' };
        const testFile2 = { path: 'file2.md', basename: 'file2' };
        
        // === Step 1: Add success message to file1 ===
        chatRenderer.addSuccessMessage('✓ Text improved', true);
        
        // Verify message appears with correct styling
        let messageEl = chatContainer.querySelector('.nova-message');
        expect(messageEl).toBeTruthy();
        expect(messageEl.classList.contains('nova-pill-success')).toBe(true);
        expect(messageEl.textContent).toBe('✓ Text improved');
        
        // Verify persistence was called
        expect(mockConversationManager.addSystemMessage).toHaveBeenCalledWith(
            { path: 'test.md' }, // Active file
            '✓ Text improved',
            { messageType: 'nova-pill-success' }
        );
        
        // === Step 2: Simulate file switch (clear chat) ===
        chatContainer.empty();
        expect(chatContainer.children.length).toBe(0);
        
        // === Step 3: Return to file1 (restore conversation) ===
        mockConversationManager.getRecentMessages.mockResolvedValue([
            {
                id: 'msg1',
                role: 'system',
                content: '✓ Text improved',
                timestamp: Date.now(),
                metadata: {
                    messageType: 'nova-pill-success',
                    source: 'selection'
                }
            }
        ]);
        
        await chatRenderer.loadConversationHistory(testFile1);
        
        // === Step 4: Verify message is restored with styling ===
        messageEl = chatContainer.querySelector('.nova-message');
        expect(messageEl).toBeTruthy();
        expect(messageEl.classList.contains('nova-pill-success')).toBe(true);
        expect(messageEl.textContent).toBe('✓ Text improved');
        
        // Verify the conversation was loaded from the right file
        expect(mockConversationManager.getRecentMessages).toHaveBeenCalledWith(testFile1, 50);
    });

    test('mixed conversation restoration includes system messages', async () => {
        const testFile = { path: 'test.md', basename: 'test' };
        
        // Mock mixed conversation with regular AND system messages
        mockConversationManager.getRecentMessages.mockResolvedValue([
            {
                id: 'msg1',
                role: 'user',
                content: 'Improve this text',
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
                content: 'I have improved your text.',
                timestamp: Date.now()
            },
            {
                id: 'msg4',
                role: 'system',
                content: 'Network error occurred while processing request',
                timestamp: Date.now(),
                metadata: {
                    messageType: 'nova-bubble-error',
                    source: 'chat'
                }
            }
        ]);

        // Mock addMessage for regular messages
        chatRenderer.addMessage = jest.fn();

        await chatRenderer.loadConversationHistory(testFile);

        // Verify regular messages go through addMessage
        expect(chatRenderer.addMessage).toHaveBeenCalledWith('user', 'Improve this text');
        expect(chatRenderer.addMessage).toHaveBeenCalledWith('assistant', 'I have improved your text.');

        // Verify system messages are restored with styling
        const systemMessages = chatContainer.querySelectorAll('.nova-message');
        expect(systemMessages.length).toBe(2);
        
        // First system message (success pill)
        expect(systemMessages[0].classList.contains('nova-pill-success')).toBe(true);
        expect(systemMessages[0].textContent).toBe('✓ Text improved');
        
        // Second system message (error bubble)
        expect(systemMessages[1].classList.contains('nova-bubble-error')).toBe(true);
        expect(systemMessages[1].textContent).toBe('Network error occurred while processing request');
    });

    test('system messages without metadata are handled normally', async () => {
        const testFile = { path: 'test.md', basename: 'test' };
        
        mockConversationManager.getRecentMessages.mockResolvedValue([
            {
                id: 'msg1',
                role: 'system',
                content: 'System message without metadata',
                timestamp: Date.now()
                // No metadata field
            }
        ]);

        chatRenderer.addMessage = jest.fn();
        await chatRenderer.loadConversationHistory(testFile);

        // Should go through regular addMessage flow
        expect(chatRenderer.addMessage).toHaveBeenCalledWith('system', 'System message without metadata');
        
        // Should not create styled system message
        const styledMessages = chatContainer.querySelectorAll('.nova-pill-success, .nova-bubble-error');
        expect(styledMessages.length).toBe(0);
    });
});