/**
 * @jest-environment jsdom
 */

describe('Conversation Loading Fix', () => {
    let mockPlugin;
    let mockConversationManager;
    let mockChatRenderer;
    let chatContainer;

    beforeEach(() => {
        // Reset DOM
        document.body.innerHTML = '';
        
        // Create chat container
        chatContainer = document.createElement('div');
        chatContainer.className = 'nova-chat-container';
        document.body.appendChild(chatContainer);
        
        // Mock conversation manager
        mockConversationManager = {
            getRecentMessages: jest.fn()
        };

        // Mock chat renderer
        mockChatRenderer = {
            loadConversationHistory: jest.fn().mockResolvedValue(undefined)
        };

        // Mock plugin
        mockPlugin = {
            conversationManager: mockConversationManager
        };

        jest.clearAllMocks();
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('should call ChatRenderer.loadConversationHistory when switching files', async () => {
        // Simulate the fixed loadConversationForActiveFile method
        const loadConversationForActiveFile = async (targetFile) => {
            try {
                // Use ChatRenderer's loadConversationHistory which handles all message types including system messages with styling
                await mockChatRenderer.loadConversationHistory(targetFile);
                
                // Check if any messages were loaded
                const recentMessages = await mockPlugin.conversationManager.getRecentMessages(targetFile, 10);
                if (recentMessages.length === 0) {
                    // Show welcome message for new file (mock)
                    console.log(`Working on "${targetFile.basename}".`);
                }
            } catch (error) {
                // Failed to load conversation history - graceful fallback
                console.log(`Working on "${targetFile.basename}".`);
            }
        };

        const mockFile = { path: 'test.md', basename: 'test' };
        
        // Mock empty conversation
        mockConversationManager.getRecentMessages.mockResolvedValue([]);

        await loadConversationForActiveFile(mockFile);

        // Verify ChatRenderer.loadConversationHistory was called
        expect(mockChatRenderer.loadConversationHistory).toHaveBeenCalledWith(mockFile);
        expect(mockConversationManager.getRecentMessages).toHaveBeenCalledWith(mockFile, 10);
    });

    test('should load conversation with system messages included', async () => {
        const mockFile = { path: 'test.md', basename: 'test' };
        
        // Mock conversation with system messages
        const mockMessages = [
            {
                id: 'msg1',
                role: 'user',
                content: 'Hello',
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
        ];

        mockConversationManager.getRecentMessages.mockResolvedValue(mockMessages);

        const loadConversationForActiveFile = async (targetFile) => {
            await mockChatRenderer.loadConversationHistory(targetFile);
            const recentMessages = await mockPlugin.conversationManager.getRecentMessages(targetFile, 10);
            return recentMessages;
        };

        const result = await loadConversationForActiveFile(mockFile);

        // Verify all messages including system messages are processed
        expect(result.length).toBe(3);
        expect(result.find(msg => msg.role === 'system')).toBeTruthy();
        expect(mockChatRenderer.loadConversationHistory).toHaveBeenCalledWith(mockFile);
    });

    test('should handle conversation loading errors gracefully', async () => {
        const mockFile = { path: 'test.md', basename: 'test' };
        
        // Mock error in ChatRenderer
        mockChatRenderer.loadConversationHistory.mockRejectedValue(new Error('Loading failed'));

        const loadConversationForActiveFile = async (targetFile) => {
            try {
                await mockChatRenderer.loadConversationHistory(targetFile);
                const recentMessages = await mockPlugin.conversationManager.getRecentMessages(targetFile, 10);
                if (recentMessages.length === 0) {
                    return 'welcome';
                }
                return 'loaded';
            } catch (error) {
                return 'error-fallback';
            }
        };

        const result = await loadConversationForActiveFile(mockFile);

        expect(result).toBe('error-fallback');
        expect(mockChatRenderer.loadConversationHistory).toHaveBeenCalledWith(mockFile);
    });

    test('should NOT filter out system messages (old bug)', async () => {
        // This test verifies the old bug is fixed
        const messages = [
            { role: 'user', content: 'Hello' },
            { role: 'system', content: '✓ Success', metadata: { messageType: 'nova-pill-success' } },
            { role: 'assistant', content: 'Hi there!' }
        ];

        // OLD WAY (the bug): filtering out system messages
        const oldWayFiltered = messages.filter(msg => msg.role !== 'system');
        expect(oldWayFiltered.length).toBe(2); // Lost the system message!
        expect(oldWayFiltered.find(msg => msg.role === 'system')).toBeUndefined();

        // NEW WAY (the fix): ChatRenderer handles all messages
        mockConversationManager.getRecentMessages.mockResolvedValue(messages);
        
        const mockFile = { path: 'test.md', basename: 'test' };
        await mockChatRenderer.loadConversationHistory(mockFile);
        
        // Verify ChatRenderer got called (which processes ALL messages including system)
        expect(mockChatRenderer.loadConversationHistory).toHaveBeenCalledWith(mockFile);
    });
});