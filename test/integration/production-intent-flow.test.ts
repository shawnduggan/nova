/**
 * Integration test for the actual production intent flow
 */

import { AIIntentClassifier } from '../../src/core/ai-intent-classifier';

jest.mock('../../src/ai/provider-manager');

describe('Production Intent Classification', () => {
    let classifier: AIIntentClassifier;
    let mockProviderManager: any;

    beforeEach(() => {
        mockProviderManager = {
            complete: jest.fn().mockRejectedValue(new Error('AI provider not available'))
        };
        classifier = new AIIntentClassifier(mockProviderManager);
    });

    it('should classify the reported problematic input as CONTENT', async () => {
        const problematicInput = 'add an outline for explaining to a 5 year old what a supernova is';
        
        const intent = await classifier.classifyIntent(problematicInput);
        
        expect(intent).toBe('CONTENT');
        // Verify it tried AI classification first, then fell back
        expect(mockProviderManager.complete).toHaveBeenCalled();
    });

    it('should classify single editing verbs as CONTENT', async () => {
        const editingVerbs = ['add', 'write', 'create', 'insert', 'make'];
        
        for (const verb of editingVerbs) {
            const intent = await classifier.classifyIntent(verb);
            expect(intent).toBe('CONTENT');
        }
    });

    it('should classify editing commands as CONTENT', async () => {
        const editingCommands = [
            'add something',
            'write a paragraph',
            'create new content', 
            'insert text here',
            'make a list',
            'fix this text',
            'improve the writing'
        ];
        
        for (const command of editingCommands) {
            const intent = await classifier.classifyIntent(command);
            expect(intent).toBe('CONTENT');
        }
    });

    it('should classify analysis commands as CHAT', async () => {
        const analysisCommands = [
            'summarize this document',
            'explain what this means',
            'analyze the content',
            'describe what happened', 
            'tell me about this'
        ];
        
        for (const command of analysisCommands) {
            const intent = await classifier.classifyIntent(command);
            expect(intent).toBe('CHAT');
        }
    });

    it('should prioritize primary editing verbs in mixed scenarios', async () => {
        const mixedEditingTests = [
            'add an explanation about supernovas',
            'write analysis of the data',
            'create summary of findings',
            'make notes about explaining concepts',
            'insert description of the process'
        ];
        
        for (const command of mixedEditingTests) {
            const intent = await classifier.classifyIntent(command);
            expect(intent).toBe('CONTENT');
        }
    });

    it('should prioritize primary analysis verbs in mixed scenarios', async () => {
        const mixedAnalysisTests = [
            'explain how to add items',
            'analyze what was written',
            'summarize the created content',
            'describe the process of making changes'
        ];
        
        for (const command of mixedAnalysisTests) {
            const intent = await classifier.classifyIntent(command);
            expect(intent).toBe('CHAT');
        }
    });

    it('should handle the specific user reported case correctly', async () => {
        // This is the exact case the user reported as broken
        const userInput = 'add an outline for explaining to a 5 year old what a supernova is';
        
        const intent = await classifier.classifyIntent(userInput);
        
        // This MUST be CONTENT for cursor insertion
        expect(intent).toBe('CONTENT');
    });
});