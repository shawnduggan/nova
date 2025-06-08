/**
 * Tests for DeleteCommand
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
            mockDocumentEngine,
            mockContextBuilder,
            mockProviderManager
        );

        // Setup default mocks
        mockDocumentEngine.getDocumentContext.mockResolvedValue(mockDocumentContext);
        mockContextBuilder.buildPrompt.mockReturnValue({
            systemPrompt: 'System prompt',
            userPrompt: 'User prompt',
            context: 'Context',
            config: { temperature: 0.7, maxTokens: 1000 }
        });
        mockContextBuilder.validatePrompt.mockReturnValue({ valid: true, issues: [] });
        
        mockProviderManager.generateText.mockResolvedValue('AI analysis complete');
        
        mockDocumentEngine.applyEdit.mockResolvedValue({
            success: true,
            content: '',
            editType: 'delete',
            appliedAt: { line: 2, ch: 0 }
        });
        
        mockDocumentEngine.setDocumentContent.mockResolvedValue({
            success: true,
            content: '',
            editType: 'delete'
        });
        
        mockDocumentEngine.findSection.mockResolvedValue({
            heading: '## Section One',
            level: 2,
            content: 'Content for section one goes here.\nIt has multiple paragraphs.',
            range: { start: 4, end: 7 }
        });

        // Mock editor for section and paragraph deletion
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

        it('should successfully delete a specific section', async () => {
            const command: EditCommandType = {
                action: 'delete',
                target: 'section',
                location: 'Section One',
                instruction: 'Delete the Section One'
            };

            const mockEditor = mockDocumentEngine.getActiveEditor() as any;
            
            const result = await deleteCommand.execute(command);

            expect(result.success).toBe(true);
            expect(mockDocumentEngine.findSection).toHaveBeenCalledWith('Section One');
            expect(mockEditor.replaceRange).toHaveBeenCalledWith(
                '',
                { line: 4, ch: 0 },
                { line: 8, ch: 0 }
            );
        });

        it('should delete paragraph at cursor position', async () => {
            const command: EditCommandType = {
                action: 'delete',
                target: 'paragraph',
                instruction: 'Delete this paragraph'
            };

            const mockEditor = mockDocumentEngine.getActiveEditor() as any;
            
            const result = await deleteCommand.execute(command);

            expect(result.success).toBe(true);
            expect(mockEditor.replaceRange).toHaveBeenCalledWith(
                '',
                { line: 2, ch: 0 },
                { line: 3, ch: 0 }
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
            expect(result.error).toBe('Cannot delete from end of document. Use a different target.');
        });

        it('should handle no active document', async () => {
            mockDocumentEngine.getDocumentContext.mockResolvedValue(null);

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
            mockDocumentEngine.getDocumentContext.mockResolvedValue(contextWithoutSelection);

            const command: EditCommandType = {
                action: 'delete',
                target: 'selection',
                instruction: 'Delete selected text'
            };

            const result = await deleteCommand.execute(command);

            expect(result.success).toBe(false);
            expect(result.error).toBe('This command requires text to be selected first');
        });

        it('should handle validation failure for section without location', async () => {
            const command: EditCommandType = {
                action: 'delete',
                target: 'section',
                instruction: 'Delete a section'
            };

            const result = await deleteCommand.execute(command);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Section name required for section deletion');
        });

        it('should handle prompt validation failure', async () => {
            mockContextBuilder.validatePrompt.mockReturnValue({
                valid: false,
                issues: ['System prompt is empty']
            });

            const command: EditCommandType = {
                action: 'delete',
                target: 'selection',
                instruction: 'Smart delete this content'
            };

            const result = await deleteCommand.execute(command);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Prompt validation failed: System prompt is empty');
        });

        it('should handle AI provider failure during smart deletion', async () => {
            mockProviderManager.generateText.mockRejectedValue(new Error('API rate limit exceeded'));

            const command: EditCommandType = {
                action: 'delete',
                target: 'selection',
                instruction: 'Intelligently remove redundant content'
            };

            const result = await deleteCommand.execute(command);

            expect(result.success).toBe(false);
            expect(result.error).toBe('API rate limit exceeded');
        });

        it('should handle section not found', async () => {
            mockDocumentEngine.findSection.mockResolvedValue(null);

            const command: EditCommandType = {
                action: 'delete',
                target: 'section',
                location: 'Nonexistent Section',
                instruction: 'Delete missing section'
            };

            const result = await deleteCommand.execute(command);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Section "Nonexistent Section" not found');
        });

        it('should handle no active editor for section deletion', async () => {
            mockDocumentEngine.getActiveEditor.mockReturnValue(null);

            const command: EditCommandType = {
                action: 'delete',
                target: 'section',
                location: 'Section One',
                instruction: 'Delete section'
            };

            const result = await deleteCommand.execute(command);

            expect(result.success).toBe(false);
            expect(result.error).toBe('No active editor');
        });

        it('should handle no active editor for paragraph deletion', async () => {
            mockDocumentEngine.getActiveEditor.mockReturnValue(null);

            const command: EditCommandType = {
                action: 'delete',
                target: 'paragraph',
                instruction: 'Delete paragraph'
            };

            const result = await deleteCommand.execute(command);

            expect(result.success).toBe(false);
            expect(result.error).toBe('No active editor');
        });

        it('should handle no cursor position for paragraph deletion', async () => {
            const contextWithoutCursor = {
                ...mockDocumentContext,
                cursorPosition: undefined
            };
            mockDocumentEngine.getDocumentContext.mockResolvedValue(contextWithoutCursor);

            const command: EditCommandType = {
                action: 'delete',
                target: 'paragraph',
                instruction: 'Delete paragraph'
            };

            const result = await deleteCommand.execute(command);

            expect(result.success).toBe(false);
            expect(result.error).toBe('No cursor position available');
        });

        it('should handle exceptions during execution', async () => {
            mockDocumentEngine.getDocumentContext.mockRejectedValue(new Error('File system error'));

            const command: EditCommandType = {
                action: 'delete',
                target: 'selection',
                instruction: 'Delete content'
            };

            const result = await deleteCommand.execute(command);

            expect(result.success).toBe(false);
            expect(result.error).toBe('File system error');
        });

        it('should handle paragraph deletion with complex boundaries', async () => {
            const complexContent = `# Title

First paragraph here.

Second paragraph
continues on multiple lines
and has more content.

## Section

Another paragraph.`;
            
            const contextWithComplexContent = {
                ...mockDocumentContext,
                content: complexContent,
                cursorPosition: { line: 5, ch: 10 } // Middle of multi-line paragraph
            };
            
            mockDocumentEngine.getDocumentContext.mockResolvedValue(contextWithComplexContent);
            
            const mockEditor = {
                replaceRange: jest.fn(),
                getLine: jest.fn((line: number) => {
                    const lines = complexContent.split('\n');
                    return lines[line] || '';
                }),
                lineCount: jest.fn(() => complexContent.split('\n').length)
            };
            mockDocumentEngine.getActiveEditor.mockReturnValue(mockEditor as any);

            const command: EditCommandType = {
                action: 'delete',
                target: 'paragraph',
                instruction: 'Delete current paragraph'
            };

            const result = await deleteCommand.execute(command);

            expect(result.success).toBe(true);
            // Should delete the multi-line paragraph (lines 4-6)
            expect(mockEditor.replaceRange).toHaveBeenCalledWith(
                '',
                { line: 4, ch: 0 },
                { line: 7, ch: 0 }
            );
        });
    });

    describe('validateCommand', () => {
        it('should accept delete command with selection when text is selected', () => {
            const command: EditCommandType = {
                action: 'delete',
                target: 'selection',
                instruction: 'Delete selected text'
            };

            const validation = deleteCommand.validateCommand(command, true);

            expect(validation.valid).toBe(true);
            expect(validation.error).toBeUndefined();
        });

        it('should reject delete command with selection when no text is selected', () => {
            const command: EditCommandType = {
                action: 'delete',
                target: 'selection',
                instruction: 'Delete selected text'
            };

            const validation = deleteCommand.validateCommand(command, false);

            expect(validation.valid).toBe(false);
            expect(validation.error).toBe('This command requires text to be selected first');
        });

        it('should accept delete command with section target and location', () => {
            const command: EditCommandType = {
                action: 'delete',
                target: 'section',
                location: 'Introduction',
                instruction: 'Delete the introduction'
            };

            const validation = deleteCommand.validateCommand(command, false);

            expect(validation.valid).toBe(true);
            expect(validation.error).toBeUndefined();
        });

        it('should reject delete command with section target but no location', () => {
            const command: EditCommandType = {
                action: 'delete',
                target: 'section',
                instruction: 'Delete a section'
            };

            const validation = deleteCommand.validateCommand(command, false);

            expect(validation.valid).toBe(false);
            expect(validation.error).toBe('Section name required for section deletion');
        });

        it('should reject delete command with end target', () => {
            const command: EditCommandType = {
                action: 'delete',
                target: 'end',
                instruction: 'Delete from end'
            };

            const validation = deleteCommand.validateCommand(command, false);

            expect(validation.valid).toBe(false);
            expect(validation.error).toBe('Cannot delete from end of document. Use a different target.');
        });

        it('should accept delete command with valid targets', () => {
            const validTargets: EditCommandType['target'][] = ['paragraph', 'document'];

            validTargets.forEach(target => {
                const command: EditCommandType = {
                    action: 'delete',
                    target,
                    instruction: 'Delete content'
                };

                const validation = deleteCommand.validateCommand(command, false);
                expect(validation.valid).toBe(true);
            });
        });
    });

    describe('getSuggestions', () => {
        it('should provide suggestions for selected text', () => {
            const suggestions = deleteCommand.getSuggestions(mockDocumentContext, true);

            expect(suggestions).toContain('Delete the selected text');
            expect(suggestions).toContain('Remove this content');
            expect(suggestions).toContain('Clear the selection');
            expect(suggestions.length).toBeLessThanOrEqual(8);
        });

        it('should provide general document suggestions when no selection', () => {
            const suggestions = deleteCommand.getSuggestions(mockDocumentContext, false);

            expect(suggestions).toContain('Delete the current paragraph');
            expect(suggestions).toContain('Remove empty sections');
            expect(suggestions).toContain('Clear redundant content');
            expect(suggestions).toContain('Delete duplicate information');
            expect(suggestions.length).toBeLessThanOrEqual(8);
        });

        it('should include section-specific suggestions', () => {
            const suggestions = deleteCommand.getSuggestions(mockDocumentContext, false);

            expect(suggestions).toContain('Delete the "Main Document" section');
            expect(suggestions).toContain('Delete the "Section One" section');
            expect(suggestions).toContain('Delete the "Section Two" section');
        });

        it('should handle document without headings', () => {
            const contextWithoutHeadings = {
                ...mockDocumentContext,
                headings: []
            };

            const suggestions = deleteCommand.getSuggestions(contextWithoutHeadings, false);

            expect(suggestions.length).toBeGreaterThan(0);
            expect(suggestions).toContain('Delete the current paragraph');
            expect(suggestions).not.toContain('Delete the "Section One" section');
        });
    });

    describe('preview', () => {
        it('should preview deleting selected text', async () => {
            const command: EditCommandType = {
                action: 'delete',
                target: 'selection',
                instruction: 'Delete this text'
            };

            const preview = await deleteCommand.preview(command);

            expect(preview.success).toBe(true);
            expect(preview.preview).toBe('Will delete the selected text');
            expect(preview.affectedContent).toBe('This is the introduction paragraph.');
        });

        it('should preview deleting specific section', async () => {
            const command: EditCommandType = {
                action: 'delete',
                target: 'section',
                location: 'Section One',
                instruction: 'Delete the section'
            };

            const preview = await deleteCommand.preview(command);

            expect(preview.success).toBe(true);
            expect(preview.preview).toBe('Will delete the entire "Section One" section');
            expect(preview.affectedContent).toContain('## Section One');
            expect(preview.affectedContent).toContain('Content for section one goes here');
        });

        it('should preview deleting paragraph', async () => {
            const command: EditCommandType = {
                action: 'delete',
                target: 'paragraph',
                instruction: 'Delete paragraph'
            };

            const preview = await deleteCommand.preview(command);

            expect(preview.success).toBe(true);
            expect(preview.preview).toBe('Will delete the current paragraph');
            expect(preview.affectedContent).toBe('This is the introduction paragraph.');
        });

        it('should preview deleting entire document', async () => {
            const command: EditCommandType = {
                action: 'delete',
                target: 'document',
                instruction: 'Clear document'
            };

            const preview = await deleteCommand.preview(command);

            expect(preview.success).toBe(true);
            expect(preview.preview).toBe('Will delete all document content');
            expect(preview.affectedContent).toContain('# Main Document');
        });

        it('should handle preview when no text is selected', async () => {
            const contextWithoutSelection = {
                ...mockDocumentContext,
                selectedText: undefined
            };
            mockDocumentEngine.getDocumentContext.mockResolvedValue(contextWithoutSelection);

            const command: EditCommandType = {
                action: 'delete',
                target: 'selection',
                instruction: 'Delete selection'
            };

            const preview = await deleteCommand.preview(command);

            expect(preview.success).toBe(false);
            expect(preview.error).toBe('No text is currently selected');
        });

        it('should handle preview when section not found', async () => {
            mockDocumentEngine.findSection.mockResolvedValue(null);

            const command: EditCommandType = {
                action: 'delete',
                target: 'section',
                location: 'Missing Section',
                instruction: 'Delete section'
            };

            const preview = await deleteCommand.preview(command);

            expect(preview.success).toBe(false);
            expect(preview.error).toBe('Section "Missing Section" not found');
        });

        it('should handle preview when section name not provided', async () => {
            const command: EditCommandType = {
                action: 'delete',
                target: 'section',
                instruction: 'Delete section'
            };

            const preview = await deleteCommand.preview(command);

            expect(preview.success).toBe(false);
            expect(preview.error).toBe('Section name required for preview');
        });

        it('should handle preview when no document is active', async () => {
            mockDocumentEngine.getDocumentContext.mockResolvedValue(null);

            const command: EditCommandType = {
                action: 'delete',
                target: 'document',
                instruction: 'Delete document'
            };

            const preview = await deleteCommand.preview(command);

            expect(preview.success).toBe(false);
            expect(preview.error).toBe('No active document found');
        });

        it('should handle preview for end target', async () => {
            const command: EditCommandType = {
                action: 'delete',
                target: 'end',
                instruction: 'Delete at end'
            };

            const preview = await deleteCommand.preview(command);

            expect(preview.success).toBe(false);
            expect(preview.error).toBe('Cannot delete from end of document');
        });

        it('should truncate long affected content', async () => {
            const longContent = 'A'.repeat(300);
            const contextWithLongContent = {
                ...mockDocumentContext,
                selectedText: longContent
            };
            mockDocumentEngine.getDocumentContext.mockResolvedValue(contextWithLongContent);

            const command: EditCommandType = {
                action: 'delete',
                target: 'selection',
                instruction: 'Delete long text'
            };

            const preview = await deleteCommand.preview(command);

            expect(preview.success).toBe(true);
            expect(preview.affectedContent).toHaveLength(203); // 200 + '...'
            expect(preview.affectedContent?.endsWith('...')).toBe(true);
        });
    });

    describe('getAvailableTargets', () => {
        it('should return all valid targets when text is selected and headings exist', () => {
            const targets = deleteCommand.getAvailableTargets(mockDocumentContext);

            expect(targets).toEqual(['selection', 'paragraph', 'section', 'document']);
        });

        it('should exclude selection when no text is selected', () => {
            const contextWithoutSelection = {
                ...mockDocumentContext,
                selectedText: undefined
            };

            const targets = deleteCommand.getAvailableTargets(contextWithoutSelection);

            expect(targets).toEqual(['paragraph', 'section', 'document']);
            expect(targets).not.toContain('selection');
        });

        it('should exclude section when no headings exist', () => {
            const contextWithoutHeadings = {
                ...mockDocumentContext,
                headings: []
            };

            const targets = deleteCommand.getAvailableTargets(contextWithoutHeadings);

            expect(targets).toEqual(['selection', 'paragraph', 'document']);
            expect(targets).not.toContain('section');
        });

        it('should return basic targets when no selection or headings', () => {
            const minimalContext = {
                ...mockDocumentContext,
                selectedText: undefined,
                headings: []
            };

            const targets = deleteCommand.getAvailableTargets(minimalContext);

            expect(targets).toEqual(['paragraph', 'document']);
        });

        it('should never include end target', () => {
            const targets = deleteCommand.getAvailableTargets(mockDocumentContext);

            expect(targets).not.toContain('end');
        });
    });

    describe('estimateScope', () => {
        it('should estimate scope for selected text', async () => {
            const command: EditCommandType = {
                action: 'delete',
                target: 'selection',
                instruction: 'Delete selection'
            };

            const scope = await deleteCommand.estimateScope(command);

            expect(scope.charactersAffected).toBe(35); // Length of selected text
            expect(scope.linesAffected).toBe(1);
            expect(scope.scopeDescription).toBe('Selected text only');
        });

        it('should estimate scope for section', async () => {
            const command: EditCommandType = {
                action: 'delete',
                target: 'section',
                location: 'Section One',
                instruction: 'Delete section'
            };

            const scope = await deleteCommand.estimateScope(command);

            expect(scope.charactersAffected).toBe(76); // Length of section content + heading
            expect(scope.linesAffected).toBe(4); // range.end - range.start + 1
            expect(scope.scopeDescription).toBe('"Section One" section');
        });

        it('should estimate scope for paragraph', async () => {
            const command: EditCommandType = {
                action: 'delete',
                target: 'paragraph',
                instruction: 'Delete paragraph'
            };

            const scope = await deleteCommand.estimateScope(command);

            expect(scope.charactersAffected).toBe(100); // Rough estimate
            expect(scope.linesAffected).toBe(1);
            expect(scope.scopeDescription).toBe('Current paragraph');
        });

        it('should estimate scope for entire document', async () => {
            const command: EditCommandType = {
                action: 'delete',
                target: 'document',
                instruction: 'Delete document'
            };

            const scope = await deleteCommand.estimateScope(command);

            expect(scope.charactersAffected).toBe(mockDocumentContext.content.length);
            expect(scope.linesAffected).toBe(mockDocumentContext.content.split('\n').length);
            expect(scope.scopeDescription).toBe('Entire document');
        });

        it('should estimate scope for end target', async () => {
            const command: EditCommandType = {
                action: 'delete',
                target: 'end',
                instruction: 'Delete at end'
            };

            const scope = await deleteCommand.estimateScope(command);

            expect(scope.charactersAffected).toBe(0);
            expect(scope.linesAffected).toBe(0);
            expect(scope.scopeDescription).toBe('Invalid target for deletion');
        });

        it('should handle no document available', async () => {
            mockDocumentEngine.getDocumentContext.mockResolvedValue(null);

            const command: EditCommandType = {
                action: 'delete',
                target: 'selection',
                instruction: 'Delete content'
            };

            const scope = await deleteCommand.estimateScope(command);

            expect(scope.charactersAffected).toBe(0);
            expect(scope.linesAffected).toBe(0);
            expect(scope.scopeDescription).toBe('No document available');
        });
    });
});