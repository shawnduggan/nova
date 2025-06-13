import { App, PluginSettingTab, Setting, Platform } from 'obsidian';
import NovaPlugin from '../main';
import { AIProviderSettings, PlatformSettings, ProviderType } from './ai/types';
import { DebugSettings } from './licensing/types';
import { VIEW_TYPE_NOVA_SIDEBAR, NovaSidebarView } from './ui/sidebar-view';

const NOVA_ICON_SVG = `
<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- Central star core -->
  <circle cx="12" cy="12" r="2.5" fill="currentColor"/>
  
  <!-- Primary rays (4 main directions) -->
  <path d="M12 1L12 6" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
  <path d="M12 18L12 23" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
  <path d="M23 12L18 12" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
  <path d="M6 12L1 12" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
  
  <!-- Secondary rays (diagonals) -->
  <path d="M18.364 5.636L15.536 8.464" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M8.464 15.536L5.636 18.364" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M18.364 18.364L15.536 15.536" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M8.464 8.464L5.636 5.636" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
</svg>`;

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
	showCommandButton: boolean;
	licensing: {
		licenseKey: string;
		supernovaLicenseKey?: string;
		isSupernova?: boolean;
		debugSettings: DebugSettings;
	};
}

export const DEFAULT_SETTINGS: NovaSettings = {
	aiProviders: {
		claude: {
			apiKey: '',
			model: 'claude-3-5-sonnet-20241022',
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
			model: 'gemini-1.5-flash',
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
	showCommandButton: true,
	licensing: {
		licenseKey: '',
		supernovaLicenseKey: '',
		isSupernova: false,
		debugSettings: {
			enabled: false,
			overrideDate: undefined,
			forceSupernova: false
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
		this.createCommandSettings();
	}

	private createLicenseSettings() {
		const { containerEl } = this;
		const licenseContainer = containerEl.createDiv({ cls: 'nova-license-section' });
		licenseContainer.createEl('h3', { text: 'Supernova Supporter Status' });

		// Info about the new model
		const infoEl = licenseContainer.createDiv({ cls: 'nova-model-info' });
		infoEl.innerHTML = `
			<div class="nova-info-card compact">
				<p>Nova provides all features for free when you use your own AI provider API keys. 
				Supernova supporters get early access to new features.</p>
			</div>
		`;

		// Current Supernova status
		const isSupernova = this.plugin.featureManager?.isSupernovaSupporter() || false;
		const supernovaLicense = this.plugin.featureManager?.getSupernovaLicense();
		
		const statusDisplay = licenseContainer.createDiv({ cls: 'nova-supernova-status' });
		const statusText = isSupernova ? 'Supernova Supporter' : 'Nova User';
		const statusIcon = isSupernova ? `<svg viewBox="0 0 24 24" style="width: 14px; height: 14px; color: #9333ea; filter: drop-shadow(0 0 4px rgba(147, 51, 234, 0.6));">
			<circle cx="12" cy="12" r="2.5" fill="currentColor"/>
			<path d="M12 1L12 6" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
			<path d="M12 18L12 23" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
			<path d="M23 12L18 12" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
			<path d="M6 12L1 12" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
			<path d="M18.364 5.636L15.536 8.464" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
			<path d="M8.464 15.536L5.636 18.364" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
			<path d="M18.364 18.364L15.536 15.536" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
			<path d="M8.464 8.464L5.636 5.636" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
		</svg>` : `<svg viewBox="0 0 24 24" style="width: 14px; height: 14px; color: var(--text-normal);">
			${NOVA_ICON_SVG}
		</svg>`;
		statusDisplay.innerHTML = `
			<div class="nova-status-badge ${isSupernova ? 'supernova' : 'nova'}">
				<span class="status-icon">${statusIcon}</span>
				<span class="status-name">${statusText}</span>
			</div>
		`;

		// Supernova license status
		if (supernovaLicense) {
			const statusEl = licenseContainer.createDiv({ cls: 'nova-license-status' });
			const expiryText = supernovaLicense.expiresAt 
				? `Expires: ${supernovaLicense.expiresAt.toLocaleDateString()}`
				: 'Lifetime Support';
			statusEl.innerHTML = `
				<div class="license-info">
					<span class="license-email">${supernovaLicense.email}</span>
					<span class="license-expiry">${expiryText}</span>
				</div>
			`;
		}

		// Supernova license key input
		new Setting(licenseContainer)
			.setName('Supernova License Key (Optional)')
			.setDesc('Enter your Supernova supporter license key for early access to new features')
			.addText(text => {
				text.inputEl.type = 'password';
				text.setPlaceholder('Enter Supernova license key...')
					.setValue(this.plugin.settings.licensing.supernovaLicenseKey || '')
					.onChange(async (value) => {
						this.plugin.settings.licensing.supernovaLicenseKey = value;
						await this.plugin.saveSettings();
						
						// Update Supernova license in feature manager
						if (this.plugin.featureManager) {
							await this.plugin.featureManager.updateSupernovaLicense(value || null);
							
							// Refresh sidebar to update feature availability
							const leaves = this.plugin.app.workspace.getLeavesOfType(VIEW_TYPE_NOVA_SIDEBAR);
							if (leaves.length > 0) {
								const sidebarView = leaves[0].view as NovaSidebarView;
								sidebarView.refreshSupernovaUI();
							}
							
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
							this.showLicenseMessage('Please enter a Supernova license key first.', 'error');
							return;
						}

						validateButton.textContent = 'Validating...';
						validateButton.disabled = true;

						try {
							if (this.plugin.featureManager) {
								await this.plugin.featureManager.updateSupernovaLicense(licenseKey);
								const isSupernova = this.plugin.featureManager.isSupernovaSupporter();
								
								if (isSupernova) {
									this.showLicenseMessage('Valid Supernova license! You now have early access to new features.', 'success');
									this.showConfetti();
								} else {
									this.showLicenseMessage('Invalid or expired Supernova license key.', 'error');
								}
								
								// Refresh sidebar to update feature availability
								const leaves = this.plugin.app.workspace.getLeavesOfType(VIEW_TYPE_NOVA_SIDEBAR);
								if (leaves.length > 0) {
									const sidebarView = leaves[0].view as NovaSidebarView;
									sidebarView.refreshSupernovaUI();
								}
								
								// Refresh display
								this.display();
							}
						} catch (error) {
							this.showLicenseMessage('Error validating Supernova license.', 'error');
						} finally {
							validateButton.textContent = 'Validate';
							validateButton.disabled = false;
						}
					});
				}
			});

		// Supernova supporter information only
		this.createSupernovaInfo(licenseContainer);

		// Debug settings (development only)
		if (process.env.NODE_ENV === 'development' || this.plugin.settings.licensing.debugSettings.enabled) {
			this.createDebugSettings(licenseContainer);
		}
	}

	private createSupernovaInfo(container: HTMLElement) {
		// Supernova supporter information
		const supernovaInfo = container.createDiv({ cls: 'nova-supernova-info' });
		supernovaInfo.innerHTML = `
			<div class="nova-info-card">
				<h5>Become a Supernova Supporter</h5>
				<p>Support Nova development and get early access to new features. All features eventually become free for everyone.</p>
				<ul>
					<li>Early access to new features (3-6 months before general release)</li>
					<li>Priority support and feature requests</li>
					<li>Supporter badge and recognition</li>
					<li>Directly support open-source development</li>
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
						
						// Don't refresh display on every keystroke - just update the feature manager
					}));

			new Setting(debugContainer)
				.setName('Force Supernova Status')
				.setDesc('Override Supernova supporter status for testing')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.licensing.debugSettings.forceSupernova || false)
					.onChange(async (value) => {
						this.plugin.settings.licensing.debugSettings.forceSupernova = value;
						await this.plugin.saveSettings();
						
						if (this.plugin.featureManager) {
							this.plugin.featureManager.updateDebugSettings(this.plugin.settings.licensing.debugSettings);
						}
						
						// Show confetti when turning ON Force Supernova
						if (value) {
							this.showConfetti();
						}
						
						// Refresh sidebar to update feature availability
						const leaves = this.plugin.app.workspace.getLeavesOfType(VIEW_TYPE_NOVA_SIDEBAR);
						if (leaves.length > 0) {
							const sidebarView = leaves[0].view as NovaSidebarView;
							sidebarView.refreshSupernovaUI();
						}
						
						// Refresh display to show updated feature status
						this.display();
					}));

			// Clear licenses button
			new Setting(debugContainer)
				.setName('Clear All Licenses')
				.setDesc('Remove all applied licenses (for testing)')
				.addButton(button => button
					.setButtonText('Clear Licenses')
					.setWarning()
					.onClick(async () => {
						// Confirm action
						const confirmed = confirm('Are you sure you want to clear all licenses? This will remove any applied Supernova license.');
						if (!confirmed) return;

						// Clear license key
						this.plugin.settings.licensing.supernovaLicenseKey = '';
						
						// Clear Force Supernova if enabled
						if (this.plugin.settings.licensing.debugSettings.forceSupernova) {
							this.plugin.settings.licensing.debugSettings.forceSupernova = false;
						}
						
						await this.plugin.saveSettings();

						// Update feature manager
						if (this.plugin.featureManager) {
							await this.plugin.featureManager.updateSupernovaLicense(null);
							this.plugin.featureManager.updateDebugSettings(this.plugin.settings.licensing.debugSettings);
						}

						// Refresh sidebar
						const leaves = this.plugin.app.workspace.getLeavesOfType(VIEW_TYPE_NOVA_SIDEBAR);
						if (leaves.length > 0) {
							const sidebarView = leaves[0].view as NovaSidebarView;
							sidebarView.refreshSupernovaUI();
						}

						// Show success message
						this.showLicenseMessage('All licenses cleared successfully.', 'success');

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

	private showConfetti() {
		// Create confetti container
		const confettiContainer = document.createElement('div');
		confettiContainer.className = 'nova-confetti-container';
		document.body.appendChild(confettiContainer);

		// Get settings container position for explosion center
		const rect = this.containerEl.getBoundingClientRect();
		const centerX = rect.left + rect.width / 2;
		const centerY = rect.top + Math.min(rect.height / 2, 300);

		// Colors for confetti
		const colors = ['gold', 'blue', 'pink', 'green', 'red', ''];  // empty string = default purple

		// Create confetti pieces
		for (let i = 0; i < 150; i++) {
			const confetti = document.createElement('div');
			confetti.className = `nova-confetti-piece ${colors[Math.floor(Math.random() * colors.length)]}`;
			
			// Position at explosion center
			confetti.style.left = `${centerX}px`;
			confetti.style.top = `${centerY}px`;
			
			// Calculate explosion trajectory
			const angle = (Math.PI * 2 * i) / 150 + (Math.random() * 0.2 - 0.1);
			const velocity = 250 + Math.random() * 350; // pixels
			const explodeX = Math.cos(angle) * velocity;
			const explodeY = Math.sin(angle) * velocity - 150; // Strong upward bias
			
			// Set CSS custom properties for animation
			confetti.style.setProperty('--explode-x', `${explodeX}px`);
			confetti.style.setProperty('--explode-y', `${explodeY}px`);
			
			// Random delay for staggered explosion
			confetti.style.animationDelay = `${Math.random() * 0.2}s`;
			
			// Random size
			const size = 6 + Math.random() * 14;
			confetti.style.width = `${size}px`;
			confetti.style.height = `${size}px`;
			
			// Make some confetti rectangular
			if (Math.random() > 0.5) {
				confetti.style.height = `${size * 0.4}px`;
			}
			
			confettiContainer.appendChild(confetti);
		}

		// Remove container after animation completes
		setTimeout(() => {
			confettiContainer.remove();
		}, 4000);
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
		
		// Create collapsible header
		const headerEl = containerEl.createDiv({ cls: 'nova-collapsible-header' });
		headerEl.style.cssText = `
			display: flex;
			align-items: center;
			cursor: pointer;
			padding: 8px 0;
			border-bottom: 1px solid var(--background-modifier-border);
			margin-bottom: 16px;
		`;
		
		const arrowEl = headerEl.createSpan({ cls: 'nova-collapsible-arrow' });
		arrowEl.innerHTML = '▶';
		arrowEl.style.cssText = `
			margin-right: 8px;
			transition: transform 0.2s ease;
			font-size: 12px;
			color: var(--text-muted);
		`;
		
		const titleEl = headerEl.createEl('h3', { text: 'AI Provider Settings' });
		titleEl.style.cssText = 'margin: 0; flex: 1;';

		const providerContainer = containerEl.createDiv({ cls: 'nova-provider-section' });
		providerContainer.style.cssText = 'display: none;'; // Start collapsed
		
		// Toggle functionality
		headerEl.addEventListener('click', () => {
			const isVisible = providerContainer.style.display !== 'none';
			providerContainer.style.display = isVisible ? 'none' : 'block';
			arrowEl.style.transform = isVisible ? 'rotate(0deg)' : 'rotate(90deg)';
		});

		// Info about API keys
		const infoEl = providerContainer.createDiv({ cls: 'nova-provider-info' });
		infoEl.innerHTML = `
			<div class="nova-info-card">
				<h4>Configure Your API Keys</h4>
				<p>Nova connects to AI providers using your own API keys. All providers are available to all users - 
				just add your API keys below to get started.</p>
			</div>
		`;

		// Show all providers - no restrictions
		this.createOllamaSettings(providerContainer);
		this.createClaudeSettings(providerContainer);
		this.createGoogleSettings(providerContainer);
		this.createOpenAISettings(providerContainer);
	}

	private createClaudeSettings(containerEl = this.containerEl) {
		
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

		// Model setting with refresh button
		const modelSetting = new Setting(claudeContainer)
			.setName('Model')
			.setDesc('Claude model to use');

		let modelDropdown: any;
		
		modelSetting.addDropdown(dropdown => {
			modelDropdown = dropdown;
			this.populateClaudeModels(dropdown);
			return dropdown
				.setValue(this.plugin.settings.aiProviders.claude.model || 'claude-3-5-sonnet-20241022')
				.onChange(async (value) => {
					this.plugin.settings.aiProviders.claude.model = value;
					await this.plugin.saveSettings();
				});
		});

		modelSetting.addButton(button => button
			.setIcon('refresh-cw')
			.setTooltip('Refresh available models')
			.onClick(async () => {
				await this.refreshProviderModels('claude', modelDropdown);
			}));
	}

	private populateClaudeModels(dropdown: any) {
		// Clear existing options
		dropdown.selectEl.empty();
		
		// Add default models
		const defaultModels = [
			{ value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
			{ value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
			{ value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
			{ value: 'claude-3-sonnet-20240229', label: 'Claude 3 Sonnet' },
			{ value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku' }
		];

		defaultModels.forEach(model => {
			dropdown.addOption(model.value, model.label);
		});
	}

	private async refreshProviderModels(providerType: 'claude' | 'openai' | 'google', dropdown: any) {
		const button = dropdown.selectEl.parentElement?.querySelector('.clickable-icon');
		if (button) {
			button.style.opacity = '0.5';
			button.style.pointerEvents = 'none';
		}

		try {
			const models = await this.plugin.aiProviderManager.getProviderModels(providerType);
			
			if (models.length > 0) {
				// Clear existing options
				dropdown.selectEl.empty();
				
				// Add fetched models
				models.forEach(model => {
					const label = this.getModelDisplayName(providerType, model);
					dropdown.addOption(model, label);
				});

				// Restore current selection if it exists in the new list
				const currentModel = this.plugin.settings.aiProviders[providerType].model;
				if (currentModel && models.includes(currentModel)) {
					dropdown.setValue(currentModel);
				} else if (models.length > 0) {
					// Set first model as default if current model is not in the list
					dropdown.setValue(models[0]);
					this.plugin.settings.aiProviders[providerType].model = models[0];
					await this.plugin.saveSettings();
				}

				this.showRefreshMessage('Models refreshed successfully', 'success');
			} else {
				this.showRefreshMessage('No models found or API key invalid', 'error');
			}
		} catch (error) {
			console.error(`Failed to refresh ${providerType} models:`, error);
			this.showRefreshMessage(`Failed to refresh models: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
		} finally {
			if (button) {
				button.style.opacity = '1';
				button.style.pointerEvents = 'auto';
			}
		}
	}

	private getModelDisplayName(providerType: string, model: string): string {
		// Create human-readable names for models
		if (providerType === 'claude') {
			if (model.includes('sonnet')) return model.includes('3-5') ? 'Claude 3.5 Sonnet' : 'Claude 3 Sonnet';
			if (model.includes('haiku')) return model.includes('3-5') ? 'Claude 3.5 Haiku' : 'Claude 3 Haiku';
			if (model.includes('opus')) return 'Claude 3 Opus';
		} else if (providerType === 'openai') {
			if (model.includes('gpt-4o')) return model.includes('mini') ? 'GPT-4o Mini' : 'GPT-4o';
			if (model.includes('gpt-4')) return 'GPT-4';
			if (model.includes('gpt-3.5')) return 'GPT-3.5 Turbo';
		} else if (providerType === 'google') {
			if (model.includes('2.0')) return 'Gemini 2.0 Flash';
			if (model.includes('1.5-pro')) return 'Gemini 1.5 Pro';
			if (model.includes('1.5-flash')) return 'Gemini 1.5 Flash';
			if (model.includes('1.0-pro')) return 'Gemini 1.0 Pro';
		}
		
		// Fallback to model name
		return model;
	}

	private showRefreshMessage(message: string, type: 'success' | 'error') {
		// Create or update message element
		const existingMessage = this.containerEl.querySelector('.nova-refresh-message');
		if (existingMessage) {
			existingMessage.remove();
		}

		const messageEl = this.containerEl.createDiv({ 
			cls: `nova-refresh-message ${type}`,
			text: message
		});

		messageEl.style.cssText = `
			position: fixed;
			top: 20px;
			right: 20px;
			padding: 8px 12px;
			border-radius: 4px;
			font-size: 0.9em;
			z-index: 1000;
			${type === 'success' 
				? 'background: var(--background-modifier-success); color: var(--text-success);' 
				: 'background: var(--background-modifier-error); color: var(--text-error);'
			}
		`;

		// Auto-remove after 3 seconds
		setTimeout(() => {
			messageEl.remove();
		}, 3000);
	}


	private createOpenAISettings(containerEl = this.containerEl) {
		
		const openaiContainer = containerEl.createDiv({ cls: 'nova-provider-section' });
		openaiContainer.createEl('h4', { text: 'ChatGPT (OpenAI)' });

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

		// Model setting with refresh button
		const modelSetting = new Setting(openaiContainer)
			.setName('Model')
			.setDesc('OpenAI model to use');

		let modelDropdown: any;
		
		modelSetting.addDropdown(dropdown => {
			modelDropdown = dropdown;
			this.populateOpenAIModels(dropdown);
			return dropdown
				.setValue(this.plugin.settings.aiProviders.openai.model || 'gpt-4o')
				.onChange(async (value) => {
					this.plugin.settings.aiProviders.openai.model = value;
					await this.plugin.saveSettings();
				});
		});

		modelSetting.addButton(button => button
			.setIcon('refresh-cw')
			.setTooltip('Refresh available models')
			.onClick(async () => {
				await this.refreshProviderModels('openai', modelDropdown);
			}));
	}

	private populateOpenAIModels(dropdown: any) {
		// Clear existing options
		dropdown.selectEl.empty();
		
		// Add default models
		const defaultModels = [
			{ value: 'gpt-4o', label: 'GPT-4o' },
			{ value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
			{ value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
			{ value: 'gpt-4', label: 'GPT-4' },
			{ value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' }
		];

		defaultModels.forEach(model => {
			dropdown.addOption(model.value, model.label);
		});
	}

	private createGoogleSettings(containerEl = this.containerEl) {
		
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

		// Model setting with refresh button
		const modelSetting = new Setting(googleContainer)
			.setName('Model')
			.setDesc('Gemini model to use');

		let modelDropdown: any;
		
		modelSetting.addDropdown(dropdown => {
			modelDropdown = dropdown;
			this.populateGoogleModels(dropdown);
			return dropdown
				.setValue(this.plugin.settings.aiProviders.google.model || 'gemini-1.5-flash')
				.onChange(async (value) => {
					this.plugin.settings.aiProviders.google.model = value;
					await this.plugin.saveSettings();
				});
		});

		modelSetting.addButton(button => button
			.setIcon('refresh-cw')
			.setTooltip('Refresh available models')
			.onClick(async () => {
				await this.refreshProviderModels('google', modelDropdown);
			}));
	}

	private populateGoogleModels(dropdown: any) {
		// Clear existing options
		dropdown.selectEl.empty();
		
		// Add default models
		const defaultModels = [
			{ value: 'gemini-2.0-flash-exp', label: 'Gemini 2.0 Flash (Experimental)' },
			{ value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
			{ value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
			{ value: 'gemini-1.0-pro', label: 'Gemini 1.0 Pro' }
		];

		defaultModels.forEach(model => {
			dropdown.addOption(model.value, model.label);
		});
	}

	private createOllamaSettings(containerEl = this.containerEl) {
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
		
		// Create collapsible header
		const headerEl = containerEl.createDiv({ cls: 'nova-collapsible-header' });
		headerEl.style.cssText = `
			display: flex;
			align-items: center;
			cursor: pointer;
			padding: 8px 0;
			border-bottom: 1px solid var(--background-modifier-border);
			margin-bottom: 16px;
		`;
		
		const arrowEl = headerEl.createSpan({ cls: 'nova-collapsible-arrow' });
		arrowEl.innerHTML = '▶';
		arrowEl.style.cssText = `
			margin-right: 8px;
			transition: transform 0.2s ease;
			font-size: 12px;
			color: var(--text-muted);
		`;
		
		const titleEl = headerEl.createEl('h3', { text: 'Platform Settings' });
		titleEl.style.cssText = 'margin: 0; flex: 1;';

		const platformContainer = containerEl.createDiv({ cls: 'nova-platform-section' });
		platformContainer.style.cssText = 'display: none;'; // Start collapsed
		
		// Toggle functionality
		headerEl.addEventListener('click', () => {
			const isVisible = platformContainer.style.display !== 'none';
			platformContainer.style.display = isVisible ? 'none' : 'block';
			arrowEl.style.transform = isVisible ? 'rotate(0deg)' : 'rotate(90deg)';
		});
		
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
		// All providers are available to all users in the Supernova model
		return platform === 'desktop' 
			? ['claude', 'openai', 'google', 'ollama']
			: ['claude', 'openai', 'google'];
	}

	private getProviderDisplayName(provider: ProviderType): string {
		const names: Record<ProviderType, string> = {
			'claude': 'Claude (Anthropic)',
			'openai': 'ChatGPT (OpenAI)',
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

	private createCommandSettings() {
		const { containerEl } = this;
		
		// Create collapsible header
		const headerEl = containerEl.createDiv({ cls: 'nova-collapsible-header' });
		headerEl.style.cssText = `
			display: flex;
			align-items: center;
			cursor: pointer;
			padding: 8px 0;
			border-bottom: 1px solid var(--background-modifier-border);
			margin-bottom: 16px;
		`;
		
		const arrowEl = headerEl.createSpan({ cls: 'nova-collapsible-arrow' });
		arrowEl.innerHTML = '▶';
		arrowEl.style.cssText = `
			margin-right: 8px;
			transition: transform 0.2s ease;
			font-size: 12px;
			color: var(--text-muted);
		`;
		
		const titleEl = headerEl.createEl('h3', { text: 'Custom Commands' });
		titleEl.style.cssText = 'margin: 0; flex: 1;';

		const commandContainer = containerEl.createDiv({ cls: 'nova-command-section' });
		commandContainer.style.cssText = 'display: none;'; // Start collapsed
		
		// Toggle functionality
		headerEl.addEventListener('click', () => {
			const isVisible = commandContainer.style.display !== 'none';
			commandContainer.style.display = isVisible ? 'none' : 'block';
			arrowEl.style.transform = isVisible ? 'rotate(0deg)' : 'rotate(90deg)';
		});

		// Feature availability check
		if (!this.plugin.featureManager.isFeatureEnabled('custom-commands')) {
			const noticeEl = commandContainer.createDiv({ cls: 'nova-feature-notice' });
			noticeEl.innerHTML = `
				<div style="padding: 16px; background: var(--background-modifier-hover); border-radius: 8px; border: 1px solid var(--background-modifier-border);">
					<h4 style="margin: 0 0 8px 0; color: var(--text-normal);">Supernova Supporter Feature</h4>
					<p style="margin: 0; color: var(--text-muted); font-size: 0.9em;">
						Custom commands are currently available to Supernova supporters. 
						They will be available to all users on <strong>October 1, 2025</strong>.
					</p>
				</div>
			`;
			return;
		}

		// Description
		const descEl = commandContainer.createDiv({ cls: 'nova-command-description' });
		descEl.innerHTML = `
			<p style="color: var(--text-muted); margin-bottom: 16px;">
				Create custom command shortcuts that insert predefined text templates when triggered with <code>:trigger</code>.
			</p>
		`;

		// Show Command Button setting (Supernova-only)
		new Setting(commandContainer)
			.setName('Show Command Button in Chat')
			.setDesc('Show the Commands button beside the Send button for quick command access')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showCommandButton)
				.onChange(async (value) => {
					this.plugin.settings.showCommandButton = value;
					await this.plugin.saveSettings();
					
					// Find and refresh sidebar view
					const leaves = this.plugin.app.workspace.getLeavesOfType(VIEW_TYPE_NOVA_SIDEBAR);
					if (leaves.length > 0) {
						const sidebarView = leaves[0].view as NovaSidebarView;
						sidebarView.refreshCommandButton();
					}
				}));

		// Add new command button at the top
		const buttonEl = commandContainer.createDiv({ cls: 'nova-add-command' });
		buttonEl.style.cssText = 'margin-bottom: 16px;';
		
		new Setting(buttonEl)
			.addButton(button => 
				button
					.setButtonText('+ Add Custom Command')
					.setCta()
					.onClick(() => this.showAddCommandDialog())
			);

		// Commands list
		this.renderCustomCommandsList(commandContainer);
	}

	private renderCustomCommandsList(container: HTMLElement) {
		// Clear existing commands list
		const existingList = container.querySelector('.nova-commands-list');
		if (existingList) existingList.remove();

		const commandsList = container.createDiv({ cls: 'nova-commands-list' });
		const commands = this.plugin.settings.customCommands || [];

		if (commands.length === 0) {
			const emptyEl = commandsList.createDiv({ cls: 'nova-commands-empty' });
			emptyEl.innerHTML = `
				<div style="text-align: center; padding: 24px; color: var(--text-muted);">
					<p>No custom commands yet.</p>
					<p style="font-size: 0.9em;">Create your first command to get started!</p>
				</div>
			`;
			return;
		}

		commands.forEach((command, index) => {
			const commandEl = commandsList.createDiv({ cls: 'nova-command-item' });
			commandEl.style.cssText = `
				border: 1px solid var(--background-modifier-border);
				border-radius: 8px;
				padding: 16px;
				margin-bottom: 12px;
				background: var(--background-primary);
			`;

			// Command header
			const headerEl = commandEl.createDiv({ cls: 'nova-command-header' });
			headerEl.style.cssText = 'display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;';

			const infoEl = headerEl.createDiv({ cls: 'nova-command-info' });
			
			const nameEl = infoEl.createDiv({ cls: 'nova-command-name' });
			nameEl.textContent = command.name;
			nameEl.style.cssText = 'font-weight: 600; margin-bottom: 4px;';

			const triggerEl = infoEl.createDiv({ cls: 'nova-command-trigger' });
			triggerEl.innerHTML = `<code>:${command.trigger}</code>`;
			triggerEl.style.cssText = 'font-family: var(--font-monospace); color: var(--interactive-accent); font-size: 0.9em;';

			// Actions
			const actionsEl = headerEl.createDiv({ cls: 'nova-command-actions' });
			actionsEl.style.cssText = 'display: flex; gap: 8px;';

			const editBtn = actionsEl.createEl('button', { text: 'Edit' });
			editBtn.style.cssText = 'padding: 4px 8px; font-size: 0.8em; border-radius: 4px;';
			editBtn.onclick = () => this.showEditCommandDialog(index);

			const deleteBtn = actionsEl.createEl('button', { text: 'Delete' });
			deleteBtn.style.cssText = 'padding: 4px 8px; font-size: 0.8em; border-radius: 4px; background: var(--background-modifier-error); color: var(--text-on-accent);';
			deleteBtn.onclick = () => this.deleteCommand(index);

			// Description and template preview
			if (command.description) {
				const descEl = commandEl.createDiv({ cls: 'nova-command-desc' });
				descEl.textContent = command.description;
				descEl.style.cssText = 'color: var(--text-muted); font-size: 0.9em; margin-bottom: 8px;';
			}

			const templateEl = commandEl.createDiv({ cls: 'nova-command-template' });
			templateEl.innerHTML = `
				<div style="background: var(--background-modifier-hover); padding: 8px; border-radius: 4px; font-family: var(--font-monospace); font-size: 0.8em; white-space: pre-wrap; max-height: 60px; overflow-y: auto;">
					${command.template}
				</div>
			`;
		});
	}

	private showAddCommandDialog() {
		this.showCommandDialog();
	}

	private showEditCommandDialog(index: number) {
		const command = this.plugin.settings.customCommands?.[index];
		if (command) {
			this.showCommandDialog(command, index);
		}
	}

	private showCommandDialog(existingCommand?: CustomCommand, editIndex?: number) {
		// For now, use a simple prompt-based approach
		// TODO: Implement proper modal when Modal class is properly available
		const name = prompt('Command name:', existingCommand?.name || '');
		if (!name) return;
		
		const trigger = prompt('Command trigger (without :):', existingCommand?.trigger || '');
		if (!trigger) return;
		
		const description = prompt('Description (optional):', existingCommand?.description || '');
		
		const template = prompt('Template content:', existingCommand?.template || '');
		if (!template) return;
		
		const result: CustomCommand = {
			id: existingCommand?.id || ('cmd_' + Math.random().toString(36).substr(2, 9)),
			name,
			trigger: trigger.toLowerCase(),
			template,
			description: description || undefined
		};
		
		if (editIndex !== undefined) {
			// Edit existing command
			if (!this.plugin.settings.customCommands) this.plugin.settings.customCommands = [];
			this.plugin.settings.customCommands[editIndex] = result;
		} else {
			// Add new command
			if (!this.plugin.settings.customCommands) this.plugin.settings.customCommands = [];
			this.plugin.settings.customCommands.push(result);
		}
		
		this.plugin.saveSettings();
		this.renderCustomCommandsList(this.containerEl.querySelector('.nova-command-section') as HTMLElement);
	}

	private deleteCommand(index: number) {
		if (!this.plugin.settings.customCommands) return;
		
		const command = this.plugin.settings.customCommands[index];
		const confirmed = confirm(`Delete command "${command.name}" (${command.trigger})?`);
		
		if (confirmed) {
			this.plugin.settings.customCommands.splice(index, 1);
			this.plugin.saveSettings();
			this.renderCustomCommandsList(this.containerEl.querySelector('.nova-command-section') as HTMLElement);
		}
	}
}