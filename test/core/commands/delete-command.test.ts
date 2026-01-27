/**
 * Tests for DeleteCommand - Cursor-Only System
 */

import { DeleteCommand } from '../../../src/core/commands/delete-command';
import { DocumentEngine } from '../../../src/core/document-engine';
import { ContextBuilder } from '../../../src/core/context-builder';
import { AIProviderManager } from '../../../src/ai/provider-manager';
import { EditCommand as EditCommandType, DocumentContext, EditResult } from '../../../src/core/types';
import { App, TFile } from '../../mocks/obsidian-mock';

// Mock the dependencies
jest.mock('../../../src/core/document-engine');
jest.mock('../../../src/core/context-builder');
jest.mock('../../../src/ai/provider-manager');

describe('DeleteCommand', () => {
    let deleteCommand: DeleteCommand;
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

This is the introduction paragraph.

## Section One

Content for section one goes here.
It has multiple paragraphs.

## Section Two

Content for section two.`,
            headings: [
                { text: 'Main Document', level: 1, line: 0, position: { start: 0, end: 15 } },
                { text: 'Section One', level: 2, line: 4, position: { start: 50, end: 63 } },
                { text: 'Section Two', level: 2, line: 9, position: { start: 120, end: 133 } }
            ],
            selectedText: 'This is the introduction paragraph.',
            cursorPosition: { line: 2, ch: 10 },
            surroundingLines: {
                before: ['# Main Document', ''],
                after: ['', '## Section One']
            }
        };

        deleteCommand = new DeleteCommand(
            mockApp as any,
            mockDocumentEngine
        );

        // Setup default mocks
        mockDocumentEngine.getDocumentContext.mockReturnValue(mockDocumentContext);
        mockContextBuilder.buildPrompt.mockReturnValue({
            systemPrompt: 'System prompt',
            userPrompt: 'User prompt',
            context: 'Context',
            config: { temperature: 0.7, maxTokens: 1000 }
        });
        mockContextBuilder.validatePrompt.mockReturnValue({ valid: true, issues: [] });
        
        mockProviderManager.generateText.mockResolvedValue('AI analysis complete');

        const mockApplyEditResult: EditResult = {
            success: true,
            content: '',
            editType: 'delete',
            appliedAt: { line: 2, ch: 0 }
        };
        mockDocumentEngine.applyEdit.mockReturnValue(mockApplyEditResult);

        const mockSetContentResult: EditResult = {
            success: true,
            content: '',
            editType: 'delete'
        };
        mockDocumentEngine.setDocumentContent.mockReturnValue(mockSetContentResult);

        const mockDeleteContentResult: EditResult = {
            success: true,
            content: '',
            editType: 'delete',
            appliedAt: { line: 2, ch: 0 }
        };
        mockDocumentEngine.deleteContent.mockReturnValue(mockDeleteContentResult);
        
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
        it('should successfully delete selected text', async () => {
            const command: EditCommandType = {
                action: 'delete',
                target: 'selection',
                instruction: 'Delete this text'
            };

            const result = await deleteCommand.execute(command);

            expect(result.success).toBe(true);
            expect(result.content).toBe('');
            expect(result.editType).toBe('delete');
            expect(mockDocumentEngine.applyEdit).toHaveBeenCalledWith(
                '',
                'selection',
                { scrollToEdit: true, selectNewText: false }
            );
        });

        it('should successfully delete at cursor position', async () => {
            const command: EditCommandType = {
                action: 'delete',
                target: 'cursor',
                instruction: 'Delete content at cursor'
            };
            
            const result = await deleteCommand.execute(command);

            expect(result.success).toBe(true);
            expect(mockDocumentEngine.deleteContent).toHaveBeenCalledWith('line');
        });

        it('should handle deletion of selected text when available', async () => {
            const contextWithSelection = {
                ...mockDocumentContext,
                selectedText: 'Text to delete'
            };
            mockDocumentEngine.getDocumentContext.mockReturnValue(contextWithSelection);

            const command: EditCommandType = {
                action: 'delete',
                target: 'selection',
                instruction: 'Delete selected text'
            };
            
            const result = await deleteCommand.execute(command);

            expect(result.success).toBe(true);
            expect(mockDocumentEngine.applyEdit).toHaveBeenCalledWith(
                '',
                'selection',
                { scrollToEdit: true, selectNewText: false }
            );
        });

        it('should delete entire document', async () => {
            const command: EditCommandType = {
                action: 'delete',
                target: 'document',
                instruction: 'Clear the entire document'
            };

            const result = await deleteCommand.execute(command);

            expect(result.success).toBe(true);
            expect(mockDocumentEngine.setDocumentContent).toHaveBeenCalledWith('');
        });

        it('should reject delete at end of document', async () => {
            const command: EditCommandType = {
                action: 'delete',
                target: 'end',
                instruction: 'Delete at end'
            };

            const result = await deleteCommand.execute(command);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Cannot delete from end - use cursor or selection instead');
        });

        it('should handle no active document', async () => {
            mockDocumentEngine.getDocumentContext.mockReturnValue(null);

            const command: EditCommandType = {
                action: 'delete',
                target: 'selection',
                instruction: 'Delete content'
            };

            const result = await deleteCommand.execute(command);

            expect(result.success).toBe(false);
            expect(result.error).toBe('No active document found');
            expect(result.editType).toBe('delete');
        });

        it('should handle validation failure for selection without text', async () => {
            const contextWithoutSelection = {
                ...mockDocumentContext,
                selectedText: undefined
            };
            mockDocumentEngine.getDocumentContext.mockReturnValue(contextWithoutSelection);

            const command: EditCommandType = {
                action: 'delete',
                target: 'selection',
                instruction: 'Delete selected text'
            };

            const result = await deleteCommand.execute(command);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Please select text to delete');
        });


        it('should handle exceptions during execution', async () => {
            mockDocumentEngine.getDocumentContext.mockImplementation(() => { throw new Error('File system error'); });

            const command: EditCommandType = {
                action: 'delete',
                target: 'selection',
                instruction: 'Delete content'
            };

            const result = await deleteCommand.execute(command);

            expect(result.success).toBe(false);
            expect(result.error).toBe('File system error');
        });
    });
});