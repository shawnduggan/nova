/**
 * Integration tests for intent detection flow
 * Tests the complete pipeline from user input to handler execution
 */

import { NovaSidebarView } from '../../src/ui/sidebar-view';
import { AIIntentClassifier } from '../../src/core/ai-intent-classifier';
import { IntentDetector } from '../../src/core/intent-detector';

// Mock dependencies
jest.mock('obsidian');
jest.mock('../../src/ai/provider-manager');

describe('Intent Detection Integration', () => {
    let sidebarView: NovaSidebarView;
    let intentClassifier: AIIntentClassifier;
    let intentDetector: IntentDetector;
    let mockPlugin: any;

    beforeEach(() => {
        mockPlugin = {
            aiIntentClassifier: new AIIntentClassifier({} as any),
            commandParser: {
                parseCommand: jest.fn().mockReturnValue({
                    action: 'edit',
                    instruction: 'test'
                })
            },
            documentEngine: {
                getActiveFile: jest.fn().mockReturnValue({ path: 'test.md' })
            },
            promptBuilder: {
                buildPromptForMessage: jest.fn().mockResolvedValue({
                    systemPrompt: 'system',
                    userPrompt: 'user'
                })
            },
            aiProviderManager: {
                complete: jest.fn().mockResolvedValue('AI response')
            }
        };

        sidebarView = new NovaSidebarView({} as any, mockPlugin);
        intentClassifier = mockPlugin.aiIntentClassifier;
        intentDetector = new IntentDetector();

        // Mock handler methods
        sidebarView.displayChatResponse = jest.fn();
        sidebarView.showModeIndicator = jest.fn();
    });

    describe('end-to-end intent flow', () => {
        it('should route consultation patterns to chat handler', async () => {
            const consultationInputs = [
                'Now is a busy time for me',
                'I\'m feeling overwhelmed',
                'This reminds me of something'
            ];

            for (const input of consultationInputs) {
                const intent = await intentClassifier.classifyIntent(input);
                expect(intent).toBe('CHAT');

                await sidebarView.processUserInputWithIntent(input);
                expect(sidebarView.displayChatResponse).toHaveBeenCalledWith('AI response');
            }
        });

        it('should route editing patterns to content handler', async () => {
            const editingInputs = [
                'Make this clearer',
                'Fix the grammar',
                'This section needs work'
            ];

            const executeCommandSpy = jest.spyOn(sidebarView as any, 'executeCommand').mockResolvedValue('Edit complete');

            for (const input of editingInputs) {
                const intent = await intentClassifier.classifyIntent(input);
                expect(intent).toBe('CONTENT');

                await sidebarView.processUserInputWithIntent(input);
                expect(executeCommandSpy).toHaveBeenCalled();
            }
        });

        it('should preserve existing question handling', async () => {
            const questionInputs = [
                'What is this about?',
                'How does this work?',
                'Why did this happen?'
            ];

            for (const input of questionInputs) {
                const intent = await intentClassifier.classifyIntent(input);
                expect(intent).toBe('CHAT');

                await sidebarView.processUserInputWithIntent(input);
                expect(sidebarView.displayChatResponse).toHaveBeenCalledWith('AI response');
            }
        });

        it('should preserve existing metadata handling', async () => {
            const metadataInputs = [
                'Add tags to this note',
                'Update the title',
                'Set author metadata'
            ];

            const executeCommandSpy = jest.spyOn(sidebarView as any, 'executeCommand').mockResolvedValue('Metadata updated');

            for (const input of metadataInputs) {
                const intent = await intentClassifier.classifyIntent(input);
                expect(intent).toBe('METADATA');

                await sidebarView.processUserInputWithIntent(input);
                expect(executeCommandSpy).toHaveBeenCalled();
            }
        });
    });

    describe('pattern matching accuracy', () => {
        it('should correctly identify consultation vs editing patterns', () => {
            // Test consultation patterns
            const consultationTests = [
                { input: 'Now is a difficult time', expected: 'consultation' },
                { input: 'I\'m thinking about this approach', expected: 'consultation' },
                { input: 'This reminds me of my childhood', expected: 'consultation' }
            ];

            consultationTests.forEach(({ input, expected }) => {
                const result = intentDetector.classifyInput(input);
                expect(result.type).toBe(expected);
                expect(result.confidence).toBeGreaterThan(0.5);
            });

            // Test editing patterns
            const editingTests = [
                { input: 'Make this paragraph better', expected: 'editing' },
                { input: 'This section is unclear', expected: 'editing' },
                { input: 'Add conclusion at the end', expected: 'editing' }
            ];

            editingTests.forEach(({ input, expected }) => {
                const result = intentDetector.classifyInput(input);
                expect(result.type).toBe(expected);
                expect(result.confidence).toBeGreaterThan(0.5);
            });
        });

        it('should handle edge cases appropriately', () => {
            const edgeCases = [
                { input: 'I feel this section needs improvement', expected: 'ambiguous' },
                { input: '', expected: 'ambiguous' },
                { input: 'Random unrelated text', expected: 'ambiguous' }
            ];

            edgeCases.forEach(({ input, expected }) => {
                const result = intentDetector.classifyInput(input);
                expect(result.type).toBe(expected);
            });
        });
    });

    describe('system integration', () => {
        it('should maintain existing command parsing integration', async () => {
            await sidebarView.processUserInputWithIntent('Fix grammar errors');
            
            expect(mockPlugin.commandParser.parseCommand).toHaveBeenCalledWith('Fix grammar errors');
        });

        it('should maintain existing provider integration', async () => {
            await sidebarView.processUserInputWithIntent('I\'m wondering about this');
            
            expect(mockPlugin.promptBuilder.buildPromptForMessage).toHaveBeenCalled();
            expect(mockPlugin.aiProviderManager.complete).toHaveBeenCalled();
        });

        it('should not break existing functionality', async () => {
            // Test that existing methods still work
            const executeCommandSpy = jest.spyOn(sidebarView as any, 'executeCommand').mockResolvedValue('Success');
            
            await sidebarView.handleEditingRequest('Standard edit command');
            expect(executeCommandSpy).toHaveBeenCalled();

            await sidebarView.handleConsultationRequest('Standard consultation');
            expect(sidebarView.displayChatResponse).toHaveBeenCalled();
        });
    });
});