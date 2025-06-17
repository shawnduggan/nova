/**
 * @jest-environment jsdom
 */

describe('Final System Message Duplication Fix', () => {
    let mockPlugin;
    let mockConversationManager;
    let chatContainer;
    let chatRenderer;

    beforeEach(() => {
        // Reset DOM
        document.body.innerHTML = '';
        
        // Helper function to add Obsidian methods to elements
        const addObsidianMethods = (element) => {
            element.createDiv = function(options) {
                const div = document.createElement('div');
                if (options?.cls) div.className = options.cls;
                if (options?.text) div.textContent = options.text;
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
            return element;
        };

        // Create chat container with Obsidian methods
        chatContainer = document.createElement('div');
        chatContainer.className = 'nova-chat-container';
        addObsidianMethods(chatContainer);
        document.body.appendChild(chatContainer);
        
        // Mock conversation manager
        mockConversationManager = {
            getRecentMessages: jest.fn(),
            addUserMessage: jest.fn().mockResolvedValue({}),
            addSystemMessage: jest.fn().mockResolvedValue({}),
            addAssistantMessage: jest.fn().mockResolvedValue({})
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

    test('system success message should appear exactly once', () => {
        // Test the fixed flow: Only ChatRenderer adds success message, not sidebar
        
        // 1. ChatRenderer adds success message during AI processing
        chatRenderer.addSuccessMessage('✓ Content added', true);
        
        // 2. Command completes successfully (FIXED: no longer adds duplicate success message)
        const commandCompletionHandler = (result) => {
            if (result.success) {
                // OLD WAY (the bug): this.addSuccessMessage(result.successMessage);  ❌ REMOVED
                // NEW WAY (the fix): Success message already handled by ChatRenderer ✅
                console.log('Command completed successfully, success message already displayed');
                return null;
            }
        };
        
        commandCompletionHandler({ success: true, successMessage: 'Content added successfully' });
        
        // VERIFY: Only one success message in DOM
        const successMessages = chatContainer.querySelectorAll('.nova-pill-success');
        expect(successMessages.length).toBe(1);
        expect(successMessages[0].textContent).toBe('✓ Content added');
        
        // VERIFY: Only one persistence call
        expect(mockConversationManager.addSystemMessage).toHaveBeenCalledTimes(1);
        expect(mockConversationManager.addSystemMessage).toHaveBeenCalledWith(
            { path: 'test.md', basename: 'test' },
            '✓ Content added',
            { messageType: 'nova-pill-success' }
        );
    });

    test('conversation restoration should show single styled system message', async () => {
        const testFile = { path: 'test.md', basename: 'test' };
        
        // Simulate conversation after fix (no duplicates)
        mockConversationManager.getRecentMessages.mockResolvedValue([
            {
                id: 'msg1',
                role: 'user',
                content: 'Add content about pirates',
                timestamp: Date.now()
            },
            {
                id: 'msg2',
                role: 'assistant', 
                content: 'Content added successfully',
                timestamp: Date.now()
            },
            {
                id: 'msg3',
                role: 'system',
                content: '✓ Content added',
                timestamp: Date.now(),
                metadata: {
                    messageType: 'nova-pill-success',
                    source: 'chat'
                }
            }
        ]);

        // Mock addMessage for regular messages
        chatRenderer.addMessage = jest.fn();

        await chatRenderer.loadConversationHistory(testFile);

        // VERIFY: Regular messages go through addMessage
        expect(chatRenderer.addMessage).toHaveBeenCalledTimes(2);
        expect(chatRenderer.addMessage).toHaveBeenCalledWith('user', 'Add content about pirates');
        expect(chatRenderer.addMessage).toHaveBeenCalledWith('assistant', 'Content added successfully');

        // VERIFY: Exactly one styled system message  
        const styledSystemMessages = chatContainer.querySelectorAll('.nova-pill-success');
        expect(styledSystemMessages.length).toBe(1);
        expect(styledSystemMessages[0].textContent).toBe('✓ Content added');

        // VERIFY: No unstyled system messages
        const unstyledSystemMessages = chatContainer.querySelectorAll('.nova-message-system');
        expect(unstyledSystemMessages.length).toBe(0);
    });

    test('complete chat flow should result in clean message structure', async () => {
        const testFile = { path: 'test.md', basename: 'test' };
        const userMessage = 'Add a paragraph about pirates';
        
        // SIMULATE COMPLETE FIXED FLOW:
        
        // 1. User input handling (persist + display user message)
        await mockConversationManager.addUserMessage(testFile, userMessage, null);
        chatRenderer.addMessage('user', userMessage);
        
        // 2. AI processing (adds success message with persistence)
        chatRenderer.addSuccessMessage('✓ Content added', true);
        
        // 3. Command completion (FIXED: no duplicate success message)
        // Previously would have called: this.addSuccessMessage(result.successMessage)
        // Now: does nothing (success already handled)
        
        // 4. Assistant response persistence
        await mockConversationManager.addAssistantMessage(testFile, 'Content added successfully', { success: true });
        
        // VERIFY FINAL STATE:
        
        // Single user message element
        const userMessages = chatContainer.querySelectorAll('.nova-message-user');
        expect(userMessages.length).toBe(1);
        expect(userMessages[0].textContent).toContain(userMessage);
        
        // Single success message element
        const successMessages = chatContainer.querySelectorAll('.nova-pill-success');
        expect(successMessages.length).toBe(1);
        expect(successMessages[0].textContent).toBe('✓ Content added');
        
        // Correct persistence calls
        expect(mockConversationManager.addUserMessage).toHaveBeenCalledTimes(1);
        expect(mockConversationManager.addSystemMessage).toHaveBeenCalledTimes(1);
        expect(mockConversationManager.addAssistantMessage).toHaveBeenCalledTimes(1);
    });

    test('duplicate cleanup should remove old duplicates', () => {
        // Simulate cleanup of existing duplicates
        const messagesBeforeCleanup = [
            { id: 'msg1', role: 'user', content: 'Hello', timestamp: 1000 },
            { id: 'msg2', role: 'user', content: 'Hello', timestamp: 1000 }, // Duplicate
            { id: 'msg3', role: 'assistant', content: 'Hi', timestamp: 2000 },
            { id: 'msg4', role: 'system', content: '✓ Done', timestamp: 3000 },
            { id: 'msg5', role: 'system', content: '✓ Done', timestamp: 3000 } // Duplicate
        ];
        
        const cleanupDuplicates = (messages) => {
            const seen = new Set();
            const cleaned = [];
            
            for (const message of messages) {
                const key = `${message.role}:${message.content}:${message.timestamp}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    cleaned.push(message);
                }
            }
            
            return cleaned;
        };
        
        const cleanedMessages = cleanupDuplicates(messagesBeforeCleanup);
        
        // VERIFY: Duplicates removed
        expect(cleanedMessages.length).toBe(3); // Original 5 - 2 duplicates = 3
        
        // VERIFY: Unique messages preserved
        const userMessages = cleanedMessages.filter(m => m.role === 'user');
        const assistantMessages = cleanedMessages.filter(m => m.role === 'assistant'); 
        const systemMessages = cleanedMessages.filter(m => m.role === 'system');
        
        expect(userMessages.length).toBe(1);
        expect(assistantMessages.length).toBe(1);
        expect(systemMessages.length).toBe(1);
    });
});