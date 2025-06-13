import { ButtonComponent, TextAreaComponent, Platform } from 'obsidian';
import NovaPlugin from '../../main';
import { NovaWikilinkAutocomplete } from './wikilink-suggest';
import { CommandSystem } from './command-system';
import { ContextManager } from './context-manager';
import { SectionPicker } from './section-picker';

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
	private commandSystem!: CommandSystem;
	private contextManager: ContextManager;
	private sectionPicker!: SectionPicker;
	private inputRow!: HTMLElement;
	private static readonly FOCUS_DELAY_MS = 150;

	// Event cleanup tracking
	private eventListeners: Array<{element: EventTarget, event: string, handler: EventListener}> = [];

	constructor(
		plugin: NovaPlugin, 
		container: HTMLElement, 
		contextManager: ContextManager
	) {
		this.plugin = plugin;
		this.container = container;
		this.contextManager = contextManager;
	}

	setCommandSystem(commandSystem: CommandSystem): void {
		this.commandSystem = commandSystem;
		
		// Now create the command button and picker  
		this.commandSystem.createCommandButton(this.inputRow);
		// Pass the inputRow as the container for proper positioning
		this.commandSystem.createCommandPickerInContainer(this.inputRow);
	}

	getTextArea(): TextAreaComponent {
		return this.textArea;
	}

	createInputInterface(chatContainer: HTMLElement): void {
		this.container = this.container.createDiv({ cls: 'nova-input-container' });
		this.container.style.cssText = `
			flex-shrink: 0;
			padding: var(--size-4-3);
			border-top: 1px solid var(--background-modifier-border);
			position: relative;
		`;

		this.inputRow = this.container.createDiv({ cls: 'nova-input-row' });
		this.inputRow.style.cssText = `
			display: flex;
			gap: var(--size-2-3);
			align-items: flex-end;
			position: relative;
		`;

		// Textarea container
		const textAreaContainer = this.inputRow.createDiv();
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

		// Initialize wikilink autocomplete with inputRow for consistent width
		this.wikilinkAutocomplete = new NovaWikilinkAutocomplete(this.plugin.app, this.textArea.inputEl, this.inputRow);

		// Initialize section picker with inputRow for consistent alignment
		this.sectionPicker = new SectionPicker(this.plugin.app, this.plugin.documentEngine, this.inputRow);
		this.setupSectionPickerCallbacks();

		// Add debounced context preview
		this.addEventListener(this.textArea.inputEl, 'input', () => {
			this.contextManager.updateLiveContextPreview(this.textArea.getValue());
		});

		// Command button will be created later when CommandSystem is set

		// Send button
		this.sendButton = new ButtonComponent(this.inputRow);
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

		// Enter key handling and command/section picker
		this.addEventListener(this.textArea.inputEl, 'keydown', (event: Event) => {
			const keyEvent = event as KeyboardEvent;
			// First check if section picker handles the key
			if (this.sectionPicker.handleKeyDown(keyEvent)) {
				event.preventDefault();
				return;
			}

			if (keyEvent.key === 'Enter' && !keyEvent.shiftKey) {
				event.preventDefault();
				(this.commandSystem?.handleCommandPickerSelection() || false) || this.handleSend();
			} else if (keyEvent.key === 'Escape') {
				this.commandSystem?.hideCommandPicker();
				this.sectionPicker.hide();
			} else if (keyEvent.key === 'ArrowUp' || keyEvent.key === 'ArrowDown') {
				if (this.commandSystem?.handleCommandPickerNavigation(keyEvent.key)) {
					event.preventDefault();
				}
			} else if (keyEvent.key === 'Tab') {
				if (this.commandSystem?.handleCommandPickerNavigation(keyEvent.key)) {
					event.preventDefault();
				}
			}
		});

		// Input change handling for command picker and section picker
		this.addEventListener(this.textArea.inputEl, 'input', () => {
			if (this.commandSystem) {
				this.commandSystem.handleInputChange();
			}
			this.handleSectionPickerInput();
		});
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

	/**
	 * Setup section picker callbacks
	 */
	private setupSectionPickerCallbacks(): void {
		this.sectionPicker.onSelect((path: string) => {
			this.handleSectionSelection(path);
		});

		this.sectionPicker.onCancel(() => {
			// Focus back to text area
			this.focus();
		});
	}

	/**
	 * Handle section picker input changes
	 */
	private handleSectionPickerInput(): void {
		const input = this.textArea.getValue();
		const cursorPos = this.textArea.inputEl.selectionStart;
		
		// Find if cursor is after a "/" trigger
		const pathMatch = this.findPathTrigger(input, cursorPos);
		
		if (pathMatch) {
			// Show section picker with filter text
			this.sectionPicker.show(pathMatch.filterText).catch(console.error);
			if (pathMatch.filterText) {
				this.sectionPicker.updateFilter(pathMatch.filterText);
			}
		} else {
			// Hide section picker if not in path mode
			this.sectionPicker.hide();
		}
	}

	/**
	 * Find path trigger (/) in input relative to cursor position
	 */
	private findPathTrigger(input: string, cursorPos: number): { start: number; filterText: string } | null {
		// Look for "/" pattern before cursor, similar to wikilink detection
		const beforeCursor = input.substring(0, cursorPos);
		const pathMatch = beforeCursor.match(/(?:^|\s)\/([^\/\s]*)$/);
		
		if (pathMatch) {
			const fullMatch = pathMatch[0];
			const filterText = pathMatch[1] || '';
			const start = cursorPos - fullMatch.length + (fullMatch.startsWith(' ') ? 1 : 0); // Adjust for whitespace
			
			return {
				start: start,
				filterText: filterText
			};
		}
		
		return null;
	}

	/**
	 * Handle section selection from picker
	 */
	private handleSectionSelection(path: string): void {
		const input = this.textArea.getValue();
		const cursorPos = this.textArea.inputEl.selectionStart;
		
		// Find the "/" trigger to replace
		const pathMatch = this.findPathTrigger(input, cursorPos);
		
		if (pathMatch) {
			// Replace "/" and filter text with selected path
			const beforeSlash = input.slice(0, pathMatch.start);
			const afterCursor = input.slice(cursorPos);
			const newValue = beforeSlash + path + afterCursor;
			
			this.textArea.setValue(newValue);
			
			// Position cursor after the inserted path
			const newCursorPos = pathMatch.start + path.length;
			setTimeout(() => {
				this.textArea.inputEl.setSelectionRange(newCursorPos, newCursorPos);
				this.textArea.inputEl.focus();
			}, 0);
			
			this.autoGrowTextarea();
		}
	}

	cleanup(): void {
		// Clean up wikilink autocomplete
		if (this.wikilinkAutocomplete) {
			this.wikilinkAutocomplete.destroy();
		}

		// Clean up section picker
		if (this.sectionPicker) {
			this.sectionPicker.cleanup();
		}

		// Clean up event listeners
		this.eventListeners.forEach(({ element, event, handler }) => {
			element.removeEventListener(event, handler);
		});
		this.eventListeners = [];
	}
}