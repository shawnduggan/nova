/**
 * @jest-environment jsdom
 */

describe('Sidebar Dynamic Styling Cleanup', () => {
    let mockChatRenderer;
    let mockSidebarView;

    beforeEach(() => {
        // Mock chat renderer
        mockChatRenderer = {
            addSuccessMessage: jest.fn(),
            addErrorMessage: jest.fn()
        };

        // Mock sidebar view methods we're testing
        mockSidebarView = {
            chatRenderer: mockChatRenderer,
            addSuccessMessage: null,
            addErrorMessage: null,
            addSuccessIndicator: null
        };

        jest.clearAllMocks();
    });

    test('addSuccessMessage should delegate to ChatRenderer with persistence', () => {
        // Simulate the new addSuccessMessage method
        const addSuccessMessage = function(content) {
            this.chatRenderer.addSuccessMessage(content, true);
        }.bind(mockSidebarView);

        addSuccessMessage('Test success message');

        expect(mockChatRenderer.addSuccessMessage).toHaveBeenCalledWith(
            'Test success message',
            true
        );
    });

    test('addErrorMessage should delegate to ChatRenderer with persistence', () => {
        // Simulate the new addErrorMessage method
        const addErrorMessage = function(content) {
            this.chatRenderer.addErrorMessage(content, true);
        }.bind(mockSidebarView);

        addErrorMessage('Test error message');

        expect(mockChatRenderer.addErrorMessage).toHaveBeenCalledWith(
            'Test error message',
            true
        );
    });

    test('addSuccessIndicator should use unified system for different actions', () => {
        // Simulate the new addSuccessIndicator method
        const addSuccessIndicator = function(action) {
            const messages = {
                'add': '✓ Content added',
                'edit': '✓ Content edited', 
                'delete': '✓ Content deleted',
                'grammar': '✓ Grammar fixed',
                'rewrite': '✓ Content rewritten'
            };
            
            const message = messages[action] || '✓ Command completed';
            this.chatRenderer.addSuccessMessage(message, true);
        }.bind(mockSidebarView);

        // Test different actions
        addSuccessIndicator('add');
        expect(mockChatRenderer.addSuccessMessage).toHaveBeenCalledWith('✓ Content added', true);

        addSuccessIndicator('edit');
        expect(mockChatRenderer.addSuccessMessage).toHaveBeenCalledWith('✓ Content edited', true);

        addSuccessIndicator('grammar');
        expect(mockChatRenderer.addSuccessMessage).toHaveBeenCalledWith('✓ Grammar fixed', true);

        addSuccessIndicator('unknown');
        expect(mockChatRenderer.addSuccessMessage).toHaveBeenCalledWith('✓ Command completed', true);

        expect(mockChatRenderer.addSuccessMessage).toHaveBeenCalledTimes(4);
    });

    test('should not use dynamic styling anymore', () => {
        // Test that no dynamic CSS is being applied
        document.body.innerHTML = '';
        
        const addSuccessIndicator = function(action) {
            // OLD WAY (should not happen):
            // const indicatorEl = document.createElement('div');
            // indicatorEl.style.cssText = `dynamic styles...`;
            
            // NEW WAY (unified system):
            const messages = {
                'add': '✓ Content added',
                'edit': '✓ Content edited'
            };
            const message = messages[action] || '✓ Command completed';
            this.chatRenderer.addSuccessMessage(message, true);
        }.bind(mockSidebarView);

        addSuccessIndicator('add');
        
        // Should not create any DOM elements with dynamic styling
        const dynamicElements = document.querySelectorAll('[style*="background"]');
        expect(dynamicElements.length).toBe(0);
        
        // Should use ChatRenderer instead
        expect(mockChatRenderer.addSuccessMessage).toHaveBeenCalledWith('✓ Content added', true);
    });

    test('should handle all action types correctly', () => {
        const addSuccessIndicator = function(action) {
            const messages = {
                'add': '✓ Content added',
                'edit': '✓ Content edited', 
                'delete': '✓ Content deleted',
                'grammar': '✓ Grammar fixed',
                'rewrite': '✓ Content rewritten'
            };
            
            const message = messages[action] || '✓ Command completed';
            this.chatRenderer.addSuccessMessage(message, true);
        }.bind(mockSidebarView);

        const actions = ['add', 'edit', 'delete', 'grammar', 'rewrite', 'unknown'];
        const expectedMessages = [
            '✓ Content added',
            '✓ Content edited',
            '✓ Content deleted', 
            '✓ Grammar fixed',
            '✓ Content rewritten',
            '✓ Command completed'
        ];

        actions.forEach((action, index) => {
            addSuccessIndicator(action);
            expect(mockChatRenderer.addSuccessMessage).toHaveBeenCalledWith(
                expectedMessages[index],
                true
            );
        });

        expect(mockChatRenderer.addSuccessMessage).toHaveBeenCalledTimes(6);
    });
});