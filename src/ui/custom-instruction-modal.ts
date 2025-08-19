/**
 * Native custom instruction modal for Nova using Obsidian's Modal class
 * Simplified design following Obsidian's native patterns
 */

import { App, Modal, Setting } from 'obsidian';

export class CustomInstructionModal extends Modal {
    private instruction: string = '';
    private onSubmit: (instruction: string) => void;
    private eventListeners: Array<{element: HTMLElement, event: string, handler: EventListener}> = [];
    private onCancel: () => void;

    constructor(
        app: App,
        onSubmit: (instruction: string) => void,
        onCancel: () => void
    ) {
        super(app);
        this.onSubmit = onSubmit;
        this.onCancel = onCancel;
    }

    /**
     * Register event listener for cleanup tracking
     */
    private registerEventListener(element: HTMLElement, event: string, handler: EventListener): void {
        element.addEventListener(event, handler);
        this.eventListeners.push({element, event, handler});
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        // Use native modal styling
        this.modalEl.addClass('nova-custom-instruction-modal');
        
        // Title
        contentEl.createEl('h2', { text: 'Tell Nova' });

        // Description
        new Setting(contentEl)
            .setName('Instruction')
            .setDesc('Describe how you want Nova to transform your selected text');

        // Text area using Setting component for consistent styling
        const textAreaSetting = new Setting(contentEl)
            .addTextArea(text => {
                text
                    .setPlaceholder('e.g., "make this more persuasive", "add statistics", "write in bullet points"')
                    .setValue(this.instruction)
                    .onChange(value => {
                        this.instruction = value;
                    });
                
                // Make the text area larger
                text.inputEl.rows = 4;
                text.inputEl.addClass('nova-custom-textarea');
                
                // Focus on the text area
                setTimeout(() => text.inputEl.focus(), 50);
                
                // Handle Ctrl/Cmd+Enter to submit
                this.registerEventListener(text.inputEl, 'keydown', (e: Event) => {
                    const keyEvent = e as KeyboardEvent;
                    if (keyEvent.key === 'Enter' && (keyEvent.ctrlKey || keyEvent.metaKey)) {
                        e.preventDefault();
                        this.submit();
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

        // Buttons using Setting component
        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Cancel')
                .onClick(() => {
                    this.close();
                    this.onCancel();
                }))
            .addButton(btn => btn
                .setButtonText('Transform Text')
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
        // Clean up event listeners
        this.eventListeners.forEach(({element, event, handler}) => {
            element.removeEventListener(event, handler);
        });
        this.eventListeners = [];
        
        const { contentEl } = this;
        contentEl.empty();
    }
}