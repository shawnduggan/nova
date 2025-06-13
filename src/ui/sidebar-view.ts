import { ItemView, WorkspaceLeaf, ButtonComponent, TextAreaComponent, TFile, Notice, MarkdownView, Platform } from 'obsidian';
import NovaPlugin from '../../main';
import { EditCommand } from '../core/types';
import { NovaWikilinkAutocomplete } from './wikilink-suggest';
import { MultiDocContextHandler, MultiDocContext } from '../core/multi-doc-context';

export const VIEW_TYPE_NOVA_SIDEBAR = 'nova-sidebar';

export class NovaSidebarView extends ItemView {
	plugin: NovaPlugin;
	private chatContainer!: HTMLElement;
	private inputContainer!: HTMLElement;
	private textArea!: TextAreaComponent;
	private sendButton!: ButtonComponent;
	private commandButton!: ButtonComponent;
	private currentFile: TFile | null = null;
	private commandPicker!: HTMLElement;
	private commandPickerItems: HTMLElement[] = [];
	private selectedCommandIndex: number = -1;
	private commandMenu!: HTMLElement;
	private isCommandMenuVisible: boolean = false;
	private autoGrowTextarea!: () => void;
	private wikilinkAutocomplete!: NovaWikilinkAutocomplete;
	private contextPreview!: HTMLElement;
	private multiDocHandler!: MultiDocContextHandler;
	private contextIndicator!: HTMLElement;
	private currentContext: MultiDocContext | null = null;
	
	// Performance optimization - debouncing and timing constants
	private contextPreviewDebounceTimeout: NodeJS.Timeout | null = null;
	private static readonly CONTEXT_PREVIEW_DEBOUNCE_MS = 300;
	private static readonly SCROLL_DELAY_MS = 50;
	private static readonly FOCUS_DELAY_MS = 150;
	private static readonly HOVER_TIMEOUT_MS = 150;
	private static readonly NOTICE_DURATION_MS = 5000;
	
	// Event listener cleanup tracking
	private documentEventListeners: Array<{element: EventTarget, event: string, handler: EventListener}> = [];
	private timeouts: NodeJS.Timeout[] = [];

	constructor(leaf: WorkspaceLeaf, plugin: NovaPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.multiDocHandler = new MultiDocContextHandler(this.app);
	}

	getViewType() {
		return VIEW_TYPE_NOVA_SIDEBAR;
	}

	getDisplayText() {
		return 'Nova AI';
	}

	getIcon() {
		return 'nova-star';
	}

	async onOpen() {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.addClass('nova-sidebar-container');

		// Mobile access is now available to all users with their own API keys
		
		// Create wrapper with proper flex layout
		const wrapperEl = container.createDiv({ cls: 'nova-wrapper' });
		wrapperEl.style.cssText = `
			display: flex;
			flex-direction: column;
			height: 100%;
			overflow: hidden;
			padding-bottom: ${Platform.isDesktopApp ? 'var(--size-4-6)' : 'var(--size-4-5)'};
		`;
		
		// Header with provider info
		const headerEl = wrapperEl.createDiv({ cls: 'nova-header' });
		headerEl.style.cssText = `
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: var(--size-4-2);
			border-bottom: 1px solid var(--background-modifier-border);
			flex-shrink: 0;
		`;
		
		// Left side: Title with Nova icon
		const titleEl = headerEl.createEl('h4');
		titleEl.style.cssText = 'margin: 0; font-size: var(--font-ui-medium); display: flex; align-items: center; gap: var(--size-2-2);';
		titleEl.innerHTML = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: var(--icon-size); height: var(--icon-size);">
			<circle cx="12" cy="12" r="2.5" fill="currentColor"/>
			<path d="M12 1L12 6" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
			<path d="M12 18L12 23" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
			<path d="M23 12L18 12" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
			<path d="M6 12L1 12" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
			<path d="M18.364 5.636L15.536 8.464" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
			<path d="M8.464 15.536L5.636 18.364" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
			<path d="M18.364 18.364L15.536 15.536" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
			<path d="M8.464 8.464L5.636 5.636" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
		</svg>Nova`;
		
		// Right side: Provider status and Clear button
		const rightContainer = headerEl.createDiv();
		rightContainer.style.cssText = 'display: flex; align-items: center; gap: var(--size-2-3);';
		
		// All users can switch providers freely
		this.createProviderDropdown(rightContainer);
		
		// Clear Chat button in right container
		const clearButton = new ButtonComponent(rightContainer);
		clearButton.setIcon('eraser')
			.setTooltip('Clear conversation history')
			.onClick(() => this.clearChat());

		this.createChatInterface(wrapperEl);
		this.createInputInterface(wrapperEl);
		
		// Register event listener for active file changes
		this.registerEvent(
			this.app.workspace.on('active-leaf-change', () => {
				this.loadConversationForActiveFile();
			})
		);
		
		// Load conversation for current file
		this.loadConversationForActiveFile();
		
		// Initial status refresh to ensure all indicators are up to date
		setTimeout(() => this.refreshProviderStatus(), 100);
		
		// Auto-focus input for immediate typing
		setTimeout(() => {
			if (this.textArea?.inputEl) {
				this.textArea.inputEl.focus();
			}
		}, NovaSidebarView.FOCUS_DELAY_MS);
	}

	async onClose() {
		// Clean up provider dropdown event listener
		if ((this as any).currentProviderDropdown?.cleanup) {
			(this as any).currentProviderDropdown.cleanup();
		}
		
		// Clean up wikilink autocomplete
		if (this.wikilinkAutocomplete) {
			this.wikilinkAutocomplete.destroy();
		}
		
		// Clear debounce timeout
		if (this.contextPreviewDebounceTimeout) {
			clearTimeout(this.contextPreviewDebounceTimeout);
			this.contextPreviewDebounceTimeout = null;
		}
		
		// Clean up tracked event listeners
		this.cleanupEventListeners();
		
		// Clear all timeouts
		this.clearTimeouts();
		
		// Clean up DOM elements
		this.cleanupDOMElements();
	}
	
	/**
	 * Add event listener with automatic cleanup tracking
	 */
	private addTrackedEventListener(element: EventTarget, event: string, handler: EventListener): void {
		element.addEventListener(event, handler);
		this.documentEventListeners.push({ element, event, handler });
	}
	
	/**
	 * Add timeout with automatic cleanup tracking
	 */
	private addTrackedTimeout(callback: () => void, delay: number): NodeJS.Timeout {
		const id = setTimeout(() => {
			callback();
			this.timeouts = this.timeouts.filter(t => t !== id);
		}, delay);
		this.timeouts.push(id);
		return id;
	}
	
	/**
	 * Clean up all tracked event listeners
	 */
	private cleanupEventListeners(): void {
		this.documentEventListeners.forEach(({ element, event, handler }) => {
			element.removeEventListener(event, handler);
		});
		this.documentEventListeners = [];
	}
	
	/**
	 * Clear all tracked timeouts
	 */
	private clearTimeouts(): void {
		this.timeouts.forEach(id => clearTimeout(id));
		this.timeouts = [];
	}
	
	/**
	 * Clean up DOM elements
	 */
	private cleanupDOMElements(): void {
		this.commandPickerItems = [];
		if (this.contextIndicator) {
			this.contextIndicator.remove();
		}
		if (this.commandPicker) {
			this.commandPicker.empty();
		}
		if (this.commandMenu) {
			this.commandMenu.remove();
		}
	}

	private createChatInterface(container: HTMLElement) {
		this.chatContainer = container.createDiv({ cls: 'nova-chat-container' });
		this.chatContainer.style.cssText = `
			flex: 1;
			overflow-y: auto;
			padding: var(--size-4-2);
			background: var(--background-secondary);
			display: flex;
			flex-direction: column;
			gap: var(--size-2-3);
		`;

		// Welcome message with Nova branding
		this.addWelcomeMessage();
	}

	private createInputInterface(container: HTMLElement) {
		this.inputContainer = container.createDiv({ cls: 'nova-input-container' });
		this.createInputArea();
	}

	/**
	 * Create the input area UI elements
	 */
	private createInputArea() {
		// Clear existing input area content
		this.inputContainer.empty();
		
		this.inputContainer.style.cssText = `
			display: flex;
			flex-direction: column;
			gap: var(--size-2-3);
			padding: var(--size-4-2);
			border-top: 1px solid var(--background-modifier-border);
			flex-shrink: 0;
			position: relative;
		`;

		// Simplified input row with just textarea and send button
		const inputRow = this.inputContainer.createDiv({ cls: 'nova-input-row' });
		inputRow.style.cssText = `
			display: flex;
			align-items: center;
			gap: var(--size-2-3);
		`;

		// Text area takes most space
		const textAreaContainer = inputRow.createDiv();
		textAreaContainer.style.cssText = 'flex: 1; position: relative;';
		this.textArea = new TextAreaComponent(textAreaContainer);
		this.textArea.setPlaceholder('How can I help?');
		
		// Platform-aware defaults and auto-growing setup
		const lineHeight = 1.5; // em units
		const paddingVertical = 20; // px (10px top + 10px bottom)
		const borderWidth = 2; // px (1px top + 1px bottom)
		const baseLines = Platform.isMobile ? 2 : 3;
		const maxLines = Platform.isMobile ? 8 : 6;
		
		// Calculate initial height based on platform
		const fontSize = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--font-text-size') || '14px');
		const initialHeight = (baseLines * lineHeight * fontSize) + paddingVertical + borderWidth;
		
		this.textArea.inputEl.style.cssText = `
			width: 100%;
			min-height: ${initialHeight}px;
			max-height: ${(maxLines * lineHeight * fontSize) + paddingVertical + borderWidth}px;
			height: ${initialHeight}px;
			resize: none;
			border: 1px solid var(--background-modifier-border);
			border-radius: var(--input-radius);
			padding: var(--size-4-2);
			font-size: var(--font-text-size);
			line-height: ${lineHeight};
			overflow-y: hidden;
			transition: height 0.1s ease-out;
		`;
		
		// Auto-grow functionality
		this.autoGrowTextarea = () => {
			const el = this.textArea.inputEl;
			
			// Reset height to auto to get the correct scrollHeight
			el.style.height = 'auto';
			
			// Calculate new height based on content
			const contentHeight = el.scrollHeight;
			const minHeight = initialHeight;
			const maxHeight = (maxLines * lineHeight * fontSize) + paddingVertical + borderWidth;
			
			// Clamp height between min and max
			const newHeight = Math.max(minHeight, Math.min(contentHeight, maxHeight));
			
			// Apply new height
			el.style.height = `${newHeight}px`;
			
			// Show scrollbar only when content exceeds max height
			el.style.overflowY = contentHeight > maxHeight ? 'auto' : 'hidden';
		};
		
		// Add input event listener for auto-grow
		this.textArea.inputEl.addEventListener('input', this.autoGrowTextarea);
		
		// Also trigger on initial load and when value changes programmatically
		setTimeout(this.autoGrowTextarea, 0);
		
		// Initialize wikilink autocomplete
		this.wikilinkAutocomplete = new NovaWikilinkAutocomplete(this.app, this.textArea.inputEl);
		
		// Add debounced context preview
		this.textArea.inputEl.addEventListener('input', () => {
			this.debouncedUpdateContextPreview();
		});

		// Command button (lightning) - conditionally shown
		this.commandButton = new ButtonComponent(inputRow);
		this.commandButton.setIcon('zap');
		this.commandButton.setTooltip('Commands');
		this.commandButton.onClick(() => this.toggleCommandMenu());
		this.commandButton.buttonEl.style.cssText = `
			min-width: var(--input-height);
			height: var(--input-height);
			border-radius: 50%;
			display: ${this.shouldShowCommandButton() ? 'flex' : 'none'};
			align-items: center;
			justify-content: center;
			padding: 0;
			flex-shrink: 0;
			margin-right: var(--size-2-3);
		`;

		// Send button vertically centered
		this.sendButton = new ButtonComponent(inputRow);
		this.sendButton.setIcon('send');
		this.sendButton.setTooltip('Send message');
		this.sendButton.setCta();
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
		`;

		// Enter key handling and command picker
		this.textArea.inputEl.addEventListener('keydown', (event) => {
			if (event.key === 'Enter' && !event.shiftKey) {
				event.preventDefault();
				this.handleCommandPickerSelection() || this.handleSend();
			} else if (event.key === 'Escape') {
				this.hideCommandPicker();
			} else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
				if (this.isCommandPickerVisible()) {
					event.preventDefault();
					this.navigateCommandPicker(event.key === 'ArrowDown' ? 1 : -1);
				}
			}
		});

		// Input change handling for command picker (already has autoGrow listener)
		this.textArea.inputEl.addEventListener('input', () => {
			this.handleInputChange();
		});

		// Create command picker
		this.createCommandPicker();

		// Create command menu
		this.createCommandMenu();

		// Create context indicator and preview
		this.createContextIndicator();
		this.contextPreview = this.createContextPreview();
	}

	private addMessage(role: 'user' | 'assistant' | 'system', content: string) {
		const messageEl = this.chatContainer.createDiv({ cls: `nova-message nova-message-${role}` });
		messageEl.style.cssText = `
			margin-bottom: var(--size-4-2);
			padding: var(--size-2-3) var(--size-4-3);
			border-radius: var(--radius-s);
			max-width: 85%;
			${role === 'user' 
				? 'margin-left: auto; background: var(--interactive-accent); color: var(--text-on-accent);' 
				: role === 'system'
				? 'margin: 0 auto; background: var(--background-modifier-hover); color: var(--text-muted); text-align: center; font-size: var(--font-ui-small);'
				: 'background: var(--background-primary); border: 1px solid var(--background-modifier-border);'
			}
		`;

		const roleEl = messageEl.createEl('div', { 
			text: role === 'user' ? 'You' : role === 'system' ? 'System' : 'Nova',
			cls: 'nova-message-role'
		});
		roleEl.style.cssText = `
			font-size: var(--font-ui-smaller);
			opacity: 0.7;
			margin-bottom: var(--size-2-1);
			font-weight: 600;
		`;

		const contentEl = messageEl.createEl('div', { cls: 'nova-message-content' });
		// Use innerHTML for system messages to support icons, textContent for others for security
		if (role === 'system' && content.includes('<svg')) {
			contentEl.innerHTML = content;
		} else {
			contentEl.textContent = content;
		}

		// Auto-scroll to bottom with smooth animation
		setTimeout(() => {
			this.chatContainer.scrollTo({
				top: this.chatContainer.scrollHeight,
				behavior: 'smooth'
			});
		}, NovaSidebarView.SCROLL_DELAY_MS);
	}

	/**
	 * Helper method to create simple messages without role headers
	 */
	private createSimpleMessage(content: string, className: string): void {
		const messageEl = this.chatContainer.createDiv({ cls: `nova-message ${className}` });
		const contentEl = messageEl.createEl('div', { cls: 'nova-message-content' });
		
		// Support icons in messages
		if (content.includes('<svg')) {
			contentEl.innerHTML = content;
		} else {
			contentEl.textContent = content;
		}

		// Auto-scroll to bottom
		setTimeout(() => {
			this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
		}, NovaSidebarView.SCROLL_DELAY_MS);
	}

	private addErrorMessage(content: string) {
		this.createSimpleMessage(content, 'nova-message-error');
	}

	private addSuccessMessage(content: string) {
		this.createSimpleMessage(content, 'nova-message-success');
	}

	private addWelcomeMessage(message?: string) {
		const welcomeEl = this.chatContainer.createDiv({ cls: 'nova-welcome' });
		welcomeEl.style.cssText = `
			display: flex;
			align-items: center;
			gap: var(--size-4-3);
			margin: var(--size-4-4) auto;
			padding: var(--size-4-4) var(--size-4-5);
			background: var(--background-primary);
			border: 1px solid var(--background-modifier-border);
			border-radius: var(--radius-l);
			max-width: 90%;
			animation: fadeIn 0.5s ease-in;
		`;
		
		// Nova star icon (static, not animated)
		const iconContainer = welcomeEl.createDiv({ cls: 'nova-welcome-icon' });
		iconContainer.style.cssText = `
			position: relative;
			width: var(--icon-size-xl);
			height: var(--icon-size-xl);
			flex-shrink: 0;
		`;
		
		iconContainer.innerHTML = `
			<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: var(--icon-size-xl); height: var(--icon-size-xl); color: var(--interactive-accent);">
				<circle cx="12" cy="12" r="2.5" fill="currentColor"/>
				<path d="M12 1L12 6" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
				<path d="M12 18L12 23" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
				<path d="M23 12L18 12" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
				<path d="M6 12L1 12" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
				<path d="M18.364 5.636L15.536 8.464" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
				<path d="M8.464 15.536L5.636 18.364" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
				<path d="M18.364 18.364L15.536 15.536" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
				<path d="M8.464 8.464L5.636 5.636" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
			</svg>
		`;
		
		// Welcome text
		const textContainer = welcomeEl.createDiv();
		textContainer.style.cssText = `
			flex: 1;
			line-height: 1.4;
		`;
		
		const titleEl = textContainer.createDiv({ text: 'Hi! I\'m Nova.' });
		titleEl.style.cssText = `
			font-weight: 600;
			color: var(--text-normal);
			margin-bottom: 4px;
			font-size: var(--font-text-size);
		`;
		
		const subtitleEl = textContainer.createDiv({ text: message || '' });
		subtitleEl.style.cssText = `
			color: var(--text-muted);
			font-size: 0.9em;
		`;

		// Auto-scroll to bottom
		setTimeout(() => {
			this.chatContainer.scrollTo({
				top: this.chatContainer.scrollHeight,
				behavior: 'smooth'
			});
		}, NovaSidebarView.SCROLL_DELAY_MS);
	}

	private addSuccessIndicator(action: string) {
		const indicatorEl = this.chatContainer.createDiv({ cls: 'nova-success-indicator' });
		indicatorEl.style.cssText = `
			display: flex;
			align-items: center;
			justify-content: center;
			margin: 8px auto;
			padding: 6px 12px;
			background: rgba(76, 175, 80, 0.1);
			border: 1px solid rgba(76, 175, 80, 0.3);
			border-radius: 16px;
			font-size: 0.8em;
			color: var(--text-muted);
			max-width: 200px;
			animation: fadeIn 0.3s ease-in;
		`;
		
		// Add checkmark and text
		indicatorEl.innerHTML = `
			<div style="width: 12px; height: 12px; margin-right: 6px; border-radius: 50%; background: var(--text-success); display: flex; align-items: center; justify-content: center;">
				<div style="width: 4px; height: 2px; border-left: 1px solid white; border-bottom: 1px solid white; transform: rotate(-45deg) translate(-0.5px, -0.5px);"></div>
			</div>
			${this.getCompactSuccessMessage(action)}
		`;

		// Auto-scroll to bottom
		setTimeout(() => {
			this.chatContainer.scrollTo({
				top: this.chatContainer.scrollHeight,
				behavior: 'smooth'
			});
		}, NovaSidebarView.SCROLL_DELAY_MS);
	}

	private getCompactSuccessMessage(action: string): string {
		switch (action) {
			case 'add':
				return 'Content added';
			case 'edit':
				return 'Content edited';
			case 'delete':
				return 'Content deleted';
			case 'grammar':
				return 'Grammar fixed';
			case 'rewrite':
				return 'Content rewritten';
			default:
				return 'Command completed';
		}
	}

	private async handleColonCommand(message: string): Promise<boolean> {
		// Check if command system feature is enabled
		if (!this.plugin.featureManager.isFeatureEnabled('command-system')) {
			this.addMessage('system', this.createIconMessage('zap', 'Command system is currently in early access for Supernova supporters. Available to all users September 15, 2025.'));
			return true;
		}

		const command = message.slice(1).toLowerCase(); // Remove ':' and normalize

		// Provider switching commands
		const providerCommands: Record<string, string> = {
			'claude': 'claude',
			'chatgpt': 'openai',
			'openai': 'openai',
			'gemini': 'google',
			'google': 'google',
			'ollama': 'ollama'
		};

		if (providerCommands[command]) {
			const providerId = providerCommands[command];
			await this.plugin.settingTab.setCurrentProvider(providerId);
			await this.plugin.saveSettings();
			this.addSuccessMessage(this.createIconMessage('refresh-cw', `Switched to ${this.getProviderWithModelDisplayName(providerId)}`));
			return true;
		}

		// Check for custom commands (if feature enabled)
		if (this.plugin.featureManager.isFeatureEnabled('custom-commands')) {
			const customCommand = this.plugin.settings.customCommands?.find(cmd => cmd.trigger === command);
			if (customCommand) {
				// Execute custom command
				this.textArea.setValue(customCommand.template);
				// Trigger auto-grow after setting template
				setTimeout(() => this.autoGrowTextarea(), 0);
				this.addMessage('system', this.createIconMessage('edit', `Loaded template: ${customCommand.name}`));
				return true;
			}
		}

		// Unknown command
		this.addErrorMessage(this.createIconMessage('help-circle', `Unknown command ':${command}'. Try :claude, :chatgpt, :gemini, or :ollama`));
		return true;
	}

	private createCommandPicker(): void {
		this.commandPicker = this.inputContainer.createDiv({ cls: 'nova-command-picker nova-panel-base' });
		this.commandPicker.style.cssText = `
			position: absolute;
			bottom: 100%;
			left: 0;
			right: 0;
			border-bottom: none;
			border-radius: 8px 8px 0 0;
			max-height: 200px;
			overflow-y: auto;
			z-index: 1000;
			display: none;
			box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.1);
		`;
	}

	private handleInputChange(): void {
		const value = this.textArea.getValue();
		
		if (value.startsWith(':') && this.plugin.featureManager.isFeatureEnabled('command-system')) {
			const query = value.slice(1).toLowerCase();
			this.showCommandPicker(query);
		} else {
			this.hideCommandPicker();
		}
	}

	private showCommandPicker(query: string): void {
		const commands = this.getAvailableCommands().filter(cmd => 
			cmd.trigger.toLowerCase().includes(query) || cmd.name.toLowerCase().includes(query)
		);

		this.commandPicker.empty();
		this.commandPickerItems = [];
		this.selectedCommandIndex = -1;

		if (commands.length === 0) {
			this.hideCommandPicker();
			return;
		}

		commands.forEach((command, index) => {
			const item = this.commandPicker.createDiv({ cls: 'nova-command-item nova-panel-item' });

			const triggerEl = item.createSpan({ cls: 'nova-command-trigger nova-panel-trigger' });
			triggerEl.textContent = `:${command.trigger}`;

			const nameEl = item.createSpan({ cls: 'nova-command-name nova-panel-text' });
			nameEl.textContent = command.name;
			nameEl.style.cssText = 'flex: 1;';

			if (command.description) {
				const descEl = item.createSpan({ cls: 'nova-command-desc nova-panel-muted' });
				descEl.textContent = command.description;
			}

			item.addEventListener('click', () => {
				this.selectCommand(command.trigger);
			});

			item.addEventListener('mouseenter', () => {
				this.setSelectedCommand(index);
			});

			this.commandPickerItems.push(item);
		});

		this.commandPicker.style.display = 'block';
	}

	private hideCommandPicker(): void {
		this.commandPicker.style.display = 'none';
		this.selectedCommandIndex = -1;
	}

	private isCommandPickerVisible(): boolean {
		return this.commandPicker.style.display === 'block';
	}

	private navigateCommandPicker(direction: number): void {
		if (this.commandPickerItems.length === 0) return;

		const newIndex = Math.max(0, Math.min(
			this.commandPickerItems.length - 1,
			this.selectedCommandIndex + direction
		));

		this.setSelectedCommand(newIndex);
	}

	private setSelectedCommand(index: number): void {
		// Remove previous selection
		this.commandPickerItems.forEach(item => {
			item.removeClass('selected');
		});

		this.selectedCommandIndex = index;

		if (index >= 0 && index < this.commandPickerItems.length) {
			this.commandPickerItems[index].addClass('selected');
			this.commandPickerItems[index].scrollIntoView({ block: 'nearest' });
		}
	}

	private handleCommandPickerSelection(): boolean {
		if (!this.isCommandPickerVisible() || this.selectedCommandIndex === -1) {
			return false;
		}

		const commands = this.getAvailableCommands();
		const selectedCommand = commands[this.selectedCommandIndex];
		
		if (selectedCommand) {
			this.selectCommand(selectedCommand.trigger);
			return true;
		}

		return false;
	}

	private selectCommand(trigger: string): void {
		this.textArea.setValue(`:${trigger}`);
		this.hideCommandPicker();
		// Trigger the command immediately
		this.handleSend();
	}

	private getAvailableCommands(): Array<{trigger: string, name: string, description?: string}> {
		const commands: Array<{trigger: string, name: string, description?: string}> = [
			{ trigger: 'claude', name: 'Switch to Claude', description: 'Anthropic Claude AI' },
			{ trigger: 'chatgpt', name: 'Switch to ChatGPT', description: 'OpenAI GPT models' },
			{ trigger: 'gemini', name: 'Switch to Gemini', description: 'Google Gemini AI' },
			{ trigger: 'ollama', name: 'Switch to Ollama', description: 'Local AI models' }
		];

		// Add custom commands if feature is enabled
		if (this.plugin.featureManager.isFeatureEnabled('custom-commands')) {
			const customCommands = this.plugin.settings.customCommands || [];
			customCommands.forEach(cmd => {
				commands.push({
					trigger: cmd.trigger,
					name: cmd.name,
					...(cmd.description && { description: cmd.description })
				});
			});
		}

		return commands;
	}

	private createCommandMenu(): void {
		this.commandMenu = this.inputContainer.createDiv({ cls: 'nova-command-menu nova-panel-base' });
		this.commandMenu.style.cssText = `
			position: absolute;
			bottom: 100%;
			right: 0;
			border-bottom: none;
			border-radius: 8px 8px 0 0;
			min-width: 240px;
			max-height: 300px;
			overflow-y: auto;
			z-index: 1000;
			display: none;
			box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.1);
		`;

		// Close menu when clicking outside
		const commandMenuClickHandler: EventListener = (event: Event) => {
			if (!this.commandMenu.contains(event.target as Node) && 
				!this.commandButton.buttonEl.contains(event.target as Node)) {
				this.hideCommandMenu();
			}
		};
		this.addTrackedEventListener(document, 'click', commandMenuClickHandler);
	}

	private toggleCommandMenu(): void {
		if (!this.plugin.featureManager.isFeatureEnabled('command-button')) {
			this.addMessage('system', this.createIconMessage('zap', 'Command button is currently in early access for Supernova supporters. Available to all users August 15, 2025.'));
			return;
		}

		if (this.isCommandMenuVisible) {
			this.hideCommandMenu();
		} else {
			this.showCommandMenu();
		}
	}

	private showCommandMenu(): void {
		const commands = this.getAvailableCommands();
		
		this.commandMenu.empty();
		
		// Header
		const headerEl = this.commandMenu.createDiv({ cls: 'nova-command-menu-header nova-panel-header' });
		headerEl.innerHTML = this.createInlineIcon('zap') + ' Commands';

		// Commands list
		commands.forEach(command => {
			const item = this.commandMenu.createDiv({ cls: 'nova-command-menu-item nova-panel-item-vertical' });

			const nameEl = item.createDiv({ cls: 'nova-command-menu-name nova-panel-text' });
			nameEl.textContent = command.name;

			const triggerEl = item.createDiv({ cls: 'nova-command-menu-trigger nova-panel-trigger' });
			triggerEl.textContent = `:${command.trigger}`;
			triggerEl.style.opacity = '0.8';

			if (command.description) {
				const descEl = item.createDiv({ cls: 'nova-command-menu-desc nova-panel-muted' });
				descEl.textContent = command.description;
			}

			item.addEventListener('click', () => {
				this.executeCommandFromMenu(command.trigger);
			});
		});

		this.commandMenu.style.display = 'block';
		this.isCommandMenuVisible = true;
	}

	private hideCommandMenu(): void {
		this.commandMenu.style.display = 'none';
		this.isCommandMenuVisible = false;
	}

	private executeCommandFromMenu(trigger: string): void {
		this.hideCommandMenu();
		
		// Execute the command directly
		this.textArea.setValue(`:${trigger}`);
		this.handleSend();
	}

	private createContextIndicator(): void {
		// Check if multi-doc context feature is enabled
		if (!this.plugin.featureManager.isFeatureEnabled('multi-doc-context')) {
			return;
		}

		this.contextIndicator = this.inputContainer.createDiv({ cls: 'nova-context-indicator' });
		this.contextIndicator.style.cssText = `
			display: none;
			padding: 8px 12px;
			margin-bottom: 8px;
			background: var(--background-modifier-hover);
			border: 1px solid var(--background-modifier-border);
			border-radius: 8px;
			font-size: 0.85em;
			color: var(--text-muted);
			transition: all 0.2s ease;
		`;
	}

	private createContextPreview(): HTMLElement {
		// Check if multi-doc context feature is enabled
		if (!this.plugin.featureManager.isFeatureEnabled('multi-doc-context')) {
			// Return a dummy element that won't be used
			return document.createElement('div');
		}

		// Create a preview area that shows live context as user types
		const previewContainer = this.inputContainer.createDiv({ cls: 'nova-context-preview' });
		previewContainer.style.cssText = `
			display: none;
			padding: 8px 12px;
			margin-bottom: 4px;
			background: rgba(var(--interactive-accent-rgb), 0.1);
			border: 1px solid rgba(var(--interactive-accent-rgb), 0.2);
			border-radius: 6px;
			font-size: 0.8em;
			color: var(--text-muted);
			transition: all 0.2s ease;
			align-items: center;
			gap: 4px;
		`;

		const previewText = previewContainer.createSpan({ cls: 'nova-context-preview-text' });
		previewText.innerHTML = this.createInlineIcon('book-open') + ' Context will include: ';
		previewText.style.cssText = 'font-weight: 500; display: flex; align-items: center; gap: 6px;';

		const previewList = previewContainer.createSpan({ cls: 'nova-context-preview-list' });
		previewList.style.cssText = 'color: var(--interactive-accent);';

		return previewContainer;
	}

	/**
	 * Debounced version of updateLiveContextPreview for performance
	 */
	private debouncedUpdateContextPreview(): void {
		if (this.contextPreviewDebounceTimeout) {
			clearTimeout(this.contextPreviewDebounceTimeout);
		}
		
		this.contextPreviewDebounceTimeout = setTimeout(() => {
			this.updateLiveContextPreview();
			this.contextPreviewDebounceTimeout = null;
		}, NovaSidebarView.CONTEXT_PREVIEW_DEBOUNCE_MS);
	}

	private updateLiveContextPreview(): void {
		if (!this.contextPreview || !this.plugin.featureManager.isFeatureEnabled('multi-doc-context')) {
			return;
		}

		const message = this.textArea.getValue();
		if (!message) {
			this.contextPreview.style.display = 'none';
			return;
		}

		// Parse document references from current message
		// Note: All references are now persistent for simplified UX
		const refPattern = /(\+)?\[\[([^\]]+?)(?:#([^\]]+?))?\]\]/g;
		const foundRefs: Array<{name: string, property?: string}> = [];
		let match;

		while ((match = refPattern.exec(message)) !== null) {
			const docName = match[2];
			const property = match[3];
			
			// Try to find the file to validate it exists
			const file = this.findFileByName(docName);
			if (file) {
				foundRefs.push({
					name: docName,
					property
				});
			}
		}

		// Add existing persistent context for current file
		const persistentDocs = this.multiDocHandler.getPersistentContext(this.currentFile?.path || '');
		persistentDocs.forEach(doc => {
			// Only add if not already in foundRefs to avoid duplicates
			const exists = foundRefs.some(ref => ref.name === doc.file.basename);
			if (!exists) {
				foundRefs.push({
					name: doc.file.basename,
					property: doc.property
				});
			}
		});

		// Update preview
		if (foundRefs.length > 0) {
			const previewList = this.contextPreview.querySelector('.nova-context-preview-list') as HTMLElement;
			if (previewList) {
				const docNames = foundRefs.map(ref => {
					const suffix = ref.property ? `#${ref.property}` : '';
					return `${ref.name}${suffix}`;
				});
				previewList.textContent = docNames.join(', ');
			}
			this.contextPreview.style.display = 'block';
		} else {
			this.contextPreview.style.display = 'none';
		}
	}

	private findFileByName(nameOrPath: string): TFile | null {
		// First try exact path match
		let file = this.app.vault.getAbstractFileByPath(nameOrPath);
		
		if (!file || !(file instanceof TFile)) {
			// Try with .md extension
			file = this.app.vault.getAbstractFileByPath(nameOrPath + '.md');
		}
		
		if (!file || !(file instanceof TFile)) {
			// Search by basename
			const files = this.app.vault.getMarkdownFiles();
			file = files.find(f => 
				f.basename === nameOrPath || 
				f.name === nameOrPath ||
				f.path.endsWith('/' + nameOrPath) ||
				f.path.endsWith('/' + nameOrPath + '.md')
			) || null;
		}
		
		return file instanceof TFile ? file : null;
	}

	private updateContextIndicator(): void {
		if (!this.contextIndicator) {
			return;
		}

		this.contextIndicator.empty();
		
		if (!this.currentContext) {
			this.contextIndicator.style.display = 'none';
			return;
		}
		
		const allDocs = this.currentContext.persistentDocs;
		
		if (allDocs.length === 0) {
			this.contextIndicator.style.display = 'none';
			return;
		}

		// Show as thin line with mobile-optimized sizing
		const isMobile = Platform.isMobile;
		this.contextIndicator.style.cssText = `
			display: block;
			position: relative;
			padding: ${isMobile ? '12px 16px' : '8px 12px'};
			margin-bottom: 4px;
			background: rgba(var(--interactive-accent-rgb), 0.1);
			border: 1px solid rgba(var(--interactive-accent-rgb), 0.2);
			border-radius: 6px;
			font-size: ${isMobile ? '0.9em' : '0.8em'};
			color: var(--text-muted);
			transition: all 0.2s ease;
			cursor: pointer;
			min-height: ${isMobile ? '44px' : 'auto'};
		`;
		// Single line summary (same style as live preview)
		const summaryEl = this.contextIndicator.createDiv({ cls: 'nova-context-summary' });
		summaryEl.style.cssText = `
			display: flex;
			align-items: center;
			justify-content: space-between;
			width: 100%;
			cursor: pointer;
			pointer-events: auto;
		`;
		
		const summaryTextEl = summaryEl.createSpan({ cls: 'nova-context-summary-text' });
		
		const tokenPercent = Math.round((this.currentContext.tokenCount / 8000) * 100);
		const docNames = allDocs.map(doc => doc.file.basename).slice(0, isMobile ? 1 : 2);
		const moreCount = allDocs.length > (isMobile ? 1 : 2) ? ` +${allDocs.length - (isMobile ? 1 : 2)}` : '';
		
		// Mobile-optimized text (shorter on mobile) with proper flex alignment
		summaryTextEl.style.cssText = 'font-weight: 500; color: var(--text-muted); flex: 1; pointer-events: none; display: flex; align-items: center; gap: 6px;';
		
		if (isMobile) {
			summaryTextEl.innerHTML = this.createInlineIcon('book-open') + ` ${docNames.join(', ')}${moreCount} (${tokenPercent}%)`;
		} else {
			summaryTextEl.innerHTML = this.createInlineIcon('book-open') + ` ${docNames.join(', ')}${moreCount} (${tokenPercent}% tokens)`;
		}
		
		// Mobile-friendly more menu indicator
		const expandIndicatorEl = summaryEl.createSpan({ cls: 'nova-context-expand-indicator' });
		expandIndicatorEl.innerHTML = this.createInlineIcon('more-horizontal', isMobile ? '16px' : '14px'); // More menu indicator
		expandIndicatorEl.style.cssText = `
			color: var(--interactive-accent);
			font-size: ${isMobile ? '16px' : '14px'};
			opacity: 0.8;
			padding: ${isMobile ? '8px' : '4px'};
			min-width: ${isMobile ? '44px' : 'auto'};
			text-align: center;
			border-radius: 4px;
			transition: all 0.2s;
			pointer-events: none;
		`;
		expandIndicatorEl.setAttr('title', 'Tap to manage documents');
		
		// Visual feedback on the whole summary line instead of just the indicator
		if (isMobile) {
			summaryEl.addEventListener('touchstart', () => {
				expandIndicatorEl.style.background = 'rgba(var(--interactive-accent-rgb), 0.2)';
			});
			summaryEl.addEventListener('touchend', () => {
				this.addTrackedTimeout(() => {
					expandIndicatorEl.style.background = 'none';
				}, NovaSidebarView.HOVER_TIMEOUT_MS);
			});
		} else {
			summaryEl.addEventListener('mouseenter', () => {
				expandIndicatorEl.style.background = 'rgba(var(--interactive-accent-rgb), 0.2)';
			});
			summaryEl.addEventListener('mouseleave', () => {
				expandIndicatorEl.style.background = 'none';
			});
		}

		// Expanded state - mobile-responsive overlay
		const expandedEl = this.contextIndicator.createDiv({ cls: 'nova-context-expanded' });
		expandedEl.style.cssText = `
			display: none;
			position: absolute;
			bottom: 100%;
			left: ${isMobile ? '-8px' : '0'};
			right: ${isMobile ? '-8px' : '0'};
			background: var(--background-primary);
			border: 1px solid rgba(var(--interactive-accent-rgb), 0.2);
			border-radius: 6px;
			box-shadow: 0 ${isMobile ? '-4px 16px' : '-2px 8px'} rgba(0, 0, 0, ${isMobile ? '0.15' : '0.1'});
			z-index: 1000;
			margin-bottom: 2px;
			max-height: ${isMobile ? '60vh' : '200px'};
			overflow-y: auto;
			min-width: ${isMobile ? '100%' : 'auto'};
		`;
		
		// Header for expanded state with mobile-optimized clear button
		const expandedHeaderEl = expandedEl.createDiv({ cls: 'nova-context-expanded-header' });
		expandedHeaderEl.style.cssText = `
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: ${isMobile ? '12px 16px' : '8px 12px'};
			border-bottom: 1px solid var(--background-modifier-border);
			font-weight: 500;
			color: var(--text-normal);
			font-size: 1em;
			min-height: ${isMobile ? '44px' : 'auto'};
		`;
		
		const headerTitleEl = expandedHeaderEl.createSpan();
		headerTitleEl.innerHTML = this.createInlineIcon('book-open') + ` Documents (${allDocs.length})`;
		headerTitleEl.style.cssText = 'display: flex; align-items: center; gap: 6px;';
		
		// Clear all button using same icon as main sidebar
		const clearAllBtnComponent = new ButtonComponent(expandedHeaderEl);
		clearAllBtnComponent.setIcon('eraser')
			.setTooltip('Clear all documents from context')
			.onClick(async () => {
				if (this.currentFile) {
					this.multiDocHandler.clearPersistentContext(this.currentFile.path);
					await this.refreshContext();
				}
			});
		
		const clearAllBtn = clearAllBtnComponent.buttonEl;
		clearAllBtn.addClass('nova-context-clear-all-btn');
		clearAllBtn.style.cssText = `
			background: none;
			border: 1px solid var(--text-faint);
			color: var(--text-faint);
			cursor: pointer;
			padding: ${isMobile ? '8px 12px' : '4px 8px'};
			border-radius: 4px;
			font-size: 1em;
			transition: all 0.2s;
			min-width: ${isMobile ? '44px' : 'auto'};
			min-height: ${isMobile ? '44px' : 'auto'};
			display: flex;
			align-items: center;
			justify-content: center;
		`;
		
		// Touch-friendly feedback for clear button
		if (isMobile) {
			clearAllBtn.addEventListener('touchstart', () => {
				clearAllBtn.style.background = 'var(--background-modifier-error)';
				clearAllBtn.style.borderColor = 'var(--text-error)';
				clearAllBtn.style.color = 'var(--text-error)';
			});
			clearAllBtn.addEventListener('touchend', () => {
				setTimeout(() => {
					clearAllBtn.style.background = 'none';
					clearAllBtn.style.borderColor = 'var(--text-faint)';
					clearAllBtn.style.color = 'var(--text-faint)';
				}, NovaSidebarView.HOVER_TIMEOUT_MS);
			});
		} else {
			clearAllBtn.addEventListener('mouseenter', () => {
				clearAllBtn.style.background = 'var(--background-modifier-error)';
				clearAllBtn.style.borderColor = 'var(--text-error)';
				clearAllBtn.style.color = 'var(--text-error)';
			});
			clearAllBtn.addEventListener('mouseleave', () => {
				clearAllBtn.style.background = 'none';
				clearAllBtn.style.borderColor = 'var(--text-faint)';
				clearAllBtn.style.color = 'var(--text-faint)';
			});
		}
		
		// Document list for expanded state
		const docListEl = expandedEl.createDiv({ cls: 'nova-context-doc-list' });
		
		allDocs.forEach((doc, index) => {
			const docItemEl = docListEl.createDiv({ cls: 'nova-context-doc-item' });
			docItemEl.style.cssText = `
				display: flex;
				align-items: center;
				justify-content: space-between;
				padding: ${isMobile ? '12px 16px' : '8px 12px'};
				border-bottom: ${index < allDocs.length - 1 ? '1px solid var(--background-modifier-border)' : 'none'};
				transition: background-color 0.2s;
				min-height: ${isMobile ? '56px' : 'auto'};
			`;
			
			const docInfoEl = docItemEl.createDiv({ cls: 'nova-context-doc-info' });
			docInfoEl.style.cssText = `
				display: flex;
				align-items: center;
				gap: ${isMobile ? '12px' : '8px'};
				flex: 1;
				min-width: 0;
			`;
			
			const iconEl = docInfoEl.createSpan();
			iconEl.innerHTML = this.createInlineIcon('file-text');
			iconEl.style.cssText = 'display: flex; align-items: center; font-size: 1em;';
			
			const nameEl = docInfoEl.createSpan({ cls: 'nova-context-doc-name' });
			const suffix = doc.property ? `#${doc.property}` : '';
			nameEl.textContent = `${doc.file.basename}${suffix}`;
			nameEl.style.cssText = `
				font-weight: 400;
				color: var(--text-normal);
				text-overflow: ellipsis;
				overflow: hidden;
				white-space: nowrap;
				font-size: 1em;
				line-height: 1.4;
			`;
			nameEl.setAttr('title', `${doc.file.path} (read-only for editing)`);
			
			// Add read-only indicator
			const readOnlyEl = docInfoEl.createSpan({ cls: 'nova-context-readonly' });
			readOnlyEl.textContent = 'read-only';
			readOnlyEl.style.cssText = `
				font-size: 0.75em;
				color: var(--text-muted);
				background: var(--background-modifier-hover);
				padding: 1px 4px;
				border-radius: 3px;
				margin-left: 6px;
				font-weight: 500;
				text-transform: uppercase;
				letter-spacing: 0.5px;
			`;
			
			// Mobile-optimized remove button with larger touch target
			const removeBtn = docItemEl.createEl('button', { cls: 'nova-context-doc-remove' });
			removeBtn.innerHTML = this.createInlineIcon('x', isMobile ? '18px' : '14px');
			removeBtn.style.cssText = `
				background: none;
				border: none;
				color: var(--text-faint);
				cursor: pointer;
				width: ${isMobile ? '44px' : '20px'};
				height: ${isMobile ? '44px' : '20px'};
				border-radius: 50%;
				display: flex;
				align-items: center;
				justify-content: center;
				font-size: ${isMobile ? '18px' : '14px'};
				transition: all 0.2s;
				font-weight: bold;
			`;
			removeBtn.setAttr('title', `Remove ${doc.file.basename}`);
			
			removeBtn.addEventListener('click', async (e) => {
				e.stopPropagation();
				if (this.currentFile) {
					this.multiDocHandler.removePersistentDoc(this.currentFile.path, doc.file.path);
					await this.refreshContext();
				}
			});
			
			// Platform-specific interaction feedback
			if (isMobile) {
				removeBtn.addEventListener('touchstart', () => {
					removeBtn.style.background = 'var(--background-modifier-error)';
					removeBtn.style.color = 'var(--text-error)';
				});
				
				removeBtn.addEventListener('touchend', () => {
					setTimeout(() => {
						removeBtn.style.background = 'none';
						removeBtn.style.color = 'var(--text-faint)';
					}, NovaSidebarView.HOVER_TIMEOUT_MS);
				});
				
				// Touch feedback for document items
				docItemEl.addEventListener('touchstart', () => {
					docItemEl.style.background = 'var(--background-modifier-hover)';
				});
				
				docItemEl.addEventListener('touchend', () => {
					setTimeout(() => {
						docItemEl.style.background = 'transparent';
					}, NovaSidebarView.HOVER_TIMEOUT_MS);
				});
			} else {
				removeBtn.addEventListener('mouseenter', () => {
					removeBtn.style.background = 'var(--background-modifier-error)';
					removeBtn.style.color = 'var(--text-error)';
				});
				
				removeBtn.addEventListener('mouseleave', () => {
					removeBtn.style.background = 'none';
					removeBtn.style.color = 'var(--text-faint)';
				});
				
				docItemEl.addEventListener('mouseenter', () => {
					docItemEl.style.background = 'var(--background-modifier-hover)';
				});
				
				docItemEl.addEventListener('mouseleave', () => {
					docItemEl.style.background = 'transparent';
				});
			}
		});

		// Click to expand management overlay
		let isExpanded = false;
		
		const toggleExpanded = (e: MouseEvent) => {
			e.stopPropagation();
			isExpanded = !isExpanded;
			
			if (isExpanded) {
				expandedEl.style.display = 'block';
				this.contextIndicator.style.zIndex = '1001';
			} else {
				expandedEl.style.display = 'none';
				this.contextIndicator.style.zIndex = 'auto';
			}
		};
		
		// Click on the entire summary line to expand
		summaryEl.addEventListener('click', toggleExpanded);
		
		// Close when clicking outside
		const closeHandler: EventListener = (e: Event) => {
			if (isExpanded && !this.contextIndicator.contains(e.target as Node)) {
				isExpanded = false;
				expandedEl.style.display = 'none';
				this.contextIndicator.style.zIndex = 'auto';
			}
		};
		
		this.addTrackedEventListener(document, 'click', closeHandler);
	}

	private async refreshContext(): Promise<void> {
		if (this.currentFile) {
			const result = await this.multiDocHandler.buildContext('', this.currentFile);
			this.currentContext = result.context;
			this.updateContextIndicator();
		}
	}

	private async handleSend() {
		const message = this.textArea.getValue().trim();
		if (!message) return;

		// Check if Nova is enabled and a provider is available
		const currentProviderType = await this.plugin.aiProviderManager.getCurrentProviderType();
		if (!currentProviderType) {
			this.addErrorMessage(this.createIconMessage('alert-circle', 'Nova is disabled or no AI provider is available. Please configure an AI provider in settings.'));
			return;
		}

		// Check for command system feature availability
		if (message.startsWith(':')) {
			const commandResult = await this.handleColonCommand(message);
			if (commandResult) {
				this.textArea.setValue('');
				// Reset textarea height after clearing
				setTimeout(() => this.autoGrowTextarea(), 0);
				return;
			}
		}

		// Check if multi-doc context feature is enabled and parse references
		let processedMessage = message;
		let multiDocContext: MultiDocContext | null = null;
		
		if (this.currentFile) {
			// Check for early access
			if (!this.plugin.featureManager.isFeatureEnabled('multi-doc-context')) {
				if (message.includes('[[') || message.includes('+[[')) {
					this.addMessage('system', this.createIconMessage('book-open', 'Multi-document context is currently in early access for Supernova supporters. Available to all users August 15, 2025.'));
					return;
				}
			} else {
				// Parse and build context
				const contextResult = await this.multiDocHandler.buildContext(message, this.currentFile);
				processedMessage = contextResult.cleanedMessage;
				multiDocContext = contextResult.context;
				this.currentContext = multiDocContext;
				
				// Update UI indicator
				this.updateContextIndicator();
				
				// Check if message is just document references (context-only mode)
				// Since all docs are now persistent, check if we have new docs and empty message
				const previousPersistentCount = this.currentContext?.persistentDocs.length || 0;
				const currentPersistentCount = multiDocContext.persistentDocs.length;
				const hasNewDocs = currentPersistentCount > previousPersistentCount;
				const isContextOnlyMessage = processedMessage.trim().length === 0 && hasNewDocs;
				
				if (isContextOnlyMessage) {
					// Handle context-only commands - show newly added documents
					const newDocsCount = currentPersistentCount - previousPersistentCount;
					if (newDocsCount > 0) {
						// Get the newly added documents (last N documents)
						const newDocs = multiDocContext.persistentDocs.slice(-newDocsCount);
						const docNames = newDocs.map(doc => doc.file.basename).join(', ');
						this.addSuccessMessage(this.createIconMessage('check-circle', `Added ${newDocsCount} document${newDocsCount !== 1 ? 's' : ''} to persistent context: ${docNames}`));
					}
					
					// Clear input and update context indicator
					this.textArea.setValue('');
					setTimeout(() => this.autoGrowTextarea(), 0);
					this.updateContextIndicator();
					
					// Hide context preview since we're done
					if (this.contextPreview) {
						this.contextPreview.style.display = 'none';
					}
					return;
				}
				
				// Show context confirmation if documents were included in a regular message
				if (multiDocContext.persistentDocs.length > 0) {
					const allDocs = multiDocContext.persistentDocs;
					const docNames = allDocs.map(doc => doc.file.basename).join(', ');
					const tokenInfo = multiDocContext.tokenCount > 0 ? ` (~${multiDocContext.tokenCount} tokens)` : '';
					const currentFile = this.currentFile?.basename || 'current file';
					this.addMessage('system', this.createIconMessage('book-open', `Included ${allDocs.length} document${allDocs.length !== 1 ? 's' : ''} in context: ${docNames}${tokenInfo}. Context documents are read-only; edit commands will only modify ${currentFile}.`));
				}
				
				// Check token limit
				if (multiDocContext.isNearLimit) {
					new Notice('⚠️ Approaching token limit. Consider removing some documents from context.', NovaSidebarView.NOTICE_DURATION_MS);
				}
			}
		}

		// Add user message (show original with references)
		this.addMessage('user', message);
		this.textArea.setValue('');
		// Reset textarea height after clearing
		setTimeout(() => this.autoGrowTextarea(), 0);
		
		// Hide context preview since we're sending the message
		if (this.contextPreview) {
			this.contextPreview.style.display = 'none';
		}
		
		this.sendButton.setDisabled(true);

		try {
			// Add loading indicator with animated nova
			const loadingEl = this.chatContainer.createDiv({ cls: 'nova-loading' });
			loadingEl.style.cssText = `
				padding: 12px 16px;
				background: var(--background-primary);
				border: 1px solid var(--background-modifier-border);
				border-radius: 12px;
				margin-bottom: 8px;
				max-width: 80%;
				display: flex;
				align-items: center;
				gap: 10px;
			`;
			
			// Create animated nova burst
			const novaContainer = loadingEl.createDiv({ cls: 'nova-burst-container' });
			novaContainer.innerHTML = `
				<div class="nova-burst">
					<div class="nova-core"></div>
					<div class="nova-ring nova-ring-1"></div>
					<div class="nova-ring nova-ring-2"></div>
					<div class="nova-ring nova-ring-3"></div>
				</div>
			`;
			
			const textEl = loadingEl.createSpan({ text: 'Nova is thinking...' });
			textEl.style.cssText = 'color: var(--text-muted); font-size: 0.9em;';

			// Store message in conversation manager
			const activeFile = this.app.workspace.getActiveFile();
			if (activeFile) {
				await this.plugin.documentEngine.addUserMessage(message);
			}

			// Check if this is a command or conversation
			const isLikelyCommand = this.plugin.promptBuilder['isLikelyCommand'](processedMessage);
			let response: string | null = null;
			
			if (isLikelyCommand && activeFile) {
				// Parse as command and route to appropriate handler
				const parsedCommand = this.plugin.commandParser.parseCommand(processedMessage);
				response = await this.executeCommand(parsedCommand);
			} else {
				// Handle as conversation using PromptBuilder
				const prompt = await this.plugin.promptBuilder.buildPromptForMessage(processedMessage, activeFile || undefined);
				
				// Add multi-document context if available
				if (multiDocContext && multiDocContext.contextString) {
					// The context already includes the current file, so we can use it directly
					const enhancedUserPrompt = `${multiDocContext.contextString}\n\n---\n\nUser Request: ${processedMessage}`;
					
					// Get AI response using the provider manager
					response = await this.plugin.aiProviderManager.complete(prompt.systemPrompt, enhancedUserPrompt, {
						temperature: prompt.config.temperature,
						maxTokens: prompt.config.maxTokens
					});
				} else {
					// Get AI response using the provider manager
					response = await this.plugin.aiProviderManager.complete(prompt.systemPrompt, prompt.userPrompt, {
						temperature: prompt.config.temperature,
						maxTokens: prompt.config.maxTokens
					});
				}
			}
			
			// Remove loading indicator
			loadingEl.remove();
			
			// Filter thinking content from response
			const filteredResponse = response ? this.filterThinkingContent(response) : response;
			
			// Store filtered response in conversation manager (if response exists)
			if (activeFile && filteredResponse) {
				await this.plugin.documentEngine.addAssistantMessage(filteredResponse);
			}
			
			// Add filtered AI response (only if there is a response)
			if (filteredResponse) {
				// Check if response is an error message (contains x-circle icon or error keywords)
				if (filteredResponse.includes('x-circle') || 
					filteredResponse.includes('Error executing command') ||
					filteredResponse.includes('No markdown file is open') ||
					filteredResponse.includes('Unable to access') ||
					filteredResponse.includes('Unable to set')) {
					this.addErrorMessage(filteredResponse);
				} else {
					this.addMessage('assistant', filteredResponse);
				}
			}
		} catch (error) {
			// Remove loading indicator if it exists
			const loadingEl = this.chatContainer.querySelector('.nova-loading');
			if (loadingEl) loadingEl.remove();
			
			this.addErrorMessage(this.createIconMessage('x-circle', `Sorry, I encountered an error: ${(error as Error).message}`));
		} finally {
			this.sendButton.setDisabled(false);
			// Refresh context indicator to show persistent documents
			await this.refreshContext();
		}
	}

	async insertTextIntoActiveNote(text: string) {
		const activeView = this.app.workspace.getActiveViewOfType(ItemView);
		if (activeView && 'editor' in activeView) {
			const editor = (activeView as any).editor;
			if (editor) {
				const cursor = editor.getCursor();
				editor.replaceRange(text, cursor);
			}
		}
	}

	private async executeCommand(command: EditCommand): Promise<string | null> {
		try {
			// Check if there's a current file (the one we're chatting about)
			if (!this.currentFile) {
				return this.createIconMessage('x-circle', 'No markdown file is open. Please open a file in the editor to use editing commands.');
			}
			
			// Ensure there's a markdown view with this file
			const leaves = this.app.workspace.getLeavesOfType('markdown');
			let markdownView: MarkdownView | null = null;
			
			// Find the view with our file
			for (const leaf of leaves) {
				const view = leaf.view as MarkdownView;
				if (view.file === this.currentFile) {
					markdownView = view;
					break;
				}
			}
			
			// If not found, try to open the file
			if (!markdownView) {
				const leaf = this.app.workspace.getLeaf(false);
				if (leaf) {
					await leaf.openFile(this.currentFile);
					markdownView = leaf.view as MarkdownView;
				}
			}
			
			if (!markdownView) {
				return this.createIconMessage('x-circle', `Unable to access the file "${this.currentFile.basename}". Please make sure it's open in the editor.`);
			}

			// CRITICAL SECURITY: Ensure the active file matches our conversation file
			// This prevents accidentally editing context documents that might be open
			const activeFile = this.app.workspace.getActiveFile();
			if (!activeFile || activeFile !== this.currentFile) {
				// Make the conversation file active before executing commands
				this.app.workspace.setActiveLeaf(markdownView.leaf, { focus: true });
				
				// Double-check that the file is now active
				const nowActiveFile = this.app.workspace.getActiveFile();
				if (!nowActiveFile || nowActiveFile !== this.currentFile) {
					return this.createIconMessage('x-circle', `Unable to set "${this.currentFile.basename}" as the active file. Edit commands can only modify the file you're chatting about to prevent accidental changes to context documents.`);
				}
			}
			
			let result;
			
			switch (command.action) {
				case 'add':
					result = await this.plugin.addCommandHandler.execute(command);
					break;
				case 'edit':
					result = await this.plugin.editCommandHandler.execute(command);
					break;
				case 'delete':
					result = await this.plugin.deleteCommandHandler.execute(command);
					break;
				case 'grammar':
					result = await this.plugin.grammarCommandHandler.execute(command);
					break;
				case 'rewrite':
					result = await this.plugin.rewriteCommandHandler.execute(command);
					break;
				case 'metadata':
					result = await this.plugin.metadataCommandHandler.execute(command);
					break;
				default:
					return `I don't understand the command "${command.action}". Try asking me to add, edit, delete, fix grammar, rewrite content, or update metadata/properties.`;
			}
			
			if (result.success) {
				// Add compact success indicator instead of full message
				this.addSuccessIndicator(command.action);
				return null; // Don't return text for regular message
			} else {
				return `Failed to ${command.action}: ${result.error}`;
			}
		} catch (error) {
			return this.createIconMessage('x-circle', `Error executing command: ${(error as Error).message}`);
		}
	}


	private async loadConversationForActiveFile() {
		const activeFile = this.app.workspace.getActiveFile();
		
		// If no active file, try to find the currently active leaf's file
		let targetFile = activeFile;
		if (!targetFile) {
			const activeLeaf = this.app.workspace.activeLeaf;
			if (activeLeaf && activeLeaf.view instanceof MarkdownView) {
				targetFile = activeLeaf.view.file;
			} else {
				// Fall back to any open markdown file only if no active leaf
				const leaves = this.app.workspace.getLeavesOfType('markdown');
				if (leaves.length > 0) {
					const view = leaves[0].view as MarkdownView;
					targetFile = view.file;
				}
			}
		}
		
		// If no file available and we have a current file, clear everything
		if (!targetFile && this.currentFile) {
			this.currentFile = null;
			this.chatContainer.empty();
			this.refreshContext();
			this.addWelcomeMessage('Open a document to get started.');
			return;
		}
		
		// If no file or same file, do nothing
		if (!targetFile || targetFile === this.currentFile) {
			return;
		}
		
		this.currentFile = targetFile;
		
		// Clear current chat
		this.chatContainer.empty();
		
		// Refresh context for new file (this will show persistent documents if any)
		await this.refreshContext();
		
		try {
			// Load conversation history if it exists
			const recentMessages = await this.plugin.conversationManager.getRecentMessages(targetFile, 10);
			
			if (recentMessages.length > 0) {
				// Display recent conversation history
				recentMessages.forEach(msg => {
					if (msg.role !== 'system') {
						this.addMessage(msg.role as 'user' | 'assistant', msg.content);
					}
				});
			} else {
				// Show welcome message for new file
				this.addWelcomeMessage(`Working on "${targetFile.basename}".`);
			}
		} catch (error) {
			// Failed to load conversation history - graceful fallback
			// Show welcome message on error
			this.addWelcomeMessage(`Working on "${targetFile.basename}".`);
		}
	}

	private async clearChat() {
		// Clear the chat container
		this.chatContainer.empty();
		
		// Clear conversation in conversation manager
		if (this.currentFile) {
			try {
				await this.plugin.conversationManager.clearConversation(this.currentFile);
				// Also clear multi-doc persistent context
				this.multiDocHandler.clearPersistentContext(this.currentFile.path);
				this.currentContext = null;
				if (this.contextIndicator) {
					this.contextIndicator.style.display = 'none';
				}
			} catch (error) {
				// Failed to clear conversation - graceful fallback
			}
		}
		
		// Show fresh welcome message
		if (this.currentFile) {
			this.addWelcomeMessage(`Chat cleared.`);
		} else {
			this.addWelcomeMessage("Chat cleared.");
		}
		
		// Show notice to user
		new Notice('Chat history cleared');
	}

	// Public methods for testing
	async sendMessage(message: string): Promise<void> {
		const activeFile = this.plugin.documentEngine.getActiveFile();
		
		// Build prompt using PromptBuilder
		const prompt = await this.plugin.promptBuilder.buildPromptForMessage(message, activeFile || undefined);
		
		// Try to parse as command first
		const command = this.plugin.commandParser.parseCommand(message);
		
		// Check if it's a valid command action
		const validActions = ['add', 'edit', 'delete', 'grammar', 'rewrite', 'metadata'];
		if (validActions.includes(command.action)) {
			// CRITICAL SECURITY: Validate that we're editing the correct file
			// This prevents accidentally editing context documents that might be open
			// Only apply this validation when both files exist (not in test scenarios)
			const currentActiveFile = this.plugin.documentEngine.getActiveFile();
			if (activeFile && currentActiveFile && currentActiveFile !== activeFile) {
				throw new Error(`Security violation: Command attempted to edit wrong file. Expected: ${activeFile.basename}, Active: ${currentActiveFile.basename}`);
			}

			// Execute command
			switch (command.action) {
				case 'add':
					await this.plugin.addCommandHandler.execute(command);
					break;
				case 'edit':
					await this.plugin.editCommandHandler.execute(command);
					break;
				case 'delete':
					await this.plugin.deleteCommandHandler.execute(command);
					break;
				case 'grammar':
					await this.plugin.grammarCommandHandler.execute(command);
					break;
				case 'rewrite':
					await this.plugin.rewriteCommandHandler.execute(command);
					break;
				case 'metadata':
					await this.plugin.metadataCommandHandler.execute(command);
					break;
			}
		} else {
			// Regular conversation
			if (activeFile) {
				await this.plugin.conversationManager.addUserMessage(activeFile, message, null as any);
			}
			
			// Call AI provider
			await this.plugin.aiProviderManager.complete(prompt.systemPrompt, prompt.userPrompt);
			
			if (activeFile) {
				await this.plugin.conversationManager.addAssistantMessage(activeFile, 'AI response', { success: true, editType: 'none' } as any);
			}
		}
	}

	async loadConversationHistory(file: any): Promise<void> {
		const messages = await this.plugin.conversationManager.getRecentMessages(file, 50);
		// In real implementation, this would display messages in the UI
	}

	/**
	 * Create static provider status display
	 */
	private createStaticProviderStatus(container: HTMLElement): void {
		const providerStatus = container.createDiv({ cls: 'nova-header-provider' });
		providerStatus.style.cssText = `
			display: flex;
			align-items: center;
			gap: 4px;
			font-size: 0.75em;
			color: var(--text-muted);
			opacity: 0.8;
		`;
		
		const headerStatusDot = providerStatus.createSpan({ cls: 'nova-status-dot-small' });
		headerStatusDot.style.cssText = `
			width: 6px;
			height: 6px;
			border-radius: 50%;
			background: var(--text-error);
		`;
		
		const headerProviderName = providerStatus.createSpan({ text: 'Loading...' });
		
		// Update provider name and status asynchronously
		this.updateProviderStatus(headerStatusDot, headerProviderName);
	}

	/**
	 * Update provider status dot and name
	 */
	private async updateProviderStatus(statusDot: HTMLElement, nameElement: HTMLElement): Promise<void> {
		const currentProviderType = await this.plugin.aiProviderManager.getCurrentProviderType();
		
		if (currentProviderType) {
			// Provider is available - show green status
			statusDot.style.background = 'var(--text-success)';
			const displayText = this.getProviderWithModelDisplayName(currentProviderType);
			nameElement.setText(displayText);
		} else {
			// No provider available - show red status
			statusDot.style.background = 'var(--text-error)';
			const currentProviderName = await this.plugin.aiProviderManager.getCurrentProviderName();
			nameElement.setText(currentProviderName);
		}

		// Update send button status
		this.updateSendButtonState();
	}

	/**
	 * Update send button enabled/disabled state based on provider availability
	 */
	private async updateSendButtonState(): Promise<void> {
		const currentProviderType = await this.plugin.aiProviderManager.getCurrentProviderType();
		this.sendButton.setDisabled(!currentProviderType);
	}

	/**
	 * Filter thinking content from AI responses
	 * Removes content between <think>/<thinking> and </think>/<thinking> tags
	 */
	private filterThinkingContent(content: string): string {
		// Remove thinking tags and their content (case-insensitive, multi-line)
		// Handles both <think> (Qwen3) and <thinking> (Claude) tags
		return content.replace(/<think(?:ing)?[\s\S]*?<\/think(?:ing)?>/gi, '').trim();
	}

	/**
	 * Refresh all provider status indicators in the UI
	 */
	private async refreshProviderStatus(): Promise<void> {
		// Update header status if it exists
		const headerStatusDot = this.containerEl.querySelector('.nova-status-dot-small') as HTMLElement;
		const headerProviderName = headerStatusDot?.nextElementSibling as HTMLElement;
		if (headerStatusDot && headerProviderName) {
			await this.updateProviderStatus(headerStatusDot, headerProviderName);
		}

		// Update dropdown status if it exists
		const dropdownStatusDot = this.containerEl.querySelector('.nova-provider-button .nova-status-dot-small') as HTMLElement;
		const dropdownProviderName = dropdownStatusDot?.nextElementSibling as HTMLElement;
		if (dropdownStatusDot && dropdownProviderName) {
			await this.updateProviderStatus(dropdownStatusDot, dropdownProviderName);
		}
	}

	/**
	 * Create provider dropdown for all users with their own API keys
	 */
	private createProviderDropdown(container: HTMLElement): void {
		const dropdownContainer = container.createDiv({ cls: 'nova-provider-dropdown-container' });
		dropdownContainer.style.cssText = `
			position: relative;
			display: flex;
			align-items: center;
		`;

		// Current provider button
		const providerButton = dropdownContainer.createEl('button', { cls: 'nova-provider-button' });
		providerButton.style.cssText = `
			display: flex;
			align-items: center;
			gap: 4px;
			padding: 4px 8px;
			font-size: 0.75em;
			color: var(--text-muted);
			background: var(--background-modifier-hover);
			border: 1px solid var(--background-modifier-border);
			border-radius: 4px;
			cursor: pointer;
			transition: background-color 0.2s ease;
		`;

		// Status dot
		const statusDot = providerButton.createSpan({ cls: 'nova-status-dot-small' });
		statusDot.style.cssText = `
			width: 6px;
			height: 6px;
			border-radius: 50%;
			background: var(--text-error);
		`;

		// Provider name
		const providerName = providerButton.createSpan({ text: 'Loading...' });

		// Dropdown arrow
		const dropdownArrow = providerButton.createSpan({ text: '▼' });
		dropdownArrow.style.cssText = `
			font-size: 0.6em;
			margin-left: 4px;
			transition: transform 0.2s ease;
		`;

		// Dropdown menu (initially hidden)
		const dropdownMenu = dropdownContainer.createDiv({ cls: 'nova-provider-dropdown-menu' });
		dropdownMenu.style.cssText = `
			position: absolute;
			top: 100%;
			right: 0;
			min-width: 150px;
			background: var(--background-primary);
			border: 1px solid var(--background-modifier-border);
			border-radius: 6px;
			box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
			z-index: 1000;
			display: none;
			overflow: hidden;
		`;

		let isDropdownOpen = false;

		// Update current provider display
		const updateCurrentProvider = async () => {
			await this.updateProviderStatus(statusDot, providerName);
		};

		// Toggle dropdown
		const toggleDropdown = () => {
			isDropdownOpen = !isDropdownOpen;
			dropdownMenu.style.display = isDropdownOpen ? 'block' : 'none';
			dropdownArrow.style.transform = isDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)';
			
			if (isDropdownOpen) {
				this.populateProviderDropdown(dropdownMenu);
			}
		};

		// Close dropdown when clicking outside
		const closeDropdown: EventListener = (event: Event) => {
			if (!dropdownContainer.contains(event.target as Node)) {
				isDropdownOpen = false;
				dropdownMenu.style.display = 'none';
				dropdownArrow.style.transform = 'rotate(0deg)';
			}
		};

		providerButton.addEventListener('click', (e) => {
			e.stopPropagation();
			toggleDropdown();
		});

		// Add global click listener
		this.addTrackedEventListener(document, 'click', closeDropdown);

		// Update provider name initially
		updateCurrentProvider();

		// Store reference for cleanup
		(this as any).currentProviderDropdown = {
			updateCurrentProvider,
			cleanup: () => document.removeEventListener('click', closeDropdown)
		};
	}

	/**
	 * Get available models for a provider type
	 */
	private getAvailableModels(providerType: string): { value: string; label: string }[] {
		switch (providerType) {
			case 'claude':
				return [
					{ value: 'claude-opus-4-20250514', label: 'Claude Opus 4' },
					{ value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
					{ value: 'claude-3-7-sonnet-latest', label: 'Claude 3.7 Sonnet' },
					{ value: 'claude-3-5-sonnet-latest', label: 'Claude 3.5 Sonnet' },
					{ value: 'claude-3-5-haiku-latest', label: 'Claude 3.5 Haiku' }
				];
			case 'openai':
				return [
					{ value: 'gpt-4.1-2025-04-14', label: 'GPT-4.1' },
					{ value: 'gpt-4.1-mini-2025-04-14', label: 'GPT-4.1 Mini' },
					{ value: 'gpt-4.1-nano-2025-04-14', label: 'GPT-4.1 Nano' },
					{ value: 'gpt-4o', label: 'GPT-4o' },
					{ value: 'gpt-4o-mini', label: 'GPT-4o Mini' }
				];
			case 'google':
				return [
					{ value: 'gemini-2.5-flash-preview-04-17', label: 'Gemini 2.5 Flash' },
					{ value: 'gemini-2.5-pro-preview-03-25', label: 'Gemini 2.5 Pro' },
					{ value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
					{ value: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash-Lite' }
				];
			default:
				return [];
		}
	}

	/**
	 * Get current model for a provider type
	 */
	private getCurrentModel(providerType: string): string {
		const defaultModels: Record<string, string> = {
			claude: 'claude-sonnet-4-20250514',
			openai: 'gpt-4.1-mini-2025-04-14',
			google: 'gemini-2.5-flash-preview-04-17',
			ollama: ''
		};
		
		const providers = this.plugin.settings.aiProviders as Record<string, any>;
		return providers[providerType]?.model || defaultModels[providerType] || '';
	}

	/**
	 * Get model display name from model value
	 */
	private getModelDisplayName(providerType: string, modelValue: string): string {
		const models = this.getAvailableModels(providerType);
		const model = models.find(m => m.value === modelValue);
		return model ? model.label : modelValue;
	}

	/**
	 * Switch to a specific model for a provider
	 */
	private async switchToModel(providerType: string, modelValue: string): Promise<void> {
		// Check if we're already on this provider
		const currentProviderType = await this.plugin.aiProviderManager.getCurrentProviderType();
		const isCurrentProvider = currentProviderType === providerType;
		
		// Update settings
		const providers = this.plugin.settings.aiProviders as Record<string, any>;
		providers[providerType].model = modelValue;
		await this.plugin.saveSettings();
		
		if (isCurrentProvider) {
			// Just switching models on current provider - show model switch message
			const modelName = this.getModelDisplayName(providerType, modelValue);
			const providerName = this.getProviderDisplayName(providerType);
			const switchMessage = this.createIconMessage('refresh-cw', `Switched to ${providerName} ${modelName}`);
			this.addMessage('system', switchMessage);
		} else {
			// Switching to different provider - this will show the provider+model message
			await this.switchToProvider(providerType);
		}
		
		// Update the dropdown display
		if ((this as any).currentProviderDropdown) {
			(this as any).currentProviderDropdown.updateCurrentProvider();
		}
	}

	/**
	 * Populate provider dropdown with available providers
	 */
	private async populateProviderDropdown(dropdownMenu: HTMLElement): Promise<void> {
		dropdownMenu.empty();

		const allowedProviders = this.plugin.aiProviderManager.getAllowedProviders();
		const currentProviderName = await this.plugin.aiProviderManager.getCurrentProviderName();

		for (const providerType of allowedProviders) {
			if (providerType === 'none') continue;

			// Check if provider has API key configured
			const providers = this.plugin.settings.aiProviders as Record<string, any>;
			const hasApiKey = providers[providerType]?.apiKey;
			if (!hasApiKey && providerType !== 'ollama') continue;

			const models = this.getAvailableModels(providerType);
			const currentModel = this.getCurrentModel(providerType);
			const displayName = this.getProviderDisplayName(providerType);
			const isCurrent = displayName === currentProviderName;

			// Create provider container
			const providerContainer = dropdownMenu.createDiv({ cls: 'nova-provider-container' });
			
			// Main provider item
			const providerItem = providerContainer.createDiv({ cls: 'nova-provider-dropdown-item' });
			providerItem.style.cssText = `
				padding: 8px 12px;
				cursor: pointer;
				display: flex;
				align-items: center;
				gap: 8px;
				font-size: 0.85em;
				transition: background-color 0.2s ease;
				position: relative;
			`;

			// Provider icon/dot
			const providerDot = providerItem.createSpan();
			providerDot.style.cssText = `
				width: 8px;
				height: 8px;
				border-radius: 50%;
				background: ${this.getProviderColor(providerType)};
			`;

			// Provider name only (models are shown in submenu)
			const nameSpan = providerItem.createSpan({ text: displayName });
			nameSpan.style.flex = '1';

			// Expand arrow for models (only if models available)
			let expandArrow: HTMLElement | null = null;
			if (models.length > 0) {
				expandArrow = providerItem.createSpan({ text: '▶' });
				expandArrow.style.cssText = `
					font-size: 0.6em;
					transition: transform 0.2s ease;
					color: var(--text-muted);
				`;
			}

			// Mark current provider
			if (isCurrent) {
				providerItem.style.background = 'var(--background-modifier-hover)';
				nameSpan.style.fontWeight = 'bold';
			}

			// Models submenu
			let modelsMenu: HTMLElement | null = null;
			let isExpanded = false;

			if (models.length > 0) {
				modelsMenu = providerContainer.createDiv({ cls: 'nova-models-submenu' });
				modelsMenu.style.cssText = `
					display: none;
					background: var(--background-primary);
					border-left: 2px solid ${this.getProviderColor(providerType)};
					margin-left: 16px;
				`;

				// Populate models
				for (const model of models) {
					const modelItem = modelsMenu.createDiv({ cls: 'nova-model-item' });
					modelItem.style.cssText = `
						padding: 6px 12px;
						cursor: pointer;
						font-size: 0.8em;
						transition: background-color 0.2s ease;
						display: flex;
						align-items: center;
						gap: 8px;
					`;

					// Model indicator
					const modelDot = modelItem.createSpan();
					modelDot.style.cssText = `
						width: 4px;
						height: 4px;
						border-radius: 50%;
						background: ${model.value === currentModel ? this.getProviderColor(providerType) : 'var(--text-muted)'};
					`;

					const modelName = modelItem.createSpan({ text: model.label });
					if (model.value === currentModel) {
						modelName.style.fontWeight = 'bold';
					}

					// Model click handler
					modelItem.addEventListener('click', async (e) => {
						e.stopPropagation();
						await this.switchToModel(providerType, model.value);
						// Close dropdown
						dropdownMenu.style.display = 'none';
					});

					// Model hover effect
					modelItem.addEventListener('mouseenter', () => {
						modelItem.style.background = 'var(--background-modifier-border-hover)';
					});
					modelItem.addEventListener('mouseleave', () => {
						modelItem.style.background = 'transparent';
					});
				}
			}

			// Provider click handler
			providerItem.addEventListener('click', async (e) => {
				if (models.length > 0) {
					// Toggle submenu
					e.stopPropagation();
					isExpanded = !isExpanded;
					if (modelsMenu) {
						modelsMenu.style.display = isExpanded ? 'block' : 'none';
					}
					if (expandArrow) {
						expandArrow.style.transform = isExpanded ? 'rotate(90deg)' : 'rotate(0deg)';
					}
				} else {
					// Switch provider directly (for Ollama or providers without models)
					if (!isCurrent) {
						await this.switchToProvider(providerType);
						dropdownMenu.style.display = 'none';
						if ((this as any).currentProviderDropdown) {
							(this as any).currentProviderDropdown.updateCurrentProvider();
						}
					}
				}
			});

			// Hover effect
			providerItem.addEventListener('mouseenter', () => {
				if (!isCurrent) {
					providerItem.style.background = 'var(--background-modifier-border-hover)';
				}
			});

			providerItem.addEventListener('mouseleave', () => {
				if (!isCurrent && !isExpanded) {
					providerItem.style.background = 'transparent';
				}
			});
		}
	}

	/**
	 * Create a message with a clean icon (replaces emoji)
	 */
	private createIconMessage(iconName: string, message: string): string {
		const iconSvg = this.getObsidianIcon(iconName, '14px');
		// Return as HTML that will be interpreted by the message display
		return `<span style="display: inline-flex; align-items: center; gap: 6px;">${iconSvg}<span>${message}</span></span>`;
	}

	/**
	 * Create an inline icon for use in innerHTML
	 */
	private createInlineIcon(iconName: string, size: string = '14px'): string {
		return this.getObsidianIcon(iconName, size);
	}

	/**
	 * Get Obsidian-style icon SVG
	 */
	private getObsidianIcon(iconName: string, size: string = '14px'): string {
		const icons: Record<string, string> = {
			'zap': `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: ${size}; height: ${size};">
				<path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
			</svg>`,
			'refresh-cw': `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: ${size}; height: ${size};">
				<path d="M3 12A9 9 0 0 0 21 12A9 9 0 0 0 3 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
				<path d="M21 12L17 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
				<path d="M21 12L17 16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
			</svg>`,
			'edit': `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: ${size}; height: ${size};">
				<path d="M11 4H4A2 2 0 0 0 2 6V20A2 2 0 0 0 4 22H18A2 2 0 0 0 20 20V13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
				<path d="M18.5 2.5A2.12 2.12 0 0 1 21 5L12 14L8 15L9 11L18.5 2.5Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
			</svg>`,
			'help-circle': `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: ${size}; height: ${size};">
				<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
				<path d="M9.09 9A3 3 0 0 1 12 6A3 3 0 0 1 15 9C15 10.5 12 11 12 11" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
				<circle cx="12" cy="17" r="1" fill="currentColor"/>
			</svg>`,
			'book-open': `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: ${size}; height: ${size};">
				<path d="M2 3H8A4 4 0 0 1 12 7A4 4 0 0 1 16 3H22" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
				<path d="M2 3V19A2 2 0 0 0 4 21H9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
				<path d="M22 3V19A2 2 0 0 1 20 21H15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
				<path d="M12 7V21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
			</svg>`,
			'more-horizontal': `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: ${size}; height: ${size};">
				<circle cx="12" cy="12" r="1" fill="currentColor"/>
				<circle cx="19" cy="12" r="1" fill="currentColor"/>
				<circle cx="5" cy="12" r="1" fill="currentColor"/>
			</svg>`,
			'file-text': `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: ${size}; height: ${size};">
				<path d="M14 2H6A2 2 0 0 0 4 4V20A2 2 0 0 0 6 22H18A2 2 0 0 0 20 20V8L14 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
				<path d="M14 2V8H20" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
				<path d="M16 13H8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
				<path d="M16 17H8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
				<path d="M10 9H8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
			</svg>`,
			'x': `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: ${size}; height: ${size};">
				<path d="M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
				<path d="M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
			</svg>`,
			'check-circle': `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: ${size}; height: ${size};">
				<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
				<path d="M9 12L11 14L16 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
			</svg>`,
			'x-circle': `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: ${size}; height: ${size};">
				<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
				<path d="M15 9L9 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
				<path d="M9 9L15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
			</svg>`
		};
		
		return icons[iconName] || icons['help-circle']; // Fallback to help-circle if icon not found
	}

	/**
	 * Get display name for provider
	 */
	private getProviderDisplayName(providerType: string): string {
		const names: Record<string, string> = {
			'claude': 'Anthropic',
			'openai': 'OpenAI',
			'google': 'Google',
			'ollama': 'Ollama',
			'none': 'None'
		};
		return names[providerType] || providerType;
	}

	/**
	 * Get display name for header (just model name if available, otherwise provider name)
	 */
	private getProviderWithModelDisplayName(providerType: string): string {
		const models = this.getAvailableModels(providerType);
		
		if (models.length > 0) {
			const currentModel = this.getCurrentModel(providerType);
			return this.getModelDisplayName(providerType, currentModel);
		}
		
		return this.getProviderDisplayName(providerType);
	}

	/**
	 * Get color for provider type
	 */
	private getProviderColor(providerType: string): string {
		// Use theme-compatible colors instead of hardcoded hex values
		const colors: Record<string, string> = {
			'claude': 'var(--color-orange)',
			'openai': 'var(--color-green)',
			'google': 'var(--color-blue)',
			'ollama': 'var(--color-purple)',
			'none': 'var(--text-muted)'
		};
		return colors[providerType] || 'var(--text-success)';
	}

	/**
	 * Switch to a different provider and update conversation context
	 */
	private async switchToProvider(providerType: string): Promise<void> {
		try {
			// Add a system message about provider switching
			const switchMessage = this.createIconMessage('refresh-cw', `Switched to ${this.getProviderWithModelDisplayName(providerType)}`);
			this.addMessage('system', switchMessage);
			
			// Update the platform settings to use the new provider
			const platform = Platform.isMobile ? 'mobile' : 'desktop';
			this.plugin.settings.platformSettings[platform].primaryProvider = providerType as any;
			await this.plugin.saveSettings();
			
			// Re-initialize the provider manager with new settings
			this.plugin.aiProviderManager.updateSettings(this.plugin.settings);
			
			// Refresh status indicators
			setTimeout(() => this.refreshProviderStatus(), 100);
			
		} catch (error) {
			// Error switching provider - handled by UI feedback
			this.addErrorMessage(this.createIconMessage('x-circle', `Failed to switch to ${this.getProviderWithModelDisplayName(providerType)}`));
		}
	}

	/**
	 * Check if the command button should be shown based on feature availability and user preference
	 */
	private shouldShowCommandButton(): boolean {
		// Command button is gated behind the command-button feature (Supernova-only)
		if (!this.plugin.featureManager.isFeatureEnabled('command-button')) {
			return false;
		}
		return this.plugin.settings.showCommandButton;
	}

	/**
	 * Refresh all Supernova-gated UI elements when license status changes
	 */
	refreshSupernovaUI(): void {
		this.refreshCommandButton();
		// Future Supernova features can add their refresh logic here
	}

	/**
	 * Refresh the command button visibility when settings change
	 */
	refreshCommandButton(): void {
		if (!this.inputContainer) return;
		
		// Save current textarea state
		const currentText = this.textArea?.getValue() || '';
		const cursorStart = this.textArea?.inputEl?.selectionStart || 0;
		const cursorEnd = this.textArea?.inputEl?.selectionEnd || 0;
		const hadFocus = this.textArea?.inputEl === document.activeElement;
		
		// Rebuild the input area
		this.createInputArea();
		
		// Restore textarea state
		if (this.textArea && currentText) {
			this.textArea.setValue(currentText);
			// Restore cursor position
			setTimeout(() => {
				if (this.textArea?.inputEl) {
					this.textArea.inputEl.setSelectionRange(cursorStart, cursorEnd);
					if (hadFocus) {
						this.textArea.inputEl.focus();
					}
				}
			}, 0);
		}
	}

	/**
	 * Update input row layout when command button visibility changes
	 */
	private updateInputRowLayout(): void {
		// No need to manually adjust textarea width - flexbox handles it
		// The textarea container has flex: 1, so it will expand/contract automatically
		// when the command button is shown/hidden
	}

}