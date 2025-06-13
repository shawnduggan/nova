import { DropdownComponent, Platform } from 'obsidian';
import NovaPlugin from '../../main';

/**
 * Handles provider dropdown and switching logic
 */
export class ProviderManager {
	private plugin: NovaPlugin;
	private dropdown: DropdownComponent | null = null;
	private statusContainer: HTMLElement | null = null;
	private statusDot: HTMLElement | null = null;

	constructor(plugin: NovaPlugin) {
		this.plugin = plugin;
	}

	createProviderDropdown(container: HTMLElement): void {
		this.statusContainer = container.createDiv();
		this.statusContainer.style.cssText = `
			display: flex;
			align-items: center;
			gap: var(--size-2-2);
			font-size: var(--font-ui-small);
			color: var(--text-muted);
		`;

		// Status indicator dot
		this.statusDot = this.statusContainer.createDiv();
		this.statusDot.style.cssText = `
			width: 8px;
			height: 8px;
			border-radius: 50%;
			background: ${this.getProviderColor(this.getCurrentProviderType())};
		`;

		// Provider name
		const nameElement = this.statusContainer.createSpan();

		// Dropdown
		this.dropdown = new DropdownComponent(this.statusContainer);
		this.dropdown.selectEl.style.cssText = `
			background: transparent;
			border: none;
			color: var(--text-muted);
			font-size: var(--font-ui-small);
			cursor: pointer;
			padding: 0;
			margin-left: var(--size-2-1);
		`;

		this.updateProviderOptions();
		this.updateProviderStatus();

		this.dropdown.onChange(async (value) => {
			await this.switchProvider(value);
		});
	}

	private updateProviderOptions(): void {
		if (!this.dropdown) return;

		const currentProvider = this.getCurrentProviderType();
		
		this.dropdown.addOptions({
			'claude': 'Claude (Anthropic)',
			'openai': 'OpenAI',
			'google': 'Google AI',
			'ollama': Platform.isDesktopApp ? 'Ollama (Local)' : null,
		});

		if (currentProvider) {
			this.dropdown.setValue(currentProvider);
		}
	}

	private updateProviderStatus(): void {
		if (!this.statusDot || !this.statusContainer) return;

		const currentProviderType = this.getCurrentProviderType();
		
		if (currentProviderType) {
			// Provider is available - show green status
			this.statusDot.style.background = 'var(--text-success)';
			const displayText = this.getProviderWithModelDisplayName(currentProviderType);
			const nameElement = this.statusContainer.querySelector('span');
			if (nameElement) {
				nameElement.textContent = displayText;
			}
		} else {
			// No provider configured - show red status
			this.statusDot.style.background = 'var(--text-error)';
			const nameElement = this.statusContainer.querySelector('span');
			if (nameElement) {
				nameElement.textContent = 'No provider configured';
			}
		}
	}

	private getCurrentProviderType(): string | null {
		const settings = this.plugin.settings;
		
		if (Platform.isDesktopApp) {
			// Desktop: Check all providers in order of preference
			if (settings.claudeApiKey) return 'claude';
			if (settings.openaiApiKey) return 'openai';
			if (settings.googleApiKey) return 'google';
			if (settings.ollamaEnabled) return 'ollama';
		} else {
			// Mobile: Only API-based providers
			if (settings.claudeApiKey) return 'claude';
			if (settings.openaiApiKey) return 'openai';
			if (settings.googleApiKey) return 'google';
		}
		
		return null;
	}

	private getProviderWithModelDisplayName(providerType: string): string {
		const settings = this.plugin.settings;
		
		switch (providerType) {
			case 'claude':
				return `Claude (${settings.claudeModel || 'sonnet'})`;
			case 'openai':
				return `OpenAI (${settings.openaiModel || 'gpt-4'})`;
			case 'google':
				return `Google (${settings.googleModel || 'gemini-pro'})`;
			case 'ollama':
				return `Ollama (${settings.ollamaModel || 'llama2'})`;
			default:
				return 'Unknown Provider';
		}
	}

	private getProviderColor(providerType: string | null): string {
		if (!providerType) return 'var(--text-error)';
		
		// Use theme-compatible colors
		const colors: Record<string, string> = {
			'claude': 'var(--color-orange)',
			'openai': 'var(--color-green)',
			'google': 'var(--color-blue)',
			'ollama': 'var(--color-purple)',
		};
		return colors[providerType] || 'var(--text-success)';
	}

	private async switchProvider(providerType: string): Promise<void> {
		try {
			// Update current provider in settings
			this.plugin.settings.currentProvider = providerType;
			await this.plugin.saveSettings();

			// Update status display
			this.updateProviderStatus();

			// Clear conversation context when switching providers
			this.plugin.sidebarView?.clearConversation?.();

		} catch (error) {
			// Error switching provider - handled by UI feedback
		}
	}

	cleanup(): void {
		// Cleanup handled by Obsidian's component lifecycle
		this.dropdown = null;
		this.statusContainer = null;
		this.statusDot = null;
	}
}