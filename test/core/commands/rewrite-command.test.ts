/**
 * Tests for RewriteCommand - Cursor-Only System
 */

import { RewriteCommand } from '../../../src/core/commands/rewrite-command';
import { DocumentEngine } from '../../../src/core/document-engine';
import { ContextBuilder } from '../../../src/core/context-builder';
import { AIProviderManager } from '../../../src/ai/provider-manager';
import { EditCommand as EditCommandType, DocumentContext, EditResult } from '../../../src/core/types';
import { App, TFile } from '../../mocks/obsidian-mock';

// Mock the dependencies
jest.mock('../../../src/core/document-engine');
jest.mock('../../../src/core/context-builder');
jest.mock('../../../src/ai/provider-manager');

describe('RewriteCommand', () => {
    let rewriteCommand: RewriteCommand;
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

This is the introduction paragraph with old-fashioned language.

## Section One

Content for section one goes here.
It has verbose and complex sentences.

## Section Two

Content for section two.`,
            headings: [
                { text: 'Main Document', level: 1, line: 0, position: { start: 0, end: 15 } },
                { text: 'Section One', level: 2, line: 4, position: { start: 50, end: 63 } },
                { text: 'Section Two', level: 2, line: 9, position: { start: 120, end: 133 } }
            ],
            selectedText: 'This is the introduction paragraph with old-fashioned language.',
            cursorPosition: { line: 2, ch: 10 },
            surroundingLines: {
                before: ['# Main Document', ''],
                after: ['', '## Section One']
            }
        };

        rewriteCommand = new RewriteCommand(
            mockApp as any,
            mockDocumentEngine,
            mockContextBuilder,
            mockProviderManager
        );

        // Setup default mocks
        mockDocumentEngine.getDocumentContext.mockReturnValue(mockDocumentContext);
        mockContextBuilder.buildPrompt.mockReturnValue({
            systemPrompt: 'Rewrite system prompt',
            userPrompt: 'Rewrite user prompt',
            context: 'Context',
            config: { temperature: 0.7, maxTokens: 1000 }
        });
        mockContextBuilder.validatePrompt.mockReturnValue({ valid: true, issues: [] });
        
        mockProviderManager.generateText.mockResolvedValue('This is a modern introduction paragraph with contemporary language.');
        
        mockDocumentEngine.applyEdit.mockResolvedValue({
            success: true,
            content: 'This is a modern introduction paragraph with contemporary language.',
            editType: 'replace',
            appliedAt: { line: 2, ch: 0 }
        });
        
        mockDocumentEngine.setDocumentContent.mockReturnValue({
            success: true,
            content: 'Rewritten document content',
            editType: 'replace'
        });

        // Mock editor for direct editing operations
        const mockEditor = {
            replaceRange: jest.fn(),
            getLine: jest.fn((line: number) => {
                const lines = mockDocumentContext.content.split('\n');
                return lines[line] || '';
            }),
            lineCount: jest.fn(() => mockDocumentContext.content.split('\n').length)
        };
        mockDocumentEngine.getActiveEditor.mockReturnValue(mockEditor as any);
    });

    describe('execute', () => {
        it('should rewrite at cursor position', async () => {
            const command: EditCommandType = {
                action: 'rewrite',
                target: 'cursor',
                instruction: 'Rewrite in modern language'
            };

            const result = await rewriteCommand.execute(command);

            expect(result.success).toBe(true);
            expect(result.content).toBe('This is a modern introduction paragraph with contemporary language.');
            expect(result.editType).toBe('replace');
            expect(mockDocumentEngine.applyEdit).toHaveBeenCalledWith(
                'This is a modern introduction paragraph with contemporary language.',
                'cursor',
                { scrollToEdit: true, selectNewText: true }
            );
        });

        it('should rewrite selected text', async () => {
            const command: EditCommandType = {
                action: 'rewrite',
                target: 'selection',
                instruction: 'Rewrite in modern language'
            };

            const result = await rewriteCommand.execute(command);

            expect(result.success).toBe(true);
            expect(result.content).toBe('This is a modern introduction paragraph with contemporary language.');
            expect(result.editType).toBe('replace');
            expect(mockDocumentEngine.applyEdit).toHaveBeenCalledWith(
                'This is a modern introduction paragraph with contemporary language.',
                'selection',
                { scrollToEdit: true, selectNewText: true }
            );
        });

        it('should rewrite entire document', async () => {
            const command: EditCommandType = {
                action: 'rewrite',
                target: 'document',
                instruction: 'Rewrite the entire document in a formal tone'
            };

            const result = await rewriteCommand.execute(command);

            expect(result.success).toBe(true);
            expect(mockDocumentEngine.setDocumentContent).toHaveBeenCalledWith('This is a modern introduction paragraph with contemporary language.');
        });

        it('should handle no active document', async () => {
            mockDocumentEngine.getDocumentContext.mockReturnValue(null);

            const command: EditCommandType = {
                action: 'rewrite',
                target: 'cursor',
                instruction: 'Rewrite content'
            };

            const result = await rewriteCommand.execute(command);

            expect(result.success).toBe(false);
            expect(result.error).toBe('No active document found');
            expect(result.editType).toBe('replace');
        });

        it('should handle selection without text', async () => {
            const contextWithoutSelection = {
                ...mockDocumentContext,
                selectedText: undefined
            };
            mockDocumentEngine.getDocumentContext.mockReturnValue(contextWithoutSelection);

            const command: EditCommandType = {
                action: 'rewrite',
                target: 'selection',
                instruction: 'Rewrite selected text'
            };

            const result = await rewriteCommand.execute(command);

            expect(result.success).toBe(false);
            expect(result.error).toBe('No text selected for rewriting');
        });

        it('should handle prompt validation failure', async () => {
            mockContextBuilder.validatePrompt.mockReturnValue({
                valid: false,
                issues: ['System prompt is empty']
            });

            const command: EditCommandType = {
                action: 'rewrite',
                target: 'cursor',
                instruction: 'Rewrite content'
            };

            const result = await rewriteCommand.execute(command);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Prompt validation failed: System prompt is empty');
        });

        it('should handle AI provider failure', async () => {
            mockProviderManager.generateText.mockRejectedValue(new Error('API rate limit exceeded'));

            const command: EditCommandType = {
                action: 'rewrite',
                target: 'cursor',
                instruction: 'Rewrite content'
            };

            const result = await rewriteCommand.execute(command);

            expect(result.success).toBe(false);
            expect(result.error).toBe('API rate limit exceeded');
        });

        it('should handle empty AI content', async () => {
            mockProviderManager.generateText.mockResolvedValue('');

            const command: EditCommandType = {
                action: 'rewrite',
                target: 'cursor',
                instruction: 'Rewrite content'
            };

            const result = await rewriteCommand.execute(command);

            expect(result.success).toBe(false);
            expect(result.error).toBe('AI provider returned empty content');
        });
    });
});