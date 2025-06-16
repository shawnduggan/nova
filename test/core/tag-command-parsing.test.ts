/**
 * Test suite for tag command parsing
 */

import { CommandParser } from '../../src/core/command-parser';

describe('Tag Command Parsing', () => {
    let commandParser: CommandParser;

    beforeEach(() => {
        commandParser = new CommandParser();
    });

    describe('parseCommand - tag operations', () => {
        it('should parse "Add tags: research, important" as metadata action', () => {
            const command = commandParser.parseCommand('Add tags: research, important');
            
            expect(command.action).toBe('metadata');
            expect(command.target).toBe('document');
            expect(command.instruction).toBe('Add tags: research, important');
        });

        it('should parse "Remove tags: draft" as metadata action', () => {
            const command = commandParser.parseCommand('Remove tags: draft');
            
            expect(command.action).toBe('metadata');
            expect(command.target).toBe('document');
        });

        it('should parse "Set tags: final, published" as metadata action', () => {
            const command = commandParser.parseCommand('Set tags: final, published');
            
            expect(command.action).toBe('metadata');
            expect(command.target).toBe('document');
        });

        it('should parse "clean up tags" as metadata action', () => {
            const command = commandParser.parseCommand('clean up tags');
            
            expect(command.action).toBe('metadata');
            expect(command.target).toBe('document');
        });

        it('should parse "optimize my tags" as metadata action', () => {
            const command = commandParser.parseCommand('optimize my tags');
            
            expect(command.action).toBe('metadata');
            expect(command.target).toBe('document');
        });

        it('should parse "add suggested tags" as metadata action', () => {
            const command = commandParser.parseCommand('add suggested tags');
            
            expect(command.action).toBe('metadata');
            expect(command.target).toBe('document');
        });

        it('should parse simple "add tags" as metadata action', () => {
            const command = commandParser.parseCommand('add tags');
            
            expect(command.action).toBe('metadata');
            expect(command.target).toBe('document');
        });

        it('should parse "review tags" as metadata action', () => {
            const command = commandParser.parseCommand('review tags');
            
            expect(command.action).toBe('metadata');
            expect(command.target).toBe('document');
        });

        it('should not confuse "Add content about tags" as metadata', () => {
            const command = commandParser.parseCommand('Add content about tags');
            
            expect(command.action).toBe('add');
            expect(command.target).toBe('cursor');
        });

        it('should prioritize metadata patterns over add patterns', () => {
            // Test various tag commands that contain "add"
            const tagCommands = [
                'Add tags: test',
                'add tag: example',
                'Add new tags: sample',
                'Please add tags: demo'
            ];

            tagCommands.forEach(cmd => {
                const command = commandParser.parseCommand(cmd);
                expect(command.action).toBe('metadata');
            });
        });
    });
});