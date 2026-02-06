/**
 * Tests for insertSmartFillPlaceholder
 */

import { insertSmartFillPlaceholder } from '../../../src/features/commands/core/CommandEngine';

describe('insertSmartFillPlaceholder', () => {
    let mockEditor: {
        getCursor: jest.Mock;
        replaceRange: jest.Mock;
        setSelection: jest.Mock;
    };

    beforeEach(() => {
        mockEditor = {
            getCursor: jest.fn(),
            replaceRange: jest.fn(),
            setSelection: jest.fn()
        };
    });

    it('should insert correct placeholder text at cursor', () => {
        mockEditor.getCursor.mockReturnValue({ line: 5, ch: 0 });

        insertSmartFillPlaceholder(mockEditor as any);

        expect(mockEditor.replaceRange).toHaveBeenCalledWith(
            '<!-- nova: Replace this text -->',
            { line: 5, ch: 0 }
        );
    });

    it('should select "Replace this text" portion', () => {
        mockEditor.getCursor.mockReturnValue({ line: 5, ch: 0 });

        insertSmartFillPlaceholder(mockEditor as any);

        const prefixLength = '<!-- nova: '.length; // 11
        const textLength = 'Replace this text'.length; // 17

        expect(mockEditor.setSelection).toHaveBeenCalledWith(
            { line: 5, ch: prefixLength },
            { line: 5, ch: prefixLength + textLength }
        );
    });

    it('should offset selection correctly when cursor is mid-line', () => {
        mockEditor.getCursor.mockReturnValue({ line: 3, ch: 10 });

        insertSmartFillPlaceholder(mockEditor as any);

        expect(mockEditor.replaceRange).toHaveBeenCalledWith(
            '<!-- nova: Replace this text -->',
            { line: 3, ch: 10 }
        );

        const prefixLength = '<!-- nova: '.length;
        const textLength = 'Replace this text'.length;

        expect(mockEditor.setSelection).toHaveBeenCalledWith(
            { line: 3, ch: 10 + prefixLength },
            { line: 3, ch: 10 + prefixLength + textLength }
        );
    });
});
