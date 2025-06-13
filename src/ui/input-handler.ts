import { ButtonComponent, TextAreaComponent, Platform } from 'obsidian';
import NovaPlugin from '../../main';
import { NovaWikilinkAutocomplete } from './wikilink-suggest';
import { CommandSystem } from './command-system';
import { ContextManager } from './context-manager';

/**
 * Handles textarea input, auto-grow, send button, and input events
 */
export class InputHandler {
	private plugin: NovaPlugin;
	private container: HTMLElement;
	private textArea!: TextAreaComponent;
	private sendButton!: ButtonComponent;
	private autoGrowTextarea!: () => void;
	private wikilinkAutocomplete!: NovaWikilinkAutocomplete;
	private commandSystem: CommandSystem;
	private contextManager: ContextManager;
	private static readonly FOCUS_DELAY_MS = 150;

	// Event cleanup tracking
	private eventListeners: Array<{element: EventTarget, event: string, handler: EventListener}> = [];

	constructor(
		plugin: NovaPlugin, 
		container: HTMLElement, 
		commandSystem: CommandSystem,
		contextManager: ContextManager
	) {
		this.plugin = plugin;
		this.container = container;
		this.commandSystem = commandSystem;
		this.contextManager = contextManager;
	}

	createInputInterface(chatContainer: HTMLElement): void {
		this.container = this.container.createDiv({ cls: 'nova-input-container' });
		this.container.style.cssText = `
			flex-shrink: 0;
			padding: var(--size-4-3);
			border-top: 1px solid var(--background-modifier-border);
			position: relative;
		`;

		const inputRow = this.container.createDiv({ cls: 'nova-input-row' });
		inputRow.style.cssText = `
			display: flex;
			gap: var(--size-2-3);
			align-items: flex-end;
			position: relative;
		`;

		// Textarea container
		const textAreaContainer = inputRow.createDiv();
		textAreaContainer.style.cssText = 'flex: 1; position: relative;';

		// Create textarea
		this.textArea = new TextAreaComponent(textAreaContainer);
		this.textArea.setPlaceholder('Ask Nova anything... (Shift+Enter for new line)');
		this.textArea.inputEl.style.cssText = `
			min-height: var(--input-height);
			max-height: 200px;
			resize: none;
			overflow-y: auto;
			border-radius: var(--radius-s);
			padding: var(--size-2-2) var(--size-2-3);
			border: 1px solid var(--background-modifier-border);
			background: var(--background-primary);
			color: var(--text-normal);
			font-family: var(--font-interface);
			font-size: var(--font-ui-medium);
			line-height: 1.4;
			width: 100%;
			box-sizing: border-box;
		`;

		// Auto-grow functionality
		this.autoGrowTextarea = () => {
			const textarea = this.textArea.inputEl;
			textarea.style.height = 'auto';
			textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
		};

		// Add input event listener for auto-grow
		this.addEventListener(this.textArea.inputEl, 'input', this.autoGrowTextarea);

		// Trigger auto-grow on initial load
		setTimeout(this.autoGrowTextarea, 0);

		// Initialize wikilink autocomplete
		this.wikilinkAutocomplete = new NovaWikilinkAutocomplete(this.plugin.app, this.textArea.inputEl);

		// Add debounced context preview
		this.addEventListener(this.textArea.inputEl, 'input', () => {
			this.contextManager.updateLiveContextPreview(this.textArea.getValue());
		});

		// Create command button
		this.commandSystem.createCommandButton(inputRow);

		// Send button
		this.sendButton = new ButtonComponent(inputRow);
		this.sendButton.setIcon('send');
		this.sendButton.setTooltip('Send message');
		this.sendButton.onClick(() => this.handleSend());
		this.sendButton.buttonEl.style.cssText = `
			min-width: var(--input-height);
			height: var(--input-height);
			border-radius: 50%;
			display: flex;
			align-items: center;
			justify-content: center;
			padding: 0;
			flex-shrink: 0;
			background: var(--interactive-accent);
			color: var(--text-on-accent);
			border: none;
		`;

		// Enter key handling and command picker
		this.addEventListener(this.textArea.inputEl, 'keydown', (event: KeyboardEvent) => {
			if (event.key === 'Enter' && !event.shiftKey) {
				event.preventDefault();
				this.commandSystem.handleCommandPickerSelection() || this.handleSend();
			} else if (event.key === 'Escape') {
				this.commandSystem.hideCommandPicker();
			} else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
				if (this.commandSystem.handleCommandPickerNavigation(event.key)) {
					event.preventDefault();
				}
			} else if (event.key === 'Tab') {
				if (this.commandSystem.handleCommandPickerNavigation(event.key)) {
					event.preventDefault();
				}
			}
		});

		// Input change handling for command picker
		this.addEventListener(this.textArea.inputEl, 'input', () => {
			this.commandSystem.handleInputChange();
		});

		// Create command picker
		this.commandSystem.createCommandPicker();
	}

	focus(): void {
		setTimeout(() => {
			if (this.textArea?.inputEl) {
				this.textArea.inputEl.focus();
			}
		}, InputHandler.FOCUS_DELAY_MS);
	}

	private handleSend(): void {
		const message = this.textArea.getValue().trim();
		if (!message) return;

		// Clear input
		this.textArea.setValue('');
		this.autoGrowTextarea();
		this.contextManager.hideContextPreview();

		// This would typically call a callback or emit an event
		// For now, we'll assume the parent handles the actual sending
		this.onSendMessage?.(message);
	}

	private onSendMessage?: (message: string) => void;

	setOnSendMessage(callback: (message: string) => void): void {
		this.onSendMessage = callback;
	}

	getValue(): string {
		return this.textArea.getValue();
	}

	setValue(value: string): void {
		this.textArea.setValue(value);
		this.autoGrowTextarea();
	}

	insertText(text: string): void {
		const currentValue = this.textArea.getValue();
		const textarea = this.textArea.inputEl;
		const start = textarea.selectionStart;
		const end = textarea.selectionEnd;

		const newValue = currentValue.slice(0, start) + text + currentValue.slice(end);
		this.textArea.setValue(newValue);

		// Position cursor after inserted text
		const newPosition = start + text.length;
		setTimeout(() => {
			textarea.setSelectionRange(newPosition, newPosition);
			textarea.focus();
		}, 0);

		this.autoGrowTextarea();
	}

	insertTextWithCursor(beforeCursor: string, afterCursor: string = ''): void {
		const currentValue = this.textArea.getValue();
		const textarea = this.textArea.inputEl;
		const start = textarea.selectionStart;
		const end = textarea.selectionEnd;

		const newValue = currentValue.slice(0, start) + beforeCursor + afterCursor + currentValue.slice(end);
		this.textArea.setValue(newValue);

		// Position cursor between before and after text
		const cursorPosition = start + beforeCursor.length;
		setTimeout(() => {
			textarea.setSelectionRange(cursorPosition, cursorPosition);
			textarea.focus();
		}, 0);

		this.autoGrowTextarea();
	}

	private addEventListener(element: EventTarget, event: string, handler: EventListener): void {
		element.addEventListener(event, handler);
		this.eventListeners.push({ element, event, handler });
	}

	cleanup(): void {
		// Clean up wikilink autocomplete
		if (this.wikilinkAutocomplete) {
			this.wikilinkAutocomplete.destroy();
		}

		// Clean up event listeners
		this.eventListeners.forEach(({ element, event, handler }) => {
			element.removeEventListener(event, handler);
		});
		this.eventListeners = [];
	}
}