/**
 * Native tone selection modal for Nova using Obsidian's FuzzySuggestModal
 * Provides consistent UX with core Obsidian features
 */

import { App, FuzzySuggestModal } from 'obsidian';

export interface ToneOption {
    id: string;
    label: string;
    description: string;
}

export const TONE_OPTIONS: ToneOption[] = [
    {
        id: 'formal',
        label: 'formal',
        description: 'Professional, structured language suitable for business or academic contexts'
    },
    {
        id: 'casual',
        label: 'casual',
        description: 'Relaxed, conversational tone for informal communication'
    },
    {
        id: 'academic',
        label: 'academic',
        description: 'Scholarly, precise language with technical vocabulary'
    },
    {
        id: 'friendly',
        label: 'friendly',
        description: 'Warm, approachable tone that builds connection'
    }
];

export class ToneSelectionModal extends FuzzySuggestModal<ToneOption> {
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
        
        // Set placeholder text
        this.setPlaceholder('Choose a writing tone...');
        
        // Add instruction
        this.setInstructions([
            { command: '↑↓', purpose: 'to navigate' },
            { command: '↵', purpose: 'to apply tone' },
            { command: 'esc', purpose: 'to cancel' }
        ]);
    }

    getItems(): ToneOption[] {
        return TONE_OPTIONS;
    }

    getItemText(tone: ToneOption): string {
        return `${tone.label} - ${tone.description}`;
    }

    onChooseItem(tone: ToneOption, _evt: MouseEvent | KeyboardEvent): void {
        this.onSelect(tone.id);
    }

    onClose(): void {
        // If no selection was made, call onCancel
        const { contentEl } = this;
        if (contentEl.parentElement) {
            this.onCancel();
        }
    }
}