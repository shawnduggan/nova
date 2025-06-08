/**
 * Tests for AddCommand
 */

import { AddCommand } from '../../../src/core/commands/add-command';
import { DocumentEngine } from '../../../src/core/document-engine';
import { ContextBuilder } from '../../../src/core/context-builder';
import { AIProviderManager } from '../../../src/ai/provider-manager';
import { EditCommand, DocumentContext, EditResult } from '../../../src/core/types';
import { App, TFile } from '../../mocks/obsidian-mock';

// Mock the dependencies
jest.mock('../../../src/core/document-engine');
jest.mock('../../../src/core/context-builder');
jest.mock('../../../src/ai/provider-manager');

describe('AddCommand', () => {
    let addCommand: AddCommand;
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

This is the introduction.

## Section One

Content for section one.

## Section Two

Content for section two.`,
            headings: [
                { text: 'Main Document', level: 1, line: 0, position: { start: 0, end: 15 } },
                { text: 'Section One', level: 2, line: 4, position: { start: 50, end: 63 } },
                { text: 'Section Two', level: 2, line: 8, position: { start: 100, end: 113 } }
            ],
            cursorPosition: { line: 6, ch: 10 }
        };

        addCommand = new AddCommand(
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
        
        mockProviderManager.generateText.mockResolvedValue('Generated content');
        
        mockDocumentEngine.applyEdit.mockResolvedValue({
            success: true,
            content: 'Generated content',
            editType: 'insert',
            appliedAt: { line: 10, ch: 0 }
        });
        
        mockDocumentEngine.findSection.mockResolvedValue({
            heading: 'Section One',
            level: 2,
            content: 'Content for section one.',
            range: { start: 4, end: 7 }
        });
    });

    describe('execute', () => {
        it('should successfully add content at end of document', async () => {
            const command: EditCommand = {
                action: 'add',
                target: 'end',
                instruction: 'Add a conclusion section'
            };

            const result = await addCommand.execute(command);

            expect(result.success).toBe(true);
            expect(result.content).toBe('Generated content');
            expect(result.editType).toBe('insert');
            expect(mockDocumentEngine.applyEdit).toHaveBeenCalledWith(
                'Generated content',
                'end',
                { scrollToEdit: true, selectNewText: false }
            );
        });

        it('should add content to specific section', async () => {
            const command: EditCommand = {
                action: 'add',
                target: 'section',
                location: 'Section One',
                instruction: 'Add content to Section One'
            };

            const result = await addCommand.execute(command);

            expect(result.success).toBe(true);
            expect(mockDocumentEngine.findSection).toHaveBeenCalledWith('Section One');
            expect(mockDocumentEngine.applyEdit).toHaveBeenCalledWith(
                'Generated content',
                { line: 7, ch: 0 },
                { scrollToEdit: true, selectNewText: false }
            );
        });

        it('should add content at cursor for paragraph target', async () => {
            const command: EditCommand = {
                action: 'add',
                target: 'paragraph',
                instruction: 'Add a new paragraph'
            };

            const result = await addCommand.execute(command);

            expect(result.success).toBe(true);
            expect(mockDocumentEngine.applyEdit).toHaveBeenCalledWith(
                'Generated content',
                'cursor',
                { scrollToEdit: true, selectNewText: false }
            );
        });

        it('should handle no active document', async () => {
            mockDocumentEngine.getDocumentContext.mockResolvedValue(null);

            const command: EditCommand = {
                action: 'add',
                target: 'end',
                instruction: 'Add content'
            };

            const result = await addCommand.execute(command);

            expect(result.success).toBe(false);
            expect(result.error).toBe('No active document found');
            expect(result.editType).toBe('insert');
        });

        it('should handle prompt validation failure', async () => {
            mockContextBuilder.validatePrompt.mockReturnValue({
                valid: false,
                issues: ['System prompt is empty']
            });

            const command: EditCommand = {
                action: 'add',
                target: 'end',
                instruction: 'Add content'
            };

            const result = await addCommand.execute(command);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Prompt validation failed: System prompt is empty');
        });

        it('should handle no AI provider available', async () => {
            mockProviderManager.generateText.mockRejectedValue(new Error('Nova is disabled or no AI provider is available'));

            const command: EditCommand = {
                action: 'add',
                target: 'end',
                instruction: 'Add content'
            };

            const result = await addCommand.execute(command);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Nova is disabled or no AI provider is available');
        });

        it('should handle AI completion failure', async () => {
            mockProviderManager.generateText.mockRejectedValue(new Error('API rate limit exceeded'));

            const command: EditCommand = {
                action: 'add',
                target: 'end',
                instruction: 'Add content'
            };

            const result = await addCommand.execute(command);

            expect(result.success).toBe(false);
            expect(result.error).toBe('API rate limit exceeded');
        });

        it('should handle empty AI content', async () => {
            mockProviderManager.generateText.mockResolvedValue('');

            const command: EditCommand = {
                action: 'add',
                target: 'end',
                instruction: 'Add content'
            };

            const result = await addCommand.execute(command);

            expect(result.success).toBe(false);
            expect(result.error).toBe('AI provider returned empty content');
        });

        it('should handle document engine error', async () => {
            mockDocumentEngine.applyEdit.mockResolvedValue({
                success: false,
                error: 'Document is read-only',
                editType: 'insert'
            });

            const command: EditCommand = {
                action: 'add',
                target: 'end',
                instruction: 'Add content'
            };

            const result = await addCommand.execute(command);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Document is read-only');
        });

        it('should fallback to cursor when section not found', async () => {
            mockDocumentEngine.findSection.mockResolvedValue(null);

            const command: EditCommand = {
                action: 'add',
                target: 'section',
                location: 'Nonexistent Section',
                instruction: 'Add content to missing section'
            };

            const result = await addCommand.execute(command);

            expect(result.success).toBe(true);
            expect(mockDocumentEngine.applyEdit).toHaveBeenCalledWith(
                'Generated content',
                'cursor',
                { scrollToEdit: true, selectNewText: false }
            );
        });

        it('should handle exceptions during execution', async () => {
            mockDocumentEngine.getDocumentContext.mockRejectedValue(new Error('File system error'));

            const command: EditCommand = {
                action: 'add',
                target: 'end',
                instruction: 'Add content'
            };

            const result = await addCommand.execute(command);

            expect(result.success).toBe(false);
            expect(result.error).toBe('File system error');
        });
    });

    describe('validateCommand', () => {
        it('should reject add command with selection target', () => {
            const command: EditCommand = {
                action: 'add',
                target: 'selection',
                instruction: 'Add to selection'
            };

            const validation = addCommand.validateCommand(command, true);

            expect(validation.valid).toBe(false);
            expect(validation.error).toBe('Cannot add content to a selection. Use "edit" to modify selected text');
        });

        it('should accept add command with section target without location', () => {
            const command: EditCommand = {
                action: 'add',
                target: 'section',
                instruction: 'Add to current section'
            };

            const validation = addCommand.validateCommand(command, false);

            expect(validation.valid).toBe(true);
            expect(validation.error).toBeUndefined();
        });

        it('should accept add command with valid targets', () => {
            const validTargets: EditCommand['target'][] = ['end', 'section', 'paragraph', 'document'];

            validTargets.forEach(target => {
                const command: EditCommand = {
                    action: 'add',
                    target,
                    instruction: 'Add content'
                };

                const validation = addCommand.validateCommand(command, false);
                expect(validation.valid).toBe(true);
            });
        });
    });

    describe('getSuggestions', () => {
        it('should provide basic suggestions', () => {
            const suggestions = addCommand.getSuggestions(mockDocumentContext);

            expect(suggestions).toContain('Add a conclusion section');
            expect(suggestions).toContain('Create a summary');
            expect(suggestions).toContain('Add examples');
            expect(suggestions.length).toBeLessThanOrEqual(8);
        });

        it('should suggest introduction if missing', () => {
            const contextWithoutIntro = {
                ...mockDocumentContext,
                headings: [
                    { text: 'Methods', level: 2, line: 0, position: { start: 0, end: 8 } },
                    { text: 'Results', level: 2, line: 4, position: { start: 50, end: 58 } }
                ]
            };

            const suggestions = addCommand.getSuggestions(contextWithoutIntro);

            expect(suggestions[0]).toBe('Add an introduction section');
        });

        it('should suggest conclusion if missing', () => {
            const contextWithoutConclusion = {
                ...mockDocumentContext,
                headings: [
                    { text: 'Introduction', level: 2, line: 0, position: { start: 0, end: 12 } },
                    { text: 'Methods', level: 2, line: 4, position: { start: 50, end: 58 } }
                ]
            };

            const suggestions = addCommand.getSuggestions(contextWithoutConclusion);

            expect(suggestions).toContain('Add a conclusion section');
        });

        it('should handle document without headings', () => {
            const contextWithoutHeadings = {
                ...mockDocumentContext,
                headings: []
            };

            const suggestions = addCommand.getSuggestions(contextWithoutHeadings);

            expect(suggestions.length).toBeGreaterThan(0);
            expect(suggestions).toContain('Add a conclusion section');
            expect(suggestions).toContain('Add an introduction');
        });
    });

    describe('preview', () => {
        it('should preview adding to end of document', async () => {
            const command: EditCommand = {
                action: 'add',
                target: 'end',
                instruction: 'Add conclusion'
            };

            const preview = await addCommand.preview(command);

            expect(preview.success).toBe(true);
            expect(preview.position).toBe('at the end of the document');
            expect(preview.preview).toContain('at the end of the document');
        });

        it('should preview adding to specific section', async () => {
            const command: EditCommand = {
                action: 'add',
                target: 'section',
                location: 'Introduction',
                instruction: 'Add to intro'
            };

            const preview = await addCommand.preview(command);

            expect(preview.success).toBe(true);
            expect(preview.position).toBe('in the "Introduction" section');
            expect(preview.preview).toContain('in the "Introduction" section');
        });

        it('should preview adding at cursor position', async () => {
            const command: EditCommand = {
                action: 'add',
                target: 'paragraph',
                instruction: 'Add paragraph'
            };

            const preview = await addCommand.preview(command);

            expect(preview.success).toBe(true);
            expect(preview.position).toBe('at the cursor position');
        });

        it('should handle preview when no document is active', async () => {
            mockDocumentEngine.getDocumentContext.mockResolvedValue(null);

            const command: EditCommand = {
                action: 'add',
                target: 'end',
                instruction: 'Add content'
            };

            const preview = await addCommand.preview(command);

            expect(preview.success).toBe(false);
            expect(preview.error).toBe('No active document found');
        });

        it('should handle preview errors', async () => {
            mockDocumentEngine.getDocumentContext.mockRejectedValue(new Error('Preview failed'));

            const command: EditCommand = {
                action: 'add',
                target: 'end',
                instruction: 'Add content'
            };

            const preview = await addCommand.preview(command);

            expect(preview.success).toBe(false);
            expect(preview.error).toBe('Preview failed');
        });
    });

    describe('determineInsertPosition', () => {
        it('should determine correct positions for different targets', async () => {
            const testCases = [
                { target: 'end' as const, expected: 'end' },
                { target: 'paragraph' as const, expected: 'cursor' },
                { target: 'document' as const, expected: 'end' }
            ];

            for (const testCase of testCases) {
                const command: EditCommand = {
                    action: 'add',
                    target: testCase.target,
                    instruction: 'Test command'
                };

                const position = await (addCommand as any).determineInsertPosition(command, mockDocumentContext);
                expect(position).toBe(testCase.expected);
            }
        });

        it('should find section position when location is provided', async () => {
            const command: EditCommand = {
                action: 'add',
                target: 'section',
                location: 'Section One',
                instruction: 'Add to section'
            };

            const position = await (addCommand as any).determineInsertPosition(command, mockDocumentContext);
            expect(position).toEqual({ line: 7, ch: 0 });
            expect(mockDocumentEngine.findSection).toHaveBeenCalledWith('Section One');
        });

        it('should fallback to cursor when section not found', async () => {
            mockDocumentEngine.findSection.mockResolvedValue(null);

            const command: EditCommand = {
                action: 'add',
                target: 'section',
                location: 'Missing Section',
                instruction: 'Add to missing section'
            };

            const position = await (addCommand as any).determineInsertPosition(command, mockDocumentContext);
            expect(position).toBe('cursor');
        });
    });
});