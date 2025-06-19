/**
 * Clarification UI Component for Nova
 * Provides quick clarification for ambiguous user intents
 */

export interface ClarificationOption {
    label: string;
    action: () => void;
}

export class ClarificationUI {
    private currentElement: HTMLElement | null = null;

    /**
     * Show clarification modal with two options
     */
    show(
        container: HTMLElement,
        message: string,
        option1: ClarificationOption,
        option2: ClarificationOption
    ): void {
        // Remove any existing clarification
        this.hide();

        // Create clarification element
        const clarificationEl = container.createDiv({ cls: 'nova-clarification' });
        clarificationEl.style.cssText = `
            background: var(--background-primary);
            border: 1px solid var(--background-modifier-border);
            border-radius: var(--radius-s);
            padding: var(--size-4-3);
            margin: var(--size-4-2) 0;
            box-shadow: var(--shadow-s);
        `;

        // Add message
        const messageEl = clarificationEl.createDiv({ cls: 'nova-clarification-message' });
        messageEl.textContent = message;
        messageEl.style.cssText = `
            color: var(--text-normal);
            font-size: var(--font-ui-small);
            margin-bottom: var(--size-4-2);
            text-align: center;
        `;

        // Add button container
        const buttonContainer = clarificationEl.createDiv({ cls: 'nova-clarification-buttons' });
        buttonContainer.style.cssText = `
            display: flex;
            gap: var(--size-4-2);
            justify-content: center;
        `;

        // Create buttons
        const button1 = this.createButton(option1, buttonContainer);
        const button2 = this.createButton(option2, buttonContainer);

        this.currentElement = clarificationEl;
    }

    /**
     * Hide clarification modal
     */
    hide(): void {
        if (this.currentElement) {
            this.currentElement.remove();
            this.currentElement = null;
        }
    }

    /**
     * Create a clarification button
     */
    private createButton(option: ClarificationOption, container: HTMLElement): HTMLElement {
        const button = container.createEl('button', { cls: 'nova-clarification-button' });
        button.textContent = option.label;
        button.style.cssText = `
            background: var(--interactive-normal);
            border: 1px solid var(--background-modifier-border);
            border-radius: var(--radius-s);
            color: var(--text-normal);
            cursor: pointer;
            font-size: var(--font-ui-small);
            padding: var(--size-2-2) var(--size-4-3);
            transition: background-color 0.1s ease;
        `;

        // Add hover effect
        button.addEventListener('mouseenter', () => {
            button.style.background = 'var(--interactive-hover)';
        });

        button.addEventListener('mouseleave', () => {
            button.style.background = 'var(--interactive-normal)';
        });

        // Add click handler
        button.addEventListener('click', () => {
            option.action();
            this.hide();
        });

        return button;
    }
}