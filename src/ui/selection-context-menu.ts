/**
 * Selection-based context menu for Nova
 * Adds Nova submenu to Obsidian's right-click context menu when text is selected
 */

import { App, Editor, Menu, MenuItem, Notice } from 'obsidian';
import NovaPlugin from '../../main';
import { SelectionEditCommand } from '../core/commands/selection-edit-command';
import { ToneSelectionModal } from './tone-selection-modal';
import { CustomInstructionModal } from './custom-instruction-modal';

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

    constructor(
        private app: App,
        private plugin: NovaPlugin
    ) {
        this.selectionEditCommand = new SelectionEditCommand(plugin);
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
                    .setTitle(`Nova: ${action.label}`)
                    .setIcon(action.icon || 'edit')
                    .onClick(() => {
                        this.handleSelectionAction(action.id, editor, selectedText);
                    });
            });
        });
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
            console.error('Error executing Nova selection action:', error);
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
            // Show Nova thinking animation while waiting for stream
            await this.showThinkingAnimation(editor, originalRange.from, originalRange.to, actionId);
            
            // Use streaming to progressively replace text
            const result = await this.selectionEditCommand.executeStreaming(
                actionId, 
                editor, 
                selectedText,
                (chunk: string, isComplete: boolean) => {
                    // Progressive text replacement with typewriter effect
                    this.updateStreamingText(editor, chunk, originalRange.from, isComplete);
                },
                customInstruction
            );
            
            if (result.success) {
                const actionName = this.getActionDisplayName(actionId);
                new Notice(`Nova: Text ${actionName} successfully`, 2000);
                
                // Add success message to chat
                this.addSuccessChatMessage(actionId, selectedText, customInstruction);
            } else {
                new Notice(`Nova: ${result.error || 'Failed to process text'}`, 3000);
                // Add failure message to chat
                this.addFailureChatMessage(actionId, result.error || 'Failed to process text');
                
                // Restore original text when streaming fails
                this.restoreOriginalText(editor);
            }
        } catch (error) {
            console.error('Error in streaming selection edit:', error);
            new Notice('Failed to execute Nova action. Please try again.', 3000);
            
            // Restore original text on complete failure
            this.restoreOriginalText(editor);
        } finally {
            // Always stop animations and clean up
            this.stopSelectionAnimation();
            this.stopDotsAnimation();
        }
    }

    /**
     * Update text with streaming effect
     */
    private currentStreamingEndPos: any = null;
    private streamingTextContainer: HTMLSpanElement | null = null;

    private streamingStartPos: any = null;

    private updateStreamingText(
        editor: Editor, 
        newText: string, 
        startPos: any, 
        isComplete: boolean
    ): void {
        try {
            if (this.currentStreamingEndPos) {
                // Stop the notice animation since streaming is starting (only on first chunk)
                if (this.thinkingNotice) {
                    this.stopDotsAnimation();
                }
                
                // On first chunk, set the start position to current streaming position
                if (!this.streamingStartPos) {
                    this.streamingStartPos = { ...this.currentStreamingEndPos };
                }
                
                // Only update if we have actual content
                if (newText.trim().length > 0) {
                    // Calculate new end position based on the complete new text from start position
                    const lines = newText.split('\n');
                    const newEndPos = {
                        line: this.streamingStartPos.line + lines.length - 1,
                        ch: lines.length > 1 ? lines[lines.length - 1].length : this.streamingStartPos.ch + newText.length
                    };

                    // Replace content from start position to current end position with new text
                    editor.replaceRange(newText, this.streamingStartPos, this.currentStreamingEndPos);
                    
                    // Update the end position for next chunk
                    this.currentStreamingEndPos = newEndPos;
                }
            }
            
            // Set cursor at the end of the new text only when complete
            if (isComplete) {
                if (this.currentStreamingEndPos) {
                    editor.setCursor(this.currentStreamingEndPos);
                }
                // Reset for next use
                this.currentStreamingEndPos = null;
                this.streamingStartPos = null;
                this.originalSelectionRange = null;
            }
        } catch (error) {
            console.warn('Error updating streaming text:', error);
            // On error, try to restore original text if we have it
            if (this.originalSelectionRange && this.originalSelectionRange.text) {
                try {
                    // Restore the original text at the start position
                    const restorePos = this.streamingStartPos || this.currentStreamingEndPos;
                    if (restorePos) {
                        editor.replaceRange(this.originalSelectionRange.text, restorePos, this.currentStreamingEndPos || restorePos);
                        // Position cursor after restored text
                        const lines = this.originalSelectionRange.text.split('\n');
                        const endPos = {
                            line: restorePos.line + lines.length - 1,
                            ch: lines.length > 1 ? lines[lines.length - 1].length : restorePos.ch + this.originalSelectionRange.text.length
                        };
                        editor.setCursor(endPos);
                    }
                } catch (restoreError) {
                    console.warn('Could not restore original text:', restoreError);
                }
            }
            this.currentStreamingEndPos = null;
            this.streamingStartPos = null;
            this.originalSelectionRange = null;
        }
    }

    /**
     * Restore original text if streaming fails completely
     */
    private restoreOriginalText(editor: Editor): void {
        if (this.originalSelectionRange && this.originalSelectionRange.text) {
            try {
                // Find the position to restore to - either where streaming started or current position
                const restorePos = this.streamingStartPos || this.currentStreamingEndPos || this.originalSelectionRange.from;
                
                if (restorePos) {
                    // Replace any content at current position with original text
                    const currentEndPos = this.currentStreamingEndPos || restorePos;
                    editor.replaceRange(this.originalSelectionRange.text, restorePos, currentEndPos);
                    
                    // Position cursor after restored text
                    const lines = this.originalSelectionRange.text.split('\n');
                    const endPos = {
                        line: restorePos.line + lines.length - 1,
                        ch: lines.length > 1 ? lines[lines.length - 1].length : restorePos.ch + this.originalSelectionRange.text.length
                    };
                    editor.setCursor(endPos);
                }
            } catch (restoreError) {
                console.warn('Could not restore original text after failure:', restoreError);
            }
        }
        
        // Clean up state
        this.currentStreamingEndPos = null;
        this.streamingStartPos = null;
        this.originalSelectionRange = null;
    }

    /**
     * Start pulsing animation on selected text
     */
    private startSelectionAnimation(editor: Editor): void {
        try {
            // Find the editor container in the DOM
            const editorContainer = (editor as any).cm?.dom || document.querySelector('.cm-editor');
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
            console.warn('Failed to start selection animation:', error);
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
            console.warn('Failed to stop selection animation:', error);
        }
    }

    private animatedSelection: { from: any; to: any } | null = null;

    // Dynamic thinking phrases for each action type
    private static readonly THINKING_PHRASES = {
        'improve': [
            'refining...',
            'polishing...',
            'enhancing...',
            'crafting...',
            'perfecting...',
            'smoothing...',
            'sharpening...',
            'elevating...',
            'fine-tuning...',
            'sculpting...'
        ],
        'longer': [
            'expanding...',
            'developing...',
            'elaborating...',
            'building...',
            'enriching...',
            'deepening...',
            'growing...',
            'extending...',
            'amplifying...',
            'unfolding...'
        ],
        'shorter': [
            'condensing...',
            'distilling...',
            'tightening...',
            'focusing...',
            'streamlining...',
            'compressing...',
            'trimming...',
            'clarifying...',
            'simplifying...',
            'concentrating...'
        ],
        'tone': [
            'adjusting tone...',
            'reshaping...',
            'reframing...',
            'adapting...',
            'transforming...',
            'modulating...',
            'recasting...',
            'shifting...',
            'reforming...',
            'reimagining...'
        ],
        'custom': [
            'working on it...',
            'considering...',
            'thinking...',
            'processing...',
            'analyzing...',
            'contemplating...',
            'understanding...',
            'interpreting...',
            'exploring...',
            'evaluating...'
        ]
    };

    /**
     * Show Nova thinking animation with notice + document placeholder
     */
    private async showThinkingAnimation(editor: Editor, startPos: any, endPos: any, actionId: string): Promise<void> {
        try {
            // Select random phrase based on action type
            const phrases = SelectionContextMenu.THINKING_PHRASES[actionId as keyof typeof SelectionContextMenu.THINKING_PHRASES] || SelectionContextMenu.THINKING_PHRASES['custom'];
            const randomPhrase = phrases[Math.floor(Math.random() * phrases.length)];
            
            // Show thinking notice for user feedback
            this.showThinkingNotice(randomPhrase);
            
            // Store original text before clearing it (for error recovery)
            const originalText = editor.getRange(startPos, endPos);
            
            // Clear the selection in document to create clean streaming position
            editor.replaceRange('', startPos, endPos);
            
            // Set streaming position to where selection was cleared
            this.currentStreamingEndPos = startPos;
            this.originalSelectionRange = { 
                from: startPos, 
                to: endPos, 
                text: originalText  // Store original text for restoration
            };
            
        } catch (error) {
            console.warn('Failed to show thinking animation:', error);
        }
    }

    private dotsAnimationInterval: NodeJS.Timeout | null = null;
    private thinkingNotice: Notice | null = null;
    private originalSelectionRange: { from: any; to: any; text?: string } | null = null;

    /**
     * Show thinking notice with animated dots
     */
    private showThinkingNotice(basePhrase: string): void {
        try {
            // Create persistent notice (0 timeout = manual dismissal)
            this.thinkingNotice = new Notice(`Nova: ${basePhrase}.`, 0);
            
            // Show initial state with 1 dot immediately
            const initialNoticeText = `Nova: ${basePhrase}.`;
            const noticeEl = (this.thinkingNotice as any).noticeEl;
            if (noticeEl) {
                noticeEl.textContent = initialNoticeText;
            }
            
            // Start dots animation in notice
            this.startNoticeDotsAnimation(basePhrase);
            
        } catch (error) {
            console.warn('Failed to create thinking notice:', error);
        }
    }

    /**
     * Animate dots in notice text
     */
    private startNoticeDotsAnimation(basePhrase: string): void {
        let dotCount = 1;
        
        this.dotsAnimationInterval = setInterval(() => {
            try {
                if (!this.thinkingNotice) return;
                
                dotCount++;
                if (dotCount > 5) {
                    dotCount = 1;
                }
                
                const dots = '.'.repeat(dotCount);
                const noticeText = `Nova: ${basePhrase}${dots}`;
                
                // Update notice text directly
                const noticeEl = (this.thinkingNotice as any).noticeEl;
                if (noticeEl) {
                    noticeEl.textContent = noticeText;
                }
                
            } catch (error) {
                console.warn('Error in notice dots animation:', error);
                this.stopDotsAnimation();
            }
        }, 400);
    }

    /**
     * Stop the dots animation and dismiss notice
     */
    private stopDotsAnimation(): void {
        if (this.dotsAnimationInterval) {
            clearInterval(this.dotsAnimationInterval);
            this.dotsAnimationInterval = null;
        }
        
        // Dismiss thinking notice
        if (this.thinkingNotice) {
            this.thinkingNotice.hide();
            this.thinkingNotice = null;
        }
    }


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
                const sidebarView = leaves[0].view as any;
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
            console.warn('Failed to add success chat message:', error);
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
                const sidebarView = leaves[0].view as any;
                if (sidebarView?.chatRenderer) {
                    const actionName = this.getActionDisplayName(actionId);
                    const message = `✗ Failed to ${actionName.replace('ed', '')} text: ${errorMessage}`;
                    
                    // Use unified system with persistence
                    sidebarView.chatRenderer.addErrorMessage(message, true);
                }
            }
        } catch (error) {
            console.warn('Failed to add error chat message:', error);
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