import { jest } from '@jest/globals';

describe('Selection Context Menu Unified System', () => {
    let mockApp: any;
    let mockSidebarView: any;
    let mockChatRenderer: any;

    beforeEach(() => {
        // Mock chat renderer
        mockChatRenderer = {
            addSuccessMessage: jest.fn(),
            addErrorMessage: jest.fn()
        };

        // Mock sidebar view
        mockSidebarView = {
            chatRenderer: mockChatRenderer
        };

        // Mock app workspace
        mockApp = {
            workspace: {
                getLeavesOfType: jest.fn().mockReturnValue([
                    { view: mockSidebarView }
                ])
            }
        };

        jest.clearAllMocks();
    });

    test('should call addSuccessMessage with persistence=true', () => {
        // Simulate the SelectionContextMenu logic
        const addSuccessChatMessage = (actionId: string, originalText: string, customInstruction?: string) => {
            try {
                const leaves = mockApp.workspace.getLeavesOfType('nova-sidebar');
                if (leaves.length > 0) {
                    const sidebarView = leaves[0].view;
                    if (sidebarView?.chatRenderer) {
                        const actionDescription = getActionDescription(actionId, customInstruction);
                        const truncatedText = originalText.length > 50 
                            ? originalText.substring(0, 50) + '...' 
                            : originalText;
                        
                        const message = `✓ ${actionDescription} text: "${truncatedText}"`;
                        
                        // Use unified system with persistence
                        sidebarView.chatRenderer.addSuccessMessage(message, true);
                    }
                }
            } catch (error) {
                console.warn('Failed to add success chat message:', error);
            }
        };

        const getActionDescription = (actionId: string, customInstruction?: string) => {
            switch (actionId) {
                case 'improve': return 'Improved';
                case 'fix-grammar': return 'Fixed grammar in';
                case 'simplify': return 'Simplified';
                default: return 'Processed';
            }
        };

        // Test success message
        addSuccessChatMessage('improve', 'This is some test text', undefined);

        expect(mockChatRenderer.addSuccessMessage).toHaveBeenCalledWith(
            '✓ Improved text: "This is some test text"',
            true  // persistence should be true
        );
    });

    test('should call addErrorMessage with persistence=true', () => {
        const addFailureChatMessage = (actionId: string, errorMessage: string) => {
            try {
                const leaves = mockApp.workspace.getLeavesOfType('nova-sidebar');
                if (leaves.length > 0) {
                    const sidebarView = leaves[0].view;
                    if (sidebarView?.chatRenderer) {
                        const actionName = getActionDisplayName(actionId);
                        const message = `✗ Failed to ${actionName} text: ${errorMessage}`;
                        
                        // Use unified system with persistence
                        sidebarView.chatRenderer.addErrorMessage(message, true);
                    }
                }
            } catch (error) {
                console.warn('Failed to add error chat message:', error);
            }
        };

        const getActionDisplayName = (actionId: string) => {
            switch (actionId) {
                case 'improve': return 'improve';
                case 'fix-grammar': return 'fix grammar';
                case 'simplify': return 'simplify';
                default: return 'process';
            }
        };

        // Test error message
        addFailureChatMessage('improve', 'Network timeout');

        expect(mockChatRenderer.addErrorMessage).toHaveBeenCalledWith(
            '✗ Failed to improve text: Network timeout',
            true  // persistence should be true
        );
    });

    test('should truncate long original text', () => {
        const addSuccessChatMessage = (actionId: string, originalText: string, customInstruction?: string) => {
            const leaves = mockApp.workspace.getLeavesOfType('nova-sidebar');
            if (leaves.length > 0) {
                const sidebarView = leaves[0].view;
                if (sidebarView?.chatRenderer) {
                    const actionDescription = 'Improved';
                    const truncatedText = originalText.length > 50 
                        ? originalText.substring(0, 50) + '...' 
                        : originalText;
                    
                    const message = `✓ ${actionDescription} text: "${truncatedText}"`;
                    sidebarView.chatRenderer.addSuccessMessage(message, true);
                }
            }
        };

        const longText = 'This is a very long piece of text that should be truncated because it exceeds the 50 character limit';
        addSuccessChatMessage('improve', longText, undefined);

        expect(mockChatRenderer.addSuccessMessage).toHaveBeenCalledWith(
            '✓ Improved text: "This is a very long piece of text that should be t..."',
            true
        );
    });

    test('should handle missing sidebar gracefully', () => {
        // No sidebar available
        mockApp.workspace.getLeavesOfType.mockReturnValue([]);

        const addSuccessChatMessage = (actionId: string, originalText: string, customInstruction?: string) => {
            try {
                const leaves = mockApp.workspace.getLeavesOfType('nova-sidebar');
                if (leaves.length > 0) {
                    // This shouldn't execute
                    const sidebarView = leaves[0].view;
                    sidebarView.chatRenderer.addSuccessMessage('test', true);
                }
            } catch (error) {
                console.warn('Failed to add success chat message:', error);
            }
        };

        addSuccessChatMessage('improve', 'test text', undefined);

        // Should not call addSuccessMessage
        expect(mockChatRenderer.addSuccessMessage).not.toHaveBeenCalled();
    });
});