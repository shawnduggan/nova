import { App, PluginSettingTab, Setting } from 'obsidian';
import NovaPlugin from '../main';
import { AIProviderSettings, PlatformSettings, ProviderType } from './ai/types';
import { DebugSettings } from './licensing/types';

export interface NovaSettings {
	aiProviders: AIProviderSettings;
	platformSettings: PlatformSettings;
	general: {
		defaultTemperature: number;
		defaultMaxTokens: number;
		autoSave: boolean;
	};
	licensing: {
		licenseKey: string;
		debugSettings: DebugSettings;
	};
}

export const DEFAULT_SETTINGS: NovaSettings = {
	aiProviders: {
		claude: {
			apiKey: '',
			model: 'claude-sonnet-4',
			temperature: 0.7,
			maxTokens: 1000
		},
		openai: {
			apiKey: '',
			baseUrl: 'https://api.openai.com/v1',
			model: 'gpt-4o',
			temperature: 0.7,
			maxTokens: 1000
		},
		google: {
			apiKey: '',
			model: 'gemini-2.5-flash-preview-05-20',
			temperature: 0.7,
			maxTokens: 1000
		},
		ollama: {
			baseUrl: 'http://localhost:11434',
			model: '',
			temperature: 0.7,
			maxTokens: 1000
		}
	},
	platformSettings: {
		desktop: {
			primaryProvider: 'ollama',
			fallbackProviders: ['openai', 'google', 'ollama']
		},
		mobile: {
			primaryProvider: 'none',
			fallbackProviders: ['openai', 'google']
		}
	},
	general: {
		defaultTemperature: 0.7,
		defaultMaxTokens: 1000,
		autoSave: true
	},
	licensing: {
		licenseKey: '',
		debugSettings: {
			enabled: false
		}
	}
};

export class NovaSettingTab extends PluginSettingTab {
	plugin: NovaPlugin;

	constructor(app: App, plugin: NovaPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl('h2', { text: 'Nova AI Settings' });

		this.createLicenseSettings();
		this.createGeneralSettings();
		this.createPlatformSettings();
		this.createProviderSettings();
	}

	private createLicenseSettings() {
		const { containerEl } = this;
		const licenseContainer = containerEl.createDiv({ cls: 'nova-license-section' });
		licenseContainer.createEl('h3', { text: 'License & Tier' });

		// Current tier display
		const currentTier = this.plugin.featureManager?.getCurrentTier() || 'core';
		const currentLicense = this.plugin.featureManager?.getCurrentLicense();
		
		const tierDisplay = licenseContainer.createDiv({ cls: 'nova-tier-display' });
		const tierText = currentTier === 'supernova' ? 'SuperNova' : 'Core (Free)';
		const tierIcon = currentTier === 'supernova' ? '⭐' : '🆓';
		tierDisplay.innerHTML = `
			<div class="nova-tier-badge ${currentTier}">
				<span class="tier-icon">${tierIcon}</span>
				<span class="tier-name">${tierText}</span>
			</div>
		`;

		// License status
		if (currentLicense) {
			const statusEl = licenseContainer.createDiv({ cls: 'nova-license-status' });
			const expiryText = currentLicense.expiresAt 
				? `Expires: ${currentLicense.expiresAt.toLocaleDateString()}`
				: 'Lifetime License';
			statusEl.innerHTML = `
				<div class="license-info">
					<span class="license-email">${currentLicense.email}</span>
					<span class="license-expiry">${expiryText}</span>
				</div>
			`;
		}

		// License key input
		new Setting(licenseContainer)
			.setName('License Key')
			.setDesc('Enter your Nova SuperNova license key to unlock premium features')
			.addText(text => {
				text.inputEl.type = 'password';
				text.setPlaceholder('Enter license key...')
					.setValue(this.plugin.settings.licensing.licenseKey)
					.onChange(async (value) => {
						this.plugin.settings.licensing.licenseKey = value;
						await this.plugin.saveSettings();
						
						// Update license in feature manager
						if (this.plugin.featureManager) {
							await this.plugin.featureManager.updateLicense(value || null);
							// Refresh the display to show updated tier
							this.display();
						}
					});

				// Add validation button
				const validateButton = text.inputEl.parentElement?.createEl('button', {
					text: 'Validate',
					cls: 'nova-validate-btn'
				});
				
				if (validateButton) {
					validateButton.addEventListener('click', async () => {
						const licenseKey = text.inputEl.value;
						if (!licenseKey) {
							this.showLicenseMessage('Please enter a license key first.', 'error');
							return;
						}

						validateButton.textContent = 'Validating...';
						validateButton.disabled = true;

						try {
							if (this.plugin.featureManager) {
								await this.plugin.featureManager.updateLicense(licenseKey);
								const tier = this.plugin.featureManager.getCurrentTier();
								
								if (tier === 'supernova') {
									this.showLicenseMessage('✅ Valid SuperNova license!', 'success');
								} else {
									this.showLicenseMessage('❌ Invalid or expired license key.', 'error');
								}
								
								// Refresh display
								this.display();
							}
						} catch (error) {
							this.showLicenseMessage('❌ Error validating license.', 'error');
						} finally {
							validateButton.textContent = 'Validate';
							validateButton.disabled = false;
						}
					});
				}
			});

		// Features comparison
		this.createFeatureComparison(licenseContainer);

		// Debug settings (development only)
		if (process.env.NODE_ENV === 'development' || this.plugin.settings.licensing.debugSettings.enabled) {
			this.createDebugSettings(licenseContainer);
		}
	}

	private createFeatureComparison(container: HTMLElement) {
		const comparisonContainer = container.createDiv({ cls: 'nova-feature-comparison' });
		comparisonContainer.createEl('h4', { text: 'Feature Comparison' });

		const table = comparisonContainer.createEl('table', { cls: 'nova-comparison-table' });
		
		// Header
		const headerRow = table.createEl('tr');
		headerRow.createEl('th', { text: 'Feature' });
		headerRow.createEl('th', { text: 'Core (Free)' });
		headerRow.createEl('th', { text: 'SuperNova' });

		// Feature rows
		const features = [
			['Basic Document Editing', '✅', '✅'],
			['Local AI (Ollama, LM Studio)', '✅', '✅'],
			['One Cloud AI Provider', '✅', '✅'],
			['Multiple Cloud AI Providers', '❌', '✅'],
			['Provider Switching in Chat', '❌', '✅'],
			['Mobile Device Support', '❌', '✅'],
			['Advanced Templates', '❌', '✅'],
			['Priority Support', '❌', '✅']
		];

		features.forEach(([feature, core, supernova]) => {
			const row = table.createEl('tr');
			row.createEl('td', { text: feature });
			row.createEl('td', { text: core, cls: core === '✅' ? 'feature-yes' : 'feature-no' });
			row.createEl('td', { text: supernova, cls: supernova === '✅' ? 'feature-yes' : 'feature-no' });
		});

		// Upgrade link
		const upgradeContainer = comparisonContainer.createDiv({ cls: 'nova-upgrade-container' });
		const upgradeButton = upgradeContainer.createEl('button', {
			text: '⭐ Upgrade to SuperNova',
			cls: 'nova-upgrade-btn'
		});
		
		upgradeButton.addEventListener('click', () => {
			window.open('https://novawriter.ai/upgrade', '_blank');
		});
	}

	private createDebugSettings(container: HTMLElement) {
		const debugContainer = container.createDiv({ cls: 'nova-debug-section' });
		debugContainer.createEl('h4', { text: 'Development Settings' });

		new Setting(debugContainer)
			.setName('Debug Mode')
			.setDesc('Enable development testing features')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.licensing.debugSettings.enabled)
				.onChange(async (value) => {
					this.plugin.settings.licensing.debugSettings.enabled = value;
					await this.plugin.saveSettings();
					
					if (this.plugin.featureManager) {
						this.plugin.featureManager.updateDebugSettings(this.plugin.settings.licensing.debugSettings);
					}
					
					// Refresh display to show/hide debug options
					this.display();
				}));

		if (this.plugin.settings.licensing.debugSettings.enabled) {
			new Setting(debugContainer)
				.setName('Override Tier')
				.setDesc('Override license tier for testing')
				.addDropdown(dropdown => dropdown
					.addOption('', 'Use Real License')
					.addOption('core', 'Force Core Tier')
					.addOption('supernova', 'Force SuperNova Tier')
					.setValue(this.plugin.settings.licensing.debugSettings.overrideTier || '')
					.onChange(async (value) => {
						this.plugin.settings.licensing.debugSettings.overrideTier = value || undefined;
						await this.plugin.saveSettings();
						
						if (this.plugin.featureManager) {
							this.plugin.featureManager.updateDebugSettings(this.plugin.settings.licensing.debugSettings);
						}
						
						// Refresh display
						this.display();
					}));
		}
	}

	private showLicenseMessage(message: string, type: 'success' | 'error') {
		// Create or update message element
		const existingMessage = this.containerEl.querySelector('.nova-license-message');
		if (existingMessage) {
			existingMessage.remove();
		}

		const messageEl = this.containerEl.createDiv({ 
			cls: `nova-license-message ${type}`,
			text: message
		});

		// Auto-remove after 5 seconds
		setTimeout(() => {
			messageEl.remove();
		}, 5000);
	}

	private createGeneralSettings() {
		const { containerEl } = this;
		containerEl.createEl('h3', { text: 'General Settings' });

		new Setting(containerEl)
			.setName('Default Temperature')
			.setDesc('Controls randomness in AI responses (0.0 - 1.0)')
			.addSlider(slider => slider
				.setLimits(0, 1, 0.1)
				.setValue(this.plugin.settings.general.defaultTemperature)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.general.defaultTemperature = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Default Max Tokens')
			.setDesc('Maximum length of AI responses')
			.addText(text => text
				.setPlaceholder('1000')
				.setValue(this.plugin.settings.general.defaultMaxTokens.toString())
				.onChange(async (value) => {
					const numValue = parseInt(value);
					if (!isNaN(numValue) && numValue > 0) {
						this.plugin.settings.general.defaultMaxTokens = numValue;
						await this.plugin.saveSettings();
					}
				}));

		new Setting(containerEl)
			.setName('Auto-save settings')
			.setDesc('Automatically save settings when changed')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.general.autoSave)
				.onChange(async (value) => {
					this.plugin.settings.general.autoSave = value;
					await this.plugin.saveSettings();
				}));
	}

	private createProviderSettings() {
		const { containerEl } = this;
		containerEl.createEl('h3', { text: 'AI Provider Settings' });

		this.createOllamaSettings();
		this.createClaudeSettings();
		this.createGoogleSettings();
		this.createOpenAISettings();
	}

	private createClaudeSettings() {
		const { containerEl } = this;
		const claudeContainer = containerEl.createDiv({ cls: 'nova-provider-section' });
		claudeContainer.createEl('h4', { text: 'Claude (Anthropic)' });

		new Setting(claudeContainer)
			.setName('API Key')
			.setDesc('Your Anthropic API key')
			.addText(text => text
				.setPlaceholder('sk-ant-...')
				.setValue(this.plugin.settings.aiProviders.claude.apiKey || '')
				.onChange(async (value) => {
					this.plugin.settings.aiProviders.claude.apiKey = value;
					await this.plugin.saveSettings();
				}));

		new Setting(claudeContainer)
			.setName('Model')
			.setDesc('Claude model to use')
			.addDropdown(dropdown => dropdown
				.addOption('claude-sonnet-4', 'Claude Sonnet 4')
				.addOption('claude-opus-4', 'Claude Opus 4')
				.addOption('claude-3-haiku-20240307', 'Claude 3 Haiku')
				.addOption('claude-3-sonnet-20240229', 'Claude 3 Sonnet')
				.addOption('claude-3-opus-20240229', 'Claude 3 Opus')
				.setValue(this.plugin.settings.aiProviders.claude.model || 'claude-sonnet-4')
				.onChange(async (value) => {
					this.plugin.settings.aiProviders.claude.model = value;
					await this.plugin.saveSettings();
				}));
	}

	private createOpenAISettings() {
		const { containerEl } = this;
		const openaiContainer = containerEl.createDiv({ cls: 'nova-provider-section' });
		openaiContainer.createEl('h4', { text: 'OpenAI' });

		new Setting(openaiContainer)
			.setName('API Key')
			.setDesc('Your OpenAI API key')
			.addText(text => text
				.setPlaceholder('sk-...')
				.setValue(this.plugin.settings.aiProviders.openai.apiKey || '')
				.onChange(async (value) => {
					this.plugin.settings.aiProviders.openai.apiKey = value;
					await this.plugin.saveSettings();
				}));

		new Setting(openaiContainer)
			.setName('Base URL')
			.setDesc('OpenAI API base URL (for custom endpoints)')
			.addText(text => text
				.setPlaceholder('https://api.openai.com/v1')
				.setValue(this.plugin.settings.aiProviders.openai.baseUrl || '')
				.onChange(async (value) => {
					this.plugin.settings.aiProviders.openai.baseUrl = value;
					await this.plugin.saveSettings();
				}));

		new Setting(openaiContainer)
			.setName('Model')
			.setDesc('OpenAI model to use')
			.addDropdown(dropdown => dropdown
				.addOption('gpt-4o', 'GPT-4o')
				.addOption('gpt-3.5-turbo', 'GPT-3.5 Turbo')
				.addOption('gpt-4', 'GPT-4')
				.addOption('gpt-4-turbo-preview', 'GPT-4 Turbo')
				.setValue(this.plugin.settings.aiProviders.openai.model || 'gpt-4o')
				.onChange(async (value) => {
					this.plugin.settings.aiProviders.openai.model = value;
					await this.plugin.saveSettings();
				}));
	}

	private createGoogleSettings() {
		const { containerEl } = this;
		const googleContainer = containerEl.createDiv({ cls: 'nova-provider-section' });
		googleContainer.createEl('h4', { text: 'Google (Gemini)' });

		new Setting(googleContainer)
			.setName('API Key')
			.setDesc('Your Google AI API key')
			.addText(text => text
				.setPlaceholder('AI...')
				.setValue(this.plugin.settings.aiProviders.google.apiKey || '')
				.onChange(async (value) => {
					this.plugin.settings.aiProviders.google.apiKey = value;
					await this.plugin.saveSettings();
				}));

		new Setting(googleContainer)
			.setName('Model')
			.setDesc('Gemini model to use')
			.addDropdown(dropdown => dropdown
				.addOption('gemini-2.5-flash-preview-05-20', 'Gemini 2.5 Flash Preview')
				.addOption('gemini-2.5-pro-preview-06-05', 'Gemini 2.5 Pro Preview')
				.addOption('gemini-1.5-flash', 'Gemini 1.5 Flash')
				.addOption('gemini-1.5-pro', 'Gemini 1.5 Pro')
				.setValue(this.plugin.settings.aiProviders.google.model || 'gemini-2.5-flash-preview-05-20')
				.onChange(async (value) => {
					this.plugin.settings.aiProviders.google.model = value;
					await this.plugin.saveSettings();
				}));
	}

	private createOllamaSettings() {
		const { containerEl } = this;
		const ollamaContainer = containerEl.createDiv({ cls: 'nova-provider-section' });
		ollamaContainer.createEl('h4', { text: 'Ollama (Local)' });

		new Setting(ollamaContainer)
			.setName('Base URL')
			.setDesc('Ollama server URL')
			.addText(text => text
				.setPlaceholder('http://localhost:11434')
				.setValue(this.plugin.settings.aiProviders.ollama.baseUrl || '')
				.onChange(async (value) => {
					this.plugin.settings.aiProviders.ollama.baseUrl = value;
					await this.plugin.saveSettings();
				}));

		new Setting(ollamaContainer)
			.setName('Model')
			.setDesc('Ollama model to use')
			.addText(text => text
				.setPlaceholder('llama2')
				.setValue(this.plugin.settings.aiProviders.ollama.model || '')
				.onChange(async (value) => {
					this.plugin.settings.aiProviders.ollama.model = value;
					await this.plugin.saveSettings();
				}));
	}

	private createPlatformSettings() {
		const { containerEl } = this;
		containerEl.createEl('h3', { text: 'Platform Settings' });

		const platformContainer = containerEl.createDiv({ cls: 'nova-platform-section' });
		
		platformContainer.createEl('h4', { text: 'Desktop' });
		new Setting(platformContainer)
			.setName('Primary Provider')
			.setDesc('Primary AI provider for desktop')
			.addDropdown(dropdown => dropdown
				.addOption('claude', 'Claude')
				.addOption('openai', 'OpenAI')
				.addOption('google', 'Google')
				.addOption('ollama', 'Ollama')
				.setValue(this.plugin.settings.platformSettings.desktop.primaryProvider)
				.onChange(async (value: string) => {
					this.plugin.settings.platformSettings.desktop.primaryProvider = value as ProviderType;
					await this.plugin.saveSettings();
				}));

		platformContainer.createEl('h4', { text: 'Mobile' });
		new Setting(platformContainer)
			.setName('Primary Provider')
			.setDesc('Primary AI provider for mobile')
			.addDropdown(dropdown => dropdown
				.addOption('none', 'None (Disabled)')
				.addOption('claude', 'Claude')
				.addOption('openai', 'OpenAI')
				.addOption('google', 'Google')
				.setValue(this.plugin.settings.platformSettings.mobile.primaryProvider)
				.onChange(async (value: string) => {
					this.plugin.settings.platformSettings.mobile.primaryProvider = value as ProviderType;
					await this.plugin.saveSettings();
				}));
	}
}