/**
 * Tests for EditCommand
 */

import { EditCommand } from '../../../src/core/commands/edit-command';
import { DocumentEngine } from '../../../src/core/document-engine';
import { ContextBuilder } from '../../../src/core/context-builder';
import { AIProviderManager } from '../../../src/ai/provider-manager';
import { EditCommand as EditCommandType, DocumentContext, EditResult } from '../../../src/core/types';
import { App, TFile } from '../../mocks/obsidian-mock';

// Mock the dependencies
jest.mock('../../../src/core/document-engine');
jest.mock('../../../src/core/context-builder');
jest.mock('../../../src/ai/provider-manager');

describe('EditCommand', () => {
    let editCommand: EditCommand;
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

        editCommand = new EditCommand(
            mockApp as any,
            mockDocumentEngine,
            mockContextBuilder,
            mockProviderManager
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
        
        mockProviderManager.generateText.mockResolvedValue('Improved content');

        const mockApplyEditResult: EditResult = {
            success: true,
            content: 'Improved content',
            editType: 'replace',
            appliedAt: { line: 2, ch: 0 }
        };
        mockDocumentEngine.applyEdit.mockReturnValue(mockApplyEditResult);

        const mockSetContentResult: EditResult = {
            success: true,
            content: 'Improved document content',
            editType: 'replace'
        };
        mockDocumentEngine.setDocumentContent.mockReturnValue(mockSetContentResult);
        
        // Remove findSection mock - not used in cursor-only system
        const mockEditor = {
            replaceRange: jest.fn()
        };
        mockDocumentEngine.getActiveEditor.mockReturnValue(mockEditor as any);
    });

    describe('execute', () => {
        it('should successfully edit selected text', async () => {
            const command: EditCommandType = {
                action: 'edit',
                target: 'selection',
                instruction: 'Make this more professional'
            };

            const result = await editCommand.execute(command);

            expect(result.success).toBe(true);
            expect(result.content).toBe('Improved content');
            expect(result.editType).toBe('replace');
            expect(mockDocumentEngine.applyEdit).toHaveBeenCalledWith(
                'Improved content',
                'selection',
                { scrollToEdit: true, selectNewText: true }
            );
        });

        it('should successfully edit at cursor position', async () => {
            const command: EditCommandType = {
                action: 'edit',
                target: 'cursor',
                instruction: 'Improve content at cursor'
            };
            
            const result = await editCommand.execute(command);

            expect(result.success).toBe(true);
            expect(mockDocumentEngine.applyEdit).toHaveBeenCalledWith(
                'Improved content',
                'cursor',
                { scrollToEdit: true, selectNewText: true }
            );
        });

        it('should edit selected text when available', async () => {
            const contextWithSelection = {
                ...mockDocumentContext,
                selectedText: 'Selected text to edit'
            };
            mockDocumentEngine.getDocumentContext.mockReturnValue(contextWithSelection);

            const command: EditCommandType = {
                action: 'edit',
                target: 'selection',
                instruction: 'Improve selected text'
            };

            const result = await editCommand.execute(command);

            expect(result.success).toBe(true);
            expect(mockDocumentEngine.applyEdit).toHaveBeenCalledWith(
                'Improved content',
                'selection',
                { scrollToEdit: true, selectNewText: true }
            );
        });

        it('should edit entire document', async () => {
            const command: EditCommandType = {
                action: 'edit',
                target: 'document',
                instruction: 'Improve the entire document'
            };

            const result = await editCommand.execute(command);

            expect(result.success).toBe(true);
            expect(mockDocumentEngine.setDocumentContent).toHaveBeenCalledWith('Improved content');
        });

        it('should handle edit at end of document', async () => {
            const command: EditCommandType = {
                action: 'edit',
                target: 'end',
                instruction: 'Add improved content at the end'
            };

            const result = await editCommand.execute(command);

            expect(result.success).toBe(true);
            expect(mockDocumentEngine.applyEdit).toHaveBeenCalledWith(
                'Improved content',
                'end',
                { scrollToEdit: true, selectNewText: true }
            );
        });

        it('should handle no active document', async () => {
            mockDocumentEngine.getDocumentContext.mockReturnValue(null);

            const command: EditCommandType = {
                action: 'edit',
                target: 'selection',
                instruction: 'Edit content'
            };

            const result = await editCommand.execute(command);

            expect(result.success).toBe(false);
            expect(result.error).toBe('No active document found');
            expect(result.editType).toBe('replace');
        });

        it('should handle validation failure', async () => {
            const contextWithoutSelection = {
                ...mockDocumentContext,
                selectedText: undefined
            };
            mockDocumentEngine.getDocumentContext.mockReturnValue(contextWithoutSelection);

            const command: EditCommandType = {
                action: 'edit',
                target: 'selection',
                instruction: 'Edit selected text'
            };

            const result = await editCommand.execute(command);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Please select text to edit');
        });

        it('should handle prompt validation failure', async () => {
            mockContextBuilder.validatePrompt.mockReturnValue({
                valid: false,
                issues: ['System prompt is empty']
            });

            const command: EditCommandType = {
                action: 'edit',
                target: 'selection',
                instruction: 'Edit content'
            };

            const result = await editCommand.execute(command);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Prompt validation failed: System prompt is empty');
        });

        it('should handle AI provider failure', async () => {
            mockProviderManager.generateText.mockRejectedValue(new Error('API rate limit exceeded'));

            const command: EditCommandType = {
                action: 'edit',
                target: 'selection',
                instruction: 'Edit content'
            };

            const result = await editCommand.execute(command);

            expect(result.success).toBe(false);
            expect(result.error).toBe('API rate limit exceeded');
        });

        it('should handle empty AI content', async () => {
            mockProviderManager.generateText.mockResolvedValue('');

            const command: EditCommandType = {
                action: 'edit',
                target: 'selection',
                instruction: 'Edit content'
            };

            const result = await editCommand.execute(command);

            expect(result.success).toBe(false);
            expect(result.error).toBe('AI provider returned empty content');
        });

        // Remove section-based test - not supported in cursor-only system

        // Remove editor-based test - not needed in cursor-only system

        it('should handle exceptions during execution', async () => {
            mockDocumentEngine.getDocumentContext.mockImplementation(() => { throw new Error('File system error'); });

            const command: EditCommandType = {
                action: 'edit',
                target: 'selection',
                instruction: 'Edit content'
            };

            const result = await editCommand.execute(command);

            expect(result.success).toBe(false);
            expect(result.error).toBe('File system error');
        });
    });

    // Remove validateCommand tests - method not available in cursor-only system

    // Remove getSuggestions tests - method not available in cursor-only system

    // Remove preview tests - method not available in cursor-only system

    // Remove getAvailableTargets tests - method not available in cursor-only system

    // Remove estimateScope tests - method not available in cursor-only system
});