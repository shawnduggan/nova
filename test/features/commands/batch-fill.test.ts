/**
 * Tests for batch fill functionality
 * Note: Batch fill now uses sequential single fills with streaming,
 * rather than batch parsing. Tests updated accordingly.
 */

import { CommandEngine } from '../../../src/features/commands/core/CommandEngine';

describe('CommandEngine - Batch Fill', () => {
    let engine: CommandEngine;

    beforeEach(() => {
        // Mock plugin instance
        const mockPlugin = {
            aiProviderManager: {
                generateTextStream: jest.fn(),
                generateText: jest.fn()
            },
            contextBuilder: {},
            documentEngine: {
                getDocumentContext: jest.fn(),
                getActiveEditor: jest.fn(),
                addSystemMessage: jest.fn()
            },
            sidebarView: null
        } as any;

        engine = new CommandEngine(mockPlugin);
    });

    describe('detectMarkers', () => {
        it('should detect single marker', () => {
            const content = `# Test Document

<!-- nova: Write introduction -->

More content here.`;

            const markers = engine.detectMarkers(content);

            expect(markers).toHaveLength(1);
            expect(markers[0].instruction).toBe('Write introduction');
            expect(markers[0].line).toBe(2);
        });

        it('should detect multiple markers', () => {
            const content = `# Project Proposal

## Executive Summary
<!-- nova: Write a compelling 2-sentence executive summary -->

## Problem Statement
<!-- nova: Describe the problem this project solves -->

## Proposed Solution
<!-- nova: Outline the solution approach in 3 bullet points -->`;

            const markers = engine.detectMarkers(content);

            expect(markers).toHaveLength(3);
            expect(markers[0].instruction).toBe('Write a compelling 2-sentence executive summary');
            expect(markers[1].instruction).toBe('Describe the problem this project solves');
            expect(markers[2].instruction).toBe('Outline the solution approach in 3 bullet points');
        });

        it('should handle markers with multiline instructions', () => {
            const content = `<!-- nova: Write a detailed analysis
considering multiple factors
and edge cases -->`;

            const markers = engine.detectMarkers(content);

            expect(markers).toHaveLength(1);
            expect(markers[0].instruction).toContain('Write a detailed analysis');
            expect(markers[0].instruction).toContain('considering multiple factors');
        });
    });


    describe('buildSingleFillPrompt', () => {
        it('should include full document context', () => {
            const document = `# Test Document

<!-- nova: Write introduction -->

Some existing content.`;

            const marker = {
                line: 2,
                endLine: 2,
                instruction: 'Write introduction',
                position: 17,
                length: 34
            };

            const prompt = (engine as any).buildSingleFillPrompt(document, marker);

            expect(prompt).toContain('Write introduction');
            expect(prompt).toContain('# Test Document');
            expect(prompt).toContain('Some existing content');
            expect(prompt).toContain('full document for context');
        });
    });

});

