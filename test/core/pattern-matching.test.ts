/**
 * Comprehensive pattern matching tests for IntentDetector
 * Tests edge cases, pattern conflicts, and classification accuracy
 */

import { IntentDetector } from '../../src/core/intent-detector';

describe('Pattern Matching Comprehensive Tests', () => {
    let detector: IntentDetector;

    beforeEach(() => {
        detector = new IntentDetector();
    });

    describe('consultation pattern edge cases', () => {
        it('should handle temporal patterns with different contexts', () => {
            const temporalVariations = [
                'Now is the time to act',
                'Today feels different',
                'This week has been productive',
                'Lately things have changed',
                'Currently working on projects',
                'These days I think differently'
            ];

            temporalVariations.forEach(input => {
                const result = detector.classifyInput(input);
                expect(result.type).toBe('consultation');
                expect(result.matchedPatterns).toContain('temporal');
            });
        });

        it('should detect personal state variations', () => {
            const personalStateVariations = [
                'I\'m feeling great today',
                'I\'m thinking this through',
                'I\'m working hard lately',
                'I\'m trying new approaches',
                'I\'ve been struggling',
                'I was considering this',
                'I feel confident'
            ];

            personalStateVariations.forEach(input => {
                const result = detector.classifyInput(input);
                expect(result.type).toBe('consultation');
                expect(result.matchedPatterns).toContain('personal_state');
            });
        });

        it('should detect reflective language variations', () => {
            const pureReflectiveVariations = [
                'This reminds me of last year',
                'I wonder about life',
                'I\'m wondering about the future'
            ];

            pureReflectiveVariations.forEach(input => {
                const result = detector.classifyInput(input);
                expect(result.type).toBe('consultation');
                expect(result.matchedPatterns).toContain('reflective');
            });

            // Mixed patterns that are ambiguous due to conflicting signals
            const mixedReflectiveVariations = [
                'It makes me think about change', // "change" triggers editing
                'I wonder if this is right'       // "this" triggers document reference
            ];

            mixedReflectiveVariations.forEach(input => {
                const result = detector.classifyInput(input);
                expect(result.type).toBe('ambiguous');
            });
        });
    });

    describe('editing pattern edge cases', () => {
        it('should handle command verb variations', () => {
            const commandVariations = [
                'Make it better',
                'Fix this issue',
                'Improve the flow',
                'Change the tone',
                'Add some examples',
                'Remove extra words',
                'Rewrite for clarity',
                'Edit the structure',
                'Write 3 paragraphs',
                'Write an introduction',
                'Create new content',
                'Compose a better ending',
                'Draft a response',
                'Generate alternative text'
            ];

            commandVariations.forEach(input => {
                const result = detector.classifyInput(input);
                expect(result.type).toBe('editing');
                expect(result.matchedPatterns).toContain('command_verb');
            });
        });

        it('should detect document reference variations', () => {
            const documentReferences = [
                'This section is long',
                'This paragraph flows well',
                'This part seems unclear',
                'The writing here is good',
                'Here we need changes'
            ];

            documentReferences.forEach(input => {
                const result = detector.classifyInput(input);
                expect(result.type).toBe('editing');
                expect(result.matchedPatterns).toContain('document_reference');
            });
        });

        it('should detect quality assessment variations', () => {
            const qualityAssessments = [
                'This is unclear to readers',
                'The logic needs work',
                'Something sounds wrong here',
                'This feels too wordy',
                'The structure is confusing'
            ];

            qualityAssessments.forEach(input => {
                const result = detector.classifyInput(input);
                expect(result.type).toBe('editing');
                expect(result.matchedPatterns).toContain('quality_assessment');
            });
        });

        it('should detect document targeting variations', () => {
            const targetingVariations = [
                'Put this at the end',
                'Add content in the introduction',
                'Insert before this section',
                'Place after that paragraph'
            ];

            targetingVariations.forEach(input => {
                const result = detector.classifyInput(input);
                expect(result.type).toBe('editing');
                expect(result.matchedPatterns).toContain('document_targeting');
            });
        });
    });

    describe('pattern conflict resolution', () => {
        it('should classify mixed consultation/editing as ambiguous', () => {
            const mixedPatterns = [
                'I feel this section needs improvement',
                'I wonder if I should fix this',
                'I\'m thinking this paragraph is unclear',
                'Lately I\'ve been making this better'
            ];

            mixedPatterns.forEach(input => {
                const result = detector.classifyInput(input);
                expect(result.type).toBe('ambiguous');
                expect(result.confidence).toBe(0.5);
                expect(result.matchedPatterns).toEqual([]);
            });
        });

        it('should handle multiple patterns of same type', () => {
            const multipleConsultation = 'Now is a time when I feel reflective';
            const result = detector.classifyInput(multipleConsultation);
            
            expect(result.type).toBe('consultation');
            expect(result.matchedPatterns.length).toBeGreaterThan(1);
            expect(result.matchedPatterns).toContain('temporal');
            expect(result.matchedPatterns).toContain('personal_state');
        });

        it('should handle multiple editing patterns', () => {
            const multipleEditing = 'Fix this section and make it clearer';
            const result = detector.classifyInput(multipleEditing);
            
            expect(result.type).toBe('editing');
            expect(result.matchedPatterns.length).toBeGreaterThan(1);
            expect(result.matchedPatterns).toContain('command_verb');
        });
    });

    describe('case sensitivity and formatting', () => {
        it('should handle different case variations', () => {
            const caseVariations = [
                'NOW IS A BUSY TIME',
                'now is a busy time',
                'Now Is A Busy Time',
                'nOw iS a BuSy TiMe'
            ];

            caseVariations.forEach(input => {
                const result = detector.classifyInput(input);
                expect(result.type).toBe('consultation');
                expect(result.matchedPatterns).toContain('temporal');
            });
        });

        it('should handle whitespace variations', () => {
            const whitespaceVariations = [
                '  Make this clearer  ',
                '\tFix\tthe\tgrammar\t',
                'Improve\nthe\nwriting',
                'Change    the    tone'
            ];

            whitespaceVariations.forEach(input => {
                const result = detector.classifyInput(input);
                expect(result.type).toBe('editing');
            });
        });

        it('should handle punctuation variations', () => {
            const punctuationVariations = [
                'Make this clearer!',
                'Fix the grammar.',
                'Improve the writing?',
                'Change the tone...'
            ];

            punctuationVariations.forEach(input => {
                const result = detector.classifyInput(input);
                expect(result.type).toBe('editing');
            });
        });
    });

    describe('boundary conditions', () => {
        it('should handle empty and minimal inputs', () => {
            const minimalInputs = [
                '',
                ' ',
                'a',
                'I',
                'fix'
            ];

            minimalInputs.forEach(input => {
                const result = detector.classifyInput(input);
                expect(['consultation', 'editing', 'ambiguous']).toContain(result.type);
                expect(result.confidence).toBeGreaterThanOrEqual(0);
                expect(result.confidence).toBeLessThanOrEqual(1);
            });
        });

        it('should handle very long inputs', () => {
            const longInput = 'Now is a time when I feel like this section really needs significant improvement and I wonder if making these changes will actually make the writing much clearer and more effective for readers who are trying to understand the concepts being presented here in this particular paragraph which seems to have some issues that need to be addressed';
            
            const result = detector.classifyInput(longInput);
            expect(result.type).toBe('ambiguous'); // Mixed patterns
        });

        it('should handle special characters and numbers', () => {
            const specialInputs = [
                'Fix this @ line 123',
                'Make section #4 better',
                'Change item 1.2.3',
                'Improve code example: function() {}'
            ];

            specialInputs.forEach(input => {
                const result = detector.classifyInput(input);
                expect(result.type).toBe('editing');
            });
        });
    });
});