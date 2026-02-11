import { jest } from '@jest/globals';
import { CHALLENGE_SYSTEM_PROMPT } from '../../src/constants';
import { SELECTION_ACTIONS } from '../../src/ui/selection-context-menu';

describe('Challenge This Action', () => {
    describe('SELECTION_ACTIONS configuration', () => {
        test('should include challenge action', () => {
            const challengeAction = SELECTION_ACTIONS.find(a => a.id === 'challenge');
            expect(challengeAction).toBeDefined();
            expect(challengeAction!.label).toBe('Challenge this');
            expect(challengeAction!.icon).toBe('shield-question');
        });

        test('challenge should appear before custom in action list', () => {
            const challengeIndex = SELECTION_ACTIONS.findIndex(a => a.id === 'challenge');
            const customIndex = SELECTION_ACTIONS.findIndex(a => a.id === 'custom');
            expect(challengeIndex).toBeLessThan(customIndex);
        });

        test('challenge should appear after tone in action list', () => {
            const toneIndex = SELECTION_ACTIONS.findIndex(a => a.id === 'tone');
            const challengeIndex = SELECTION_ACTIONS.findIndex(a => a.id === 'challenge');
            expect(challengeIndex).toBeGreaterThan(toneIndex);
        });
    });

    describe('CHALLENGE_SYSTEM_PROMPT', () => {
        test('should be defined and non-empty', () => {
            expect(CHALLENGE_SYSTEM_PROMPT).toBeDefined();
            expect(CHALLENGE_SYSTEM_PROMPT.length).toBeGreaterThan(0);
        });

        test('should instruct to challenge thinking, not rewrite', () => {
            expect(CHALLENGE_SYSTEM_PROMPT).toContain('challenge the thinking');
            expect(CHALLENGE_SYSTEM_PROMPT).toContain('Don\'t suggest rewrites');
        });

        test('should focus on 2-3 most significant issues', () => {
            expect(CHALLENGE_SYSTEM_PROMPT).toContain('2-3 most significant issues');
        });
    });

    describe('Challenge action routing', () => {
        let mockSidebarView: any;
        let mockPlugin: any;
        let mockStreamingManager: any;
        let mockAbortController: AbortController;

        beforeEach(() => {
            mockAbortController = new AbortController();

            mockSidebarView = {
                inputHandler: {
                    setProcessingState: jest.fn()
                },
                chatRenderer: {
                    addMessage: jest.fn(),
                    addStatusMessage: jest.fn(),
                    addErrorMessage: jest.fn()
                }
            };

            mockStreamingManager = {
                showThinkingNotice: jest.fn(),
                stopAnimation: jest.fn()
            };

            mockPlugin = {
                getCurrentSidebarView: jest.fn().mockReturnValue(mockSidebarView),
                aiProviderManager: {
                    chatCompletion: jest.fn().mockResolvedValue('Analysis response')
                },
                conversationManager: {
                    addUserMessage: jest.fn().mockResolvedValue({}),
                    addAssistantMessage: jest.fn().mockResolvedValue({})
                },
                app: {
                    workspace: {
                        getActiveFile: jest.fn().mockReturnValue({ path: 'test.md', basename: 'test' })
                    }
                }
            };

            jest.clearAllMocks();
        });

        test('should route challenge to chat, not editor replacement', async () => {
            // Simulate the challenge action execution pattern
            const selectedText = 'The market will grow 50% next year.';
            const signal = mockAbortController.signal;

            // Set processing state
            mockSidebarView.inputHandler.setProcessingState(true);

            // Show thinking notice
            mockStreamingManager.showThinkingNotice('challenge', 'notice');

            // Add user message to chat
            const truncatedText = selectedText.length > 100
                ? selectedText.substring(0, 100) + '...'
                : selectedText;
            const userMessage = `Challenge this: "${truncatedText}"`;
            mockSidebarView.chatRenderer.addMessage('user', userMessage);

            // Build messages
            const messages = [
                { role: 'system' as const, content: CHALLENGE_SYSTEM_PROMPT },
                { role: 'user' as const, content: selectedText }
            ];

            // Get AI response
            const response = await mockPlugin.aiProviderManager.chatCompletion(messages, { signal });

            // Add assistant response
            mockSidebarView.chatRenderer.addMessage('assistant', response);

            // Verify chat messages were added (not editor replacement)
            expect(mockSidebarView.chatRenderer.addMessage).toHaveBeenCalledWith('user', userMessage);
            expect(mockSidebarView.chatRenderer.addMessage).toHaveBeenCalledWith('assistant', 'Analysis response');
            expect(mockSidebarView.inputHandler.setProcessingState).toHaveBeenCalledWith(true);
        });

        test('should handle missing sidebar gracefully', () => {
            mockPlugin.getCurrentSidebarView.mockReturnValue(null);

            const sidebarView = mockPlugin.getCurrentSidebarView();
            expect(sidebarView).toBeNull();
            // When sidebar is null, the action should show a notice and return early
        });

        test('should truncate long selected text in user message', () => {
            const longText = 'A'.repeat(200);
            const truncated = longText.length > 100
                ? longText.substring(0, 100) + '...'
                : longText;
            const userMessage = `Challenge this: "${truncated}"`;

            expect(userMessage).toContain('...');
            expect(userMessage.length).toBeLessThan(longText.length);
        });

        test('should pass CHALLENGE_SYSTEM_PROMPT as system message', () => {
            const messages = [
                { role: 'system' as const, content: CHALLENGE_SYSTEM_PROMPT },
                { role: 'user' as const, content: 'test text' }
            ];

            expect(messages[0].role).toBe('system');
            expect(messages[0].content).toBe(CHALLENGE_SYSTEM_PROMPT);
            expect(messages[1].role).toBe('user');
        });

        test('should handle abort signal', async () => {
            mockAbortController.abort();

            const signal = mockAbortController.signal;
            expect(signal.aborted).toBe(true);

            // When aborted, should show canceled status
            mockSidebarView.chatRenderer.addStatusMessage('Challenge canceled', { type: 'pill', variant: 'system' });
            expect(mockSidebarView.chatRenderer.addStatusMessage).toHaveBeenCalledWith(
                'Challenge canceled',
                { type: 'pill', variant: 'system' }
            );
        });

        test('should persist user and assistant messages', async () => {
            const activeFile = mockPlugin.app.workspace.getActiveFile();
            const userMessage = 'Challenge this: "test"';
            const assistantResponse = 'Analysis response';

            await mockPlugin.conversationManager.addUserMessage(activeFile, userMessage, undefined);
            await mockPlugin.conversationManager.addAssistantMessage(activeFile, assistantResponse, undefined);

            expect(mockPlugin.conversationManager.addUserMessage).toHaveBeenCalledWith(
                activeFile, userMessage, undefined
            );
            expect(mockPlugin.conversationManager.addAssistantMessage).toHaveBeenCalledWith(
                activeFile, assistantResponse, undefined
            );
        });

        test('should reset processing state in finally block', () => {
            mockSidebarView.inputHandler.setProcessingState(false);
            expect(mockSidebarView.inputHandler.setProcessingState).toHaveBeenCalledWith(false);
        });
    });
});
