/**
 * Selection-based context menu for Nova
 * Adds Nova submenu to Obsidian's right-click context menu when text is selected
 */

import { App, Editor, Menu, MenuItem, Notice } from 'obsidian';
import NovaPlugin from '../../main';
import { SelectionEditCommand } from '../core/commands/selection-edit-command';
import { ToneSelectionModal } from './tone-selection-modal';
import { CustomInstructionModal } from './custom-instruction-modal';
import { NovaSidebarView } from './sidebar-view';
import { StreamingManager, ActionType } from './streaming-manager';
import { Logger } from '../utils/logger';

export interface SelectionAction {
    id: string;
    label: string;
    icon?: string;
    description?: string;
}

export const SELECTION_ACTIONS: SelectionAction[] = [
    {
        id: 'improve',
        label: 'Improve Writing',
        icon: 'sparkles',
        description: 'Make text clearer, more concise, better flow'
    },
    {
        id: 'longer',
        label: 'Make Longer',
        icon: 'plus-circle',
        description: 'Expand ideas with more detail and examples'
    },
    {
        id: 'shorter',
        label: 'Make Shorter',
        icon: 'minus-circle',
        description: 'Condense to essential points'
    },
    {
        id: 'tone',
        label: 'Change Tone',
        icon: 'palette',
        description: 'Adjust writing style and tone'
    },
    {
        id: 'custom',
        label: 'Tell Nova...',
        icon: 'message-circle',
        description: 'Custom instruction for transformation'
    }
];

export class SelectionContextMenu {
    private selectionEditCommand: SelectionEditCommand;
    private completionCallback?: () => void;
    private streamingManager: StreamingManager;

    constructor(
        private app: App,
        private plugin: NovaPlugin
    ) {
        this.selectionEditCommand = new SelectionEditCommand(plugin);
        this.streamingManager = new StreamingManager();
    }

    /**
     * Set callback to be called when streaming completes
     */
    setCompletionCallback(callback: () => void): void {
        this.completionCallback = callback;
    }

    /**
     * Called when streaming completes
     */
    private onStreamingComplete(): void {
        if (this.completionCallback) {
            this.completionCallback();
        }
    }

    /**
     * Register the context menu with Obsidian's editor
     */
    register(): void {
        this.plugin.registerEvent(
            this.app.workspace.on('editor-menu', (menu: Menu, editor: Editor) => {
                this.addNovaSubmenu(menu, editor);
            })
        );
    }

    /**
     * Add Nova submenu to the context menu if text is selected
     */
    private addNovaSubmenu(menu: Menu, editor: Editor): void {
        const selectedText = editor.getSelection();
        
        // Only show Nova submenu when text is selected
        if (!selectedText || selectedText.trim().length === 0) {
            return;
        }

        // Add separator before Nova submenu for visual clarity
        menu.addSeparator();

        // Create Nova action items directly (no standalone Nova item)
        SELECTION_ACTIONS.forEach(action => {
            menu.addItem((item: MenuItem) => {
                item
                    .setTitle('Nova: ' + action.label)
                    .setIcon(action.icon || 'edit')
                    .onClick(() => {
                        this.handleSelectionAction(action.id, editor, selectedText);
                    });
            });
        });
        
        // Add separator after Nova items for visual clarity
        menu.addSeparator();
    }


    /**
     * Handle selection action when menu item is clicked
     */
    public async handleSelectionAction(actionId: string, editor: Editor, selectedText: string, customInstruction?: string): Promise<void> {
        try {
            // Handle tone selection with modal (when no specific tone provided)
            if (actionId === 'tone' && !customInstruction) {
                this.showToneSelectionModal(editor, selectedText);
                return;
            }
            
            if (actionId === 'custom' && !customInstruction) {
                this.showCustomInstructionModal(editor, selectedText);
                return;
            }

            // Execute the selection edit command for other actions or direct tone/custom calls
            await this.executeSelectionEdit(actionId, editor, selectedText, customInstruction);
        } catch (error) {
            Logger.error('Error executing Nova selection action:', error);
            new Notice('Failed to execute Nova action. Please try again.', 3000);
        }
    }

    /**
     * Show tone selection modal
     */
    private showToneSelectionModal(editor: Editor, selectedText: string): void {
        const modal = new ToneSelectionModal(
            this.app,
            async (selectedTone: string) => {
                // Execute tone change with the selected tone
                await this.executeSelectionEdit('tone', editor, selectedText, selectedTone);
            },
            () => {
                // User cancelled, do nothing
            }
        );
        modal.open();
    }

    /**
     * Show custom instruction modal
     */
    private showCustomInstructionModal(editor: Editor, selectedText: string): void {
        const modal = new CustomInstructionModal(
            this.app,
            async (instruction: string) => {
                // Execute custom transformation with the instruction
                await this.executeSelectionEdit('custom', editor, selectedText, instruction);
            },
            () => {
                // User cancelled, do nothing
            }
        );
        modal.open();
    }

    /**
     * Execute the selection edit command with streaming
     */
    private async executeSelectionEdit(
        actionId: string, 
        editor: Editor, 
        selectedText: string, 
        customInstruction?: string
    ): Promise<void> {
        // Start selection animation
        this.startSelectionAnimation(editor);
        
        // Store original selection range
        const originalRange = {
            from: editor.getCursor('from'),
            to: editor.getCursor('to')
        };
        
        try {
            // Start the unified streaming system with notice animations
            const { updateStream, stopStream } = this.streamingManager.startStreaming(
                editor,
                originalRange.from,
                originalRange.to,
                {
                    animationMode: 'notice',
                    onComplete: () => this.onStreamingComplete()
                }
            );

            // Show notice thinking animation
            this.streamingManager.showThinkingNotice(actionId as ActionType, 'notice');
            
            // Use streaming to progressively replace text
            const result = await this.selectionEditCommand.executeStreaming(
                actionId, 
                editor, 
                selectedText,
                (chunk: string, isComplete: boolean) => {
                    // Use unified streaming system
                    updateStream(chunk, isComplete);
                },
                customInstruction
            );

            // Stop streaming when done
            stopStream();
            
            if (result.success) {
                const actionName = this.getActionDisplayName(actionId);
                new Notice(`Text ${actionName} successfully`, 2000);
                
                // Add success message to chat
                this.addSuccessChatMessage(actionId, selectedText, customInstruction);
            } else {
                new Notice(`${result.error || 'Failed to process text'}`, 3000);
                // Add failure message to chat
                this.addFailureChatMessage(actionId, result.error || 'Failed to process text');
                
                // Restore original text when streaming fails
                this.restoreOriginalText(editor);
            }
        } catch (error) {
            Logger.error('Error in streaming selection edit:', error);
            new Notice('Failed to execute Nova action. Please try again.', 3000);
            
            // Restore original text on complete failure
            this.restoreOriginalText(editor);
        } finally {
            // Always stop animations and clean up
            this.stopSelectionAnimation();
            this.streamingManager.stopAnimation();
        }
    }

    /**
     * Restore original text if streaming fails completely
     */
    private restoreOriginalText(_editor: Editor): void {
        // The StreamingManager now handles text restoration
        // This is kept for compatibility but most restoration is handled by the unified system
    }

    /**
     * Start pulsing animation on selected text
     */
    private startSelectionAnimation(editor: Editor): void {
        try {
            // Find the editor container in the DOM
            const editorWithCM = editor as Editor & { cm?: { dom: Element } };
            const editorContainer = editorWithCM.cm?.dom || document.querySelector('.cm-editor');
            if (editorContainer) {
                editorContainer.classList.add('nova-selection-processing');
            }

            // Store the original selection for later cleanup
            const selection = editor.getSelection();
            if (selection) {
                this.animatedSelection = {
                    from: editor.getCursor('from'),
                    to: editor.getCursor('to')
                };
            }
        } catch (error) {
            Logger.warn('Failed to start selection animation:', error);
        }
    }

    /**
     * Stop pulsing animation
     */
    private stopSelectionAnimation(): void {
        try {
            // Remove animation class from all possible editor elements
            const editorElements = document.querySelectorAll('.CodeMirror, .cm-editor');
            editorElements.forEach(el => {
                el.classList.remove('nova-selection-processing');
            });


            this.animatedSelection = null;
        } catch (error) {
            Logger.warn('Failed to stop selection animation:', error);
        }
    }

    private animatedSelection: { from: any; to: any } | null = null;





    /**
     * Get display name for action
     */
    private getActionDisplayName(actionId: string): string {
        switch (actionId) {
            case 'improve': return 'improved';
            case 'longer': return 'expanded';
            case 'shorter': return 'condensed';
            case 'tone': return 'tone adjusted';
            case 'custom': return 'transformed';
            default: return 'processed';
        }
    }

    /**
     * Add success message to chat using unified system
     */
    private addSuccessChatMessage(actionId: string, originalText: string, customInstruction?: string): void {
        try {
            // Find the active Nova sidebar view and add message to chat
            const leaves = this.app.workspace.getLeavesOfType('nova-sidebar');
            if (leaves.length > 0) {
                const sidebarView = leaves[0].view as NovaSidebarView;
                if (sidebarView?.chatRenderer) {
                    const actionDescription = this.getActionDescription(actionId, customInstruction);
                    const truncatedText = originalText.length > 50 
                        ? originalText.substring(0, 50) + '...' 
                        : originalText;
                    
                    const message = `✓ ${actionDescription} text: "${truncatedText}"`;
                    
                    // Use unified system with persistence
                    sidebarView.chatRenderer.addSuccessMessage(message, true);
                }
            }
        } catch (error) {
            Logger.warn('Failed to add success chat message:', error);
        }
    }

    /**
     * Add failure message to chat using unified system
     */
    private addFailureChatMessage(actionId: string, errorMessage: string): void {
        try {
            // Find the active Nova sidebar view and add message to chat
            const leaves = this.app.workspace.getLeavesOfType('nova-sidebar');
            if (leaves.length > 0) {
                const sidebarView = leaves[0].view as NovaSidebarView;
                if (sidebarView?.chatRenderer) {
                    const actionName = this.getActionDisplayName(actionId);
                    // Convert past tense to infinitive form properly
                    let verbForm = actionName;
                    if (actionName === 'condensed') verbForm = 'condense';
                    else if (actionName === 'improved') verbForm = 'improve';
                    else if (actionName === 'expanded') verbForm = 'expand';
                    else if (actionName === 'transformed') verbForm = 'transform';
                    else if (actionName.endsWith('ed')) verbForm = actionName.slice(0, -2);
                    
                    const message = `✗ Failed to ${verbForm} text: ${errorMessage}`;
                    
                    // Use unified system with persistence
                    sidebarView.chatRenderer.addErrorMessage(message, true);
                }
            }
        } catch (error) {
            Logger.warn('Failed to add error chat message:', error);
        }
    }

    /**
     * Get detailed action description for chat
     */
    private getActionDescription(actionId: string, customInstruction?: string): string {
        switch (actionId) {
            case 'improve': return 'Improved';
            case 'longer': return 'Expanded';
            case 'shorter': return 'Condensed';
            case 'tone': return `Changed tone to ${customInstruction || 'formal'}`;
            case 'custom': return `Applied "${customInstruction}"`;
            default: return 'Processed';
        }
    }
}