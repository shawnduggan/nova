import { ItemView, WorkspaceLeaf, ButtonComponent, TextAreaComponent, TFile, Notice, MarkdownView, Platform, setIcon, EditorPosition } from 'obsidian';
import NovaPlugin from '../../main';
import { EditCommand } from '../core/types';
import { NovaWikilinkAutocomplete } from './wikilink-suggest';
import { MultiDocContextHandler, MultiDocContext } from '../core/multi-doc-context';
import { getAvailableModels } from '../ai/models';
import { InputHandler } from './input-handler';
import { CommandSystem } from './command-system';
import { ContextManager } from './context-manager';
import { ChatRenderer } from './chat-renderer';
import { StreamingManager } from './streaming-manager';
import { SelectionContextMenu, SELECTION_ACTIONS } from './selection-context-menu';

export const VIEW_TYPE_NOVA_SIDEBAR = 'nova-sidebar';

export class NovaSidebarView extends ItemView {
	plugin: NovaPlugin;
	private chatContainer!: HTMLElement;
	private inputContainer!: HTMLElement;
	private currentFile: TFile | null = null;
	private multiDocHandler!: MultiDocContextHandler;
	private currentContext: MultiDocContext | null = null;
	
	// New architecture components
	private inputHandler!: InputHandler;
	private commandSystem!: CommandSystem;
	private contextManager!: ContextManager;
	private chatRenderer!: ChatRenderer;
	private streamingManager!: StreamingManager;
	private selectionContextMenu!: SelectionContextMenu;
	
	// Cursor-only architecture - delegate to new components
	private get textArea() { return this.inputHandler?.getTextArea(); }
	private get wikilinkAutocomplete() { return this.inputHandler ? { destroy: () => {} } : null; }
	private get autoGrowTextarea() { return () => {}; }
	
	// Command system delegation
	private _commandPickerItems: any[] = [];
	private get commandPickerItems() { return this._commandPickerItems; }
	private set commandPickerItems(value: any[]) { this._commandPickerItems = value; }
	private _selectedCommandIndex: number = -1;
	private get selectedCommandIndex() { return this._selectedCommandIndex; }
	private set selectedCommandIndex(value: number) { this._selectedCommandIndex = value; }
	private _isCommandMenuVisible: boolean = false;
	private get isCommandMenuVisible() { return this._isCommandMenuVisible; }
	private set isCommandMenuVisible(value: boolean) { this._isCommandMenuVisible = value; }
	
	// Context system delegation
	private get contextPreview() { return this.contextManager?.contextPreview; }
	private _contextIndicator: any;
	private get contextIndicator() { return this._contextIndicator || this.contextManager?.contextIndicator; }
	private set contextIndicator(value: any) { this._contextIndicator = value; }
	
	// Component references
	private commandPicker!: HTMLElement;
	private commandMenu!: HTMLElement;
	private commandButton!: ButtonComponent;
	
	// Cursor position tracking - file-scoped like conversation history
	private currentFileCursorPosition: EditorPosition | null = null;
	
	
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
		
		// Privacy indicator icon
		const privacyIndicator = rightContainer.createSpan({ cls: 'nova-privacy-indicator' });
		privacyIndicator.style.cssText = `
			display: flex;
			align-items: center;
			padding: 4px;
			color: var(--icon-color);
			font-weight: var(--font-weight-medium);
		`;
		this.updatePrivacyIndicator(privacyIndicator);
		
		// Store reference for updates
		(this as any).privacyIndicator = privacyIndicator;
		
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
		
		// Register cursor position tracking for the active editor
		this.registerEvent(
			this.app.workspace.on('editor-change', (editor) => {
				this.trackCursorPosition(editor);
			})
		);
		
		// Load conversation for current file
		this.loadConversationForActiveFile();
		
		// Initial status refresh to ensure all indicators are up to date
		setTimeout(() => this.refreshProviderStatus(), 100);
		
		// Note: Auto-focus removed to prevent stealing cursor from editor
	}

	/**
	 * Track cursor position changes in the active editor (file-scoped)
	 */
	private trackCursorPosition(editor: any) {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile || !editor) {
			return;
		}
		
		// Only track cursor position if this is the current file we're working with
		if (this.currentFile && activeFile.path === this.currentFile.path) {
			const cursorPos = editor.getCursor();
			if (cursorPos) {
				this.currentFileCursorPosition = cursorPos;
			}
		}
	}
	
	/**
	 * Restore cursor position for current file (file-scoped)
	 */
	private restoreCursorPosition(): void {
		if (this.currentFileCursorPosition) {
			// Restore without stealing focus
			const editor = this.plugin.documentEngine.getActiveEditor();
			if (editor) {
				editor.setCursor(this.currentFileCursorPosition);
			}
		}
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
		// Cleanup is now handled by individual component cleanup methods
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
	 * Create the input area UI elements using new architecture
	 */
	private createInputArea() {
		// Clear existing input area content
		this.inputContainer.empty();
		
		// Initialize context manager, chat renderer, streaming manager, and selection menu first
		this.contextManager = new ContextManager(this.plugin, this.app, this.inputContainer);
		this.chatRenderer = new ChatRenderer(this.plugin, this.chatContainer);
		this.streamingManager = new StreamingManager();
		this.selectionContextMenu = new SelectionContextMenu(this.app, this.plugin);
		
		// Create InputHandler which will handle all input UI creation
		this.inputHandler = new InputHandler(this.plugin, this.inputContainer, this.contextManager);
		
		// Pass sidebar view reference for context operations
		this.inputHandler.setSidebarView(this);
		
		// Create the input interface using new InputHandler
		this.inputHandler.createInputInterface(this.chatContainer);
		
		// Create CommandSystem with the actual textArea from InputHandler
		this.commandSystem = new CommandSystem(this.plugin, this.inputContainer, this.inputHandler.getTextArea());
		
		// Connect the CommandSystem to the InputHandler
		this.inputHandler.setCommandSystem(this.commandSystem);
		
		// Set up send message callback
		this.inputHandler.setOnSendMessage((message: string) => {
			this.handleSend(message);
		});
		
		// Create context indicator and preview using ContextManager
		this.contextManager.createContextIndicator();
		
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
		if (!this.plugin.featureManager.isFeatureEnabled('commands')) {
			this.addMessage('system', this.createIconMessage('zap', 'Commands are currently in early access for Supernova supporters. Available to all users September 30, 2025.'));
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
		if (this.plugin.featureManager.isFeatureEnabled('commands')) {
			const customCommand = this.plugin.settings.customCommands?.find(cmd => cmd.trigger === command);
			if (customCommand) {
				// Execute custom command
				this.inputHandler.getTextArea().setValue(customCommand.template);
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
		const value = this.inputHandler.getTextArea().getValue();
		
		if (value.startsWith(':') && this.plugin.featureManager.isFeatureEnabled('commands')) {
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
		this.inputHandler.getTextArea().setValue(`:${trigger}`);
		this.hideCommandPicker();
		// Trigger the command immediately
		this.handleSend();
	}

	private getAvailableCommands(): Array<{trigger: string, name: string, description?: string}> {
		const commands: Array<{trigger: string, name: string, description?: string}> = [];

		// Check if user has text selected in active editor
		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		const selectedText = activeView?.editor?.getSelection();
		
		// If text is selected, prioritize Nova selection actions
		if (selectedText && selectedText.trim().length > 0) {
			SELECTION_ACTIONS.forEach(action => {
				commands.push({
					trigger: action.id,
					name: `Nova: ${action.label}`,
					description: action.description
				});
			});
			
			// Add separator comment (not a real command)
			commands.push({ trigger: '---', name: '─────────────', description: 'Provider Commands' });
		}

		// Add provider switching commands
		commands.push(
			{ trigger: 'claude', name: 'Switch to Claude', description: 'Anthropic Claude AI' },
			{ trigger: 'chatgpt', name: 'Switch to ChatGPT', description: 'OpenAI GPT models' },
			{ trigger: 'gemini', name: 'Switch to Gemini', description: 'Google Gemini AI' }
		);

		// Only add Ollama on desktop
		if (Platform.isDesktopApp) {
			commands.push({ trigger: 'ollama', name: 'Switch to Ollama', description: 'Local AI models' });
		}

		// Add custom commands if feature is enabled
		if (this.plugin.featureManager.isFeatureEnabled('commands')) {
			const customCommands = this.plugin.settings.customCommands || [];
			if (customCommands.length > 0) {
				commands.push({ trigger: '---', name: '─────────────', description: 'Custom Commands' });
				customCommands.forEach(cmd => {
					commands.push({
						trigger: cmd.trigger,
						name: cmd.name,
						...(cmd.description && { description: cmd.description })
					});
				});
			}
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
		if (!this.plugin.featureManager.isFeatureEnabled('commands')) {
			this.addMessage('system', this.createIconMessage('zap', 'Commands are currently in early access for Supernova supporters. Available to all users September 30, 2025.'));
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
			// Handle separator items
			if (command.trigger === '---') {
				const separator = this.commandMenu.createDiv({ cls: 'nova-command-menu-separator' });
				separator.style.cssText = `
					padding: 8px 16px 4px 16px;
					font-size: 0.75em;
					color: var(--text-muted);
					font-weight: 600;
					text-transform: uppercase;
					letter-spacing: 0.5px;
					border-top: 1px solid var(--background-modifier-border);
					margin-top: 4px;
					cursor: default;
				`;
				separator.textContent = command.description || '';
				return;
			}

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

	private async executeCommandFromMenu(trigger: string): Promise<void> {
		this.hideCommandMenu();
		
		// Check if this is a Nova selection action
		const selectionAction = SELECTION_ACTIONS.find(action => action.id === trigger);
		if (selectionAction) {
			// Handle selection action
			const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
			const selectedText = activeView?.editor?.getSelection();
			
			if (activeView?.editor && selectedText && selectedText.trim().length > 0) {
				// Use the existing selection context menu handler
				await this.selectionContextMenu.handleSelectionAction(trigger, activeView.editor, selectedText);
			} else {
				new Notice('No text selected. Please select text to use Nova editing commands.', 3000);
			}
			return;
		}
		
		// Skip separator items
		if (trigger === '---') {
			return;
		}
		
		// Execute regular command (provider switching, custom commands)
		this.inputHandler.getTextArea().setValue(`:${trigger}`);
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

		const message = this.inputHandler.getTextArea().getValue();
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
		
		if (!this.currentContext || !this.currentContext.persistentDocs) {
			this.contextIndicator.style.display = 'none';
			// Update input container state for mobile spacing
			if (this.inputHandler) {
				this.inputHandler.updateContextState(false);
			}
			return;
		}
		
		const allDocs = this.currentContext.persistentDocs;
		
		if (!allDocs || allDocs.length === 0) {
			this.contextIndicator.style.display = 'none';
			// Update input container state for mobile spacing
			if (this.inputHandler) {
				this.inputHandler.updateContextState(false);
			}
			return;
		}

		// Update input container state for mobile spacing
		if (this.inputHandler) {
			this.inputHandler.updateContextState(true);
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
		const docNames = allDocs.filter(doc => doc?.file?.basename).map(doc => doc.file.basename).slice(0, isMobile ? 1 : 2);
		const moreCount = allDocs.length > (isMobile ? 1 : 2) ? ` +${allDocs.length - (isMobile ? 1 : 2)}` : '';
		
		// Split into filename part and token part to ensure tokens are always visible
		summaryTextEl.style.cssText = 'font-weight: 500; color: var(--text-muted); flex: 1; pointer-events: none; display: flex; align-items: center; gap: 6px; min-width: 0;';
		
		// Create filename part that can truncate
		const filenamePartEl = summaryTextEl.createSpan();
		filenamePartEl.style.cssText = 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; flex: 1;';
		filenamePartEl.innerHTML = this.createInlineIcon('book-open') + ` ${docNames.join(', ')}${moreCount}`;
		
		// Create token part that always stays visible
		const tokenPartEl = summaryTextEl.createSpan();
		tokenPartEl.style.cssText = 'white-space: nowrap; flex-shrink: 0; margin-left: 8px;';
		if (isMobile) {
			tokenPartEl.textContent = `(${tokenPercent}%)`;
		} else {
			tokenPartEl.textContent = `(${tokenPercent}% tokens)`;
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
		
		// Clear all button using Obsidian trash icon
		const clearAllBtnComponent = new ButtonComponent(expandedHeaderEl);
		clearAllBtnComponent.setIcon('trash-2')
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
		
		allDocs.filter(doc => doc?.file?.basename).forEach((doc, index) => {
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
			iconEl.style.cssText = 'display: flex; align-items: center; font-size: 1em; flex-shrink: 0;';
			
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
				flex: 1;
				min-width: 0;
				margin-right: 8px;
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
				font-weight: 500;
				text-transform: uppercase;
				letter-spacing: 0.5px;
				flex-shrink: 0;
				margin-right: 8px;
			`;
			
			// Mobile-optimized remove button with simple reliable icon
			const removeBtn = docItemEl.createEl('button', { cls: 'nova-context-doc-remove' });
			removeBtn.textContent = '×';
			removeBtn.style.cssText = `
				background: none;
				border: none;
				color: var(--text-faint);
				cursor: pointer;
				width: ${isMobile ? '44px' : '20px'};
				height: ${isMobile ? '44px' : '20px'};
				border-radius: 4px;
				display: flex;
				align-items: center;
				justify-content: center;
				font-size: ${isMobile ? '18px' : '14px'};
				transition: all 0.2s;
				font-weight: normal;
				line-height: 1;
			`;
			removeBtn.setAttr('title', `Remove ${doc.file.basename}`);
			
			removeBtn.addEventListener('click', async (e: Event) => {
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
			try {
				// Don't call buildContext with empty message as it can interfere with persistent context
				// Instead, just get persistent context and build a minimal context object for UI display
				const persistentDocs = this.multiDocHandler.getPersistentContext(this.currentFile.path) || [];
				
				if (persistentDocs.length > 0) {
					// Build a minimal context object for UI display only
					this.currentContext = {
						persistentDocs: persistentDocs,
						contextString: '', // Not needed for UI
						tokenCount: 0, // Not needed for UI refresh
						isNearLimit: false
					};
				} else {
					this.currentContext = null;
				}
				
				this.updateContextIndicator();
			} catch (error) {
				// Handle context build failures gracefully
				this.currentContext = null;
				this.updateContextIndicator();
			}
		} else {
			// No current file - clear context
			this.currentContext = null;
			this.updateContextIndicator();
		}
	}

	private async handleSend(message?: string) {
		// Get message from parameter or from input handler
		const messageText = message || this.inputHandler.getValue().trim();
		if (!messageText) return;

		// Check if Nova is enabled and a provider is available
		const currentProviderType = await this.plugin.aiProviderManager.getCurrentProviderType();
		if (!currentProviderType) {
			this.addErrorMessage(this.createIconMessage('alert-circle', 'Nova is disabled or no AI provider is available. Please configure an AI provider in settings.'));
			return;
		}

		// Check for command system feature availability
		if (messageText.startsWith(':')) {
			const commandResult = await this.handleColonCommand(messageText);
			if (commandResult) {
				this.inputHandler.setValue('');
				return;
			}
		}

		// Check if multi-doc context feature is enabled and parse references
		let processedMessage = messageText;
		let multiDocContext: MultiDocContext | null = null;
		
		if (this.currentFile) {
			// Check for early access
			if (!this.plugin.featureManager.isFeatureEnabled('multi-doc-context')) {
				if (messageText.includes('[[')) {
					this.addMessage('system', this.createIconMessage('book-open', 'Multi-document context is currently in early access for Supernova supporters. Available to all users August 15, 2025.'));
					return;
				}
			} else {
				// Parse and build context
				const contextResult = await this.multiDocHandler.buildContext(messageText, this.currentFile);
				processedMessage = contextResult.cleanedMessage;
				multiDocContext = contextResult.context;
				this.currentContext = multiDocContext;
				
				// Update UI indicator
				this.updateContextIndicator();
				
				// Check if message is just document references (context-only mode)
				// Since all docs are now persistent, check if we have new docs and empty message
				const previousPersistentCount = this.currentContext?.persistentDocs?.length || 0;
				const currentPersistentCount = multiDocContext?.persistentDocs?.length || 0;
				const hasNewDocs = currentPersistentCount > previousPersistentCount;
				const isContextOnlyMessage = processedMessage.trim().length === 0 && hasNewDocs;
				
				if (isContextOnlyMessage) {
					// Handle context-only commands - show newly added documents
					const newDocsCount = currentPersistentCount - previousPersistentCount;
					if (newDocsCount > 0 && multiDocContext?.persistentDocs && multiDocContext.persistentDocs.length > 0) {
						// Get the newly added documents (last N documents)
						const newDocs = multiDocContext.persistentDocs.slice(-newDocsCount);
						const docNames = newDocs.filter(doc => doc?.file?.basename).map(doc => doc.file.basename).join(', ');
						if (docNames) {
							this.addSuccessMessage(this.createIconMessage('check-circle', `Added ${newDocsCount} document${newDocsCount !== 1 ? 's' : ''} to persistent context: ${docNames}`));
						}
					}
					
					// Clear input and update context indicator
					this.inputHandler.setValue('');
					this.updateContextIndicator();
					
					// Hide context preview since we're done
					if (this.contextPreview) {
						this.contextPreview.style.display = 'none';
					}
					return;
				}
				
				// Show context confirmation if documents were included in a regular message
				if (multiDocContext?.persistentDocs?.length > 0) {
					const allDocs = multiDocContext.persistentDocs;
					const docNames = allDocs.filter(doc => doc?.file?.basename).map(doc => doc.file.basename).join(', ');
					if (docNames && allDocs.length > 0) {
						const tokenInfo = multiDocContext.tokenCount > 0 ? ` (~${multiDocContext.tokenCount} tokens)` : '';
						const currentFile = this.currentFile?.basename || 'current file';
						this.addMessage('system', this.createIconMessage('book-open', `Included ${allDocs.length} document${allDocs.length !== 1 ? 's' : ''} in context: ${docNames}${tokenInfo}. Context documents are read-only; edit commands will only modify ${currentFile}.`));
					}
				}
				
				// Check token limit
				if (multiDocContext?.isNearLimit) {
					new Notice('⚠️ Approaching token limit. Consider removing some documents from context.', NovaSidebarView.NOTICE_DURATION_MS);
				}
			}
		}

		// Add user message (show original with references)
		this.addMessage('user', messageText);
		this.inputHandler.setValue('');
		
		// Hide context preview since we're sending the message
		if (this.contextPreview) {
			this.contextPreview.style.display = 'none';
		}
		
		// Disable send button during processing
		const sendButton = (this.inputHandler as any).sendButton;
		if (sendButton) sendButton.setDisabled(true);

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
				await this.plugin.documentEngine.addUserMessage(messageText);
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
					// Enhance system prompt to clarify context vs content distinction
					const enhancedSystemPrompt = (prompt.systemPrompt || '') + `

MULTI-DOCUMENT CONTEXT INSTRUCTIONS:
- You have access to multiple documents as REFERENCE CONTEXT ONLY
- These documents are for your understanding and background knowledge
- DO NOT echo, quote, or output content from these context documents unless specifically requested
- When responding, focus on the user's request, not the content of context documents
- Context documents are read-only; you can only edit the current working document
- If the user asks about context documents, you may reference and discuss their content`;

					const enhancedUserPrompt = `REFERENCE CONTEXT (for your understanding only):
${multiDocContext.contextString}

---

USER REQUEST: ${processedMessage}`;
					
					// Get AI response using the provider manager
					response = await this.plugin.aiProviderManager.complete(enhancedSystemPrompt, enhancedUserPrompt, {
						temperature: prompt.config.temperature,
						maxTokens: prompt.config.maxTokens
					});
				} else {
					// Get AI response using the provider manager
					response = await this.plugin.aiProviderManager.complete(prompt.systemPrompt || '', prompt.userPrompt, {
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
					filteredResponse.includes('Failed to') ||
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
			// Re-enable send button
			const sendButton = (this.inputHandler as any).sendButton;
			if (sendButton) sendButton.setDisabled(false);
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
				// Make the conversation file active before executing commands (without forcing focus)
				this.app.workspace.setActiveLeaf(markdownView.leaf, { focus: false });
				
				// Wait for workspace transition to complete before proceeding
				await new Promise(resolve => setTimeout(resolve, 50));
				
				// Double-check that the file is now active
				const nowActiveFile = this.app.workspace.getActiveFile();
				if (!nowActiveFile || nowActiveFile !== this.currentFile) {
					return this.createIconMessage('x-circle', `Unable to set "${this.currentFile.basename}" as the active file. Edit commands can only modify the file you're chatting about to prevent accidental changes to context documents.`);
				}
			}
			
			// Save current cursor position before executing command (in case editor-change event missed it)
			const currentPos = this.plugin.documentEngine.getCursorPosition();
			if (currentPos) {
				this.currentFileCursorPosition = currentPos;
			}
			
			// Restore cursor position for this file before executing command
			// This now happens AFTER workspace has switched to ensure correct file is active
			this.restoreCursorPosition();
			
			let result;
			
			switch (command.action) {
				case 'add':
					result = await this.executeAddCommandWithStreaming(command);
					break;
				case 'edit':
					result = await this.executeEditCommandWithStreaming(command);
					break;
				case 'delete':
					result = await this.plugin.deleteCommandHandler.execute(command);
					break;
				case 'grammar':
					result = await this.executeGrammarCommandWithStreaming(command);
					break;
				case 'rewrite':
					result = await this.executeRewriteCommandWithStreaming(command);
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
		
		// Clear cursor tracking when switching to a new file
		this.currentFileCursorPosition = null;
		
		this.currentFile = targetFile;
		
		// Immediately track cursor position for the newly active file
		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (activeView && activeView.editor) {
			this.trackCursorPosition(activeView.editor);
		}
		
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
			await this.plugin.aiProviderManager.complete(prompt.systemPrompt || '', prompt.userPrompt);
			
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
	 * Update send button enabled/disabled state based on provider availability
	 */
	private async updateSendButtonState(): Promise<void> {
		const currentProviderType = await this.plugin.aiProviderManager.getCurrentProviderType();
		const sendButton = (this.inputHandler as any).sendButton;
		if (sendButton) sendButton.setDisabled(!currentProviderType);
	}

	/**
	 * Update privacy indicator icon and tooltip based on current provider
	 */
	private async updatePrivacyIndicator(privacyIndicator: HTMLElement): Promise<void> {
		const currentProviderType = await this.plugin.aiProviderManager.getCurrentProviderType();
		
		if (currentProviderType) {
			const isLocalProvider = currentProviderType === 'ollama';
			const iconName = isLocalProvider ? 'lock' : 'unlock';
			const tooltip = isLocalProvider ? 'Local processing - data stays on your device' : 'Cloud processing - data sent to provider';
			
			// Use Obsidian's setIcon function (same as ButtonComponent uses internally)
			setIcon(privacyIndicator, iconName);
			
			// Set tooltip
			privacyIndicator.setAttribute('aria-label', tooltip);
			privacyIndicator.setAttribute('title', tooltip);
		} else {
			// No provider available - show generic privacy icon
			setIcon(privacyIndicator, 'help-circle');
			privacyIndicator.setAttribute('aria-label', 'No provider selected');
			privacyIndicator.setAttribute('title', 'No provider selected');
		}
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
		// Update privacy indicator if it exists
		if ((this as any).privacyIndicator) {
			await this.updatePrivacyIndicator((this as any).privacyIndicator);
		}

		// Update send button state
		this.updateSendButtonState();

		// Update dropdown provider name if it exists
		if ((this as any).currentProviderDropdown?.updateCurrentProvider) {
			await (this as any).currentProviderDropdown.updateCurrentProvider();
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
			color: var(--text-normal);
			background: var(--background-primary);
			border: 1px solid var(--background-modifier-border);
			border-radius: 4px;
			cursor: pointer;
			transition: background-color 0.2s ease;
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
			const currentProviderType = await this.plugin.aiProviderManager.getCurrentProviderType();
			if (currentProviderType) {
				const displayText = this.getProviderWithModelDisplayName(currentProviderType);
				providerName.setText(displayText);
			} else {
				const currentProviderName = await this.plugin.aiProviderManager.getCurrentProviderName();
				providerName.setText(currentProviderName);
			}
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
		return getAvailableModels(providerType, this.plugin.settings);
	}

	/**
	 * Get current model for a provider type
	 */
	private getCurrentModel(providerType: string): string {
		const providers = this.plugin.settings.aiProviders as Record<string, any>;
		const currentModel = providers[providerType]?.model;
		
		if (currentModel) {
			return currentModel;
		}
		
		// Get default model (first available model for the provider)
		const availableModels = this.getAvailableModels(providerType);
		return availableModels.length > 0 ? availableModels[0].value : '';
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
				color: var(--text-normal);
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
						color: var(--text-normal);
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
			</svg>`,
			'trash-2': `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: ${size}; height: ${size};">
				<path d="M3 6H5H21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
				<path d="M8 6V4A2 2 0 0 1 10 2H14A2 2 0 0 1 16 4V6M19 6V20A2 2 0 0 1 17 22H7A2 2 0 0 1 5 20V6H19Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
				<path d="M10 11V17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
				<path d="M14 11V17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
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
		// Command button is gated behind the commands feature 
		if (!this.plugin.featureManager.isFeatureEnabled('commands')) {
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
		if (this.inputHandler) {
			this.inputHandler.refreshCommandButton();
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

	/**
	 * Execute add command with streaming support
	 */
	private async executeAddCommandWithStreaming(command: EditCommand): Promise<any> {
		try {
			// Get the active editor
			const editor = this.plugin.documentEngine.getActiveEditor();
			if (!editor) {
				return {
					success: false,
					error: 'No active editor found'
				};
			}

			// Get cursor position for streaming
			const cursorPosition = this.plugin.documentEngine.getCursorPosition();
			if (!cursorPosition) {
				return {
					success: false,
					error: 'Could not determine cursor position'
				};
			}

			// Show thinking notice with 'add' action type
			this.streamingManager.showThinkingNotice('add');

			// Start streaming at cursor position
			const { updateStream, stopStream } = this.streamingManager.startStreaming(
				editor,
				cursorPosition
			);

			try {
				// Execute add command with streaming callback
				const result = await this.plugin.addCommandHandler.execute(command, (chunk: string, isComplete: boolean) => {
					updateStream(chunk, isComplete);
				});

				// Stop streaming
				stopStream();

				return result;

			} catch (error) {
				// Stop streaming on error
				stopStream();
				throw error;
			}

		} catch (error) {
			console.error('Error in streaming add command:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			};
		}
	}

	/**
	 * Execute edit command with streaming support
	 */
	private async executeEditCommandWithStreaming(command: EditCommand): Promise<any> {
		try {
			// Get the active editor
			const editor = this.plugin.documentEngine.getActiveEditor();
			if (!editor) {
				return {
					success: false,
					error: 'No active editor found'
				};
			}

			// Get cursor position for streaming
			const cursorPosition = this.plugin.documentEngine.getCursorPosition();
			if (!cursorPosition) {
				return {
					success: false,
					error: 'Could not determine cursor position'
				};
			}

			// Show thinking notice with 'edit' action type
			this.streamingManager.showThinkingNotice('edit');

			// Start streaming at cursor position
			const { updateStream, stopStream } = this.streamingManager.startStreaming(
				editor,
				cursorPosition
			);

			try {
				// Execute edit command with streaming callback
				const result = await this.plugin.editCommandHandler.execute(command, (chunk: string, isComplete: boolean) => {
					updateStream(chunk, isComplete);
				});

				// Stop streaming
				stopStream();

				return result;

			} catch (error) {
				// Stop streaming on error
				stopStream();
				throw error;
			}

		} catch (error) {
			console.error('Error in streaming edit command:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			};
		}
	}

	/**
	 * Execute rewrite command with streaming support
	 */
	private async executeRewriteCommandWithStreaming(command: EditCommand): Promise<any> {
		try {
			// Get the active editor
			const editor = this.plugin.documentEngine.getActiveEditor();
			if (!editor) {
				return {
					success: false,
					error: 'No active editor found'
				};
			}

			// Get cursor position for streaming
			const cursorPosition = this.plugin.documentEngine.getCursorPosition();
			if (!cursorPosition) {
				return {
					success: false,
					error: 'Could not determine cursor position'
				};
			}

			// Show thinking notice with 'rewrite' action type
			this.streamingManager.showThinkingNotice('rewrite');

			// Start streaming at cursor position
			const { updateStream, stopStream } = this.streamingManager.startStreaming(
				editor,
				cursorPosition
			);

			try {
				// Execute rewrite command with streaming callback
				const result = await this.plugin.rewriteCommandHandler.execute(command, (chunk: string, isComplete: boolean) => {
					updateStream(chunk, isComplete);
				});

				// Stop streaming
				stopStream();

				return result;

			} catch (error) {
				// Stop streaming on error
				stopStream();
				throw error;
			}

		} catch (error) {
			console.error('Error in streaming rewrite command:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			};
		}
	}

	/**
	 * Execute grammar command with streaming support
	 */
	private async executeGrammarCommandWithStreaming(command: EditCommand): Promise<any> {
		try {
			// Get the active editor
			const editor = this.plugin.documentEngine.getActiveEditor();
			if (!editor) {
				return {
					success: false,
					error: 'No active editor found'
				};
			}

			// Get cursor position for streaming
			const cursorPosition = this.plugin.documentEngine.getCursorPosition();
			if (!cursorPosition) {
				return {
					success: false,
					error: 'Could not determine cursor position'
				};
			}

			// Show thinking notice with 'grammar' action type
			this.streamingManager.showThinkingNotice('grammar');

			// Start streaming at cursor position
			const { updateStream, stopStream } = this.streamingManager.startStreaming(
				editor,
				cursorPosition
			);

			try {
				// Execute grammar command with streaming callback
				const result = await this.plugin.grammarCommandHandler.execute(command, (chunk: string, isComplete: boolean) => {
					updateStream(chunk, isComplete);
				});

				// Stop streaming
				stopStream();

				return result;

			} catch (error) {
				// Stop streaming on error
				stopStream();
				throw error;
			}

		} catch (error) {
			console.error('Error in streaming grammar command:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			};
		}
	}

	/**
	 * Add files to persistent context
	 */
	async addFilesToContext(filenames: string[]): Promise<void> {
		if (!this.currentFile) {
			new Notice('No file is open. Please open a file to add context.', 3000);
			return;
		}

		const addedFiles: string[] = [];
		const alreadyExistingFiles: string[] = [];
		const notFoundFiles: string[] = [];
		
		// Get existing persistent context directly (without clearing it)
		const existingPersistent = this.multiDocHandler.getPersistentContext(this.currentFile.path) || [];
		const updatedPersistent = [...existingPersistent];
		
		
		for (const filename of filenames) {
			// Find the file by name
			let file = this.app.vault.getAbstractFileByPath(filename);
			if (!file || !(file instanceof TFile)) {
				file = this.app.vault.getAbstractFileByPath(filename + '.md');
			}
			if (!file || !(file instanceof TFile)) {
				const files = this.app.vault.getMarkdownFiles();
				file = files.find(
					(f) => f.basename === filename || f.name === filename || f.path.endsWith('/' + filename) || f.path.endsWith('/' + filename + '.md')
				) || null;
			}
			
			if (file instanceof TFile) {
				// Check if already in persistent context (check both existing and newly added in this batch)
				const exists = updatedPersistent.some(ref => ref.file.path === (file as TFile).path);
				if (!exists) {
					// Add to persistent context
					updatedPersistent.push({
						file: file,
						property: undefined,
						isPersistent: true,
						rawReference: `+[[${file.basename}]]`
					});
					addedFiles.push(file.basename);
				} else {
					// File already exists in context
					alreadyExistingFiles.push(file.basename);
				}
			} else {
				// File not found
				notFoundFiles.push(filename);
			}
		}
		
		// Update persistent context if we made any changes
		if (addedFiles.length > 0 || alreadyExistingFiles.length > 0) {
			// Use reflection to access private property (since TypeScript doesn't expose it)
			const handler = this.multiDocHandler as any;
			handler.persistentContext.set(this.currentFile.path, updatedPersistent);
		}
		
		// Refresh context UI
		await this.refreshContext();
		
		// Show a single comprehensive notification for better UX
		const totalFiles = filenames.length;
		const messages: string[] = [];
		
		if (addedFiles.length > 0) {
			if (addedFiles.length === 1) {
				messages.push(`Added "${addedFiles[0]}" to context`);
			} else {
				messages.push(`Added ${addedFiles.length} files to context`);
			}
		}
		
		if (alreadyExistingFiles.length > 0) {
			if (alreadyExistingFiles.length === 1) {
				messages.push(`"${alreadyExistingFiles[0]}" already in context`);
			} else {
				messages.push(`${alreadyExistingFiles.length} already in context`);
			}
		}
		
		if (notFoundFiles.length > 0) {
			if (notFoundFiles.length === 1) {
				messages.push(`"${notFoundFiles[0]}" not found`);
			} else {
				messages.push(`${notFoundFiles.length} not found`);
			}
		}
		
		// Show single combined message if we have any results
		if (messages.length > 0) {
			const combinedMessage = messages.join(', ');
			const duration = notFoundFiles.length > 0 ? 3000 : 2000; // Longer duration if there are errors
			new Notice(combinedMessage, duration);
		}
	}

}