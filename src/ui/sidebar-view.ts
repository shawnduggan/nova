/**
 * @file NovaSidebarView - Main sidebar view with chat interface
 */

import { ItemView, WorkspaceLeaf, ButtonComponent, TFile, Notice, MarkdownView, Platform, setIcon, EditorPosition, DropdownComponent } from 'obsidian';
import { DocumentAnalyzer } from '../core/document-analysis';
import NovaPlugin from '../../main';
import { EditCommand, EditResult } from '../core/types';
import { MultiDocContext } from './context-manager';
import { getAvailableModels, getProviderTypeForModel } from '../ai/models';
import { ProviderType } from '../ai/types';
import { InputHandler } from './input-handler';
import { CommandSystem } from './command-system';
import { ContextManager } from './context-manager';
import { ChatRenderer } from './chat-renderer';
import { StreamingManager } from './streaming-manager';
import { SelectionContextMenu, SELECTION_ACTIONS } from './selection-context-menu';
import { formatContextUsage, getContextWarningLevel, getContextTooltip } from '../core/context-calculator';
import { Logger } from '../utils/logger';
import { TimeoutManager } from '../utils/timeout-manager';
import {
	SIDEBAR_PROCESSING_EVENT,
	SIDEBAR_CHAT_MESSAGE_EVENT,
	SidebarProcessingEvent,
	SidebarChatMessageEvent
} from './sidebar-events';
import { ContextQuickPanel } from './context-quick-panel';
import { ContextDocumentList } from './context-document-list';

export const VIEW_TYPE_NOVA_SIDEBAR = 'nova-sidebar';

export class NovaSidebarView extends ItemView {
	plugin: NovaPlugin;
	private chatContainer!: HTMLElement;
	private inputContainer!: HTMLElement;
	private currentFile: TFile | null = null;
	private currentContext: MultiDocContext | null = null;
	private lastTokenWarnings: { [key: string]: number } = {};
	
	// PHASE 3 FIX: Race condition prevention
	private currentFileLoadOperation: string | null = null;
	
	// Track user-initiated provider changes to prevent spurious messages
	private isUserInitiatedProviderChange: boolean = false;
	
	// New architecture components
	public inputHandler!: InputHandler;
	private commandSystem!: CommandSystem;
	private contextManager!: ContextManager;
	public chatRenderer!: ChatRenderer;
	private streamingManager!: StreamingManager;
	private selectionContextMenu!: SelectionContextMenu;
	private contextQuickPanel!: ContextQuickPanel;
	private contextDocumentList!: ContextDocumentList;
	private providerDropdown: DropdownComponent | null = null;
	private rotationIntervals = new WeakMap<HTMLElement, number>();
	
	// Cursor-only architecture - delegate to new components
	private get textArea() { return this.inputHandler?.getTextArea(); }
	private get wikilinkAutocomplete() { return this.inputHandler ? { destroy: () => {} } : null; }
	private get autoGrowTextarea() { return () => {}; }
	
	// Command system delegation
	private _commandPickerItems: HTMLElement[] = [];
	private get commandPickerItems() { return this._commandPickerItems; }
	private set commandPickerItems(value: HTMLElement[]) { this._commandPickerItems = value; }
	private _selectedCommandIndex: number = -1;
	private get selectedCommandIndex() { return this._selectedCommandIndex; }
	private set selectedCommandIndex(value: number) { this._selectedCommandIndex = value; }
	private _isCommandMenuVisible: boolean = false;
	private get isCommandMenuVisible() { return this._isCommandMenuVisible; }
	private set isCommandMenuVisible(value: boolean) { this._isCommandMenuVisible = value; }
	
	// Context system delegation
	private get contextPreview() { return this.contextManager?.contextPreview; }
	private get contextIndicator() { return this.contextManager?.contextIndicator; }
	
	// Component references
	private commandPicker!: HTMLElement;
	private commandMenu!: HTMLElement;
	private commandButton!: ButtonComponent;
	private privacyIndicator?: HTMLElement;
	
	// Cursor position tracking - file-scoped like conversation history
	private currentFileCursorPosition: EditorPosition | null = null;
	
	// Abort controller for cancelling ongoing AI operations
	private currentAbortController: AbortController | null = null;

	// Performance optimization - timing constants
	private static readonly SCROLL_DELAY_MS = 50;
	private static readonly FOCUS_DELAY_MS = 150;

	// Thinking phrase rotation intervals - WeakMap for proper cleanup
	private thinkingRotationIntervals = new WeakMap<HTMLElement, number>();
	private static readonly NOTICE_DURATION_MS = 5000;
	
	// Event listener cleanup is handled automatically by registerDomEvent
	private timeoutManager = new TimeoutManager();

	constructor(leaf: WorkspaceLeaf, plugin: NovaPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType() {
		return VIEW_TYPE_NOVA_SIDEBAR;
	}

	getDisplayText() {
		return 'Nova';
	}

	getIcon() {
		return 'nova-star';
	}

	/**
	 * Centralized callback for when any streaming operation completes
	 * Updates all UI elements that depend on document content
	 */
	private onStreamingComplete(): void {
		// Update document stats and context remaining
		// Using void to explicitly mark as intentional floating promise (fire-and-forget)
		void this.refreshAllStats();
		// Refresh context indicators
		void this.refreshContext();
	}

	async onOpen() {
		// Register DOM events for cross-component communication
		// Must be in onOpen() — view container doesn't exist during construction
		this.registerDomEvent(document, 'nova-provider-configured' as keyof DocumentEventMap, this.handleProviderConfigured.bind(this));
		this.registerDomEvent(document, 'nova-provider-disconnected' as keyof DocumentEventMap, this.handleProviderDisconnected.bind(this));
		this.registerDomEvent(document, 'nova-license-updated' as keyof DocumentEventMap, this.handleLicenseUpdated.bind(this));

		// Sidebar event bus — decoupled communication from SelectionContextMenu
		this.registerDomEvent(document, SIDEBAR_PROCESSING_EVENT as keyof DocumentEventMap, this.handleSidebarProcessing.bind(this));
		this.registerDomEvent(document, SIDEBAR_CHAT_MESSAGE_EVENT as keyof DocumentEventMap, this.handleSidebarChatMessage.bind(this));

		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.addClass('nova-sidebar-container');
		
		// Add platform-specific class for styling
		if (Platform.isMobile) {
			container.addClass('is-mobile');
		} else {
			container.addClass('is-desktop');
		}

		// Mobile access is now available to all users with their own API keys
		
		// Create wrapper with proper flex layout
		const wrapperEl = container.createDiv({ cls: 'nova-wrapper nova-sidebar-wrapper' });
		
		// Header with provider info
		const headerEl = wrapperEl.createDiv({ cls: 'nova-header nova-sidebar-header' });
		
		// Top row container for title and controls
		const topRowEl = headerEl.createDiv({ cls: 'nova-header-top-row' });

		// Left side: Title with Nova icon
		const titleEl = topRowEl.createDiv({ cls: 'nova-header-title' });
		
		// Use setIcon for the Nova icon (simpler and more reliable)
		const iconEl = titleEl.createSpan();
		setIcon(iconEl, 'nova-star');
		
		titleEl.createSpan({ text: ' Nova' });
		
		// Right side: Provider status and Clear button
		const rightContainer = topRowEl.createDiv({ cls: 'nova-header-right-container' });
		
		// All users can switch providers freely
		await this.createProviderDropdown(rightContainer);
		
		// Clear Chat button in right container
		const clearButton = new ButtonComponent(rightContainer);
		clearButton.setIcon('eraser')
			.setTooltip('Clear conversation history')
			.onClick(() => this.clearChat());
		
		// Apply consistent styling to match delete all files button
		clearButton.buttonEl.addClass('nova-clear-button');

		this.createChatInterface(wrapperEl);
		this.createInputInterface(wrapperEl);
		
		// Register global document click handler for context drawer - do this once during initialization
		this.setupContextDrawerCloseHandler();
		
		// Register event listener for active file changes
		this.registerEvent(
			this.app.workspace.on('active-leaf-change', () => {
				this.loadConversationForActiveFile().catch(error => {
					Logger.error('Failed to load conversation on file change:', error);
				});
			})
		);
		
		// Register cursor position tracking for the active editor
		this.registerEvent(
			this.app.workspace.on('editor-change', (editor) => {
				this.trackCursorPosition(editor);
			})
		);
		
		// Register blur listener for stats updates when editor loses focus
		this.setupEditorBlurListener();
		
		// Load conversation for current file
		this.loadConversationForActiveFile().catch(error => {
			Logger.error('Failed to load conversation on open:', error);
		});
		
		// Set completion callback on plugin's selection context menu
		if (this.plugin.selectionContextMenu) {
			this.plugin.selectionContextMenu.setCompletionCallback(() => this.onStreamingComplete());
		}
		
		// Initial status refresh to ensure all indicators are up to date (not user-initiated)
		this.isUserInitiatedProviderChange = false;
		await this.refreshProviderStatus();
		
		// Note: Auto-focus removed to prevent stealing cursor from editor
	}

	/**
	 * Track cursor position changes in the active editor (file-scoped)
	 */
	private trackCursorPosition(editor: { getCursor: () => EditorPosition | null }) {
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

	/**
	 * Setup focus-based stats updates using Nova input focus as trigger
	 */
	private setupEditorBlurListener(): void {
		// Instead of trying to capture editor blur (which is unreliable), 
		// listen for Nova input focus - this means user moved from editor to chat
		const inputElement = this.inputHandler?.getTextArea()?.inputEl;
		if (inputElement) {
			this.registerDomEvent(inputElement, 'focus', () => {
				this.refreshAllStats().catch(error => {
					Logger.error('Failed to refresh stats on input focus:', error);
				});
			});
		}
		
		// Also update stats when Nova sidebar gains focus (click anywhere in sidebar)
		this.registerDomEvent(this.containerEl, 'mousedown', () => {
			// Small delay to ensure click is processed
			this.timeoutManager.addTimeout(() => {
				this.refreshAllStats().catch(error => {
					Logger.error('Failed to refresh stats on sidebar click:', error);
				});
			}, 50);
		});
	}

	async onClose() {
		// Clean up provider dropdown event listener
		// Cleanup dropdown component (handled by Obsidian)
		await Promise.resolve(); // Keep async to match Obsidian's ItemView interface
		this.providerDropdown = null;

		// Clean up wikilink autocomplete
		if (this.wikilinkAutocomplete) {
			this.wikilinkAutocomplete.destroy();
		}

		// Clean up tracked event listeners
		this.cleanupEventListeners();

		// Clear all timeouts
		this.clearTimeouts();

		// Clean up DOM elements
		this.cleanupDOMElements();
	}
	
	/**
	 * Add event listener using Obsidian's registration system
	 */
	private addTrackedEventListener<K extends keyof HTMLElementEventMap>(element: EventTarget, event: K, handler: (this: HTMLElement, ev: HTMLElementEventMap[K]) => void): void {
		this.registerDomEvent(element as HTMLElement, event, handler);
	}
	
	/**
	 * Clean up all tracked event listeners
	 */
	private cleanupEventListeners(): void {
		// Event listener cleanup is handled automatically by registerDomEvent
	}
	
	/**
	 * Clear all tracked timeouts
	 */
	private clearTimeouts(): void {
		this.timeoutManager.clearAll();
	}
	
	/**
	 * Clean up DOM elements
	 */
	private cleanupDOMElements(): void {
		// Cleanup is now handled by individual component cleanup methods
	}

	private createChatInterface(container: HTMLElement) {
		this.chatContainer = container.createDiv({ cls: 'nova-chat-container nova-chat-flex-container' });

		// Initialize chatRenderer now that chatContainer exists
		this.chatRenderer = new ChatRenderer(this.plugin, this.chatContainer);

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
		
		// Initialize context manager and streaming manager
		this.contextManager = new ContextManager(this.plugin, this.app, this.inputContainer);
		this.streamingManager = new StreamingManager(this.plugin);
		
		// Get reference to plugin's selection context menu (will set callback later)
		this.selectionContextMenu = this.plugin.selectionContextMenu;
		
		// Create InputHandler which will handle all input UI creation
		this.inputHandler = new InputHandler(this.plugin, this.inputContainer, this.contextManager);
		
		// Pass sidebar view reference for context operations
		this.inputHandler.setSidebarView(this);
		this.contextManager.setSidebarView({ addWarningMessage: this.addWarningMessage.bind(this) });
		
		// Create the input interface using new InputHandler
		this.inputHandler.createInputInterface(this.chatContainer);
		
		// Always create CommandSystem - FeatureManager handles enablement
		this.commandSystem = new CommandSystem(this.plugin, this.inputContainer, this.inputHandler.getTextArea());

		// Connect the CommandSystem to the InputHandler
		this.inputHandler.setCommandSystem(this.commandSystem);
		
		// Set up send message callback
		this.inputHandler.setOnSendMessage((message: string) => {
			this.handleSend(message).catch(error => { Logger.error('Failed to handle send:', error); });
		});

		// Set up cancel operation callback
		this.inputHandler.setOnCancelOperation(() => {
			this.currentAbortController?.abort();
			this.plugin.cancelAllOperations();
		});

		// Create context indicator and preview using ContextManager
		this.contextManager.createContextIndicator();

		// Initialize extracted subcomponents
		this.contextQuickPanel = new ContextQuickPanel({
			app: this.app,
			inputContainer: this.inputContainer,
			inputHandler: this.inputHandler,
			contextManager: this.contextManager,
			timeoutManager: this.timeoutManager,
			getCurrentFile: () => this.currentFile
		});

		this.contextDocumentList = new ContextDocumentList({
			contextManager: this.contextManager,
			inputHandler: this.inputHandler,
			timeoutManager: this.timeoutManager,
			registerDomEvent: this.registerDomEvent.bind(this),
			getCurrentFile: () => this.currentFile,
			getCurrentContext: () => this.currentContext,
			refreshContext: () => this.refreshContext()
		});
	}


	// REPLACE with simple delegation to ChatRenderer:
	private addSuccessMessage(content: string): void {
		this.chatRenderer.addSuccessMessage(content, true); // Always persist
	}

	private addErrorMessage(content: string): void {
		this.chatRenderer.addErrorMessage(content, true); // Always persist  
	}

	private addWelcomeMessage(message?: string): void {
		this.chatRenderer.addWelcomeMessage(message);
	}

	private addSuccessIndicator(action: string) {
		// Use unified system instead of dynamic styling
		const messages = {
			'add': '✓ Content added',
			'edit': '✓ Content edited', 
			'delete': '✓ Content deleted',
			'grammar': '✓ Grammar fixed',
			'rewrite': '✓ Content rewritten'
		};
		
		const message = messages[action as keyof typeof messages] || '✓ Command completed';
		this.addSuccessMessage(message);
	}

	private addErrorIndicator(action: string, error?: string) {
		// Use unified system for error messages matching success messages
		const messages = {
			'add': '❌ Failed to add content',
			'edit': '❌ Failed to edit content', 
			'delete': '❌ Failed to delete content',
			'grammar': '❌ Failed to fix grammar',
			'rewrite': '❌ Failed to rewrite content',
			'execute': '❌ Command execution error'
		};
		
		let message = messages[action as keyof typeof messages] || '❌ Command failed';
		if (error) {
			message += `: ${error}`;
		}
		this.addErrorMessage(message);
	}

	private async handleColonCommand(message: string): Promise<boolean> {
		// Check if command system feature is enabled
		if (!this.plugin.featureManager.isFeatureEnabled('smartfill')) {
			this.addErrorMessage('Smart fill is currently in early access for Supernova supporters. Available to all users December 30, 2025.');
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
			this.plugin.settingTab.setCurrentModel(providerId);
			await this.plugin.saveSettings();
			this.addSuccessMessage(`✓ Switched to ${this.getProviderWithModelDisplayName(providerId)}`);
			return true;
		}

		// Check for custom commands (if feature enabled)
		if (this.plugin.featureManager.isFeatureEnabled('smartfill')) {
			const customCommand = this.plugin.settings.features?.smartfill?.customCommands?.find(cmd => cmd.trigger === command);
			if (customCommand) {
				// Execute custom command
				this.inputHandler.getTextArea().setValue(customCommand.template);
				// Trigger auto-grow after setting template
				this.timeoutManager.addTimeout(() => this.autoGrowTextarea(), 0);
				this.addSuccessMessage(`✓ Loaded template: ${customCommand.name}`);
				return true;
			}
		}

		// Unknown command
		this.addErrorMessage(`❌ Unknown command ':${command}'. Try :claude, :chatgpt, :gemini, or :ollama`);
		return true;
	}

	private createCommandPicker(): void {
		this.commandPicker = this.inputContainer.createDiv({ cls: 'nova-command-picker nova-panel-base nova-command-picker-panel' });
	}

	private handleInputChange(): void {
		const value = this.inputHandler.getTextArea().getValue();
		
		if (value.startsWith(':') && this.plugin.featureManager.isFeatureEnabled('smartfill')) {
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

			if (command.description) {
				const descEl = item.createSpan({ cls: 'nova-command-desc nova-panel-muted' });
				descEl.textContent = command.description;
			}

			this.registerDomEvent(item, 'click', () => {
				this.selectCommand(command.trigger);
			});

			this.registerDomEvent(item, 'mouseenter', () => {
				this.setSelectedCommand(index);
			});

			this.commandPickerItems.push(item);
		});

		this.commandPicker.addClass('show');
	}

	private hideCommandPicker(): void {
		this.commandPicker.removeClass('show');
		this.selectedCommandIndex = -1;
	}

	private isCommandPickerVisible(): boolean {
		return this.commandPicker.hasClass('show');
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
		this.handleSend().catch(error => { Logger.error('Failed to handle send:', error); });
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
					name: action.label,
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
		if (this.plugin.featureManager.isFeatureEnabled('smartfill')) {
			const customCommands = this.plugin.settings.features?.smartfill?.customCommands || [];
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
		this.commandMenu = this.inputContainer.createDiv({ cls: 'nova-command-menu nova-panel-base nova-command-menu-panel' });

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
		if (!this.plugin.featureManager.isFeatureEnabled('smartfill')) {
			this.addErrorMessage('Smart fill is currently in early access for Supernova supporters. Available to all users December 30, 2025.');
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
		const iconEl = headerEl.createSpan();
		setIcon(iconEl, 'zap');
		headerEl.createSpan({ text: ' Commands' });

		// Commands list
		commands.forEach(command => {
			// Handle separator items
			if (command.trigger === '---') {
				const separator = this.commandMenu.createDiv({ cls: 'nova-command-menu-separator' });
				separator.textContent = command.description || '';
				return;
			}

			const item = this.commandMenu.createDiv({ cls: 'nova-command-menu-item nova-panel-item-vertical' });

			const nameEl = item.createDiv({ cls: 'nova-command-menu-name nova-panel-text' });
			nameEl.textContent = command.name;

			const triggerEl = item.createDiv({ cls: 'nova-command-menu-trigger nova-panel-trigger nova-command-trigger-opacity' });
			triggerEl.textContent = `:${command.trigger}`;

			if (command.description) {
				const descEl = item.createDiv({ cls: 'nova-command-menu-desc nova-panel-muted' });
				descEl.textContent = command.description;
			}

			this.registerDomEvent(item, 'click', () => {
				this.executeCommandFromMenu(command.trigger).catch(error => { Logger.error('Failed to execute command from menu:', error); });
			});
		});

		this.commandMenu.addClass('show');
		this.isCommandMenuVisible = true;
	}

	private hideCommandMenu(): void {
		this.commandMenu.removeClass('show');
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
		this.handleSend().catch(error => { Logger.error('Failed to handle send:', error); });
	}


	private createContextPreview(): HTMLElement {
		return this.contextQuickPanel.createPreview();
	}

	/**
	 * Debounced version of updateLiveContextPreview for performance
	 */
	private debouncedUpdateContextPreview(): void {
		this.contextQuickPanel.debouncedUpdate();
	}

	private updateLiveContextPreview(): void {
		this.contextQuickPanel.updatePreview();
	}

	private findFileByName(nameOrPath: string): TFile | null {
		// First try exact path match
		let file = this.app.vault.getFileByPath(nameOrPath);
		
		if (!file) {
			// Try with .md extension
			file = this.app.vault.getFileByPath(nameOrPath + '.md');
		}
		
		if (!file) {
			// Use MetadataCache for efficient linkpath resolution instead of iterating all files
			file = this.app.metadataCache.getFirstLinkpathDest(nameOrPath, '');
		}
		
		return file instanceof TFile ? file : null;
	}

	/**
	 * Set up the global document click handler for closing the context drawer
	 * This is registered once during initialization to prevent memory leaks
	 */
	private setupContextDrawerCloseHandler(): void {
		this.contextDocumentList.setupCloseHandler();
	}

	private updateContextIndicator(): void {
		this.contextDocumentList.update();
	}

	private async refreshContext(): Promise<void> {
		if (this.currentFile) {
			// Ensure ContextManager is tracking the current file (only if not already tracking)
			if (this.contextManager.getCurrentFilePath() !== this.currentFile.path) {
				this.contextManager.setCurrentFile(this.currentFile);
			}
			
			try {
				// Use the ContextManager's buildContext method which includes total context calculation
				// Pass empty message since we're just refreshing the display
				this.currentContext = await this.contextManager.buildContext('', this.currentFile);
				
				this.updateContextIndicator();
				this.updateTokenDisplay();
			} catch (error) {
				// Handle context build failures gracefully
				Logger.warn('Failed to refresh context:', error);
				this.currentContext = null;
				this.updateContextIndicator();
				this.updateTokenDisplay();
			}
		} else {
			// No current file - clear context
			this.currentContext = null;
			this.contextManager.setCurrentFile(null);
			this.updateContextIndicator();
			this.updateTokenDisplay();
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

		// Parse document references and build multi-doc context
		let processedMessage = messageText;
		let multiDocContext: MultiDocContext | null = null;
		
		if (this.currentFile) {
			// Parse and build context
			const context = await this.contextManager.buildContext(messageText, this.currentFile);
			const contextResult = context ? { cleanedMessage: '', context } : null;
			processedMessage = contextResult?.cleanedMessage || messageText;
			multiDocContext = contextResult?.context || null;
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
					this.contextPreview.removeClass('show');
				}
				return;
			}
			
			// Show context confirmation if documents were included in a regular message
			if (multiDocContext?.persistentDocs?.length) {
				const allDocs = multiDocContext.persistentDocs;
				const docNames = allDocs.filter(doc => doc?.file?.basename).map(doc => doc.file.basename).join(', ');
				if (docNames && allDocs.length > 0) {
					const tokenInfo = multiDocContext.tokenCount > 0 ? ` (~${multiDocContext.tokenCount} tokens)` : '';
					const currentFile = this.currentFile?.basename || 'current file';
					this.addSuccessMessage(`✓ Included ${allDocs.length} document${allDocs.length !== 1 ? 's' : ''} in context: ${docNames}${tokenInfo}. Context documents are read-only; edit commands will only modify ${currentFile}.`);
				}
			}
			
			// Check token limit
			if (multiDocContext?.isNearLimit) {
				new Notice('⚠️ approaching token limit. Consider removing some documents from context', NovaSidebarView.NOTICE_DURATION_MS);
			}
		}

		// Clear input and UI state first
		this.inputHandler.setValue('');
		
		// Hide context preview since we're sending the message
		if (this.contextPreview) {
			this.contextPreview.removeClass('show');
		}

		// Create abort controller for this operation
		this.currentAbortController = new AbortController();

		// Set processing state (shows stop button)
		this.inputHandler.setProcessingState(true);

		try {
			// Store user message in conversation (will be restored via loadConversationHistory)
			const activeFile = this.app.workspace.getActiveFile();
			if (activeFile) {
				// No edit command for regular chat messages
				await this.plugin.conversationManager.addUserMessage(activeFile, messageText, undefined);
				
				// Add user message to UI immediately after persistence
				this.chatRenderer.addMessage('user', messageText);
			}
			
			// Add loading indicator with animated nova
			const loadingEl = this.chatContainer.createDiv({ cls: 'nova-loading' });
			loadingEl.addClass('nova-loading-element');
			
			// Create animated nova burst
			const novaContainer = loadingEl.createDiv({ cls: 'nova-burst-container' });
			// Create animated nova burst using DOM API
			const novaBurst = novaContainer.createDiv({ cls: 'nova-burst' });
			novaBurst.createDiv({ cls: 'nova-core' });
			novaBurst.createDiv({ cls: 'nova-ring nova-ring-1' });
			novaBurst.createDiv({ cls: 'nova-ring nova-ring-2' });
			novaBurst.createDiv({ cls: 'nova-ring nova-ring-3' });
			
			// Use AI to classify the user's intent first to get contextual phrase
			const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
			const selectedText = activeView?.editor?.getSelection();
			const hasSelection = !!(selectedText && selectedText.trim().length > 0);
			const intent = this.plugin.aiIntentClassifier.classifyIntent(processedMessage, hasSelection);
			
			// Get initial contextual thinking phrase
			let contextualCommand: EditCommand | undefined;
			if (intent === 'METADATA' || intent === 'CONTENT') {
				contextualCommand = this.plugin.commandParser.parseCommand(processedMessage);
			}
			const initialPhrase = this.getContextualThinkingPhrase(contextualCommand, processedMessage);
			
			const loadingTextEl = loadingEl.createSpan({ text: initialPhrase });
			loadingTextEl.addClass('nova-loading-text');
			
			// Start phrase rotation animation
			this.startThinkingPhraseRotation(loadingTextEl, contextualCommand, processedMessage);

			// Message already stored in conversation manager above

			let response: string | null = null;
			
			if (intent === 'METADATA' && activeFile) {
				// Handle metadata commands
				const parsedCommand = this.plugin.commandParser.parseCommand(processedMessage);
				response = await this.executeCommand(parsedCommand);
			} else if (intent === 'CONTENT' && activeFile) {
				// Handle content editing commands
				const parsedCommand = this.plugin.commandParser.parseCommand(processedMessage);
				response = await this.executeCommand(parsedCommand);
			} else {
				// Handle as conversation using PromptBuilder
				const prompt = this.plugin.promptBuilder.buildPromptForMessage(processedMessage, activeFile || undefined);
				
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
						maxTokens: prompt.config.maxTokens,
						signal: this.currentAbortController.signal
					});
				}
			}

			// Check if operation was aborted
			if (this.currentAbortController.signal.aborted) {
				// Remove loading indicator with proper cleanup
				const loadingTextSpan = loadingEl.querySelector('span');
				if (loadingTextSpan) {
					this.stopThinkingPhraseRotation(loadingTextSpan as HTMLElement);
				}
				loadingEl.remove();

				// Show canceled message
				this.chatRenderer.addStatusMessage('Response canceled', { type: 'pill', variant: 'system' });
				return;
			}
			
			// Remove loading indicator with proper cleanup
			const loadingTextSpan = loadingEl.querySelector('span');
			if (loadingTextSpan) {
				this.stopThinkingPhraseRotation(loadingTextSpan as HTMLElement);
			}
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
					this.chatRenderer.addMessage('assistant', filteredResponse);
				}
			}
		} catch (error) {
			// Remove loading indicator if it exists with proper cleanup
			const loadingEl = this.chatContainer.querySelector('.nova-loading');
			if (loadingEl) {
				const loadingTextSpan = loadingEl.querySelector('span');
				if (loadingTextSpan) {
					this.stopThinkingPhraseRotation(loadingTextSpan as HTMLElement);
				}
				loadingEl.remove();
			}
			
			// Check if this was an abort error
			if (this.currentAbortController?.signal.aborted || (error as Error).name === 'AbortError') {
				this.chatRenderer.addStatusMessage('Response canceled', { type: 'pill', variant: 'system' });
			} else {
				// Format error message based on error type
				const errorMessage = (error as Error).message;
				let displayMessage: string;

				// Check if it's a provider-specific error
				if (errorMessage.includes('Google API error')) {
					// Google API errors already have helpful context from our improved error handling
					displayMessage = errorMessage;
				} else if (errorMessage.includes('OpenAI API error')) {
					displayMessage = errorMessage;
				} else if (errorMessage.includes('API key')) {
					displayMessage = `${errorMessage}. Please check your settings.`;
				} else if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
					displayMessage = 'Network error. Please check your internet connection and try again.';
				} else {
					// Generic error
					displayMessage = `Sorry, I encountered an error: ${errorMessage}`;
				}

				this.addErrorMessage(displayMessage);
			}
		} finally {
			// Reset processing state (shows send button)
			this.inputHandler.setProcessingState(false);
			this.currentAbortController = null;
			// Update button state based on provider availability
			await this.updateSendButtonState().catch(error => { Logger.error('Failed to update send button:', error); });
			// Refresh context indicator to show persistent documents
			await this.refreshContext().catch(error => { Logger.error('Failed to refresh context:', error); });
		}
	}

	insertTextIntoActiveNote(text: string) {
		const activeView = this.app.workspace.getActiveViewOfType(ItemView);
		if (this.isMarkdownView(activeView)) {
			const editor = activeView.editor;
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
				const view = leaf.view;
				// Use instanceof check to handle deferred views properly
				if (view instanceof MarkdownView && view.file === this.currentFile) {
					markdownView = view;
					break;
				}
			}
			
			// If not found, try to open the file
			if (!markdownView) {
				const leaf = this.app.workspace.getLeaf(false);
				if (leaf) {
					await leaf.openFile(this.currentFile);
					const view = leaf.view;
					// Use instanceof check to handle deferred views properly
					if (view instanceof MarkdownView) {
						markdownView = view;
					}
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
				await new Promise<void>(resolve => {
					this.timeoutManager.addTimeout(() => resolve(), 50);
				});
				
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
					result = this.plugin.deleteCommandHandler.execute(command);
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
					return `I don't understand the command "${String(command.action)}". Try asking me to add, edit, delete, fix grammar, rewrite content, or update metadata/properties.`;
			}
			
			if (result.success) {
				// Show success indicator for command completion
				this.addSuccessIndicator(command.action);
				
				return null; // Don't return text for regular message
			} else {
				// Show error indicator for command failure
				this.addErrorIndicator(command.action, result.error);
				
				return null; // Don't return text for regular message
			}
		} catch (error) {
			// Show error indicator for execution error
			this.addErrorIndicator('execute', (error as Error).message);
			
			return null; // Don't return text for regular message
		}
	}


	private async loadConversationForActiveFile() {
		const activeFile = this.app.workspace.getActiveFile();
		
		// Ensure file switches don't trigger provider switch messages
		this.isUserInitiatedProviderChange = false;
		
		// PHASE 3 FIX: Generate operation ID to prevent race conditions
		const operationId = Date.now().toString() + Math.random().toString(36).substring(2, 11);
		this.currentFileLoadOperation = operationId;
		
		// If no active file, try to find the currently active view's file
		let targetFile = activeFile;
		if (!targetFile) {
			// Use recommended API for getting active markdown view
			const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (activeView && activeView.file) {
				targetFile = activeView.file;
			} else {
				// Final fallback: first available open markdown file
				const leaves = this.app.workspace.getLeavesOfType('markdown');
				if (leaves.length > 0) {
					const view = leaves[0].view;
					// Use instanceof check instead of unsafe cast to handle deferred views properly
					if (view instanceof MarkdownView && view.file) {
						targetFile = view.file;
					}
				}
			}
		}
		
		// If no file available and we have a current file, clear everything
		if (!targetFile && this.currentFile) {
			this.currentFile = null;
			this.chatContainer.empty();
			// Immediately clear context state to prevent bleeding
			this.currentContext = null;
			this.contextManager.setCurrentFile(null);
			this.refreshContext().catch(error => { Logger.error('Failed to refresh context:', error); });
			this.addWelcomeMessage('Open a document to get started.');
			return;
		}
		
		// If no file or same file, do nothing
		if (!targetFile || targetFile === this.currentFile) {
			return;
		}
		
		// Set current file in ContextManager but don't restore context yet (will do after chat loads)
		this.contextManager.setCurrentFile(targetFile);
		
		// Clear cursor tracking when switching to a new file
		this.currentFileCursorPosition = null;
		
		this.currentFile = targetFile;
		this.currentContext = this.contextManager.getCurrentContext();
		
		// Update UI after ContextManager has loaded data
		this.updateContextIndicator();
		
		// Update document statistics in header
		this.refreshAllStats().catch(error => { Logger.error('Failed to refresh stats:', error); });
		
		// Immediately track cursor position for the newly active file
		const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (activeView && activeView.editor) {
			this.trackCursorPosition(activeView.editor);
		}
		
		// Clear current chat
		this.chatContainer.empty();
		
		// PHASE 3 FIX: Check if this operation is still current before proceeding
		if (this.currentFileLoadOperation !== operationId) {
			return;
		}
		
		try {
			// Use ChatRenderer's loadConversationHistory which handles all message types including system messages with styling
			this.chatRenderer.loadConversationHistory(targetFile);
			
			// PHASE 3 FIX: Check again after async operation
			if (this.currentFileLoadOperation !== operationId) {
				return;
			}
			
			// Now restore context after chat is loaded (so missing file notifications persist)
			await this.contextManager.restoreContextAfterChatLoad(targetFile);
			
			// Refresh the context UI after restoration to remove any stale references
			await this.refreshContext().catch(error => { Logger.error('Failed to refresh context:', error); });
			
			// Show document insights after loading conversation
			await this.showDocumentInsights(targetFile);
			
			// PHASE 3 FIX: Final check after all async operations
			if (this.currentFileLoadOperation !== operationId) {
				return;
			}
			
			// ChatRenderer will handle showing welcome message if no conversation exists
		} catch (error) {
			Logger.error('Conversation loading error:', error);
			// Failed to load conversation history - graceful fallback
			// Show welcome message on error
			this.addWelcomeMessage();
		}
	}

	private async clearChat() {
		// Clear the chat container
		this.chatContainer.empty();
		
		// Clear conversation in conversation manager
		if (this.currentFile) {
			try {
				await this.plugin.conversationManager.clearConversation(this.currentFile);
				
				// Clear token warnings
				this.lastTokenWarnings = {};
			} catch (_) {
				// Failed to clear conversation - graceful fallback
			}
		}
		
		// Show notice to user
		new Notice('Chat cleared');
		
		// Show welcome message first, before context refresh triggers warnings
		this.addWelcomeMessage();
		
		// Then refresh context to rebuild currentContext from persistent storage and update UI
		if (this.currentFile) {
			await this.refreshContext().catch(error => { Logger.error('Failed to refresh context:', error); });
		}
	}

	// Coordinator method that updates both document stats and context remaining
	private async refreshAllStats(): Promise<void> {
		// Skip updates during streaming to avoid conflicts
		if (this.streamingManager.isStreaming()) {
			return;
		}
		
		await this.updateDocumentStats();
		
		// Refresh context to recalculate token counts with updated document content
		await this.refreshContext().catch(error => { Logger.error('Failed to refresh context:', error); });
		
		this.updateContextRemaining();
	}

	// Update only document statistics (word count, sections)
	private async updateDocumentStats(): Promise<void> {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) return;
		
		try {
			// Get document content
			const content = await this.app.vault.read(activeFile);
			if (!content) return;
			
			// Calculate basic stats
			const wordCount = content.split(/\s+/).filter(word => word.length > 0).length;
			// const headingCount = (content.match(/^#{1,6}\s/gm) || []).length;
			
			// Update stats display in header
			const headerEl = this.containerEl.querySelector('.nova-header');
			if (headerEl) {
				// Find or create stats container
				let statsContainer = headerEl.querySelector('.nova-document-stats-container');
				if (!statsContainer) {
					statsContainer = headerEl.createEl('div', { cls: 'nova-document-stats-container' });
				}
				
				// Find or create document stats element
				let statsEl = statsContainer.querySelector('.nova-document-stats');
				if (!statsEl) {
					statsEl = statsContainer.createEl('div', { cls: 'nova-document-stats' });
				}
				
				if (statsEl && wordCount > 0) {
					// Calculate reading time (words / 225 = minutes)
					const readingTime = Math.ceil(wordCount / 225);
					statsEl.textContent = `~ ${readingTime} min read`;
				}
			}
		} catch (_) {
			// Silently fail - stats are optional
		}
	}

	// Update only context remaining display (token percentage)
	private updateContextRemaining(): void {
		this.updateTokenDisplay();
	}

	private updateTokenDisplay(): void {
		const headerEl = this.containerEl.querySelector('.nova-header');
		if (!headerEl) return;
		
		// Find or create stats container and both elements if they don't exist
		let statsContainer = headerEl.querySelector('.nova-document-stats-container');
		if (!statsContainer) {
			statsContainer = headerEl.createEl('div', { cls: 'nova-document-stats-container' });
		}
		
		// Ensure document stats element exists (left side)
		let statsEl = statsContainer.querySelector('.nova-document-stats');
		if (!statsEl) {
			statsEl = statsContainer.createEl('div', { cls: 'nova-document-stats' });
		}

		// Ensure right container exists for privacy + token (right side)
		let rightContainer = statsContainer.querySelector('.nova-stats-right-container') as HTMLElement;
		if (!rightContainer) {
			rightContainer = statsContainer.createEl('div', { cls: 'nova-stats-right-container' });
		}

		// Ensure privacy indicator exists (inside right container)
		let privacyEl = rightContainer.querySelector('.nova-privacy-indicator') as HTMLElement;
		if (!privacyEl) {
			privacyEl = rightContainer.createEl('div', { cls: 'nova-privacy-indicator' });
			this.privacyIndicator = privacyEl;
			this.updatePrivacyIndicator(privacyEl).catch(error => {
				Logger.error('Failed to update privacy indicator:', error);
			});
		}

		// Ensure token element exists (inside right container)
		let tokenEl = rightContainer.querySelector('.nova-token-usage') as HTMLElement;
		if (!tokenEl) {
			tokenEl = rightContainer.createEl('div', { cls: 'nova-token-usage' });
		}
		
		// Get total context usage if available, otherwise fall back to old calculation
		const totalContextUsage = this.currentContext?.totalContextUsage;
		let warningLevel: string;
		let displayText: string;
		let tooltipText: string;

		if (totalContextUsage) {
			// Use new total context calculation
			warningLevel = getContextWarningLevel(totalContextUsage);
			displayText = formatContextUsage(totalContextUsage);
			tooltipText = getContextTooltip(totalContextUsage);
		} else {
			// No total context usage available - show minimal info without warnings
			const currentTokens = this.currentContext?.tokenCount || 0;
			// remainingPercent = 100; // Don't calculate percentage without proper context limits
			displayText = currentTokens > 0 ? `${currentTokens} tokens` : '0% left';
			tooltipText = `File context: ${currentTokens} tokens (total context calculation unavailable)`;
			warningLevel = 'safe'; // No warnings when calculation unavailable
		}
		
		// Update display text
		tokenEl.textContent = displayText;
		
		// Set tooltip
		tokenEl.title = tooltipText;
		
		// Apply color coding and show warnings
		tokenEl.className = 'nova-token-usage';
		if (warningLevel === 'safe') {
			tokenEl.addClass('nova-token-safe');
		} else if (warningLevel === 'warning') {
			tokenEl.addClass('nova-token-warning');
			this.showTokenWarning(85); // 85% usage = 15% remaining
		} else if (warningLevel === 'critical') {
			tokenEl.addClass('nova-token-danger');
			this.showTokenWarning(95); // 95% usage = 5% remaining
		}
	}

	private showTokenWarning(threshold: number): void {
		// Prevent duplicate warnings - only show once per threshold per context session
		const warningKey = `token-warning-${threshold}`;
		
		// Check if we've already shown this threshold warning
		if (this.lastTokenWarnings[warningKey]) return;
		
		// Mark this threshold as warned
		this.lastTokenWarnings[warningKey] = Date.now();
		
		let message: string;
		if (threshold === 75) {
			message = "ℹ️ Context usage is growing. Current conversation and file context are using significant tokens.";
		} else if (threshold === 85) {
			message = "⚠️ Context usage high (85%). Consider starting a new conversation or removing file context for better AI performance.";
		} else if (threshold === 95) {
			message = "⚠️ Context nearly full (95%). Start a new conversation or clear context immediately for reliable AI responses.";
		} else {
			// Legacy fallback
			message = "⚠️ Context approaching limit. Consider clearing context or starting a new conversation.";
		}
		
		this.addWarningMessage(message);
	}

	private addWarningMessage(content: string): void {
		this.chatRenderer.addWarningMessage(content, true);
	}

	private async showDocumentInsights(file: TFile): Promise<void> {
		try {
			const content = await this.app.vault.read(file);
			const analysis = DocumentAnalyzer.analyzeStructure(content);
			
			if (analysis.emptyHeadings.length > 0 || analysis.incompleteBullets.length > 0) {
				const insights: string[] = [];
				
				if (analysis.emptyHeadings.length > 0) {
					insights.push(`${analysis.emptyHeadings.length} empty heading${analysis.emptyHeadings.length > 1 ? 's' : ''} to fill`);
				}
				
				if (analysis.incompleteBullets.length > 0) {
					insights.push(`${analysis.incompleteBullets.length} incomplete bullet${analysis.incompleteBullets.length > 1 ? 's' : ''}`);
				}
				
				if (insights.length > 0) {
					const bulletList = insights.map(insight => `• ${insight}`).join('\n');
					
					// Create a custom left-aligned message for document insights
					const messageEl = this.chatContainer.createDiv({ cls: 'nova-message nova-message-assistant nova-insights' });

					messageEl.createEl('div', { 
						text: 'Nova',
						cls: 'nova-message-role'
					});

					const contentEl = messageEl.createEl('div', { cls: 'nova-message-content nova-insights-content' });
					contentEl.textContent = `I noticed:\n${bulletList}\n\nLet me help.`;

					// Scroll to show the new message
					this.timeoutManager.addTimeout(() => {
						this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
					}, 50);
				}
			}
		} catch (_) {
			// Silently fail - analysis is optional
		}
	}

	/**
	 * Handle consultation requests - chat only, no document modification
	 */
	async handleConsultationRequest(input: string): Promise<void> {
		const activeFile = this.plugin.documentEngine.getActiveFile();

		// Get AI response using PromptBuilder but do NOT modify document
		const prompt = this.plugin.promptBuilder.buildPromptForMessage(input, activeFile || undefined);
		const response = await this.plugin.aiProviderManager.complete(prompt.systemPrompt, prompt.userPrompt);
		
		// Display response in chat only
		this.displayChatResponse(response);
		
		// Show subtle mode indicator
		this.showModeIndicator('consultation');
	}

	/**
	 * Display AI response in chat without document modification
	 */
	displayChatResponse(response: string): void {
		// Use existing chat renderer to display response
		this.chatRenderer.addMessage('assistant', response);
	}

	/**
	 * Show subtle indicator for consultation vs editing mode
	 */
	showModeIndicator(_mode: 'consultation' | 'editing'): void {
		// For now, this is a no-op placeholder
		// Future enhancement: show subtle UI indicator
	}

	/**
	 * Handle editing requests - preserves existing behavior with intent tracking
	 */
	async handleEditingRequest(input: string): Promise<string | null> {
		// Parse command using existing parser
		const parsedCommand = this.plugin.commandParser.parseCommand(input);
		
		
		// Execute command using existing system
		return await this.executeCommand(parsedCommand);
	}


	/**
	 * Handle ambiguous requests by routing to chosen handler
	 */
	async handleAmbiguousRequest(input: string, chosenIntent: 'consultation' | 'editing'): Promise<void> {
		if (chosenIntent === 'consultation') {
			await this.handleConsultationRequest(input);
		} else {
			await this.handleEditingRequest(input);
		}
	}


	/**
	 * Process user input with intent detection integration
	 */
	async processUserInputWithIntent(input: string): Promise<void> {
		const intent = this.plugin.aiIntentClassifier.classifyIntent(input);
		
		switch (intent) {
			case 'CHAT':
				await this.handleConsultationRequest(input);
				break;
			case 'CONTENT':
				await this.handleEditingRequest(input);
				break;
			case 'METADATA': {
				// Handle metadata commands through existing flow
				const parsedCommand = this.plugin.commandParser.parseCommand(input);
				await this.executeCommand(parsedCommand);
				break;
			}
		}
	}

	// Public methods for testing
	async sendMessage(message: string): Promise<void> {
		const activeFile = this.plugin.documentEngine.getActiveFile();

		// Build prompt using PromptBuilder
		const prompt = this.plugin.promptBuilder.buildPromptForMessage(message, activeFile || undefined);
		
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
					this.plugin.deleteCommandHandler.execute(command);
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
			// Regular conversation - message already persisted above
			
			// Call AI provider
			await this.plugin.aiProviderManager.complete(prompt.systemPrompt || '', prompt.userPrompt);
			
			if (activeFile) {
				// Create proper EditResult for successful chat response
				const result: EditResult = { success: true, editType: 'insert' };
				await this.plugin.conversationManager.addAssistantMessage(activeFile, 'AI response', result);
			}
		}
	}

	// REMOVED: Now using ChatRenderer's loadConversationHistory method directly



	/**
	 * Update send button enabled/disabled state based on provider availability
	 */
	private async updateSendButtonState(): Promise<void> {
		// Don't update button state if we're currently processing - the processing state takes precedence
		if (this.currentAbortController) {
			return;
		}
		const currentProviderType = await this.plugin.aiProviderManager.getCurrentProviderType();
		// TODO: Add public getter method to InputHandler for sendButton access
		this.inputHandler.sendButtonComponent?.setDisabled(!currentProviderType);
	}

	/**
	 * Update privacy indicator icon and tooltip based on current provider
	 */
	private async updatePrivacyIndicator(privacyIndicator: HTMLElement): Promise<void> {
		const currentProviderType = await this.plugin.aiProviderManager.getCurrentProviderType();
		
		// Clear previous content
		privacyIndicator.empty();
		privacyIndicator.removeClass('nova-status-pill', 'local', 'cloud');
		
		// Apply inline styles for consistent sizing
		privacyIndicator.addClass('nova-privacy-indicator-styled');
		
		if (currentProviderType) {
			const isLocalProvider = currentProviderType === 'ollama';
			
			// Add pill styling classes
			privacyIndicator.addClass('nova-status-pill');
			privacyIndicator.addClass(isLocalProvider ? 'local' : 'cloud');
			
			// Create icon element
			const iconEl = privacyIndicator.createSpan({ cls: 'nova-status-icon' });
			iconEl.addClass('nova-privacy-icon');
			const iconName = isLocalProvider ? 'shield-check' : 'cloud';
			setIcon(iconEl, iconName);
			
			// Add text label
			const labelEl = privacyIndicator.createSpan({ text: isLocalProvider ? 'Local' : 'Cloud' });
			labelEl.addClass('nova-privacy-label');
			
			// Set tooltip
			const tooltip = isLocalProvider ? 'Local processing - data stays on your device' : 'Cloud processing - data sent to provider';
			privacyIndicator.setAttribute('aria-label', tooltip);
			privacyIndicator.setAttribute('title', tooltip);
		} else {
			// No provider available - show generic status
			privacyIndicator.addClass('nova-status-pill');
			
			const iconEl = privacyIndicator.createSpan({ cls: 'nova-status-icon' });
			iconEl.addClass('nova-privacy-icon');
			setIcon(iconEl, 'help-circle');
			
			const labelEl = privacyIndicator.createSpan({ text: 'No provider' });
			labelEl.addClass('nova-privacy-label');
			
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
		if (this.privacyIndicator) {
			await this.updatePrivacyIndicator(this.privacyIndicator);
		}

		// Update send button state
		this.updateSendButtonState().catch(error => { Logger.error('Failed to update send button:', error); });

		// Update provider dropdown display
		await this.refreshProviderDropdown();
	}

	/**
	 * Create provider dropdown using Obsidian's DropdownComponent API
	 */
	private async createProviderDropdown(container: HTMLElement): Promise<void> {
		const dropdownContainer = container.createDiv({ cls: 'nova-provider-dropdown-container' });
		
		// Create dropdown using Obsidian's DropdownComponent
		this.providerDropdown = new DropdownComponent(dropdownContainer);
		this.providerDropdown.selectEl.addClass('nova-provider-dropdown-select');
		
		// Populate options and set current selection
		await this.updateProviderOptions();
		
		// Handle provider/model changes
		this.providerDropdown.onChange(async (value) => {
			await this.switchProviderModel(value);
		});
	}

	/**
	 * Update provider dropdown options with optgroups
	 */
	private async updateProviderOptions(): Promise<void> {
		if (!this.providerDropdown) return;

		// Check if mobile support is disabled on mobile
		if (Platform.isMobile) {
			const mobileModel = this.plugin.settings.platformSettings.mobile.selectedModel;
			if (mobileModel === 'none') {
				// Clear dropdown and add disabled message
				this.providerDropdown.selectEl.empty();
				const option = this.providerDropdown.selectEl.createEl('option');
				option.value = '';
				option.textContent = 'Mobile disabled';
				option.disabled = true;
				this.providerDropdown.setValue('');
				return;
			}
		}

		const currentProvider = await this.plugin.aiProviderManager.getCurrentProviderType();
		const currentModel = this.plugin.aiProviderManager.getCurrentModel();

		// Clear existing options
		this.providerDropdown.selectEl.empty();
		
		// Get all providers with availability status
		const providerAvailability = await this.plugin.aiProviderManager.getAvailableProvidersWithStatus();
		
		for (const [providerType, isAvailable] of providerAvailability) {
			if (providerType === 'none' || !isAvailable) continue;

			// Check if provider has API key configured
			const providerConfig = this.plugin.settings.aiProviders[providerType];
			const hasApiKey = providerConfig?.apiKey;
			if (!hasApiKey && providerType !== 'ollama') continue;

			// Check if provider is connected
			const providerStatus = providerConfig?.status;
			if (!providerStatus || providerStatus.state !== 'connected') continue;
			
			const models = this.getAvailableModels(providerType);
			const providerDisplayName = this.getProviderDisplayName(providerType);
			
			// Skip providers with no models (except Ollama)
			if (models.length === 0 && providerType !== 'ollama') continue;
			
			// Create optgroup for this provider
			const group = this.providerDropdown.selectEl.createEl('optgroup');
			group.label = providerDisplayName;
			
			if (models.length === 0) {
				// Provider without specific models (like Ollama)
				const option = group.createEl('option');
				option.value = `${providerType}-${providerConfig?.model || providerDisplayName}`;
				option.textContent = providerConfig?.model || providerDisplayName;
			} else {
				// Provider with specific models
				for (const model of models) {
					const option = group.createEl('option');
					option.value = `${providerType}-${model.value}`;
					option.textContent = model.label;
				}
			}
		}
		
		// Set current selection based on provider and model
		if (currentProvider && currentModel) {
			const currentKey = `${currentProvider}-${currentModel}`;
			this.providerDropdown.setValue(currentKey);
		}
	}

	/**
	 * Switch provider and model based on dropdown selection
	 */
	private async switchProviderModel(providerModelKey: string): Promise<void> {
		try {
			// Parse provider-model key (e.g., "claude-claude-3-5-sonnet-20241022")
			const parts = providerModelKey.split('-');
			if (parts.length < 2) return;
			
			const provider = parts[0]; // e.g., "claude"
			const model = parts.slice(1).join('-'); // e.g., "claude-3-5-sonnet-20241022"
			
			// Set user-initiated flag to prevent spurious success messages
			this.isUserInitiatedProviderChange = true;

			// Update the model in settings
			this.plugin.settingTab.setCurrentModel(model);
			await this.plugin.saveSettings();
			
			// Refresh privacy indicator and context
			await this.refreshProviderStatus();
			this.refreshContext().catch(error => { Logger.error('Failed to refresh context:', error); });
			
			// Show success message
			const displayName = this.getModelDisplayName(provider, model);
			this.addSuccessMessage(`✓ Switched to ${displayName}`);
			
		} catch (error) {
			Logger.error('Error switching provider/model:', error);
			this.addErrorMessage('❌ Failed to switch provider/model');
		} finally {
			// Reset flag
			this.isUserInitiatedProviderChange = false;
		}
	}

	/**
	 * Refresh provider dropdown display
	 */
	private async refreshProviderDropdown(): Promise<void> {
		if (this.providerDropdown) {
			await this.updateProviderOptions();
		}
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
		const providerConfig = this.plugin.settings.aiProviders[providerType as 'claude' | 'openai' | 'google' | 'ollama'];
		const currentModel = providerConfig?.model;
		
		if (currentModel) {
			return currentModel;
		}
		
		// Get default model (first available model for the provider)
		const availableModels = this.getAvailableModels(providerType);
		return availableModels.length > 0 ? availableModels[0].value : '';
	}

	/**
	 * Get model display name from model value - searches all providers if needed
	 */
	private getModelDisplayName(providerType: string, modelValue: string): string {
		// First try the specified provider
		let models = this.getAvailableModels(providerType);
		let model = models.find(m => m.value === modelValue);
		
		// If not found in specified provider, search all providers
		if (!model) {
			const providerTypes = ['claude', 'openai', 'google', 'ollama'];
			for (const searchProviderType of providerTypes) {
				if (searchProviderType === providerType) continue; // Already checked
				models = this.getAvailableModels(searchProviderType);
				model = models.find(m => m.value === modelValue);
				if (model) {
					break;
				}
			}
		}
		
		const displayName = model ? model.label : modelValue;
		
		return displayName;
	}

	/**
	 * Switch to a specific model for a provider
	 */
	private switchToModel(providerType: string, modelValue: string): void {
		try {
			// Update platform settings for persistence (this is what actually matters)
			const platform = Platform.isMobile ? 'mobile' : 'desktop';
			this.plugin.settings.platformSettings[platform].selectedModel = modelValue;

			// Also update provider model setting for consistency
			const providerConfig = this.plugin.settings.aiProviders[providerType as 'claude' | 'openai' | 'google' | 'ollama'];
			if (providerConfig) {
				providerConfig.model = modelValue;
			}

			// Show success message immediately (optimistic update)
			const modelDisplayName = this.getModelDisplayName(providerType, modelValue);
			const providerDisplayName = this.getProviderDisplayName(providerType);
			this.addSuccessMessage(`✓ Switched to ${providerDisplayName} ${modelDisplayName}`);
			
			// Save settings asynchronously (don't block UI)
			this.plugin.saveSettings().catch(error => {
				Logger.error('Error saving model selection:', error);
				this.addErrorMessage('Failed to save model selection');
			});
			
			// ADD THIS: Refresh privacy indicator and other status elements
			this.refreshProviderStatus().catch(error => {
				Logger.error('Error refreshing provider status:', error);
			});
			
			// Refresh context to update token count display for new provider
			this.refreshContext().catch(error => {
				Logger.error('Error refreshing context after model switch:', error);
			});
			
		} catch (error) {
			Logger.error('Error switching model:', error);
			this.addErrorMessage('Failed to switch model');
		}
	}

	/**
	 * Create a message with icon prefix (compliant - no HTML generation)
	 */
	private createIconMessage(iconName: string, message: string): string {
		// Map icons to text prefixes for compliance - no HTML generation
		const iconPrefixes: Record<string, string> = {
			'alert-circle': '⚠️ ',
			'check-circle': '✅ ',
			'x-circle': '❌ ',
			'help-circle': 'ℹ️ ',
			'edit': '✏️ ',
			'file-text': '📄 ',
			'x': '❌ ',
			'trash-2': '🗑️ ',
			'zap': '⚡ ',
			'refresh-cw': '🔄 ',
			'book-open': '📖 ',
			'more-horizontal': '⋯ '
		};
		
		const prefix = iconPrefixes[iconName] || 'ℹ️ ';
		return prefix + message;
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
			const modelDisplayName = this.getModelDisplayName(providerType, currentModel);
			
			// Debug logging for "II" issue
			if (modelDisplayName === "II" || modelDisplayName.match(/^I+$/)) {
				Logger.warn('Invalid model display name detected:', {
					providerType,
					currentModel,
					modelDisplayName,
					models
				});
			}
			
			return modelDisplayName;
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
	 * Switch to a different model and update conversation context
	 */

	/**
	 * Check if the command button should be shown based on feature availability and user preference
	 */
	private shouldShowCommandButton(): boolean {
		// Command button is gated behind the commands feature 
		if (!this.plugin.featureManager.isFeatureEnabled('smartfill')) {
			return false;
		}
		return this.plugin.settings.features?.smartfill?.showCommandButton ?? true;
	}

	/**
	 * Refresh all Supernova-gated UI elements when license status changes
	 */
	refreshSupernovaUI(): void {
		this.refreshCommandButton();
		// Future Supernova features can add their refresh logic here
	}

	// ── Sidebar event bus handlers ─────────────────────────────────────

	/**
	 * Handle processing-state events dispatched by SelectionContextMenu
	 */
	private handleSidebarProcessing(event: Event): void {
		const { processing } = (event as SidebarProcessingEvent).detail;
		if (this.inputHandler) {
			this.inputHandler.setProcessingState(processing);
		}
	}

	/**
	 * Handle chat-message events dispatched by SelectionContextMenu
	 */
	private handleSidebarChatMessage(event: Event): void {
		const detail = (event as SidebarChatMessageEvent).detail;
		if (!this.chatRenderer) return;

		switch (detail.type) {
			case 'user':
				this.chatRenderer.addMessage('user', detail.content);
				break;
			case 'assistant':
				this.chatRenderer.addMessage('assistant', detail.content);
				break;
			case 'success':
				this.chatRenderer.addSuccessMessage(detail.content, detail.persist ?? false);
				break;
			case 'error':
				this.chatRenderer.addErrorMessage(detail.content, detail.persist ?? false);
				break;
			case 'status':
				this.chatRenderer.addStatusMessage(
					detail.content,
					detail.statusOptions ?? { type: 'pill', variant: 'system' }
				);
				break;
		}
	}

	/**
	 * Handle provider configuration events
	 */
	private handleProviderConfigured = async (event: Event) => {
		const customEvent = event as CustomEvent;
		const { provider, status } = customEvent.detail;

		// If mobile was just enabled and no model is selected, select first available
		if (provider === 'mobile-settings' && status === 'enabled' && Platform.isMobile) {
			const currentModel = this.plugin.aiProviderManager.getCurrentModel();
			if (!currentModel || currentModel === '') {
				const firstAvailableModel = await this.getFirstAvailableModel();
				if (firstAvailableModel) {
					const providerType = getProviderTypeForModel(firstAvailableModel, this.plugin.settings);
					if (providerType) {
						this.switchToModel(providerType, firstAvailableModel);
						await this.plugin.saveSettings();
					}
				}
			}
		}

		// Update provider dropdown display
		try {
			await this.refreshProviderDropdown();
		} catch (error) {
			Logger.error('❌ Failed to update provider display after configuration:', error);
		}

		// Update privacy indicator
		if (this.privacyIndicator) {
			await this.updatePrivacyIndicator(this.privacyIndicator);
		}

		// Update send button state
		await this.updateSendButtonState().catch(error => { Logger.error('Failed to update send button:', error); });
	}

	/**
	 * Handle provider disconnection events - auto-switch to valid model if current becomes invalid
	 */
	private handleProviderDisconnected = async (event: Event) => {
		const customEvent = event as CustomEvent;
		const { provider: failedProvider } = customEvent.detail;
		
		// Check if current model belongs to the failed provider
		const currentModel = this.plugin.aiProviderManager.getCurrentModel();
		const currentProviderType = getProviderTypeForModel(currentModel, this.plugin.settings);
		
		if (currentProviderType === failedProvider) {
			// Current model is invalid - switch to first available model
			const firstAvailableModel = await this.getFirstAvailableModel();
			if (firstAvailableModel) {
				// Switch to the fallback model
				const fallbackProviderType = getProviderTypeForModel(firstAvailableModel, this.plugin.settings);
				if (fallbackProviderType) {
					this.switchToModel(fallbackProviderType, firstAvailableModel);
				}
			} else {
				// No available models - clear the selection
				const platform = Platform.isMobile ? 'mobile' : 'desktop';
				this.plugin.settings.platformSettings[platform].selectedModel = '';
				await this.plugin.saveSettings();
			}
		}
		
		// Update dropdown display
		try {
			await this.refreshProviderDropdown();
		} catch (error) {
			Logger.error('❌ Failed to update provider display after disconnection:', error);
		}

		// Update privacy indicator
		if (this.privacyIndicator) {
			await this.updatePrivacyIndicator(this.privacyIndicator);
		}

	}

	/**
	 * Handle license update events
	 */
	private handleLicenseUpdated = (_event: Event) => {
		// Event parameter prefixed with _ to indicate intentionally unused
		// const customEvent = event as CustomEvent;
		// const { _hasLicense, _licenseKey, _action } = customEvent.detail;

		// Refresh Supernova UI when license status changes
		try {
			this.refreshSupernovaUI();
		} catch (error) {
			Logger.error('❌ Failed to refresh Supernova UI after license update:', error);
		}
	}

	/**
	 * Get the first available model from any working provider
	 */
	private async getFirstAvailableModel(): Promise<string | null> {
		// Get provider availability status
		const providerAvailability = await this.plugin.aiProviderManager.getAvailableProvidersWithStatus();
		
		// Provider priority order: Claude > OpenAI > Google > Ollama
		const providerPriority: ProviderType[] = ['claude', 'openai', 'google', 'ollama'];
		
		for (const providerType of providerPriority) {
			if (providerType === 'none') continue; // Skip 'none' provider type
			const isAvailable = providerAvailability.get(providerType);
			// Also check if provider has been successfully tested
			const providerConfig = this.plugin.settings.aiProviders[providerType];
			const providerStatus = providerConfig?.status;
			if (isAvailable && providerStatus?.state === 'connected') {
				const models = getAvailableModels(providerType, this.plugin.settings);
				if (models.length > 0) {
					return models[0].value; // Return first model from this provider
				}
			}
		}
		
		return null; // No available models found
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
	private async executeAddCommandWithStreaming(command: EditCommand): Promise<EditResult> {
		try {
			// Get the active editor
			const editor = this.plugin.documentEngine.getActiveEditor();
			if (!editor) {
				return {
					success: false,
					error: 'No active editor found', editType: 'insert'
				};
			}

			// Get cursor position for streaming
			const cursorPosition = this.plugin.documentEngine.getCursorPosition();
			if (!cursorPosition) {
				return {
					success: false,
					error: 'Could not determine cursor position', editType: 'insert'
				};
			}

			// Start streaming at cursor position with completion callbacks
			const { updateStream, stopStream } = this.streamingManager.startStreaming(
				editor,
				cursorPosition,
				undefined,
				{
					animationMode: 'inline',
					onComplete: () => this.onStreamingComplete()
				}
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
			Logger.error('Error in streaming add command:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error', editType: 'insert'
			};
		}
	}

	/**
	 * Execute edit command with streaming support
	 */
	private async executeEditCommandWithStreaming(command: EditCommand): Promise<EditResult> {
		try {
			// Get the active editor
			const editor = this.plugin.documentEngine.getActiveEditor();
			if (!editor) {
				return {
					success: false,
					error: 'No active editor found', editType: 'insert'
				};
			}

			// Get cursor position for streaming
			const cursorPosition = this.plugin.documentEngine.getCursorPosition();
			if (!cursorPosition) {
				return {
					success: false,
					error: 'Could not determine cursor position', editType: 'insert'
				};
			}

			// Start streaming at cursor position with completion callbacks
			const { updateStream, stopStream } = this.streamingManager.startStreaming(
				editor,
				cursorPosition,
				undefined,
				{
					animationMode: 'inline',
					onComplete: () => this.onStreamingComplete()
				}
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
			Logger.error('Error in streaming edit command:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error', editType: 'insert'
			};
		}
	}

	/**
	 * Execute rewrite command with streaming support
	 */
	private async executeRewriteCommandWithStreaming(command: EditCommand): Promise<EditResult> {
		try {
			// Get the active editor
			const editor = this.plugin.documentEngine.getActiveEditor();
			if (!editor) {
				return {
					success: false,
					error: 'No active editor found', editType: 'insert'
				};
			}

			// Get cursor position for streaming
			const cursorPosition = this.plugin.documentEngine.getCursorPosition();
			if (!cursorPosition) {
				return {
					success: false,
					error: 'Could not determine cursor position', editType: 'insert'
				};
			}

			// Start streaming at cursor position with completion callbacks
			const { updateStream, stopStream } = this.streamingManager.startStreaming(
				editor,
				cursorPosition,
				undefined,
				{
					animationMode: 'inline',
					onComplete: () => this.onStreamingComplete()
				}
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
			Logger.error('Error in streaming rewrite command:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error', editType: 'insert'
			};
		}
	}

	/**
	 * Execute grammar command with streaming support
	 */
	private async executeGrammarCommandWithStreaming(command: EditCommand): Promise<EditResult> {
		try {
			// Get the active editor
			const editor = this.plugin.documentEngine.getActiveEditor();
			if (!editor) {
				return {
					success: false,
					error: 'No active editor found', editType: 'insert'
				};
			}

			// Get cursor position for streaming
			const cursorPosition = this.plugin.documentEngine.getCursorPosition();
			if (!cursorPosition) {
				return {
					success: false,
					error: 'Could not determine cursor position', editType: 'insert'
				};
			}

			// Start streaming at cursor position with completion callbacks
			const { updateStream, stopStream } = this.streamingManager.startStreaming(
				editor,
				cursorPosition,
				undefined,
				{
					animationMode: 'inline',
					onComplete: () => this.onStreamingComplete()
				}
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
			Logger.error('Error in streaming grammar command:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error', editType: 'insert'
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
		const currentFiles: string[] = [];
		const notFoundFiles: string[] = [];
		
		// Get existing persistent context directly (without clearing it)
		const existingPersistent = this.contextManager.getPersistentContext(this.currentFile.path) || [];
		const updatedPersistent = [...existingPersistent];
		
		
		for (const filename of filenames) {
			// Find the file by name efficiently
			let file = this.app.vault.getFileByPath(filename);
			if (!file) {
				file = this.app.vault.getFileByPath(filename + '.md');
			}
			if (!file) {
				// Use MetadataCache for efficient linkpath resolution instead of iterating all files
				file = this.app.metadataCache.getFirstLinkpathDest(filename, '');
			}
			
			if (file instanceof TFile) {
				// Check if this is the current active file
				if (file.path === this.currentFile?.path) {
					// Current file is already implicitly in context
					currentFiles.push(file.basename);
					// Add warning message to chat (not saved to conversation history)
					this.chatRenderer.addWarningMessage("Current file is always in context and doesn't need to be added explicitly.", false);
				} else {
					// Check if already in persistent context (check both existing and newly added in this batch)
					const filePath = file.path; // Store path to avoid null check issues in callback
					const exists = updatedPersistent.some(ref => ref.file.path === filePath);
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
				}
			} else {
				// File not found
				notFoundFiles.push(filename);
			}
		}
		
		// Update persistent context if we made any changes
		if (addedFiles.length > 0 || alreadyExistingFiles.length > 0 || currentFiles.length > 0) {
			// Use ContextManager to update persistent context
			this.contextManager.clearPersistentContext(this.currentFile.path).catch(error => { Logger.error('Failed to clear persistent context:', error); });
			for (const doc of updatedPersistent) {
				await this.contextManager.addDocument(doc.file);
			}
		}
		
		// Refresh context UI
		await this.refreshContext().catch(error => { Logger.error('Failed to refresh context:', error); });
		
		// Show a single comprehensive notification for better UX
		// const totalFiles = filenames.length;
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
		
		if (currentFiles.length > 0) {
			if (currentFiles.length === 1) {
				messages.push(`Current file is always in context`);
			} else {
				messages.push(`${currentFiles.length} current files are always in context`);
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

	/**
	 * Get contextual thinking phrase based on command type or message content
	 */
	private getContextualThinkingPhrase(command?: EditCommand, messageText?: string): string {
		// Determine context based on command type or message content
		if (command) {
			switch (command.action) {
				case 'grammar':
				case 'edit':
					return this.getRandomPhrase('improve');
				case 'add':
					return this.getRandomPhrase('generate');
				case 'rewrite':
					return this.getRandomPhrase('improve');
				case 'delete':
					return this.getRandomPhrase('process');
				default:
					return this.getRandomPhrase('chat');
			}
		} else if (messageText) {
			// Analyze message content for context
			if (messageText.includes('improve') || messageText.includes('fix') || messageText.includes('grammar')) {
				return this.getRandomPhrase('improve');
			} else if (messageText.includes('add') || messageText.includes('create') || messageText.includes('write')) {
				return this.getRandomPhrase('generate');
			} else if (messageText.includes('switch') || messageText.includes('/')) {
				return this.getRandomPhrase('switch');
			}
		}
		
		return this.getRandomPhrase('chat');
	}

	/**
	 * Get random phrase from specified category
	 */
	private getRandomPhrase(category: string): string {
		const phrases: Record<string, string[]> = {
			'improve': ['refining...', 'polishing...', 'enhancing...', 'crafting...', 'perfecting...', 'smoothing...', 'sharpening...', 'elevating...', 'fine-tuning...', 'sculpting...'],
			'generate': ['thinking...', 'crafting...', 'developing...', 'composing...', 'writing...', 'creating...', 'formulating...', 'building...', 'constructing...', 'drafting...'],
			'switch': ['connecting...', 'switching...', 'updating...', 'configuring...', 'setting up...', 'syncing...', 'preparing...', 'activating...', 'initializing...', 'establishing...'],
			'process': ['processing...', 'analyzing...', 'working...', 'computing...', 'calculating...', 'examining...', 'evaluating...', 'interpreting...', 'reviewing...', 'scanning...'],
			'chat': ['thinking...', 'processing...', 'considering...', 'analyzing...', 'understanding...', 'contemplating...', 'exploring...', 'evaluating...', 'working on it...', 'composing...']
		};
		
		const categoryPhrases = phrases[category] || phrases.chat;
		return categoryPhrases[Math.floor(Math.random() * categoryPhrases.length)];
	}

	/**
	 * Start phrase rotation animation for thinking text
	 */
	private startThinkingPhraseRotation(textEl: HTMLElement, command?: EditCommand, messageText?: string): void {
		// Change phrase every 2 seconds during processing
		const rotationInterval = this.registerInterval(window.setInterval(() => {
			const newPhrase = this.getContextualThinkingPhrase(command, messageText);
			textEl.textContent = newPhrase;
		}, 2000));

		// Store interval ID in WeakMap for proper cleanup
		// Note: registerInterval handles automatic cleanup, but we still store for manual cleanup if needed
		this.rotationIntervals.set(textEl, rotationInterval);
	}

	/**
	 * Stop phrase rotation animation and cleanup
	 */
	private stopThinkingPhraseRotation(textEl: HTMLElement): void {
		// Get interval from WeakMap and clean up
		const rotationInterval = this.rotationIntervals.get(textEl);
		if (rotationInterval) {
			clearInterval(rotationInterval);
			this.rotationIntervals.delete(textEl);
		}
	}

	/**
	 * Type guard to check if a view is a MarkdownView with editor property
	 */
	private isMarkdownView(view: ItemView | null): view is MarkdownView {
		return view instanceof MarkdownView && view.editor !== undefined;
	}

}