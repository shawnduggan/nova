/**
 * Native custom instruction modal for Nova using Obsidian's Modal class
 * Simplified design following Obsidian's native patterns
 */

import { App, Modal, Setting, Plugin } from 'obsidian';
import { TimeoutManager } from '../utils/timeout-manager';

export class CustomInstructionModal extends Modal {
    private instruction: string = '';
    private onSubmit: (instruction: string) => void;
    private plugin: Plugin;
    private timeoutManager = new TimeoutManager();
    private onCancel: () => void;

    constructor(
        app: App,
        plugin: Plugin,
        onSubmit: (instruction: string) => void,
        onCancel: () => void
    ) {
        super(app);
        this.plugin = plugin;
        this.onSubmit = onSubmit;
        this.onCancel = onCancel;
    }

    /**
     * Register event listener using plugin's registration system
     */
    private registerEventListener<K extends keyof HTMLElementEventMap>(element: HTMLElement, event: K, handler: (this: HTMLElement, ev: HTMLElementEventMap[K]) => void): void {
        this.plugin.registerDomEvent(element, event, handler);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        // Use native modal styling
        this.modalEl.addClass('nova-custom-instruction-modal');

        // Title
        const titleDiv = contentEl.createDiv({ cls: 'modal-title' });
        titleDiv.setText('Custom prompt');

        // Description
        new Setting(contentEl)
            .setName('Instruction')
            .setDesc('Describe how you want nova to transform your selected text');

        // Text area using Setting component for consistent styling
        const textAreaSetting = new Setting(contentEl)
            .addTextArea(text => {
                text
                    .setPlaceholder('E.g., "make this more persuasive", "add statistics", "write in bullet points"')
                    .setValue(this.instruction)
                    .onChange(value => {
                        this.instruction = value;
                    });
                
                // Make the text area larger
                text.inputEl.rows = 4;
                text.inputEl.addClass('nova-custom-textarea');
                
                // Focus on the text area
                this.timeoutManager.addTimeout(() => text.inputEl.focus(), 50);
                
                // Handle Enter key submissions
                this.registerEventListener(text.inputEl, 'keydown', (e: Event) => {
                    const keyEvent = e as KeyboardEvent;
                    if (keyEvent.key === 'Enter') {
                        if (keyEvent.shiftKey) {
                            // Allow default behavior for new line
                            return;
                        }
                        // Submit on plain Enter or Ctrl/Cmd+Enter
                        if (!keyEvent.shiftKey) {
                            e.preventDefault();
                            this.submit();
                        }
                    }
                });
                
                return text;
            });
        
        // Hide the setting name/description area to give full width to textarea
        textAreaSetting.settingEl.addClass('nova-settings-no-border');
        textAreaSetting.settingEl.querySelector('.setting-item-info')?.remove();
        
        // Make the control take full width
        const control = textAreaSetting.settingEl.querySelector('.setting-item-control');
        if (control instanceof HTMLElement) {
            control.classList.add('nova-full-width-control');
        }

        // Add keyboard shortcut hint
        new Setting(contentEl)
            .setDesc('Press Enter to submit • Shift+Enter for new line');

        // Buttons using Setting component
        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Cancel')
                .onClick(() => {
                    this.close();
                    this.onCancel();
                }))
            .addButton(btn => btn
                .setButtonText('Transform text')
                .setCta()
                .onClick(() => this.submit()));
    }

    private submit(): void {
        if (this.instruction.trim()) {
            this.close();
            this.onSubmit(this.instruction.trim());
        }
    }

    onClose() {
        // Clean up timeouts
        this.timeoutManager.clearAll();
        
        // Event listeners are automatically cleaned up by Modal/registerDomEvent
        const { contentEl } = this;
        contentEl.empty();
    }
}