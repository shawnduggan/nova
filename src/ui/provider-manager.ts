import { DropdownComponent, Platform } from 'obsidian';
import NovaPlugin from '../../main';
import { getAvailableModels } from '../ai/models';

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
		const currentModel = this.getCurrentModel();
		
		// Clear existing options
		this.dropdown.selectEl.empty();
		
		// Claude models
		const claudeModels = this.getProviderModels('claude');
		if (claudeModels.length > 0) {
			const claudeGroup = this.dropdown.selectEl.createEl('optgroup');
			claudeGroup.label = 'Claude';
			claudeModels.forEach(model => {
				const option = claudeGroup.createEl('option');
				option.value = `claude-${model.value}`;
				option.textContent = model.label;
			});
		}
		
		// OpenAI models
		const openaiModels = this.getProviderModels('openai');
		if (openaiModels.length > 0) {
			const openaiGroup = this.dropdown.selectEl.createEl('optgroup');
			openaiGroup.label = 'OpenAI';
			openaiModels.forEach(model => {
				const option = openaiGroup.createEl('option');
				option.value = `openai-${model.value}`;
				option.textContent = model.label;
			});
		}
		
		// Google models
		const googleModels = this.getProviderModels('google');
		if (googleModels.length > 0) {
			const googleGroup = this.dropdown.selectEl.createEl('optgroup');
			googleGroup.label = 'Google';
			googleModels.forEach(model => {
				const option = googleGroup.createEl('option');
				option.value = `google-${model.value}`;
				option.textContent = model.label;
			});
		}
		
		// Ollama model (only on desktop, only if configured)
		if (Platform.isDesktopApp) {
			const ollamaModel = this.plugin.settings.aiProviders?.ollama?.model;
			if (ollamaModel && ollamaModel.trim()) {
				const ollamaGroup = this.dropdown.selectEl.createEl('optgroup');
				ollamaGroup.label = 'Ollama';
				const option = ollamaGroup.createEl('option');
				option.value = `ollama-${ollamaModel}`;
				option.textContent = ollamaModel;
			}
		}

		// Set current selection based on provider and model
		if (currentProvider && currentModel) {
			const currentKey = `${currentProvider}-${currentModel}`;
			this.dropdown.setValue(currentKey);
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

	private getCurrentModel(): string | null {
		const provider = this.getCurrentProviderType();
		if (!provider) return null;
		
		const settings = this.plugin.settings;
		switch (provider) {
			case 'claude':
				return settings.aiProviders?.claude?.model || 'claude-3-5-sonnet-20241022';
			case 'openai':
				return settings.aiProviders?.openai?.model || 'gpt-4o';
			case 'google':
				return settings.aiProviders?.google?.model || 'gemini-1.5-flash';
			case 'ollama':
				return settings.aiProviders?.ollama?.model || null;
			default:
				return null;
		}
	}

	private getProviderModels(provider: string): Array<{value: string, label: string}> {
		return getAvailableModels(provider, this.plugin.settings);
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

	private async switchProvider(providerModelKey: string): Promise<void> {
		try {
			// Parse provider-model key (e.g., "claude-claude-3-5-sonnet-20241022")
			const parts = providerModelKey.split('-');
			if (parts.length < 2) return;
			
			const provider = parts[0]; // e.g., "claude"
			const model = parts.slice(1).join('-'); // e.g., "claude-3-5-sonnet-20241022"
			
			// Update settings with both provider and model
			if (this.plugin.settings.aiProviders) {
				switch (provider) {
					case 'claude':
						if (this.plugin.settings.aiProviders.claude) {
							this.plugin.settings.aiProviders.claude.model = model;
						}
						break;
					case 'openai':
						if (this.plugin.settings.aiProviders.openai) {
							this.plugin.settings.aiProviders.openai.model = model;
						}
						break;
					case 'google':
						if (this.plugin.settings.aiProviders.google) {
							this.plugin.settings.aiProviders.google.model = model;
						}
						break;
					case 'ollama':
						if (this.plugin.settings.aiProviders.ollama) {
							this.plugin.settings.aiProviders.ollama.model = model;
						}
						break;
				}
			}
			
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