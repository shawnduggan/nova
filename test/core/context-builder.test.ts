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
            expect(prompt.systemPrompt).toContain('Add new content');
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

            expect(prompt.systemPrompt).toContain('Edit and improve existing content');
            expect(prompt.userPrompt).toContain('Make this more professional');
            expect(prompt.userPrompt).toContain('SELECTED TEXT:');
            expect(prompt.userPrompt).toContain('This is some casual text');
            expect(prompt.userPrompt).toContain('Work with the selected text only');
        });

        it('should build grammar command prompt', () => {
            const command: EditCommand = {
                action: 'grammar',
                target: 'document',
                instruction: 'Fix grammar and spelling errors'
            };

            const prompt = builder.buildPrompt(command, mockDocumentContext);

            expect(prompt.systemPrompt).toContain('Fix grammar, spelling, and language issues');
            expect(prompt.userPrompt).toContain('Fix grammar and spelling errors');
            expect(prompt.userPrompt).toContain('Apply changes to the entire document');
            expect(prompt.userPrompt).toContain('Provide only the corrected text');
        });

        it('should build delete command prompt with location', () => {
            const command: EditCommand = {
                action: 'delete',
                target: 'section',
                location: 'Section One',
                instruction: 'Delete the Section One section'
            };

            const prompt = builder.buildPrompt(command, mockDocumentContext);

            expect(prompt.systemPrompt).toContain('Remove specified content');
            expect(prompt.userPrompt).toContain('Delete the Section One section');
            expect(prompt.userPrompt).toContain('Work with the "Section One" section');
            expect(prompt.userPrompt).toContain('CURRENT SECTION "Section One"');
        });

        it('should build rewrite command prompt', () => {
            const command: EditCommand = {
                action: 'rewrite',
                target: 'end',
                instruction: 'Generate alternative content',
                context: 'formal, detailed'
            };

            const prompt = builder.buildPrompt(command, mockDocumentContext);

            expect(prompt.systemPrompt).toContain('Rewrite or restructure content');
            expect(prompt.userPrompt).toContain('Generate alternative content');
            expect(prompt.userPrompt).toContain('ADDITIONAL REQUIREMENTS: formal, detailed');
            expect(prompt.userPrompt).toContain('Add content at the end');
        });

        it('should include document structure when configured', () => {
            const command: EditCommand = {
                action: 'add',
                target: 'section',
                instruction: 'Add content to introduction'
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

        it('should limit context lines when configured', () => {
            const command: EditCommand = {
                action: 'edit',
                target: 'document',
                instruction: 'Improve the content'
            };

            const config: Partial<PromptConfig> = {
                maxContextLines: 5
            };

            const prompt = builder.buildPrompt(command, mockDocumentContext, config);

            expect(prompt.userPrompt).toContain('RECENT CONTENT (last 5 lines)');
            expect(prompt.userPrompt).not.toContain('FULL DOCUMENT:');
        });

        it('should handle paragraph target with surrounding lines', () => {
            const command: EditCommand = {
                action: 'edit',
                target: 'paragraph',
                instruction: 'Improve this paragraph'
            };

            const prompt = builder.buildPrompt(command, mockDocumentContext);

            expect(prompt.userPrompt).toContain('CURRENT CONTEXT:');
            expect(prompt.userPrompt).toContain('Before: ## Section One');
            expect(prompt.userPrompt).toContain('After: It has multiple paragraphs.');
        });
    });

    describe('buildSimplePrompt', () => {
        it('should create simple prompt without context', () => {
            const prompt = builder.buildSimplePrompt('Help me write better');

            expect(prompt.systemPrompt).toContain('You are Nova');
            expect(prompt.userPrompt).toBe('Help me write better');
            expect(prompt.context).toBe('');
            expect(prompt.config.maxTokens).toBe(500);
        });

        it('should create simple prompt with context', () => {
            const prompt = builder.buildSimplePrompt('Explain this concept', 'Writing about AI');

            expect(prompt.userPrompt).toContain('Context: Writing about AI');
            expect(prompt.userPrompt).toContain('Request: Explain this concept');
            expect(prompt.context).toBe('Writing about AI');
        });
    });

    describe('buildConversationPrompt', () => {
        it('should build conversation prompt without document context', () => {
            const prompt = builder.buildConversationPrompt('How can I improve my writing?');

            expect(prompt.systemPrompt).toContain('You are Nova');
            expect(prompt.systemPrompt).toContain('Answer questions about writing');
            expect(prompt.userPrompt).toBe('How can I improve my writing?');
            expect(prompt.config.temperature).toBe(0.8);
        });

        it('should include document context when provided', () => {
            const prompt = builder.buildConversationPrompt(
                'What should I add to this document?',
                mockDocumentContext
            );

            expect(prompt.userPrompt).toContain('Current document: test-document');
            expect(prompt.userPrompt).toContain('Document structure:');
            expect(prompt.userPrompt).toContain('- Main Document');
            expect(prompt.userPrompt).toContain('Current message: What should I add');
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

            const prompt = builder.buildConversationPrompt(
                'Now help with the conclusion',
                undefined,
                history
            );

            expect(prompt.userPrompt).toContain('Recent conversation:');
            expect(prompt.userPrompt).toContain('You: Help me write an introduction');
            expect(prompt.userPrompt).toContain('Nova: I can help you craft');
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
            expect(prompts.add).toContain('Add new content');
            expect(prompts.edit).toContain('Edit and improve existing content');
            expect(prompts.delete).toContain('Remove specified content');
            expect(prompts.grammar).toContain('Fix grammar, spelling');
            expect(prompts.rewrite).toContain('Rewrite or restructure');

            // Verify they're all different
            const uniquePrompts = new Set(Object.values(prompts));
            expect(uniquePrompts.size).toBe(5);
        });
    });

    describe('target instructions', () => {
        it('should provide specific instructions for each target type', () => {
            const targets: EditCommand['target'][] = ['selection', 'section', 'document', 'end', 'paragraph'];
            
            targets.forEach(target => {
                const command: EditCommand = {
                    action: 'edit',
                    target,
                    instruction: 'Test command'
                };

                const prompt = builder.buildPrompt(command, mockDocumentContext);

                switch (target) {
                    case 'selection':
                        expect(prompt.userPrompt).toContain('Work with the selected text only');
                        break;
                    case 'section':
                        expect(prompt.userPrompt).toContain('Work with the current section');
                        break;
                    case 'document':
                        expect(prompt.userPrompt).toContain('Apply changes to the entire document');
                        break;
                    case 'end':
                        expect(prompt.userPrompt).toContain('Add content at the end');
                        break;
                    case 'paragraph':
                        expect(prompt.userPrompt).toContain('Work with the current paragraph');
                        break;
                }
            });
        });

        it('should include location in section target instructions', () => {
            const command: EditCommand = {
                action: 'edit',
                target: 'section',
                location: 'Introduction',
                instruction: 'Edit the introduction'
            };

            const prompt = builder.buildPrompt(command, mockDocumentContext);

            expect(prompt.userPrompt).toContain('Work with the "Introduction" section');
        });
    });

    describe('section finding', () => {
        it('should find section content correctly', () => {
            const command: EditCommand = {
                action: 'edit',
                target: 'section',
                location: 'Section One',
                instruction: 'Edit section one'
            };

            const prompt = builder.buildPrompt(command, mockDocumentContext);

            expect(prompt.userPrompt).toContain('CURRENT SECTION "Section One"');
            expect(prompt.userPrompt).toContain('Content for section one goes here');
            expect(prompt.userPrompt).toContain('It has multiple paragraphs');
        });

        it('should handle case-insensitive section matching', () => {
            const command: EditCommand = {
                action: 'edit',
                target: 'section',
                location: 'section one',
                instruction: 'Edit section'
            };

            const prompt = builder.buildPrompt(command, mockDocumentContext);

            expect(prompt.userPrompt).toContain('CURRENT SECTION "section one"');
            expect(prompt.userPrompt).toContain('Content for section one goes here');
        });

        it('should handle partial section name matching', () => {
            const command: EditCommand = {
                action: 'edit',
                target: 'section',
                location: 'Subsection',
                instruction: 'Edit subsection'
            };

            const prompt = builder.buildPrompt(command, mockDocumentContext);

            expect(prompt.userPrompt).toContain('CURRENT SECTION "Subsection"');
            expect(prompt.userPrompt).toContain('Detailed content here');
        });

        it('should handle missing section gracefully', () => {
            const command: EditCommand = {
                action: 'edit',
                target: 'section',
                location: 'Nonexistent Section',
                instruction: 'Edit missing section'
            };

            const prompt = builder.buildPrompt(command, mockDocumentContext);

            expect(prompt.userPrompt).not.toContain('CURRENT SECTION "Nonexistent Section"');
            expect(prompt.userPrompt).toContain('Work with the "Nonexistent Section" section');
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
            const tokenCount = builder.estimateTokenCount(prompt);

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

            const tokenCount = builder.estimateTokenCount(emptyPrompt);
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

        it('should detect invalid temperature', () => {
            const invalidPrompt: GeneratedPrompt = {
                systemPrompt: 'Valid system prompt',
                userPrompt: 'Valid user prompt',
                context: 'Valid context',
                config: { temperature: 1.5, maxTokens: 1000 }
            };

            const validation = builder.validatePrompt(invalidPrompt);

            expect(validation.valid).toBe(false);
            expect(validation.issues).toContain('Temperature must be between 0 and 1');
        });

        it('should detect invalid max tokens', () => {
            const invalidPrompt: GeneratedPrompt = {
                systemPrompt: 'Valid system prompt',
                userPrompt: 'Valid user prompt',
                context: 'Valid context',
                config: { temperature: 0.7, maxTokens: 5000 }
            };

            const validation = builder.validatePrompt(invalidPrompt);

            expect(validation.valid).toBe(false);
            expect(validation.issues).toContain('Max tokens must be between 10 and 4000');
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
                target: 'paragraph',
                instruction: 'Edit paragraph'
            };

            const prompt = builder.buildPrompt(command, contextWithoutSurrounding);

            expect(prompt.userPrompt).not.toContain('CURRENT CONTEXT:');
            expect(prompt.userPrompt).toContain('Work with the current paragraph');
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

            expect(prompt.userPrompt).toContain('RECENT CONTENT (last 10 lines)');
            expect(prompt.userPrompt).not.toContain('FULL DOCUMENT:');
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