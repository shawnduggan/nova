/**
 * Tests for read-only enforcement of context documents
 * Ensures edit commands can only modify the active conversation file
 */

import { NovaSidebarView } from '../../src/ui/sidebar-view';
import { WorkspaceLeaf, TFile } from 'obsidian';
import NovaPlugin from '../../main';

// Mock the entire Obsidian module
jest.mock('obsidian');

describe('Read-Only Context Document Enforcement', () => {
    let sidebar: NovaSidebarView;
    let mockLeaf: WorkspaceLeaf;
    let mockPlugin: NovaPlugin;
    let mockActiveFile: TFile;
    let mockContextFile: TFile;

    beforeEach(() => {
        // Mock files
        mockActiveFile = {
            basename: 'active-file.md',
            path: 'active-file.md',
            name: 'active-file.md'
        } as TFile;

        mockContextFile = {
            basename: 'context-file.md', 
            path: 'context-file.md',
            name: 'context-file.md'
        } as TFile;

        // Mock leaf
        mockLeaf = new WorkspaceLeaf();
        
        // Mock plugin with essential services
        mockPlugin = {
            settings: {
                platformSettings: {
                    desktop: { primaryProvider: 'claude' },
                    mobile: { primaryProvider: 'claude' }
                }
            },
            aiProviderManager: {
                generateText: jest.fn().mockResolvedValue('AI response'),
                getCurrentProviderName: jest.fn().mockResolvedValue('Claude'),
                complete: jest.fn().mockResolvedValue('AI response')
            },
            promptBuilder: {
                buildPromptForMessage: jest.fn().mockResolvedValue({
                    systemPrompt: 'System prompt',
                    userPrompt: 'User prompt',
                    context: 'Context',
                    config: { temperature: 0.7, maxTokens: 1000 }
                })
            },
            commandParser: {
                parseCommand: jest.fn().mockReturnValue({
                    action: 'add',
                    target: 'document',
                    instruction: 'test command'
                })
            },
            conversationManager: {
                getRecentMessages: jest.fn().mockResolvedValue([]),
                clearConversation: jest.fn().mockResolvedValue(undefined),
                addUserMessage: jest.fn().mockResolvedValue(undefined),
                addAssistantMessage: jest.fn().mockResolvedValue(undefined)
            },
            documentEngine: {
                getActiveFile: jest.fn().mockReturnValue(mockActiveFile),
                getDocumentContext: jest.fn().mockResolvedValue({
                    file: mockActiveFile,
                    filename: 'active-file.md',
                    content: 'test content',
                    headings: [],
                    selectedText: undefined,
                    cursorPosition: undefined,
                    surroundingLines: undefined
                })
            },
            addCommandHandler: {
                execute: jest.fn().mockResolvedValue({ success: true })
            },
            editCommandHandler: {
                execute: jest.fn().mockResolvedValue({ success: true })
            },
            deleteCommandHandler: {
                execute: jest.fn().mockResolvedValue({ success: true })
            },
            grammarCommandHandler: {
                execute: jest.fn().mockResolvedValue({ success: true })
            },
            rewriteCommandHandler: {
                execute: jest.fn().mockResolvedValue({ success: true })
            },
            metadataCommandHandler: {
                execute: jest.fn().mockResolvedValue({ success: true })
            },
            featureManager: {
                isFeatureEnabled: jest.fn().mockReturnValue(true)
            }
        } as any;

        sidebar = new NovaSidebarView(mockLeaf, mockPlugin);
        
        // Set the current conversation file on the sidebar
        (sidebar as any).currentFile = mockActiveFile;
    });

    // Helper function to set up file mismatch scenario
    const setupFileMismatchScenario = () => {
        const mockMarkdownView = { 
            file: mockContextFile,
            leaf: { setActiveLeaf: jest.fn() }
        };
        const mockWorkspace = {
            getLeavesOfType: jest.fn().mockReturnValue([{ view: mockMarkdownView }]),
            getLeaf: jest.fn().mockReturnValue({ openFile: jest.fn(), view: mockMarkdownView }),
            setActiveLeaf: jest.fn(),
            getActiveFile: jest.fn().mockReturnValue(mockContextFile)
        };
        (sidebar as any).app = { workspace: mockWorkspace };
    };

    describe('File Mismatch Validation', () => {
        it('should prevent editing when active file differs from conversation file - add command', async () => {
            setupFileMismatchScenario();

            const command = {
                action: 'add' as const,
                target: 'document' as const,
                instruction: 'test'
            };

            const result = await (sidebar as any).executeCommand(command);

            expect(result).toContain('Unable to set "active-file.md" as the active file');
            expect(result).toContain('Edit commands can only modify the file you\'re chatting about');
            expect(mockPlugin.addCommandHandler.execute).not.toHaveBeenCalled();
        });

        it('should prevent editing when active file differs from conversation file - edit command', async () => {
            setupFileMismatchScenario();

            const command = {
                action: 'edit' as const,
                target: 'selection' as const,
                instruction: 'test'
            };

            const result = await (sidebar as any).executeCommand(command);

            expect(result).toContain('Unable to set "active-file.md" as the active file');
            expect(result).toContain('Edit commands can only modify the file you\'re chatting about');
            expect(mockPlugin.editCommandHandler.execute).not.toHaveBeenCalled();
        });

        it('should prevent editing for all command types when file differs', async () => {
            setupFileMismatchScenario();

            const commands = ['delete', 'grammar', 'rewrite', 'metadata'] as const;
            
            for (const action of commands) {
                const command = {
                    action,
                    target: 'document' as const,
                    instruction: 'test'
                };

                const result = await (sidebar as any).executeCommand(command);

                expect(result).toContain('Unable to set "active-file.md" as the active file');
                expect(result).toContain('Edit commands can only modify the file you\'re chatting about');
            }
        });
    });

    describe('Valid File Scenarios', () => {
        it('should allow editing when active file matches conversation file', async () => {
            // Set up scenario where files match
            const mockMarkdownView = { 
                file: mockActiveFile,
                leaf: { setActiveLeaf: jest.fn() }
            };
            const mockWorkspace = {
                getLeavesOfType: jest.fn().mockReturnValue([{ view: mockMarkdownView }]),
                getLeaf: jest.fn().mockReturnValue({ openFile: jest.fn(), view: mockMarkdownView }),
                setActiveLeaf: jest.fn(),
                getActiveFile: jest.fn().mockReturnValue(mockActiveFile) // Same file
            };
            (sidebar as any).app = { workspace: mockWorkspace };

            const command = {
                action: 'add' as const,
                target: 'document' as const,
                instruction: 'test'
            };

            const result = await (sidebar as any).executeCommand(command);

            // Should succeed and call the command handler
            expect(mockPlugin.addCommandHandler.execute).toHaveBeenCalled();
        });
    });

    describe('Error Message Content', () => {
        it('should provide clear error messaging about read-only context documents', async () => {
            setupFileMismatchScenario();

            const command = {
                action: 'add' as const,
                target: 'document' as const,
                instruction: 'test'
            };

            const result = await (sidebar as any).executeCommand(command);

            // Verify the error message is informative
            expect(result).toContain('Edit commands can only modify the file you\'re chatting about');
            expect(result).toContain('to prevent accidental changes to context documents');
            expect(result).toContain('active-file.md');
        });
    });
});