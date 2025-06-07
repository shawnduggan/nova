import { ItemView, WorkspaceLeaf, ButtonComponent, TextAreaComponent } from 'obsidian';
import NovaPlugin from '../../main';

export const VIEW_TYPE_NOVA_SIDEBAR = 'nova-sidebar';

export class NovaSidebarView extends ItemView {
	plugin: NovaPlugin;
	private chatContainer!: HTMLElement;
	private inputContainer!: HTMLElement;
	private textArea!: TextAreaComponent;
	private sendButton!: ButtonComponent;

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

	async onOpen() {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.createEl('h4', { text: 'Nova AI Writing Partner' });

		this.createChatInterface(container);
		this.createInputInterface(container);
	}

	async onClose() {
		// Clean up if needed
	}

	private createChatInterface(container: HTMLElement) {
		this.chatContainer = container.createDiv({ cls: 'nova-chat-container' });
		this.chatContainer.style.cssText = `
			height: 60vh;
			overflow-y: auto;
			border: 1px solid var(--background-modifier-border);
			border-radius: 4px;
			padding: 10px;
			margin-bottom: 10px;
			background: var(--background-secondary);
		`;

		// Welcome message
		this.addMessage('assistant', 'Hello! I\'m Nova, your AI writing partner. I can help you with writing, editing, and improving your documents. How can I assist you today?');
	}

	private createInputInterface(container: HTMLElement) {
		this.inputContainer = container.createDiv({ cls: 'nova-input-container' });
		this.inputContainer.style.cssText = `
			display: flex;
			flex-direction: column;
			gap: 10px;
		`;

		// Text area for user input
		const textAreaContainer = this.inputContainer.createDiv();
		this.textArea = new TextAreaComponent(textAreaContainer);
		this.textArea.setPlaceholder('Ask Nova anything...');
		this.textArea.inputEl.style.cssText = `
			width: 100%;
			min-height: 80px;
			resize: vertical;
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

			// Get AI response
			const response = await this.plugin.aiProviderManager.generateText(message);
			
			// Remove loading indicator
			loadingEl.remove();
			
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
}