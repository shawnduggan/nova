import { PromptBuilder } from '../../src/core/prompt-builder';
import { DocumentEngine } from '../../src/core/document-engine';
import { ConversationManager } from '../../src/core/conversation-manager';
import { TFile } from 'obsidian';
import { EditCommand, DocumentContext, ConversationMessage } from '../../src/core/types';

// Mock the dependencies
jest.mock('../../src/core/document-engine');
jest.mock('../../src/core/conversation-manager');

describe('PromptBuilder', () => {
    let promptBuilder: PromptBuilder;
    let mockDocumentEngine: jest.Mocked<DocumentEngine>;
    let mockConversationManager: jest.Mocked<ConversationManager>;
    let mockFile: TFile;

    beforeEach(() => {
        mockDocumentEngine = new DocumentEngine(null as any) as jest.Mocked<DocumentEngine>;
        mockConversationManager = new ConversationManager(null as any) as jest.Mocked<ConversationManager>;
        promptBuilder = new PromptBuilder(mockDocumentEngine, mockConversationManager);

        mockFile = new TFile();
        
        // Setup default mock responses
        mockDocumentEngine.getDocumentContext.mockResolvedValue({
            file: mockFile,
            filename: 'test',
            content: '# Test Document\n\nThis is a test document.',
            headings: [{ text: 'Test Document', level: 1, line: 0, position: { start: 0, end: 15 } }],
            selectedText: undefined,
            surroundingLines: undefined
        });
        mockDocumentEngine.getDocumentContent.mockResolvedValue('# Test Document\n\nThis is a test document.');
        (mockConversationManager.getRecentMessages as jest.Mock).mockResolvedValue([]);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('buildPromptForMessage', () => {
        test('should build command prompt for command messages', async () => {
            const prompt = await promptBuilder.buildPromptForMessage('add a section about testing', mockFile);

            expect(prompt.systemPrompt).toContain('You are Nova');
            expect(prompt.systemPrompt).toContain('TASK: Add new content');
            expect(prompt.userPrompt).toContain('add a section about testing');
            expect(prompt.userPrompt).toContain('Test Document');
        });

        test('should build conversation prompt for non-command messages', async () => {
            const prompt = await promptBuilder.buildPromptForMessage('What is this document about?', mockFile);

            expect(prompt.systemPrompt).toContain('You are Nova');
            expect(prompt.systemPrompt).toContain('AI writing partner');
            expect(prompt.userPrompt).toContain('What is this document about?');
        });

        test('should handle messages without file context', async () => {
            const prompt = await promptBuilder.buildPromptForMessage('What is the weather today?');

            expect(prompt.systemPrompt).toContain('You are Nova');
            expect(prompt.userPrompt).toBe('What is the weather today?');
            expect(prompt.context).toBe('');
        });
    });

    describe('buildCommandPrompt', () => {
        test('should build prompt for add command', async () => {
            const command: EditCommand = {
                action: 'add',
                target: 'section',
                instruction: 'add a section about testing',
                location: 'Testing',
                context: undefined
            };

            const prompt = await promptBuilder.buildCommandPrompt(command, mockFile);

            expect(prompt.systemPrompt).toContain('TASK: Add new content');
            expect(prompt.userPrompt).toContain('add a section about testing');
            expect(prompt.userPrompt).toContain('DOCUMENT: test');
            expect(mockDocumentEngine.getDocumentContext).toHaveBeenCalled();
        });

        test('should build prompt for edit command with selection', async () => {
            mockDocumentEngine.getDocumentContext.mockResolvedValue({
                file: mockFile,
                filename: 'test',
                content: '# Test Document\n\nThis is a test document.',
                headings: [{ text: 'Test Document', level: 1, line: 0, position: { start: 0, end: 15 } }],
                selectedText: 'Selected text content',
                surroundingLines: undefined
            });
            
            const command: EditCommand = {
                action: 'edit',
                target: 'selection',
                instruction: 'improve this text',
                location: undefined,
                context: undefined
            };

            const prompt = await promptBuilder.buildCommandPrompt(command, mockFile);

            expect(prompt.systemPrompt).toContain('TASK: Edit and improve');
            expect(prompt.userPrompt).toContain('SELECTED TEXT:\nSelected text content');
        });

        test('should include conversation history when requested', async () => {
            const mockHistory: ConversationMessage[] = [
                { id: '1', role: 'user', content: 'Previous question', timestamp: Date.now() },
                { id: '2', role: 'assistant', content: 'Previous answer', timestamp: Date.now() }
            ];
            (mockConversationManager.getRecentMessages as jest.Mock).mockResolvedValue(mockHistory);

            const command: EditCommand = {
                action: 'add',
                target: 'document',
                instruction: 'add more content',
                location: undefined,
                context: undefined
            };

            const prompt = await promptBuilder.buildCommandPrompt(command, mockFile, { includeHistory: true });

            expect(prompt.userPrompt).toContain('RECENT CONVERSATION:');
            expect(prompt.userPrompt).toContain('You: Previous question');
            expect(prompt.userPrompt).toContain('Nova: Previous answer');
            expect(mockConversationManager.getRecentMessages).toHaveBeenCalledWith(mockFile, 5);
        });

        test('should throw error when file is not provided', async () => {
            const command: EditCommand = {
                action: 'add',
                target: 'document',
                instruction: 'add content',
                location: undefined,
                context: undefined
            };

            await expect(promptBuilder.buildCommandPrompt(command)).rejects.toThrow('File is required for command prompts');
        });
    });

    describe('buildConversationPrompt', () => {
        test('should build conversation prompt with document context', async () => {
            const prompt = await promptBuilder.buildConversationPrompt('What is this document about?', mockFile);

            expect(prompt.systemPrompt).toContain('AI writing partner');
            expect(prompt.userPrompt).toContain('Current document: test');
            expect(prompt.userPrompt).toContain('Document structure:');
            expect(prompt.userPrompt).toContain('What is this document about?');
        });

        test('should build conversation prompt without file context', async () => {
            const prompt = await promptBuilder.buildConversationPrompt('General question');

            expect(prompt.systemPrompt).toContain('AI writing partner');
            expect(prompt.userPrompt).toBe('General question');
            expect(prompt.context).toBe('');
        });

        test('should include recent conversation history', async () => {
            const mockHistory: ConversationMessage[] = [
                { id: '1', role: 'user', content: 'First message', timestamp: Date.now() },
                { id: '2', role: 'assistant', content: 'First response', timestamp: Date.now() }
            ];
            (mockConversationManager.getRecentMessages as jest.Mock).mockResolvedValue(mockHistory);

            const prompt = await promptBuilder.buildConversationPrompt('Follow-up question', mockFile);

            expect(prompt.userPrompt).toContain('Recent conversation:');
            expect(prompt.userPrompt).toContain('You: First message');
            expect(prompt.userPrompt).toContain('Nova: First response');
        });
    });

    describe('buildSimplePrompt', () => {
        test('should build simple prompt without context', () => {
            const prompt = promptBuilder.buildSimplePrompt('Simple instruction');

            expect(prompt.systemPrompt).toContain('You are Nova');
            expect(prompt.userPrompt).toBe('Simple instruction');
            expect(prompt.context).toBe('');
        });

        test('should build simple prompt with context', () => {
            const prompt = promptBuilder.buildSimplePrompt('Simple instruction', 'Some context');

            expect(prompt.userPrompt).toBe('Context: Some context\n\nRequest: Simple instruction');
            expect(prompt.context).toBe('Some context');
        });
    });

    describe('buildQuickPrompt', () => {
        test('should build quick prompt with file context', async () => {
            const prompt = await promptBuilder.buildQuickPrompt('grammar', 'fix grammar errors', mockFile);

            expect(prompt.systemPrompt).toContain('TASK: Fix grammar');
            expect(prompt.userPrompt).toContain('fix grammar errors');
            expect(mockDocumentEngine.getDocumentContext).toHaveBeenCalled();
        });

        test('should build quick prompt without file context', async () => {
            const prompt = await promptBuilder.buildQuickPrompt('grammar', 'fix grammar errors');

            expect(prompt.systemPrompt).toContain('You are Nova');
            expect(prompt.userPrompt).toBe('fix grammar errors');
        });
    });

    describe('buildCustomPrompt', () => {
        test('should build custom prompt with system override', async () => {
            const customSystem = 'You are a custom AI assistant.';
            const prompt = await promptBuilder.buildCustomPrompt(customSystem, 'User message', mockFile);

            expect(prompt.systemPrompt).toBe(customSystem);
            expect(prompt.userPrompt).toBe('User message');
            expect(prompt.context).toContain('Document: test');
        });

        test('should build custom prompt without file context', async () => {
            const customSystem = 'You are a custom AI assistant.';
            const prompt = await promptBuilder.buildCustomPrompt(customSystem, 'User message');

            expect(prompt.systemPrompt).toBe(customSystem);
            expect(prompt.userPrompt).toBe('User message');
            expect(prompt.context).toBe('');
        });
    });

    describe('validateAndOptimizePrompt', () => {
        test('should return valid prompt unchanged', () => {
            const validPrompt = {
                systemPrompt: 'Valid system prompt',
                userPrompt: 'Valid user prompt',
                context: 'Valid context',
                config: { temperature: 0.7, maxTokens: 1000 }
            };

            const result = promptBuilder.validateAndOptimizePrompt(validPrompt);
            expect(result).toEqual(validPrompt);
        });

        test('should fix temperature out of bounds', () => {
            const invalidPrompt = {
                systemPrompt: 'Valid system prompt',
                userPrompt: 'Valid user prompt',
                context: 'Valid context',
                config: { temperature: 1.5, maxTokens: 1000 }
            };

            const result = promptBuilder.validateAndOptimizePrompt(invalidPrompt);
            expect(result.config.temperature).toBe(1);
        });

        test('should fix maxTokens out of bounds', () => {
            const invalidPrompt = {
                systemPrompt: 'Valid system prompt',
                userPrompt: 'Valid user prompt',
                context: 'Valid context',
                config: { temperature: 0.7, maxTokens: 5000 }
            };

            const result = promptBuilder.validateAndOptimizePrompt(invalidPrompt);
            expect(result.config.maxTokens).toBe(4000);
        });

        test('should truncate very long context', () => {
            const longContext = 'x'.repeat(40000); // Very long context to trigger 8000 token limit
            const invalidPrompt = {
                systemPrompt: 'Valid system prompt',
                userPrompt: 'Valid user prompt',
                context: longContext,
                config: { temperature: 0.7, maxTokens: 1000 }
            };

            const result = promptBuilder.validateAndOptimizePrompt(invalidPrompt);
            expect(result.context.length).toBeLessThan(longContext.length);
            expect(result.context).toContain('[Context truncated...]');
        });
    });

    describe('getTokenCount', () => {
        test('should estimate token count', () => {
            const prompt = {
                systemPrompt: 'System prompt',
                userPrompt: 'User prompt',
                context: 'Context',
                config: { temperature: 0.7, maxTokens: 1000 }
            };

            const tokenCount = promptBuilder.getTokenCount(prompt);
            expect(tokenCount).toBeGreaterThan(0);
            expect(typeof tokenCount).toBe('number');
        });
    });

    describe('document context integration', () => {
        test('should gather complete document context', async () => {
            const mockDocumentContext = {
                file: mockFile,
                filename: 'test',
                content: '# Test\nContent here',
                headings: [{ text: 'Test', level: 1, line: 0, position: { start: 0, end: 5 } }],
                selectedText: 'selected',
                surroundingLines: { before: ['line1'], after: ['line2'] }
            };

            mockDocumentEngine.getDocumentContext.mockResolvedValue(mockDocumentContext);

            const command: EditCommand = {
                action: 'edit',
                target: 'selection',
                instruction: 'improve this',
                location: undefined,
                context: undefined
            };

            const prompt = await promptBuilder.buildCommandPrompt(command, mockFile);

            expect(mockDocumentEngine.getDocumentContext).toHaveBeenCalled();
            expect(prompt.userPrompt).toContain('SELECTED TEXT:\nselected');
        });
    });
});