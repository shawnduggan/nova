/**
 * Test suite for editing mode handler integration
 */

import { NovaSidebarView } from '../../src/ui/sidebar-view';

// Mock dependencies
jest.mock('obsidian');

describe('Editing Handler Integration', () => {
    let sidebarView: NovaSidebarView;
    let mockPlugin: any;
    let mockApp: any;

    beforeEach(() => {
        mockApp = {
            vault: {
                modify: jest.fn()
            },
            workspace: {
                getActiveViewOfType: jest.fn()
            }
        };

        mockPlugin = {
            commandParser: {
                parseCommand: jest.fn().mockReturnValue({
                    action: 'edit',
                    target: 'selection',
                    instruction: 'test instruction'
                })
            },
            documentEngine: {
                getActiveFile: jest.fn().mockReturnValue({ path: 'test.md' })
            },
            aiProviderManager: {
                complete: jest.fn().mockResolvedValue('Test edit response')
            }
        };

        // Create actual instance for testing
        sidebarView = new NovaSidebarView({} as any, mockPlugin);
        sidebarView.app = mockApp;
    });

    describe('handleEditingRequest', () => {
        it('should exist as a method', () => {
            expect(typeof sidebarView.handleEditingRequest).toBe('function');
        });

        it('should preserve existing editing behavior', async () => {
            // Mock the private executeCommand method via prototype
            const executeCommandSpy = jest.spyOn(sidebarView as any, 'executeCommand').mockResolvedValue('Edit completed');

            await sidebarView.handleEditingRequest('Make this clearer');
            
            // Verify command parsing
            expect(mockPlugin.commandParser.parseCommand).toHaveBeenCalledWith('Make this clearer');
            
            // Verify command execution
            expect(executeCommandSpy).toHaveBeenCalledWith({
                action: 'edit',
                target: 'selection',
                instruction: 'test instruction'
            });
        });

        it('should record intent for state management', async () => {
            const executeCommandSpy = jest.spyOn(sidebarView as any, 'executeCommand').mockResolvedValue('Edit completed');
            const recordStateSpy = jest.spyOn(sidebarView, 'recordIntentForState');

            await sidebarView.handleEditingRequest('Fix the grammar here');
            
            // Verify intent state recording
            expect(recordStateSpy).toHaveBeenCalledWith('editing', 'Fix the grammar here');
        });

        it('should handle editing patterns correctly', async () => {
            const executeCommandSpy = jest.spyOn(sidebarView as any, 'executeCommand').mockResolvedValue('Edit completed');

            const editingInputs = [
                'Make this paragraph clearer',
                'Fix the grammar here', 
                'This section needs improvement',
                'Add more detail at the end'
            ];

            for (const input of editingInputs) {
                await sidebarView.handleEditingRequest(input);
            }
            
            // Should execute command for each editing input
            expect(executeCommandSpy).toHaveBeenCalledTimes(editingInputs.length);
        });
    });
});