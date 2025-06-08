/**
 * Tests for GrammarCommand
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
        mockDocumentEngine.getDocumentContext.mockResolvedValue(mockDocumentContext);
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
        
        mockDocumentEngine.setDocumentContent.mockResolvedValue({
            success: true,
            content: 'Corrected document content',
            editType: 'replace'
        });
        
        mockDocumentEngine.findSection.mockResolvedValue({
            heading: '## Section One',
            level: 2,
            content: 'Content for section one goes here.\nIt has multiple paragraphs with corrected spacing.',
            range: { start: 4, end: 7 }
        });

        // Mock editor for section and paragraph grammar correction
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
            // Verify low temperature for grammar correction
            expect(mockProviderManager.generateText).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({ temperature: 0.3 })
            );
        });

        it('should successfully correct grammar in a specific section', async () => {
            const command: EditCommandType = {
                action: 'grammar',
                target: 'section',
                location: 'Section One',
                instruction: 'Fix grammar in Section One'
            };

            const mockEditor = mockDocumentEngine.getActiveEditor() as any;
            
            const result = await grammarCommand.execute(command);

            expect(result.success).toBe(true);
            expect(mockDocumentEngine.findSection).toHaveBeenCalledWith('Section One');
            expect(mockEditor.replaceRange).toHaveBeenCalledWith(
                '## Section One\n\nThis is the introduction paragraph with some corrections.',
                { line: 4, ch: 0 },
                { line: 8, ch: 0 }
            );
        });

        it('should correct grammar in paragraph at cursor position', async () => {
            const command: EditCommandType = {
                action: 'grammar',
                target: 'paragraph',
                instruction: 'Fix grammar in this paragraph'
            };

            const mockEditor = mockDocumentEngine.getActiveEditor() as any;
            
            const result = await grammarCommand.execute(command);

            expect(result.success).toBe(true);
            expect(mockEditor.replaceRange).toHaveBeenCalledWith(
                'This is the introduction paragraph with some corrections.',
                { line: 2, ch: 0 },
                { line: 2, ch: 52 }
            );
        });

        it('should correct grammar in entire document', async () => {
            const command: EditCommandType = {
                action: 'grammar',
                target: 'document',
                instruction: 'Fix grammar throughout the document'
            };

            const result = await grammarCommand.execute(command);

            expect(result.success).toBe(true);
            expect(mockDocumentEngine.setDocumentContent).toHaveBeenCalledWith('This is the introduction paragraph with some corrections.');
        });

        it('should handle grammar correction at end of document', async () => {
            const command: EditCommandType = {
                action: 'grammar',
                target: 'end',
                instruction: 'Add grammar-corrected content at the end'
            };

            const result = await grammarCommand.execute(command);

            expect(result.success).toBe(true);
            expect(mockDocumentEngine.applyEdit).toHaveBeenCalledWith(
                'This is the introduction paragraph with some corrections.',
                'end',
                { scrollToEdit: true, selectNewText: false }
            );
        });

        it('should handle no active document', async () => {
            mockDocumentEngine.getDocumentContext.mockResolvedValue(null);

            const command: EditCommandType = {
                action: 'grammar',
                target: 'selection',
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
            mockDocumentEngine.getDocumentContext.mockResolvedValue(contextWithoutSelection);

            const command: EditCommandType = {
                action: 'grammar',
                target: 'selection',
                instruction: 'Fix grammar in selected text'
            };

            const result = await grammarCommand.execute(command);

            expect(result.success).toBe(false);
            expect(result.error).toBe('This command requires text to be selected first');
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

        it('should handle section not found', async () => {
            mockDocumentEngine.findSection.mockResolvedValue(null);

            const command: EditCommandType = {
                action: 'grammar',
                target: 'section',
                location: 'Nonexistent Section',
                instruction: 'Fix grammar in missing section'
            };

            const result = await grammarCommand.execute(command);

            expect(result.success).toBe(false);
            expect(result.error).toBe('Section "Nonexistent Section" not found');
        });

        it('should handle no active editor for section grammar correction', async () => {
            mockDocumentEngine.getActiveEditor.mockReturnValue(null);

            const command: EditCommandType = {
                action: 'grammar',
                target: 'section',
                location: 'Section One',
                instruction: 'Fix grammar in section'
            };

            const result = await grammarCommand.execute(command);

            expect(result.success).toBe(false);
            expect(result.error).toBe('No active editor');
        });

        it('should handle no active editor for paragraph grammar correction', async () => {
            mockDocumentEngine.getActiveEditor.mockReturnValue(null);

            const command: EditCommandType = {
                action: 'grammar',
                target: 'paragraph',
                instruction: 'Fix grammar in paragraph'
            };

            const result = await grammarCommand.execute(command);

            expect(result.success).toBe(false);
            expect(result.error).toBe('No active editor');
        });

        it('should handle no cursor position for paragraph grammar correction', async () => {
            const contextWithoutCursor = {
                ...mockDocumentContext,
                cursorPosition: undefined
            };
            mockDocumentEngine.getDocumentContext.mockResolvedValue(contextWithoutCursor);

            const command: EditCommandType = {
                action: 'grammar',
                target: 'paragraph',
                instruction: 'Fix grammar in paragraph'
            };

            const result = await grammarCommand.execute(command);

            expect(result.success).toBe(false);
            expect(result.error).toBe('No cursor position available');
        });

        it('should handle exceptions during execution', async () => {
            mockDocumentEngine.getDocumentContext.mockRejectedValue(new Error('File system error'));

            const command: EditCommandType = {
                action: 'grammar',
                target: 'selection',
                instruction: 'Fix grammar'
            };

            const result = await grammarCommand.execute(command);

            expect(result.success).toBe(false);
            expect(result.error).toBe('File system error');
        });

        it('should handle paragraph grammar correction with complex boundaries', async () => {
            const complexContent = `# Title

First paragraph with teh error.

Second paragraph
continues on multiple lines
and  has double spaces.

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
                action: 'grammar',
                target: 'paragraph',
                instruction: 'Fix grammar in current paragraph'
            };

            const result = await grammarCommand.execute(command);

            expect(result.success).toBe(true);
            // Should correct the multi-line paragraph (lines 4-6)
            expect(mockEditor.replaceRange).toHaveBeenCalledWith(
                'This is the introduction paragraph with some corrections.',
                { line: 4, ch: 0 },
                { line: 6, ch: 23 } // End of last line in paragraph
            );
        });
    });

    describe('validateCommand', () => {
        it('should accept grammar command with selection when text is selected', () => {
            const command: EditCommandType = {
                action: 'grammar',
                target: 'selection',
                instruction: 'Fix grammar in selected text'
            };

            const validation = grammarCommand.validateCommand(command, true);

            expect(validation.valid).toBe(true);
            expect(validation.error).toBeUndefined();
        });

        it('should reject grammar command with selection when no text is selected', () => {
            const command: EditCommandType = {
                action: 'grammar',
                target: 'selection',
                instruction: 'Fix grammar in selected text'
            };

            const validation = grammarCommand.validateCommand(command, false);

            expect(validation.valid).toBe(false);
            expect(validation.error).toBe('This command requires text to be selected first');
        });

        it('should accept grammar command with section target and location', () => {
            const command: EditCommandType = {
                action: 'grammar',
                target: 'section',
                location: 'Introduction',
                instruction: 'Fix grammar in the introduction'
            };

            const validation = grammarCommand.validateCommand(command, false);

            expect(validation.valid).toBe(true);
            expect(validation.error).toBeUndefined();
        });

        it('should accept grammar command with valid targets', () => {
            const validTargets: EditCommandType['target'][] = ['paragraph', 'document', 'end'];

            validTargets.forEach(target => {
                const command: EditCommandType = {
                    action: 'grammar',
                    target,
                    instruction: 'Fix grammar'
                };

                const validation = grammarCommand.validateCommand(command, false);
                expect(validation.valid).toBe(true);
            });
        });
    });

    describe('getSuggestions', () => {
        it('should provide suggestions for selected text', () => {
            const suggestions = grammarCommand.getSuggestions(mockDocumentContext, true);

            expect(suggestions).toContain('Fix grammar in selected text');
            expect(suggestions).toContain('Correct spelling and punctuation');
            expect(suggestions).toContain('Improve sentence structure');
            expect(suggestions).toContain('Fix capitalization errors');
            expect(suggestions.length).toBeLessThanOrEqual(10);
        });

        it('should provide general document suggestions when no selection', () => {
            const suggestions = grammarCommand.getSuggestions(mockDocumentContext, false);

            expect(suggestions).toContain('Check grammar throughout document');
            expect(suggestions).toContain('Fix spelling errors');
            expect(suggestions).toContain('Correct punctuation');
            expect(suggestions).toContain('Fix grammatical errors in current paragraph');
            expect(suggestions.length).toBeLessThanOrEqual(10);
        });

        it('should include section-specific suggestions', () => {
            const suggestions = grammarCommand.getSuggestions(mockDocumentContext, false);

            expect(suggestions).toContain('Check grammar in "Main Document" section');
            expect(suggestions).toContain('Check grammar in "Section One" section');
            expect(suggestions).toContain('Check grammar in "Section Two" section');
        });

        it('should handle document without headings', () => {
            const contextWithoutHeadings = {
                ...mockDocumentContext,
                headings: []
            };

            const suggestions = grammarCommand.getSuggestions(contextWithoutHeadings, false);

            expect(suggestions.length).toBeGreaterThan(0);
            expect(suggestions).toContain('Check grammar throughout document');
            expect(suggestions).not.toContain('Check grammar in "Section One" section');
        });
    });

    describe('preview', () => {
        it('should preview grammar checking selected text', async () => {
            const command: EditCommandType = {
                action: 'grammar',
                target: 'selection',
                instruction: 'Fix grammar'
            };

            const preview = await grammarCommand.preview(command);

            expect(preview.success).toBe(true);
            expect(preview.preview).toBe('Will check grammar in the selected text');
            expect(preview.affectedContent).toBe('this is the introduction paragraph with some errors.');
            expect(preview.potentialIssues?.length).toBeGreaterThanOrEqual(0);
        });

        it('should preview grammar checking specific section', async () => {
            const command: EditCommandType = {
                action: 'grammar',
                target: 'section',
                location: 'Section One',
                instruction: 'Check grammar in section'
            };

            const preview = await grammarCommand.preview(command);

            expect(preview.success).toBe(true);
            expect(preview.preview).toBe('Will check grammar in the "Section One" section');
            expect(preview.affectedContent).toContain('Content for section one goes here');
        });

        it('should preview grammar checking paragraph', async () => {
            const command: EditCommandType = {
                action: 'grammar',
                target: 'paragraph',
                instruction: 'Check grammar in paragraph'
            };

            const preview = await grammarCommand.preview(command);

            expect(preview.success).toBe(true);
            expect(preview.preview).toBe('Will check grammar in the current paragraph');
            expect(preview.affectedContent).toBe('this is the introduction paragraph with some errors.');
        });

        it('should preview grammar checking entire document', async () => {
            const command: EditCommandType = {
                action: 'grammar',
                target: 'document',
                instruction: 'Check grammar in document'
            };

            const preview = await grammarCommand.preview(command);

            expect(preview.success).toBe(true);
            expect(preview.preview).toBe('Will check grammar throughout the entire document');
            expect(preview.affectedContent).toContain('# Main Document');
            expect(preview.potentialIssues?.length).toBeGreaterThanOrEqual(0);
            // Check that some issues are detected
            const hasMultipleSpaces = preview.potentialIssues?.some(issue => issue.includes('Multiple spaces'));
            expect(hasMultipleSpaces).toBe(true);
        });

        it('should handle preview when no text is selected', async () => {
            const contextWithoutSelection = {
                ...mockDocumentContext,
                selectedText: undefined
            };
            mockDocumentEngine.getDocumentContext.mockResolvedValue(contextWithoutSelection);

            const command: EditCommandType = {
                action: 'grammar',
                target: 'selection',
                instruction: 'Check grammar in selection'
            };

            const preview = await grammarCommand.preview(command);

            expect(preview.success).toBe(false);
            expect(preview.error).toBe('No text is currently selected');
        });

        it('should handle preview when section not found', async () => {
            mockDocumentEngine.findSection.mockResolvedValue(null);

            const command: EditCommandType = {
                action: 'grammar',
                target: 'section',
                location: 'Missing Section',
                instruction: 'Check grammar in section'
            };

            const preview = await grammarCommand.preview(command);

            expect(preview.success).toBe(false);
            expect(preview.error).toBe('Section "Missing Section" not found');
        });

        it('should handle preview when no document is active', async () => {
            mockDocumentEngine.getDocumentContext.mockResolvedValue(null);

            const command: EditCommandType = {
                action: 'grammar',
                target: 'document',
                instruction: 'Check grammar in document'
            };

            const preview = await grammarCommand.preview(command);

            expect(preview.success).toBe(false);
            expect(preview.error).toBe('No active document found');
        });

        it('should truncate long affected content', async () => {
            const longContent = 'this is a very long text with many words that needs to be truncated because it exceeds the maximum length limit and should show ellipsis at the end to indicate more content exists beyond what is displayed here.';
            const contextWithLongContent = {
                ...mockDocumentContext,
                selectedText: longContent
            };
            mockDocumentEngine.getDocumentContext.mockResolvedValue(contextWithLongContent);

            const command: EditCommandType = {
                action: 'grammar',
                target: 'selection',
                instruction: 'Check grammar in long text'
            };

            const preview = await grammarCommand.preview(command);

            expect(preview.success).toBe(true);
            expect(preview.affectedContent).toHaveLength(203); // 200 + '...'
            expect(preview.affectedContent?.endsWith('...')).toBe(true);
        });

        it('should detect common grammar issues', async () => {
            const textWithIssues = 'i went to teh store.  there were  two spaces and multiple periods.. also spacing before , comma.';
            const contextWithIssues = {
                ...mockDocumentContext,
                selectedText: textWithIssues
            };
            mockDocumentEngine.getDocumentContext.mockResolvedValue(contextWithIssues);

            const command: EditCommandType = {
                action: 'grammar',
                target: 'selection',
                instruction: 'Check grammar'
            };

            const preview = await grammarCommand.preview(command);

            expect(preview.success).toBe(true);
            expect(preview.potentialIssues?.length).toBeGreaterThan(0);
            // Check that some issues are detected, but don't require specific ones due to 5-item limit
            const hasGrammarIssues = preview.potentialIssues?.some(issue => 
                issue.includes('Multiple spaces') || 
                issue.includes('punctuation') || 
                issue.includes('capitalized') ||
                issue.includes('Lowercase "i"')
            );
            expect(hasGrammarIssues).toBe(true);
        });

        it('should limit potential issues to 5', async () => {
            const textWithManyIssues = 'i went to teh store and and i saw the the cat.  there were  multiple  spaces and and issues.. also spacing before , comma and , another. missing space after period.here and duplicate and and words.';
            const contextWithManyIssues = {
                ...mockDocumentContext,
                selectedText: textWithManyIssues
            };
            mockDocumentEngine.getDocumentContext.mockResolvedValue(contextWithManyIssues);

            const command: EditCommandType = {
                action: 'grammar',
                target: 'selection',
                instruction: 'Check grammar'
            };

            const preview = await grammarCommand.preview(command);

            expect(preview.success).toBe(true);
            expect(preview.potentialIssues?.length).toBeLessThanOrEqual(5);
        });
    });

    describe('getAvailableTargets', () => {
        it('should return all targets when text is selected and headings exist', () => {
            const targets = grammarCommand.getAvailableTargets(mockDocumentContext);

            expect(targets).toEqual(['selection', 'paragraph', 'section', 'document', 'end']);
        });

        it('should exclude selection when no text is selected', () => {
            const contextWithoutSelection = {
                ...mockDocumentContext,
                selectedText: undefined
            };

            const targets = grammarCommand.getAvailableTargets(contextWithoutSelection);

            expect(targets).toEqual(['paragraph', 'section', 'document', 'end']);
            expect(targets).not.toContain('selection');
        });

        it('should exclude section when no headings exist', () => {
            const contextWithoutHeadings = {
                ...mockDocumentContext,
                headings: []
            };

            const targets = grammarCommand.getAvailableTargets(contextWithoutHeadings);

            expect(targets).toEqual(['selection', 'paragraph', 'document', 'end']);
            expect(targets).not.toContain('section');
        });

        it('should return basic targets when no selection or headings', () => {
            const minimalContext = {
                ...mockDocumentContext,
                selectedText: undefined,
                headings: []
            };

            const targets = grammarCommand.getAvailableTargets(minimalContext);

            expect(targets).toEqual(['paragraph', 'document', 'end']);
        });
    });

    describe('estimateScope', () => {
        it('should estimate scope for selected text', async () => {
            const command: EditCommandType = {
                action: 'grammar',
                target: 'selection',
                instruction: 'Check grammar in selection'
            };

            const scope = await grammarCommand.estimateScope(command);

            expect(scope.charactersAffected).toBe(52); // Length of selected text
            expect(scope.linesAffected).toBe(1);
            expect(scope.scopeDescription).toBe('Selected text only');
            expect(scope.estimatedIssues).toBeGreaterThanOrEqual(0); // May or may not detect issues
        });

        it('should estimate scope for section', async () => {
            const command: EditCommandType = {
                action: 'grammar',
                target: 'section',
                location: 'Section One',
                instruction: 'Check grammar in section'
            };

            const scope = await grammarCommand.estimateScope(command);

            expect(scope.charactersAffected).toBe(85); // Length of section content
            expect(scope.linesAffected).toBe(3); // range.end - range.start
            expect(scope.scopeDescription).toBe('"Section One" section');
            expect(scope.estimatedIssues).toBeGreaterThanOrEqual(0);
        });

        it('should estimate scope for paragraph', async () => {
            const command: EditCommandType = {
                action: 'grammar',
                target: 'paragraph',
                instruction: 'Check grammar in paragraph'
            };

            const scope = await grammarCommand.estimateScope(command);

            expect(scope.charactersAffected).toBe(100); // Rough estimate
            expect(scope.linesAffected).toBe(1);
            expect(scope.scopeDescription).toBe('Current paragraph');
        });

        it('should estimate scope for entire document', async () => {
            const command: EditCommandType = {
                action: 'grammar',
                target: 'document',
                instruction: 'Check grammar in document'
            };

            const scope = await grammarCommand.estimateScope(command);

            expect(scope.charactersAffected).toBe(mockDocumentContext.content.length);
            expect(scope.linesAffected).toBe(mockDocumentContext.content.split('\n').length);
            expect(scope.scopeDescription).toBe('Entire document');
            expect(scope.estimatedIssues).toBeGreaterThanOrEqual(0); // May detect multiple issues
        });

        it('should estimate scope for end target', async () => {
            const command: EditCommandType = {
                action: 'grammar',
                target: 'end',
                instruction: 'Add grammar-corrected content at end'
            };

            const scope = await grammarCommand.estimateScope(command);

            expect(scope.charactersAffected).toBe(0);
            expect(scope.linesAffected).toBe(0);
            expect(scope.scopeDescription).toBe('New content at end');
            expect(scope.estimatedIssues).toBe(0);
        });

        it('should handle no document available', async () => {
            mockDocumentEngine.getDocumentContext.mockResolvedValue(null);

            const command: EditCommandType = {
                action: 'grammar',
                target: 'selection',
                instruction: 'Check grammar'
            };

            const scope = await grammarCommand.estimateScope(command);

            expect(scope.charactersAffected).toBe(0);
            expect(scope.linesAffected).toBe(0);
            expect(scope.scopeDescription).toBe('No document available');
            expect(scope.estimatedIssues).toBe(0);
        });
    });

    describe('detectPotentialIssues', () => {
        it('should detect lowercase i that should be capitalized', () => {
            const grammarCommandInstance = grammarCommand as any;
            const issues = grammarCommandInstance.detectPotentialIssues('i went to the store');
            
            expect(issues).toContain('Lowercase "i" should be capitalized');
        });

        it('should detect sentences not starting with capital letters', () => {
            const grammarCommandInstance = grammarCommand as any;
            const issues = grammarCommandInstance.detectPotentialIssues('Hello. world is big.');
            
            expect(issues).toContain('Sentence should start with capital letter');
        });

        it('should detect multiple spaces', () => {
            const grammarCommandInstance = grammarCommand as any;
            const issues = grammarCommandInstance.detectPotentialIssues('Hello  world');
            
            expect(issues).toContain('Multiple spaces detected');
        });

        it('should detect common typos', () => {
            const grammarCommandInstance = grammarCommand as any;
            const issues = grammarCommandInstance.detectPotentialIssues('I went to teh store');
            
            expect(issues).toContain('Common typo: "teh" should be "the"');
        });

        it('should detect duplicate words', () => {
            const grammarCommandInstance = grammarCommand as any;
            const issues = grammarCommandInstance.detectPotentialIssues('I went and and saw the the cat');
            
            expect(issues).toContain('Duplicate "and"');
            expect(issues).toContain('Duplicate "the"');
        });

        it('should detect punctuation issues', () => {
            const grammarCommandInstance = grammarCommand as any;
            const issues = grammarCommandInstance.detectPotentialIssues('Hello !! World , test.No space');
            
            expect(issues).toContain('Multiple punctuation marks');
            expect(issues).toContain('Space before punctuation');
            expect(issues).toContain('Missing space after punctuation');
        });

        it('should return empty array for text without issues', () => {
            const grammarCommandInstance = grammarCommand as any;
            const issues = grammarCommandInstance.detectPotentialIssues('This is a well-written sentence.');
            
            expect(issues).toEqual([]);
        });
    });
});