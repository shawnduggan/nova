/**
 * Tests for GrammarCommand (cursor-only system)
 */

import { GrammarCommand } from '../../../src/core/commands/grammar-command';
import { DocumentEngine } from '../../../src/core/document-engine';
import { ContextBuilder } from '../../../src/core/context-builder';
import { AIProviderManager } from '../../../src/ai/provider-manager';
import { EditCommand as EditCommandType, DocumentContext, EditResult } from '../../../src/core/types';
import { App, TFile } from '../../mocks/obsidian-mock';

// Mock the dependencies
jest.mock('../../../src/core/document-engine');
jest.mock('../../../src/core/context-builder');
jest.mock('../../../src/ai/provider-manager');

describe('GrammarCommand', () => {
    let grammarCommand: GrammarCommand;
    let mockApp: App;
    let mockDocumentEngine: jest.Mocked<DocumentEngine>;
    let mockContextBuilder: jest.Mocked<ContextBuilder>;
    let mockProviderManager: jest.Mocked<AIProviderManager>;
    let mockDocumentContext: DocumentContext;
    let mockFile: TFile;

    beforeEach(() => {
        mockApp = new App();
        mockDocumentEngine = new DocumentEngine(mockApp as any) as jest.Mocked<DocumentEngine>;
        mockContextBuilder = new ContextBuilder() as jest.Mocked<ContextBuilder>;
        mockProviderManager = new AIProviderManager({} as any) as jest.Mocked<AIProviderManager>;
        
        mockFile = new TFile('test-document.md');
        mockDocumentContext = {
            file: mockFile,
            filename: 'test-document',
            content: `# Main Document

this is the introduction paragraph with some errors.

## Section One

Content for section one goes here.
it has multiple paragraphs with  double spaces.

## Section Two

Content for section two.`,
            headings: [
                { text: 'Main Document', level: 1, line: 0, position: { start: 0, end: 15 } },
                { text: 'Section One', level: 2, line: 4, position: { start: 50, end: 63 } },
                { text: 'Section Two', level: 2, line: 9, position: { start: 120, end: 133 } }
            ],
            selectedText: 'this is the introduction paragraph with some errors.',
            cursorPosition: { line: 2, ch: 10 },
            surroundingLines: {
                before: ['# Main Document', ''],
                after: ['', '## Section One']
            }
        };

        grammarCommand = new GrammarCommand(
            mockApp as any,
            mockDocumentEngine,
            mockContextBuilder,
            mockProviderManager
        );

        // Setup default mocks
        mockDocumentEngine.getDocumentContext.mockReturnValue(mockDocumentContext);
        mockContextBuilder.buildPrompt.mockReturnValue({
            systemPrompt: 'Grammar correction system prompt',
            userPrompt: 'Grammar correction user prompt',
            context: 'Context',
            config: { temperature: 0.3, maxTokens: 1000 }
        });
        mockContextBuilder.validatePrompt.mockReturnValue({ valid: true, issues: [] });
        
        mockProviderManager.generateText.mockResolvedValue('This is the introduction paragraph with some corrections.');
        
        mockDocumentEngine.applyEdit.mockResolvedValue({
            success: true,
            content: 'This is the introduction paragraph with some corrections.',
            editType: 'replace',
            appliedAt: { line: 2, ch: 0 }
        });
        
        mockDocumentEngine.setDocumentContent.mockReturnValue({
            success: true,
            content: 'Corrected document content',
            editType: 'replace'
        });

        // Mock conversation context methods
        mockDocumentEngine.getConversationContext.mockReturnValue('');
        mockDocumentEngine.addUserMessage.mockResolvedValue();
        mockDocumentEngine.addAssistantMessage.mockResolvedValue();
    });

    describe('execute', () => {
        it('should successfully correct grammar in selected text', async () => {
            const command: EditCommandType = {
                action: 'grammar',
                target: 'selection',
                instruction: 'Fix grammar errors'
            };

            const result = await grammarCommand.execute(command);

            expect(result.success).toBe(true);
            expect(result.content).toBe('This is the introduction paragraph with some corrections.');
            expect(result.editType).toBe('replace');
            expect(mockDocumentEngine.applyEdit).toHaveBeenCalledWith(
                'This is the introduction paragraph with some corrections.',
                'selection',
                { scrollToEdit: true, selectNewText: true }
            );
        });

        it('should successfully correct grammar in entire document', async () => {
            const command: EditCommandType = {
                action: 'grammar',
                target: 'document',
                instruction: 'Fix grammar throughout the document'
            };

            const result = await grammarCommand.execute(command);

            expect(result.success).toBe(true);
            expect(mockDocumentEngine.setDocumentContent).toHaveBeenCalledWith('This is the introduction paragraph with some corrections.');
        });

        it('should handle no active document', async () => {
            mockDocumentEngine.getDocumentContext.mockReturnValue(null);

            const command: EditCommandType = {
                action: 'grammar',
                target: 'cursor',
                instruction: 'Fix grammar'
            };

            const result = await grammarCommand.execute(command);

            expect(result.success).toBe(false);
            expect(result.error).toBe('No active document found');
            expect(result.editType).toBe('replace');
        });

        it('should handle validation failure for selection without text', async () => {
            const contextWithoutSelection = {
                ...mockDocumentContext,
                selectedText: undefined
            };
            mockDocumentEngine.getDocumentContext.mockReturnValue(contextWithoutSelection);

            const command: EditCommandType = {
                action: 'grammar',
                target: 'selection',
                instruction: 'Fix grammar in selected text'
            };

            const result = await grammarCommand.execute(command);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Please select text to correct grammar');
        });

        it('should handle prompt validation failure', async () => {
            mockContextBuilder.validatePrompt.mockReturnValue({
                valid: false,
                issues: ['System prompt is empty']
            });

            const command: EditCommandType = {
                action: 'grammar',
                target: 'selection',
                instruction: 'Fix grammar'
            };

            const result = await grammarCommand.execute(command);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Prompt validation failed: System prompt is empty');
        });

        it('should handle AI provider failure', async () => {
            mockProviderManager.generateText.mockRejectedValue(new Error('API rate limit exceeded'));

            const command: EditCommandType = {
                action: 'grammar',
                target: 'selection',
                instruction: 'Fix grammar'
            };

            const result = await grammarCommand.execute(command);

            expect(result.success).toBe(false);
            expect(result.error).toBe('API rate limit exceeded');
        });

        it('should handle empty AI content', async () => {
            mockProviderManager.generateText.mockResolvedValue('');

            const command: EditCommandType = {
                action: 'grammar',
                target: 'selection',
                instruction: 'Fix grammar'
            };

            const result = await grammarCommand.execute(command);

            expect(result.success).toBe(false);
            expect(result.error).toBe('AI provider returned empty content');
        });

        it('should handle exceptions during execution', async () => {
            mockDocumentEngine.getDocumentContext.mockImplementation(() => { throw new Error('File system error'); });

            const command: EditCommandType = {
                action: 'grammar',
                target: 'selection',
                instruction: 'Fix grammar'
            };

            const result = await grammarCommand.execute(command);

            expect(result.success).toBe(false);
            expect(result.error).toBe('File system error');
        });

        it('should reject cursor target', async () => {
            const command: EditCommandType = {
                action: 'grammar',
                target: 'cursor',
                instruction: 'Fix grammar'
            };

            const result = await grammarCommand.execute(command);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Grammar correction requires selecting text or targeting entire document');
        });

        it('should reject end target', async () => {
            const command: EditCommandType = {
                action: 'grammar',
                target: 'end',
                instruction: 'Fix grammar'
            };

            const result = await grammarCommand.execute(command);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Grammar correction requires selecting text or targeting entire document');
        });
    });
});