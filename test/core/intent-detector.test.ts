import { IntentDetector, IntentClassification } from '../../src/core/intent-detector';

describe('IntentDetector', () => {
    let detector: IntentDetector;

    beforeEach(() => {
        detector = new IntentDetector();
    });

    describe('class structure', () => {
        it('should instantiate correctly', () => {
            expect(detector).toBeInstanceOf(IntentDetector);
        });

        it('should have classifyInput method', () => {
            expect(detector.classifyInput).toBeDefined();
            expect(typeof detector.classifyInput).toBe('function');
        });

        it('should return IntentClassification from classifyInput', () => {
            const result = detector.classifyInput('test input');
            expect(result).toHaveProperty('type');
            expect(result).toHaveProperty('confidence');
            expect(result).toHaveProperty('matchedPatterns');
            expect(Array.isArray(result.matchedPatterns)).toBe(true);
        });

        it('should return valid intent types', () => {
            const result = detector.classifyInput('test input');
            expect(['consultation', 'editing', 'ambiguous']).toContain(result.type);
        });

        it('should return confidence between 0 and 1', () => {
            const result = detector.classifyInput('test input');
            expect(result.confidence).toBeGreaterThanOrEqual(0);
            expect(result.confidence).toBeLessThanOrEqual(1);
        });
    });

    describe('consultation patterns', () => {
        it('should detect temporal personal context', () => {
            const temporalInputs = [
                'Now is a busy time for me',
                'Today I feel productive',
                'This week has been challenging',
                'Lately I\'ve been thinking',
                'Currently working on multiple projects',
                'These days I wonder about AI'
            ];

            temporalInputs.forEach(input => {
                const result = detector.classifyInput(input);
                expect(result.type).toBe('consultation');
                expect(result.confidence).toBeGreaterThan(0.5);
                expect(result.matchedPatterns.length).toBeGreaterThan(0);
            });
        });

        it('should detect personal state sharing', () => {
            const personalInputs = [
                'I\'m feeling overwhelmed with work',
                'I\'m thinking about the future',
                'I\'m working on a new project',
                'I\'m trying to understand this',
                'I\'ve been struggling lately',
                'I was wondering about this',
                'I feel like this is important'
            ];

            personalInputs.forEach(input => {
                const result = detector.classifyInput(input);
                expect(result.type).toBe('consultation');
                expect(result.confidence).toBeGreaterThan(0.5);
                expect(result.matchedPatterns.length).toBeGreaterThan(0);
            });
        });

        it('should detect reflective language', () => {
            const reflectiveInputs = [
                'This reminds me of something',
                'It makes me think about life',
                'I wonder about the future',  // Changed from "I wonder if this is right" to avoid mixed pattern
                'I\'m wondering about the approach'
            ];

            reflectiveInputs.forEach(input => {
                const result = detector.classifyInput(input);
                expect(result.type).toBe('consultation');
                expect(result.confidence).toBeGreaterThan(0.5);
                expect(result.matchedPatterns.length).toBeGreaterThan(0);
            });
        });
    });

    describe('editing patterns', () => {
        it('should detect direct command verbs', () => {
            const commandInputs = [
                'Make this paragraph clearer',
                'Fix the grammar here',
                'Improve this section',
                'Change the wording',
                'Add more detail',
                'Remove redundancy',
                'Rewrite this part',
                'Edit for clarity',
                'Write 3 paragraphs',
                'Write a conclusion',
                'Create an introduction',
                'Compose a summary',
                'Draft the outline',
                'Generate some examples'
            ];

            commandInputs.forEach(input => {
                const result = detector.classifyInput(input);
                expect(result.type).toBe('editing');
                expect(result.confidence).toBeGreaterThan(0.5);
                expect(result.matchedPatterns.length).toBeGreaterThan(0);
            });
        });

        it('should detect document references', () => {
            const documentInputs = [
                'This section needs work',
                'This paragraph is unclear',
                'This part sounds awkward',
                'The writing here is verbose',
                'Here needs improvement'
            ];

            documentInputs.forEach(input => {
                const result = detector.classifyInput(input);
                expect(result.type).toBe('editing');
                expect(result.confidence).toBeGreaterThan(0.5);
                expect(result.matchedPatterns.length).toBeGreaterThan(0);
            });
        });

        it('should detect quality assessments', () => {
            const qualityInputs = [
                'This is unclear',
                'It needs work on clarity',
                'The phrasing sounds wrong',
                'This is too wordy',
                'The logic is confusing'
            ];

            qualityInputs.forEach(input => {
                const result = detector.classifyInput(input);
                expect(result.type).toBe('editing');
                expect(result.confidence).toBeGreaterThan(0.5);
                expect(result.matchedPatterns.length).toBeGreaterThan(0);
            });
        });

        it('should detect document targeting', () => {
            const targetingInputs = [
                'Add this at the end',
                'Put this in the introduction',
                'Insert before this paragraph',
                'Add after that section'
            ];

            targetingInputs.forEach(input => {
                const result = detector.classifyInput(input);
                expect(result.type).toBe('editing');
                expect(result.confidence).toBeGreaterThan(0.5);
                expect(result.matchedPatterns.length).toBeGreaterThan(0);
            });
        });
    });

    describe('classification logic', () => {
        it('should classify mixed patterns as ambiguous', () => {
            const mixedInputs = [
                'I feel like this section needs improvement',
                'I wonder if I should fix this part',
                'I\'m thinking this paragraph is unclear'
            ];

            mixedInputs.forEach(input => {
                const result = detector.classifyInput(input);
                expect(result.type).toBe('ambiguous');
                expect(result.confidence).toBe(0.5);
                expect(result.matchedPatterns).toEqual([]);
            });
        });

        it('should classify no pattern matches as ambiguous', () => {
            const neutralInputs = [
                'This is a test',
                'Hello world',
                'Random text without patterns'
            ];

            neutralInputs.forEach(input => {
                const result = detector.classifyInput(input);
                expect(result.type).toBe('ambiguous');
                expect(result.confidence).toBe(0.5);
                expect(result.matchedPatterns).toEqual([]);
            });
        });

        it('should prioritize clear consultation over mixed signals', () => {
            const clearConsultationInputs = [
                'Now is a busy time',
                'Today I feel productive',
                'I\'m wondering about life'
            ];

            clearConsultationInputs.forEach(input => {
                const result = detector.classifyInput(input);
                expect(result.type).toBe('consultation');
                expect(result.confidence).toBe(0.9);
                expect(result.matchedPatterns.length).toBeGreaterThan(0);
            });
        });

        it('should prioritize clear editing over mixed signals', () => {
            const clearEditingInputs = [
                'Make this clearer',
                'Fix the grammar',
                'This part is unclear'
            ];

            clearEditingInputs.forEach(input => {
                const result = detector.classifyInput(input);
                expect(result.type).toBe('editing');
                expect(result.confidence).toBe(0.9);
                expect(result.matchedPatterns.length).toBeGreaterThan(0);
            });
        });
    });
});