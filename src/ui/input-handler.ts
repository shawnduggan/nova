/**
 * @file InputHandler - Handles text input and keyboard events
 */

import { ButtonComponent, TextAreaComponent, Notice, setIcon } from 'obsidian';
import NovaPlugin from '../../main';
import { NovaWikilinkAutocomplete } from './wikilink-suggest';
import { CommandSystem } from './command-system';
import { ContextManager } from './context-manager';
import { Logger } from '../utils/logger';
import { TimeoutManager } from '../utils/timeout-manager';

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
	private sidebarView: { addFilesToContext: (filenames: string[]) => Promise<void> } | null = null; // Reference to NovaSidebarView for context operations
	private timeoutManager = new TimeoutManager();
	private isProcessing = false;
	private onCancelOperation?: () => void;

	// Event cleanup is handled automatically by registerDomEvent

	constructor(
		plugin: NovaPlugin, 
		container: HTMLElement, 
		contextManager: ContextManager
	) {
		this.plugin = plugin;
		this.container = container;
		this.contextManager = contextManager;
	}

	setSidebarView(sidebarView: { addFilesToContext: (filenames: string[]) => Promise<void> }): void {
		this.sidebarView = sidebarView;
		// Also pass to wikilink autocomplete if it exists
		if (this.wikilinkAutocomplete) {
			this.wikilinkAutocomplete.setSidebarView(sidebarView);
		}
	}

	get sendButtonComponent(): ButtonComponent {
		return this.sendButton;
	}

	setCommandSystem(commandSystem: CommandSystem): void {
		this.commandSystem = commandSystem;

		// Create command picker
		this.commandSystem.createCommandPickerInContainer(this.inputRow);
	}

	getTextArea(): TextAreaComponent {
		return this.textArea;
	}

	createInputInterface(_chatContainer: HTMLElement): void {
		this.container = this.container.createDiv({ cls: 'nova-input-container nova-input-wrapper' });

		this.inputRow = this.container.createDiv({ cls: 'nova-input-row nova-input-flex-row' });

		// Textarea container
		const textAreaContainer = this.inputRow.createDiv({ cls: 'nova-textarea-container' });

		// Create textarea
		this.textArea = new TextAreaComponent(textAreaContainer);
		this.textArea.setPlaceholder('How can i help?');
		this.textArea.inputEl.addClass('nova-textarea-styled');

		// Auto-grow functionality
		this.autoGrowTextarea = () => {
			const textarea = this.textArea.inputEl;
			textarea.addClass('nova-textarea-auto');
			// Use data attribute for CSS-based height management
			const height = Math.min(textarea.scrollHeight, 200);
			textarea.setAttribute('data-height', height.toString());
		};

		// Add input event listener for auto-grow
		this.addEventListener(this.textArea.inputEl, 'input', this.autoGrowTextarea);

		// Trigger auto-grow on initial load
		this.timeoutManager.addTimeout(this.autoGrowTextarea, 0);

		// Initialize wikilink autocomplete with inputRow for consistent width
		this.wikilinkAutocomplete = new NovaWikilinkAutocomplete(this.plugin.app, this.plugin, this.textArea.inputEl, this.inputRow);
		
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
		this.sendButton.onClick(() => this.handleButtonClick());
		this.sendButton.buttonEl.addClass('nova-send-button-styled');

		// Enter key handling and command/section picker
		this.addEventListener(this.textArea.inputEl, 'keydown', (event: Event) => {
			const keyEvent = event as KeyboardEvent;

			if (keyEvent.key === 'Enter' && !keyEvent.shiftKey) {
				event.preventDefault();
				void ((this.commandSystem?.handleCommandPickerSelection() || false) || this.handleSend());
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
		this.timeoutManager.addTimeout(() => {
			if (this.textArea?.inputEl) {
				this.textArea.inputEl.focus();
			}
		}, InputHandler.FOCUS_DELAY_MS);
	}

	setProcessingState(processing: boolean): void {
		this.isProcessing = processing;
		if (processing) {
			this.sendButton.setIcon('square');
			this.sendButton.setTooltip('Stop response');
		} else {
			this.sendButton.setIcon('send');
			this.sendButton.setTooltip('Send message');
		}
		this.sendButton.setDisabled(false); // Always clickable
	}

	setOnCancelOperation(callback: () => void): void {
		this.onCancelOperation = callback;
	}

	private handleButtonClick(): void {
		if (this.isProcessing) {
			this.onCancelOperation?.();
		} else {
			this.handleSend();
		}
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
		this.timeoutManager.addTimeout(() => {
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
		this.timeoutManager.addTimeout(() => {
			textarea.setSelectionRange(cursorPosition, cursorPosition);
			textarea.focus();
		}, 0);

		this.autoGrowTextarea();
	}

	private addEventListener<K extends keyof HTMLElementEventMap>(element: EventTarget, event: K, handler: (this: HTMLElement, ev: HTMLElementEventMap[K]) => void): void {
		this.plugin.registerDomEvent(element as HTMLElement, event, handler);
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

			// Add icon container
			const iconContainer = document.createElement('div');
			iconContainer.className = 'nova-drop-icon-container';

			// Add Obsidian's plus icon using DOM API
			const icon = document.createElement('div');
			icon.className = 'nova-drop-icon-svg';
			
			// Use Obsidian's built-in plus icon
			setIcon(icon, 'plus');

			iconContainer.appendChild(icon);
			this.dropZoneOverlay.appendChild(iconContainer);
		}

		// Position relative to textarea
		const textAreaContainer = this.textArea.inputEl.parentElement!;
		// Position already set by CSS class
		textAreaContainer.appendChild(this.dropZoneOverlay);

		// Animate in
		this.timeoutManager.addTimeout(() => {
			if (this.dropZoneOverlay) {
				this.dropZoneOverlay.classList.add('active');
				const iconContainer = this.dropZoneOverlay.querySelector('.nova-drop-icon-container') as HTMLElement;
				if (iconContainer) {
					iconContainer.classList.add('active');
				}
			}
		}, 10);
	}

	private handleDragLeave(): void {
		this.isDragging = false;
		if (this.dropZoneOverlay) {
			this.dropZoneOverlay.classList.remove('active');
			const iconContainer = this.dropZoneOverlay.querySelector('.nova-drop-icon-container') as HTMLElement;
			if (iconContainer) {
				iconContainer.classList.remove('active');
			}
			this.timeoutManager.addTimeout(() => {
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
					Logger.warn('Failed to parse Obsidian URL:', urlString, error);
				}
			}
		}

		// Add files to context if we got any
		if (files.length > 0) {
			this.addFilesToContext(files).catch(error => {
				Logger.error('Failed to add files to context:', error);
			});
		} else if (textPlainData && textPlainData.includes('obsidian://open?')) {
			// User dropped something from Obsidian but no files were extracted
			// This likely means they dropped non-markdown files
			// eslint-disable-next-line obsidianmd/ui/sentence-case -- "Markdown" is a proper noun
			new Notice('Only Markdown files can be added to context', 3000);
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

		// Clean up timeouts
		this.timeoutManager.clearAll();
		
		// Event listeners are cleaned up automatically by registerDomEvent
	}
}