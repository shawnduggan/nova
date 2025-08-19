/**
 * Tests for DocumentEngine - Cursor-Only System
 */

import { DocumentEngine } from '../../src/core/document-engine';
import { App, Editor, MarkdownView, TFile, Notice } from '../mocks/obsidian-mock';
import { DocumentContext, EditResult } from '../../src/core/types';
import { App as ObsidianApp } from 'obsidian';

describe('DocumentEngine', () => {
    let app: App;
    let engine: DocumentEngine;
    let mockEditor: Editor;
    let mockFile: TFile;
    let mockView: MarkdownView;

    beforeEach(() => {
        // Set up mocks
        app = new App();
        engine = new DocumentEngine(app as unknown as ObsidianApp);
        
        mockFile = new TFile('test-doc.md');
        mockEditor = new Editor('# Test Document\n\nThis is a test document with cursor at line 2.');
        
        // Mock the workspace to return our editor and file
        mockView = {
            editor: mockEditor,
            file: mockFile
        } as any;
        
        app.workspace.getActiveViewOfType = jest.fn().mockReturnValue(mockView);
        app.workspace.getActiveFile = jest.fn().mockReturnValue(mockFile);
        app.workspace.activeEditor = { editor: mockEditor, file: mockFile };
    });

    describe('getActiveEditor', () => {
        it('should return the active editor', () => {
            const editor = engine.getActiveEditor();
            expect(editor).toBe(mockEditor);
        });

        it('should return null when no editor is active', () => {
            app.workspace.getActiveViewOfType = jest.fn().mockReturnValue(null);
            app.workspace.activeEditor = null;
            app.workspace.getLeavesOfType = jest.fn().mockReturnValue([]);
            const editor = engine.getActiveEditor();
            expect(editor).toBeNull();
        });
    });

    describe('getActiveFile', () => {
        it('should return the active file', () => {
            const file = engine.getActiveFile();
            expect(file).toBe(mockFile);
        });

        it('should return null when no file is active', () => {
            app.workspace.getActiveFile = jest.fn().mockReturnValue(null);
            const file = engine.getActiveFile();
            expect(file).toBeNull();
        });
    });

    describe('getSelectedText', () => {
        it('should return selected text', () => {
            mockEditor.getSelection = jest.fn().mockReturnValue('selected text');
            const text = engine.getSelectedText();
            expect(text).toBe('selected text');
        });

        it('should return empty string when no selection', () => {
            mockEditor.getSelection = jest.fn().mockReturnValue('');
            const text = engine.getSelectedText();
            expect(text).toBe('');
        });

        it('should return empty string when no editor', () => {
            app.workspace.getActiveViewOfType = jest.fn().mockReturnValue(null);
            app.workspace.activeEditor = null;
            app.workspace.getLeavesOfType = jest.fn().mockReturnValue([]);
            const text = engine.getSelectedText();
            expect(text).toBe('');
        });
    });

    describe('getCursorPosition', () => {
        it('should return cursor position', () => {
            const mockPosition = { line: 2, ch: 5 };
            mockEditor.getCursor = jest.fn().mockReturnValue(mockPosition);
            
            const position = engine.getCursorPosition();
            expect(position).toEqual(mockPosition);
        });

        it('should return null when no editor', () => {
            app.workspace.getActiveViewOfType = jest.fn().mockReturnValue(null);
            app.workspace.activeEditor = null;
            app.workspace.getLeavesOfType = jest.fn().mockReturnValue([]);
            const position = engine.getCursorPosition();
            expect(position).toBeNull();
        });
    });

    describe('getDocumentContext', () => {
        it('should extract complete document context', async () => {
            mockEditor.getCursor = jest.fn().mockReturnValue({ line: 2, ch: 10 });
            mockEditor.getSelection = jest.fn().mockReturnValue('selected text');
            
            const context = await engine.getDocumentContext();
            
            expect(context).not.toBeNull();
            expect(context!.file).toBe(mockFile);
            expect(context!.filename).toBe('test-doc');
            expect(context!.content).toContain('# Test Document');
            expect(context!.selectedText).toBe('selected text');
            expect(context!.cursorPosition).toEqual({ line: 2, ch: 10 });
        });

        it('should extract headings correctly', async () => {
            const context = await engine.getDocumentContext();
            
            expect(context!.headings).toHaveLength(1);
            expect(context!.headings[0]).toEqual({
                text: 'Test Document',
                level: 1,
                line: 0,
                position: { start: 0, end: 15 }
            });
        });

        it('should return null when no editor or file', async () => {
            app.workspace.getActiveViewOfType = jest.fn().mockReturnValue(null);
            app.workspace.activeEditor = null;
            app.workspace.getLeavesOfType = jest.fn().mockReturnValue([]);
            app.workspace.getActiveFile = jest.fn().mockReturnValue(null);
            const context = await engine.getDocumentContext();
            expect(context).toBeNull();
        });
    });

    describe('applyEdit', () => {
        beforeEach(() => {
            mockEditor.replaceRange = jest.fn();
            mockEditor.replaceSelection = jest.fn();
            mockEditor.lastLine = jest.fn().mockReturnValue(10);
            mockEditor.getLine = jest.fn().mockReturnValue('Last line content');
        });

        it('should insert at cursor position', async () => {
            const cursorPos = { line: 2, ch: 5 };
            mockEditor.getCursor = jest.fn().mockReturnValue(cursorPos);
            
            const result = await engine.applyEdit('inserted text', 'cursor');
            
            expect(result.success).toBe(true);
            expect(result.editType).toBe('insert');
            expect(result.appliedAt).toEqual(cursorPos);
            expect(mockEditor.replaceRange).toHaveBeenCalledWith('inserted text', cursorPos);
        });

        it('should replace selection', async () => {
            mockEditor.getSelection = jest.fn().mockReturnValue('old text');
            mockEditor.getCursor = jest.fn().mockReturnValue({ line: 1, ch: 0 });
            
            const result = await engine.applyEdit('new text', 'selection');
            
            expect(result.success).toBe(true);
            expect(result.editType).toBe('replace');
            expect(mockEditor.replaceSelection).toHaveBeenCalledWith('new text');
        });

        it('should append to end of document', async () => {
            mockEditor.getValue = jest.fn().mockReturnValue('existing content');
            
            const result = await engine.applyEdit('appended text', 'end');
            
            expect(result.success).toBe(true);
            expect(result.editType).toBe('append');
            expect(mockEditor.replaceRange).toHaveBeenCalledWith(
                '\nappended text',
                { line: 10, ch: 17 }
            );
        });

        it('should handle specific position', async () => {
            const specificPos = { line: 5, ch: 10 };
            
            const result = await engine.applyEdit('inserted text', specificPos);
            
            expect(result.success).toBe(true);
            expect(result.editType).toBe('insert');
            expect(result.appliedAt).toEqual(specificPos);
            expect(mockEditor.replaceRange).toHaveBeenCalledWith('inserted text', specificPos);
        });

        it('should handle edit options', async () => {
            const cursorPos = { line: 2, ch: 5 };
            mockEditor.getCursor = jest.fn().mockReturnValue(cursorPos);
            mockEditor.setSelection = jest.fn();
            mockEditor.scrollIntoView = jest.fn();
            
            const result = await engine.applyEdit('text', 'cursor', {
                selectNewText: true,
                scrollToEdit: true
            });
            
            expect(result.success).toBe(true);
            expect(mockEditor.setSelection).toHaveBeenCalled();
            expect(mockEditor.scrollIntoView).toHaveBeenCalled();
        });

        it('should return error when no editor', async () => {
            app.workspace.getActiveViewOfType = jest.fn().mockReturnValue(null);
            app.workspace.activeEditor = null;
            app.workspace.getLeavesOfType = jest.fn().mockReturnValue([]);
            
            const result = await engine.applyEdit('text', 'cursor');
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('No active editor');
        });
    });

    describe('deleteContent', () => {
        beforeEach(() => {
            mockEditor.replaceSelection = jest.fn();
            mockEditor.replaceRange = jest.fn();
            app.vault.modify = jest.fn().mockResolvedValue(undefined);
        });

        it('should delete selected text', async () => {
            mockEditor.getSelection = jest.fn().mockReturnValue('selected text');
            
            const result = await engine.deleteContent('selection');
            
            expect(result.success).toBe(true);
            expect(result.editType).toBe('delete');
            expect(mockEditor.replaceSelection).toHaveBeenCalledWith('');
        });

        it('should delete current line', async () => {
            mockEditor.getCursor = jest.fn().mockReturnValue({ line: 3, ch: 10 });
            
            const result = await engine.deleteContent('line');
            
            expect(result.success).toBe(true);
            expect(result.editType).toBe('delete');
            expect(mockEditor.replaceRange).toHaveBeenCalledWith(
                '',
                { line: 3, ch: 0 },
                { line: 4, ch: 0 }
            );
        });

        it('should return error when no editor', async () => {
            app.workspace.getActiveViewOfType = jest.fn().mockReturnValue(null);
            app.workspace.activeEditor = null;
            app.workspace.getLeavesOfType = jest.fn().mockReturnValue([]);
            
            const result = await engine.deleteContent('selection');
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('No active editor');
        });
    });

    describe('getDocumentContent', () => {
        it('should return full document content', async () => {
            const content = await engine.getDocumentContent();
            
            expect(content).toContain('# Test Document');
            expect(content).toContain('This is a test document');
        });

        it('should return null when no editor', async () => {
            app.workspace.getActiveViewOfType = jest.fn().mockReturnValue(null);
            app.workspace.activeEditor = null;
            app.workspace.getLeavesOfType = jest.fn().mockReturnValue([]);
            
            const content = await engine.getDocumentContent();
            expect(content).toBeNull();
        });
    });

    describe('setDocumentContent', () => {
        it('should replace entire document using editor.setValue', async () => {
            mockEditor.setValue = jest.fn();
            
            const newContent = '# New Document\n\nCompletely new content';
            const result = await engine.setDocumentContent(newContent);
            
            expect(result.success).toBe(true);
            expect(result.editType).toBe('replace');
            expect(mockEditor.setValue).toHaveBeenCalledWith(newContent);
        });

        it('should return error when no editor', async () => {
            // Mock getActiveEditor to return null
            jest.spyOn(engine, 'getActiveEditor').mockReturnValue(null);
            
            const result = await engine.setDocumentContent('content');
            
            expect(result.success).toBe(false);
            expect(result.error).toContain('No active editor');
        });

        it('should handle editor.setValue errors', async () => {
            mockEditor.setValue = jest.fn().mockImplementation(() => {
                throw new Error('Editor error');
            });
            
            const result = await engine.setDocumentContent('content');
            
            expect(result.success).toBe(false);
            expect(result.error).toBe('Editor error');
        });
    });
});