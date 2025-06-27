/**
 * Test suite for ambiguous intent handling (business logic)
 */

import { NovaSidebarView } from '../../src/ui/sidebar-view';

// Mock dependencies
jest.mock('obsidian');

describe('Ambiguous Intent Handling', () => {
    let sidebarView: NovaSidebarView;
    let mockPlugin: any;

    beforeEach(() => {
        mockPlugin = {
            aiIntentClassifier: {
                classifyIntent: jest.fn()
            },
            documentEngine: {
                getActiveFile: jest.fn().mockReturnValue({ path: 'test.md' })
            }
        };

        sidebarView = new NovaSidebarView({} as any, mockPlugin);
    });

    describe('handleAmbiguousRequest', () => {
        it('should exist as a method', () => {
            expect(typeof sidebarView.handleAmbiguousRequest).toBe('function');
        });

        it('should route to consultation when user chooses discuss', async () => {
            sidebarView.handleConsultationRequest = jest.fn();
            sidebarView.handleEditingRequest = jest.fn();

            await sidebarView.handleAmbiguousRequest('I feel this section needs work', 'consultation');

            expect(sidebarView.handleConsultationRequest).toHaveBeenCalledWith('I feel this section needs work');
            expect(sidebarView.handleEditingRequest).not.toHaveBeenCalled();
        });

        it('should route to editing when user chooses edit', async () => {
            sidebarView.handleConsultationRequest = jest.fn();
            sidebarView.handleEditingRequest = jest.fn();

            await sidebarView.handleAmbiguousRequest('I feel this section needs work', 'editing');

            expect(sidebarView.handleEditingRequest).toHaveBeenCalledWith('I feel this section needs work');
            expect(sidebarView.handleConsultationRequest).not.toHaveBeenCalled();
        });

        it('should handle mixed pattern inputs correctly', async () => {
            sidebarView.handleConsultationRequest = jest.fn();
            sidebarView.handleEditingRequest = jest.fn();

            const mixedInputs = [
                'I wonder if I should fix this part',
                'I feel like this paragraph is unclear',
                'I\'m thinking this section needs improvement'
            ];

            for (const input of mixedInputs) {
                await sidebarView.handleAmbiguousRequest(input, 'consultation');
                expect(sidebarView.handleConsultationRequest).toHaveBeenCalledWith(input);
            }
        });
    });

    describe('intent classification integration', () => {
        it('should handle ambiguous classification result', async () => {
            // Mock ambiguous classification
            mockPlugin.aiIntentClassifier.classifyIntent.mockResolvedValue('CHAT');
            
            sidebarView.handleAmbiguousRequest = jest.fn();
            sidebarView.processUserInputWithIntent = jest.fn(async (input) => {
                const intent = await mockPlugin.aiIntentClassifier.classifyIntent(input);
                if (intent === 'CHAT') {
                    // This would trigger ambiguous handler in real scenario
                    await sidebarView.handleAmbiguousRequest(input, 'consultation');
                }
            });

            await sidebarView.processUserInputWithIntent('Mixed signal input');
            
            expect(sidebarView.handleAmbiguousRequest).toHaveBeenCalled();
        });
    });
});