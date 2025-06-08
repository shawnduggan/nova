/**
 * Tests for RewriteCommand
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
        mockDocumentEngine.getDocumentContext.mockResolvedValue(mockDocumentContext);
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
        
        mockDocumentEngine.setDocumentContent.mockResolvedValue({
            success: true,
            content: 'Rewritten document content',
            editType: 'replace'
        });
        
        mockDocumentEngine.findSection.mockResolvedValue({
            heading: '## Section One',
            level: 2,
            content: 'Content for section one goes here.\nIt has verbose and complex sentences.',
            range: { start: 4, end: 7 }
        });

        // Mock editor for section and paragraph rewriting
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
        it('should successfully rewrite selected text', async () => {
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

        it('should successfully rewrite a specific section', async () => {
            const command: EditCommandType = {
                action: 'rewrite',
                target: 'section',
                location: 'Section One',
                instruction: 'Rewrite in a more concise style'
            };

            const mockEditor = mockDocumentEngine.getActiveEditor() as any;
            
            const result = await rewriteCommand.execute(command);

            expect(result.success).toBe(true);
            expect(mockDocumentEngine.findSection).toHaveBeenCalledWith('Section One');
            expect(mockEditor.replaceRange).toHaveBeenCalledWith(
                '## Section One\n\nThis is a modern introduction paragraph with contemporary language.',
                { line: 4, ch: 0 },
                { line: 8, ch: 0 }
            );
        });

        it('should rewrite paragraph at cursor position', async () => {
            const command: EditCommandType = {
                action: 'rewrite',
                target: 'paragraph',
                instruction: 'Rewrite this paragraph for clarity'
            };

            const mockEditor = mockDocumentEngine.getActiveEditor() as any;
            
            const result = await rewriteCommand.execute(command);

            expect(result.success).toBe(true);
            expect(mockEditor.replaceRange).toHaveBeenCalledWith(
                'This is a modern introduction paragraph with contemporary language.',
                { line: 2, ch: 0 },
                { line: 2, ch: 63 }
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

        it('should handle rewriting at end of document', async () => {
            const command: EditCommandType = {
                action: 'rewrite',
                target: 'end',
                instruction: 'Add rewritten conclusion at the end'
            };

            const result = await rewriteCommand.execute(command);

            expect(result.success).toBe(true);
            expect(mockDocumentEngine.applyEdit).toHaveBeenCalledWith(
                'This is a modern introduction paragraph with contemporary language.',
                'end',
                { scrollToEdit: true, selectNewText: false }
            );
        });

        it('should handle no active document', async () => {
            mockDocumentEngine.getDocumentContext.mockResolvedValue(null);

            const command: EditCommandType = {
                action: 'rewrite',
                target: 'selection',
                instruction: 'Rewrite content'
            };

            const result = await rewriteCommand.execute(command);

            expect(result.success).toBe(false);
            expect(result.error).toBe('No active document found');
            expect(result.editType).toBe('replace');
        });

        it('should handle validation failure for selection without text', async () => {
            const contextWithoutSelection = {
                ...mockDocumentContext,
                selectedText: undefined
            };
            mockDocumentEngine.getDocumentContext.mockResolvedValue(contextWithoutSelection);

            const command: EditCommandType = {
                action: 'rewrite',
                target: 'selection',
                instruction: 'Rewrite selected text'
            };

            const result = await rewriteCommand.execute(command);

            expect(result.success).toBe(false);
            expect(result.error).toBe('This command requires text to be selected first');
        });

        it('should handle prompt validation failure', async () => {
            mockContextBuilder.validatePrompt.mockReturnValue({
                valid: false,
                issues: ['System prompt is empty']
            });

            const command: EditCommandType = {
                action: 'rewrite',
                target: 'selection',
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
                target: 'selection',
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
                target: 'selection',
                instruction: 'Rewrite content'
            };

            const result = await rewriteCommand.execute(command);

            expect(result.success).toBe(false);
            expect(result.error).toBe('AI provider returned empty content');
        });

        it('should handle section not found', async () => {
            mockDocumentEngine.findSection.mockResolvedValue(null);

            const command: EditCommandType = {
                action: 'rewrite',
                target: 'section',
                location: 'Nonexistent Section',
                instruction: 'Rewrite missing section'
            };

            const result = await rewriteCommand.execute(command);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Section "Nonexistent Section" not found');
        });

        it('should handle no active editor for section rewriting', async () => {
            mockDocumentEngine.getActiveEditor.mockReturnValue(null);

            const command: EditCommandType = {
                action: 'rewrite',
                target: 'section',
                location: 'Section One',
                instruction: 'Rewrite section'
            };

            const result = await rewriteCommand.execute(command);

            expect(result.success).toBe(false);
            expect(result.error).toBe('No active editor');
        });

        it('should handle no active editor for paragraph rewriting', async () => {
            mockDocumentEngine.getActiveEditor.mockReturnValue(null);

            const command: EditCommandType = {
                action: 'rewrite',
                target: 'paragraph',
                instruction: 'Rewrite paragraph'
            };

            const result = await rewriteCommand.execute(command);

            expect(result.success).toBe(false);
            expect(result.error).toBe('No active editor');
        });

        it('should handle no cursor position for paragraph rewriting', async () => {
            const contextWithoutCursor = {
                ...mockDocumentContext,
                cursorPosition: undefined
            };
            mockDocumentEngine.getDocumentContext.mockResolvedValue(contextWithoutCursor);

            const command: EditCommandType = {
                action: 'rewrite',
                target: 'paragraph',
                instruction: 'Rewrite paragraph'
            };

            const result = await rewriteCommand.execute(command);

            expect(result.success).toBe(false);
            expect(result.error).toBe('No cursor position available');
        });

        it('should handle exceptions during execution', async () => {
            mockDocumentEngine.getDocumentContext.mockRejectedValue(new Error('File system error'));

            const command: EditCommandType = {
                action: 'rewrite',
                target: 'selection',
                instruction: 'Rewrite content'
            };

            const result = await rewriteCommand.execute(command);

            expect(result.success).toBe(false);
            expect(result.error).toBe('File system error');
        });

        it('should handle paragraph rewriting with complex boundaries', async () => {
            const complexContent = `# Title

First paragraph here.

Second paragraph
continues on multiple lines
and has detailed content.

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
                action: 'rewrite',
                target: 'paragraph',
                instruction: 'Rewrite current paragraph'
            };

            const result = await rewriteCommand.execute(command);

            expect(result.success).toBe(true);
            // Should rewrite the multi-line paragraph (lines 4-6)
            expect(mockEditor.replaceRange).toHaveBeenCalledWith(
                'This is a modern introduction paragraph with contemporary language.',
                { line: 4, ch: 0 },
                { line: 6, ch: 25 } // End of last line in paragraph
            );
        });
    });

    describe('validateCommand', () => {
        it('should accept rewrite command with selection when text is selected', () => {
            const command: EditCommandType = {
                action: 'rewrite',
                target: 'selection',
                instruction: 'Rewrite selected text'
            };

            const validation = rewriteCommand.validateCommand(command, true);

            expect(validation.valid).toBe(true);
            expect(validation.error).toBeUndefined();
        });

        it('should reject rewrite command with selection when no text is selected', () => {
            const command: EditCommandType = {
                action: 'rewrite',
                target: 'selection',
                instruction: 'Rewrite selected text'
            };

            const validation = rewriteCommand.validateCommand(command, false);

            expect(validation.valid).toBe(false);
            expect(validation.error).toBe('This command requires text to be selected first');
        });

        it('should accept rewrite command with section target and location', () => {
            const command: EditCommandType = {
                action: 'rewrite',
                target: 'section',
                location: 'Introduction',
                instruction: 'Rewrite the introduction'
            };

            const validation = rewriteCommand.validateCommand(command, false);

            expect(validation.valid).toBe(true);
            expect(validation.error).toBeUndefined();
        });

        it('should accept rewrite command with valid targets', () => {
            const validTargets: EditCommandType['target'][] = ['paragraph', 'document', 'end'];

            validTargets.forEach(target => {
                const command: EditCommandType = {
                    action: 'rewrite',
                    target,
                    instruction: 'Rewrite content'
                };

                const validation = rewriteCommand.validateCommand(command, false);
                expect(validation.valid).toBe(true);
            });
        });
    });

    describe('getSuggestions', () => {
        it('should provide suggestions for selected text', () => {
            const suggestions = rewriteCommand.getSuggestions(mockDocumentContext, true);

            expect(suggestions).toContain('Rewrite in a more formal tone');
            expect(suggestions).toContain('Rewrite in a casual tone');
            expect(suggestions).toContain('Make this more concise');
            expect(suggestions).toContain('Expand with more detail');
            expect(suggestions).toContain('Rewrite for clarity');
            expect(suggestions.length).toBeLessThanOrEqual(10);
        });

        it('should provide general document suggestions when no selection', () => {
            const suggestions = rewriteCommand.getSuggestions(mockDocumentContext, false);

            expect(suggestions).toContain('Rewrite the current paragraph');
            expect(suggestions).toContain('Rewrite in a different style');
            expect(suggestions).toContain('Make the writing more engaging');
            expect(suggestions).toContain('Simplify complex language');
            expect(suggestions.length).toBeLessThanOrEqual(10);
        });

        it('should include section-specific suggestions', () => {
            const suggestions = rewriteCommand.getSuggestions(mockDocumentContext, false);

            expect(suggestions).toContain('Rewrite the "Main Document" section');
            expect(suggestions).toContain('Rewrite the "Section One" section');
            expect(suggestions).toContain('Rewrite the "Section Two" section');
        });

        it('should handle document without headings', () => {
            const contextWithoutHeadings = {
                ...mockDocumentContext,
                headings: []
            };

            const suggestions = rewriteCommand.getSuggestions(contextWithoutHeadings, false);

            expect(suggestions.length).toBeGreaterThan(0);
            expect(suggestions).toContain('Rewrite the current paragraph');
            expect(suggestions).not.toContain('Rewrite the "Section One" section');
        });
    });

    describe('preview', () => {
        it('should preview rewriting selected text', async () => {
            const command: EditCommandType = {
                action: 'rewrite',
                target: 'selection',
                instruction: 'Rewrite in formal tone'
            };

            const preview = await rewriteCommand.preview(command);

            expect(preview.success).toBe(true);
            expect(preview.preview).toBe('Will rewrite the selected text (formal tone)');
            expect(preview.affectedContent).toBe('This is the introduction paragraph with old-fashioned language.');
            expect(preview.rewriteStyle).toBe('formal tone');
        });

        it('should preview rewriting specific section', async () => {
            const command: EditCommandType = {
                action: 'rewrite',
                target: 'section',
                location: 'Section One',
                instruction: 'Rewrite to be more concise'
            };

            const preview = await rewriteCommand.preview(command);

            expect(preview.success).toBe(true);
            expect(preview.preview).toBe('Will rewrite the "Section One" section (more concise)');
            expect(preview.affectedContent).toContain('Content for section one goes here');
            expect(preview.rewriteStyle).toBe('more concise');
        });

        it('should preview rewriting paragraph', async () => {
            const command: EditCommandType = {
                action: 'rewrite',
                target: 'paragraph',
                instruction: 'Simplify the language'
            };

            const preview = await rewriteCommand.preview(command);

            expect(preview.success).toBe(true);
            expect(preview.preview).toBe('Will rewrite the current paragraph (simplified language)');
            expect(preview.affectedContent).toBe('This is the introduction paragraph with old-fashioned language.');
            expect(preview.rewriteStyle).toBe('simplified language');
        });

        it('should preview rewriting entire document', async () => {
            const command: EditCommandType = {
                action: 'rewrite',
                target: 'document',
                instruction: 'Make it more engaging'
            };

            const preview = await rewriteCommand.preview(command);

            expect(preview.success).toBe(true);
            expect(preview.preview).toBe('Will rewrite the entire document (more engaging)');
            expect(preview.affectedContent).toContain('# Main Document');
            expect(preview.rewriteStyle).toBe('more engaging');
        });

        it('should handle preview when no text is selected', async () => {
            const contextWithoutSelection = {
                ...mockDocumentContext,
                selectedText: undefined
            };
            mockDocumentEngine.getDocumentContext.mockResolvedValue(contextWithoutSelection);

            const command: EditCommandType = {
                action: 'rewrite',
                target: 'selection',
                instruction: 'Rewrite selection'
            };

            const preview = await rewriteCommand.preview(command);

            expect(preview.success).toBe(false);
            expect(preview.error).toBe('No text is currently selected');
        });

        it('should handle preview when section not found', async () => {
            mockDocumentEngine.findSection.mockResolvedValue(null);

            const command: EditCommandType = {
                action: 'rewrite',
                target: 'section',
                location: 'Missing Section',
                instruction: 'Rewrite section'
            };

            const preview = await rewriteCommand.preview(command);

            expect(preview.success).toBe(false);
            expect(preview.error).toBe('Section "Missing Section" not found');
        });

        it('should handle preview when no document is active', async () => {
            mockDocumentEngine.getDocumentContext.mockResolvedValue(null);

            const command: EditCommandType = {
                action: 'rewrite',
                target: 'document',
                instruction: 'Rewrite document'
            };

            const preview = await rewriteCommand.preview(command);

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
                action: 'rewrite',
                target: 'selection',
                instruction: 'Rewrite long text'
            };

            const preview = await rewriteCommand.preview(command);

            expect(preview.success).toBe(true);
            expect(preview.affectedContent).toHaveLength(203); // 200 + '...'
            expect(preview.affectedContent?.endsWith('...')).toBe(true);
        });

        it('should infer different rewrite styles correctly', async () => {
            const testCases = [
                { instruction: 'Make it casual', expectedStyle: 'casual tone' },
                { instruction: 'Expand with more details', expectedStyle: 'more detailed' },
                { instruction: 'Convert to bullet points', expectedStyle: 'bullet point format' },
                { instruction: 'Write in narrative style', expectedStyle: 'narrative style' },
                { instruction: 'Make it professional', expectedStyle: 'professional tone' },
                { instruction: 'Use technical language', expectedStyle: 'technical style' },
                { instruction: 'Be more creative', expectedStyle: 'creative style' }
            ];

            for (const testCase of testCases) {
                const command: EditCommandType = {
                    action: 'rewrite',
                    target: 'selection',
                    instruction: testCase.instruction
                };

                const preview = await rewriteCommand.preview(command);
                expect(preview.rewriteStyle).toBe(testCase.expectedStyle);
            }
        });
    });

    describe('getAvailableTargets', () => {
        it('should return all targets when text is selected and headings exist', () => {
            const targets = rewriteCommand.getAvailableTargets(mockDocumentContext);

            expect(targets).toEqual(['selection', 'paragraph', 'section', 'document', 'end']);
        });

        it('should exclude selection when no text is selected', () => {
            const contextWithoutSelection = {
                ...mockDocumentContext,
                selectedText: undefined
            };

            const targets = rewriteCommand.getAvailableTargets(contextWithoutSelection);

            expect(targets).toEqual(['paragraph', 'section', 'document', 'end']);
            expect(targets).not.toContain('selection');
        });

        it('should exclude section when no headings exist', () => {
            const contextWithoutHeadings = {
                ...mockDocumentContext,
                headings: []
            };

            const targets = rewriteCommand.getAvailableTargets(contextWithoutHeadings);

            expect(targets).toEqual(['selection', 'paragraph', 'document', 'end']);
            expect(targets).not.toContain('section');
        });

        it('should return basic targets when no selection or headings', () => {
            const minimalContext = {
                ...mockDocumentContext,
                selectedText: undefined,
                headings: []
            };

            const targets = rewriteCommand.getAvailableTargets(minimalContext);

            expect(targets).toEqual(['paragraph', 'document', 'end']);
        });
    });

    describe('estimateScope', () => {
        it('should estimate scope for selected text', async () => {
            const command: EditCommandType = {
                action: 'rewrite',
                target: 'selection',
                instruction: 'Rewrite selection'
            };

            const scope = await rewriteCommand.estimateScope(command);

            expect(scope.charactersAffected).toBe(63); // Length of selected text
            expect(scope.linesAffected).toBe(1);
            expect(scope.scopeDescription).toBe('Selected text only');
            expect(scope.rewriteComplexity).toBe('low');
        });

        it('should estimate scope for section', async () => {
            const command: EditCommandType = {
                action: 'rewrite',
                target: 'section',
                location: 'Section One',
                instruction: 'Rewrite section'
            };

            const scope = await rewriteCommand.estimateScope(command);

            expect(scope.charactersAffected).toBe(72); // Length of section content
            expect(scope.linesAffected).toBe(3); // range.end - range.start
            expect(scope.scopeDescription).toBe('"Section One" section');
            expect(scope.rewriteComplexity).toBe('low');
        });

        it('should estimate scope for paragraph', async () => {
            const command: EditCommandType = {
                action: 'rewrite',
                target: 'paragraph',
                instruction: 'Rewrite paragraph'
            };

            const scope = await rewriteCommand.estimateScope(command);

            expect(scope.charactersAffected).toBe(100); // Rough estimate
            expect(scope.linesAffected).toBe(1);
            expect(scope.scopeDescription).toBe('Current paragraph');
            expect(scope.rewriteComplexity).toBe('low');
        });

        it('should estimate scope for entire document', async () => {
            const command: EditCommandType = {
                action: 'rewrite',
                target: 'document',
                instruction: 'Rewrite document'
            };

            const scope = await rewriteCommand.estimateScope(command);

            expect(scope.charactersAffected).toBe(mockDocumentContext.content.length);
            expect(scope.linesAffected).toBe(mockDocumentContext.content.split('\n').length);
            expect(scope.scopeDescription).toBe('Entire document');
            expect(scope.rewriteComplexity).toBe('low'); // Document is small size
        });

        it('should estimate scope for end target', async () => {
            const command: EditCommandType = {
                action: 'rewrite',
                target: 'end',
                instruction: 'Add rewritten content at end'
            };

            const scope = await rewriteCommand.estimateScope(command);

            expect(scope.charactersAffected).toBe(0);
            expect(scope.linesAffected).toBe(0);
            expect(scope.scopeDescription).toBe('New content at end');
            expect(scope.rewriteComplexity).toBe('low');
        });

        it('should handle no document available', async () => {
            mockDocumentEngine.getDocumentContext.mockResolvedValue(null);

            const command: EditCommandType = {
                action: 'rewrite',
                target: 'selection',
                instruction: 'Rewrite content'
            };

            const scope = await rewriteCommand.estimateScope(command);

            expect(scope.charactersAffected).toBe(0);
            expect(scope.linesAffected).toBe(0);
            expect(scope.scopeDescription).toBe('No document available');
            expect(scope.rewriteComplexity).toBe('low');
        });

        it('should estimate high complexity for complex instructions', async () => {
            // Create a longer document to trigger high complexity
            const longContent = 'A'.repeat(1500);
            const contextWithLongContent = {
                ...mockDocumentContext,
                content: longContent
            };
            mockDocumentEngine.getDocumentContext.mockResolvedValue(contextWithLongContent);

            const command: EditCommandType = {
                action: 'rewrite',
                target: 'document',
                instruction: 'Completely restructure and transform for technical audience'
            };

            const scope = await rewriteCommand.estimateScope(command);

            expect(scope.rewriteComplexity).toBe('high');
        });

        it('should estimate medium complexity for moderate instructions', async () => {
            // Create medium-length content to trigger medium complexity
            const mediumContent = 'A'.repeat(500);
            const contextWithMediumContent = {
                ...mockDocumentContext,
                selectedText: mediumContent
            };
            mockDocumentEngine.getDocumentContext.mockResolvedValue(contextWithMediumContent);

            const command: EditCommandType = {
                action: 'rewrite',
                target: 'selection',
                instruction: 'Change the style to be more formal'
            };

            const scope = await rewriteCommand.estimateScope(command);

            expect(scope.rewriteComplexity).toBe('medium'); // Style change increases complexity
        });
    });

    describe('inferRewriteStyle', () => {
        it('should infer rewrite styles correctly', () => {
            const rewriteCommandInstance = rewriteCommand as any;
            
            expect(rewriteCommandInstance.inferRewriteStyle('Make it formal')).toBe('formal tone');
            expect(rewriteCommandInstance.inferRewriteStyle('Make it casual and friendly')).toBe('casual tone');
            expect(rewriteCommandInstance.inferRewriteStyle('Make this more concise')).toBe('more concise');
            expect(rewriteCommandInstance.inferRewriteStyle('Expand with more detail')).toBe('more detailed');
            expect(rewriteCommandInstance.inferRewriteStyle('Simplify the language')).toBe('simplified language');
            expect(rewriteCommandInstance.inferRewriteStyle('Make it more engaging')).toBe('more engaging');
            expect(rewriteCommandInstance.inferRewriteStyle('Use professional language')).toBe('professional tone');
            expect(rewriteCommandInstance.inferRewriteStyle('Convert to bullet points')).toBe('bullet point format');
            expect(rewriteCommandInstance.inferRewriteStyle('Write in narrative style')).toBe('narrative style');
            expect(rewriteCommandInstance.inferRewriteStyle('Use technical terms')).toBe('technical style');
            expect(rewriteCommandInstance.inferRewriteStyle('Be more creative')).toBe('creative style');
            expect(rewriteCommandInstance.inferRewriteStyle('Just improve it')).toBe('');
        });
    });

    describe('estimateComplexity', () => {
        it('should estimate complexity based on content length and instruction', () => {
            const rewriteCommandInstance = rewriteCommand as any;
            
            // Short content, simple instruction
            expect(rewriteCommandInstance.estimateComplexity('Short text', 'Make it better')).toBe('low');
            
            // Medium content, simple instruction
            const mediumContent = 'A'.repeat(500);
            expect(rewriteCommandInstance.estimateComplexity(mediumContent, 'Make it better')).toBe('medium');
            
            // Long content, simple instruction
            const longContent = 'A'.repeat(1500);
            expect(rewriteCommandInstance.estimateComplexity(longContent, 'Make it better')).toBe('high');
            
            // Short content, complex instruction
            expect(rewriteCommandInstance.estimateComplexity('Short text', 'Completely restructure for technical audience')).toBe('medium');
            
            // Medium content, complex instruction
            expect(rewriteCommandInstance.estimateComplexity(mediumContent, 'Transform to academic style')).toBe('high');
        });
    });
});