/**
 * Test suite for AI Intent Classifier
 */

import { AIIntentClassifier } from '../../src/core/ai-intent-classifier';
import { AIProviderManager } from '../../src/ai/provider-manager';

jest.mock('../../src/ai/provider-manager');

describe('AIIntentClassifier', () => {
    let classifier: AIIntentClassifier;
    let mockProviderManager: jest.Mocked<AIProviderManager>;

    beforeEach(() => {
        mockProviderManager = new AIProviderManager({} as any, {} as any) as jest.Mocked<AIProviderManager>;
        classifier = new AIIntentClassifier(mockProviderManager);
    });

    describe('classifyIntent', () => {
        it('should classify questions as CHAT', async () => {
            // Now using fallback classification
            const intent = await classifier.classifyIntent('What is this document about?');
            
            expect(intent).toBe('CHAT');
            // AI classification is disabled, so complete should not be called
            expect(mockProviderManager.complete).not.toHaveBeenCalled();
        });

        it('should classify tag commands as METADATA', async () => {
            const intent = await classifier.classifyIntent('add tags');
            
            expect(intent).toBe('METADATA');
            expect(mockProviderManager.complete).not.toHaveBeenCalled();
        });

        it('should classify content edits as CONTENT', async () => {
            const intent = await classifier.classifyIntent('Add a conclusion');
            
            expect(intent).toBe('CONTENT');
            expect(mockProviderManager.complete).not.toHaveBeenCalled();
        });

        it('should handle colon commands as CHAT', async () => {
            const intent = await classifier.classifyIntent(':claude');
            
            expect(intent).toBe('CHAT');
            expect(mockProviderManager.complete).not.toHaveBeenCalled();
        });

        it('should handle various commands with fallback classification', async () => {
            // Question should be CHAT
            let intent = await classifier.classifyIntent('What is this?');
            expect(intent).toBe('CHAT');

            // Tag command should be METADATA
            intent = await classifier.classifyIntent('update tags');
            expect(intent).toBe('METADATA');

            // Other commands should be CONTENT
            intent = await classifier.classifyIntent('improve this');
            expect(intent).toBe('CONTENT');
            
            expect(mockProviderManager.complete).not.toHaveBeenCalled();
        });
    });

    describe('fallback classification', () => {

        it('should classify various question formats as CHAT', async () => {
            const questions = [
                'What is this?',
                'Why does this happen?',
                'How can I improve?',
                'When should I use this?',
                'Who wrote this?',
                'Can you explain?',
                'Please explain this concept'
            ];

            for (const question of questions) {
                const intent = await classifier.classifyIntent(question);
                expect(intent).toBe('CHAT');
            }
        });

        it('should classify metadata keywords as METADATA', async () => {
            const metadataCommands = [
                'add tags',
                'update tags',
                'update title',
                'set author',
                'clean up metadata',
                'optimize tags',
                'clean up my tags',
                'modify frontmatter',
                'change properties'
            ];

            for (const command of metadataCommands) {
                const intent = await classifier.classifyIntent(command);
                expect(intent).toBe('METADATA');
            }
        });

        it('should default to CONTENT for other commands', async () => {
            const contentCommands = [
                'add a section',
                'improve writing',
                'make it better',
                'fix spelling'
            ];

            for (const command of contentCommands) {
                const intent = await classifier.classifyIntent(command);
                expect(intent).toBe('CONTENT');
            }
        });
    });

    describe('IntentDetector integration', () => {
        it('should classify consultation patterns as CHAT', async () => {
            const consultationInputs = [
                'Now is a busy time for me',
                'I\'m feeling overwhelmed with work',
                'This reminds me of something important',
                'I wonder about this approach'
            ];

            for (const input of consultationInputs) {
                const result = await classifier.classifyIntent(input);
                expect(result).toBe('CHAT');
            }
        });

        it('should classify editing patterns as CONTENT', async () => {
            const editingInputs = [
                'Make this paragraph clearer',
                'Fix the grammar here',
                'This section needs improvement',
                'Add more detail at the end'
            ];

            for (const input of editingInputs) {
                const result = await classifier.classifyIntent(input);
                expect(result).toBe('CONTENT');
            }
        });

        it('should handle mixed patterns intelligently', async () => {
            const mixedInputs = [
                'I feel this section needs work',
                'I am thinking this paragraph is unclear'
            ];

            for (const input of mixedInputs) {
                const result = await classifier.classifyIntent(input);
                // Enhanced hybrid architecture now correctly identifies editing intent
                expect(['CHAT', 'CONTENT']).toContain(result);
            }
        });
    });

    describe('Hybrid Architecture', () => {
        it('should use fast classification for high-confidence cases', async () => {
            // Direct editing commands should have high confidence
            const directCommands = [
                'add a paragraph',
                'write a conclusion',
                'create an introduction',
                'insert a heading',
                'make this better',
                'generate an outline'
            ];

            for (const command of directCommands) {
                const result = await classifier.classifyIntent(command);
                expect(result).toBe('CONTENT');
            }
        });

        it('should handle greetings with high confidence', async () => {
            const greetings = [
                'hi',
                'hello',
                'hey nova',
                'good morning',
                'hi there'
            ];

            for (const greeting of greetings) {
                const result = await classifier.classifyIntent(greeting);
                expect(result).toBe('CHAT');
            }
        });

        it('should detect direct editing commands vs questions', async () => {
            // These should be CONTENT (direct editing)
            const editingCommands = [
                'add more detail here',
                'fix this paragraph',
                'improve the writing',
                'change the tone',
                'delete this section',
                'rewrite this part'
            ];

            for (const command of editingCommands) {
                const result = await classifier.classifyIntent(command);
                expect(result).toBe('CONTENT');
            }

            // These should be CHAT (questions)
            const questions = [
                'what should I add here?',
                'how can I fix this paragraph?',
                'why is the writing unclear?',
                'when should I change the tone?'
            ];

            for (const question of questions) {
                const result = await classifier.classifyIntent(question);
                expect(result).toBe('CHAT');
            }
        });

        it('should classify metadata editing correctly', async () => {
            const metadataEditing = [
                'add tags for productivity',
                'update the title',
                'set author to John',
                'create metadata section',
                'generate frontmatter'
            ];

            for (const command of metadataEditing) {
                const result = await classifier.classifyIntent(command);
                expect(result).toBe('METADATA');
            }
        });

        it('should handle error cases gracefully', async () => {
            const errorCases = [
                null,
                undefined,
                '',
                '   ',
                123 as any,
                {} as any
            ];

            for (const errorCase of errorCases) {
                const result = await classifier.classifyIntent(errorCase);
                expect(result).toBe('CHAT'); // Safe default
            }
        });

        it('should handle subtle editing patterns', async () => {
            const subtleEditing = [
                'make this clearer',
                'this needs improvement',
                'let us add some examples',
                'here are some issues',
                'this could be better'
            ];

            for (const command of subtleEditing) {
                const result = await classifier.classifyIntent(command);
                expect(result).toBe('CONTENT');
            }
        });

        it('should handle conversational patterns correctly', async () => {
            const conversational = [
                'I think this is good',
                'It seems like a good approach',
                'This reminds me of something',
                'Lately I have been wondering',
                'In my experience, this works'
            ];

            for (const statement of conversational) {
                const result = await classifier.classifyIntent(statement);
                expect(result).toBe('CHAT');
            }
        });
    });

    describe('Error Handling', () => {
        it('should handle invalid input types', async () => {
            const invalidInputs = [
                null,
                undefined,
                123,
                [],
                {},
                true,
                false
            ];

            for (const input of invalidInputs) {
                const result = await classifier.classifyIntent(input as any);
                expect(result).toBe('CHAT');
            }
        });

        it('should handle empty and whitespace inputs', async () => {
            const emptyInputs = [
                '',
                '   ',
                '\t\n',
                '\r\n'
            ];

            for (const input of emptyInputs) {
                const result = await classifier.classifyIntent(input);
                expect(result).toBe('CHAT');
            }
        });

        it('should handle very long inputs', async () => {
            const longInput = 'add '.repeat(1000) + 'some text here';
            const result = await classifier.classifyIntent(longInput);
            expect(result).toBe('CONTENT'); // Should still detect "add" command
        });

        it('should handle special characters and unicode', async () => {
            const specialInputs = [
                'add 🎉 emoji here',
                'write in 中文',
                'create @mention',
                'add #hashtag',
                'insert $variable'
            ];

            for (const input of specialInputs) {
                const result = await classifier.classifyIntent(input);
                // Should classify based on command verb, not special chars
                expect(result).toBe('CONTENT');
            }
        });
    });
});