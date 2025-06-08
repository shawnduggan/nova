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
        mockDocumentEngine.getDocumentContext.mockResolvedValue(mockDocumentContext);
        mockContextBuilder.buildPrompt.mockReturnValue({
            systemPrompt: 'System prompt',
            userPrompt: 'User prompt',
            context: 'Context',
            config: { temperature: 0.7, maxTokens: 1000 }
        });
        mockContextBuilder.validatePrompt.mockReturnValue({ valid: true, issues: [] });
        
        mockProviderManager.generateText.mockResolvedValue('Improved content');
        
        mockDocumentEngine.applyEdit.mockResolvedValue({
            success: true,
            content: 'Improved content',
            editType: 'replace',
            appliedAt: { line: 2, ch: 0 }
        });
        
        mockDocumentEngine.setDocumentContent.mockResolvedValue({
            success: true,
            content: 'Improved document content',
            editType: 'replace'
        });
        
        mockDocumentEngine.findSection.mockResolvedValue({
            heading: '## Section One',
            level: 2,
            content: 'Content for section one goes here.\nIt has multiple paragraphs.',
            range: { start: 4, end: 7 }
        });

        // Mock editor for section editing
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

        it('should successfully edit a specific section', async () => {
            const command: EditCommandType = {
                action: 'edit',
                target: 'section',
                location: 'Section One',
                instruction: 'Improve the Section One content'
            };

            const mockEditor = mockDocumentEngine.getActiveEditor() as any;
            
            const result = await editCommand.execute(command);

            expect(result.success).toBe(true);
            expect(mockDocumentEngine.findSection).toHaveBeenCalledWith('Section One');
            expect(mockEditor.replaceRange).toHaveBeenCalledWith(
                '## Section One\n\nImproved content',
                { line: 4, ch: 0 },
                { line: 8, ch: 0 }
            );
        });

        it('should edit paragraph at cursor position', async () => {
            const command: EditCommandType = {
                action: 'edit',
                target: 'paragraph',
                instruction: 'Improve this paragraph'
            };

            const result = await editCommand.execute(command);

            expect(result.success).toBe(true);
            expect(mockDocumentEngine.applyEdit).toHaveBeenCalledWith(
                'Improved content',
                'cursor',
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
                { scrollToEdit: true, selectNewText: false }
            );
        });

        it('should handle no active document', async () => {
            mockDocumentEngine.getDocumentContext.mockResolvedValue(null);

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
            mockDocumentEngine.getDocumentContext.mockResolvedValue(contextWithoutSelection);

            const command: EditCommandType = {
                action: 'edit',
                target: 'selection',
                instruction: 'Edit selected text'
            };

            const result = await editCommand.execute(command);

            expect(result.success).toBe(false);
            expect(result.error).toBe('This command requires text to be selected first');
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

        it('should handle section not found', async () => {
            mockDocumentEngine.findSection.mockResolvedValue(null);

            const command: EditCommandType = {
                action: 'edit',
                target: 'section',
                location: 'Nonexistent Section',
                instruction: 'Edit missing section'
            };

            const result = await editCommand.execute(command);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Section "Nonexistent Section" not found');
        });

        it('should handle no active editor for section editing', async () => {
            mockDocumentEngine.getActiveEditor.mockReturnValue(null);

            const command: EditCommandType = {
                action: 'edit',
                target: 'section',
                location: 'Section One',
                instruction: 'Edit section'
            };

            const result = await editCommand.execute(command);

            expect(result.success).toBe(false);
            expect(result.error).toBe('No active editor');
        });

        it('should handle exceptions during execution', async () => {
            mockDocumentEngine.getDocumentContext.mockRejectedValue(new Error('File system error'));

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

    describe('validateCommand', () => {
        it('should accept edit command with selection when text is selected', () => {
            const command: EditCommandType = {
                action: 'edit',
                target: 'selection',
                instruction: 'Edit selected text'
            };

            const validation = editCommand.validateCommand(command, true);

            expect(validation.valid).toBe(true);
            expect(validation.error).toBeUndefined();
        });

        it('should reject edit command with selection when no text is selected', () => {
            const command: EditCommandType = {
                action: 'edit',
                target: 'selection',
                instruction: 'Edit selected text'
            };

            const validation = editCommand.validateCommand(command, false);

            expect(validation.valid).toBe(false);
            expect(validation.error).toBe('This command requires text to be selected first');
        });

        it('should accept edit command with section target and location', () => {
            const command: EditCommandType = {
                action: 'edit',
                target: 'section',
                location: 'Introduction',
                instruction: 'Edit the introduction'
            };

            const validation = editCommand.validateCommand(command, false);

            expect(validation.valid).toBe(true);
            expect(validation.error).toBeUndefined();
        });

        it('should accept edit command with valid targets', () => {
            const validTargets: EditCommandType['target'][] = ['paragraph', 'document', 'end'];

            validTargets.forEach(target => {
                const command: EditCommandType = {
                    action: 'edit',
                    target,
                    instruction: 'Edit content'
                };

                const validation = editCommand.validateCommand(command, false);
                expect(validation.valid).toBe(true);
            });
        });
    });

    describe('getSuggestions', () => {
        it('should provide suggestions for selected text', () => {
            const suggestions = editCommand.getSuggestions(mockDocumentContext, true);

            expect(suggestions).toContain('Make this more concise');
            expect(suggestions).toContain('Make this more professional');
            expect(suggestions).toContain('Improve clarity and flow');
            expect(suggestions.length).toBeLessThanOrEqual(10);
        });

        it('should provide general document suggestions when no selection', () => {
            const suggestions = editCommand.getSuggestions(mockDocumentContext, false);

            expect(suggestions).toContain('Improve the writing style');
            expect(suggestions).toContain('Make the document more professional');
            expect(suggestions).toContain('Enhance clarity throughout');
            expect(suggestions.length).toBeLessThanOrEqual(10);
        });

        it('should include section-specific suggestions', () => {
            const suggestions = editCommand.getSuggestions(mockDocumentContext, false);

            expect(suggestions).toContain('Improve the "Main Document" section');
            expect(suggestions).toContain('Improve the "Section One" section');
            // Note: May be truncated due to 10-item limit, check if any section suggestions exist
            const hasSectionSuggestions = suggestions.some(s => s.includes('section'));
            expect(hasSectionSuggestions).toBe(true);
        });

        it('should handle document without headings', () => {
            const contextWithoutHeadings = {
                ...mockDocumentContext,
                headings: []
            };

            const suggestions = editCommand.getSuggestions(contextWithoutHeadings, false);

            expect(suggestions.length).toBeGreaterThan(0);
            expect(suggestions).toContain('Improve the writing style');
            expect(suggestions).not.toContain('Improve the "Section One" section');
        });
    });

    describe('preview', () => {
        it('should preview editing selected text', async () => {
            const command: EditCommandType = {
                action: 'edit',
                target: 'selection',
                instruction: 'Make this more professional'
            };

            const preview = await editCommand.preview(command);

            expect(preview.success).toBe(true);
            expect(preview.preview).toBe('Will edit the selected text');
            expect(preview.affectedContent).toBe('This is the introduction paragraph.');
        });

        it('should preview editing specific section', async () => {
            const command: EditCommandType = {
                action: 'edit',
                target: 'section',
                location: 'Section One',
                instruction: 'Improve the section'
            };

            const preview = await editCommand.preview(command);

            expect(preview.success).toBe(true);
            expect(preview.preview).toBe('Will edit the entire "Section One" section');
            expect(preview.affectedContent).toContain('Content for section one goes here');
        });

        it('should preview editing paragraph', async () => {
            const mockEditor = {
                getLine: jest.fn().mockReturnValue('Current line content')
            };
            mockDocumentEngine.getActiveEditor.mockReturnValue(mockEditor as any);

            const command: EditCommandType = {
                action: 'edit',
                target: 'paragraph',
                instruction: 'Improve paragraph'
            };

            const preview = await editCommand.preview(command);

            expect(preview.success).toBe(true);
            expect(preview.preview).toBe('Will edit content at cursor position');
            expect(preview.affectedContent).toBe('Current line content');
        });

        it('should preview editing entire document', async () => {
            const command: EditCommandType = {
                action: 'edit',
                target: 'document',
                instruction: 'Improve document'
            };

            const preview = await editCommand.preview(command);

            expect(preview.success).toBe(true);
            expect(preview.preview).toBe('Will edit the entire document');
            expect(preview.affectedContent).toContain('# Main Document');
        });

        it('should handle preview when no text is selected', async () => {
            const contextWithoutSelection = {
                ...mockDocumentContext,
                selectedText: undefined
            };
            mockDocumentEngine.getDocumentContext.mockResolvedValue(contextWithoutSelection);

            const command: EditCommandType = {
                action: 'edit',
                target: 'selection',
                instruction: 'Edit selection'
            };

            const preview = await editCommand.preview(command);

            expect(preview.success).toBe(false);
            expect(preview.error).toBe('No text is currently selected');
        });

        it('should handle preview when section not found', async () => {
            mockDocumentEngine.findSection.mockResolvedValue(null);

            const command: EditCommandType = {
                action: 'edit',
                target: 'section',
                location: 'Missing Section',
                instruction: 'Edit section'
            };

            const preview = await editCommand.preview(command);

            expect(preview.success).toBe(false);
            expect(preview.error).toBe('Section "Missing Section" not found');
        });

        it('should handle preview when no document is active', async () => {
            mockDocumentEngine.getDocumentContext.mockResolvedValue(null);

            const command: EditCommandType = {
                action: 'edit',
                target: 'document',
                instruction: 'Edit document'
            };

            const preview = await editCommand.preview(command);

            expect(preview.success).toBe(false);
            expect(preview.error).toBe('No active document found');
        });

        it('should truncate long affected content', async () => {
            const longContent = 'A'.repeat(300);
            const contextWithLongContent = {
                ...mockDocumentContext,
                selectedText: longContent
            };
            mockDocumentEngine.getDocumentContext.mockResolvedValue(contextWithLongContent);

            const command: EditCommandType = {
                action: 'edit',
                target: 'selection',
                instruction: 'Edit long text'
            };

            const preview = await editCommand.preview(command);

            expect(preview.success).toBe(true);
            expect(preview.affectedContent).toHaveLength(203); // 200 + '...'
            expect(preview.affectedContent?.endsWith('...')).toBe(true);
        });
    });

    describe('getAvailableTargets', () => {
        it('should return all targets when text is selected and headings exist', () => {
            const targets = editCommand.getAvailableTargets(mockDocumentContext);

            expect(targets).toEqual(['selection', 'paragraph', 'section', 'document', 'end']);
        });

        it('should exclude selection when no text is selected', () => {
            const contextWithoutSelection = {
                ...mockDocumentContext,
                selectedText: undefined
            };

            const targets = editCommand.getAvailableTargets(contextWithoutSelection);

            expect(targets).toEqual(['paragraph', 'section', 'document', 'end']);
            expect(targets).not.toContain('selection');
        });

        it('should exclude section when no headings exist', () => {
            const contextWithoutHeadings = {
                ...mockDocumentContext,
                headings: []
            };

            const targets = editCommand.getAvailableTargets(contextWithoutHeadings);

            expect(targets).toEqual(['selection', 'paragraph', 'document', 'end']);
            expect(targets).not.toContain('section');
        });

        it('should return basic targets when no selection or headings', () => {
            const minimalContext = {
                ...mockDocumentContext,
                selectedText: undefined,
                headings: []
            };

            const targets = editCommand.getAvailableTargets(minimalContext);

            expect(targets).toEqual(['paragraph', 'document', 'end']);
        });
    });

    describe('estimateScope', () => {
        it('should estimate scope for selected text', async () => {
            const command: EditCommandType = {
                action: 'edit',
                target: 'selection',
                instruction: 'Edit selection'
            };

            const scope = await editCommand.estimateScope(command);

            expect(scope.charactersAffected).toBe(35); // Length of selected text
            expect(scope.linesAffected).toBe(1);
            expect(scope.scopeDescription).toBe('Selected text only');
        });

        it('should estimate scope for section', async () => {
            const command: EditCommandType = {
                action: 'edit',
                target: 'section',
                location: 'Section One',
                instruction: 'Edit section'
            };

            const scope = await editCommand.estimateScope(command);

            expect(scope.charactersAffected).toBe(62); // Length of section content
            expect(scope.linesAffected).toBe(3); // range.end - range.start
            expect(scope.scopeDescription).toBe('"Section One" section');
        });

        it('should estimate scope for paragraph', async () => {
            const command: EditCommandType = {
                action: 'edit',
                target: 'paragraph',
                instruction: 'Edit paragraph'
            };

            const scope = await editCommand.estimateScope(command);

            expect(scope.charactersAffected).toBe(100); // Rough estimate
            expect(scope.linesAffected).toBe(1);
            expect(scope.scopeDescription).toBe('Current paragraph');
        });

        it('should estimate scope for entire document', async () => {
            const command: EditCommandType = {
                action: 'edit',
                target: 'document',
                instruction: 'Edit document'
            };

            const scope = await editCommand.estimateScope(command);

            expect(scope.charactersAffected).toBe(mockDocumentContext.content.length);
            expect(scope.linesAffected).toBe(mockDocumentContext.content.split('\n').length);
            expect(scope.scopeDescription).toBe('Entire document');
        });

        it('should estimate scope for end target', async () => {
            const command: EditCommandType = {
                action: 'edit',
                target: 'end',
                instruction: 'Edit at end'
            };

            const scope = await editCommand.estimateScope(command);

            expect(scope.charactersAffected).toBe(0);
            expect(scope.linesAffected).toBe(0);
            expect(scope.scopeDescription).toBe('New content at end');
        });

        it('should handle no document available', async () => {
            mockDocumentEngine.getDocumentContext.mockResolvedValue(null);

            const command: EditCommandType = {
                action: 'edit',
                target: 'selection',
                instruction: 'Edit content'
            };

            const scope = await editCommand.estimateScope(command);

            expect(scope.charactersAffected).toBe(0);
            expect(scope.linesAffected).toBe(0);
            expect(scope.scopeDescription).toBe('No document available');
        });
    });
});