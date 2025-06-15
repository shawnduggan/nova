/**
 * Tone selection modal for Nova selection-based editing
 * Allows users to choose between different writing tones
 */

import { App, Modal, Setting, ButtonComponent } from 'obsidian';

export interface ToneOption {
    id: string;
    label: string;
    description: string;
}

export const TONE_OPTIONS: ToneOption[] = [
    {
        id: 'formal',
        label: 'Formal',
        description: 'Professional, structured language suitable for business or academic contexts'
    },
    {
        id: 'casual',
        label: 'Casual',
        description: 'Relaxed, conversational tone for informal communication'
    },
    {
        id: 'academic',
        label: 'Academic',
        description: 'Scholarly, precise language with technical vocabulary'
    },
    {
        id: 'friendly',
        label: 'Friendly',
        description: 'Warm, approachable tone that builds connection'
    }
];

export class ToneSelectionModal extends Modal {
    private selectedTone: string | null = null;
    private onSelect: (tone: string) => void;
    private onCancel: () => void;

    constructor(
        app: App,
        onSelect: (tone: string) => void,
        onCancel: () => void
    ) {
        super(app);
        this.onSelect = onSelect;
        this.onCancel = onCancel;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        // Modal title
        contentEl.createEl('h2', { text: 'Choose Writing Tone' });
        contentEl.createEl('p', { 
            text: 'Select how you want Nova to adjust the tone of your selected text:',
            cls: 'setting-item-description'
        });

        // Create tone options
        const toneContainer = contentEl.createDiv({ cls: 'nova-tone-options' });
        
        TONE_OPTIONS.forEach(tone => {
            const optionEl = toneContainer.createDiv({ 
                cls: 'nova-tone-option'
            });
            
            // Style the option element
            optionEl.style.cssText = `
                padding: var(--size-4-3);
                margin-bottom: var(--size-2-2);
                border: 1px solid var(--background-modifier-border);
                border-radius: var(--radius-s);
                cursor: pointer;
                transition: all 0.2s ease;
            `;

            // Option header
            const headerEl = optionEl.createDiv({ cls: 'nova-tone-header' });
            headerEl.style.cssText = `
                display: flex;
                align-items: center;
                margin-bottom: var(--size-2-1);
            `;

            // Radio button (visual only)
            const radioEl = headerEl.createSpan({ cls: 'nova-tone-radio' });
            radioEl.style.cssText = `
                width: 16px;
                height: 16px;
                border: 2px solid var(--interactive-normal);
                border-radius: 50%;
                margin-right: var(--size-2-2);
                transition: all 0.2s ease;
            `;

            // Tone label
            const labelEl = headerEl.createSpan({ 
                text: tone.label,
                cls: 'nova-tone-label'
            });
            labelEl.style.cssText = `
                font-weight: 600;
                color: var(--text-normal);
            `;

            // Tone description
            const descEl = optionEl.createDiv({ 
                text: tone.description,
                cls: 'nova-tone-description'
            });
            descEl.style.cssText = `
                font-size: var(--font-ui-smaller);
                color: var(--text-muted);
                line-height: 1.4;
            `;

            // Click handler
            optionEl.addEventListener('click', () => {
                this.selectTone(tone.id);
            });

            // Hover effects
            optionEl.addEventListener('mouseenter', () => {
                optionEl.style.borderColor = 'var(--interactive-accent)';
                optionEl.style.backgroundColor = 'var(--background-modifier-hover)';
            });

            optionEl.addEventListener('mouseleave', () => {
                if (this.selectedTone !== tone.id) {
                    optionEl.style.borderColor = 'var(--background-modifier-border)';
                    optionEl.style.backgroundColor = '';
                }
            });

            // Store reference for selection styling
            optionEl.setAttribute('data-tone', tone.id);
        });

        // Buttons
        const buttonContainer = contentEl.createDiv({ cls: 'nova-tone-buttons' });
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

        // Apply button
        const applyBtn = new ButtonComponent(buttonContainer);
        applyBtn.setButtonText('Apply Tone');
        applyBtn.setCta();
        applyBtn.setDisabled(true);
        applyBtn.onClick(() => {
            if (this.selectedTone) {
                this.close();
                this.onSelect(this.selectedTone);
            }
        });

        // Store reference for enabling/disabling
        this.applyButton = applyBtn;
    }

    private applyButton: ButtonComponent | null = null;

    private selectTone(toneId: string) {
        this.selectedTone = toneId;

        // Update visual selection
        const options = this.contentEl.querySelectorAll('.nova-tone-option');
        options.forEach(option => {
            const optionEl = option as HTMLElement;
            const radio = optionEl.querySelector('.nova-tone-radio') as HTMLElement;
            
            if (optionEl.getAttribute('data-tone') === toneId) {
                // Selected state
                optionEl.style.borderColor = 'var(--interactive-accent)';
                optionEl.style.backgroundColor = 'var(--background-modifier-selected)';
                radio.style.backgroundColor = 'var(--interactive-accent)';
                radio.style.borderColor = 'var(--interactive-accent)';
            } else {
                // Unselected state
                optionEl.style.borderColor = 'var(--background-modifier-border)';
                optionEl.style.backgroundColor = '';
                radio.style.backgroundColor = '';
                radio.style.borderColor = 'var(--interactive-normal)';
            }
        });

        // Enable apply button
        if (this.applyButton) {
            this.applyButton.setDisabled(false);
        }
    }

    onClose() {
        // Cleanup handled by Obsidian
    }
}