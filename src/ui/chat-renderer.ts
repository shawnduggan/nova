import { TFile } from 'obsidian';
import NovaPlugin from '../../main';

/**
 * Message options for unified message creation
 */
interface MessageOptions {
	type: 'pill' | 'bubble';
	variant: 'success' | 'error' | 'system' | 'user' | 'assistant';
	persist?: boolean; // Whether to save to conversation manager
}

/**
 * Handles all chat message rendering and display logic
 */
export class ChatRenderer {
	private plugin: NovaPlugin;
	private chatContainer: HTMLElement;
	private static readonly SCROLL_DELAY_MS = 50;

	constructor(plugin: NovaPlugin, chatContainer: HTMLElement) {
		this.plugin = plugin;
		this.chatContainer = chatContainer;
	}

	/**
	 * Add a chat message with role header
	 */
	addMessage(role: 'user' | 'assistant' | 'system', content: string): void {
		
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

		this.scrollToBottom(true);
	}

	/**
	 * Unified message creation - determines CSS class at creation time
	 */
	addStatusMessage(content: string, options: MessageOptions): void {
		// Determine CSS class based on type and variant
		const cssClass = this.getMessageCSSClass(content, options);
		
		// Create message element with static CSS class
		const messageEl = this.chatContainer.createDiv({ cls: `nova-message ${cssClass}` });
		const contentEl = messageEl.createEl('div', { cls: 'nova-message-content' });
		
		if (content.includes('<svg')) {
			contentEl.innerHTML = content;
		} else {
			contentEl.textContent = content;
		}

		// Save to conversation manager if requested
		if (options.persist) {
			const activeFile = this.plugin.app.workspace.getActiveFile();
			if (activeFile) {
				this.plugin.conversationManager.addSystemMessage(
					activeFile, 
					content,
					{ messageType: cssClass } // Store CSS class as metadata
				);
			}
		}

		this.scrollToBottom();
	}

	private getMessageCSSClass(content: string, options: MessageOptions): string {
		if (options.type === 'pill') {
			return `nova-pill-${options.variant}`;
		} else {
			return `nova-bubble-${options.variant}`;
		}
	}

	// Simple wrapper methods for backward compatibility
	addSuccessMessage(content: string, persist: boolean = false): void {
		// Use pill for short messages, bubble for longer ones
		const type = content.length <= 30 ? 'pill' : 'bubble';
		this.addStatusMessage(content, { type, variant: 'success', persist });
	}

	addErrorMessage(content: string, persist: boolean = false): void {
		const type = content.length <= 30 ? 'pill' : 'bubble';
		this.addStatusMessage(content, { type, variant: 'error', persist });
	}

	addWelcomeMessage(message?: string): void {
		const welcomeEl = this.chatContainer.createDiv({ cls: 'nova-welcome' });
		welcomeEl.style.cssText = `
			padding: var(--size-4-4);
			margin-bottom: var(--size-4-3);
			background: var(--background-modifier-hover);
			border-radius: var(--radius-s);
			border: 1px solid var(--background-modifier-border);
			text-align: center;
			position: relative;
		`;

		const content = message || `
			<div style="display: flex; align-items: center; justify-content: center; gap: var(--size-2-3); margin-bottom: var(--size-4-2);">
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
				<span style="font-size: var(--font-ui-large); font-weight: 600; color: var(--text-normal);">Welcome to Nova</span>
			</div>
			<p style="margin: 0 0 var(--size-4-3) 0; color: var(--text-muted); font-size: var(--font-ui-medium);">
				Your AI thinking partner for Obsidian. Start a conversation or use commands to enhance your writing.
			</p>
			<p style="margin: 0; color: var(--text-faint); font-size: var(--font-ui-small);">
				💡 <strong>Tip:</strong> Reference other notes with [[Note Name]] or use the ⚡ button for quick commands
			</p>
		`;

		welcomeEl.innerHTML = content;

		// Add dismiss button
		const dismissBtn = welcomeEl.createEl('button');
		dismissBtn.textContent = '×';
		dismissBtn.style.cssText = `
			position: absolute;
			top: var(--size-2-2);
			right: var(--size-2-2);
			background: none;
			border: none;
			font-size: var(--font-ui-large);
			color: var(--text-faint);
			cursor: pointer;
			padding: var(--size-2-1);
			border-radius: var(--radius-xs);
		`;

		dismissBtn.addEventListener('click', () => {
			welcomeEl.remove();
		});

		dismissBtn.addEventListener('mouseenter', () => {
			dismissBtn.style.color = 'var(--text-normal)';
			dismissBtn.style.background = 'var(--background-modifier-hover)';
		});

		dismissBtn.addEventListener('mouseleave', () => {
			dismissBtn.style.color = 'var(--text-faint)';
			dismissBtn.style.background = 'none';
		});

		this.scrollToBottom(true);
	}

	clearChat(): void {
		this.chatContainer.empty();
	}

	private scrollToBottom(smooth: boolean = false): void {
		setTimeout(() => {
			if (smooth) {
				this.chatContainer.scrollTo({
					top: this.chatContainer.scrollHeight,
					behavior: 'smooth'
				});
			} else {
				this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
			}
		}, ChatRenderer.SCROLL_DELAY_MS);
	}

	async loadConversationHistory(file: TFile): Promise<void> {
		const messages = await this.plugin.conversationManager.getRecentMessages(file, 50);
		
		if (messages.length === 0) {
			// No conversation exists - show welcome message
			this.addWelcomeMessage(`Working on "${file.basename}".`);
			return;
		}
		
		for (const message of messages) {
			if (message.role === 'system' && message.metadata?.messageType) {
				// Restore system message with original styling
				const messageEl = this.chatContainer.createDiv({ 
					cls: `nova-message ${message.metadata.messageType}` 
				});
				const contentEl = messageEl.createEl('div', { cls: 'nova-message-content' });
				
				if (message.content.includes('<svg')) {
					contentEl.innerHTML = message.content;
				} else {
					contentEl.textContent = message.content;
				}
			} else {
				// Regular user/assistant messages
				this.addMessage(message.role as 'user' | 'assistant' | 'system', message.content);
			}
		}
		
		this.scrollToBottom();
	}
}