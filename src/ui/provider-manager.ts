import { DropdownComponent, Platform } from 'obsidian';
import NovaPlugin from '../../main';
import { getAvailableModels } from '../ai/models';
import { Logger } from '../utils/logger';

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

	async createProviderDropdown(container: HTMLElement): Promise<void> {
		this.statusContainer = container.createDiv({ cls: 'nova-provider-status-wrapper' });

		// Status indicator dot
		this.statusDot = this.statusContainer.createDiv({ cls: 'nova-provider-status-dot' });

		// Provider name
		this.statusContainer.createSpan();

		// Dropdown
		this.dropdown = new DropdownComponent(this.statusContainer);
		this.dropdown.selectEl.addClass('nova-provider-dropdown-select');

		await this.updateProviderOptions();
		await this.updateProviderStatus();

		this.dropdown.onChange(async (value) => {
			await this.switchProvider(value);
		});
	}

	private async updateProviderOptions(): Promise<void> {
		if (!this.dropdown) return;

		const currentProvider = await this.getCurrentProviderType();
		const currentModel = await this.getCurrentModel();
		
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

	private async updateProviderStatus(): Promise<void> {
		if (!this.statusDot || !this.statusContainer) return;

		const currentProviderType = await this.getCurrentProviderType();
		
		if (currentProviderType) {
			// Provider is available - show green status
			this.statusDot.removeClass('error');
			this.statusDot.addClass('success');
			const displayText = this.getProviderWithModelDisplayName(currentProviderType);
			const nameElement = this.statusContainer.querySelector('span');
			if (nameElement) {
				nameElement.textContent = displayText;
			}
		} else {
			// No provider configured - show red status
			this.statusDot.removeClass('success');
			this.statusDot.addClass('error');
			const nameElement = this.statusContainer.querySelector('span');
			if (nameElement) {
				nameElement.textContent = 'No provider configured';
			}
		}
	}

	private async getCurrentProviderType(): Promise<string | null> {
		// Use the AI Provider Manager's logic for consistency
		return await this.plugin.aiProviderManager.getCurrentProviderType();
	}

	private async getCurrentModel(): Promise<string | null> {
		const provider = await this.getCurrentProviderType();
		if (!provider) return null;
		
		const settings = this.plugin.settings;
		switch (provider) {
			case 'claude':
				return settings.aiProviders?.claude?.model || null;
			case 'openai':
				return settings.aiProviders?.openai?.model || null;
			case 'google':
				return settings.aiProviders?.google?.model || null;
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
		
		// Get the selected model from platform settings (same as AI provider manager)
		const platform = Platform.isMobile ? 'mobile' : 'desktop';
		const selectedModelId = settings.platformSettings[platform].selectedModel;
		
		if (!selectedModelId || selectedModelId === 'none') {
			return 'No model configured';
		}
		
		// Find the model in the appropriate provider's model list
		switch (providerType) {
			case 'claude': {
				const claudeModels = getAvailableModels('claude', settings);
				const claudeModel = claudeModels.find(m => m.value === selectedModelId);
				return claudeModel?.label || selectedModelId;
			}
			case 'openai': {
				const openaiModels = getAvailableModels('openai', settings);
				const openaiModel = openaiModels.find(m => m.value === selectedModelId);
				return openaiModel?.label || selectedModelId;
			}
			case 'google': {
				const googleModels = getAvailableModels('google', settings);
				const googleModel = googleModels.find(m => m.value === selectedModelId);
				return googleModel?.label || selectedModelId;
			}
			case 'ollama': {
				// Ollama uses different logic
				const ollamaModel = settings.aiProviders?.ollama?.model;
				return ollamaModel || 'Not configured';
			}
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
			this.updateProviderStatus().catch(error => {
				Logger.error('Failed to update provider status:', error);
			});

		} catch (_error) {
			// Error switching provider - handled by UI feedback
		}
	}

	async refreshDisplay(): Promise<void> {
		await this.updateProviderOptions();
		await this.updateProviderStatus();
	}

	cleanup(): void {
		// Cleanup handled by Obsidian's component lifecycle
		this.dropdown = null;
		this.statusContainer = null;
		this.statusDot = null;
	}
}