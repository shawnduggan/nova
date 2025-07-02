import { ItemView, WorkspaceLeaf, ButtonComponent, TextAreaComponent, TFile, Notice, MarkdownView, Platform, setIcon, EditorPosition } from 'obsidian';
import { DocumentAnalyzer } from '../core/document-analysis';
import NovaPlugin from '../../main';
import { EditCommand, EditResult } from '../core/types';
import { NovaWikilinkAutocomplete } from './wikilink-suggest';
import { MultiDocContext } from './context-manager';
import { getAvailableModels, getProviderTypeForModel } from '../ai/models';
import { ProviderType } from '../ai/types';
import { InputHandler } from './input-handler';
import { CommandSystem } from './command-system';
import { ContextManager } from './context-manager';
import { ChatRenderer } from './chat-renderer';
import { StreamingManager } from './streaming-manager';
import { SelectionContextMenu, SELECTION_ACTIONS } from './selection-context-menu';
import { formatContextUsage, getRemainingContextPercentage, getContextWarningLevel, getContextTooltip } from '../core/context-calculator';

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
	private inputHandler!: InputHandler;
	private commandSystem!: CommandSystem;
	private contextManager!: ContextManager;
	public chatRenderer!: ChatRenderer;
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
	private get contextIndicator() { return this.contextManager?.contextIndicator; }
	
	// Component references
	private commandPicker!: HTMLElement;
	private commandMenu!: HTMLElement;
	private commandButton!: ButtonComponent;
	private privacyIndicator?: HTMLElement;
	private currentProviderDropdown?: { cleanup?: () => void };
	
	// Cursor position tracking - file-scoped like conversation history
	private currentFileCursorPosition: EditorPosition | null = null;
	
	// Document drawer state (transient - always starts closed on file switch)
	private isDrawerOpen: boolean = false;
	private contextDrawerCloseHandler: EventListener | null = null;
	
	
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
		
		// Listen for provider configuration events
		this.registerDomEvent(document, 'nova-provider-configured' as keyof DocumentEventMap, this.handleProviderConfigured.bind(this));
		this.registerDomEvent(document, 'nova-provider-disconnected' as keyof DocumentEventMap, this.handleProviderDisconnected.bind(this));
		
		// Listen for license update events
		this.registerDomEvent(document, 'nova-license-updated' as keyof DocumentEventMap, this.handleLicenseUpdated.bind(this));
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
		this.refreshAllStats();
		// Refresh context indicators
		this.refreshContext();
	}

	async onOpen() {
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
		const titleEl = topRowEl.createEl('h4', { cls: 'nova-header-title' });
		
		// Use setIcon for the Nova icon (simpler and more reliable)
		const iconEl = titleEl.createSpan();
		setIcon(iconEl, 'nova-star');
		
		titleEl.createSpan({ text: ' Nova' });
		
		// Right side: Provider status and Clear button
		const rightContainer = topRowEl.createDiv({ cls: 'nova-header-right-container' });
		
		// Privacy indicator pill
		const privacyIndicator = rightContainer.createDiv({ cls: 'nova-privacy-indicator' });
		this.updatePrivacyIndicator(privacyIndicator);
		
		// Store reference for updates
		this.privacyIndicator = privacyIndicator;
		
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
		
		// Register blur listener for stats updates when editor loses focus
		this.setupEditorBlurListener();
		
		// Load conversation for current file
		this.loadConversationForActiveFile();
		
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

	/**
	 * Setup focus-based stats updates using Nova input focus as trigger
	 */
	private setupEditorBlurListener(): void {
		// Instead of trying to capture editor blur (which is unreliable), 
		// listen for Nova input focus - this means user moved from editor to chat
		const inputElement = this.inputHandler?.getTextArea()?.inputEl;
		if (inputElement) {
			this.registerDomEvent(inputElement, 'focus', () => {
				this.refreshAllStats();
			});
		}
		
		// Also update stats when Nova sidebar gains focus (click anywhere in sidebar)
		this.registerDomEvent(this.containerEl, 'mousedown', () => {
			// Small delay to ensure click is processed
			setTimeout(() => {
				this.refreshAllStats();
			}, 50);
		});
	}

	async onClose() {
		// Clean up provider dropdown event listener
		// TODO: Replace with proper class property in future refactor
		if (this.currentProviderDropdown?.cleanup) {
			this.currentProviderDropdown.cleanup();
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
		
		// Clean up context drawer close handler
		if (this.contextDrawerCloseHandler) {
			document.removeEventListener('click', this.contextDrawerCloseHandler);
			this.contextDrawerCloseHandler = null;
		}
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
		this.streamingManager = new StreamingManager();
		
		// Get reference to plugin's selection context menu (will set callback later)
		this.selectionContextMenu = this.plugin.selectionContextMenu;
		
		// Create InputHandler which will handle all input UI creation
		this.inputHandler = new InputHandler(this.plugin, this.inputContainer, this.contextManager);
		
		// Pass sidebar view reference for context operations
		this.inputHandler.setSidebarView(this);
		this.contextManager.setSidebarView(this);
		
		// Create the input interface using new InputHandler
		this.inputHandler.createInputInterface(this.chatContainer);
		
		// Create CommandSystem only if commands feature is enabled
		if (this.plugin.featureManager.isFeatureEnabled('commands')) {
			this.commandSystem = new CommandSystem(this.plugin, this.inputContainer, this.inputHandler.getTextArea());
			
			// Connect the CommandSystem to the InputHandler
			this.inputHandler.setCommandSystem(this.commandSystem);
		}
		
		// Set up send message callback
		this.inputHandler.setOnSendMessage((message: string) => {
			this.handleSend(message);
		});
		
		// Create context indicator and preview using ContextManager
		this.contextManager.createContextIndicator();
		
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
		if (!this.plugin.featureManager.isFeatureEnabled('commands')) {
			this.addErrorMessage('Commands are currently in early access for Supernova supporters. Available to all users September 30, 2025.');
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
			await this.plugin.settingTab.setCurrentModel(providerId);
			await this.plugin.saveSettings();
			this.addSuccessMessage(`✓ Switched to ${this.getProviderWithModelDisplayName(providerId)}`);
			return true;
		}

		// Check for custom commands (if feature enabled)
		if (this.plugin.featureManager.isFeatureEnabled('commands')) {
			const customCommand = this.plugin.settings.features?.commands?.customCommands?.find(cmd => cmd.trigger === command);
			if (customCommand) {
				// Execute custom command
				this.inputHandler.getTextArea().setValue(customCommand.template);
				// Trigger auto-grow after setting template
					setTimeout(() => this.autoGrowTextarea(), 0);
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
		if (this.plugin.featureManager.isFeatureEnabled('commands')) {
			const customCommands = this.plugin.settings.features?.commands?.customCommands || [];
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
		if (!this.plugin.featureManager.isFeatureEnabled('commands')) {
			this.addErrorMessage('Commands are currently in early access for Supernova supporters. Available to all users September 30, 2025.');
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

			item.addEventListener('click', () => {
				this.executeCommandFromMenu(command.trigger);
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
		this.handleSend();
	}


	private createContextPreview(): HTMLElement {

		// Create a preview area that shows live context as user types
		const previewContainer = this.inputContainer.createDiv({ cls: 'nova-context-preview nova-context-preview-container' });

		const previewText = previewContainer.createSpan({ cls: 'nova-context-preview-text nova-preview-text' });
		const iconEl = previewText.createSpan();
		setIcon(iconEl, 'book-open');
		previewText.createSpan({ text: ' Context will include: ' });

		const previewList = previewContainer.createSpan({ cls: 'nova-context-preview-list nova-preview-list' });

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
		if (!this.contextPreview) {
			return;
		}

		const message = this.inputHandler.getTextArea().getValue();
		if (!message) {
			this.contextPreview.removeClass('show');
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
		const persistentDocs = this.contextManager.getPersistentContext(this.currentFile?.path || '');
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
			this.contextPreview.addClass('show');
		} else {
			this.contextPreview.removeClass('show');
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

		const isMobile = Platform.isMobile;

		// Check if we actually need to recreate the indicator
		const newDocCount = this.currentContext?.persistentDocs?.length || 0;
		const currentDocCount = this.contextIndicator.getAttribute('data-doc-count');
		const currentFilePath = this.contextIndicator.getAttribute('data-file-path');
		const newFilePath = this.currentFile?.path || '';
		
		// Only skip recreation if same file AND same doc count
		if (currentDocCount === newDocCount.toString() && 
			currentFilePath === newFilePath && 
			newDocCount > 0) {
			return;
		}

		// Clean up the previous close handler to prevent accumulation
		if (this.contextDrawerCloseHandler) {
			document.removeEventListener('click', this.contextDrawerCloseHandler);
			this.contextDrawerCloseHandler = null;
		}

		this.contextIndicator.empty();
		
		if (!this.currentContext || !this.currentContext.persistentDocs) {
			this.contextIndicator.removeClass('show');
			this.contextIndicator.removeAttribute('data-doc-count');
			this.contextIndicator.removeAttribute('data-file-path');
			// Update input container state for mobile spacing
			if (this.inputHandler) {
				this.inputHandler.updateContextState(false);
			}
			return;
		}
		
		const allDocs = this.currentContext.persistentDocs;
		
		if (!allDocs || allDocs.length === 0) {
			this.contextIndicator.removeClass('show');
			this.contextIndicator.removeAttribute('data-doc-count');
			this.contextIndicator.removeAttribute('data-file-path');
			// Update input container state for mobile spacing
			if (this.inputHandler) {
				this.inputHandler.updateContextState(false);
			}
			return;
		}

		// Store doc count and file path to prevent unnecessary recreation
		this.contextIndicator.setAttribute('data-doc-count', allDocs.length.toString());
		this.contextIndicator.setAttribute('data-file-path', this.currentFile?.path || '');

		// Update input container state for mobile spacing
		if (this.inputHandler) {
			this.inputHandler.updateContextState(true);
		}

		// Show as thin line with mobile-optimized sizing
		this.contextIndicator.addClass('nova-context-indicator-dynamic');
		this.contextIndicator.addClass('show');
		// Single line summary (same style as live preview)
		const summaryEl = this.contextIndicator.createDiv({ cls: 'nova-context-summary' });
		
		const summaryTextEl = summaryEl.createSpan({ cls: 'nova-context-summary-text' });
		
		const docNames = allDocs.filter(doc => doc?.file?.basename).map(doc => doc.file.basename).slice(0, isMobile ? 1 : 2);
		const moreCount = allDocs.length > (isMobile ? 1 : 2) ? ` +${allDocs.length - (isMobile ? 1 : 2)}` : '';
		
		// Simplified single line display showing just document names
		summaryTextEl.addClass('nova-context-summary-text');
		
		// Create filename part that can truncate
		const filenamePartEl = summaryTextEl.createSpan({ cls: 'nova-context-filename-part' });
		// Create icon and text as separate elements for proper flex alignment
		const iconSpan = filenamePartEl.createSpan({ cls: 'nova-context-icon-span' });
		setIcon(iconSpan, 'book-open');
		
		const textSpan = filenamePartEl.createSpan({ cls: 'nova-context-text-span' });
		textSpan.textContent = `${docNames.join(', ')}${moreCount}`;
		
		// Mobile-friendly more menu indicator
		const expandIndicatorEl = summaryEl.createSpan({ cls: 'nova-context-expand-indicator' });
		setIcon(expandIndicatorEl, 'more-horizontal'); // More menu indicator
		if (isMobile) {
			expandIndicatorEl.addClass('is-mobile');
		}
		expandIndicatorEl.setAttr('title', 'Tap to manage documents');
		
		// Visual feedback on the whole summary line instead of just the indicator
		if (isMobile) {
			summaryEl.addEventListener('touchstart', () => {
				expandIndicatorEl.addClass('pressed');
			});
			summaryEl.addEventListener('touchend', () => {
				this.addTrackedTimeout(() => {
					expandIndicatorEl.removeClass('pressed');
				}, NovaSidebarView.HOVER_TIMEOUT_MS);
			});
		}
		// Desktop hover handled by CSS

		// Expanded state - mobile-responsive overlay
		const expandedEl = this.contextIndicator.createDiv({ cls: 'nova-context-expanded' });
		expandedEl.addClass('nova-context-expanded');
		if (isMobile) {
			expandedEl.addClass('is-mobile');
		}
		
		// Header for expanded state with mobile-optimized clear button
		const expandedHeaderEl = expandedEl.createDiv({ cls: 'nova-context-expanded-header' });
		expandedHeaderEl.addClass('nova-context-expanded-header');
		if (isMobile) {
			expandedHeaderEl.addClass('is-mobile');
		}
		
		const headerTitleEl = expandedHeaderEl.createSpan();
		const titleIconEl = headerTitleEl.createSpan();
		setIcon(titleIconEl, 'book-open');
		headerTitleEl.createSpan({ text: ` Documents (${allDocs.length})` });
		headerTitleEl.addClass('nova-context-header-title');
		
		// Clear all button using Obsidian trash icon
		const clearAllBtnComponent = new ButtonComponent(expandedHeaderEl);
		clearAllBtnComponent.setIcon('trash-2')
			.setTooltip('Clear all documents from context')
			.onClick(async () => {
				if (this.currentFile) {
					this.contextManager.clearPersistentContext(this.currentFile.path);
					await this.refreshContext();
				}
			});
		
		const clearAllBtn = clearAllBtnComponent.buttonEl;
		clearAllBtn.addClass('nova-context-clear-all-btn');
		if (isMobile) {
			clearAllBtn.addClass('is-mobile');
		}
		
		// Touch-friendly feedback for clear button on mobile
		if (isMobile) {
			clearAllBtn.addEventListener('touchstart', () => {
				clearAllBtn.addClass('nova-button-pressed');
			});
			clearAllBtn.addEventListener('touchend', () => {
				setTimeout(() => {
					clearAllBtn.removeClass('nova-button-pressed');
				}, NovaSidebarView.HOVER_TIMEOUT_MS);
			});
		}
		// Desktop hover handled by CSS
		
		// Document list for expanded state
		const docListEl = expandedEl.createDiv({ cls: 'nova-context-doc-list' });
		
		allDocs.filter(doc => doc?.file?.basename).forEach((doc, index) => {
			const docItemEl = docListEl.createDiv({ cls: 'nova-context-doc-item' });
			docItemEl.addClass('nova-context-doc-item');
			if (isMobile) {
				docItemEl.addClass('is-mobile');
			}
			if (index >= allDocs.length - 1) {
				docItemEl.addClass('last-item');
			}
			
			const docInfoEl = docItemEl.createDiv({ cls: 'nova-context-doc-info' });
			docInfoEl.addClass('nova-context-doc-info');
			
			const iconEl = docInfoEl.createSpan();
			setIcon(iconEl, 'file-text');
			iconEl.addClass('nova-context-doc-icon');
			
			const nameEl = docInfoEl.createSpan({ cls: 'nova-context-doc-name' });
			const suffix = doc.property ? `#${doc.property}` : '';
			nameEl.textContent = `${doc.file.basename}${suffix}`;
			nameEl.addClass('nova-context-doc-name');
			nameEl.setAttr('title', `${doc.file.path} (read-only for editing)`);
			
			// Add read-only indicator
			const readOnlyEl = docInfoEl.createSpan({ cls: 'nova-context-readonly' });
			readOnlyEl.textContent = 'read-only';
			readOnlyEl.addClass('nova-context-doc-readonly');
			
			// Mobile-optimized remove button with simple reliable icon
			const removeBtn = docItemEl.createEl('button', { cls: 'nova-context-doc-remove' });
			removeBtn.textContent = '×';
			removeBtn.addClass('nova-context-remove-btn');
			if (isMobile) {
				removeBtn.addClass('is-mobile');
			}
			removeBtn.setAttr('title', `Remove ${doc.file.basename}`);
			
			removeBtn.addEventListener('click', async (e: Event) => {
				e.stopPropagation();
				if (this.currentFile) {
					this.contextManager.removePersistentDoc(this.currentFile.path, doc.file.path);
					await this.refreshContext();
				}
			});
			
			// Platform-specific interaction feedback using CSS classes
			if (isMobile) {
				removeBtn.addEventListener('touchstart', () => {
					removeBtn.addClass('pressed');
				});
				
				removeBtn.addEventListener('touchend', () => {
					setTimeout(() => {
						removeBtn.removeClass('pressed');
					}, NovaSidebarView.HOVER_TIMEOUT_MS);
				});
			}
			// Desktop hover is handled by CSS
		});

		// Drawer always starts closed on file switch (transient state)
		this.isDrawerOpen = false;
		expandedEl.removeClass('show');

		// Click to expand management overlay
		// Using class property to persist state across updates
		
		const toggleExpanded = (e: MouseEvent) => {
			e.stopPropagation();
			this.isDrawerOpen = !this.isDrawerOpen;
			
			if (this.isDrawerOpen) {
				expandedEl.addClass('show');
				this.contextIndicator.addClass('drawer-open');
			} else {
				expandedEl.removeClass('show');
				this.contextIndicator.removeClass('drawer-open');
			}
		};
		
		// Click on the entire summary line to expand
		summaryEl.addEventListener('click', toggleExpanded);
		
		// Close when clicking outside
		this.contextDrawerCloseHandler = (e: Event) => {
			if (this.isDrawerOpen && !this.contextIndicator.contains(e.target as Node)) {
				this.isDrawerOpen = false;
				expandedEl.removeClass('show');
				this.contextIndicator.removeClass('drawer-open');
			}
		};
		
		// Use direct addEventListener instead of addTrackedEventListener to avoid conflicts
		document.addEventListener('click', this.contextDrawerCloseHandler);
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
				console.warn('Failed to refresh context:', error);
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
				new Notice('⚠️ Approaching token limit. Consider removing some documents from context.', NovaSidebarView.NOTICE_DURATION_MS);
			}
		}

		// Clear input and UI state first
		this.inputHandler.setValue('');
		
		// Hide context preview since we're sending the message
		if (this.contextPreview) {
			this.contextPreview.removeClass('show');
		}
		
		// Disable send button during processing
		// TODO: Add public getter method to InputHandler for sendButton access
		const sendButton = this.inputHandler.sendButtonComponent;
		if (sendButton) sendButton.setDisabled(true);

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
			const intent = await this.plugin.aiIntentClassifier.classifyIntent(processedMessage, hasSelection);
			
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
		} finally {
			// Re-enable send button
			// TODO: Add public getter method to InputHandler for sendButton access
		const sendButton = this.inputHandler.sendButtonComponent;
			if (sendButton) sendButton.setDisabled(false);
			// Refresh context indicator to show persistent documents
			await this.refreshContext();
		}
	}

	async insertTextIntoActiveNote(text: string) {
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
		const operationId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
		this.currentFileLoadOperation = operationId;
		
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
			// Immediately clear context state to prevent bleeding
			this.currentContext = null;
			this.contextManager.setCurrentFile(null);
			this.refreshContext();
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
		this.refreshAllStats();
		
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
			await this.chatRenderer.loadConversationHistory(targetFile);
			
			// PHASE 3 FIX: Check again after async operation
			if (this.currentFileLoadOperation !== operationId) {
				return;
			}
			
			// Now restore context after chat is loaded (so missing file notifications persist)
			await this.contextManager.restoreContextAfterChatLoad(targetFile);
			
			// Refresh the context UI after restoration to remove any stale references
			await this.refreshContext();
			
			// Show document insights after loading conversation
			await this.showDocumentInsights(targetFile);
			
			// PHASE 3 FIX: Final check after all async operations
			if (this.currentFileLoadOperation !== operationId) {
				return;
			}
			
			// ChatRenderer will handle showing welcome message if no conversation exists
		} catch (error) {
			console.error('Conversation loading error:', error);
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
			} catch (error) {
				// Failed to clear conversation - graceful fallback
			}
		}
		
		// Show notice to user
		new Notice('Chat cleared');
		
		// Show welcome message first, before context refresh triggers warnings
		this.addWelcomeMessage();
		
		// Then refresh context to rebuild currentContext from persistent storage and update UI
		if (this.currentFile) {
			await this.refreshContext();
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
		await this.refreshContext();
		
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
			const headingCount = (content.match(/^#{1,6}\s/gm) || []).length;
			
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
		} catch (error) {
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
		
		// Ensure token element exists (right side)
		let tokenEl = statsContainer.querySelector('.nova-token-usage') as HTMLElement;
		if (!tokenEl) {
			tokenEl = statsContainer.createEl('div', { cls: 'nova-token-usage' });
		}
		
		// Get total context usage if available, otherwise fall back to old calculation
		const totalContextUsage = this.currentContext?.totalContextUsage;
		let remainingPercent: number;
		let warningLevel: string;
		let displayText: string;
		let tooltipText: string;
		
		if (totalContextUsage) {
			// Use new total context calculation
			remainingPercent = getRemainingContextPercentage(totalContextUsage);
			warningLevel = getContextWarningLevel(totalContextUsage);
			displayText = formatContextUsage(totalContextUsage);
			tooltipText = getContextTooltip(totalContextUsage);
		} else {
			// No total context usage available - show minimal info without warnings
			const currentTokens = this.currentContext?.tokenCount || 0;
			remainingPercent = 100; // Don't calculate percentage without proper context limits
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

					const roleEl = messageEl.createEl('div', { 
						text: 'Nova',
						cls: 'nova-message-role'
					});

					const contentEl = messageEl.createEl('div', { cls: 'nova-message-content nova-insights-content' });
					contentEl.textContent = `I noticed:\n${bulletList}\n\nLet me help.`;

					// Scroll to show the new message
					setTimeout(() => {
						this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
					}, 50);
				}
			}
		} catch (error) {
			// Silently fail - analysis is optional
		}
	}

	/**
	 * Handle consultation requests - chat only, no document modification
	 */
	async handleConsultationRequest(input: string): Promise<void> {
		const activeFile = this.plugin.documentEngine.getActiveFile();
		
		// Get AI response using PromptBuilder but do NOT modify document
		const prompt = await this.plugin.promptBuilder.buildPromptForMessage(input, activeFile || undefined);
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
	showModeIndicator(mode: 'consultation' | 'editing'): void {
		// For now, this is a no-op placeholder
		// Future enhancement: show subtle UI indicator
	}

	/**
	 * Handle editing requests - preserves existing behavior with intent tracking
	 */
	async handleEditingRequest(input: string): Promise<string | null> {
		// Parse command using existing parser
		const parsedCommand = this.plugin.commandParser.parseCommand(input);
		
		// Track intent usage for analytics
		this.trackIntentUsage('editing', input);
		
		// Execute command using existing system
		return await this.executeCommand(parsedCommand);
	}

	/**
	 * Track intent usage for analytics (placeholder for future enhancement)
	 */
	trackIntentUsage(intent: 'consultation' | 'editing', input: string): void {
		// For now, this is a no-op placeholder
		// Future enhancement: collect analytics data
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
		const intent = await this.plugin.aiIntentClassifier.classifyIntent(input);
		
		switch (intent) {
			case 'CHAT':
				await this.handleConsultationRequest(input);
				break;
			case 'CONTENT':
				await this.handleEditingRequest(input);
				break;
			case 'METADATA':
				// Handle metadata commands through existing flow
				const parsedCommand = this.plugin.commandParser.parseCommand(input);
				await this.executeCommand(parsedCommand);
				break;
		}
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
		const currentProviderType = await this.plugin.aiProviderManager.getCurrentProviderType();
		// TODO: Add public getter method to InputHandler for sendButton access
		const sendButton = this.inputHandler.sendButtonComponent;
		if (sendButton) sendButton.setDisabled(!currentProviderType);
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
	private async createProviderDropdown(container: HTMLElement): Promise<void> {
		const isMobile = Platform.isMobile;
		const dropdownContainer = container.createDiv({ cls: 'nova-provider-dropdown-container' });
		dropdownContainer.addClass('nova-provider-dropdown-container');

		// Current provider button
		const providerButton = dropdownContainer.createEl('button', { cls: 'nova-provider-button' });
		providerButton.addClass('nova-provider-button');
		if (isMobile) {
			providerButton.addClass('is-mobile');
		}

		// Provider name - start with a placeholder to prevent "II" display
		const providerName = providerButton.createSpan({ text: 'Loading...', cls: 'nova-provider-name' });

		// Dropdown arrow
		const dropdownArrow = providerButton.createSpan({ text: '▼' });
		dropdownArrow.addClass('nova-dropdown-arrow');

		// Dropdown menu (initially hidden)
		const dropdownMenu = dropdownContainer.createDiv({ cls: 'nova-provider-dropdown-menu' });
		dropdownMenu.addClass('nova-dropdown-menu', 'hidden');
		
		// Add webkit scrollbar styling for better cross-browser support
		const scrollbarStyle = document.createElement('style');
		scrollbarStyle.textContent = `
			.nova-provider-dropdown-menu::-webkit-scrollbar {
				width: 6px;
			}
			.nova-provider-dropdown-menu::-webkit-scrollbar-track {
				background: transparent;
			}
			.nova-provider-dropdown-menu::-webkit-scrollbar-thumb {
				background: var(--background-modifier-border);
				border-radius: 3px;
			}
			.nova-provider-dropdown-menu::-webkit-scrollbar-thumb:hover {
				background: var(--background-modifier-border-hover);
			}
		`;
		if (!document.querySelector('.nova-scrollbar-style')) {
			scrollbarStyle.className = 'nova-scrollbar-style';
			document.head.appendChild(scrollbarStyle);
		}

		let isDropdownOpen = false;

		// Update current model display (optimized for speed)
		const updateCurrentProvider = () => {
			try {
				// Get the currently selected model synchronously
				const currentModel = this.plugin.aiProviderManager.getCurrentModel();
				
				if (currentModel) {
					// Get provider type directly from model name (no async needed)
					const providerType = getProviderTypeForModel(currentModel, this.plugin.settings);
					if (providerType) {
						const displayText = this.getModelDisplayName(providerType, currentModel);
						
						providerName.setText(displayText);
					} else {
						// Unknown provider, use raw model name
						providerName.setText(currentModel);
					}
				} else {
					// No model selected, show fallback
					providerName.setText('Select Model');
				}
			} catch (error) {
				console.error('Error updating model display:', error);
				providerName.setText('Select Model');
			}
		};

		// Toggle dropdown
		const toggleDropdown = () => {
			isDropdownOpen = !isDropdownOpen;
			if (isDropdownOpen) {
				dropdownMenu.removeClass('hidden');
				dropdownArrow.addClass('rotated');
			} else {
				dropdownMenu.addClass('hidden');
				dropdownArrow.removeClass('rotated');
			}
			
			if (isDropdownOpen) {
				this.populateProviderDropdown(dropdownMenu);
			}
		};

		// Close dropdown when clicking outside
		const closeDropdown: EventListener = (event: Event) => {
			if (!dropdownContainer.contains(event.target as Node)) {
				isDropdownOpen = false;
				dropdownMenu.addClass('hidden');
				dropdownArrow.removeClass('rotated');
			}
		};

		// Close dropdown helper function for internal use
		const closeDropdownInternal = () => {
			isDropdownOpen = false;
			dropdownMenu.addClass('hidden');
			dropdownArrow.removeClass('rotated');
		};

		providerButton.addEventListener('click', (e) => {
			e.stopPropagation();
			toggleDropdown();
		});

		// Add global click listener
		this.addTrackedEventListener(document, 'click', closeDropdown);

		// Update model name immediately (no async needed)
		updateCurrentProvider();

		// Store reference for cleanup and internal dropdown control
		// TODO: Replace with proper class property and interface definition
		(this as any).currentProviderDropdown = {
			updateCurrentProvider,
			closeDropdown: closeDropdownInternal,
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
			const providers = this.plugin.settings.aiProviders as Record<string, any>;
			if (providers[providerType]) {
				providers[providerType].model = modelValue;
			}
			
			// Show success message immediately (optimistic update)
			const modelDisplayName = this.getModelDisplayName(providerType, modelValue);
			const providerDisplayName = this.getProviderDisplayName(providerType);
			this.addSuccessMessage(`✓ Switched to ${providerDisplayName} ${modelDisplayName}`);
			
			// Save settings asynchronously (don't block UI)
			this.plugin.saveSettings().catch(error => {
				console.error('Error saving model selection:', error);
				this.addErrorMessage('Failed to save model selection');
			});
			
			// ADD THIS: Refresh privacy indicator and other status elements
			this.refreshProviderStatus().catch(error => {
				console.error('Error refreshing provider status:', error);
			});
			
			// Refresh context to update token count display for new provider
			this.refreshContext().catch(error => {
				console.error('Error refreshing context after model switch:', error);
			});
			
		} catch (error) {
			console.error('Error switching model:', error);
			this.addErrorMessage('Failed to switch model');
		}
	}

	/**
	 * Populate provider dropdown with grouped models and section headers
	 */
	private async populateProviderDropdown(dropdownMenu: HTMLElement): Promise<void> {
		dropdownMenu.empty();

		// Show loading state
		const loadingItem = dropdownMenu.createDiv({ cls: 'nova-dropdown-loading' });
		loadingItem.addClass('nova-dropdown-loading');
		loadingItem.setText('Loading providers...');

		try {
			// Get all providers in parallel with availability status
			const providerAvailability = await this.plugin.aiProviderManager.getAvailableProvidersWithStatus();
			const currentModel = this.plugin.aiProviderManager.getCurrentModel();
			const currentProviderType = await this.plugin.aiProviderManager.getCurrentProviderType();

			// Clear loading state
			dropdownMenu.empty();

			// Group models by provider with section headers
			let hasAnyProviders = false;
			
			for (const [providerType, isAvailable] of providerAvailability) {
				if (providerType === 'none' || !isAvailable) continue;

				// Check if provider has API key configured
				const providers = this.plugin.settings.aiProviders as Record<string, any>;
				const hasApiKey = providers[providerType]?.apiKey;
				if (!hasApiKey && providerType !== 'ollama') continue;
				
				// Check if provider has been successfully tested
				const providerConfig = this.plugin.settings.aiProviders[providerType as 'claude' | 'openai' | 'google' | 'ollama'];
				const providerStatus = providerConfig?.status;
				if (!providerStatus || providerStatus.state !== 'connected') continue;

				const models = this.getAvailableModels(providerType);
				const providerDisplayName = this.getProviderDisplayName(providerType);
				const providerColor = this.getProviderColor(providerType);

				// Skip providers with no models
				if (models.length === 0 && providerType !== 'ollama') continue;

				// Add provider section header
				if (hasAnyProviders) {
					// Add separator between provider sections
					const separator = dropdownMenu.createDiv({ cls: 'nova-provider-separator' });
					separator.addClass('nova-dropdown-separator');
				}

				const sectionHeader = dropdownMenu.createDiv({ cls: 'nova-provider-section-header' });
				sectionHeader.addClass('nova-dropdown-section-header');

				// Provider color dot in header
				const headerDot = sectionHeader.createSpan();
				headerDot.addClass('nova-dropdown-section-dot');
				headerDot.setAttribute('data-provider', providerType.toLowerCase());

				sectionHeader.createSpan({ text: providerDisplayName });
				hasAnyProviders = true;

				if (models.length === 0) {
					// Provider without specific models (like Ollama)
					this.createModelDropdownItem(
						dropdownMenu,
						providerType,
						providers[providerType]?.model || providerDisplayName,
						providerDisplayName,
						providerColor,
						currentProviderType === providerType,
						currentModel
					);
				} else {
					// Provider with specific models
					for (const model of models) {
						const isCurrentSelection = currentProviderType === providerType && model.value === currentModel;
						
						this.createModelDropdownItem(
							dropdownMenu,
							providerType,
							model.value,
							model.label,
							providerColor,
							isCurrentSelection,
							currentModel
						);
					}
				}
			}

			// If no providers available, show message
			if (!hasAnyProviders) {
				const noProvidersItem = dropdownMenu.createDiv();
				noProvidersItem.addClass('nova-dropdown-no-providers');
				noProvidersItem.setText('None configured');
			}

		} catch (error) {
			console.error('Error populating provider dropdown:', error);
			dropdownMenu.empty();
			const errorItem = dropdownMenu.createDiv();
			errorItem.addClass('nova-dropdown-error');
			errorItem.setText('Error loading providers');
		}
	}

	/**
	 * Create a single model dropdown item (just model name, no provider prefix)
	 */
	private createModelDropdownItem(
		container: HTMLElement,
		providerType: string,
		modelValue: string,
		modelDisplayName: string,
		providerColor: string,
		isCurrent: boolean,
		currentModel: string
	): void {
		const item = container.createDiv({ cls: 'nova-model-dropdown-item' });
		item.addClass('nova-dropdown-item');
		if (Platform.isMobile) {
			item.addClass('is-mobile');
		}
		if (isCurrent) {
			item.addClass('is-current-model');
		}

		// Provider color indicator (smaller dot)
		const dot = item.createSpan();
		dot.addClass('nova-dropdown-item-dot');
		dot.setAttribute('data-provider', providerType.toLowerCase());

		// Model name only (no provider prefix)
		const textSpan = item.createSpan({ text: modelDisplayName });
		textSpan.addClass('nova-dropdown-item-text');

		// Current selection indicator
		if (isCurrent) {
			const checkmark = item.createSpan({ text: '✓' });
			checkmark.addClass('nova-dropdown-item-checkmark');
		}

		// Click handler for single-click selection
		item.addEventListener('click', (e) => {
			e.stopPropagation();
			
			if (!isCurrent) {
				try {
					// Switch model immediately (no await needed)
					this.switchToModel(providerType, modelValue || this.getCurrentModel(providerType));
					
					// Close dropdown immediately
					if ((this as any).currentProviderDropdown?.closeDropdown) {
						(this as any).currentProviderDropdown.closeDropdown();
					}
					
					// Update display immediately
					if ((this as any).currentProviderDropdown) {
						(this as any).currentProviderDropdown.updateCurrentProvider();
					}
				} catch (error) {
					console.error('Error switching provider/model:', error);
				}
			}
		});

		// Hover effects are handled by CSS
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
			const modelDisplayName = this.getModelDisplayName(providerType, currentModel);
			
			// Debug logging for "II" issue
			if (modelDisplayName === "II" || modelDisplayName.match(/^I+$/)) {
				console.warn('Invalid model display name detected:', {
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
		if (!this.plugin.featureManager.isFeatureEnabled('commands')) {
			return false;
		}
		return this.plugin.settings.features?.commands?.showCommandButton ?? true;
	}

	/**
	 * Refresh all Supernova-gated UI elements when license status changes
	 */
	refreshSupernovaUI(): void {
		this.refreshCommandButton();
		// Future Supernova features can add their refresh logic here
	}

	/**
	 * Handle provider configuration events
	 */
	private handleProviderConfigured = async (event: Event) => {
		// Update current provider display text
		if ((this as any).currentProviderDropdown?.updateCurrentProvider) {
			try {
				(this as any).currentProviderDropdown.updateCurrentProvider();
			} catch (error) {
				console.error('❌ Failed to update provider display after configuration:', error);
			}
		}
		
		// Update privacy indicator
		if ((this as any).privacyIndicator) {
			await this.updatePrivacyIndicator((this as any).privacyIndicator);
		}
		
		// If dropdown is currently open, refresh the available models
		const dropdownMenu = this.containerEl.querySelector('.nova-provider-dropdown-menu') as HTMLElement;
		if (dropdownMenu && !dropdownMenu.hasClass('hidden')) {
			this.populateProviderDropdown(dropdownMenu);
		}
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
		
		// Update display regardless (in case dropdown was open)
		if ((this as any).currentProviderDropdown?.updateCurrentProvider) {
			try {
				(this as any).currentProviderDropdown.updateCurrentProvider();
			} catch (error) {
				console.error('❌ Failed to update provider display after disconnection:', error);
			}
		}
		
		// Update privacy indicator
		if ((this as any).privacyIndicator) {
			await this.updatePrivacyIndicator((this as any).privacyIndicator);
		}
		
		// If dropdown is currently open, refresh the available models
		const dropdownMenu = this.containerEl.querySelector('.nova-provider-dropdown-menu') as HTMLElement;
		if (dropdownMenu && !dropdownMenu.hasClass('hidden')) {
			this.populateProviderDropdown(dropdownMenu);
		}
	}

	/**
	 * Handle license update events
	 */
	private handleLicenseUpdated = async (event: Event) => {
		const customEvent = event as CustomEvent;
		const { hasLicense, licenseKey, action } = customEvent.detail;
		
		// Refresh Supernova UI when license status changes
		try {
			this.refreshSupernovaUI();
		} catch (error) {
			console.error('❌ Failed to refresh Supernova UI after license update:', error);
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
			const providerConfig = this.plugin.settings.aiProviders[providerType as 'claude' | 'openai' | 'google' | 'ollama'];
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
		const currentFiles: string[] = [];
		const notFoundFiles: string[] = [];
		
		// Get existing persistent context directly (without clearing it)
		const existingPersistent = this.contextManager.getPersistentContext(this.currentFile.path) || [];
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
			this.contextManager.clearPersistentContext(this.currentFile.path);
			for (const doc of updatedPersistent) {
				await this.contextManager.addDocument(doc.file);
			}
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
		const rotationInterval = setInterval(() => {
			const newPhrase = this.getContextualThinkingPhrase(command, messageText);
			textEl.textContent = newPhrase;
		}, 2000);
		
		// Store interval ID for cleanup
		// TODO: Replace with WeakMap or proper state management for element data
		(textEl as any).rotationInterval = rotationInterval;
	}

	/**
	 * Stop phrase rotation animation and cleanup
	 */
	private stopThinkingPhraseRotation(textEl: HTMLElement): void {
		// TODO: Replace with WeakMap or proper state management for element data
		if ((textEl as any).rotationInterval) {
			clearInterval((textEl as any).rotationInterval);
			(textEl as any).rotationInterval = null;
		}
	}

	/**
	 * Type guard to check if a view is a MarkdownView with editor property
	 */
	private isMarkdownView(view: ItemView | null): view is ItemView & { editor: any } {
		return view !== null && 'editor' in view && view.editor !== undefined;
	}

}