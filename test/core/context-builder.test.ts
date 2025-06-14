/**
 * Tests for ContextBuilder
 */

import { ContextBuilder, GeneratedPrompt } from '../../src/core/context-builder';
import { EditCommand, DocumentContext, PromptConfig, ConversationMessage } from '../../src/core/types';
import { TFile } from '../mocks/obsidian-mock';

describe('ContextBuilder', () => {
    let builder: ContextBuilder;
    let mockDocumentContext: DocumentContext;
    let mockFile: TFile;

    beforeEach(() => {
        builder = new ContextBuilder();
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

Content for section two.

### Subsection A

Detailed content here.

## Conclusion

Final thoughts and summary.`,
            headings: [
                { text: 'Main Document', level: 1, line: 0, position: { start: 0, end: 15 } },
                { text: 'Section One', level: 2, line: 4, position: { start: 50, end: 63 } },
                { text: 'Section Two', level: 2, line: 9, position: { start: 120, end: 133 } },
                { text: 'Subsection A', level: 3, line: 13, position: { start: 160, end: 174 } },
                { text: 'Conclusion', level: 2, line: 17, position: { start: 200, end: 212 } }
            ],
            selectedText: '',
            cursorPosition: { line: 5, ch: 10 },
            surroundingLines: {
                before: ['## Section One', ''],
                after: ['It has multiple paragraphs.', '']
            }
        };
    });

    describe('buildPrompt', () => {
        it('should build basic add command prompt', () => {
            const command: EditCommand = {
                action: 'add',
                target: 'end',
                instruction: 'Add a conclusion section'
            };

            const prompt = builder.buildPrompt(command, mockDocumentContext);

            expect(prompt.systemPrompt).toContain('You are Nova');
            expect(prompt.systemPrompt).toContain('Generate new content to insert');
            expect(prompt.userPrompt).toContain('Add a conclusion section');
            expect(prompt.userPrompt).toContain('DOCUMENT: test-document');
            expect(prompt.context).toContain('test-document');
            expect(prompt.config.temperature).toBe(0.7);
            expect(prompt.config.maxTokens).toBe(1000);
        });

        it('should build edit command prompt with selection', () => {
            const command: EditCommand = {
                action: 'edit',
                target: 'selection',
                instruction: 'Make this more professional'
            };

            const contextWithSelection = {
                ...mockDocumentContext,
                selectedText: 'This is some casual text that needs editing.'
            };

            const prompt = builder.buildPrompt(command, contextWithSelection);

            expect(prompt.systemPrompt).toContain('Improve, modify, or enhance the specified content');
            expect(prompt.userPrompt).toContain('Make this more professional');
            expect(prompt.userPrompt).toContain('SELECTED TEXT:');
            expect(prompt.userPrompt).toContain('This is some casual text');
            expect(prompt.userPrompt).toContain('FOCUS: Modify existing content in the selected text');
        });

        it('should build grammar command prompt', () => {
            const command: EditCommand = {
                action: 'grammar',
                target: 'document',
                instruction: 'Fix grammar and spelling errors'
            };

            const prompt = builder.buildPrompt(command, mockDocumentContext);

            expect(prompt.systemPrompt).toContain('Fix grammar, spelling, and punctuation errors');
            expect(prompt.userPrompt).toContain('Fix grammar and spelling errors');
            expect(prompt.userPrompt).toContain('FOCUS: Fix grammar and spelling for the entire document');
            expect(prompt.userPrompt).toContain('OUTPUT: Provide the corrected version');
        });

        it('should build delete command prompt at cursor', () => {
            const command: EditCommand = {
                action: 'delete',
                target: 'cursor',
                instruction: 'Delete content at cursor position'
            };

            const prompt = builder.buildPrompt(command, mockDocumentContext);

            expect(prompt.systemPrompt).toContain('Confirm what should be deleted');
            expect(prompt.userPrompt).toContain('Delete content at cursor position');
            expect(prompt.userPrompt).toContain('FOCUS: Remove specified content at the current cursor position');
        });

        it('should build rewrite command prompt', () => {
            const command: EditCommand = {
                action: 'rewrite',
                target: 'cursor',
                instruction: 'Generate alternative content',
                context: 'formal, detailed'
            };

            const prompt = builder.buildPrompt(command, mockDocumentContext);

            expect(prompt.systemPrompt).toContain('Generate alternative content that serves the same purpose');
            expect(prompt.userPrompt).toContain('Generate alternative content');
            expect(prompt.userPrompt).toContain('ADDITIONAL REQUIREMENTS: formal, detailed');
            expect(prompt.userPrompt).toContain('FOCUS: Generate alternative content at the current cursor position');
        });

        it('should include document structure when configured', () => {
            const command: EditCommand = {
                action: 'add',
                target: 'cursor',
                instruction: 'Add content at cursor'
            };

            const config: Partial<PromptConfig> = {
                includeStructure: true
            };

            const prompt = builder.buildPrompt(command, mockDocumentContext, config);

            expect(prompt.userPrompt).toContain('DOCUMENT STRUCTURE:');
            expect(prompt.userPrompt).toContain('- Main Document');
            expect(prompt.userPrompt).toContain('  - Section One');
            expect(prompt.userPrompt).toContain('    - Subsection A');
        });

        it('should include full document in cursor-only system', () => {
            const command: EditCommand = {
                action: 'edit',
                target: 'document',
                instruction: 'Improve the content'
            };

            const config: Partial<PromptConfig> = {
                maxContextLines: 5
            };

            const prompt = builder.buildPrompt(command, mockDocumentContext, config);

            expect(prompt.userPrompt).toContain('FULL DOCUMENT:');
            expect(prompt.userPrompt).toContain('FOCUS: Modify existing content for the entire document');
        });

        it('should handle cursor target with surrounding lines', () => {
            const command: EditCommand = {
                action: 'edit',
                target: 'cursor',
                instruction: 'Improve content at cursor'
            };

            const prompt = builder.buildPrompt(command, mockDocumentContext);

            expect(prompt.userPrompt).toContain('CURSOR CONTEXT:');
            expect(prompt.userPrompt).toContain('Before cursor:');
            expect(prompt.userPrompt).toContain('After cursor:');
        });
    });

    describe('buildSimplePrompt', () => {
        it('should create simple prompt without context', () => {
            const command: EditCommand = {
                action: 'add',
                target: 'cursor',
                instruction: 'Help me write better'
            };
            const prompt = builder.buildPrompt(command, mockDocumentContext);

            expect(prompt.systemPrompt).toContain('You are Nova');
            expect(prompt.userPrompt).toContain('Help me write better');
            expect(prompt.context).toContain('DOCUMENT: test-document');
            expect(prompt.config.maxTokens).toBe(1000);
        });

        it('should create simple prompt with context', () => {
            const command: EditCommand = {
                action: 'add',
                target: 'cursor',
                instruction: 'Explain this concept',
                context: 'Writing about AI'
            };
            const prompt = builder.buildPrompt(command, mockDocumentContext);

            expect(prompt.userPrompt).toContain('Writing about AI');
            expect(prompt.userPrompt).toContain('Explain this concept');
            expect(prompt.userPrompt).toContain('ADDITIONAL REQUIREMENTS: Writing about AI');
        });
    });

    describe('buildConversationPrompt', () => {
        it('should build conversation prompt without document context', () => {
            const command: EditCommand = {
                action: 'add',
                target: 'cursor',
                instruction: 'How can I improve my writing?'
            };
            const prompt = builder.buildPrompt(command, mockDocumentContext);

            expect(prompt.systemPrompt).toContain('You are Nova');
            expect(prompt.systemPrompt).toContain('ADD CONTENT');
            expect(prompt.userPrompt).toContain('How can I improve my writing?');
            expect(prompt.config.temperature).toBe(0.7);
        });

        it('should include document context when provided', () => {
            const command: EditCommand = {
                action: 'add',
                target: 'document',
                instruction: 'What should I add to this document?'
            };
            const prompt = builder.buildPrompt(command, mockDocumentContext);

            expect(prompt.userPrompt).toContain('DOCUMENT: test-document');
            expect(prompt.userPrompt).toContain('DOCUMENT STRUCTURE:');
            expect(prompt.userPrompt).toContain('- Main Document');
            expect(prompt.userPrompt).toContain('What should I add to this document?');
        });

        it('should include recent conversation history', () => {
            const history: ConversationMessage[] = [
                {
                    id: '1',
                    role: 'user',
                    content: 'Help me write an introduction',
                    timestamp: Date.now() - 1000
                },
                {
                    id: '2',
                    role: 'assistant',
                    content: 'I can help you craft a compelling introduction',
                    timestamp: Date.now() - 500
                }
            ];

            const command: EditCommand = {
                action: 'add',
                target: 'cursor',
                instruction: 'Now help with the conclusion'
            };
            const conversationContext = 'Recent conversation: You: Help me write an introduction\\nNova: I can help you craft a compelling introduction';
            const prompt = builder.buildPrompt(command, mockDocumentContext, { includeHistory: true }, conversationContext);

            expect(prompt.userPrompt).toContain('CONVERSATION CONTEXT:');
            expect(prompt.userPrompt).toContain('Help me write an introduction');
            expect(prompt.userPrompt).toContain('I can help you craft');
        });
    });

    describe('system prompt generation', () => {
        it('should generate different system prompts for each action', () => {
            const actions: EditCommand['action'][] = ['add', 'edit', 'delete', 'grammar', 'rewrite'];
            const prompts: Record<string, string> = {};

            actions.forEach(action => {
                const command: EditCommand = {
                    action,
                    target: 'document',
                    instruction: `Test ${action} command`
                };
                const prompt = builder.buildPrompt(command, mockDocumentContext);
                prompts[action] = prompt.systemPrompt;
            });

            // Verify each action has specific instructions
            expect(prompts.add).toContain('ADD CONTENT');
            expect(prompts.edit).toContain('EDIT CONTENT');
            expect(prompts.delete).toContain('DELETE CONTENT');
            expect(prompts.grammar).toContain('GRAMMAR & SPELLING');
            expect(prompts.rewrite).toContain('REWRITE CONTENT');

            // Verify they're all different
            const uniquePrompts = new Set(Object.values(prompts));
            expect(uniquePrompts.size).toBe(5);
        });
    });

    describe('target instructions', () => {
        it('should provide specific instructions for each target type', () => {
            const targets: EditCommand['target'][] = ['selection', 'document', 'end', 'cursor'];
            
            targets.forEach(target => {
                const command: EditCommand = {
                    action: 'edit',
                    target,
                    instruction: 'Test command'
                };

                const prompt = builder.buildPrompt(command, mockDocumentContext);

                switch (target) {
                    case 'selection':
                        expect(prompt.userPrompt).toContain('FOCUS: Modify existing content in the selected text');
                        break;
                    case 'document':
                        expect(prompt.userPrompt).toContain('FOCUS: Modify existing content for the entire document');
                        break;
                    case 'end':
                        expect(prompt.userPrompt).toContain('FOCUS: Add content at the very end of the document');
                        break;
                    case 'cursor':
                        expect(prompt.userPrompt).toContain('FOCUS: Modify existing content at the current cursor position');
                        break;
                }
            });
        });

        it('should handle cursor target instructions', () => {
            const command: EditCommand = {
                action: 'edit',
                target: 'cursor',
                instruction: 'Edit the introduction'
            };

            const prompt = builder.buildPrompt(command, mockDocumentContext);

            expect(prompt.userPrompt).toContain('FOCUS: Modify existing content at the current cursor position');
        });
    });

    describe('cursor-only system behavior', () => {
        it('should handle all commands at cursor position', () => {
            const actions: EditCommand['action'][] = ['add', 'edit', 'delete', 'grammar', 'rewrite'];
            
            actions.forEach(action => {
                const command: EditCommand = {
                    action,
                    target: 'cursor',
                    instruction: `Test ${action} at cursor`
                };

                const prompt = builder.buildPrompt(command, mockDocumentContext);

                expect(prompt.userPrompt).toContain('CURSOR CONTEXT:');
                expect(prompt.userPrompt).toContain('FULL DOCUMENT:');
                expect(prompt.userPrompt).toContain(`Test ${action} at cursor`);
            });
        });

        it('should include document structure when available', () => {
            const command: EditCommand = {
                action: 'edit',
                target: 'cursor',
                instruction: 'Edit content'
            };

            const prompt = builder.buildPrompt(command, mockDocumentContext);

            expect(prompt.userPrompt).toContain('DOCUMENT STRUCTURE:');
            expect(prompt.userPrompt).toContain('- Main Document');
            expect(prompt.userPrompt).toContain('  - Section One');
        });

        it('should provide appropriate output instructions', () => {
            const command: EditCommand = {
                action: 'add',
                target: 'cursor',
                instruction: 'Add new content'
            };

            const prompt = builder.buildPrompt(command, mockDocumentContext);

            expect(prompt.userPrompt).toContain('OUTPUT: Provide only the new content to be added');
        });

        it('should handle end-of-document targeting', () => {
            const command: EditCommand = {
                action: 'add',
                target: 'end',
                instruction: 'Add conclusion'
            };

            const prompt = builder.buildPrompt(command, mockDocumentContext);

            expect(prompt.userPrompt).toContain('Targeting end of document');
            expect(prompt.userPrompt).toContain('FOCUS: Add content at the very end of the document');
        });
    });

    describe('estimateTokenCount', () => {
        it('should estimate token count reasonably', () => {
            const command: EditCommand = {
                action: 'edit',
                target: 'document',
                instruction: 'Improve this document'
            };

            const prompt = builder.buildPrompt(command, mockDocumentContext);
            const tokenCount = prompt.userPrompt.length + prompt.systemPrompt.length;

            expect(tokenCount).toBeGreaterThan(100);
            expect(tokenCount).toBeLessThan(2000);
        });

        it('should handle empty prompts', () => {
            const emptyPrompt: GeneratedPrompt = {
                systemPrompt: '',
                userPrompt: '',
                context: '',
                config: { temperature: 0.7, maxTokens: 1000 }
            };

            const tokenCount = emptyPrompt.userPrompt.length + emptyPrompt.systemPrompt.length;
            expect(tokenCount).toBe(0);
        });
    });

    describe('validatePrompt', () => {
        it('should validate correct prompts', () => {
            const command: EditCommand = {
                action: 'edit',
                target: 'document',
                instruction: 'Improve the content'
            };

            const prompt = builder.buildPrompt(command, mockDocumentContext);
            const validation = builder.validatePrompt(prompt);

            expect(validation.valid).toBe(true);
            expect(validation.issues).toHaveLength(0);
        });

        it('should detect empty system prompt', () => {
            const invalidPrompt: GeneratedPrompt = {
                systemPrompt: '',
                userPrompt: 'Valid user prompt',
                context: 'Valid context',
                config: { temperature: 0.7, maxTokens: 1000 }
            };

            const validation = builder.validatePrompt(invalidPrompt);

            expect(validation.valid).toBe(false);
            expect(validation.issues).toContain('System prompt is empty');
        });

        it('should detect empty user prompt', () => {
            const invalidPrompt: GeneratedPrompt = {
                systemPrompt: 'Valid system prompt',
                userPrompt: '',
                context: 'Valid context',
                config: { temperature: 0.7, maxTokens: 1000 }
            };

            const validation = builder.validatePrompt(invalidPrompt);

            expect(validation.valid).toBe(false);
            expect(validation.issues).toContain('User prompt is empty');
        });

        it('should accept valid prompts with any temperature', () => {
            const validPrompt: GeneratedPrompt = {
                systemPrompt: 'Valid system prompt',
                userPrompt: 'Valid user prompt',
                context: 'Valid context',
                config: { temperature: 1.5, maxTokens: 1000 }
            };

            const validation = builder.validatePrompt(validPrompt);

            expect(validation.valid).toBe(true);
            expect(validation.issues).toHaveLength(0);
        });

        it('should accept valid prompts with any max tokens', () => {
            const validPrompt: GeneratedPrompt = {
                systemPrompt: 'Valid system prompt',
                userPrompt: 'Valid user prompt',
                context: 'Valid context',
                config: { temperature: 0.7, maxTokens: 5000 }
            };

            const validation = builder.validatePrompt(validPrompt);

            expect(validation.valid).toBe(true);
            expect(validation.issues).toHaveLength(0);
        });

        it('should detect multiple issues', () => {
            const invalidPrompt: GeneratedPrompt = {
                systemPrompt: '',
                userPrompt: '',
                context: '',
                config: { temperature: -0.5, maxTokens: 5 }
            };

            const validation = builder.validatePrompt(invalidPrompt);

            expect(validation.valid).toBe(false);
            expect(validation.issues.length).toBeGreaterThan(1);
        });
    });

    describe('edge cases', () => {
        it('should handle document without headings', () => {
            const contextWithoutHeadings = {
                ...mockDocumentContext,
                headings: []
            };

            const command: EditCommand = {
                action: 'add',
                target: 'end',
                instruction: 'Add content'
            };

            const prompt = builder.buildPrompt(command, contextWithoutHeadings);

            expect(prompt.userPrompt).not.toContain('DOCUMENT STRUCTURE:');
            expect(prompt.userPrompt).toContain('DOCUMENT: test-document');
        });

        it('should handle missing surrounding lines', () => {
            const contextWithoutSurrounding = {
                ...mockDocumentContext,
                surroundingLines: undefined
            };

            const command: EditCommand = {
                action: 'edit',
                target: 'cursor',
                instruction: 'Edit paragraph'
            };

            const prompt = builder.buildPrompt(command, contextWithoutSurrounding);

            expect(prompt.userPrompt).not.toContain('CURRENT CONTEXT:');
            expect(prompt.userPrompt).toContain('FOCUS: Modify existing content at the current cursor position');
        });

        it('should handle very long documents', () => {
            const longContent = 'Line content\n'.repeat(100);
            const contextWithLongContent = {
                ...mockDocumentContext,
                content: longContent
            };

            const command: EditCommand = {
                action: 'edit',
                target: 'document',
                instruction: 'Edit document'
            };

            const config: Partial<PromptConfig> = {
                maxContextLines: 10
            };

            const prompt = builder.buildPrompt(command, contextWithLongContent, config);

            expect(prompt.userPrompt).toContain('FULL DOCUMENT:');
            expect(prompt.userPrompt).toContain('Line content');
        });

        it('should handle custom configuration', () => {
            const command: EditCommand = {
                action: 'add',
                target: 'end',
                instruction: 'Add content'
            };

            const customConfig: Partial<PromptConfig> = {
                temperature: 0.3,
                maxTokens: 500,
                includeStructure: false,
                maxContextLines: 5
            };

            const prompt = builder.buildPrompt(command, mockDocumentContext, customConfig);

            expect(prompt.config.temperature).toBe(0.3);
            expect(prompt.config.maxTokens).toBe(500);
            expect(prompt.userPrompt).not.toContain('DOCUMENT STRUCTURE:');
        });
    });
});