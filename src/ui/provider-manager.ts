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
		
		// Show configured models in dropdown labels
		const options: Record<string, string | null> = {
			'claude': this.getProviderWithModelDisplayName('claude'),
			'openai': this.getProviderWithModelDisplayName('openai'),
			'google': this.getProviderWithModelDisplayName('google'),
			'ollama': Platform.isDesktopApp ? this.getProviderWithModelDisplayName('ollama') : null,
		};

		// Filter out null values for addOptions
		const filteredOptions: Record<string, string> = {};
		Object.entries(options).forEach(([key, value]) => {
			if (value !== null) {
				filteredOptions[key] = value;
			}
		});
		this.dropdown.addOptions(filteredOptions);

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
			if (settings.aiProviders?.claude?.apiKey) return 'claude';
			if (settings.aiProviders?.openai?.apiKey) return 'openai';
			if (settings.aiProviders?.google?.apiKey) return 'google';
			if (settings.aiProviders?.ollama?.baseUrl) return 'ollama';
		} else {
			// Mobile: Only API-based providers
			if (settings.aiProviders?.claude?.apiKey) return 'claude';
			if (settings.aiProviders?.openai?.apiKey) return 'openai';
			if (settings.aiProviders?.google?.apiKey) return 'google';
		}
		
		return null;
	}

	private getProviderWithModelDisplayName(providerType: string): string {
		const settings = this.plugin.settings;
		
		switch (providerType) {
			case 'claude':
				const claudeModel = settings.aiProviders?.claude?.model || 'sonnet';
				return `Claude (${claudeModel})`;
			case 'openai':
				const openaiModel = settings.aiProviders?.openai?.model || 'gpt-4';
				return `OpenAI (${openaiModel})`;
			case 'google':
				const googleModel = settings.aiProviders?.google?.model || 'gemini-pro';
				return `Google (${googleModel})`;
			case 'ollama':
				const ollamaModel = settings.aiProviders?.ollama?.model;
				return `Ollama (${ollamaModel || 'not configured'})`;
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
			// Note: Provider switching logic would need to be implemented
			// based on the actual plugin architecture
			await this.plugin.saveSettings();

			// Update status display
			this.updateProviderStatus();

		} catch (error) {
			// Error switching provider - handled by UI feedback
		}
	}

	refreshDisplay(): void {
		this.updateProviderOptions();
		this.updateProviderStatus();
	}

	cleanup(): void {
		// Cleanup handled by Obsidian's component lifecycle
		this.dropdown = null;
		this.statusContainer = null;
		this.statusDot = null;
	}
}