import { ItemView, WorkspaceLeaf, ButtonComponent, TextAreaComponent, TFile, Notice, MarkdownView } from 'obsidian';
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
		
		// Title and provider container
		const titleProviderContainer = headerEl.createDiv();
		titleProviderContainer.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';
		
		const titleEl = titleProviderContainer.createEl('h4', { text: 'Nova AI' });
		titleEl.style.cssText = 'margin: 0; font-size: 1.1em;';
		
		// Provider status
		const providerEl = titleProviderContainer.createDiv({ cls: 'nova-provider-status' });
		providerEl.style.cssText = `
			display: flex;
			align-items: center;
			gap: 5px;
			font-size: 0.8em;
			color: var(--text-muted);
		`;
		
		const statusDot = providerEl.createSpan({ cls: 'nova-status-dot' });
		statusDot.style.cssText = `
			width: 6px;
			height: 6px;
			border-radius: 50%;
			background: #4caf50;
		`;
		
		// Get current provider name - will be updated async
		const providerNameSpan = providerEl.createSpan({ text: 'Loading...' });
		
		// Update provider name asynchronously
		this.plugin.aiProviderManager.getCurrentProviderName().then(name => {
			providerNameSpan.setText(name);
		});
		
		// Clear Chat button
		const clearButton = new ButtonComponent(headerEl);
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
		// Clean up if needed
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

		// Welcome message
		this.addMessage('assistant', 'Hello! I\'m Nova, your AI Thinking Partner. How can I assist you today?');
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

		// Text area for user input
		const textAreaContainer = this.inputContainer.createDiv();
		this.textArea = new TextAreaComponent(textAreaContainer);
		this.textArea.setPlaceholder('Ask Nova to help edit your document...');
		this.textArea.inputEl.style.cssText = `
			width: 100%;
			min-height: 60px;
			max-height: 120px;
			resize: vertical;
			border: 1px solid var(--background-modifier-border);
			border-radius: 4px;
			padding: 8px;
		`;

		// Send button
		const buttonContainer = this.inputContainer.createDiv();
		buttonContainer.style.cssText = 'display: flex; justify-content: flex-end;';
		
		this.sendButton = new ButtonComponent(buttonContainer);
		this.sendButton.setButtonText('Send');
		this.sendButton.setCta();
		this.sendButton.onClick(() => this.handleSend());

		// Enter key handling
		this.textArea.inputEl.addEventListener('keydown', (event) => {
			if (event.key === 'Enter' && !event.shiftKey) {
				event.preventDefault();
				this.handleSend();
			}
		});
	}

	private addMessage(role: 'user' | 'assistant', content: string) {
		const messageEl = this.chatContainer.createDiv({ cls: `nova-message nova-message-${role}` });
		messageEl.style.cssText = `
			margin-bottom: 10px;
			padding: 8px 12px;
			border-radius: 8px;
			max-width: 85%;
			${role === 'user' 
				? 'margin-left: auto; background: var(--interactive-accent); color: var(--text-on-accent);' 
				: 'background: var(--background-primary); border: 1px solid var(--background-modifier-border);'
			}
		`;

		const roleEl = messageEl.createEl('div', { 
			text: role === 'user' ? 'You' : 'Nova',
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

		this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
	}

	private async handleSend() {
		const message = this.textArea.getValue().trim();
		if (!message) return;

		// Add user message
		this.addMessage('user', message);
		this.textArea.setValue('');
		this.sendButton.setDisabled(true);

		try {
			// Add loading indicator
			const loadingEl = this.chatContainer.createDiv({ cls: 'nova-loading' });
			loadingEl.style.cssText = `
				padding: 8px 12px;
				background: var(--background-primary);
				border: 1px solid var(--background-modifier-border);
				border-radius: 8px;
				margin-bottom: 10px;
				max-width: 85%;
			`;
			loadingEl.textContent = 'Nova is thinking...';

			// Store message in conversation manager
			const activeFile = this.app.workspace.getActiveFile();
			if (activeFile) {
				await this.plugin.documentEngine.addUserMessage(message);
			}

			// Check if this is a command or conversation
			const isLikelyCommand = this.plugin.promptBuilder['isLikelyCommand'](message);
			let response: string;
			
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
			
			// Store response in conversation manager
			if (activeFile) {
				await this.plugin.documentEngine.addAssistantMessage(response);
			}
			
			// Add AI response
			this.addMessage('assistant', response);
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

	private async executeCommand(command: EditCommand): Promise<string> {
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
				return `✅ ${this.getSuccessMessage(command.action)}`;
			} else {
				return `❌ Failed to ${command.action}: ${result.error}`;
			}
		} catch (error) {
			return `❌ Error executing command: ${(error as Error).message}`;
		}
	}

	private getSuccessMessage(action: string): string {
		switch (action) {
			case 'add':
				return 'Content added successfully';
			case 'edit':
				return 'Content edited successfully';
			case 'delete':
				return 'Content deleted successfully';
			case 'grammar':
				return 'Grammar corrected successfully';
			case 'rewrite':
				return 'Content rewritten successfully';
			default:
				return 'Command executed successfully';
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
				this.addMessage('assistant', `Welcome! I'm ready to help you with "${targetFile.basename}". What would you like to do?`);
			}
		} catch (error) {
			console.warn('Failed to load conversation history:', error);
			// Show welcome message on error
			this.addMessage('assistant', `Welcome! I'm ready to help you with "${targetFile.basename}". What would you like to do?`);
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
			this.addMessage('assistant', `Chat cleared! I'm ready to help you with "${this.currentFile.basename}". What would you like to do?`);
		} else {
			this.addMessage('assistant', "Chat cleared! I'm ready to help. What would you like to do?");
		}
		
		// Show notice to user
		new Notice('Chat history cleared');
	}
}