/**
 * Integration test for cursor position preservation during file switching
 * This tests the critical functionality that Nova depends on
 */

import { NovaSidebarView } from '../../src/ui/sidebar-view';
import { DocumentEngine } from '../../src/core/document-engine';
import { EditorPosition } from 'obsidian';

// Mock the dependencies
jest.mock('../../src/core/document-engine');
jest.mock('../../src/core/conversation-manager');

describe('Cursor Position Preservation', () => {
    let sidebarView: NovaSidebarView;
    let mockPlugin: any;
    let mockWorkspaceLeaf: any;
    let mockDocumentEngine: jest.Mocked<DocumentEngine>;
    let mockWorkspace: any;
    let mockFile1: any;
    let mockFile2: any;
    let activeFileChangeHandler: () => void;
    let editorChangeHandler: (editor: any) => void;

    beforeEach(async () => {
        // Mock files
        mockFile1 = { 
            path: '/vault/file1.md', 
            basename: 'file1.md' 
        };
        mockFile2 = { 
            path: '/vault/file2.md', 
            basename: 'file2.md' 
        };

        // Mock workspace
        mockWorkspace = {
            getActiveFile: jest.fn(() => mockFile1),
            on: jest.fn((event: string, handler: any) => {
                if (event === 'active-leaf-change') {
                    activeFileChangeHandler = handler;
                } else if (event === 'editor-change') {
                    editorChangeHandler = handler;
                }
                return { off: jest.fn() };
            }),
            setActiveLeaf: jest.fn(),
            getActiveViewOfType: jest.fn(),
            getLeavesOfType: jest.fn(() => [])
        };

        // Mock document engine
        mockDocumentEngine = new DocumentEngine(null as any) as jest.Mocked<DocumentEngine>;
        mockDocumentEngine.getCursorPosition = jest.fn();
        mockDocumentEngine.setCursorPosition = jest.fn();

        // Mock plugin
        mockPlugin = {
            documentEngine: mockDocumentEngine,
            app: { workspace: mockWorkspace },
            settings: {},
            featureManager: {
                isFeatureEnabled: jest.fn(() => true)
            },
            aiProviderManager: {
                getCurrentProvider: jest.fn(() => 'claude')
            }
        };

        // Mock workspace leaf
        mockWorkspaceLeaf = {
            view: null
        };

        // Create sidebar view
        sidebarView = new NovaSidebarView(mockWorkspaceLeaf, mockPlugin);
        
        // Mock the DOM methods that onOpen needs
        (sidebarView as any).containerEl = {
            children: [null, {
                empty: jest.fn(),
                addClass: jest.fn(),
                createDiv: jest.fn().mockReturnValue({
                    style: {},
                    createDiv: jest.fn().mockReturnValue({
                        style: {},
                        createSpan: jest.fn().mockReturnValue({ style: {} }),
                        createEl: jest.fn().mockReturnValue({ style: {} })
                    }),
                    createEl: jest.fn().mockReturnValue({ style: {} })
                })
            }]
        };
        
        // Mock registerEvent method
        (sidebarView as any).registerEvent = jest.fn((event) => event);
        
        // Mock the loadConversationForActiveFile method that's called by preserveCursorAndLoadConversation
        (sidebarView as any).loadConversationForActiveFile = jest.fn();
        
        // Set initial current file
        (sidebarView as any).currentFile = mockFile1;
    });

    test('should track cursor position on editor changes', async () => {
        // Setup: mock editor with cursor position
        const mockEditor = {
            getCursor: jest.fn().mockReturnValue({ line: 5, ch: 10 })
        };
        
        // Simulate editor change event
        (sidebarView as any).trackCursorPosition(mockEditor);
        
        // Verify cursor position was tracked for current file
        expect(mockEditor.getCursor).toHaveBeenCalled();
        
        // Verify the cursor position is stored internally
        const cursorPositions = (sidebarView as any).cursorPositions;
        expect(cursorPositions.get(mockFile1.path)).toEqual({ line: 5, ch: 10 });
    });

    test('should restore cursor position when explicitly called', async () => {
        // Setup: save a cursor position for a file
        const savedPosition: EditorPosition = { line: 3, ch: 7 };
        const cursorPositions = (sidebarView as any).cursorPositions;
        cursorPositions.set(mockFile2.path, savedPosition);
        
        // Mock an active editor
        const mockEditor = {
            setCursor: jest.fn()
        };
        mockDocumentEngine.getActiveEditor.mockReturnValue(mockEditor as any);
        
        // Call restore cursor position directly
        (sidebarView as any).restoreCursorPosition(mockFile2);
        
        // Verify cursor position was restored without focus stealing
        expect(mockEditor.setCursor).toHaveBeenCalledWith(savedPosition);
        expect(mockDocumentEngine.getActiveEditor).toHaveBeenCalled();
    });

    test('should handle files without saved cursor positions', async () => {
        // Mock an active editor
        const mockEditor = {
            setCursor: jest.fn()
        };
        mockDocumentEngine.getActiveEditor.mockReturnValue(mockEditor as any);
        
        // Try to restore cursor position for a file with no saved position
        (sidebarView as any).restoreCursorPosition(mockFile2);
        
        // Verify no cursor position restoration was attempted
        expect(mockEditor.setCursor).not.toHaveBeenCalled();
    });

    test('should handle missing editor gracefully', async () => {
        // Setup: editor returns null cursor position
        const mockEditor = {
            getCursor: jest.fn().mockReturnValue(null)
        };
        
        // Trigger cursor tracking with null cursor
        (sidebarView as any).trackCursorPosition(mockEditor);
        
        // Should not crash and should not store anything
        const cursorPositions = (sidebarView as any).cursorPositions;
        expect(cursorPositions.size).toBe(0);
    });

    test('should preserve cursor positions across multiple editor changes', async () => {
        // Test multiple editor changes for different files
        const position1: EditorPosition = { line: 1, ch: 5 };
        const position2: EditorPosition = { line: 10, ch: 20 };
        
        // Mock editors for different files
        const mockEditor1 = {
            getCursor: jest.fn().mockReturnValue(position1)
        };
        const mockEditor2 = {
            getCursor: jest.fn().mockReturnValue(position2)
        };
        
        // Track cursor for file1
        mockWorkspace.getActiveFile.mockReturnValue(mockFile1);
        (sidebarView as any).trackCursorPosition(mockEditor1);
        
        // Track cursor for file2
        mockWorkspace.getActiveFile.mockReturnValue(mockFile2);
        (sidebarView as any).trackCursorPosition(mockEditor2);
        
        // Verify both positions are stored
        const cursorPositions = (sidebarView as any).cursorPositions;
        expect(cursorPositions.get(mockFile1.path)).toEqual(position1);
        expect(cursorPositions.get(mockFile2.path)).toEqual(position2);
        
        // Verify the map contains both file positions
        expect(cursorPositions.size).toBe(2);
    });
});