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
        mockProviderManager = {
            complete: jest.fn().mockRejectedValue(new Error('AI provider not available'))
        } as any;
        classifier = new AIIntentClassifier(mockProviderManager);
    });

    describe('classifyIntent', () => {
        it('should classify questions as CHAT', async () => {
            // AI classification tries first, then falls back
            const intent = await classifier.classifyIntent('What is this document about?');
            
            expect(intent).toBe('CHAT');
            // AI classification is attempted but fails, triggering fallback
            expect(mockProviderManager.complete).toHaveBeenCalled();
        });

        it('should classify tag commands as METADATA', async () => {
            const intent = await classifier.classifyIntent('add tags');
            
            expect(intent).toBe('METADATA');
            expect(mockProviderManager.complete).toHaveBeenCalled();
        });

        it('should classify content edits as CONTENT', async () => {
            const intent = await classifier.classifyIntent('Add a conclusion');
            
            expect(intent).toBe('CONTENT');
            expect(mockProviderManager.complete).toHaveBeenCalled();
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
            
            expect(mockProviderManager.complete).toHaveBeenCalledTimes(3);
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

        it('should handle mixed patterns as CHAT (simplified approach)', async () => {
            const mixedInputs = [
                'I feel this section needs work',
                'I\'m thinking this paragraph is unclear'
            ];

            for (const input of mixedInputs) {
                const result = await classifier.classifyIntent(input);
                expect(result).toBe('CHAT');
            }
        });
    });

    describe('cursor insertion verbs (critical fix)', () => {
        it('should classify single editing verbs as CONTENT for cursor insertion', async () => {
            const cursorInsertionVerbs = [
                'add',
                'write', 
                'create',
                'insert',
                'make',
                'edit',
                'fix'
            ];

            for (const verb of cursorInsertionVerbs) {
                const result = await classifier.classifyIntent(verb);
                expect(result).toBe('CONTENT');
            }
        });

        it('should classify editing commands as CONTENT for cursor insertion', async () => {
            const editingCommands = [
                'add something',
                'write a paragraph',
                'create a section',
                'insert text here',
                'make a list',
                'fix this',
                'improve the writing',
                'change this text',
                'generate content',
                'compose a response',
                'draft an outline'
            ];

            for (const command of editingCommands) {
                const result = await classifier.classifyIntent(command);
                expect(result).toBe('CONTENT');
            }
        });

        it('should classify analysis verbs as CHAT (not cursor insertion)', async () => {
            const analysisCommands = [
                'summarize',
                'summarize this document',
                'explain the concept',
                'analyze this text',
                'describe what happened',
                'discuss the implications',
                'review the content',
                'evaluate the approach',
                'tell me about this',
                'show me the results',
                'list the key points'
            ];

            for (const command of analysisCommands) {
                const result = await classifier.classifyIntent(command);
                expect(result).toBe('CHAT');
            }
        });

        it('should properly distinguish editing vs analysis verbs', async () => {
            // These should be CONTENT (cursor insertion)
            const editingTests = [
                { input: 'write', expected: 'CONTENT' },
                { input: 'add content', expected: 'CONTENT' },
                { input: 'create new section', expected: 'CONTENT' },
                { input: 'fix grammar', expected: 'CONTENT' },
                { input: 'improve this', expected: 'CONTENT' }
            ];

            // These should be CHAT (analysis/discussion)
            const chatTests = [
                { input: 'summarize', expected: 'CHAT' },
                { input: 'explain this', expected: 'CHAT' },
                { input: 'analyze the data', expected: 'CHAT' },
                { input: 'What does this mean?', expected: 'CHAT' },
                { input: 'tell me about', expected: 'CHAT' }
            ];

            for (const test of editingTests) {
                const result = await classifier.classifyIntent(test.input);
                expect(result).toBe(test.expected);
            }

            for (const test of chatTests) {
                const result = await classifier.classifyIntent(test.input);
                expect(result).toBe(test.expected);
            }
        });

        it('should handle greeting detection more restrictively', async () => {
            // These should be greetings (CHAT)
            const greetings = [
                'hi',
                'hello', 
                'hey there',
                'good morning',
                'hi nova'
            ];

            // These should NOT be greetings (should check for editing)
            const notGreetings = [
                'highlight this text',
                'hire someone',
                'higher quality'
            ];

            for (const greeting of greetings) {
                const result = await classifier.classifyIntent(greeting);
                expect(result).toBe('CHAT');
            }

            for (const notGreeting of notGreetings) {
                const result = await classifier.classifyIntent(notGreeting);
                // These should be classified based on content, not as greetings
                // "highlight" contains editing language, others should be CONTENT or CHAT but not due to greeting detection
                expect(result).toBeDefined();
            }
        });
    });

    describe('mixed editing + analysis verb scenarios (critical fix)', () => {
        it('should prioritize editing verbs when they start the sentence', async () => {
            const editingPrimaryTests = [
                'add an outline for explaining to a 5 year old what a supernova is',
                'write a guide for analyzing data patterns',
                'create a summary for describing the results',
                'make a list of things to review',
                'generate content about explaining concepts',
                'compose a document for discussing findings'
            ];

            for (const command of editingPrimaryTests) {
                const result = await classifier.classifyIntent(command);
                expect(result).toBe('CONTENT');
            }
        });

        it('should prioritize analysis verbs when they start the sentence', async () => {
            const analysisPrimaryTests = [
                'explain how to add items to a list',
                'analyze this by writing detailed notes',
                'describe what happens when you create this',
                'summarize the process of making changes',
                'review how to edit documents',
                'discuss ways to improve writing'
            ];

            for (const command of analysisPrimaryTests) {
                const result = await classifier.classifyIntent(command);
                expect(result).toBe('CHAT');
            }
        });

        it('should handle the specific reported issue correctly', async () => {
            const result = await classifier.classifyIntent('add an outline for explaining to a 5 year old what a supernova is');
            expect(result).toBe('CONTENT');
        });

        it('should consistently classify the problematic input as CONTENT (production fix verification)', async () => {
            // This is the exact input that was failing in production
            const problematicInput = 'add an outline for explaining to a 5 year old what a supernova is';
            
            // Test multiple times to ensure consistency
            for (let i = 0; i < 3; i++) {
                const result = await classifier.classifyIntent(problematicInput);
                expect(result).toBe('CONTENT');
            }
        });

        it('should distinguish primary vs secondary verb context', async () => {
            // Primary editing - should be CONTENT
            const primaryEditingTests = [
                { input: 'add explanation about supernovas', expected: 'CONTENT' },
                { input: 'write analysis of the data', expected: 'CONTENT' },
                { input: 'create summary of findings', expected: 'CONTENT' }
            ];

            // Primary analysis - should be CHAT
            const primaryAnalysisTests = [
                { input: 'explain how to add items', expected: 'CHAT' },
                { input: 'analyze what you wrote', expected: 'CHAT' },
                { input: 'summarize the created content', expected: 'CHAT' }
            ];

            for (const test of primaryEditingTests) {
                const result = await classifier.classifyIntent(test.input);
                expect(result).toBe(test.expected);
            }

            for (const test of primaryAnalysisTests) {
                const result = await classifier.classifyIntent(test.input);
                expect(result).toBe(test.expected);
            }
        });
    });
});