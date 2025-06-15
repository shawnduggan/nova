/**
 * Custom instruction modal for Nova selection-based editing
 * Allows users to provide custom instructions for text transformation
 */

import { App, Modal, Setting, ButtonComponent, TextAreaComponent, Platform } from 'obsidian';

export class CustomInstructionModal extends Modal {
    private instruction: string = '';
    private onSubmit: (instruction: string) => void;
    private onCancel: () => void;
    private textAreaComponent: TextAreaComponent | null = null;
    private submitButton: ButtonComponent | null = null;

    constructor(
        app: App,
        onSubmit: (instruction: string) => void,
        onCancel: () => void
    ) {
        super(app);
        this.onSubmit = onSubmit;
        this.onCancel = onCancel;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        // Apply mobile-specific styling to modal container
        if (Platform.isMobile) {
            this.modalEl.style.cssText = `
                width: 95vw !important;
                height: auto !important;
                max-width: none !important;
                max-height: 80vh !important;
                margin: 0 !important;
                top: 60px !important;
                left: 2.5vw !important;
                transform: none !important;
                border-radius: var(--radius-m);
                position: fixed !important;
            `;
            
            contentEl.style.cssText = `
                display: flex;
                flex-direction: column;
                padding: var(--size-4-2);
                max-height: 80vh;
                overflow-y: auto;
            `;
        }

        // Modal title
        const titleEl = contentEl.createEl('h2', { text: 'Tell Nova' });
        if (Platform.isMobile) {
            titleEl.style.cssText = `
                font-size: var(--font-ui-large);
                margin: 0 0 var(--size-2-1) 0;
            `;
        }

        const descEl = contentEl.createEl('p', { 
            text: 'Describe how you want Nova to transform your selected text:',
            cls: 'setting-item-description'
        });
        if (Platform.isMobile) {
            descEl.style.cssText = `
                font-size: var(--font-ui-medium);
                margin: 0 0 var(--size-2-3) 0;
                line-height: 1.3;
            `;
        }

        // Instruction input area
        const inputContainer = contentEl.createDiv({ cls: 'nova-custom-instruction-input' });
        if (Platform.isMobile) {
            inputContainer.style.cssText = `
                margin: 0 0 var(--size-4-3) 0;
            `;
        } else {
            inputContainer.style.cssText = `
                margin: var(--size-4-3) 0;
            `;
        }

        // Create textarea for instruction
        this.textAreaComponent = new TextAreaComponent(inputContainer);
        this.textAreaComponent.setPlaceholder('e.g., "make this more persuasive", "add statistics", "write in bullet points"');
        
        if (Platform.isMobile) {
            this.textAreaComponent.inputEl.style.cssText = `
                width: 100%;
                min-height: 90px;
                max-height: 140px;
                resize: vertical;
                border-radius: var(--radius-m);
                padding: var(--size-4-3);
                border: 1px solid var(--background-modifier-border);
                background: var(--background-primary);
                color: var(--text-normal);
                font-family: var(--font-interface);
                font-size: var(--font-ui-medium);
                line-height: 1.4;
                -webkit-appearance: none;
                touch-action: manipulation;
            `;
        } else {
            this.textAreaComponent.inputEl.style.cssText = `
                width: 100%;
                min-height: 80px;
                max-height: 150px;
                resize: vertical;
                border-radius: var(--radius-s);
                padding: var(--size-2-2) var(--size-2-3);
                border: 1px solid var(--background-modifier-border);
                background: var(--background-primary);
                color: var(--text-normal);
                font-family: var(--font-interface);
                font-size: var(--font-ui-medium);
                line-height: 1.4;
            `;
        }

        // Add input event listener
        this.textAreaComponent.onChange((value) => {
            this.instruction = value;
            this.updateSubmitButton();
        });

        // Buttons
        const buttonContainer = contentEl.createDiv({ cls: 'nova-instruction-buttons' });
        if (Platform.isMobile) {
            buttonContainer.style.cssText = `
                display: flex;
                gap: var(--size-2-3);
                justify-content: stretch;
                margin-top: var(--size-4-3);
                padding-top: var(--size-4-3);
                border-top: 1px solid var(--background-modifier-border);
            `;
        } else {
            buttonContainer.style.cssText = `
                display: flex;
                gap: var(--size-2-3);
                justify-content: flex-end;
                margin-top: var(--size-4-4);
                padding-top: var(--size-4-3);
                border-top: 1px solid var(--background-modifier-border);
            `;
        }

        // Cancel button
        const cancelBtn = new ButtonComponent(buttonContainer);
        cancelBtn.setButtonText('Cancel');
        if (Platform.isMobile) {
            cancelBtn.buttonEl.style.cssText = `
                flex: 1;
                min-height: 48px;
                font-size: var(--font-ui-medium);
                padding: var(--size-4-3);
                border-radius: var(--radius-m);
                touch-action: manipulation;
            `;
        }
        cancelBtn.onClick(() => {
            this.close();
            this.onCancel();
        });

        // Submit button
        this.submitButton = new ButtonComponent(buttonContainer);
        this.submitButton.setButtonText('Transform Text');
        this.submitButton.setCta();
        this.submitButton.setDisabled(true);
        if (Platform.isMobile) {
            this.submitButton.buttonEl.style.cssText = `
                flex: 2;
                min-height: 48px;
                font-size: var(--font-ui-medium);
                padding: var(--size-4-3);
                border-radius: var(--radius-m);
                touch-action: manipulation;
            `;
        }
        this.submitButton.onClick(() => {
            if (this.instruction.trim()) {
                this.close();
                this.onSubmit(this.instruction.trim());
            }
        });

        // Focus the textarea
        setTimeout(() => {
            this.textAreaComponent?.inputEl.focus();
        }, 100);

        // Handle Enter key (Ctrl+Enter or Cmd+Enter to submit)
        this.textAreaComponent.inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                if (this.instruction.trim()) {
                    this.close();
                    this.onSubmit(this.instruction.trim());
                }
            }
        });
    }

    private updateSubmitButton(): void {
        if (this.submitButton) {
            this.submitButton.setDisabled(!this.instruction.trim());
        }
    }

    onClose() {
        // Cleanup handled by Obsidian
    }
}