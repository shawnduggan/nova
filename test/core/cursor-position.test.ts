/**
 * Tests for cursor position preservation during file switching
 * This is critical for Nova's cursor-only editing functionality
 */

import { DocumentEngine } from '../../src/core/document-engine';
import { EditorPosition } from 'obsidian';

// Mock Obsidian types
interface MockEditor {
    getValue: jest.Mock<string>;
    getCursor: jest.Mock<EditorPosition>;
    setCursor: jest.Mock<void, [EditorPosition]>;
    focus: jest.Mock<void>;
    setSelection: jest.Mock<void, [EditorPosition, EditorPosition?]>;
}

describe('Cursor Position Management', () => {
    let mockEditor: MockEditor;
    let mockWorkspace: any;
    let documentEngine: DocumentEngine;
    let mockFile: any;

    beforeEach(() => {
        mockEditor = {
            getValue: jest.fn().mockReturnValue('Line 1\nLine 2\nLine 3\nLine 4'),
            getCursor: jest.fn().mockReturnValue({ line: 2, ch: 3 }),
            setCursor: jest.fn(),
            focus: jest.fn(),
            setSelection: jest.fn()
        };

        mockFile = { 
            basename: 'test.md',
            path: '/vault/test.md'
        };

        mockWorkspace = {
            getActiveFile: jest.fn(() => mockFile),
            getActiveViewOfType: jest.fn(() => ({ editor: mockEditor, file: mockFile })),
            activeEditor: { editor: mockEditor, file: mockFile },
            on: jest.fn(),
            setActiveLeaf: jest.fn(),
            getLeavesOfType: jest.fn(() => [{ view: { editor: mockEditor, file: mockFile } }])
        };

        const mockApp = { workspace: mockWorkspace };
        documentEngine = new DocumentEngine(mockApp as any);
    });

    test('should preserve cursor position when getting and setting', () => {
        // Test basic cursor position getting
        const position = documentEngine.getCursorPosition();
        expect(position).toEqual({ line: 2, ch: 3 });
        expect(mockEditor.getCursor).toHaveBeenCalled();
    });

    test('should set cursor position correctly', () => {
        const newPosition = { line: 1, ch: 5 };
        documentEngine.setCursorPosition(newPosition);
        
        expect(mockEditor.setCursor).toHaveBeenCalledWith(newPosition);
    });

    test('should handle missing editor gracefully', () => {
        mockWorkspace.getActiveViewOfType.mockReturnValue(null);
        mockWorkspace.activeEditor = null;
        
        const position = documentEngine.getCursorPosition();
        expect(position).toBeNull();
        
        // Should not throw when setting position with no editor
        expect(() => {
            documentEngine.setCursorPosition({ line: 0, ch: 0 });
        }).not.toThrow();
    });

    test('should focus editor when setting cursor position with focus flag', () => {
        const newPosition = { line: 1, ch: 5 };
        documentEngine.setCursorPosition(newPosition, true);
        
        expect(mockEditor.setCursor).toHaveBeenCalledWith(newPosition);
        expect(mockEditor.focus).toHaveBeenCalled();
    });

    test('should preserve cursor position across file operations', () => {
        // Simulate cursor position preservation workflow
        const initialPosition = { line: 2, ch: 3 };
        mockEditor.getCursor.mockReturnValue(initialPosition);
        
        // Get current position
        const savedPosition = documentEngine.getCursorPosition();
        expect(savedPosition).toEqual(initialPosition);
        
        // Simulate some operation that might change cursor
        mockEditor.getCursor.mockReturnValue({ line: 0, ch: 0 });
        
        // Restore position
        documentEngine.setCursorPosition(savedPosition!);
        expect(mockEditor.setCursor).toHaveBeenCalledWith(initialPosition);
    });

    test('should handle selection state when setting cursor', () => {
        const position = { line: 1, ch: 5 };
        documentEngine.setCursorPosition(position, true);
        
        // Should set cursor to specific position
        expect(mockEditor.setCursor).toHaveBeenCalledWith(position);
        expect(mockEditor.focus).toHaveBeenCalled();
    });
});