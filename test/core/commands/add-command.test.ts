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
        mockDocumentEngine.getDocumentContext.mockReturnValue(mockDocumentContext);
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
        
        // Remove findSection mock - not used in cursor-only system
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
                { scrollToEdit: true, selectNewText: true }
            );
        });

        it('should add content at cursor position', async () => {
            const command: EditCommand = {
                action: 'add',
                target: 'cursor',
                instruction: 'Add content at cursor'
            };

            const result = await addCommand.execute(command);

            expect(result.success).toBe(true);
            expect(mockDocumentEngine.applyEdit).toHaveBeenCalledWith(
                'Generated content',
                'cursor',
                { scrollToEdit: true, selectNewText: true }
            );
        });

        it('should add content to document', async () => {
            const command: EditCommand = {
                action: 'add',
                target: 'document',
                instruction: 'Add content to document'
            };

            const result = await addCommand.execute(command);

            expect(result.success).toBe(true);
            expect(mockDocumentEngine.applyEdit).toHaveBeenCalledWith(
                'Generated content',
                'end',
                { scrollToEdit: true, selectNewText: true }
            );
        });

        it('should handle no active document', async () => {
            mockDocumentEngine.getDocumentContext.mockReturnValue(null);

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

        it('should handle selection target insertion', async () => {
            const command: EditCommand = {
                action: 'add',
                target: 'selection',
                instruction: 'Add content to selection'
            };

            const result = await addCommand.execute(command);

            expect(result.success).toBe(true);
            expect(mockDocumentEngine.applyEdit).toHaveBeenCalledWith(
                'Generated content',
                'cursor',
                { scrollToEdit: true, selectNewText: true }
            );
        });

        it('should handle exceptions during execution', async () => {
            mockDocumentEngine.getDocumentContext.mockImplementation(() => { throw new Error('File system error'); });

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

    describe('command validation', () => {
        it('should execute commands with valid targets', async () => {
            const testCases = [
                { target: 'end' as const, expectedPosition: 'end' },
                { target: 'cursor' as const, expectedPosition: 'cursor' },
                { target: 'document' as const, expectedPosition: 'end' },
                { target: 'selection' as const, expectedPosition: 'cursor' }
            ];

            for (const testCase of testCases) {
                const command: EditCommand = {
                    action: 'add',
                    target: testCase.target,
                    instruction: 'Add content'
                };

                const result = await addCommand.execute(command);
                expect(result.success).toBe(true);
                expect(mockDocumentEngine.applyEdit).toHaveBeenCalledWith(
                    'Generated content',
                    testCase.expectedPosition,
                    { scrollToEdit: true, selectNewText: true }
                );
            }
        });
    });
});