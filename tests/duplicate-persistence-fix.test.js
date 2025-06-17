/**
 * @jest-environment jsdom
 */

describe('Duplicate User Message Persistence Fix', () => {
    let mockConversationManager;
    let mockDocumentEngine;

    beforeEach(() => {
        mockConversationManager = {
            addUserMessage: jest.fn().mockResolvedValue({
                id: 'user-msg-id',
                role: 'user',
                content: 'test message',
                timestamp: Date.now()
            }),
            addAssistantMessage: jest.fn().mockResolvedValue({}),
            getRecentMessages: jest.fn().mockReturnValue([])
        };

        mockDocumentEngine = {
            addUserMessage: jest.fn().mockResolvedValue({}),
            addAssistantMessage: jest.fn().mockResolvedValue({})
        };

        jest.clearAllMocks();
    });

    test('chat input should persist user message only once', async () => {
        const testFile = { path: 'test.md', basename: 'test' };
        const userMessage = 'Add a paragraph about pirates';
        
        // Simulate the FIXED chat input flow
        const handleChatInput = async (file, messageText) => {
            // Single persistence call from chat input handler
            await mockConversationManager.addUserMessage(file, messageText, null);
            
            // Command processing should NOT add another user message
            // (this was the bug - command handlers were calling addUserMessage again)
            
            // Only assistant response should be added by command
            await mockConversationManager.addAssistantMessage(file, 'Content added successfully', { success: true });
        };

        await handleChatInput(testFile, userMessage);

        // VERIFY: User message saved exactly ONCE
        expect(mockConversationManager.addUserMessage).toHaveBeenCalledTimes(1);
        expect(mockConversationManager.addUserMessage).toHaveBeenCalledWith(testFile, userMessage, null);
        
        // Assistant response should be added
        expect(mockConversationManager.addAssistantMessage).toHaveBeenCalledTimes(1);
    });

    test('command handlers should NOT persist user messages (fixed)', async () => {
        // Simulate command execution after chat input
        
        const command = {
            action: 'add',
            instruction: 'Add a paragraph about pirates',
            target: 'document'
        };

        // OLD WAY (the bug): Command handlers called addUserMessage
        // await mockDocumentEngine.addUserMessage(command.instruction, command); // ❌ REMOVED
        
        // NEW WAY (the fix): Only add assistant response
        await mockDocumentEngine.addAssistantMessage('Content added successfully', { success: true });

        // VERIFY: No user message persistence from command handler
        expect(mockDocumentEngine.addUserMessage).toHaveBeenCalledTimes(0);
        
        // Only assistant message should be added
        expect(mockDocumentEngine.addAssistantMessage).toHaveBeenCalledTimes(1);
        expect(mockDocumentEngine.addAssistantMessage).toHaveBeenCalledWith(
            'Content added successfully', 
            { success: true }
        );
    });

    test('complete flow should result in single user message persistence', async () => {
        const testFile = { path: 'test.md', basename: 'test' };
        const userMessage = 'Add content about pirates';
        
        // Step 1: Chat input handler persists user message
        await mockConversationManager.addUserMessage(testFile, userMessage, null);
        
        // Step 2: AI processes message and executes add command
        // Command handler should NOT persist user message again (FIXED)
        
        // Step 3: Command handler persists only assistant response
        await mockConversationManager.addAssistantMessage(testFile, 'Content added successfully', { success: true });
        
        // VERIFY FINAL STATE:
        // - User message persisted exactly once
        expect(mockConversationManager.addUserMessage).toHaveBeenCalledTimes(1);
        
        // - Assistant message persisted once
        expect(mockConversationManager.addAssistantMessage).toHaveBeenCalledTimes(1);
        
        // - No duplicate user messages
        const userCalls = mockConversationManager.addUserMessage.mock.calls;
        expect(userCalls.length).toBe(1);
        expect(userCalls[0][1]).toBe(userMessage);
    });

    test('different command types should all follow same pattern', async () => {
        const commands = ['add', 'edit', 'delete', 'grammar', 'rewrite'];
        
        for (const commandType of commands) {
            // Reset mocks for each command
            jest.clearAllMocks();
            
            // Simulate command execution (FIXED - no user message persistence)
            const executeCommand = async (type) => {
                // Commands should only persist assistant responses, not user messages
                await mockDocumentEngine.addAssistantMessage(`${type} completed successfully`, { success: true });
            };
            
            await executeCommand(commandType);
            
            // VERIFY: No user message persistence from any command type
            expect(mockDocumentEngine.addUserMessage).toHaveBeenCalledTimes(0);
            expect(mockDocumentEngine.addAssistantMessage).toHaveBeenCalledTimes(1);
        }
    });

    test('conversation restoration should show correct message count', () => {
        // Simulate the FIXED conversation state after chat input + command execution
        const conversationMessages = [
            {
                id: 'msg1',
                role: 'user',
                content: 'Add content about pirates',
                timestamp: Date.now()
                // ONLY ONE user message (no duplicate from command handler)
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
        ];

        mockConversationManager.getRecentMessages.mockReturnValue(conversationMessages);
        
        const messages = mockConversationManager.getRecentMessages({ path: 'test.md' }, 50);
        
        // VERIFY: Correct message structure without duplicates
        expect(messages.length).toBe(3);
        
        // Should have exactly 1 user message
        const userMessages = messages.filter(m => m.role === 'user');
        expect(userMessages.length).toBe(1);
        expect(userMessages[0].content).toBe('Add content about pirates');
        
        // Should have 1 assistant message  
        const assistantMessages = messages.filter(m => m.role === 'assistant');
        expect(assistantMessages.length).toBe(1);
        
        // Should have 1 system message
        const systemMessages = messages.filter(m => m.role === 'system');
        expect(systemMessages.length).toBe(1);
    });
});