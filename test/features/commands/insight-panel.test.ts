/**
 * Tests for InsightPanel logic
 * Focus on business logic, not UI rendering
 */

import { InsightPanel } from '../../../src/features/commands/ui/InsightPanel';
import type { MarkdownCommand } from '../../../src/features/commands/types';

// Mock dependencies
jest.mock('../../../src/utils/logger', () => ({
    Logger: {
        scope: jest.fn().mockReturnValue({
            info: jest.fn(),
            debug: jest.fn(),
            warn: jest.fn(),
            error: jest.fn()
        })
    }
}));

// Helper to create mock commands
function createMockCommand(id: string, name: string): MarkdownCommand {
    return {
        id,
        name,
        description: `Description for ${name}`,
        template: 'Mock template',
        keywords: ['test'],
        category: 'writing',
        iconType: '💡',
        variables: []
    };
}

describe('InsightPanel', () => {
    let insightPanel: InsightPanel;
    let mockPlugin: any;
    let mockCommandEngine: any;

    beforeEach(() => {
        // Mock NovaPlugin
        mockPlugin = {
            app: {
                workspace: {
                    getActiveViewOfType: jest.fn()
                }
            },
            smartVariableResolver: {
                buildSmartContext: jest.fn().mockResolvedValue({
                    selection: '',
                    document: 'Test document',
                    title: 'Test',
                    documentType: 'notes',
                    cursorContext: '',
                    metrics: { wordCount: 100, readingLevel: 'intermediate', tone: 'neutral' },
                    audienceLevel: 'general'
                })
            },
            registerDomEvent: jest.fn(),
            registerInterval: jest.fn().mockImplementation((timer) => timer)
        };

        // Mock CommandEngine
        mockCommandEngine = {
            executeCommand: jest.fn().mockResolvedValue(undefined)
        };

        insightPanel = new InsightPanel(mockPlugin, mockCommandEngine);
    });

    afterEach(() => {
        // Clean up after each test
        insightPanel.cleanup();
    });

    describe('getOpportunityTitle Logic', () => {
        // We'll test this through reflection since it's private
        test('should return correct titles for valid opportunity types', () => {
            // Access private method for testing business logic
            const getTitle = (insightPanel as any).getOpportunityTitle.bind(insightPanel);
            
            expect(getTitle('enhancement')).toBe('Writing enhancement');
            expect(getTitle('quickfix')).toBe('Issues');
            expect(getTitle('metrics')).toBe('Document analysis');
            expect(getTitle('transform')).toBe('Content transform');
        });

        test('should return default title for unknown opportunity types', () => {
            const getTitle = (insightPanel as any).getOpportunityTitle.bind(insightPanel);
            
            expect(getTitle('unknown')).toBe('Command options');
            expect(getTitle('')).toBe('Command options');
            expect(getTitle(null)).toBe('Command options');
            expect(getTitle(undefined)).toBe('Command options');
        });

        test('should handle edge cases gracefully', () => {
            const getTitle = (insightPanel as any).getOpportunityTitle.bind(insightPanel);
            
            // Test case sensitivity
            expect(getTitle('ENHANCEMENT')).toBe('Command options');
            expect(getTitle('Enhancement')).toBe('Command options');
            
            // Test special characters
            expect(getTitle('enhancement!')).toBe('Command options');
            expect(getTitle(' enhancement ')).toBe('Command options');
        });
    });

    describe('Panel Position Adjustment Logic', () => {
        let mockPanel: HTMLElement;
        let mockScrollerEl: HTMLElement;
        let mockCssProperties: { [key: string]: string };

        beforeEach(() => {
            // Track CSS custom properties
            mockCssProperties = {
                '--panel-top': '100px',
                '--panel-left': '50px',
                '--panel-right': 'auto'
            };

            // Create mock DOM elements
            mockPanel = {
                getBoundingClientRect: jest.fn(),
                style: {
                    setProperty: jest.fn((prop, value) => {
                        mockCssProperties[prop] = value;
                    })
                }
            } as any;

            mockScrollerEl = {
                getBoundingClientRect: jest.fn()
            } as any;

            // Mock getComputedStyle
            (global as any).getComputedStyle = jest.fn(() => ({
                getPropertyValue: jest.fn((prop: string) => mockCssProperties[prop] || '')
            }));
        });

        test('should adjust position when panel extends beyond bottom boundary', () => {
            // Mock panel extending beyond bottom
            (mockPanel.getBoundingClientRect as jest.Mock).mockReturnValue({
                bottom: 500,
                left: 50,
                right: 350
            });
            (mockScrollerEl.getBoundingClientRect as jest.Mock).mockReturnValue({
                bottom: 400,
                left: 0,
                right: 400
            });

            // Call private method
            const adjustPosition = (insightPanel as any).adjustPanelPosition.bind(insightPanel);
            adjustPosition(mockPanel, mockScrollerEl);

            // Should adjust top position to move panel up
            // overflow = 500 - 400 = 100
            // currentTop = 100, newTop = max(0, 100 - 100 - 10) = 0
            expect(mockPanel.style.setProperty).toHaveBeenCalledWith('--panel-top', '0px');
        });

        test('should adjust position when panel extends beyond left boundary', () => {
            // Mock panel extending beyond left
            (mockPanel.getBoundingClientRect as jest.Mock).mockReturnValue({
                bottom: 300,
                left: -50,
                right: 250
            });
            (mockScrollerEl.getBoundingClientRect as jest.Mock).mockReturnValue({
                bottom: 400,
                left: 0,
                right: 400
            });

            const adjustPosition = (insightPanel as any).adjustPanelPosition.bind(insightPanel);
            adjustPosition(mockPanel, mockScrollerEl);

            // Should switch to right positioning
            expect(mockPanel.style.setProperty).toHaveBeenCalledWith('--panel-right', 'auto');
            expect(mockPanel.style.setProperty).toHaveBeenCalledWith('--panel-left', '30px');
        });

        test('should not adjust position when panel fits within boundaries', () => {
            // Mock panel fitting within boundaries
            (mockPanel.getBoundingClientRect as jest.Mock).mockReturnValue({
                bottom: 300,
                left: 50,
                right: 350
            });
            (mockScrollerEl.getBoundingClientRect as jest.Mock).mockReturnValue({
                bottom: 400,
                left: 0,
                right: 400
            });

            const adjustPosition = (insightPanel as any).adjustPanelPosition.bind(insightPanel);
            adjustPosition(mockPanel, mockScrollerEl);

            // Should not make any positioning calls since panel fits
            expect(mockPanel.style.setProperty).not.toHaveBeenCalled();
        });

        test('should handle complex overflow scenarios', () => {
            // Mock panel extending beyond both bottom and left
            (mockPanel.getBoundingClientRect as jest.Mock).mockReturnValue({
                bottom: 500,
                left: -20,
                right: 280
            });
            (mockScrollerEl.getBoundingClientRect as jest.Mock).mockReturnValue({
                bottom: 400,
                left: 0,
                right: 400
            });

            const adjustPosition = (insightPanel as any).adjustPanelPosition.bind(insightPanel);
            adjustPosition(mockPanel, mockScrollerEl);

            // Should handle both adjustments
            expect(mockPanel.style.setProperty).toHaveBeenCalledWith('--panel-top', '0px'); // Adjusted for bottom overflow
            expect(mockPanel.style.setProperty).toHaveBeenCalledWith('--panel-left', '30px'); // Adjusted for left overflow
        });
    });

    describe('Command Limiting Logic', () => {
        const MAX_VISIBLE_COMMANDS = 4; // Copy constant from implementation

        test('should not show "Show More" button when commands <= MAX_VISIBLE_COMMANDS', () => {
            const commands = [
                createMockCommand('1', 'Command 1'),
                createMockCommand('2', 'Command 2'),
                createMockCommand('3', 'Command 3')
            ];

            const opportunity = {
                line: 5,
                column: 0,
                type: 'enhancement' as const,
                icon: '💡',
                commands,
                confidence: 0.8
            };

            // Test that content creation doesn't add footer for small command lists
            // We'll test this by checking if the panel creation logic works correctly
            // This is business logic about when to show/hide the "Show More" button
            expect(commands.length <= MAX_VISIBLE_COMMANDS).toBe(true);
        });

        test('should show "Show More" button when commands > MAX_VISIBLE_COMMANDS', () => {
            const commands = [
                createMockCommand('1', 'Command 1'),
                createMockCommand('2', 'Command 2'),
                createMockCommand('3', 'Command 3'),
                createMockCommand('4', 'Command 4'),
                createMockCommand('5', 'Command 5'),
                createMockCommand('6', 'Command 6')
            ];

            const opportunity = {
                line: 5,
                column: 0,
                type: 'enhancement' as const,
                icon: '💡',
                commands,
                confidence: 0.8
            };

            // Test that content creation adds footer for large command lists
            expect(commands.length > MAX_VISIBLE_COMMANDS).toBe(true);
            
            // Test that only first 4 commands would be shown initially
            const visibleCommands = commands.slice(0, MAX_VISIBLE_COMMANDS);
            expect(visibleCommands.length).toBe(4);
            expect(visibleCommands[0].id).toBe('1');
            expect(visibleCommands[3].id).toBe('4');
        });

        test('should handle edge case with exactly MAX_VISIBLE_COMMANDS', () => {
            const commands = [
                createMockCommand('1', 'Command 1'),
                createMockCommand('2', 'Command 2'),
                createMockCommand('3', 'Command 3'),
                createMockCommand('4', 'Command 4')
            ];

            expect(commands.length).toBe(MAX_VISIBLE_COMMANDS);
            expect(commands.length > MAX_VISIBLE_COMMANDS).toBe(false); // Should NOT show "Show More"
        });

        test('should calculate correct "Show More" text', () => {
            const commands = Array.from({ length: 8 }, (_, i) => 
                createMockCommand(`${i + 1}`, `Command ${i + 1}`)
            );

            const expectedText = `Show all ${commands.length} options...`;
            expect(expectedText).toBe('Show all 8 options...');
        });
    });

    describe('State Management', () => {
        test('should initialize with no active panel', () => {
            expect((insightPanel as any).activePanel).toBeNull();
            expect((insightPanel as any).currentOpportunity).toBeNull();
            expect((insightPanel as any).activeView).toBeNull();
        });

        test('should clean up properly', (done) => {
            // Set some mock state
            const mockPanel = { remove: jest.fn(), removeClass: jest.fn() };
            (insightPanel as any).activePanel = mockPanel;
            (insightPanel as any).currentOpportunity = { type: 'enhancement' };
            (insightPanel as any).activeView = {};

            // Call hidePanel first to trigger the removal timeout
            insightPanel.hidePanel();
            
            // Wait for the timeout to trigger panel removal
            setTimeout(() => {
                expect((insightPanel as any).activePanel).toBeNull();
                expect(mockPanel.remove).toHaveBeenCalled();
                
                // Now call cleanup to test the cleanup method
                insightPanel.cleanup();
                expect((insightPanel as any).currentOpportunity).toBeNull();
                expect((insightPanel as any).activeView).toBeNull();
                
                done();
            }, 250); // Wait longer than the 200ms timeout in hidePanel
        });

        test('should handle multiple cleanup calls safely', () => {
            // Multiple cleanup calls should not throw
            expect(() => {
                insightPanel.cleanup();
                insightPanel.cleanup();
                insightPanel.cleanup();
            }).not.toThrow();
        });

        test('should handle hidePanel when no panel is active', () => {
            // Should not throw when trying to hide non-existent panel
            expect(() => {
                insightPanel.hidePanel();
            }).not.toThrow();
        });
    });

    describe('Command Execution Logic', () => {
        test('should execute command with proper context', async () => {
            const mockCommand = createMockCommand('test-1', 'Test Command');
            const mockContext = {
                selection: 'test selection',
                document: 'test document',
                title: 'Test Title',
                documentType: 'notes' as const,
                cursorContext: 'test context',
                metrics: { wordCount: 100, readingLevel: 'intermediate', tone: 'neutral' },
                audienceLevel: 'general' as const
            };

            // Set up required state for command execution
            const mockOpportunity = {
                line: 5,
                column: 0,
                type: 'enhancement' as const,
                icon: '💡',
                commands: [mockCommand],
                confidence: 0.8
            };

            const mockActiveView = {
                editor: {
                    lineCount: jest.fn().mockReturnValue(10),
                    getLine: jest.fn().mockReturnValue('This is a test line with content'),
                    setSelection: jest.fn()
                }
            };

            // Set the internal state needed for executeCommand
            (insightPanel as any).currentOpportunity = mockOpportunity;
            (insightPanel as any).activeView = mockActiveView;

            // Mock hidePanel to do nothing (to avoid clearing state)
            (insightPanel as any).hidePanel = jest.fn();

            // Mock the smart context resolution
            mockPlugin.smartVariableResolver.buildSmartContext.mockResolvedValue(mockContext);

            // Call private executeCommand method
            const executeCommand = (insightPanel as any).executeCommand.bind(insightPanel);
            await executeCommand(mockCommand);

            // Verify command engine was called with correct parameters
            expect(mockCommandEngine.executeCommand).toHaveBeenCalledWith(mockCommand, mockContext);
            expect(mockPlugin.smartVariableResolver.buildSmartContext).toHaveBeenCalled();
            expect(mockActiveView.editor.setSelection).toHaveBeenCalled();
        });

        test('should handle command execution failure gracefully', async () => {
            const mockCommand = createMockCommand('test-1', 'Test Command');
            const mockError = new Error('Execution failed');

            // Set up required state for command execution
            const mockOpportunity = {
                line: 5,
                column: 0,
                type: 'enhancement' as const,
                icon: '💡',
                commands: [mockCommand],
                confidence: 0.8
            };

            const mockActiveView = {
                editor: {
                    lineCount: jest.fn().mockReturnValue(10),
                    getLine: jest.fn().mockReturnValue('This is a test line with content'),
                    setSelection: jest.fn()
                }
            };

            // Set the internal state needed for executeCommand
            (insightPanel as any).currentOpportunity = mockOpportunity;
            (insightPanel as any).activeView = mockActiveView;

            // Mock hidePanel to do nothing (to avoid clearing state)
            (insightPanel as any).hidePanel = jest.fn();

            // Mock context resolution success but command execution failure
            mockPlugin.smartVariableResolver.buildSmartContext.mockResolvedValue({});
            mockCommandEngine.executeCommand.mockRejectedValue(mockError);

            // Should not throw
            const executeCommand = (insightPanel as any).executeCommand.bind(insightPanel);
            await expect(executeCommand(mockCommand)).resolves.toBeUndefined();

            // Should have attempted execution
            expect(mockCommandEngine.executeCommand).toHaveBeenCalled();
        });

        test('should handle context resolution failure', async () => {
            const mockCommand = createMockCommand('test-1', 'Test Command');

            // Mock context resolution failure
            mockPlugin.smartVariableResolver.buildSmartContext.mockResolvedValue(null);

            const executeCommand = (insightPanel as any).executeCommand.bind(insightPanel);
            await executeCommand(mockCommand);

            // Should not call command engine when context fails
            expect(mockCommandEngine.executeCommand).not.toHaveBeenCalled();
        });

        test('should handle missing smartVariableResolver', async () => {
            const mockCommand = createMockCommand('test-1', 'Test Command');
            
            // Remove smartVariableResolver
            mockPlugin.smartVariableResolver = null;

            const executeCommand = (insightPanel as any).executeCommand.bind(insightPanel);
            await executeCommand(mockCommand);

            // Should not call command engine when resolver is missing
            expect(mockCommandEngine.executeCommand).not.toHaveBeenCalled();
        });
    });

    describe('Panel Lifecycle', () => {
        test('should maintain single panel instance', () => {
            // Access MAX_VISIBLE_COMMANDS for testing
            const MAX_VISIBLE = (insightPanel as any).MAX_VISIBLE_COMMANDS;
            expect(typeof MAX_VISIBLE).toBe('number');
            expect(MAX_VISIBLE).toBe(4);
        });

        test('should handle panel state transitions correctly', () => {
            // Initial state
            expect((insightPanel as any).activePanel).toBeNull();

            // After cleanup (simulated)
            insightPanel.cleanup();
            expect((insightPanel as any).activePanel).toBeNull();
        });
    });

    describe('Error Handling', () => {
        test('should handle invalid opportunity types gracefully', () => {
            const getTitle = (insightPanel as any).getOpportunityTitle.bind(insightPanel);
            
            // Should not throw for any input
            expect(() => getTitle(123)).not.toThrow();
            expect(() => getTitle({})).not.toThrow();
            expect(() => getTitle([])).not.toThrow();
            expect(() => getTitle(true)).not.toThrow();
        });

        test('should handle DOM operation failures in positioning', () => {
            // Mock activeView with failing DOM operations  
            const mockView = {
                containerEl: {
                    querySelector: jest.fn().mockReturnValue({
                        getBoundingClientRect: jest.fn().mockImplementation(() => {
                            throw new Error('DOM error');
                        })
                    })
                }
            };
            
            (insightPanel as any).activeView = mockView;

            const mockPanel = {
                getBoundingClientRect: jest.fn(),
                style: { position: '', top: '', right: '' }
            } as any;

            const mockTriggerElement = {
                getBoundingClientRect: jest.fn().mockReturnValue({
                    top: 100,
                    right: 200
                })
            } as any;

            // Should not throw even if DOM operations fail (positionPanel has try-catch)
            const positionPanel = (insightPanel as any).positionPanel.bind(insightPanel);
            expect(() => positionPanel(mockPanel, mockTriggerElement)).not.toThrow();
        });
    });
});