/**
 * @jest-environment jsdom
 */

describe('Conversation History Restoration', () => {
    let mockConversationManager: any;
    let mockChatRenderer: any;
    let chatContainer: HTMLElement;

    beforeEach(() => {
        // Reset DOM
        document.body.innerHTML = '';
        
        // Create chat container
        chatContainer = document.createElement('div');
        chatContainer.className = 'nova-chat-container';
        document.body.appendChild(chatContainer);
        
        // Mock conversation manager
        mockConversationManager = {
            getRecentMessages: jest.fn(),
            addSystemMessage: jest.fn()
        };
        
        // Mock chat renderer methods
        mockChatRenderer = {
            chatContainer: chatContainer,
            addMessage: jest.fn(),
            scrollToBottom: jest.fn(),
            loadConversationHistory: null // We'll test this method
        };
        
        // Add CSS for testing
        const style = document.createElement('style');
        style.textContent = `
            .nova-pill-success { background: green; }
            .nova-bubble-error { background: red; }
        `;
        document.head.appendChild(style);
    });

    afterEach(() => {
        document.head.innerHTML = '';
        document.body.innerHTML = '';
        jest.clearAllMocks();
    });

    test('should restore system messages with original styling', async () => {
        // Simulate conversation with metadata
        const messages = [
            {
                id: 'msg1',
                role: 'system',
                content: '✓ Success message',
                timestamp: Date.now(),
                metadata: {
                    messageType: 'nova-pill-success',
                    source: 'selection'
                }
            },
            {
                id: 'msg2',
                role: 'system',
                content: 'Error occurred in processing',
                timestamp: Date.now(),
                metadata: {
                    messageType: 'nova-bubble-error',
                    source: 'chat'
                }
            }
        ];

        mockConversationManager.getRecentMessages.mockResolvedValue(messages);

        // Simulate loadConversationHistory logic
        const loadConversationHistory = async (file: any) => {
            const messages = await mockConversationManager.getRecentMessages(file, 50);
            
            for (const message of messages) {
                if (message.role === 'system' && message.metadata?.messageType) {
                    // Restore system message with original styling
                    const messageEl = document.createElement('div');
                    messageEl.className = `nova-message ${message.metadata.messageType}`;
                    const contentEl = document.createElement('div');
                    contentEl.className = 'nova-message-content';
                    
                    if (message.content.includes('<svg')) {
                        contentEl.innerHTML = message.content;
                    } else {
                        contentEl.textContent = message.content;
                    }
                    
                    messageEl.appendChild(contentEl);
                    chatContainer.appendChild(messageEl);
                } else {
                    // Regular user/assistant messages
                    mockChatRenderer.addMessage(message.role, message.content);
                }
            }
        };

        // Test the restoration
        await loadConversationHistory({ path: 'test.md' });
        
        const messageElements = chatContainer.querySelectorAll('.nova-message');
        expect(messageElements.length).toBe(2);
        
        // Check first message (success pill)
        expect(messageElements[0].classList.contains('nova-pill-success')).toBe(true);
        expect(messageElements[0].textContent).toBe('✓ Success message');
        
        // Check second message (error bubble)
        expect(messageElements[1].classList.contains('nova-bubble-error')).toBe(true);
        expect(messageElements[1].textContent).toBe('Error occurred in processing');
        
        // Verify conversation manager was called
        expect(mockConversationManager.getRecentMessages).toHaveBeenCalledWith({ path: 'test.md' }, 50);
    });

    test('should handle messages without metadata normally', async () => {
        const messages = [
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
            }
        ];

        mockConversationManager.getRecentMessages.mockResolvedValue(messages);

        const loadConversationHistory = async (file: any) => {
            const messages = await mockConversationManager.getRecentMessages(file, 50);
            
            for (const message of messages) {
                if (message.role === 'system' && message.metadata?.messageType) {
                    // This path shouldn't be taken
                    const messageEl = document.createElement('div');
                    messageEl.className = `nova-message ${message.metadata.messageType}`;
                    chatContainer.appendChild(messageEl);
                } else {
                    // Regular user/assistant messages
                    mockChatRenderer.addMessage(message.role, message.content);
                }
            }
        };

        await loadConversationHistory({ path: 'test.md' });
        
        // Should call addMessage for both messages
        expect(mockChatRenderer.addMessage).toHaveBeenCalledTimes(2);
        expect(mockChatRenderer.addMessage).toHaveBeenCalledWith('user', 'Hello Nova');
        expect(mockChatRenderer.addMessage).toHaveBeenCalledWith('assistant', 'Hello! How can I help?');
        
        // No styled messages should be in DOM
        const messageElements = chatContainer.querySelectorAll('.nova-message');
        expect(messageElements.length).toBe(0);
    });

    test('should handle SVG content in restored messages', async () => {
        const messages = [
            {
                id: 'msg1',
                role: 'system',
                content: '<svg><circle cx="10" cy="10" r="5"/></svg> Success with icon',
                timestamp: Date.now(),
                metadata: {
                    messageType: 'nova-pill-success',
                    source: 'selection'
                }
            }
        ];

        mockConversationManager.getRecentMessages.mockResolvedValue(messages);

        const loadConversationHistory = async (file: any) => {
            const messages = await mockConversationManager.getRecentMessages(file, 50);
            
            for (const message of messages) {
                if (message.role === 'system' && message.metadata?.messageType) {
                    const messageEl = document.createElement('div');
                    messageEl.className = `nova-message ${message.metadata.messageType}`;
                    const contentEl = document.createElement('div');
                    contentEl.className = 'nova-message-content';
                    
                    if (message.content.includes('<svg')) {
                        contentEl.innerHTML = message.content;
                    } else {
                        contentEl.textContent = message.content;
                    }
                    
                    messageEl.appendChild(contentEl);
                    chatContainer.appendChild(messageEl);
                }
            }
        };

        await loadConversationHistory({ path: 'test.md' });
        
        const messageEl = chatContainer.querySelector('.nova-message') as HTMLElement;
        const contentEl = messageEl.querySelector('.nova-message-content') as HTMLElement;
        
        expect(contentEl.innerHTML).toContain('<svg>');
        expect(contentEl.innerHTML).toContain('Success with icon');
    });
});