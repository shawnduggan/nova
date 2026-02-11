import { CUSTOM_PROMPT_HISTORY_MAX } from '../../src/constants';

describe('Custom Instruction History', () => {
    let history: string[];

    const addToHistory = (instruction: string) => {
        const trimmed = instruction.trim();

        // Deduplicate: case-insensitive, trimmed comparison
        const existingIndex = history.findIndex(
            h => h.trim().toLowerCase() === trimmed.toLowerCase()
        );
        if (existingIndex !== -1) {
            history.splice(existingIndex, 1);
        }

        // Prepend (most recent first)
        history.unshift(trimmed);

        // Cap at max
        if (history.length > CUSTOM_PROMPT_HISTORY_MAX) {
            history.splice(CUSTOM_PROMPT_HISTORY_MAX);
        }
    };

    const removeFromHistory = (index: number) => {
        history.splice(index, 1);
    };

    beforeEach(() => {
        history = [];
    });

    test('should add instruction to history', () => {
        addToHistory('make this more persuasive');
        expect(history).toEqual(['make this more persuasive']);
    });

    test('should prepend most recent instruction', () => {
        addToHistory('first instruction');
        addToHistory('second instruction');
        expect(history[0]).toBe('second instruction');
        expect(history[1]).toBe('first instruction');
    });

    test('should deduplicate case-insensitively', () => {
        addToHistory('Make this persuasive');
        addToHistory('MAKE THIS PERSUASIVE');
        expect(history).toHaveLength(1);
        expect(history[0]).toBe('MAKE THIS PERSUASIVE');
    });

    test('should bump duplicate to top', () => {
        addToHistory('first');
        addToHistory('second');
        addToHistory('first');
        expect(history).toEqual(['first', 'second']);
    });

    test('should trim whitespace', () => {
        addToHistory('  padded instruction  ');
        expect(history[0]).toBe('padded instruction');
    });

    test('should cap at CUSTOM_PROMPT_HISTORY_MAX items', () => {
        for (let i = 0; i < CUSTOM_PROMPT_HISTORY_MAX + 2; i++) {
            addToHistory(`instruction ${i}`);
        }
        expect(history).toHaveLength(CUSTOM_PROMPT_HISTORY_MAX);
    });

    test('should drop oldest when exceeding max', () => {
        for (let i = 0; i < CUSTOM_PROMPT_HISTORY_MAX + 1; i++) {
            addToHistory(`instruction ${i}`);
        }
        // Most recent should be first
        expect(history[0]).toBe(`instruction ${CUSTOM_PROMPT_HISTORY_MAX}`);
        // Oldest (instruction 0) should be gone
        expect(history).not.toContain('instruction 0');
    });

    test('should remove item at index', () => {
        addToHistory('a');
        addToHistory('b');
        addToHistory('c');
        removeFromHistory(1); // remove 'b'
        expect(history).toEqual(['c', 'a']);
    });

    test('should handle removing last item', () => {
        addToHistory('only item');
        removeFromHistory(0);
        expect(history).toEqual([]);
    });

    test('CUSTOM_PROMPT_HISTORY_MAX should be 5', () => {
        expect(CUSTOM_PROMPT_HISTORY_MAX).toBe(5);
    });

    test('should handle empty string gracefully', () => {
        // The modal checks for empty before calling addToHistory,
        // but the function itself should handle it
        addToHistory('   ');
        expect(history).toEqual(['']);
    });

    test('should deduplicate trimmed comparison', () => {
        addToHistory('hello world');
        addToHistory('  hello world  ');
        expect(history).toHaveLength(1);
        expect(history[0]).toBe('hello world');
    });
});
