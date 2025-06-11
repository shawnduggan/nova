import { App, PluginSettingTab, Setting, Platform } from 'obsidian';
import NovaPlugin from '../main';
import { AIProviderSettings, PlatformSettings, ProviderType } from './ai/types';
import { DebugSettings } from './licensing/types';

export interface CustomCommand {
	id: string;
	name: string;
	trigger: string;
	template: string;
	description?: string;
}

export interface NovaSettings {
	aiProviders: AIProviderSettings;
	platformSettings: PlatformSettings;
	customCommands?: CustomCommand[];
	general: {
		defaultTemperature: number;
		defaultMaxTokens: number;
		autoSave: boolean;
	};
	licensing: {
		licenseKey: string;
		catalystLicenseKey?: string;
		isCatalyst?: boolean;
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
	customCommands: [],
	general: {
		defaultTemperature: 0.7,
		defaultMaxTokens: 1000,
		autoSave: true
	},
	licensing: {
		licenseKey: '',
		catalystLicenseKey: '',
		isCatalyst: false,
		debugSettings: {
			enabled: false,
			overrideDate: undefined,
			forceCatalyst: false
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
		licenseContainer.createEl('h3', { text: 'Catalyst Supporter Status' });

		// Info about the new model
		const infoEl = licenseContainer.createDiv({ cls: 'nova-model-info' });
		infoEl.innerHTML = `
			<div class="nova-info-card">
				<h4>🚀 All Features Available</h4>
				<p>Nova provides all features for free when you use your own AI provider API keys. 
				Catalyst supporters get early access to new features before they're released to everyone.</p>
			</div>
		`;

		// Current Catalyst status
		const isCatalyst = this.plugin.featureManager?.getIsCatalystSupporter() || false;
		const catalystLicense = this.plugin.featureManager?.getCatalystLicense();
		
		const statusDisplay = licenseContainer.createDiv({ cls: 'nova-catalyst-status' });
		const statusText = isCatalyst ? 'Catalyst Supporter ⚡' : 'Nova User';
		const statusIcon = isCatalyst ? '⚡' : '🌟';
		statusDisplay.innerHTML = `
			<div class="nova-status-badge ${isCatalyst ? 'catalyst' : 'nova'}">
				<span class="status-icon">${statusIcon}</span>
				<span class="status-name">${statusText}</span>
			</div>
		`;

		// Catalyst license status
		if (catalystLicense) {
			const statusEl = licenseContainer.createDiv({ cls: 'nova-license-status' });
			const expiryText = catalystLicense.expiresAt 
				? `Expires: ${catalystLicense.expiresAt.toLocaleDateString()}`
				: 'Lifetime Support';
			statusEl.innerHTML = `
				<div class="license-info">
					<span class="license-email">${catalystLicense.email}</span>
					<span class="license-expiry">${expiryText}</span>
				</div>
			`;
		}

		// Catalyst license key input
		new Setting(licenseContainer)
			.setName('Catalyst License Key (Optional)')
			.setDesc('Enter your Catalyst supporter license key for early access to new features')
			.addText(text => {
				text.inputEl.type = 'password';
				text.setPlaceholder('Enter Catalyst license key...')
					.setValue(this.plugin.settings.licensing.catalystLicenseKey || '')
					.onChange(async (value) => {
						this.plugin.settings.licensing.catalystLicenseKey = value;
						await this.plugin.saveSettings();
						
						// Update Catalyst license in feature manager
						if (this.plugin.featureManager) {
							await this.plugin.featureManager.updateCatalystLicense(value || null);
							// Refresh the display to show updated status
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
							this.showLicenseMessage('Please enter a Catalyst license key first.', 'error');
							return;
						}

						validateButton.textContent = 'Validating...';
						validateButton.disabled = true;

						try {
							if (this.plugin.featureManager) {
								await this.plugin.featureManager.updateCatalystLicense(licenseKey);
								const isCatalyst = this.plugin.featureManager.getIsCatalystSupporter();
								
								if (isCatalyst) {
									this.showLicenseMessage('✅ Valid Catalyst license! You now have early access to new features.', 'success');
								} else {
									this.showLicenseMessage('❌ Invalid or expired Catalyst license key.', 'error');
								}
								
								// Refresh display
								this.display();
							}
						} catch (error) {
							this.showLicenseMessage('❌ Error validating Catalyst license.', 'error');
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
		comparisonContainer.createEl('h4', { text: 'Nova Features' });

		// Feature summary
		const summaryEl = comparisonContainer.createDiv({ cls: 'nova-feature-summary' });
		summaryEl.innerHTML = `
			<div class="nova-available-now">
				<h5>✅ Available Now (Free with Your API Keys)</h5>
				<ul>
					<li>🤖 All AI Providers (Claude, OpenAI, Gemini, Ollama)</li>
					<li>📝 Complete Document Editing Suite</li>
					<li>💬 Chat Interface with Conversation History</li>
					<li>🔄 Provider Switching</li>
					<li>📱 Full Mobile Support</li>
					<li>🎯 File-Scoped Conversations</li>
				</ul>
			</div>
		`;

		// Get upcoming features for Catalyst supporters
		const featureSummary = this.plugin.featureManager?.getFeatureSummary();
		if (featureSummary && featureSummary.comingSoon.length > 0) {
			const upcomingEl = comparisonContainer.createDiv({ cls: 'nova-upcoming-features' });
			upcomingEl.innerHTML = `
				<div class="nova-catalyst-preview">
					<h5>⚡ Coming Soon for Catalyst Supporters</h5>
					<ul>
						${featureSummary.comingSoon.map(feature => `
							<li>Available ${feature.availableDate} ${feature.isCatalyst ? '(You have early access!)' : ''}</li>
						`).join('')}
					</ul>
				</div>
			`;
		}

		// Catalyst supporter information
		const catalystInfo = comparisonContainer.createDiv({ cls: 'nova-catalyst-info' });
		catalystInfo.innerHTML = `
			<div class="nova-info-card">
				<h5>🚀 Become a Catalyst Supporter</h5>
				<p>Support Nova development and get early access to new features. All features eventually become free for everyone.</p>
				<ul>
					<li>⚡ Early access to new features (3-6 months before general release)</li>
					<li>🎯 Priority support and feature requests</li>
					<li>📱 Supporter badge and recognition</li>
					<li>💖 Directly support open-source development</li>
				</ul>
			</div>
		`;
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
				.setName('Override Date')
				.setDesc('Override current date for testing time-gated features (YYYY-MM-DD)')
				.addText(text => text
					.setPlaceholder('2025-12-01')
					.setValue(this.plugin.settings.licensing.debugSettings.overrideDate || '')
					.onChange(async (value) => {
						this.plugin.settings.licensing.debugSettings.overrideDate = value || undefined;
						await this.plugin.saveSettings();
						
						if (this.plugin.featureManager) {
							this.plugin.featureManager.updateDebugSettings(this.plugin.settings.licensing.debugSettings);
						}
						
						// Refresh display
						this.display();
					}));

			new Setting(debugContainer)
				.setName('Force Catalyst Status')
				.setDesc('Override Catalyst supporter status for testing')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.licensing.debugSettings.forceCatalyst || false)
					.onChange(async (value) => {
						this.plugin.settings.licensing.debugSettings.forceCatalyst = value;
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

		// Info about API keys
		const infoEl = containerEl.createDiv({ cls: 'nova-provider-info' });
		infoEl.innerHTML = `
			<div class="nova-info-card">
				<h4>🔑 Configure Your API Keys</h4>
				<p>Nova connects to AI providers using your own API keys. All providers are available to all users - 
				just add your API keys below to get started.</p>
			</div>
		`;

		// Show all providers - no restrictions
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

	private isProviderAllowedForCoreTier(providerType: ProviderType): boolean {
		if (!this.plugin.aiProviderManager) return true;
		return this.plugin.aiProviderManager.isProviderAllowed(providerType);
	}

	private createRestrictedProviderNotice(container: HTMLElement, providerName: string) {
		const restrictedContainer = container.createDiv({ cls: 'nova-provider-section nova-provider-restricted' });
		restrictedContainer.innerHTML = `
			<h4>${providerName} <span class="restriction-badge">SuperNova Only</span></h4>
			<p class="restriction-text">This provider requires a SuperNova license.</p>
		`;
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
		
		// Info about platform settings
		const infoEl = platformContainer.createDiv({ cls: 'nova-platform-info' });
		infoEl.innerHTML = `
			<div class="nova-info-card">
				<h4>🖥️ Platform Configuration</h4>
				<p>Configure which AI provider to use as your primary provider on different platforms. 
				Nova works seamlessly across desktop and mobile with all providers.</p>
			</div>
		`;
		
		platformContainer.createEl('h4', { text: 'Desktop' });
		const desktopDropdown = new Setting(platformContainer)
			.setName('Primary Provider')
			.setDesc('Primary AI provider for desktop')
			.addDropdown(dropdown => {
				const allowedProviders = this.getAllowedProvidersForPlatform('desktop');
				
				allowedProviders.forEach(provider => {
					const label = this.getProviderDisplayName(provider);
					dropdown.addOption(provider, label);
				});
				
				return dropdown
					.setValue(this.plugin.settings.platformSettings.desktop.primaryProvider)
					.onChange(async (value: string) => {
						this.plugin.settings.platformSettings.desktop.primaryProvider = value as ProviderType;
						await this.plugin.saveSettings();
						if (this.plugin.aiProviderManager) {
							this.plugin.aiProviderManager.updateSettings(this.plugin.settings);
						}
					});
			});

		platformContainer.createEl('h4', { text: 'Mobile' });
		const mobileSetting = new Setting(platformContainer)
			.setName('Primary Provider')
			.setDesc('Primary AI provider for mobile devices');
			
		mobileSetting.addDropdown(dropdown => dropdown
			.addOption('none', 'None (Disabled)')
			.addOption('claude', 'Claude')
			.addOption('openai', 'OpenAI')
			.addOption('google', 'Google')
			.setValue(this.plugin.settings.platformSettings.mobile.primaryProvider)
			.onChange(async (value: string) => {
				this.plugin.settings.platformSettings.mobile.primaryProvider = value as ProviderType;
				await this.plugin.saveSettings();
				if (this.plugin.aiProviderManager) {
					this.plugin.aiProviderManager.updateSettings(this.plugin.settings);
				}
			}));
	}

	private getAllowedProvidersForPlatform(platform: 'desktop' | 'mobile'): ProviderType[] {
		// All providers are available to all users in the Catalyst model
		return platform === 'desktop' 
			? ['claude', 'openai', 'google', 'ollama']
			: ['claude', 'openai', 'google'];
	}

	private getProviderDisplayName(provider: ProviderType): string {
		const names: Record<ProviderType, string> = {
			'claude': 'Claude (Anthropic)',
			'openai': 'OpenAI',
			'google': 'Google (Gemini)', 
			'ollama': 'Ollama (Local)',
			'none': 'None (Disabled)'
		};
		return names[provider] || provider;
	}

	async setCurrentProvider(providerId: string): Promise<void> {
		const platform = Platform.isMobile ? 'mobile' : 'desktop';
		this.plugin.settings.platformSettings[platform].primaryProvider = providerId as ProviderType;
		
		// Update the provider manager with new settings
		if (this.plugin.aiProviderManager) {
			this.plugin.aiProviderManager.updateSettings(this.plugin.settings);
		}
	}
}