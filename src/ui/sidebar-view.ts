import { ItemView, WorkspaceLeaf, ButtonComponent, TextAreaComponent, TFile, Notice, MarkdownView, Platform } from 'obsidian';
import NovaPlugin from '../../main';
import { EditCommand } from '../core/types';

export const VIEW_TYPE_NOVA_SIDEBAR = 'nova-sidebar';

export class NovaSidebarView extends ItemView {
	plugin: NovaPlugin;
	private chatContainer!: HTMLElement;
	private inputContainer!: HTMLElement;
	private textArea!: TextAreaComponent;
	private sendButton!: ButtonComponent;
	private currentFile: TFile | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: NovaPlugin) {
		super(leaf);
		this.plugin = plugin;
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
		`;
		
		// Header with provider info
		const headerEl = wrapperEl.createDiv({ cls: 'nova-header' });
		headerEl.style.cssText = `
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: 10px;
			border-bottom: 1px solid var(--background-modifier-border);
			flex-shrink: 0;
		`;
		
		// Left side: Title with Nova icon
		const titleEl = headerEl.createEl('h4');
		titleEl.style.cssText = 'margin: 0; font-size: 1.1em; display: flex; align-items: center; gap: 6px;';
		titleEl.innerHTML = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 18px; height: 18px;">
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
		rightContainer.style.cssText = 'display: flex; align-items: center; gap: 8px;';
		
		// All users can switch providers freely
		this.createProviderDropdown(rightContainer);
		
		// Clear Chat button in right container
		const clearButton = new ButtonComponent(rightContainer);
		clearButton.setButtonText('Clear')
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
	}

	async onClose() {
		// Clean up provider dropdown event listener
		if ((this as any).currentProviderDropdown?.cleanup) {
			(this as any).currentProviderDropdown.cleanup();
		}
	}

	private createChatInterface(container: HTMLElement) {
		this.chatContainer = container.createDiv({ cls: 'nova-chat-container' });
		this.chatContainer.style.cssText = `
			flex: 1;
			overflow-y: auto;
			padding: 10px;
			background: var(--background-secondary);
			display: flex;
			flex-direction: column;
			gap: 8px;
		`;

		// Welcome message with Nova branding
		this.addWelcomeMessage();
	}

	private createInputInterface(container: HTMLElement) {
		this.inputContainer = container.createDiv({ cls: 'nova-input-container' });
		this.inputContainer.style.cssText = `
			display: flex;
			flex-direction: column;
			gap: 8px;
			padding: 10px;
			border-top: 1px solid var(--background-modifier-border);
			flex-shrink: 0;
		`;

		// Simplified input row with just textarea and send button
		const inputRow = this.inputContainer.createDiv({ cls: 'nova-input-row' });
		inputRow.style.cssText = `
			display: flex;
			align-items: center;
			gap: 8px;
		`;

		// Text area takes most space
		const textAreaContainer = inputRow.createDiv();
		textAreaContainer.style.cssText = 'flex: 1;';
		this.textArea = new TextAreaComponent(textAreaContainer);
		this.textArea.setPlaceholder('Ask Nova to help edit your document...');
		this.textArea.inputEl.style.cssText = `
			width: 100%;
			min-height: 38px;
			max-height: 120px;
			resize: vertical;
			border: 1px solid var(--background-modifier-border);
			border-radius: 8px;
			padding: 10px;
			font-size: var(--font-text-size);
			line-height: var(--line-height-normal);
		`;

		// Send button vertically centered
		this.sendButton = new ButtonComponent(inputRow);
		this.sendButton.setIcon('send');
		this.sendButton.setTooltip('Send message');
		this.sendButton.setCta();
		this.sendButton.onClick(() => this.handleSend());
		this.sendButton.buttonEl.style.cssText = `
			width: 36px;
			height: 36px;
			border-radius: 50%;
			display: flex;
			align-items: center;
			justify-content: center;
			padding: 0;
			flex-shrink: 0;
		`;

		// Enter key handling
		this.textArea.inputEl.addEventListener('keydown', (event) => {
			if (event.key === 'Enter' && !event.shiftKey) {
				event.preventDefault();
				this.handleSend();
			}
		});
	}

	private addMessage(role: 'user' | 'assistant' | 'system', content: string) {
		const messageEl = this.chatContainer.createDiv({ cls: `nova-message nova-message-${role}` });
		messageEl.style.cssText = `
			margin-bottom: 10px;
			padding: 8px 12px;
			border-radius: 8px;
			max-width: 85%;
			${role === 'user' 
				? 'margin-left: auto; background: var(--interactive-accent); color: var(--text-on-accent);' 
				: role === 'system'
				? 'margin: 0 auto; background: var(--background-modifier-hover); color: var(--text-muted); text-align: center; font-size: 0.9em;'
				: 'background: var(--background-primary); border: 1px solid var(--background-modifier-border);'
			}
		`;

		const roleEl = messageEl.createEl('div', { 
			text: role === 'user' ? 'You' : role === 'system' ? 'System' : 'Nova',
			cls: 'nova-message-role'
		});
		roleEl.style.cssText = `
			font-size: 0.8em;
			opacity: 0.7;
			margin-bottom: 4px;
			font-weight: 600;
		`;

		const contentEl = messageEl.createEl('div', { cls: 'nova-message-content' });
		contentEl.textContent = content;

		// Auto-scroll to bottom with smooth animation
		setTimeout(() => {
			this.chatContainer.scrollTo({
				top: this.chatContainer.scrollHeight,
				behavior: 'smooth'
			});
		}, 50);
	}

	private addWelcomeMessage(message?: string) {
		const welcomeEl = this.chatContainer.createDiv({ cls: 'nova-welcome' });
		welcomeEl.style.cssText = `
			display: flex;
			align-items: center;
			gap: 12px;
			margin: 16px auto;
			padding: 16px 20px;
			background: var(--background-primary);
			border: 1px solid var(--background-modifier-border);
			border-radius: 18px;
			max-width: 90%;
			animation: fadeIn 0.5s ease-in;
		`;
		
		// Nova star icon (static, not animated)
		const iconContainer = welcomeEl.createDiv({ cls: 'nova-welcome-icon' });
		iconContainer.style.cssText = `
			position: relative;
			width: 32px;
			height: 32px;
			flex-shrink: 0;
		`;
		
		iconContainer.innerHTML = `
			<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width: 32px; height: 32px; color: var(--interactive-accent);">
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
		
		const titleEl = textContainer.createDiv({ text: 'Welcome to Nova' });
		titleEl.style.cssText = `
			font-weight: 600;
			color: var(--text-normal);
			margin-bottom: 4px;
			font-size: var(--font-text-size);
		`;
		
		const subtitleEl = textContainer.createDiv({ text: message || 'Your AI thinking partner. Ask me to help edit your document!' });
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
		}, 50);
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
			<div style="width: 12px; height: 12px; margin-right: 6px; border-radius: 50%; background: #4caf50; display: flex; align-items: center; justify-content: center;">
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
		}, 50);
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

	private async handleSend() {
		const message = this.textArea.getValue().trim();
		if (!message) return;

		// Add user message
		this.addMessage('user', message);
		this.textArea.setValue('');
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
			const isLikelyCommand = this.plugin.promptBuilder['isLikelyCommand'](message);
			let response: string | null = null;
			
			if (isLikelyCommand && activeFile) {
				// Parse as command and route to appropriate handler
				const parsedCommand = this.plugin.commandParser.parseCommand(message);
				response = await this.executeCommand(parsedCommand);
			} else {
				// Handle as conversation using PromptBuilder
				const prompt = await this.plugin.promptBuilder.buildPromptForMessage(message, activeFile || undefined);
				
				// Get AI response using the provider manager
				response = await this.plugin.aiProviderManager.complete(prompt.systemPrompt, prompt.userPrompt, {
					temperature: prompt.config.temperature,
					maxTokens: prompt.config.maxTokens
				});
			}
			
			// Remove loading indicator
			loadingEl.remove();
			
			// Store response in conversation manager (if response exists)
			if (activeFile && response) {
				await this.plugin.documentEngine.addAssistantMessage(response);
			}
			
			// Add AI response (only if there is a response)
			if (response) {
				this.addMessage('assistant', response);
			}
		} catch (error) {
			// Remove loading indicator if it exists
			const loadingEl = this.chatContainer.querySelector('.nova-loading');
			if (loadingEl) loadingEl.remove();
			
			this.addMessage('assistant', `Sorry, I encountered an error: ${(error as Error).message}`);
		} finally {
			this.sendButton.setDisabled(false);
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
				return `❌ No markdown file is open. Please open a file in the editor to use editing commands.`;
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
				return `❌ Unable to access the file "${this.currentFile.basename}". Please make sure it's open in the editor.`;
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
				default:
					return `I don't understand the command "${command.action}". Try asking me to add, edit, delete, fix grammar, or rewrite content.`;
			}
			
			if (result.success) {
				// Add compact success indicator instead of full message
				this.addSuccessIndicator(command.action);
				return null; // Don't return text for regular message
			} else {
				return `Failed to ${command.action}: ${result.error}`;
			}
		} catch (error) {
			return `❌ Error executing command: ${(error as Error).message}`;
		}
	}


	private async loadConversationForActiveFile() {
		const activeFile = this.app.workspace.getActiveFile();
		
		// If no active file, try to find any open markdown file
		let targetFile = activeFile;
		if (!targetFile) {
			const leaves = this.app.workspace.getLeavesOfType('markdown');
			if (leaves.length > 0) {
				const view = leaves[0].view as MarkdownView;
				targetFile = view.file;
			}
		}
		
		// If no file or same file, do nothing
		if (!targetFile || targetFile === this.currentFile) {
			return;
		}
		
		this.currentFile = targetFile;
		
		// Clear current chat
		this.chatContainer.empty();
		
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
				this.addWelcomeMessage(`Ready to help you with "${targetFile.basename}". What would you like to do?`);
			}
		} catch (error) {
			console.warn('Failed to load conversation history:', error);
			// Show welcome message on error
			this.addWelcomeMessage(`Ready to help you with "${targetFile.basename}". What would you like to do?`);
		}
	}

	private async clearChat() {
		// Clear the chat container
		this.chatContainer.empty();
		
		// Clear conversation in conversation manager
		if (this.currentFile) {
			try {
				await this.plugin.conversationManager.clearConversation(this.currentFile);
			} catch (error) {
				console.warn('Failed to clear conversation:', error);
			}
		}
		
		// Show fresh welcome message
		if (this.currentFile) {
			this.addWelcomeMessage(`Chat cleared! Ready to help you with "${this.currentFile.basename}". What would you like to do?`);
		} else {
			this.addWelcomeMessage("Chat cleared! Ready to help. What would you like to do?");
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
		const validActions = ['add', 'edit', 'delete', 'grammar', 'rewrite'];
		if (validActions.includes(command.action)) {
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
	 * Create static provider status for Core tier users
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
			background: #4caf50;
		`;
		
		const headerProviderName = providerStatus.createSpan({ text: 'Loading...' });
		
		// Update provider name asynchronously
		this.plugin.aiProviderManager.getCurrentProviderName().then(name => {
			headerProviderName.setText(name);
		});
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
			background: #4caf50;
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
			const currentProviderName = await this.plugin.aiProviderManager.getCurrentProviderName();
			providerName.setText(currentProviderName);
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
		const closeDropdown = (event: MouseEvent) => {
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
		document.addEventListener('click', closeDropdown);

		// Update provider name initially
		updateCurrentProvider();

		// Store reference for cleanup
		(this as any).currentProviderDropdown = {
			updateCurrentProvider,
			cleanup: () => document.removeEventListener('click', closeDropdown)
		};
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

			const providerItem = dropdownMenu.createDiv({ cls: 'nova-provider-dropdown-item' });
			providerItem.style.cssText = `
				padding: 8px 12px;
				cursor: pointer;
				display: flex;
				align-items: center;
				gap: 8px;
				font-size: 0.85em;
				transition: background-color 0.2s ease;
			`;

			// Provider icon/dot
			const providerDot = providerItem.createSpan();
			providerDot.style.cssText = `
				width: 8px;
				height: 8px;
				border-radius: 50%;
				background: ${this.getProviderColor(providerType)};
			`;

			// Provider name
			const displayName = this.getProviderDisplayName(providerType);
			const nameSpan = providerItem.createSpan({ text: displayName });

			// Mark current provider
			const isCurrent = displayName === currentProviderName;
			if (isCurrent) {
				providerItem.style.background = 'var(--background-modifier-hover)';
				nameSpan.style.fontWeight = 'bold';
			}

			// Click handler
			providerItem.addEventListener('click', async () => {
				if (!isCurrent) {
					await this.switchToProvider(providerType);
					// Close dropdown
					dropdownMenu.style.display = 'none';
					if ((this as any).currentProviderDropdown) {
						(this as any).currentProviderDropdown.updateCurrentProvider();
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
				if (!isCurrent) {
					providerItem.style.background = 'transparent';
				}
			});
		}
	}

	/**
	 * Get display name for provider
	 */
	private getProviderDisplayName(providerType: string): string {
		const names: Record<string, string> = {
			'claude': 'Claude',
			'openai': 'OpenAI',
			'google': 'Gemini',
			'ollama': 'Ollama',
			'none': 'None'
		};
		return names[providerType] || providerType;
	}

	/**
	 * Get color for provider type
	 */
	private getProviderColor(providerType: string): string {
		const colors: Record<string, string> = {
			'claude': '#D2691E',
			'openai': '#10A37F',
			'google': '#4285F4',
			'ollama': '#7C3AED',
			'none': '#999'
		};
		return colors[providerType] || '#4caf50';
	}

	/**
	 * Switch to a different provider and update conversation context
	 */
	private async switchToProvider(providerType: string): Promise<void> {
		try {
			// Add a system message about provider switching
			const switchMessage = `🔄 Switched to ${this.getProviderDisplayName(providerType)}`;
			this.addMessage('system', switchMessage);
			
			// Update the platform settings to use the new provider
			const platform = Platform.isMobile ? 'mobile' : 'desktop';
			this.plugin.settings.platformSettings[platform].primaryProvider = providerType as any;
			await this.plugin.saveSettings();
			
			// Re-initialize the provider manager with new settings
			this.plugin.aiProviderManager.updateSettings(this.plugin.settings);
			
		} catch (error) {
			console.error('Error switching provider:', error);
			this.addMessage('system', `❌ Failed to switch to ${this.getProviderDisplayName(providerType)}`);
		}
	}

}