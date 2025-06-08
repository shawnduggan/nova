import { NovaSidebarView, VIEW_TYPE_NOVA_SIDEBAR } from '../../src/ui/sidebar-view';
import { WorkspaceLeaf, ButtonComponent, TextAreaComponent } from 'obsidian';
import NovaPlugin from '../../main';

// Mock the entire Obsidian module
jest.mock('obsidian');

describe('NovaSidebarView', () => {
    let sidebar: NovaSidebarView;
    let mockLeaf: WorkspaceLeaf;
    let mockPlugin: NovaPlugin;
    let mockContainer: HTMLElement;

    beforeEach(() => {
        // Setup DOM
        document.body.innerHTML = '';
        
        // Create mock container with Obsidian methods
        mockContainer = Object.assign(document.createElement('div'), {
            empty: function() { (this as any).innerHTML = ''; },
            createEl: function(tag: string, attrs?: any) {
                const el = document.createElement(tag);
                if (attrs?.text) el.textContent = attrs.text;
                if (attrs?.cls) el.className = attrs.cls;
                (this as any).appendChild(el);
                return el;
            },
            createDiv: function(attrs?: any) { return (this as any).createEl('div', attrs); },
            createSpan: function(attrs?: any) { return (this as any).createEl('span', attrs); },
            setText: function(text: string) { (this as any).textContent = text; }
        });
        
        const child1 = Object.assign(document.createElement('div'), {
            empty: function() { (this as any).innerHTML = ''; },
            createEl: function(tag: string, attrs?: any) {
                const el = document.createElement(tag);
                if (attrs?.text) el.textContent = attrs.text;
                if (attrs?.cls) el.className = attrs.cls;
                (this as any).appendChild(el);
                return el;
            },
            createDiv: function(attrs?: any) { return (this as any).createEl('div', attrs); },
            createSpan: function(attrs?: any) { return (this as any).createEl('span', attrs); },
            setText: function(text: string) { (this as any).textContent = text; }
        });
        
        const child2 = Object.assign(document.createElement('div'), {
            empty: function() { (this as any).innerHTML = ''; },
            createEl: function(tag: string, attrs?: any) {
                const el = document.createElement(tag);
                if (attrs?.text) el.textContent = attrs.text;
                if (attrs?.cls) el.className = attrs.cls;
                (this as any).appendChild(el);
                return el;
            },
            createDiv: function(attrs?: any) { return (this as any).createEl('div', attrs); },
            createSpan: function(attrs?: any) { return (this as any).createEl('span', attrs); },
            setText: function(text: string) { (this as any).textContent = text; }
        });
        
        mockContainer.appendChild(child1);
        mockContainer.appendChild(child2);
        
        // Mock leaf
        mockLeaf = new WorkspaceLeaf();
        
        // Mock plugin
        mockPlugin = {
            settings: {
                platformSettings: {
                    desktop: { primaryProvider: 'claude' },
                    mobile: { primaryProvider: 'claude' }
                }
            },
            aiProviderManager: {
                generateText: jest.fn().mockResolvedValue('AI response'),
                getCurrentProviderName: jest.fn().mockResolvedValue('Claude')
            },
            app: {
                workspace: {
                    getActiveFile: jest.fn().mockReturnValue(null),
                    on: jest.fn().mockReturnValue({ unsubscribe: jest.fn() })
                }
            }
        } as any;
        
        // Create sidebar instance
        sidebar = new NovaSidebarView(mockLeaf, mockPlugin);
        sidebar.containerEl = mockContainer;
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('View Basics', () => {
        test('should return correct view type', () => {
            expect(sidebar.getViewType()).toBe(VIEW_TYPE_NOVA_SIDEBAR);
        });

        test('should return correct display text', () => {
            expect(sidebar.getDisplayText()).toBe('Nova AI');
        });

        test('should return correct icon', () => {
            expect(sidebar.getIcon()).toBe('nova-star');
        });
    });

    describe('onOpen', () => {
        beforeEach(async () => {
            await sidebar.onOpen();
        });

        test('should create header with title and provider status', () => {
            const header = mockContainer.querySelector('.nova-header');
            expect(header).toBeTruthy();
            
            const title = header?.querySelector('h4');
            expect(title?.textContent).toBe('Nova - Your AI Thinking Partner');
            
            const providerStatus = header?.querySelector('.nova-provider-status');
            expect(providerStatus).toBeTruthy();
            expect(providerStatus?.textContent).toContain('Claude');
        });

        test('should create chat container', () => {
            const chatContainer = mockContainer.querySelector('.nova-chat-container');
            expect(chatContainer).toBeTruthy();
            expect((chatContainer as HTMLElement)?.style.overflowY).toBe('auto');
        });

        test('should create input interface', () => {
            const inputContainer = mockContainer.querySelector('.nova-input-container');
            expect(inputContainer).toBeTruthy();
            
            const textarea = inputContainer?.querySelector('textarea');
            expect(textarea).toBeTruthy();
            expect(textarea?.placeholder).toBe('Ask Nova anything...');
            
            const sendButton = inputContainer?.querySelector('button');
            expect(sendButton).toBeTruthy();
            expect(sendButton?.textContent).toBe('Send');
        });

        test('should display welcome message', () => {
            const messages = mockContainer.querySelectorAll('.nova-message');
            expect(messages.length).toBe(1);
            expect(messages[0].textContent).toContain("Hello! I'm Nova");
        });

        test('should register active-leaf-change event', () => {
            expect(mockPlugin.app.workspace.on).toHaveBeenCalledWith(
                'active-leaf-change',
                expect.any(Function)
            );
        });
    });

    describe('Message Display', () => {
        beforeEach(async () => {
            await sidebar.onOpen();
        });

        test('should add user message with correct styling', () => {
            sidebar['addMessage']('user', 'Test user message');
            
            const messages = mockContainer.querySelectorAll('.nova-message-user');
            expect(messages.length).toBe(1);
            
            const message = messages[0] as HTMLElement;
            expect(message.textContent).toContain('You');
            expect(message.textContent).toContain('Test user message');
            expect(message.style.marginLeft).toBe('auto');
        });

        test('should add assistant message with correct styling', () => {
            sidebar['addMessage']('assistant', 'Test assistant message');
            
            const messages = mockContainer.querySelectorAll('.nova-message-assistant');
            expect(messages.length).toBe(2); // Including welcome message
            
            const message = messages[1] as HTMLElement;
            expect(message.textContent).toContain('Nova');
            expect(message.textContent).toContain('Test assistant message');
        });

        test('should auto-scroll to bottom after adding message', () => {
            const chatContainer = sidebar['chatContainer'];
            const scrollTopSpy = jest.spyOn(chatContainer, 'scrollTop', 'set');
            
            sidebar['addMessage']('user', 'Test message');
            
            expect(scrollTopSpy).toHaveBeenCalled();
        });
    });

    describe('User Input Handling', () => {
        let textArea: TextAreaComponent;
        let sendButton: ButtonComponent;

        beforeEach(async () => {
            await sidebar.onOpen();
            textArea = sidebar['textArea'];
            sendButton = sidebar['sendButton'];
        });

        test('should send message on button click', async () => {
            jest.spyOn(textArea, 'getValue').mockReturnValue('Test message');
            const handleSendSpy = jest.spyOn(sidebar as any, 'handleSend');
            
            // Simulate button click
            sendButton.buttonEl.click();
            
            expect(handleSendSpy).toHaveBeenCalled();
        });

        test('should send message on Enter key', async () => {
            jest.spyOn(textArea, 'getValue').mockReturnValue('Test message');
            const handleSendSpy = jest.spyOn(sidebar as any, 'handleSend');
            
            // Simulate Enter key
            const event = new KeyboardEvent('keydown', { key: 'Enter', shiftKey: false });
            textArea.inputEl.dispatchEvent(event);
            
            expect(handleSendSpy).toHaveBeenCalled();
        });

        test('should not send message on Shift+Enter', async () => {
            const handleSendSpy = jest.spyOn(sidebar as any, 'handleSend');
            
            // Simulate Shift+Enter
            const event = new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true });
            textArea.inputEl.dispatchEvent(event);
            
            expect(handleSendSpy).not.toHaveBeenCalled();
        });

        test('should not send empty message', async () => {
            jest.spyOn(textArea, 'getValue').mockReturnValue('');
            const addMessageSpy = jest.spyOn(sidebar as any, 'addMessage');
            
            await sidebar['handleSend']();
            
            expect(addMessageSpy).not.toHaveBeenCalled();
        });

        test('should clear input after sending', async () => {
            jest.spyOn(textArea, 'getValue').mockReturnValue('Test message');
            const setValueSpy = jest.spyOn(textArea, 'setValue');
            
            await sidebar['handleSend']();
            
            expect(setValueSpy).toHaveBeenCalledWith('');
        });

        test('should disable button while sending', async () => {
            jest.spyOn(textArea, 'getValue').mockReturnValue('Test message');
            const setDisabledSpy = jest.spyOn(sendButton, 'setDisabled');
            
            await sidebar['handleSend']();
            
            expect(setDisabledSpy).toHaveBeenCalledWith(true);
            expect(setDisabledSpy).toHaveBeenLastCalledWith(false);
        });
    });

    describe('AI Integration', () => {
        beforeEach(async () => {
            await sidebar.onOpen();
            jest.spyOn(sidebar['textArea'], 'getValue').mockReturnValue('Test message');
        });

        test('should call AI provider and display response', async () => {
            await sidebar['handleSend']();
            
            expect(mockPlugin.aiProviderManager.generateText).toHaveBeenCalledWith('Test message');
            
            const messages = mockContainer.querySelectorAll('.nova-message');
            const lastMessage = messages[messages.length - 1];
            expect(lastMessage.textContent).toContain('AI response');
        });

        test('should show loading indicator during AI call', async () => {
            // Make AI call slower to check loading state
            mockPlugin.aiProviderManager.generateText = jest.fn().mockImplementation(
                () => new Promise(resolve => setTimeout(() => resolve('AI response'), 100))
            );
            
            const handleSendPromise = sidebar['handleSend']();
            
            // Check loading indicator exists
            await new Promise(resolve => setTimeout(resolve, 10));
            const loadingEl = mockContainer.querySelector('.nova-loading');
            expect(loadingEl).toBeTruthy();
            expect(loadingEl?.textContent).toBe('Nova is thinking...');
            
            await handleSendPromise;
            
            // Check loading indicator is removed
            expect(mockContainer.querySelector('.nova-loading')).toBeFalsy();
        });

        test('should handle AI errors gracefully', async () => {
            mockPlugin.aiProviderManager.generateText = jest.fn().mockRejectedValue(
                new Error('API error')
            );
            
            await sidebar['handleSend']();
            
            const messages = mockContainer.querySelectorAll('.nova-message');
            const lastMessage = messages[messages.length - 1];
            expect(lastMessage.textContent).toContain('Sorry, I encountered an error: API error');
        });

        test('should re-enable button after error', async () => {
            mockPlugin.aiProviderManager.generateText = jest.fn().mockRejectedValue(
                new Error('API error')
            );
            const setDisabledSpy = jest.spyOn(sidebar['sendButton'], 'setDisabled');
            
            await sidebar['handleSend']();
            
            expect(setDisabledSpy).toHaveBeenLastCalledWith(false);
        });
    });

    // Conversation loading tests will be added when conversation manager is integrated
    describe.skip('Conversation Loading', () => {
        // Tests skipped until conversation manager is integrated into the plugin
    });

    describe('Clear Chat Feature', () => {
        beforeEach(async () => {
            await sidebar.onOpen();
        });

        test('should clear chat when clear button is clicked', () => {
            // Add some messages first
            sidebar['addMessage']('user', 'Test message 1');
            sidebar['addMessage']('assistant', 'Test response 1');
            
            expect(mockContainer.querySelectorAll('.nova-message').length).toBeGreaterThan(1);
            
            // Click clear button
            sidebar['clearChat']();
            
            // Should only have the new welcome message
            const messages = mockContainer.querySelectorAll('.nova-message');
            expect(messages.length).toBe(1);
            expect(messages[0].textContent).toContain('Chat cleared!');
        });

        test('should show file-specific message when current file exists', () => {
            const mockFile = { basename: 'test-file' } as any;
            sidebar['currentFile'] = mockFile;
            
            sidebar['clearChat']();
            
            const messages = mockContainer.querySelectorAll('.nova-message');
            expect(messages[0].textContent).toContain('test-file');
        });
    });

    describe('Error Handling', () => {
        beforeEach(async () => {
            await sidebar.onOpen();
        });

        test('should handle undefined AI provider', async () => {
            mockPlugin.aiProviderManager = undefined as any;
            jest.spyOn(sidebar['textArea'], 'getValue').mockReturnValue('Test message');
            
            await sidebar['handleSend']();
            
            const messages = mockContainer.querySelectorAll('.nova-message');
            const lastMessage = messages[messages.length - 1];
            expect(lastMessage.textContent).toContain('Sorry, I encountered an error');
        });
    });
});