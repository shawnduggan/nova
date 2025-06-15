/**
 * Unit tests for StreamingManager
 */

import { StreamingManager, ActionType } from '../../src/ui/streaming-manager';

// Mock Notice
const mockNotice = {
    hide: jest.fn(),
    noticeEl: {
        textContent: ''
    }
};

jest.mock('obsidian', () => ({
    Notice: jest.fn().mockImplementation(() => mockNotice)
}));

describe('StreamingManager', () => {
    let streamingManager: StreamingManager;
    let mockEditor: any;

    beforeEach(() => {
        streamingManager = new StreamingManager();
        mockEditor = {
            replaceRange: jest.fn(),
            setCursor: jest.fn()
        };
        jest.clearAllMocks();
    });

    afterEach(() => {
        // Clean up any running animations
        streamingManager.stopAnimation();
    });

    describe('showThinkingNotice', () => {
        test('should show notice with correct phrase for add action', () => {
            const { Notice } = require('obsidian');
            
            streamingManager.showThinkingNotice('add');
            
            expect(Notice).toHaveBeenCalledWith(
                expect.stringMatching(/^Nova: (composing|drafting|creating|generating|writing|crafting|formulating|developing|building|constructing)\.+$/),
                0
            );
        });

        test('should show notice with correct phrase for improve action', () => {
            const { Notice } = require('obsidian');
            
            streamingManager.showThinkingNotice('improve');
            
            expect(Notice).toHaveBeenCalledWith(
                expect.stringMatching(/^Nova: (refining|polishing|enhancing|crafting|perfecting|smoothing|sharpening|elevating|fine-tuning|sculpting)\.+$/),
                0
            );
        });

        test('should handle unknown action type with fallback', () => {
            const { Notice } = require('obsidian');
            
            streamingManager.showThinkingNotice('unknown' as ActionType);
            
            expect(Notice).toHaveBeenCalledWith(
                expect.stringMatching(/^Nova: (composing|drafting|creating|generating|writing|crafting|formulating|developing|building|constructing)\.+$/),
                0
            );
        });
    });

    describe('startStreaming', () => {
        test('should return stream control functions', () => {
            const startPos = { line: 0, ch: 0 };
            
            const { updateStream, stopStream } = streamingManager.startStreaming(
                mockEditor,
                startPos
            );
            
            expect(typeof updateStream).toBe('function');
            expect(typeof stopStream).toBe('function');
        });

        test('should handle cursor insertion mode', () => {
            const startPos = { line: 0, ch: 0 };
            
            const { updateStream } = streamingManager.startStreaming(
                mockEditor,
                startPos
            );
            
            // Test streaming some content
            updateStream('Hello world', false);
            
            expect(mockEditor.replaceRange).toHaveBeenCalledWith(
                'Hello world',
                startPos,
                startPos
            );
        });

        test('should handle selection replacement mode', () => {
            const startPos = { line: 0, ch: 0 };
            const endPos = { line: 0, ch: 10 };
            
            const { updateStream } = streamingManager.startStreaming(
                mockEditor,
                startPos,
                endPos
            );
            
            // Should clear selection first
            expect(mockEditor.replaceRange).toHaveBeenCalledWith('', startPos, endPos);
            
            // Test streaming some content
            updateStream('New content', false);
            
            expect(mockEditor.replaceRange).toHaveBeenCalledWith(
                'New content',
                startPos,
                startPos
            );
        });

        test('should set cursor position when streaming is complete', () => {
            const startPos = { line: 0, ch: 0 };
            
            const { updateStream } = streamingManager.startStreaming(
                mockEditor,
                startPos
            );
            
            updateStream('Hello world', true);
            
            expect(mockEditor.setCursor).toHaveBeenCalledWith({
                line: 0,
                ch: 11
            });
        });
    });

    describe('isStreaming', () => {
        test('should return false initially', () => {
            expect(streamingManager.isStreaming()).toBe(false);
        });

        test('should return true when streaming is active', () => {
            const startPos = { line: 0, ch: 0 };
            
            streamingManager.startStreaming(mockEditor, startPos);
            
            expect(streamingManager.isStreaming()).toBe(true);
        });

        test('should return false after streaming completes', () => {
            const startPos = { line: 0, ch: 0 };
            
            const { updateStream } = streamingManager.startStreaming(mockEditor, startPos);
            updateStream('Complete', true);
            
            expect(streamingManager.isStreaming()).toBe(false);
        });
    });

    describe('stopAnimation', () => {
        test('should stop dots animation and dismiss notice', () => {
            streamingManager.showThinkingNotice('add');
            streamingManager.stopAnimation();
            
            expect(mockNotice.hide).toHaveBeenCalled();
        });
    });
});