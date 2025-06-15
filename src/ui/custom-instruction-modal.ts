/**
 * Custom instruction modal for Nova selection-based editing
 * Allows users to provide custom instructions for text transformation
 */

import { App, Modal, Setting, ButtonComponent, TextAreaComponent } from 'obsidian';

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

        // Modal title
        contentEl.createEl('h2', { text: 'Tell Nova' });
        contentEl.createEl('p', { 
            text: 'Describe how you want Nova to transform your selected text:',
            cls: 'setting-item-description'
        });

        // Instruction input area
        const inputContainer = contentEl.createDiv({ cls: 'nova-custom-instruction-input' });
        inputContainer.style.cssText = `
            margin: var(--size-4-3) 0;
        `;

        // Create textarea for instruction
        this.textAreaComponent = new TextAreaComponent(inputContainer);
        this.textAreaComponent.setPlaceholder('e.g., "make this more persuasive", "add statistics", "write in bullet points"');
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

        // Add input event listener
        this.textAreaComponent.onChange((value) => {
            this.instruction = value;
            this.updateSubmitButton();
        });

        // Examples section
        const examplesContainer = contentEl.createDiv({ cls: 'nova-instruction-examples' });
        examplesContainer.style.cssText = `
            margin: var(--size-4-3) 0;
            padding: var(--size-2-3);
            background: var(--background-modifier-form-field);
            border-radius: var(--radius-s);
            border: 1px solid var(--background-modifier-border);
        `;

        const examplesTitle = examplesContainer.createEl('h4', { text: 'Example instructions:' });
        examplesTitle.style.cssText = `
            margin: 0 0 var(--size-2-2) 0;
            font-size: var(--font-ui-small);
            color: var(--text-muted);
        `;

        const examples = [
            'Make this more persuasive',
            'Add specific examples',
            'Write in bullet points',
            'Make it sound more professional',
            'Simplify for a general audience',
            'Add transition sentences'
        ];

        const examplesList = examplesContainer.createEl('ul');
        examplesList.style.cssText = `
            margin: 0;
            padding-left: var(--size-4-3);
            font-size: var(--font-ui-smaller);
            color: var(--text-muted);
        `;

        examples.forEach(example => {
            const listItem = examplesList.createEl('li', { text: example });
            listItem.style.cssText = `
                margin-bottom: var(--size-2-1);
                cursor: pointer;
            `;
            
            // Click to use example
            listItem.addEventListener('click', () => {
                this.instruction = example;
                this.textAreaComponent?.setValue(example);
                this.updateSubmitButton();
            });

            // Hover effect
            listItem.addEventListener('mouseenter', () => {
                listItem.style.color = 'var(--interactive-accent)';
            });
            listItem.addEventListener('mouseleave', () => {
                listItem.style.color = 'var(--text-muted)';
            });
        });

        // Buttons
        const buttonContainer = contentEl.createDiv({ cls: 'nova-instruction-buttons' });
        buttonContainer.style.cssText = `
            display: flex;
            gap: var(--size-2-3);
            justify-content: flex-end;
            margin-top: var(--size-4-4);
            padding-top: var(--size-4-3);
            border-top: 1px solid var(--background-modifier-border);
        `;

        // Cancel button
        const cancelBtn = new ButtonComponent(buttonContainer);
        cancelBtn.setButtonText('Cancel');
        cancelBtn.onClick(() => {
            this.close();
            this.onCancel();
        });

        // Submit button
        this.submitButton = new ButtonComponent(buttonContainer);
        this.submitButton.setButtonText('Transform Text');
        this.submitButton.setCta();
        this.submitButton.setDisabled(true);
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