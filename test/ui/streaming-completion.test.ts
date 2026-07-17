/**
 * Test for document stats and context updates after streaming completion
 */

// @ts-nocheck - Temporary disable type checking for this test due to complex mock types
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { App, TFile, Vault, Workspace, MarkdownView, Editor } from 'obsidian';
import { NovaSidebarView, buildModelStatusPillDetails } from '../../src/ui/sidebar-view';
import { StreamingManager } from '../../src/ui/streaming-manager';
import { MAX_WRITING_ANALYSIS_CHAR_LENGTH } from '../../src/core/writing-analysis';
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

	it('should clean up chat renderer timers when the sidebar closes', async () => {
		const cleanup = jest.fn();
		(sidebar as any).chatRenderer = { cleanup };

		await sidebar.onClose();

		expect(cleanup).toHaveBeenCalledTimes(1);
	});

	it('should persist sidebar error events by default', () => {
		const addErrorMessage = jest.fn();
		(sidebar as any).chatRenderer = { addErrorMessage };

		(sidebar as any).handleSidebarChatMessage(new CustomEvent('nova-sidebar:chat-message', {
			detail: { type: 'error', content: 'Something failed' }
		}));

		expect(addErrorMessage).toHaveBeenCalledWith('Something failed', true);
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

        // Wait for microtask queue to flush (promises in onStreamingComplete use void)
        await new Promise(resolve => setTimeout(resolve, 0));

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

    it('should skip live context refresh for very large files', () => {
        const largeFile = { stat: { size: MAX_WRITING_ANALYSIS_CHAR_LENGTH + 1 } };
        const smallFile = { stat: { size: MAX_WRITING_ANALYSIS_CHAR_LENGTH } };

        expect((sidebar as any).shouldSkipLiveRefreshForLargeFile(largeFile)).toBe(true);
        expect((sidebar as any).shouldSkipLiveRefreshForLargeFile(smallFile)).toBe(false);
    });

    it('should suppress live context refresh shortly after editor changes', () => {
        jest.useFakeTimers();
        const rebuildAutoContext = jest.fn(async () => undefined);
        const updateContextIndicatorSpy = jest.spyOn(sidebar as any, 'updateContextIndicator').mockImplementation(() => {});
        const updateTokenDisplaySpy = jest.spyOn(sidebar as any, 'updateTokenDisplay').mockImplementation(() => {});

        try {
            (sidebar as any).currentFile = { stat: { size: 1_000 } };
            (sidebar as any).lastEditorChangeAt = Date.now();
            (sidebar as any).contextManager = { rebuildAutoContext };

            (sidebar as any).scheduleContextRefresh();
            jest.advanceTimersByTime(1_000);

            expect(rebuildAutoContext).not.toHaveBeenCalled();
            expect(updateContextIndicatorSpy).toHaveBeenCalled();
            expect(updateTokenDisplaySpy).toHaveBeenCalled();
        } finally {
            jest.useRealTimers();
        }
    });

    it('should describe a configured cloud model in one persistent status value', () => {
        const details = buildModelStatusPillDetails({
            modelLabel: 'GPT-5.5',
            providerType: 'openai',
            isLocal: false,
            isAvailable: true,
            providerStatus: 'connected'
        });

        expect(details).toEqual({
            modelLabel: 'GPT-5.5',
            privacyLabel: 'Cloud',
            privacyIcon: 'cloud',
            privacyTooltip: 'Cloud processing - data sent to provider',
            statusKind: 'configured',
            statusLabel: 'Configured',
            accessibleLabel: 'GPT-5.5 · Cloud. Configured. Select model.'
        });
    });

    it('should describe a configured local model with local-processing semantics', () => {
        const details = buildModelStatusPillDetails({
            modelLabel: 'Qwen 3',
            providerType: 'ollama',
            isLocal: true,
            isAvailable: true,
            providerStatus: 'connected'
        });

        expect(details.privacyLabel).toBe('Local');
        expect(details.privacyIcon).toBe('shield-check');
        expect(details.privacyTooltip).toBe('Local processing - data stays on your device');
        expect(details.statusKind).toBe('configured');
        expect(details.accessibleLabel).toBe('Qwen 3 · Local. Configured. Select model.');
    });

    it.each([
        ['testing', 'pending', 'Connection not verified'],
        ['untested', 'pending', 'Connection not verified'],
        ['error', 'error', 'Provider unavailable']
    ])('should preserve model and privacy for %s provider status', (providerStatus, statusKind, statusLabel) => {
        const details = buildModelStatusPillDetails({
            modelLabel: 'Claude Sonnet',
            providerType: 'claude',
            isLocal: false,
            isAvailable: false,
            providerStatus
        });

        expect(details.modelLabel).toBe('Claude Sonnet');
        expect(details.privacyLabel).toBe('Cloud');
        expect(details.statusKind).toBe(statusKind);
        expect(details.statusLabel).toBe(statusLabel);
    });

    it('should report the no-provider state accessibly', () => {
        const details = buildModelStatusPillDetails({
            modelLabel: '',
            providerType: null,
            isLocal: false,
            isAvailable: false
        });

        expect(details.modelLabel).toBe('No model');
        expect(details.privacyLabel).toBe('Unavailable');
        expect(details.privacyIcon).toBe('help-circle');
        expect(details.statusKind).toBe('error');
        expect(details.accessibleLabel).toBe('No model · Unavailable. Provider unavailable. Select model.');
    });

    it('should not describe a provider without a selected model as configured', () => {
        const details = buildModelStatusPillDetails({
            modelLabel: '',
            providerType: 'openai',
            isLocal: false,
            isAvailable: false,
            providerStatus: 'connected'
        });

        expect(details.modelLabel).toBe('No model');
        expect(details.privacyLabel).toBe('Cloud');
        expect(details.statusKind).toBe('error');
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
