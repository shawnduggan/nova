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
    private async handleSelectionAction(actionId: string, editor: Editor, selectedText: string): Promise<void> {
        try {
            // Handle tone selection with modal
            if (actionId === 'tone') {
                this.showToneSelectionModal(editor, selectedText);
                return;
            }
            
            if (actionId === 'custom') {
                this.showCustomInstructionModal(editor, selectedText);
                return;
            }

            // Execute the selection edit command for other actions
            await this.executeSelectionEdit(actionId, editor, selectedText);
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
            }
        } catch (error) {
            console.error('Error in streaming selection edit:', error);
            new Notice('Failed to execute Nova action. Please try again.', 3000);
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

    private updateStreamingText(
        editor: Editor, 
        newText: string, 
        startPos: any, 
        isComplete: boolean
    ): void {
        try {
            // If this is the first chunk, stop dots animation and replace with actual content
            if (this.currentStreamingEndPos) {
                // Stop the dots animation since streaming is starting
                this.stopDotsAnimation();
                
                // Replace the thinking dots or previous content with new text
                const lines = newText.split('\n');
                const newEndPos = {
                    line: startPos.line + lines.length - 1,
                    ch: lines.length > 1 ? lines[lines.length - 1].length : startPos.ch + newText.length
                };

                editor.replaceRange(newText, startPos, this.currentStreamingEndPos);
                this.currentStreamingEndPos = newEndPos;
            } else {
                // Fallback: Insert new text if no position tracking
                editor.replaceRange(newText, startPos);
                
                // Calculate new end position
                const lines = newText.split('\n');
                this.currentStreamingEndPos = {
                    line: startPos.line + lines.length - 1,
                    ch: lines.length > 1 ? lines[lines.length - 1].length : startPos.ch + newText.length
                };
            }
            
            // Set cursor at the end of the new text if complete
            if (isComplete) {
                editor.setCursor(this.currentStreamingEndPos);
                this.currentStreamingEndPos = null; // Reset for next use
            }
        } catch (error) {
            console.warn('Error updating streaming text:', error);
            this.currentStreamingEndPos = null;
        }
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
     * Show Nova thinking dots animation at cursor position
     */
    private async showThinkingAnimation(editor: Editor, startPos: any, endPos: any, actionId: string): Promise<void> {
        try {
            // Select random phrase based on action type
            const phrases = SelectionContextMenu.THINKING_PHRASES[actionId as keyof typeof SelectionContextMenu.THINKING_PHRASES] || SelectionContextMenu.THINKING_PHRASES['custom'];
            const randomPhrase = phrases[Math.floor(Math.random() * phrases.length)];
            
            // Start with italic markdown formatting
            const baseText = `*${randomPhrase}.*`;
            
            // Replace selection with initial thinking text
            await this.plugin.documentEngine.replaceSelection(baseText, startPos, endPos);
            
            // Update cursor position to account for the thinking text
            this.currentStreamingEndPos = {
                line: startPos.line,
                ch: startPos.ch + baseText.length
            };
            
            // Start progressive dots animation
            this.startProgressiveDotsAnimation(editor, startPos, baseText);
            
        } catch (error) {
            console.warn('Failed to show thinking animation:', error);
            // Fallback to clearing selection
            await this.plugin.documentEngine.replaceSelection('', startPos, endPos);
        }
    }

    private dotsAnimationInterval: NodeJS.Timeout | null = null;

    /**
     * Start progressive dots animation (Nova is thinking . -> .. -> ... -> .... -> ..... -> reset)
     */
    private startProgressiveDotsAnimation(editor: Editor, startPos: any, baseText: string): void {
        let dotCount = 1; // Start with 1 dot (already included in baseText)
        
        this.dotsAnimationInterval = setInterval(() => {
            try {
                dotCount++;
                
                // Reset to 1 dot after reaching 5 dots
                if (dotCount > 5) {
                    dotCount = 1;
                }
                
                // Create the new text with the appropriate number of dots
                const additionalDots = '.'.repeat(dotCount - 1); // -1 because baseText already has one dot
                const newText = baseText.slice(0, -1) + additionalDots + '*'; // Keep italic formatting
                
                // Replace current text with new text
                if (this.currentStreamingEndPos) {
                    editor.replaceRange(newText, startPos, this.currentStreamingEndPos);
                    
                    // Update end position
                    this.currentStreamingEndPos = {
                        line: startPos.line,
                        ch: startPos.ch + newText.length
                    };
                }
            } catch (error) {
                console.warn('Error in dots animation:', error);
                this.stopDotsAnimation();
            }
        }, 400); // Change dots every 400ms for a nice rhythm
    }

    /**
     * Stop the dots animation
     */
    private stopDotsAnimation(): void {
        if (this.dotsAnimationInterval) {
            clearInterval(this.dotsAnimationInterval);
            this.dotsAnimationInterval = null;
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
     * Add success message to chat
     */
    private addSuccessChatMessage(actionId: string, originalText: string, customInstruction?: string): void {
        try {
            // Find the active Nova sidebar view and add message to chat
            const leaves = this.app.workspace.getLeavesOfType('nova-sidebar');
            if (leaves.length > 0) {
                const sidebarView = leaves[0].view as any;
                if (sidebarView && sidebarView.chatRenderer) {
                    const actionDescription = this.getActionDescription(actionId, customInstruction);
                    const truncatedText = originalText.length > 50 
                        ? originalText.substring(0, 50) + '...' 
                        : originalText;
                    
                    const message = `✓ ${actionDescription} text: "${truncatedText}"`;
                    sidebarView.chatRenderer.addSuccessMessage(message);
                }
            }
        } catch (error) {
            console.warn('Failed to add success chat message:', error);
        }
    }

    /**
     * Add failure message to chat
     */
    private addFailureChatMessage(actionId: string, errorMessage: string): void {
        try {
            // Find the active Nova sidebar view and add message to chat
            const leaves = this.app.workspace.getLeavesOfType('nova-sidebar');
            if (leaves.length > 0) {
                const sidebarView = leaves[0].view as any;
                if (sidebarView && sidebarView.chatRenderer) {
                    const actionName = this.getActionDisplayName(actionId);
                    const message = `✗ Failed to ${actionName.replace('ed', '')} text: ${errorMessage}`;
                    sidebarView.chatRenderer.addErrorMessage(message);
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