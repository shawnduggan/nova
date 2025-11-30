/**
 * Delete command implementation for Nova
 * Handles removing content at cursor position
 */

import { App } from 'obsidian';
import { DocumentEngine } from '../document-engine';
import { EditCommand as EditCommandType, EditResult, DocumentContext } from '../types';

export class DeleteCommand {
    constructor(
        private app: App,
        private documentEngine: DocumentEngine
    ) {}

    /**
     * Execute delete command
     */
    execute(command: EditCommandType): EditResult {
        try {
            // Get document context
            const documentContext = this.documentEngine.getDocumentContext();
            if (!documentContext) {
                return {
                    success: false,
                    error: 'No active document found',
                    editType: 'delete'
                };
            }

            // Validate command requirements
            const validation = this.validateCommand(command, !!documentContext.selectedText);
            if (!validation.valid) {
                return {
                    success: false,
                    error: validation.error,
                    editType: 'delete'
                };
            }

            // Apply the deletion based on target
            const result = this.applyDeletion(command, documentContext);
            
            // Log only failures as assistant messages
            // Success will be handled by sidebar's success indicator
            // Failure will also be handled by sidebar's error indicator
            
            return result;

        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                editType: 'delete'
            };
        }
    }

    /**
     * Apply deletion based on command target
     */
    private applyDeletion(
        command: EditCommandType,
        documentContext: DocumentContext
    ): EditResult {
        switch (command.target) {
            case 'selection':
                if (documentContext.selectedText) {
                    return this.documentEngine.applyEdit(
                        '',
                        'selection',
                        {
                            scrollToEdit: true,
                            selectNewText: false
                        }
                    );
                } else {
                    return {
                        success: false,
                        error: 'No text selected for deletion',
                        editType: 'delete'
                    };
                }

            case 'cursor':
                // Delete current line at cursor
                return this.documentEngine.deleteContent('line');

            case 'document':
                // Clear entire document
                return this.documentEngine.setDocumentContent('');

            case 'end':
                // Remove trailing content (not typically used for delete)
                return {
                    success: false,
                    error: 'Cannot delete from end - use cursor or selection instead',
                    editType: 'delete'
                };

            default:
                return {
                    success: false,
                    error: `Invalid delete target: ${String(command.target)}`,
                    editType: 'delete'
                };
        }
    }

    /**
     * Validate delete command
     */
    private validateCommand(
        command: EditCommandType, 
        hasSelection: boolean
    ): { valid: boolean; error?: string } {
        // Check if selection is required but not available
        if (command.target === 'selection' && !hasSelection) {
            return {
                valid: false,
                error: 'Please select text to delete'
            };
        }

        // Validate action is delete
        if (command.action !== 'delete') {
            return {
                valid: false,
                error: 'Command action must be delete'
            };
        }

        return { valid: true };
    }
}