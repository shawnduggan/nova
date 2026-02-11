/**
 * @file CustomInstructionModal - Modal for custom editing instructions with prompt history
 */

import { App, Modal, Setting, setIcon } from 'obsidian';
import NovaPlugin from '../../main';
import { TimeoutManager } from '../utils/timeout-manager';
import { CUSTOM_PROMPT_HISTORY_MAX } from '../constants';

export class CustomInstructionModal extends Modal {
    private instruction: string = '';
    private onSubmit: (instruction: string) => void;
    private plugin: NovaPlugin;
    private timeoutManager = new TimeoutManager();
    private onCancel: () => void;
    private historySection: HTMLElement | null = null;
    private textareaEl: HTMLTextAreaElement | null = null;

    constructor(
        app: App,
        plugin: NovaPlugin,
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

        // History section (rendered before textarea)
        const history = this.plugin.settings.general.customPromptHistory;
        const hasHistory = history.length > 0;

        // Description — contextual based on history
        const descSetting = new Setting(contentEl)
            .setName('Instruction');
        if (hasHistory) {
            descSetting.setDesc('Select a recent prompt or type a new instruction below');
        } else {
            descSetting.setDesc('Describe how you want Nova to transform your selected text');
        }

        // Render history if present
        if (hasHistory) {
            this.historySection = contentEl.createDiv({ cls: 'nova-custom-history-section' });
            this.renderHistory();
        }

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
                this.textareaEl = text.inputEl;

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

    private renderHistory(): void {
        if (!this.historySection) return;
        this.historySection.empty();

        const history = this.plugin.settings.general.customPromptHistory;
        if (history.length === 0) {
            // Remove section entirely when empty
            this.historySection.remove();
            this.historySection = null;
            return;
        }

        history.forEach((prompt, index) => {
            const row = this.historySection!.createDiv({ cls: 'nova-custom-history-item' });

            // Icon
            const iconEl = row.createSpan({ cls: 'nova-custom-history-icon' });
            setIcon(iconEl, 'corner-down-left');

            // Truncated text
            const textEl = row.createSpan({ cls: 'nova-custom-history-text' });
            const truncated = prompt.length > 50 ? prompt.substring(0, 50) + '...' : prompt;
            textEl.setText(truncated);
            textEl.setAttr('title', prompt);

            // Remove button (visible on hover via CSS)
            const removeBtn = row.createSpan({ cls: 'nova-custom-history-remove' });
            setIcon(removeBtn, 'x');

            // Click row → populate textarea
            this.registerEventListener(row, 'click', (e: Event) => {
                // Don't populate if clicking remove button
                if ((e.target as HTMLElement).closest('.nova-custom-history-remove')) return;
                this.instruction = prompt;
                if (this.textareaEl) {
                    this.textareaEl.value = prompt;
                    this.textareaEl.focus();
                }
            });

            // Remove button click
            this.registerEventListener(removeBtn, 'click', (e: Event) => {
                e.stopPropagation();
                this.removeFromHistory(index);
            });
        });
    }

    private submit(): void {
        if (this.instruction.trim()) {
            this.addToHistory(this.instruction.trim());
            this.close();
            this.onSubmit(this.instruction.trim());
        }
    }

    private addToHistory(instruction: string): void {
        const history = this.plugin.settings.general.customPromptHistory;
        const trimmed = instruction.trim();

        // Deduplicate: case-insensitive, trimmed comparison
        const existingIndex = history.findIndex(
            h => h.trim().toLowerCase() === trimmed.toLowerCase()
        );
        if (existingIndex !== -1) {
            history.splice(existingIndex, 1);
        }

        // Prepend (most recent first)
        history.unshift(trimmed);

        // Cap at max
        if (history.length > CUSTOM_PROMPT_HISTORY_MAX) {
            history.splice(CUSTOM_PROMPT_HISTORY_MAX);
        }

        this.plugin.saveSettings().catch(() => {
            // Settings save failure is non-critical
        });
    }

    private removeFromHistory(index: number): void {
        const history = this.plugin.settings.general.customPromptHistory;
        history.splice(index, 1);
        this.plugin.saveSettings().catch(() => {
            // Settings save failure is non-critical
        });

        // Re-render
        this.renderHistory();
    }

    onClose() {
        // Clean up timeouts
        this.timeoutManager.clearAll();

        // Event listeners are automatically cleaned up by Modal/registerDomEvent
        const { contentEl } = this;
        contentEl.empty();
        this.historySection = null;
        this.textareaEl = null;
    }
}
