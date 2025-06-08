/**
 * Tests for document engine types
 */

import { EditAction, EditCommand, DocumentContext, EditResult, HeadingInfo } from '../../src/core/types';
import { TFile, Editor } from '../mocks/obsidian-mock';

describe('Document Engine Types', () => {
    describe('EditCommand', () => {
        it('should create valid add command', () => {
            const command: EditCommand = {
                action: 'add',
                target: 'end',
                instruction: 'Add a conclusion section',
                context: 'User wants to wrap up the document'
            };
            
            expect(command.action).toBe('add');
            expect(command.target).toBe('end');
            expect(command.instruction).toBeTruthy();
        });
        
        it('should create valid edit command with location', () => {
            const command: EditCommand = {
                action: 'edit',
                target: 'section',
                location: 'Introduction',
                instruction: 'Make it more concise'
            };
            
            expect(command.action).toBe('edit');
            expect(command.location).toBe('Introduction');
        });
        
        it('should support all edit actions', () => {
            const actions: EditAction[] = ['add', 'edit', 'delete', 'grammar', 'rewrite'];
            
            actions.forEach(action => {
                const command: EditCommand = {
                    action,
                    target: 'document',
                    instruction: `Test ${action} command`
                };
                
                expect(command.action).toBe(action);
            });
        });
    });
    
    describe('DocumentContext', () => {
        it('should create valid document context', () => {
            const file = new TFile('test.md');
            const context: DocumentContext = {
                file,
                filename: 'test',
                content: '# Test Document\n\nThis is content.',
                headings: [{
                    text: 'Test Document',
                    level: 1,
                    line: 0,
                    position: { start: 0, end: 15 }
                }],
                selectedText: 'content',
                cursorPosition: { line: 2, ch: 8 }
            };
            
            expect(context.file).toBeInstanceOf(TFile);
            expect(context.filename).toBe('test');
            expect(context.headings).toHaveLength(1);
            expect(context.selectedText).toBe('content');
        });
        
        it('should handle optional surrounding lines', () => {
            const file = new TFile('test.md');
            const context: DocumentContext = {
                file,
                filename: 'test',
                content: 'Line 1\nLine 2\nLine 3',
                headings: [],
                surroundingLines: {
                    before: ['Line 1'],
                    after: ['Line 3']
                }
            };
            
            expect(context.surroundingLines?.before).toEqual(['Line 1']);
            expect(context.surroundingLines?.after).toEqual(['Line 3']);
        });
    });
    
    describe('EditResult', () => {
        it('should create successful edit result', () => {
            const result: EditResult = {
                success: true,
                content: 'Modified content',
                editType: 'replace',
                appliedAt: { line: 5, ch: 0 }
            };
            
            expect(result.success).toBe(true);
            expect(result.content).toBe('Modified content');
            expect(result.error).toBeUndefined();
            expect(result.appliedAt?.line).toBe(5);
        });
        
        it('should create failed edit result', () => {
            const result: EditResult = {
                success: false,
                error: 'Could not find target section',
                editType: 'replace'
            };
            
            expect(result.success).toBe(false);
            expect(result.error).toBeTruthy();
            expect(result.content).toBeUndefined();
        });
        
        it('should support all edit types', () => {
            const editTypes: Array<EditResult['editType']> = ['insert', 'replace', 'append', 'delete'];
            
            editTypes.forEach(editType => {
                const result: EditResult = {
                    success: true,
                    editType
                };
                
                expect(result.editType).toBe(editType);
            });
        });
    });
    
    describe('HeadingInfo', () => {
        it('should create valid heading info', () => {
            const heading: HeadingInfo = {
                text: 'Introduction',
                level: 2,
                line: 10,
                position: { start: 150, end: 165 }
            };
            
            expect(heading.text).toBe('Introduction');
            expect(heading.level).toBe(2);
            expect(heading.level).toBeGreaterThanOrEqual(1);
            expect(heading.level).toBeLessThanOrEqual(6);
            expect(heading.position.start).toBeLessThan(heading.position.end);
        });
    });
    
    describe('Type Validation', () => {
        it('should enforce valid targets', () => {
            const validTargets = ['section', 'paragraph', 'selection', 'document', 'end'];
            const command: EditCommand = {
                action: 'add',
                target: 'section',
                instruction: 'test'
            };
            
            // TypeScript will enforce this at compile time
            expect(validTargets).toContain(command.target);
        });
        
        it('should enforce valid edit actions', () => {
            const validActions: EditAction[] = ['add', 'edit', 'delete', 'grammar', 'rewrite'];
            const command: EditCommand = {
                action: 'add',
                target: 'end',
                instruction: 'test'
            };
            
            expect(validActions).toContain(command.action);
        });
    });
});