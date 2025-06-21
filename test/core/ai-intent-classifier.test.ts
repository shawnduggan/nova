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
});