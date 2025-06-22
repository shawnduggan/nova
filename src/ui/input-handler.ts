import { ButtonComponent, TextAreaComponent, Platform, Notice } from 'obsidian';
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
	private commandSystem!: CommandSystem;
	private contextManager: ContextManager;
	private inputRow!: HTMLElement;
	private static readonly FOCUS_DELAY_MS = 150;
	private dropZoneOverlay: HTMLElement | null = null;
	private isDragging: boolean = false;
	private sidebarView: any; // Reference to NovaSidebarView for context operations

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

	setSidebarView(sidebarView: any): void {
		this.sidebarView = sidebarView;
		// Also pass to wikilink autocomplete if it exists
		if (this.wikilinkAutocomplete) {
			this.wikilinkAutocomplete.setSidebarView(sidebarView);
		}
	}

	setCommandSystem(commandSystem: CommandSystem): void {
		this.commandSystem = commandSystem;
		
		// Create command button before send button for proper DOM order
		const sendButtonEl = this.sendButton.buttonEl;
		sendButtonEl.remove();
		
		// Create command button
		this.commandSystem.createCommandButton(this.inputRow);
		
		// Re-add send button (will be last in DOM order)
		this.inputRow.appendChild(sendButtonEl);
		
		// Create command picker
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
			align-items: center;
			position: relative;
		`;

		// Textarea container
		const textAreaContainer = this.inputRow.createDiv();
		textAreaContainer.style.cssText = 'flex: 1; position: relative;';

		// Create textarea
		this.textArea = new TextAreaComponent(textAreaContainer);
		this.textArea.setPlaceholder('How can I help?');
		this.textArea.inputEl.style.cssText = `
			max-height: 200px;
			resize: none;
			overflow-y: auto;
			border-radius: var(--radius-s);
			padding: var(--size-2-2) var(--size-2-3);
			border: 1px solid var(--background-modifier-border);
			background: var(--background-primary);
			color: var(--text-normal);
			font-family: var(--font-interface);
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
		
		// Pass sidebar view reference when available
		if (this.sidebarView) {
			this.wikilinkAutocomplete.setSidebarView(this.sidebarView);
		}

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
			min-width: var(--size-4-9);
			height: var(--size-4-9);
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

			if (keyEvent.key === 'Enter' && !keyEvent.shiftKey) {
				event.preventDefault();
				(this.commandSystem?.handleCommandPickerSelection() || false) || this.handleSend();
			} else if (keyEvent.key === 'Escape') {
				this.commandSystem?.hideCommandPicker();
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

		// Input change handling for command picker
		this.addEventListener(this.textArea.inputEl, 'input', () => {
			if (this.commandSystem) {
				this.commandSystem.handleInputChange();
			}
		});

		// Setup drag and drop for file context
		this.setupDragAndDrop();
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

	private setupDragAndDrop(): void {
		const dropZone = this.textArea.inputEl;

		// Prevent default drag behaviors
		this.addEventListener(dropZone, 'dragenter', (e: Event) => {
			e.preventDefault();
			this.handleDragEnter();
		});

		this.addEventListener(dropZone, 'dragover', (e: Event) => {
			e.preventDefault();
			// Set drop effect to show it's allowed
			(e as DragEvent).dataTransfer!.dropEffect = 'copy';
		});

		this.addEventListener(dropZone, 'dragleave', (e: Event) => {
			// Only hide overlay if we're leaving the drop zone entirely
			if (e.target === dropZone) {
				this.handleDragLeave();
			}
		});

		this.addEventListener(dropZone, 'drop', (e: Event) => {
			e.preventDefault();
			this.handleDrop(e as DragEvent);
		});
	}

	private handleDragEnter(): void {
		if (this.isDragging) return;
		this.isDragging = true;

		// Create overlay for visual feedback
		if (!this.dropZoneOverlay) {
			this.dropZoneOverlay = document.createElement('div');
			this.dropZoneOverlay.className = 'nova-drop-zone-overlay';
			this.dropZoneOverlay.style.cssText = `
				position: absolute;
				top: 0;
				left: 0;
				right: 0;
				bottom: 0;
				background: var(--interactive-accent);
				opacity: 0;
				border: 2px dashed var(--interactive-accent);
				border-radius: var(--radius-s);
				display: flex;
				align-items: center;
				justify-content: center;
				pointer-events: none;
				transition: opacity 0.2s ease;
				z-index: 10;
			`;

			// Add icon container
			const iconContainer = document.createElement('div');
			iconContainer.style.cssText = `
				background: var(--background-primary);
				border-radius: 50%;
				width: 48px;
				height: 48px;
				display: flex;
				align-items: center;
				justify-content: center;
				box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
				opacity: 0;
				transform: scale(0.8);
				transition: all 0.2s ease;
			`;

			// Add Obsidian's plus icon
			const icon = document.createElement('div');
			icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
			icon.style.cssText = `
				color: var(--interactive-accent);
				display: flex;
				align-items: center;
				justify-content: center;
			`;

			iconContainer.appendChild(icon);
			this.dropZoneOverlay.appendChild(iconContainer);
		}

		// Position relative to textarea
		const textAreaContainer = this.textArea.inputEl.parentElement!;
		textAreaContainer.style.position = 'relative';
		textAreaContainer.appendChild(this.dropZoneOverlay);

		// Animate in
		setTimeout(() => {
			if (this.dropZoneOverlay) {
				this.dropZoneOverlay.style.opacity = '0.1';
				const icon = this.dropZoneOverlay.querySelector('div') as HTMLElement;
				if (icon) {
					icon.style.opacity = '1';
					icon.style.transform = 'scale(1)';
				}
			}
		}, 10);
	}

	private handleDragLeave(): void {
		this.isDragging = false;
		if (this.dropZoneOverlay) {
			this.dropZoneOverlay.style.opacity = '0';
			const icon = this.dropZoneOverlay.querySelector('div') as HTMLElement;
			if (icon) {
				icon.style.opacity = '0';
				icon.style.transform = 'scale(0.8)';
			}
			setTimeout(() => {
				this.dropZoneOverlay?.remove();
				this.dropZoneOverlay = null;
			}, 200);
		}
	}

	private handleDrop(e: DragEvent): void {
		this.handleDragLeave();

		const files: string[] = [];
		
		// Parse Obsidian's obsidian:// URLs - prefer text/plain as it has proper newlines
		const textPlainData = e.dataTransfer?.getData('text/plain');
		
		if (textPlainData && textPlainData.includes('obsidian://open?')) {
			// Handle multiple URLs separated by newlines
			const urls = textPlainData.split(/[\n\r]/).filter(line => line.trim().startsWith('obsidian://open?'));
			
			for (const urlString of urls) {
				try {
					const url = new URL(urlString.trim());
					const filePath = url.searchParams.get('file');
					
					if (filePath) {
						// Decode the URL-encoded path
						const decodedPath = decodeURIComponent(filePath);
						
						// Extract filename from path (handle both / and \ separators)
						const pathParts = decodedPath.split(/[/\\]/);
						const filename = pathParts[pathParts.length - 1];
						
						// Only process markdown files
						if (filename.endsWith('.md')) {
							const baseName = filename.replace('.md', '');
							if (baseName && !files.includes(baseName)) {
								files.push(baseName);
							}
						} else {
							// For files without .md extension, assume they're markdown notes
							// (Obsidian sometimes omits the .md extension in paths)
							if (filename && !files.includes(filename)) {
								files.push(filename);
							}
						}
					}
				} catch (error) {
					console.warn('Failed to parse Obsidian URL:', urlString, error);
				}
			}
		}

		// Add files to context if we got any
		if (files.length > 0) {
			this.addFilesToContext(files);
		} else if (textPlainData && textPlainData.includes('obsidian://open?')) {
			// User dropped something from Obsidian but no files were extracted
			// This likely means they dropped non-markdown files
			new Notice('Only markdown files can be added to context', 3000);
		} else if (textPlainData && textPlainData.trim() && !textPlainData.includes('://')) {
			// User dropped a folder (plain text path without protocol)
			new Notice('Folders cannot be added to context. Please select individual files.', 3000);
		}
	}

	private async addFilesToContext(filenames: string[]): Promise<void> {
		if (filenames.length === 0) return;

		// Add files to context
		if (this.sidebarView) {
			await this.sidebarView.addFilesToContext(filenames);
		}
	}


	refreshCommandButton(): void {
		if (this.commandSystem) {
			this.commandSystem.updateCommandButtonVisibility();
		}
	}

	updateContextState(hasContext: boolean): void {
		if (this.container) {
			if (hasContext) {
				this.container.classList.add('has-context');
			} else {
				this.container.classList.remove('has-context');
			}
		}
	}

	cleanup(): void {
		// Clean up wikilink autocomplete
		if (this.wikilinkAutocomplete) {
			this.wikilinkAutocomplete.destroy();
		}

		// Clean up drop zone overlay
		if (this.dropZoneOverlay) {
			this.dropZoneOverlay.remove();
			this.dropZoneOverlay = null;
		}

		// Clean up event listeners
		this.eventListeners.forEach(({ element, event, handler }) => {
			element.removeEventListener(event, handler);
		});
		this.eventListeners = [];
	}
}