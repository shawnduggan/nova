import { TFile, setIcon } from 'obsidian';
import NovaPlugin from '../../main';

/**
 * Message options for unified message creation
 */
interface MessageOptions {
	type: 'pill' | 'bubble';
	variant: 'success' | 'error' | 'warning' | 'system' | 'user' | 'assistant';
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

		const roleEl = messageEl.createEl('div', { 
			text: role === 'user' ? 'You' : role === 'system' ? 'System' : 'Nova',
			cls: 'nova-message-role'
		});

		const contentEl = messageEl.createEl('div', { cls: 'nova-message-content' });
		// Safe rendering - avoid innerHTML for security
		this.renderMessageContent(contentEl, content);

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
		
		// Safe rendering - avoid innerHTML for security
		this.renderMessageContent(contentEl, content);

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

	/**
	 * Safely render message content - parse icon messages and create DOM elements instead of using innerHTML
	 */
	private renderMessageContent(contentEl: HTMLElement, content: string): void {
		// Check if this is an icon message created by createIconMessage
		const iconMessagePattern = /<span style="[^"]*"><svg[^>]*>.*?<\/svg><span>([^<]*)<\/span><\/span>/;
		const match = content.match(iconMessagePattern);
		
		if (match) {
			// Extract icon and message from the HTML
			const svgMatch = content.match(/<svg[^>]*viewBox="([^"]*)"[^>]*>(.*?)<\/svg>/);
			const messageText = match[1];
			
			if (svgMatch) {
				// Create a wrapper span
				const wrapper = contentEl.createSpan();
				wrapper.style.display = 'inline-flex';
				wrapper.style.alignItems = 'center';
				wrapper.style.gap = '6px';
				
				// Try to identify the icon and use setIcon if possible
				const iconEl = wrapper.createSpan();
				
				// Map viewBox patterns to icon names (based on common patterns)
				const viewBox = svgMatch[1];
				let iconName = 'info'; // default fallback
				
				if (content.includes('stroke-width="2"') && content.includes('circle')) {
					if (content.includes('path d="M22 11.08')) iconName = 'alert-circle';
					else if (content.includes('path d="M22 12')) iconName = 'check-circle';
					else if (content.includes('path d="M18 6')) iconName = 'x-circle';
				}
				
				// Use Obsidian's setIcon for known icons
				setIcon(iconEl, iconName);
				
				// Add the message text
				wrapper.createSpan({ text: messageText });
			} else {
				// Fallback: just use the extracted text
				contentEl.textContent = match[1];
			}
		} else {
			// Regular text content (no SVG)
			contentEl.textContent = content;
		}
	}

	// Simple wrapper methods for backward compatibility
	addSuccessMessage(content: string, persist: boolean = false): void {
		// Auto-prepend checkmark if not already present
		if (!content.startsWith('✓ ') && !content.includes('<svg')) {
			content = '✓ ' + content;
		}
		// Always use pills for success messages to maintain consistency
		this.addStatusMessage(content, { type: 'pill', variant: 'success', persist });
	}

	addErrorMessage(content: string, persist: boolean = false): void {
		// Auto-prepend X if not already present
		if (!content.startsWith('❌ ') && !content.includes('<svg')) {
			content = '❌ ' + content;
		}
		const type = content.length <= 30 ? 'pill' : 'bubble';
		this.addStatusMessage(content, { type, variant: 'error', persist });
	}

	addWarningMessage(content: string, persist: boolean = false): void {
		// Auto-prepend warning if not already present
		if (!content.startsWith('⚠️ ') && !content.includes('<svg')) {
			content = '⚠️ ' + content;
		}
		const type = content.length <= 30 ? 'pill' : 'bubble';
		this.addStatusMessage(content, { type, variant: 'warning', persist });
	}

	addWelcomeMessage(message?: string): void {
		const welcomeEl = this.chatContainer.createDiv({ cls: 'nova-welcome' });

		// Create welcome content using DOM API instead of innerHTML
		const contentDiv = welcomeEl.createDiv({ cls: 'nova-welcome-content' });
		
		// Add Nova icon
		const iconDiv = contentDiv.createDiv({ cls: 'nova-welcome-icon' });
		setIcon(iconDiv, 'star');
		
		// Add welcome text
		const textP = contentDiv.createEl('p', { cls: 'nova-welcome-text' });
		textP.textContent = "Hi! I'm Nova, your AI writing partner. Select any text and right-click to transform it directly, or chat with me to add content exactly where your cursor is.";

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
			this.addWelcomeMessage();
			return;
		}
		
		for (const message of messages) {
			if (message.role === 'system' && message.metadata?.messageType) {
				// Restore system message with original styling
				const messageEl = this.chatContainer.createDiv({ 
					cls: `nova-message ${message.metadata.messageType}` 
				});
				const contentEl = messageEl.createEl('div', { cls: 'nova-message-content' });
				
				// Safe rendering - avoid innerHTML for security
				this.renderMessageContent(contentEl, message.content);
			} else {
				// Regular user/assistant messages
				this.addMessage(message.role as 'user' | 'assistant' | 'system', message.content);
			}
		}
		
		this.scrollToBottom();
	}
}