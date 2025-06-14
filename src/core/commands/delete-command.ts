/**
 * Delete command implementation for Nova
 * Handles removing content at cursor position
 */

import { App } from 'obsidian';
import { DocumentEngine } from '../document-engine';
import { ContextBuilder } from '../context-builder';
import { AIProviderManager } from '../../ai/provider-manager';
import { EditCommand as EditCommandType, EditResult, DocumentContext } from '../types';

export class DeleteCommand {
    constructor(
        private app: App,
        private documentEngine: DocumentEngine,
        private contextBuilder: ContextBuilder,
        private providerManager: AIProviderManager
    ) {}

    /**
     * Execute delete command
     */
    async execute(command: EditCommandType): Promise<EditResult> {
        try {
            // Get document context
            const documentContext = await this.documentEngine.getDocumentContext();
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
            const result = await this.applyDeletion(command, documentContext);
            
            // Log deletion result for conversation context
            if (command.instruction && command.instruction.trim().length > 0) {
                await this.documentEngine.addUserMessage(command.instruction, command);
                
                if (result.success) {
                    await this.documentEngine.addAssistantMessage('Content deleted successfully', result);
                } else {
                    await this.documentEngine.addAssistantMessage('Failed to delete content', result);
                }
            }
            
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
    private async applyDeletion(
        command: EditCommandType,
        documentContext: DocumentContext
    ): Promise<EditResult> {
        switch (command.target) {
            case 'selection':
                if (documentContext.selectedText) {
                    return await this.documentEngine.applyEdit(
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
                return await this.documentEngine.deleteContent('line');

            case 'document':
                // Clear entire document
                return await this.documentEngine.setDocumentContent('');

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
                    error: `Invalid delete target: ${command.target}`,
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