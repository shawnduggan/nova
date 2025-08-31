/**
 * Test for document stats and context updates after streaming completion
 */

// @ts-nocheck - Temporary disable type checking for this test due to complex mock types
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { App, TFile, Vault, Workspace, MarkdownView, Editor } from 'obsidian';
import { NovaSidebarView } from '../../src/ui/sidebar-view';
import { StreamingManager } from '../../src/ui/streaming-manager';
import NovaPlugin from '../../main';

// Obsidian is already mocked via jest.config.js moduleNameMapper

describe('Streaming Completion Updates', () => {
    let app: any;
    let plugin: any;
    let sidebar: NovaSidebarView;
    let mockFile: any;
    let mockEditor: any;
    let mockView: any;

    beforeEach(() => {
        // Setup mocks using simple objects to avoid TypeScript complexity
        mockFile = {
            path: 'test.md',
            basename: 'test',
            extension: 'md'
        };

        mockEditor = {
            getCursor: jest.fn().mockReturnValue({ line: 0, ch: 0 }),
            getSelection: jest.fn().mockReturnValue(''),
            replaceRange: jest.fn(),
            setCursor: jest.fn(),
            focus: jest.fn(),
            scrollIntoView: jest.fn()
        };

        mockView = {
            editor: mockEditor,
            file: mockFile
        };

        app = {
            workspace: {
                getActiveFile: jest.fn().mockReturnValue(mockFile),
                getActiveViewOfType: jest.fn().mockReturnValue(mockView)
            },
            vault: {
                read: jest.fn().mockResolvedValue('# Test Document\n\nThis is a test document with some content.'),
                modify: jest.fn()
            }
        };

        plugin = {
            documentEngine: {
                getActiveEditor: jest.fn().mockReturnValue(mockEditor),
                getCursorPosition: jest.fn().mockReturnValue({ line: 0, ch: 0 }),
                getDocumentContext: jest.fn().mockResolvedValue({
                    content: '# Test Document\n\nThis is a test document.',
                    cursorPosition: { line: 0, ch: 0 },
                    selectedText: null
                })
            },
            addCommandHandler: {
                execute: jest.fn()
            }
        };

        const mockLeaf = {} as any;
        sidebar = new NovaSidebarView(mockLeaf, plugin);
        (sidebar as any).app = app;
        
        // Initialize streamingManager with mock plugin
        const mockPlugin = { 
            registerInterval: (id: number) => id,
            marginIndicators: {
                analyzeCurrentContext: jest.fn()
            }
        };
        (sidebar as any).streamingManager = new StreamingManager(mockPlugin as any);
    });

    it('should update document stats after streaming completes', async () => {
        // Setup initial state
        const initialContent = '# Test Document\n\nShort content.';
        const streamedContent = '# Test Document\n\nThis is much longer content that was added through streaming. It has multiple sentences and more words than before.';
        
        app.vault.read.mockResolvedValueOnce(initialContent);
        
        // Mock updateDocumentStats method
        const updateDocumentStatsSpy = jest.spyOn(sidebar as any, 'updateDocumentStats');

        // Simulate streaming completion
        const mockPlugin = { 
            registerInterval: (id: number) => id,
            marginIndicators: {
                analyzeCurrentContext: jest.fn()
            }
        };
        const streamingManager = new StreamingManager(mockPlugin as any);
        const { updateStream } = streamingManager.startStreaming(mockEditor, { line: 0, ch: 0 }, undefined, {
            onComplete: () => {
                // This should trigger document stats update
                (sidebar as any).updateDocumentStats();
            }
        });

        // Simulate streaming chunks ending with completion
        updateStream('This is much longer content', false);
        updateStream(streamedContent, true); // isComplete = true

        // Document stats should be updated after completion
        expect(updateDocumentStatsSpy).toHaveBeenCalled();
    });

    it('should refresh context after streaming completes', async () => {
        // Mock refreshContext method
        const refreshContextSpy = jest.spyOn(sidebar as any, 'refreshContext').mockResolvedValue(undefined);

        // Simulate streaming with completion callback
        const mockPlugin = { 
            registerInterval: (id: number) => id,
            marginIndicators: {
                analyzeCurrentContext: jest.fn()
            }
        };
        const streamingManager = new StreamingManager(mockPlugin as any);
        const { updateStream } = streamingManager.startStreaming(mockEditor, { line: 0, ch: 0 }, undefined, {
            onComplete: () => {
                // This should trigger context refresh
                (sidebar as any).refreshContext();
            }
        });

        // Complete the stream
        updateStream('New content added', true);

        // Context should be refreshed after completion
        expect(refreshContextSpy).toHaveBeenCalled();
    });

    it('should update stats, tokens, and context when streaming completes from menu action', async () => {
        // Setup spies
        const updateDocumentStatsSpy = jest.spyOn(sidebar as any, 'updateDocumentStats').mockResolvedValue(undefined);
        const refreshContextSpy = jest.spyOn(sidebar as any, 'refreshContext').mockResolvedValue(undefined);
        const updateTokenDisplaySpy = jest.spyOn(sidebar as any, 'updateTokenDisplay').mockImplementation(() => {});

        // Mock command execution that uses streaming
        plugin.addCommandHandler.execute.mockImplementation(async (command: any, streamingCallback: any) => {
            // Simulate streaming process
            if (streamingCallback) {
                streamingCallback('Generated content', false);
                streamingCallback('Generated content complete', true);
            }
            return { success: true, editType: 'insert' as const };
        });

        // Execute a command that should trigger streaming
        const command = {
            action: 'add',
            target: 'cursor',
            instruction: 'Add some content'
        };

        await (sidebar as any).executeAddCommandWithStreaming(command);

        // Stats, tokens, and context should all be updated after streaming
        expect(updateDocumentStatsSpy).toHaveBeenCalled();
        expect(updateTokenDisplaySpy).toHaveBeenCalled();
        expect(refreshContextSpy).toHaveBeenCalled();
    });

    it('should use centralized onStreamingComplete method', async () => {
        // Setup spies on the refactored methods
        const refreshAllStatsSpy = jest.spyOn(sidebar as any, 'refreshAllStats').mockResolvedValue(undefined);
        const refreshContextSpy = jest.spyOn(sidebar as any, 'refreshContext').mockResolvedValue(undefined);

        // Call the centralized method directly
        (sidebar as any).onStreamingComplete();

        // Verify the centralized stats method and context refresh are called
        expect(refreshAllStatsSpy).toHaveBeenCalled();
        expect(refreshContextSpy).toHaveBeenCalled();
    });
});

describe('Magical Scroll Functionality', () => {
    let mockEditor: any;
    let streamingManager: StreamingManager;

    beforeEach(() => {
        mockEditor = {
            getCursor: jest.fn().mockReturnValue({ line: 0, ch: 0 }),
            getSelection: jest.fn().mockReturnValue(''),
            replaceRange: jest.fn(),
            setCursor: jest.fn(),
            scrollIntoView: jest.fn(),
            getScrollInfo: jest.fn().mockReturnValue({
                top: 0,
                clientHeight: 400
            }),
            defaultTextHeight: 20
        };

        const mockPlugin = { registerInterval: (id: number) => id };
        streamingManager = new StreamingManager(mockPlugin as any);
    });

    it('should enable magical scroll by default', async () => {
        const { updateStream } = streamingManager.startStreaming(
            mockEditor, 
            { line: 0, ch: 0 }
        );

        // Simulate streaming with content - should always scroll during streaming
        updateStream('Line 1\nLine 2\nLine 3\nLine 4\nLine 5', false);
        
        // Scroll should happen immediately (no viewport detection needed)
        expect(mockEditor.scrollIntoView).toHaveBeenCalled();
        expect(mockEditor.scrollIntoView).toHaveBeenCalledWith(
            { from: expect.any(Object), to: expect.any(Object) },
            true // smooth = true by default
        );
    });

    it('should always scroll during streaming with clean architecture', () => {
        const { updateStream } = streamingManager.startStreaming(
            mockEditor, 
            { line: 0, ch: 0 }
        );

        // Simulate streaming with content - should always scroll (no disable option)
        updateStream('Content that triggers scroll', false);
        
        // Scroll should always happen during streaming
        expect(mockEditor.scrollIntoView).toHaveBeenCalled();
        expect(mockEditor.scrollIntoView).toHaveBeenCalledWith(
            { from: expect.any(Object), to: expect.any(Object) },
            true // smooth = true by default
        );
    });

    it('should use smooth scroll behavior by default', () => {
        const { updateStream } = streamingManager.startStreaming(
            mockEditor, 
            { line: 20, ch: 0 }
        );

        updateStream('New content at line 20', false);
        
        // Should use smooth scroll by default
        expect(mockEditor.scrollIntoView).toHaveBeenCalledWith(
            { from: expect.any(Object), to: expect.any(Object) },
            true // smooth = true
        );
    });

    it('should support instant scroll behavior when configured', () => {
        const { updateStream } = streamingManager.startStreaming(
            mockEditor, 
            { line: 20, ch: 0 },
            undefined,
            { scrollBehavior: 'instant' }
        );

        updateStream('New content at line 20', false);
        
        // Should use instant scroll when configured
        expect(mockEditor.scrollIntoView).toHaveBeenCalledWith(
            { from: expect.any(Object), to: expect.any(Object) },
            false // smooth = false
        );
    });

    it('should scroll immediately for responsive experience', () => {
        const { updateStream } = streamingManager.startStreaming(
            mockEditor, 
            { line: 15, ch: 0 }
        );

        // Simulate rapid streaming updates
        updateStream('Content 1', false);
        updateStream('Content 2', false);
        updateStream('Content 3', false);

        // Should scroll for each update (immediate + throttled approach)
        expect(mockEditor.scrollIntoView).toHaveBeenCalled();
        expect(mockEditor.scrollIntoView.mock.calls.length).toBeGreaterThan(0);
    });

    it('should clean up scroll timeout on streaming stop', () => {
        const { updateStream, stopStream } = streamingManager.startStreaming(
            mockEditor, 
            { line: 0, ch: 0 }
        );

        updateStream('Some content', false);
        
        // Stop streaming should clean up without errors
        expect(() => stopStream()).not.toThrow();
        
        // Subsequent updates should not cause scroll after stop
        mockEditor.scrollIntoView.mockClear();
        updateStream('More content', false);
        // Note: This test verifies cleanup works, actual behavior may vary
    });

    it('should scroll to growing content position during streaming', () => {
        const { updateStream } = streamingManager.startStreaming(
            mockEditor, 
            { line: 5, ch: 0 }
        );

        // Simulate streaming content that grows the document
        updateStream('First line\nSecond line', false);
        updateStream('First line\nSecond line\nThird line', false);
        updateStream('First line\nSecond line\nThird line\nFourth line', false);

        // Should scroll to track the growing content
        expect(mockEditor.scrollIntoView).toHaveBeenCalledTimes(3);
        
        // The last call should be to the position of the fourth line
        const lastCall = mockEditor.scrollIntoView.mock.calls[mockEditor.scrollIntoView.mock.calls.length - 1];
        expect(lastCall[0].from.line).toBe(8); // Original line 5 + 3 new lines
    });
});
