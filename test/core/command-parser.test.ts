/**
 * Tests for CommandParser
 */

import { CommandParser } from '../../src/core/command-parser';
import { EditCommand, EditAction } from '../../src/core/types';

describe('CommandParser', () => {
    let parser: CommandParser;

    beforeEach(() => {
        parser = new CommandParser();
    });

    describe('parseCommand', () => {
        describe('action detection', () => {
            it('should detect add actions', () => {
                const testCases = [
                    'Add a new section about methodology',
                    'Create a conclusion paragraph',
                    'Write an introduction',
                    'Insert a summary at the end',
                    'Include some examples',
                    'Generate a new section'
                ];

                testCases.forEach(input => {
                    const command = parser.parseCommand(input);
                    expect(command.action).toBe('add');
                    expect(command.instruction).toBe(input);
                });
            });

            it('should detect edit actions', () => {
                const testCases = [
                    'Edit this paragraph to make it clearer',
                    'Modify the introduction',
                    'Change this to be more formal',
                    'Update the methodology section',
                    'Improve this text',
                    'Make this better',
                    'Fix this paragraph'
                ];

                testCases.forEach(input => {
                    const command = parser.parseCommand(input);
                    expect(command.action).toBe('edit');
                });
            });

            it('should detect delete actions', () => {
                const testCases = [
                    'Delete this section',
                    'Remove the redundant paragraph',
                    'Eliminate unnecessary content',
                    'Get rid of this part',
                    'Take out the example',
                    'Drop this section'
                ];

                testCases.forEach(input => {
                    const command = parser.parseCommand(input);
                    expect(command.action).toBe('delete');
                });
            });

            it('should detect grammar actions', () => {
                const testCases = [
                    'Fix grammar in this document',
                    'Check spelling and grammar',
                    'Correct grammatical errors',
                    'Proofread this text',
                    'Polish the writing',
                    'Fix spelling mistakes'
                ];

                testCases.forEach(input => {
                    const command = parser.parseCommand(input);
                    expect(command.action).toBe('grammar');
                });
            });

            it('should detect rewrite actions', () => {
                const testCases = [
                    'Rewrite this document',
                    'Rephrase this section',
                    'Restructure the content',
                    'Generate new sections',
                    'Write a different version'
                ];

                testCases.forEach(input => {
                    const command = parser.parseCommand(input);
                    expect(command.action).toBe('rewrite');
                });
            });
        });

        describe('target detection', () => {
            it('should detect selection target when text is selected', () => {
                const command = parser.parseCommand('Make this more concise', true);
                expect(command.target).toBe('selection');
            });

            it('should detect appropriate targets for section-like commands', () => {
                // Edit commands default to cursor for existing content
                expect(parser.parseCommand('Edit the methodology section').target).toBe('cursor');
                expect(parser.parseCommand('Update this section').target).toBe('cursor');
                
                // Add commands default to end for new content
                expect(parser.parseCommand('Add content to the introduction heading').target).toBe('end');
            });

            it('should detect document target', () => {
                const testCases = [
                    'Fix grammar in the entire document',
                    'Proofread the whole file',
                    'Check the full document'
                ];

                testCases.forEach(input => {
                    const command = parser.parseCommand(input);
                    expect(command.target).toBe('document');
                });
            });

            it('should detect end target', () => {
                const testCases = [
                    'Add a conclusion at the end',
                    'Insert content at the bottom',
                    'Create a summary at the end'
                ];

                testCases.forEach(input => {
                    const command = parser.parseCommand(input);
                    expect(command.target).toBe('end');
                });
            });

            it('should use action-specific defaults', () => {
                expect(parser.parseCommand('Add some content').target).toBe('end');
                expect(parser.parseCommand('Fix grammar').target).toBe('document');
                expect(parser.parseCommand('Rewrite this').target).toBe('end');
            });
        });


        describe('context extraction', () => {
            it('should extract style indicators', () => {
                const testCases = [
                    { input: 'Make this more formal and professional', expected: 'formal, professional' },
                    { input: 'Write in a casual, friendly tone', expected: 'casual, friendly' },
                    { input: 'Create technical documentation', expected: 'technical' }
                ];

                testCases.forEach(({ input, expected }) => {
                    const command = parser.parseCommand(input);
                    expect(command.context).toContain(`Style: ${expected}`);
                });
            });

            it('should extract length indicators', () => {
                const briefCommand = parser.parseCommand('Write a brief summary');
                expect(briefCommand.context).toContain('Keep it brief');

                const detailedCommand = parser.parseCommand('Create a detailed analysis');
                expect(detailedCommand.context).toContain('Provide detailed content');
            });

            it('should extract format requirements', () => {
                const listCommand = parser.parseCommand('Create a bullet point list');
                expect(listCommand.context).toContain('Use bullet points or lists');

                const exampleCommand = parser.parseCommand('Include some examples');
                expect(exampleCommand.context).toContain('Include examples');

                const numberedCommand = parser.parseCommand('Make a numbered list');
                expect(numberedCommand.context).toContain('Use numbered lists');
            });
        });
    });

    describe('validateCommand', () => {
        it('should validate commands requiring selection', () => {
            const command: EditCommand = {
                action: 'edit',
                target: 'selection',
                instruction: 'Edit selected text'
            };

            const validResult = parser.validateCommand(command, true);
            expect(validResult.valid).toBe(true);

            const invalidResult = parser.validateCommand(command, false);
            expect(invalidResult.valid).toBe(false);
            expect(invalidResult.error).toContain('requires text to be selected');
        });

        it('should validate cursor deletion commands', () => {
            const commandWithContext: EditCommand = {
                action: 'delete',
                target: 'cursor',
                instruction: 'Delete the introduction section'
            };

            const commandWithoutContext: EditCommand = {
                action: 'delete',
                target: 'cursor',
                instruction: 'Delete section'
            };

            expect(parser.validateCommand(commandWithContext, false).valid).toBe(true);
            expect(parser.validateCommand(commandWithoutContext, false).valid).toBe(true);
        });

        it('should prevent adding content to selection', () => {
            const command: EditCommand = {
                action: 'add',
                target: 'selection',
                instruction: 'Add to selection'
            };

            const result = parser.validateCommand(command, true);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('Cannot add content to a selection');
        });
    });

    describe('getSuggestions', () => {
        it('should provide selection-based suggestions when text is selected', () => {
            const suggestions = parser.getSuggestions(true);
            
            expect(suggestions).toContain('Make this more concise');
            expect(suggestions).toContain('Fix grammar in this text');
            expect(suggestions).toContain('Make this more professional');
            expect(suggestions).toContain('Expand on this point');
        });

        it('should provide document-based suggestions when no selection', () => {
            const suggestions = parser.getSuggestions(false);
            
            expect(suggestions).toContain('Add conclusion at end');
            expect(suggestions).toContain('Fix grammar in this document');
            expect(suggestions).toContain('Add content at cursor');
            expect(suggestions).toContain('Create a summary');
        });

        it('should provide cursor-based suggestions', () => {
            const suggestions = parser.getSuggestions(false);
            
            expect(suggestions).toContain('Add content at cursor');
            expect(suggestions).toContain('Fix grammar in this document');
        });
    });

    describe('parseMultipleCommands', () => {
        it('should parse single command', () => {
            const commands = parser.parseMultipleCommands('Add a conclusion');
            expect(commands).toHaveLength(1);
            expect(commands[0].action).toBe('add');
        });

        it('should parse multiple commands', () => {
            const input = 'Add a conclusion then fix grammar and also create a summary';
            const commands = parser.parseMultipleCommands(input);
            
            expect(commands).toHaveLength(3);
            expect(commands[0].instruction).toContain('conclusion');
            expect(commands[1].instruction).toContain('grammar');
            expect(commands[2].instruction).toContain('summary');
        });

        it('should handle various separators', () => {
            const testCases = [
                'Add content then edit it',
                'Create section and then proofread',
                'Write introduction after that add conclusion',
                'Fix grammar next create summary',
                'Edit this additionally make it formal'
            ];

            testCases.forEach(input => {
                const commands = parser.parseMultipleCommands(input);
                expect(commands.length).toBeGreaterThan(1);
            });
        });
    });

    describe('getCommandDescription', () => {
        it('should describe add commands', () => {
            const command: EditCommand = {
                action: 'add',
                target: 'end',
                instruction: 'Add conclusion'
            };

            const description = parser.getCommandDescription(command);
            expect(description).toBe('Add new content at end of document');
        });

        it('should describe commands with cursor target', () => {
            const command: EditCommand = {
                action: 'edit',
                target: 'cursor',
                instruction: 'Edit introduction'
            };

            const description = parser.getCommandDescription(command);
            expect(description).toBe('Edit existing content at cursor position');
        });

        it('should describe selection commands', () => {
            const command: EditCommand = {
                action: 'grammar',
                target: 'selection',
                instruction: 'Fix grammar'
            };

            const description = parser.getCommandDescription(command);
            expect(description).toBe('Fix grammar and spelling in selected text');
        });

        it('should describe all action types', () => {
            const actions: EditAction[] = ['add', 'edit', 'delete', 'grammar', 'rewrite'];
            
            actions.forEach(action => {
                const command: EditCommand = {
                    action,
                    target: 'document',
                    instruction: `Test ${action}`
                };
                
                const description = parser.getCommandDescription(command);
                expect(description).toBeTruthy();
                if (action === 'grammar') {
                    expect(description).toContain('Fix grammar');
                } else if (action === 'add') {
                    expect(description).toContain('Add new');
                } else if (action === 'edit') {
                    expect(description).toContain('Edit existing');
                } else if (action === 'delete') {
                    expect(description).toContain('Remove content');
                } else if (action === 'rewrite') {
                    expect(description).toContain('Generate new');
                } else {
                    expect(description).toContain(action);
                }
            });
        });
    });

    describe('edge cases', () => {
        it('should handle empty input', () => {
            const command = parser.parseCommand('');
            expect(command.action).toBe('edit'); // default fallback
            expect(command.instruction).toBe('');
        });

        it('should handle ambiguous input', () => {
            const command = parser.parseCommand('do something');
            expect(command.action).toBe('edit'); // default fallback
            expect(command.target).toBe('cursor');
        });

        it('should handle complex natural language', () => {
            const input = 'Enhance the "methodology" section to be more detailed and comprehensive with examples';
            const command = parser.parseCommand(input);
            
            expect(command.action).toBe('edit');
            expect(command.target).toBe('cursor');
            expect(command.context).toContain('detailed');
            expect(command.context).toContain('examples');
        });

        it('should handle commands with section references', () => {
            const input = 'Add content to the "Related Work & Analysis" section';
            const command = parser.parseCommand(input);
            
            expect(command.action).toBe('add');
            expect(command.target).toBe('end');
        });
    });
});