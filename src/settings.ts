import { App, PluginSettingTab, Setting, Platform, setIcon } from 'obsidian';
import NovaPlugin from '../main';
import { AIProviderSettings, PlatformSettings, ProviderType } from './ai/types';
import { DebugSettings, SupernovaLicense } from './licensing/types';
import { VIEW_TYPE_NOVA_SIDEBAR, NovaSidebarView } from './ui/sidebar-view';
import { ClaudeProvider } from './ai/providers/claude';
import { OpenAIProvider } from './ai/providers/openai';
import { GoogleProvider } from './ai/providers/google';
import { OllamaProvider } from './ai/providers/ollama';
import { Logger } from './utils/logger';
import { TimeoutManager } from './utils/timeout-manager';


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
	general: {
		defaultTemperature: number;
		defaultMaxTokens: number;
	};
	licensing: {
		supernovaLicenseKey: string;
		debugSettings: DebugSettings;
	};
	features?: {
		commands?: {
			customCommands: CustomCommand[];
			showCommandButton: boolean;
		};
	};
}

export const DEFAULT_SETTINGS: NovaSettings = {
	aiProviders: {
		claude: {
			apiKey: ''
		},
		openai: {
			apiKey: '',
			baseUrl: 'https://api.openai.com/v1'
		},
		google: {
			apiKey: ''
		},
		ollama: {
			baseUrl: 'http://localhost:11434',
			model: '',
			contextSize: 32000
		}
	},
	platformSettings: {
		desktop: {
			selectedModel: ''  // No default model
		},
		mobile: {
			selectedModel: 'none'  // Explicitly disabled by default for privacy
		}
	},
	general: {
		defaultTemperature: 0.7,
		defaultMaxTokens: 1000
	},
	licensing: {
		supernovaLicenseKey: '',
		debugSettings: {
			enabled: false,
			overrideDate: undefined,
			forceSupernova: false
		}
	}
};

export class NovaSettingTab extends PluginSettingTab {
	plugin: NovaPlugin;
	private activeTab: 'getting-started' | 'general' | 'providers' | 'supernova' | 'debug' = 'getting-started';
	private tabContainer: HTMLElement | null = null;
	private contentContainer: HTMLElement | null = null;
	private timeoutManager = new TimeoutManager();

	constructor(app: App, plugin: NovaPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	/**
	 * Register event listener using plugin's registration system
	 */
	private registerEventListener(element: HTMLElement, event: string, handler: EventListener): void {
		this.plugin.registerDomEvent(element, event as any, handler);
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// Create tab navigation container (only once)
		this.tabContainer = containerEl.createDiv({ cls: 'nova-tab-container' });
		this.createTabNavigation();
		
		// Create content container (only once)  
		this.contentContainer = containerEl.createDiv({ cls: 'nova-tab-content' });
		// Use async initialization for tab content
		this.updateTabContent();
	}

	private createTabNavigation(): void {
		if (!this.tabContainer) return;
		
		const tabs = [
			{ id: 'getting-started', label: 'Getting started' },
			{ id: 'general', label: 'General' },
			{ id: 'providers', label: 'AI providers' },
			{ id: 'supernova', label: 'Supernova' }
		];

		// Add Debug tab only for debug builds
		if (process.env.NODE_ENV === 'development') {
			tabs.push({ id: 'debug', label: 'Debug' });
		}

		tabs.forEach(tab => {
			const tabEl = this.tabContainer!.createDiv({ 
				cls: `nova-tab ${this.activeTab === tab.id ? 'active' : ''}`,
				text: tab.label
			});
			tabEl.dataset.tabId = tab.id;
			
			this.registerEventListener(tabEl, 'click', () => {
				this.switchTab(tab.id as 'getting-started' | 'general' | 'providers' | 'supernova' | 'debug');
			});
		});
	}

	private switchTab(tabId: 'getting-started' | 'general' | 'providers' | 'supernova' | 'debug'): void {
		this.activeTab = tabId;
		this.updateTabStates();
		this.updateTabContent();
		this.scrollToActiveTab();
	}

	private updateTabStates(): void {
		if (!this.tabContainer) return;
		
		// Update tab active states without re-creating elements
		const tabElements = this.tabContainer.querySelectorAll('.nova-tab');
		tabElements.forEach(tabEl => {
			const htmlTabEl = tabEl as HTMLElement;
			if (htmlTabEl.dataset.tabId === this.activeTab) {
				htmlTabEl.addClass('active');
			} else {
				htmlTabEl.removeClass('active');
			}
		});
	}

	private scrollToActiveTab(): void {
		if (!this.tabContainer) return;
		
		const activeTab = this.tabContainer.querySelector('.nova-tab.active') as HTMLElement;
		if (activeTab) {
			activeTab.scrollIntoView({
				behavior: 'smooth',
				block: 'nearest',
				inline: 'center'
			});
		}
	}

	private updateTabContent(): void {
		if (!this.contentContainer) return;
		
		// Clear existing content
		this.contentContainer.empty();
		
		switch (this.activeTab) {
			case 'getting-started':
				this.createGettingStartedTabContent(this.contentContainer);
				break;
			case 'general':
				this.createGeneralTabContent(this.contentContainer);
				break;
			case 'providers':
				this.createProvidersTabContent(this.contentContainer);
				break;
			case 'supernova':
				this.createSupernovaTabContent(this.contentContainer);
				break;
			case 'debug':
				this.createDebugTabContent(this.contentContainer);
				break;
		}
	}

	private createGeneralTabContent(container: HTMLElement): void {
		this.createGeneralSettings(container);
		this.createPrivacySettings(container);
	}

	private createProvidersTabContent(container: HTMLElement): void {
		this.createProviderSettings(container);
	}


	private createGettingStartedTabContent(container: HTMLElement): void {
		this.createWelcomeSection(container);
		this.createNavigationHelp(container);
		this.createQuickStartGuide(container);
	}

	private createSupernovaTabContent(container: HTMLElement): void {
		// Use the reusable CTA component
		this.createSupernovaCTA(container, {
			buttonAction: 'direct',
			showLearnMore: false,
			marginBottom: '32px'
		});
		
		// Benefits section with normal styling
		const benefitsSection = container.createDiv({ cls: 'nova-benefits-section' });
		// Main section heading
		new Setting(benefitsSection).setName('Supernova benefits').setHeading();
		benefitsSection.createEl('hr', { cls: 'nova-section-divider' });
		
		const benefitsContent = benefitsSection.createDiv({ cls: 'nova-benefits-content' });
		// Create benefits content using DOM API
		const benefitsP = benefitsContent.createEl('p', { cls: 'nova-benefits-intro' });
		benefitsP.textContent = 'Support Nova development and get early access to new features. All features eventually become free for everyone.';
		
		const benefitsList = benefitsContent.createDiv({ cls: 'nova-benefits-list' });
		
		// Helper function to create benefit items
		const createBenefitItem = (icon: string, title: string, description: string) => {
			const item = benefitsList.createDiv({ cls: 'nova-benefit-item' });
			item.createSpan({ cls: 'nova-benefit-icon', text: icon });
			const content = item.createDiv({ cls: 'nova-benefit-content' });
			content.createEl('strong', { text: title });
			content.createSpan({ text: description });
		};
		
		createBenefitItem('⚡', 'Early access', 'Get new features 2-4 months before general release');
		createBenefitItem('💬', 'Priority support', 'Direct access to developers for feature requests and bug reports');
		createBenefitItem('🗳️', 'Vote on features', 'Help shape Nova\'s development and future direction');
		createBenefitItem('🏆', 'Supporter badge', 'Recognition in the Nova community (coming soon)');
		createBenefitItem('❤️', 'Open source support', 'Directly fund continued development of Nova');
		
		
		// Add closing message
		const closingP = benefitsContent.createEl('p', { cls: 'nova-benefits-closing' });
		closingP.textContent = 'Your support keeps Nova free and open source for everyone.';
		
		// License settings section - styled like API keys
		const licenseSection = container.createDiv({ cls: 'nova-provider-section nova-license-section' });
		new Setting(licenseSection).setName('License management').setHeading();
		licenseSection.createEl('hr', { cls: 'nova-section-divider' });
		
		this.createSupernovaLicenseInput(licenseSection);
	}

	private createDebugTabContent(container: HTMLElement): void {
		// Debug Settings Section
		const debugSection = container.createDiv({ cls: 'nova-debug-section' });
		new Setting(debugSection)
			.setName('Debug')
			.setHeading();
		
		const infoEl = debugSection.createDiv({ cls: 'nova-debug-info' });
		// Create debug info using DOM API
		const infoCard1 = infoEl.createDiv({ cls: 'nova-info-card' });
		infoCard1.createEl('p', { text: 'Debug settings for development and testing. These options help developers troubleshoot issues and test new features.' });
		
		const infoCard2 = infoEl.createDiv({ cls: 'nova-info-card' });
		infoCard2.createEl('h4', { text: '⚠️ Developer' });
		
		const featuresList = infoCard2.createEl('ul', { cls: 'nova-debug-features' });
		const features = [
			['Debug mode', 'Enable detailed logging and development features'],
			['Override date', 'Test time-sensitive features with custom dates'],
			['Force supernova', 'Test Supernova-only features without a license']
		];
		
		features.forEach(([name, desc]) => {
			const li = featuresList.createEl('li');
			li.createEl('strong', { text: name });
			li.appendText(` - ${desc}`);
		});
		
		infoCard2.createEl('p', { 
			cls: 'nova-debug-note', 
			text: 'Only modify these settings if you understand their purpose.' 
		});
		
		this.createDebugSettings(debugSection);
	}

	private createPrivacySettings(container: HTMLElement): void {
		// Privacy & Platform Section
		const privacySection = container.createDiv({ cls: 'nova-privacy-section' });
		new Setting(privacySection)
			.setName('Privacy & platform')
			.setHeading();
		
		const infoEl = privacySection.createDiv({ cls: 'nova-privacy-info' });
		
		// Privacy info card
		const privacyCard = infoEl.createDiv({ cls: 'nova-info-card' });
		privacyCard.createEl('h4', { text: '🔒 Your privacy matters' });
		const privacyText = privacyCard.createEl('p');
		privacyText.textContent = 'Nova respects your privacy and gives you full control over how your data is handled. All AI providers are accessed using your own API keys, so your content stays between you and your chosen AI service.';
		
		// Mobile support info card
		const mobileCard = infoEl.createDiv({ cls: 'nova-info-card' });
		mobileCard.createEl('h4', { text: '📱 Mobile support' });
		const mobileText = mobileCard.createEl('p');
		mobileText.textContent = 'Mobile support is disabled by default to protect your privacy. When enabled, Nova provides identical selection-based editing capabilities across desktop and mobile with cloud-based AI providers.';
		
		// Features list
		const featuresList = mobileCard.createEl('ul', { cls: 'nova-privacy-features' });
		const features = [
			{ title: 'Local-first', desc: ' - Ollama and desktop-only providers keep everything on your device' },
			{ title: 'Your choice', desc: ' - Enable mobile only when you need cross-device access' },
			{ title: 'Cross-platform editing', desc: ' - Selection-based editing works identically on mobile via Command Palette (Cmd+P)' },
			{ title: 'Same experience', desc: ' - Mobile provides the same editing capabilities as desktop' }
		];
		
		features.forEach(feature => {
			const li = featuresList.createEl('li');
			li.createEl('strong', { text: feature.title });
			li.appendText(feature.desc);
		});
		
		// Mobile Support Toggle
		new Setting(privacySection)
			.setName('Enable mobile support')
			.setDesc('Allow Nova to work on mobile devices using cloud-based AI providers')
			.addToggle(toggle => {
				const currentMobileModel = this.plugin.settings.platformSettings.mobile.selectedModel;
				const isMobileEnabled = currentMobileModel !== 'none';
				
				toggle
					.setValue(isMobileEnabled)
					.onChange(async (value) => {
						if (value) {
							// Enable mobile with Claude as default (most reliable)
							this.plugin.settings.platformSettings.mobile.selectedModel = '';
						} else {
							// Disable mobile
							this.plugin.settings.platformSettings.mobile.selectedModel = 'none';
						}
						await this.plugin.saveSettings();
						if (this.plugin.aiProviderManager) {
							this.plugin.aiProviderManager.updateSettings(this.plugin.settings);
						}

						// Emit event to update sidebar UI
						document.dispatchEvent(new CustomEvent('nova-provider-configured', {
							detail: { provider: 'mobile-settings', status: value ? 'enabled' : 'disabled' }
						}));
					});
			});
	}

	private createSecureApiKeyInput(container: HTMLElement, options: {
		name: string;
		desc: string;
		placeholder: string;
		value: string;
		onChange: (value: string) => Promise<void>;
	}): void {
		const setting = new Setting(container)
			.setName(options.name)
			.setDesc(options.desc);

		let actualValue = options.value;
		let isVisible = false;

		setting.addText(text => {
			text.inputEl.type = 'password';
			// Font family now handled by CSS class
			text.inputEl.addClass('nova-api-input');
			text.setPlaceholder(options.placeholder);

			// Set initial display value
			if (actualValue && actualValue.length > 12) {
				const masked = actualValue.slice(0, 8) + '••••••••••••••••••••••••' + actualValue.slice(-4);
				text.setValue(masked);
			} else {
				text.setValue(actualValue);
			}

			// Create toggle button
			const inputContainer = text.inputEl.parentElement;
			if (inputContainer) {
				inputContainer.addClass('nova-input-container');
				
				const toggleBtn = inputContainer.createEl('button', { cls: 'nova-toggle-btn' });
				setIcon(toggleBtn, 'eye');

				this.registerEventListener(toggleBtn, 'click', (e: Event) => {
					e.preventDefault();
					isVisible = !isVisible;
					
					if (isVisible) {
						text.inputEl.type = 'text';
						text.setValue(actualValue);
						setIcon(toggleBtn, 'eye-off');
					} else {
						text.inputEl.type = 'password';
						if (actualValue && actualValue.length > 12) {
							const masked = actualValue.slice(0, 8) + '••••••••••••••••••••••••' + actualValue.slice(-4);
							text.setValue(masked);
						} else {
							text.setValue(actualValue);
						}
						setIcon(toggleBtn, 'eye');
					}
				});
			}

			// Handle value changes
			text.onChange(async (value) => {
				actualValue = value;
				await options.onChange(value);
			});

			return text;
		});
	}

	private createProviderStatusIndicator(container: HTMLElement, provider: 'claude' | 'openai' | 'google' | 'ollama'): HTMLElement {
		const statusContainer = container.createDiv({ cls: 'nova-provider-status-container' });
		
		try {
			const status = this.getProviderStatus(provider);
			const statusEl = statusContainer.createDiv({ cls: `nova-provider-status ${status.state}` });
			
			// Status dot
			statusEl.createSpan({ cls: 'nova-status-dot' });
			
			// Status text
			const text = statusEl.createSpan({ cls: 'nova-status-text' });
			text.textContent = this.getStatusDisplayText(status);
			
			// Tooltip with details
			if (status.lastChecked || status.message) {
				const tooltip = statusEl.createDiv({ cls: 'nova-status-tooltip' });
				if (status.lastChecked) {
					const timeEl = tooltip.createDiv({ cls: 'nova-status-time' });
					const date = status.lastChecked instanceof Date ? status.lastChecked : new Date(status.lastChecked);
					timeEl.textContent = `Last checked: ${date.toLocaleDateString()}`;
				}
				if (status.message) {
					const messageEl = tooltip.createDiv({ cls: 'nova-status-message' });
					messageEl.textContent = status.message;
				}
			}
		} catch (error) {
			Logger.error('Error creating provider status indicator:', error);
			// Fallback: create a simple status indicator
			const statusEl = statusContainer.createDiv({ cls: 'nova-provider-status untested' });
			statusEl.createSpan({ cls: 'nova-status-dot' });
			const text = statusEl.createSpan({ cls: 'nova-status-text' });
			text.textContent = 'Status unknown';
		}
		
		return statusContainer;
	}

	private getProviderStatus(provider: 'claude' | 'openai' | 'google' | 'ollama'): { state: 'connected' | 'error' | 'not-configured' | 'untested' | 'testing', message?: string, lastChecked?: Date | string | null } {
		try {
			const savedStatus = this.plugin.settings.aiProviders[provider]?.status;
			if (savedStatus) {
				return savedStatus;
			}
			
			// Determine initial status based on configuration
			const hasConfig = this.hasProviderConfig(provider);
			return {
				state: hasConfig ? 'untested' : 'not-configured',
				message: hasConfig ? 'Configuration not tested' : 'No API key configured',
				lastChecked: null
			};
		} catch (error) {
			Logger.error(`Error getting provider status for ${provider}:`, error);
			return {
				state: 'not-configured',
				message: 'Status unavailable',
				lastChecked: null
			};
		}
	}

	private getStatusDisplayText(status: { state: string, message?: string }): string {
		switch (status.state) {
			case 'connected': return 'Connected';
			case 'error': return 'Connection failed';
			case 'not-configured': return 'Not configured';
			case 'untested': return 'Untested';
			case 'testing': return 'Testing...';
			default: return 'Unknown';
		}
	}

	private createTestConnectionButton(container: HTMLElement, provider: 'claude' | 'openai' | 'google' | 'ollama'): void {
		const setting = new Setting(container)
			.setName('Connection status')
			.setDesc('Test your API connection');

		// Create status indicator first (to the left)
		const statusContainer = setting.controlEl.createDiv({ cls: 'nova-connection-status-container' });
		
		setting.addButton(button => {
			button.setButtonText('Test connection')
				.setTooltip(`Test ${provider} connection`)
				.onClick(async () => {
					await this.testProviderConnection(provider, button.buttonEl, statusContainer);
				});
			button.buttonEl.setAttribute('aria-label', `Test ${this.getProviderDisplayName(provider)} connection`);
			return button;
		});
		
		// Show initial status if we have it
		this.updateConnectionStatus(statusContainer, provider);
	}

	private async testProviderConnection(provider: 'claude' | 'openai' | 'google' | 'ollama', buttonEl: HTMLElement, statusContainer: HTMLElement): Promise<void> {
		const originalText = buttonEl.textContent || 'Test Connection';
		const button = buttonEl as HTMLButtonElement;
		
		// Force enable and set initial state
		button.disabled = false;
		button.textContent = 'Testing...';
		button.addClass('nova-button-testing');
		
		// Update provider status to testing
		await this.updateProviderStatus(provider, 'testing', 'Testing connection...');
		
		// Show testing status
		this.setConnectionStatus(statusContainer, 'testing', 'Testing...');
		
		// Use a backup timer to ensure button gets restored
		const restoreButton = () => {
			button.disabled = false;
			button.textContent = originalText;
			button.removeClass('nova-button-testing');
			button.addClass('nova-button-ready');
		};
		
		const backupTimer = this.timeoutManager.addTimeout(restoreButton, 12000); // 12 second backup
		
		try {
			// Check basic configuration first
			const hasConfig = this.hasProviderConfig(provider);
			if (!hasConfig) {
				throw new Error('Provider not configured - missing API key or settings');
			}

			// Set timeout for 10 seconds
			const timeoutPromise = new Promise<never>((_, reject) => {
				this.timeoutManager.addTimeout(() => reject(new Error('Connection timeout')), 10000);
			});

			// Test the connection using the plugin's provider system
			const testPromise = this.performRealConnectionTest(provider);
			
			await Promise.race([testPromise, timeoutPromise]);
			
			// Update provider status to connected
			await this.updateProviderStatus(provider, 'connected', 'Connected successfully');
			this.setConnectionStatus(statusContainer, 'success', '● Connected');
			
			// For Ollama, if a model is configured, automatically select it
			if (provider === 'ollama' && this.plugin.settings.aiProviders.ollama.model) {
				const platform = Platform.isMobile ? 'mobile' : 'desktop';
				this.plugin.settings.platformSettings[platform].selectedModel = this.plugin.settings.aiProviders.ollama.model;
				await this.plugin.saveSettings();
			}
			
			// Emit event to notify sidebar of provider configuration
			document.dispatchEvent(new CustomEvent('nova-provider-configured', { 
				detail: { provider, status: 'connected' } 
			}));
			
		} catch (error: any) {
			Logger.error(`Connection test failed for ${provider}:`, error);
			let errorMessage = 'Connection failed';
			
			if (error.message === 'Connection timeout') {
				errorMessage = 'Timeout';
			} else if (provider === 'ollama') {
				// Check if URL is actually configured
				const ollamaUrl = this.plugin.settings.aiProviders.ollama.baseUrl;
				if (!ollamaUrl || ollamaUrl.trim() === '') {
					errorMessage = 'No URL configured';
				} else {
					errorMessage = 'Connection failed';
				}
			} else if (error.message?.includes('401') || error.message?.includes('unauthorized') || error.message?.includes('API key')) {
				errorMessage = 'Invalid API key';
			} else if (error.message?.includes('429')) {
				errorMessage = 'Rate limited';
			} else if (error.message?.includes('quota')) {
				errorMessage = 'Quota exceeded';
			} else if (error.message?.includes('not configured') || error.message?.includes('missing')) {
				errorMessage = 'Not configured';
			} else {
				errorMessage = 'Connection failed';
			}
			
			// Update provider status to error
			await this.updateProviderStatus(provider, 'error', errorMessage);
			this.setConnectionStatus(statusContainer, 'error', `● ${errorMessage}`);
			
			// Emit event to notify sidebar that provider has failed
			document.dispatchEvent(new CustomEvent('nova-provider-disconnected', { 
				detail: { provider, status: 'error', message: errorMessage } 
			}));
		} finally {
			// Clear backup timer and restore button
			this.timeoutManager.removeTimeout(backupTimer);
			restoreButton();
		}
	}

	private async updateProviderStatus(provider: 'claude' | 'openai' | 'google' | 'ollama', status: 'connected' | 'error' | 'not-configured' | 'untested' | 'testing', message?: string): Promise<void> {
		if (!this.plugin.settings.aiProviders[provider].status) {
			this.plugin.settings.aiProviders[provider].status = {
				state: status,
				message,
				lastChecked: status === 'testing' ? null : new Date()
			};
		} else {
			this.plugin.settings.aiProviders[provider].status = {
				state: status,
				message,
				lastChecked: status === 'testing' ? null : new Date()
			};
		}
		
		await this.plugin.saveSettings();
		
		// Refresh the status indicators if needed
		this.refreshProviderStatusIndicators();
	}

	private refreshProviderStatusIndicators(): void {
		// Find all provider status containers and update them
		const containers = this.containerEl.querySelectorAll('.nova-provider-status-container');
		containers.forEach(container => {
			const provider = container.getAttribute('data-provider') as 'claude' | 'openai' | 'google' | 'ollama';
			if (provider) {
				this.updateProviderStatusDisplay(container as HTMLElement, provider);
			}
		});
	}

	private updateProviderStatusDisplay(container: HTMLElement, provider: 'claude' | 'openai' | 'google' | 'ollama'): void {
		const status = this.getProviderStatus(provider);
		const statusEl = container.querySelector('.nova-provider-status');
		
		if (statusEl) {
			statusEl.className = `nova-provider-status ${status.state}`;
			const textEl = statusEl.querySelector('.nova-status-text');
			if (textEl) {
				textEl.textContent = this.getStatusDisplayText(status);
			}
			
			// Update tooltip
			let tooltip = statusEl.querySelector('.nova-status-tooltip');
			if (status.lastChecked || status.message) {
				if (!tooltip) {
					tooltip = statusEl.createDiv({ cls: 'nova-status-tooltip' });
				}
				tooltip.empty();
				
				if (status.lastChecked) {
					const timeEl = tooltip.createDiv({ cls: 'nova-status-time' });
					const date = status.lastChecked instanceof Date ? status.lastChecked : new Date(status.lastChecked);
					timeEl.textContent = `Last checked: ${date.toLocaleDateString()}`;
				}
				if (status.message) {
					const messageEl = tooltip.createDiv({ cls: 'nova-status-message' });
					messageEl.textContent = status.message;
				}
			} else if (tooltip) {
				tooltip.remove();
			}
		}
	}

	private async performRealConnectionTest(provider: 'claude' | 'openai' | 'google' | 'ollama'): Promise<void> {
		// Test the provider classes directly
		switch (provider) {
			case 'claude': {
				const claudeProvider = new ClaudeProvider(this.plugin.settings.aiProviders.claude, this.plugin.settings.general);
				// For Claude, just test a minimal completion instead of getAvailableModels
				await claudeProvider.complete('You are a helpful assistant.', 'Hi', { maxTokens: 1 });
				break;
			}
			case 'openai': {
				const openaiProvider = new OpenAIProvider(this.plugin.settings.aiProviders.openai, this.plugin.settings.general);
				await openaiProvider.getAvailableModels();
				break;
			}
			case 'google': {
				const googleProvider = new GoogleProvider(this.plugin.settings.aiProviders.google, this.plugin.settings.general);
				await googleProvider.getAvailableModels();
				break;
			}
			case 'ollama': {
				const ollamaProvider = new OllamaProvider(this.plugin.settings.aiProviders.ollama, this.plugin.settings.general);
				// Ollama doesn't have getAvailableModels, check connection with isAvailable
				const isAvailable = await ollamaProvider.isAvailable();
				if (!isAvailable) {
					throw new Error('Ollama connection failed');
				}
				break;
			}
		}
	}

	private setConnectionStatus(container: HTMLElement, type: 'success' | 'error' | 'testing' | 'none', message: string): void {
		container.empty();
		
		if (type === 'none') return;
		
		const statusEl = container.createDiv({ cls: `nova-status-indicator ${type}` });
		statusEl.textContent = message;
	}

	private updateConnectionStatus(container: HTMLElement, provider: 'claude' | 'openai' | 'google' | 'ollama'): void {
		// Check if provider has required configuration
		const hasConfig = this.hasProviderConfig(provider);
		
		if (!hasConfig) {
			this.setConnectionStatus(container, 'none', '');
		} else {
			// Don't show anything initially - let user test when ready
			this.setConnectionStatus(container, 'none', '');
		}
	}

	private hasProviderConfig(provider: 'claude' | 'openai' | 'google' | 'ollama'): boolean {
		switch (provider) {
			case 'claude': 
				return !!this.plugin.settings.aiProviders.claude.apiKey;
			case 'openai': 
				return !!this.plugin.settings.aiProviders.openai.apiKey;
			case 'google': 
				return !!this.plugin.settings.aiProviders.google.apiKey;
			case 'ollama': 
				return !!this.plugin.settings.aiProviders.ollama.baseUrl;
			default: 
				return false;
		}
	}

	private createLicenseSettings(containerEl = this.containerEl) {
		const licenseContainer = containerEl.createDiv({ cls: 'nova-license-section' });
		new Setting(licenseContainer).setName('Supernova supporter status').setHeading();

		// Info about the new model
		const infoEl = licenseContainer.createDiv({ cls: 'nova-model-info' });
		const infoCard = infoEl.createDiv({ cls: 'nova-info-card compact' });
		const infoText = infoCard.createEl('p');
		infoText.textContent = 'Nova provides all features for free when you use your own AI provider API keys. Supernova supporters get early access to new features.';

		// Current Supernova status
		const isSupernova = this.plugin.featureManager?.isSupernovaSupporter() || false;
		const supernovaLicense = this.plugin.featureManager?.getSupernovaLicense();
		
		const statusDisplay = licenseContainer.createDiv({ cls: 'nova-supernova-status' });
		const badge = this.getLicenseBadge(supernovaLicense);
		const statusText = badge?.text || (isSupernova ? 'Supernova supporter' : 'Nova user');
		
		// Create status badge element
		const statusBadge = statusDisplay.createDiv({ 
			cls: `nova-status-badge ${badge?.className || (isSupernova ? 'supernova' : 'nova')}` 
		});
		
		// Set custom style if badge has colors
		if (badge) {
			statusBadge.addClass('nova-badge-custom');
			statusBadge.setCssProps({ '--badge-color': badge.color });
		}
		
		// Create status icon
		const statusIcon = statusBadge.createSpan({ cls: 'status-icon' });
		if (badge && badge.icon) {
			// Badge icons are emoji strings, use textContent
			statusIcon.textContent = badge.icon;
		} else if (isSupernova) {
			// Use Obsidian's registered supernova icon
			statusIcon.classList.add('nova-supernova-icon');
			setIcon(statusIcon, 'nova-supernova');
		} else {
			// Use Obsidian's registered Nova icon
			statusIcon.classList.add('nova-icon');
			setIcon(statusIcon, 'nova-star');
		}
		
		// Create status name
		statusBadge.createSpan({ cls: 'status-name', text: statusText });

		// Supernova license status
		if (supernovaLicense) {
			const statusEl = licenseContainer.createDiv({ cls: 'nova-license-status' });
			const expiryText = supernovaLicense.expiresAt 
				? `Expires: ${supernovaLicense.expiresAt.toLocaleDateString()}`
				: 'Lifetime support';
			const licenseInfo = statusEl.createDiv({ cls: 'license-info' });
			licenseInfo.createSpan({ cls: 'license-email', text: supernovaLicense.email });
			licenseInfo.createSpan({ cls: 'license-expiry', text: expiryText });
		}

		// Supernova license key input using secure input pattern
		this.createSecureApiKeyInput(licenseContainer, {
			name: 'Supernova license key (optional)',
			desc: 'Enter your Supernova supporter license key for early access to new features',
			placeholder: 'Enter Supernova license key...',
			value: this.plugin.settings.licensing.supernovaLicenseKey || '',
			onChange: async (value) => {
				this.plugin.settings.licensing.supernovaLicenseKey = value;
				await this.plugin.saveSettings();
				
				// Update Supernova license in feature manager
				if (this.plugin.featureManager) {
					await this.plugin.featureManager.updateSupernovaLicense(value || null);
					
					// Fire event for sidebar to update Supernova features
					document.dispatchEvent(new CustomEvent('nova-license-updated', { 
						detail: { 
							hasLicense: this.plugin.featureManager.isSupernovaSupporter(),
							licenseKey: value,
							action: 'change'
						} 
					}));
					
					// Refresh the content to show updated status
					this.updateTabContent();
				}
			}
		});

		// Add validation button separately
		new Setting(licenseContainer)
			.setDesc('Validate your Supernova license key')
			.addButton(button => {
				button.setButtonText('Validate license')
					.onClick(async () => {
						const licenseKey = this.plugin.settings.licensing.supernovaLicenseKey;
						if (!licenseKey) {
							this.showLicenseMessage('Please enter a Supernova license key first.', 'error');
							return;
						}

						button.setButtonText('Validating...');
						button.disabled = true;

						try {
							if (this.plugin.featureManager) {
								await this.plugin.featureManager.updateSupernovaLicense(licenseKey);
								const isSupernova = this.plugin.featureManager.isSupernovaSupporter();
								
								if (isSupernova) {
									this.showLicenseMessage('Valid Supernova license! You now have early access to new features.', 'success');
									// Confetti animation removed
								} else {
									this.showLicenseMessage('Invalid or expired Supernova license key.', 'error');
								}
								
								// Dispatch license update event
								document.dispatchEvent(new CustomEvent('nova-license-updated', { 
									detail: { 
										hasLicense: isSupernova,
										licenseKey: licenseKey,
										action: 'validate'
									} 
								}));
								
								// Refresh content 
								this.updateTabContent();
							}
						} catch (error) {
							this.showLicenseMessage('Error validating Supernova license.', 'error');
						} finally {
							button.setButtonText('Validate license');
							button.disabled = false;
						}
					});
			});

		// Supernova supporter information only
		this.createSupernovaInfo(licenseContainer);
	}

	private createSupernovaInfo(container: HTMLElement) {
		// Supernova supporter information
		const supernovaInfo = container.createDiv({ cls: 'nova-supernova-info' });
		const infoCard = supernovaInfo.createDiv({ cls: 'nova-info-card' });
		infoCard.createEl('h5', { text: 'Become a Supernova Supporter' });
		const description = infoCard.createEl('p');
		description.textContent = 'Support Nova development and get early access to new features. All features eventually become free for everyone.';
		
		const featuresList = infoCard.createEl('ul');
		const features = [
			'Early access to new features (3-6 months before general release)',
			'Priority support and feature requests',
			'Supporter badge and recognition',
			'Directly support open-source development'
		];
		
		features.forEach(feature => {
			featuresList.createEl('li', { text: feature });
		});
	}

	private createDebugSettings(container: HTMLElement) {
		const debugContainer = container.createDiv({ cls: 'nova-debug-section' });
		new Setting(debugContainer).setName('Development').setHeading();

		new Setting(debugContainer)
			.setName('Debug mode')
			.setDesc('Enable development testing features')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.licensing.debugSettings.enabled)
				.onChange(async (value) => {
					this.plugin.settings.licensing.debugSettings.enabled = value;
					await this.plugin.saveSettings();
					
					if (this.plugin.featureManager) {
						this.plugin.featureManager.updateDebugSettings(this.plugin.settings.licensing.debugSettings);
					}
					
					// Dispatch event to update UI components
					document.dispatchEvent(new CustomEvent('nova-license-updated', { 
						detail: { 
							hasLicense: this.plugin.featureManager.isSupernovaSupporter(),
							licenseKey: this.plugin.settings.licensing.supernovaLicenseKey,
							action: 'debug-mode-toggle'
						} 
					}));
					
					// Refresh display to show/hide debug options
					this.display();
				}));

		if (this.plugin.settings.licensing.debugSettings.enabled) {
			new Setting(debugContainer)
				.setName('Override date')
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
						
						// Dispatch event to update UI components
						document.dispatchEvent(new CustomEvent('nova-license-updated', { 
							detail: { 
								hasLicense: this.plugin.featureManager.isSupernovaSupporter(),
								licenseKey: this.plugin.settings.licensing.supernovaLicenseKey,
								action: 'debug-date-override'
							} 
						}));
						
						// Don't refresh display on every keystroke - just update the feature manager
					}));

			new Setting(debugContainer)
				.setName('Force supernova status')
				.setDesc('Override Supernova supporter status for testing')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.licensing.debugSettings.forceSupernova || false)
					.onChange(async (value) => {
						this.plugin.settings.licensing.debugSettings.forceSupernova = value;
						await this.plugin.saveSettings();
						
						if (this.plugin.featureManager) {
							this.plugin.featureManager.updateDebugSettings(this.plugin.settings.licensing.debugSettings);
						}
						
						// Confetti animation removed when turning ON Force Supernova
						if (value) {
							// Confetti animation removed
						}
						
						// Dispatch license update event
						document.dispatchEvent(new CustomEvent('nova-license-updated', { 
							detail: { 
								hasLicense: this.plugin.featureManager.isSupernovaSupporter(),
								licenseKey: this.plugin.settings.licensing.supernovaLicenseKey,
								action: 'debug-toggle'
							} 
						}));
						
						// Refresh content to show updated feature status
						this.updateTabContent();
					}));

			// Clear licenses button
			new Setting(debugContainer)
				.setName('Clear all licenses')
				.setDesc('Remove all applied licenses (for testing)')
				.addButton(button => button
					.setButtonText('Clear licenses')
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

						// Dispatch license update event
						document.dispatchEvent(new CustomEvent('nova-license-updated', { 
							detail: { 
								hasLicense: false,
								licenseKey: '',
								action: 'clear'
							} 
						}));

						// Show success message
						this.showLicenseMessage('All licenses cleared successfully.', 'success');

						// Refresh content
						this.updateTabContent();
					}));
		}
	}

	private showLicenseMessage(message: string, type: 'success' | 'error') {
		// Uses DOM elements instead of Notice API per Obsidian compliance guidelines:
		// "Use proper UI elements, not Notice API for license messages"
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
		this.timeoutManager.addTimeout(() => {
			messageEl.remove();
		}, 5000);
	}


	private createGeneralSettings(containerEl = this.containerEl) {
		// Core Settings section with clean header
		const coreSection = containerEl.createDiv({ cls: 'nova-core-settings-section' });
		new Setting(coreSection)
			.setName('Core')
			.setHeading();
		
		// Section spacing handled by CSS class

		new Setting(coreSection)
			.setName('Default temperature')
			.setDesc('Controls randomness in AI responses (0.0 = focused, 1.0 = creative)')
			.addSlider(slider => slider
				.setLimits(0, 1, 0.1)
				.setValue(this.plugin.settings.general.defaultTemperature)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.general.defaultTemperature = value;
					await this.plugin.saveSettings();
				}));

		new Setting(coreSection)
			.setName('Default max tokens')
			.setDesc('Maximum length of AI responses (1000-10000 tokens)')
			.addSlider(slider => slider
				.setLimits(1000, 10000, 500)
				.setValue(this.plugin.settings.general.defaultMaxTokens)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.general.defaultMaxTokens = value;
					await this.plugin.saveSettings();
				}));

	}

	private createProviderSettings(containerEl = this.containerEl) {
		// Configure Your API Keys Section
		const apiKeysSection = containerEl.createDiv({ cls: 'nova-api-keys-section' });
		new Setting(apiKeysSection)
			.setName('Configure your API keys')
			.setHeading();
		
		const infoEl = apiKeysSection.createDiv({ cls: 'nova-provider-info' });
		// Basic info card
		const basicInfoCard = infoEl.createDiv({ cls: 'nova-info-card' });
		const basicInfo1 = basicInfoCard.createEl('p');
		basicInfo1.textContent = 'Nova connects to AI providers using your own API keys. All providers are available to all users - just add your API keys below to get started.';
		
		const basicInfo2 = basicInfoCard.createEl('p');
		basicInfo2.createEl('strong', { text: 'Model selection:' });
		basicInfo2.appendText(' After connecting successfully, select models for any provider using the dropdown in the Nova sidebar.');
		
		// Model guidance card
		const guidanceCard = infoEl.createDiv({ cls: 'nova-info-card nova-model-guidance' });
		guidanceCard.createEl('h4', { text: 'Recommended defaults' });
		
		const recommendationsList = guidanceCard.createEl('ul', { cls: 'nova-model-recommendations' });
		const recommendations = [
			{ model: 'Claude Sonnet 4', desc: ' - Latest generation with excellent instruction following for collaborative editing' },
			{ model: 'GPT-4.1 Mini', desc: ' - Current-generation model that outperforms GPT-4o while remaining cost-effective' },
			{ model: 'Gemini 2.5 Flash', desc: ' - Best price/performance with "thinking" capabilities and strong coding support' },
			{ model: 'Ollama (Local)', desc: ' - Complete privacy with local processing - requires setup but keeps all data on your device' }
		];
		
		recommendations.forEach(rec => {
			const li = recommendationsList.createEl('li');
			li.createEl('strong', { text: rec.model });
			li.appendText(rec.desc);
		});
		
		const guidanceNote = guidanceCard.createEl('p', { cls: 'nova-guidance-note' });
		guidanceNote.textContent = 'Cloud options offer modern AI capabilities without premium pricing, while local options provide complete privacy.';

		// Configuration Subsection (within API Keys section)
		const configSection = apiKeysSection.createDiv({ cls: 'nova-provider-config-section' });
		new Setting(configSection).setName('Setup').setHeading();
		configSection.createEl('hr', { cls: 'nova-section-divider' });

		// Show all providers - no restrictions
		this.createOllamaSettings(configSection);
		this.createClaudeSettings(configSection);
		this.createGoogleSettings(configSection);
		this.createOpenAISettings(configSection);
	}

	private createClaudeSettings(containerEl = this.containerEl) {
		
		const claudeContainer = containerEl.createDiv({ cls: 'nova-provider-section' });
		
		// Provider header with status indicator
		const headerContainer = claudeContainer.createDiv({ cls: 'nova-provider-header' });
		const titleEl = headerContainer.createEl('h4', { text: 'Claude (Anthropic)' });
		
		// Add status indicator to the same h4 element
		const statusContainer = this.createProviderStatusIndicator(titleEl, 'claude');
		statusContainer.setAttribute('data-provider', 'claude');

		this.createSecureApiKeyInput(claudeContainer, {
			name: 'API Key',
			desc: 'Your Anthropic API key',
			placeholder: 'sk-ant-...',
			value: this.plugin.settings.aiProviders.claude.apiKey || '',
			onChange: async (value) => {
				this.plugin.settings.aiProviders.claude.apiKey = value;
				await this.plugin.saveSettings();
			}
		});

		// Test Connection button
		this.createTestConnectionButton(claudeContainer, 'claude');

	}



	private createOpenAISettings(containerEl = this.containerEl) {
		
		const openaiContainer = containerEl.createDiv({ cls: 'nova-provider-section' });
		
		// Provider header with status indicator
		const headerContainer = openaiContainer.createDiv({ cls: 'nova-provider-header' });
		const titleEl = headerContainer.createEl('h4', { text: 'ChatGPT (OpenAI)' });
		
		// Add status indicator to the same h4 element
		const statusContainer = this.createProviderStatusIndicator(titleEl, 'openai');
		statusContainer.setAttribute('data-provider', 'openai');

		this.createSecureApiKeyInput(openaiContainer, {
			name: 'API Key',
			desc: 'Your OpenAI API key',
			placeholder: 'sk-...',
			value: this.plugin.settings.aiProviders.openai.apiKey || '',
			onChange: async (value) => {
				this.plugin.settings.aiProviders.openai.apiKey = value;
				await this.plugin.saveSettings();
			}
		});

		// Test Connection button
		this.createTestConnectionButton(openaiContainer, 'openai');

	}


	private createGoogleSettings(containerEl = this.containerEl) {
		
		const googleContainer = containerEl.createDiv({ cls: 'nova-provider-section' });
		
		// Provider header with status indicator
		const headerContainer = googleContainer.createDiv({ cls: 'nova-provider-header' });
		const titleEl = headerContainer.createEl('h4', { text: 'Google (Gemini)' });
		
		// Add status indicator to the same h4 element
		const statusContainer = this.createProviderStatusIndicator(titleEl, 'google');
		statusContainer.setAttribute('data-provider', 'google');

		this.createSecureApiKeyInput(googleContainer, {
			name: 'API Key',
			desc: 'Your Google AI API key',
			placeholder: 'AI...',
			value: this.plugin.settings.aiProviders.google.apiKey || '',
			onChange: async (value) => {
				this.plugin.settings.aiProviders.google.apiKey = value;
				await this.plugin.saveSettings();
			}
		});

		// Test Connection button
		this.createTestConnectionButton(googleContainer, 'google');

	}


	private createOllamaSettings(containerEl = this.containerEl) {
		const ollamaContainer = containerEl.createDiv({ cls: 'nova-provider-section' });
		
		// Provider header with status indicator
		const headerContainer = ollamaContainer.createDiv({ cls: 'nova-provider-header' });
		const titleEl = headerContainer.createEl('h4', { text: 'Ollama (Local)' });
		
		// Add status indicator to the same h4 element
		const statusContainer = this.createProviderStatusIndicator(titleEl, 'ollama');
		statusContainer.setAttribute('data-provider', 'ollama');

		new Setting(ollamaContainer)
			.setName('Base URL')
			.setDesc('Ollama server URL')
			.addText(text => {
				text.inputEl.addClass('nova-api-input-medium');
				return text
					.setPlaceholder('http://localhost:11434')
					.setValue(this.plugin.settings.aiProviders.ollama.baseUrl || '')
					.onChange(async (value) => {
						this.plugin.settings.aiProviders.ollama.baseUrl = value;
						await this.plugin.saveSettings();
					});
			});

		// Test Connection button
		this.createTestConnectionButton(ollamaContainer, 'ollama');

		new Setting(ollamaContainer)
			.setName('Model')
			.setDesc('Ollama model to use')
			.addText(text => {
				text.inputEl.addClass('nova-api-input-small');
				return text
					.setPlaceholder('llama2')
					.setValue(this.plugin.settings.aiProviders.ollama.model || '')
					.onChange(async (value) => {
						this.plugin.settings.aiProviders.ollama.model = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(ollamaContainer)
			.setName('Default context limit')
			.setDesc('Context window size for all Ollama models (Nova defaults to 32K vs Ollama\'s 2K)')
			.addText(text => {
				text.inputEl.type = 'number';
				text.inputEl.addClass('nova-api-input-tiny');
				return text
					.setPlaceholder('32000')
					.setValue((this.plugin.settings.aiProviders.ollama?.contextSize || 32000).toString())
					.onChange(async (value) => {
					const numValue = parseInt(value);
					if (!isNaN(numValue) && numValue > 0) {
						this.plugin.settings.aiProviders.ollama.contextSize = numValue;
						await this.plugin.saveSettings();
						
						// Trigger UI update for token count display
						document.dispatchEvent(new CustomEvent('nova-provider-configured', { 
							detail: { provider: 'ollama', status: 'connected' } 
						}));
					}
				});
			});
	}

	private createPlatformSettings(containerEl = this.containerEl) {
		new Setting(containerEl)
			.setName('Platform')
			.setHeading();
		
		// Info about platform settings
		const infoEl = containerEl.createDiv({ cls: 'nova-platform-info' });
		const infoCard = infoEl.createDiv({ cls: 'nova-info-card' });
		infoCard.createEl('h4', { text: '🖥️ Platform setup' });
		const infoText = infoCard.createEl('p');
		infoText.textContent = 'Configure which AI provider to use as your primary provider on different platforms. Nova works seamlessly across desktop and mobile with all providers.';
		
		// Platform settings managed via sidebar dropdown now

		new Setting(containerEl)
			.setName('Model selection')
			.setDesc('Models are now selected using the dropdown in the Nova sidebar. Each platform (desktop/mobile) remembers its selected model independently.');
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

	async setCurrentModel(modelId: string): Promise<void> {
		const platform = Platform.isMobile ? 'mobile' : 'desktop';
		this.plugin.settings.platformSettings[platform].selectedModel = modelId;
		
		// Update the provider manager with new settings
		if (this.plugin.aiProviderManager) {
			this.plugin.aiProviderManager.updateSettings(this.plugin.settings);
		}
	}

	private createCommandSettings(containerEl = this.containerEl) {
		new Setting(containerEl)
			.setName('Custom commands')
			.setHeading();

		// Feature availability check
		if (!this.plugin.featureManager.isFeatureEnabled('commands')) {
			const noticeEl = containerEl.createDiv({ cls: 'nova-feature-notice' });
			const noticeDiv = noticeEl.createDiv({ cls: 'nova-feature-card' });
			
			const title = noticeDiv.createEl('h4', { cls: 'nova-feature-title' });
			title.textContent = 'Supernova supporter feature';
			
			const description = noticeDiv.createEl('p', { cls: 'nova-feature-description' });
			description.textContent = 'Custom commands are currently available to Supernova supporters. They will be available to all users on ';
			description.createEl('strong', { text: 'October 1, 2025' });
			description.appendText('.');
			return;
		}

		// Description
		const descEl = containerEl.createDiv({ cls: 'nova-command-description' });
		const descP = descEl.createEl('p');
		descP.textContent = 'Create custom command shortcuts that insert predefined text templates when triggered with ';
		descP.createEl('code', { text: ':trigger' });
		descP.appendText('.');

		// Show Command Button setting (Supernova-only, Mobile-only)
		new Setting(containerEl)
			.setName('Show command button in chat (mobile)')
			.setDesc('Show the Commands button beside the Send button for mobile quick access to Nova commands and selection actions')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.features?.commands?.showCommandButton ?? true)
			.onChange(async (value) => {
				if (!this.plugin.settings.features) this.plugin.settings.features = {};
				if (!this.plugin.settings.features.commands) this.plugin.settings.features.commands = { customCommands: [], showCommandButton: true };
				this.plugin.settings.features.commands.showCommandButton = value;
					await this.plugin.saveSettings();
					
					// Find and refresh sidebar view
					const leaves = this.plugin.app.workspace.getLeavesOfType(VIEW_TYPE_NOVA_SIDEBAR);
					if (leaves.length > 0) {
						const view = leaves[0].view;
						// Use instanceof check for consistency
						if (view instanceof NovaSidebarView) {
							view.refreshCommandButton();
						}
					}
				}));

		// Add new command button at the top
		const buttonEl = containerEl.createDiv({ cls: 'nova-add-command' });
		buttonEl.addClass('nova-custom-section-button');
		
		new Setting(buttonEl)
			.addButton(button => 
				button
					.setButtonText('+ Add custom command')
					.setCta()
					.onClick(() => this.showAddCommandDialog())
			);

		// Commands list
		this.renderCustomCommandsList(containerEl);
	}

	private renderCustomCommandsList(container: HTMLElement) {
		// Clear existing commands list
		const existingList = container.querySelector('.nova-commands-list');
		if (existingList) existingList.remove();

		const commandsList = container.createDiv({ cls: 'nova-commands-list' });
		const commands = this.plugin.settings.features?.commands?.customCommands || [];

		if (commands.length === 0) {
			const emptyEl = commandsList.createDiv({ cls: 'nova-commands-empty' });
			const emptyDiv = emptyEl.createDiv({ cls: 'nova-empty-container' });
			
			emptyDiv.createEl('p', { text: 'No custom commands yet.' });
			const helpText = emptyDiv.createEl('p', { cls: 'nova-empty-help' });
			helpText.textContent = 'Create your first command to get started!';
			return;
		}

		commands.forEach((command, index) => {
			const commandEl = commandsList.createDiv({ cls: 'nova-command-item' });

			// Command header
			const headerEl = commandEl.createDiv({ cls: 'nova-command-header' });

			const infoEl = headerEl.createDiv({ cls: 'nova-command-info' });
			
			const nameEl = infoEl.createDiv({ cls: 'nova-command-name' });
			nameEl.textContent = command.name;

			const triggerEl = infoEl.createDiv({ cls: 'nova-command-trigger' });
			triggerEl.createEl('code', { text: `:${command.trigger}` });

			// Actions
			const actionsEl = headerEl.createDiv({ cls: 'nova-command-actions' });

			const editBtn = actionsEl.createEl('button', { text: 'Edit' });
			editBtn.addClass('nova-command-edit-btn');
			editBtn.onclick = () => this.showEditCommandDialog(index);

			const deleteBtn = actionsEl.createEl('button', { text: 'Delete' });
			deleteBtn.addClass('nova-command-delete-btn');
			deleteBtn.onclick = () => this.deleteCommand(index);

			// Description and template preview
			if (command.description) {
				const descEl = commandEl.createDiv({ cls: 'nova-command-desc' });
				descEl.textContent = command.description;
				descEl.addClass('nova-command-description');
			}

			const templateEl = commandEl.createDiv({ cls: 'nova-command-template' });
			const templateDiv = templateEl.createDiv({ cls: 'nova-template-container' });
			templateDiv.textContent = command.template;
		});
	}

	private showAddCommandDialog() {
		this.showCommandDialog();
	}

	private showEditCommandDialog(index: number) {
		const command = this.plugin.settings.features?.commands?.customCommands?.[index];
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
			if (!this.plugin.settings.features) this.plugin.settings.features = {};
			if (!this.plugin.settings.features.commands) this.plugin.settings.features.commands = { customCommands: [], showCommandButton: true };
			this.plugin.settings.features.commands.customCommands[editIndex] = result;
		} else {
			// Add new command
			if (!this.plugin.settings.features) this.plugin.settings.features = {};
			if (!this.plugin.settings.features.commands) this.plugin.settings.features.commands = { customCommands: [], showCommandButton: true };
			this.plugin.settings.features.commands.customCommands.push(result);
		}
		
		this.plugin.saveSettings();
		this.renderCustomCommandsList(this.containerEl.querySelector('.nova-command-section') as HTMLElement);
	}

	private deleteCommand(index: number) {
		if (!this.plugin.settings.features?.commands?.customCommands) return;
		
		const command = this.plugin.settings.features.commands.customCommands[index];
		const confirmed = confirm(`Delete command "${command.name}" (${command.trigger})?`);
		
		if (confirmed) {
			this.plugin.settings.features.commands.customCommands.splice(index, 1);
			this.plugin.saveSettings();
			this.renderCustomCommandsList(this.containerEl.querySelector('.nova-command-section') as HTMLElement);
		}
	}

	private createWelcomeSection(container: HTMLElement): void {
		const welcomeSection = container.createDiv({ cls: 'nova-welcome-section' });
		
		// Nova logo and title
		const headerDiv = welcomeSection.createDiv({ cls: 'nova-welcome-header' });
		const logoDiv = headerDiv.createDiv({ cls: 'nova-welcome-logo' });
		// Use Obsidian's registered Nova icon for welcome logo
		setIcon(logoDiv, 'nova-star');
		
		const contentDiv = headerDiv.createDiv({ cls: 'nova-welcome-content' });
		// Remove redundant top-level heading as context is already clear in settings tab
		contentDiv.createEl('p', { cls: 'nova-tagline', text: 'Your AI writing partner to make the writing process smoother' });
		contentDiv.createEl('p', { cls: 'nova-story', text: 'Removes the friction of copy/paste from LLMs to Obsidian, and provides actionable insights to help improve your writing' });
	}

	private createQuickStartGuide(container: HTMLElement): void {
		const guideSection = container.createDiv({ cls: 'nova-quick-start-section nova-guide-section' });
		
		// Selection-Based Editing
		const selectionCard = guideSection.createDiv({ cls: 'nova-quick-start-card' });
		const selectionHeader = selectionCard.createDiv({ cls: 'nova-card-header' });
		selectionHeader.createSpan({ cls: 'nova-card-icon', text: '🎯' });
		selectionHeader.createEl('h4', { text: 'Selection-based editing' });
		
		const selectionContent = selectionCard.createDiv({ cls: 'nova-card-content' });
		const selectionSteps = selectionContent.createEl('ol');
		const steps = [
			'Select any text in your document',
			'Right-click to open context menu',
			'Choose Nova action (Improve Writing, Make Longer)',
			'Watch AI transform text exactly in place'
		];
		steps.forEach(step => selectionSteps.createEl('li', { text: step }));
		
		selectionContent.createDiv({ cls: 'nova-tip', text: '💡 Tip: Select any text in your document and right-click to see Nova actions' });

		// Chat Commands
		const chatCard = guideSection.createDiv({ cls: 'nova-quick-start-card nova-chat-card' });
		const chatHeader = chatCard.createDiv({ cls: 'nova-card-header' });
		chatHeader.createSpan({ cls: 'nova-card-icon', text: '💬' });
		chatHeader.createEl('h4', { text: 'Chat-based targeting' });
		
		const chatContent = chatCard.createDiv({ cls: 'nova-card-content' });
		const chatSteps = chatContent.createEl('ol');
		const chatStepsList = [
			'Place cursor where you want content',
			'Type command: "Add conclusion section"',
			'Nova edits precisely at cursor location'
		];
		chatStepsList.forEach(step => chatSteps.createEl('li', { text: step }));
		
		chatContent.createDiv({ cls: 'nova-tip', text: '📱 Works identically on desktop and mobile' });

		// AI Provider Selection
		const providerCard = guideSection.createDiv({ cls: 'nova-quick-start-card nova-provider-card' });
		const providerHeader = providerCard.createDiv({ cls: 'nova-card-header' });
		providerHeader.createSpan({ cls: 'nova-card-icon', text: '🤖' });
		providerHeader.createEl('h4', { text: 'AI provider selection' });
		
		const providerContent = providerCard.createDiv({ cls: 'nova-card-content' });
		providerContent.createEl('p', { text: 'Choose the right AI for your task:' });
		
		const providerList = providerContent.createEl('ul');
		const providers = [
			{ name: 'Claude', desc: ' - For complex reasoning and analysis' },
			{ name: 'OpenAI', desc: ' - For balanced performance and creativity' },
			{ name: 'Gemini', desc: ' - For fast responses and research' },
			{ name: 'Ollama', desc: ' - For local privacy and offline use 🔒' }
		];
		providers.forEach(provider => {
			const li = providerList.createEl('li');
			li.createEl('strong', { text: provider.name });
			li.appendText(provider.desc);
		});
		
		providerContent.createDiv({ cls: 'nova-tip', text: 'Configure providers in the AI Providers tab' });
	}


	/**
	 * Get badge information for license type
	 */
	private getLicenseBadge(license: SupernovaLicense | null): { icon: string; color: string; text: string; className: string } | null {
		if (!license) return null;
		
		switch(license.type) {
			case 'founding':
				return { 
					icon: '⭐', 
					color: '#fdcb6e',
					text: 'Founding Supernova',
					className: 'founding'
				};
			case 'lifetime':
				return { 
					icon: '🚀', 
					color: '#9333ea',
					text: 'Lifetime Supernova',
					className: 'lifetime'
				};
			case 'annual':
				return { 
					icon: '🚀', 
					color: '#3b82f6',
					text: 'Annual Supernova',
					className: 'supernova'
				};
			default:
				return null;
		}
	}

	private getCurrentLicense(): SupernovaLicense | null {
		return this.plugin.featureManager?.getSupernovaLicense() || null;
	}

	private createSupernovaLicenseInput(container: HTMLElement): void {
		// Current Supernova status
		// const isSupernova = this.plugin.featureManager?.isSupernovaSupporter() || false;
		const supernovaLicense = this.plugin.featureManager?.getSupernovaLicense();
		
		// Status display
		if (supernovaLicense) {
			const badge = this.getLicenseBadge(supernovaLicense);
			const statusEl = container.createDiv({ cls: 'nova-license-status' });
			const expiryText = supernovaLicense.expiresAt 
				? `Expires ${supernovaLicense.expiresAt.toLocaleDateString()}`
				: 'Lifetime License';
			const validatedDiv = statusEl.createDiv({ cls: 'nova-license-validated' });
			
			// License header
			const headerDiv = validatedDiv.createDiv({ cls: 'nova-license-header' });
			headerDiv.createSpan({ cls: 'nova-license-checkmark', text: '✓' });
			headerDiv.createSpan({ cls: 'nova-license-title', text: badge?.text || 'Valid Supernova License' });
			
			if (badge) {
				const badgeSpan = headerDiv.createSpan({ cls: `nova-license-badge ${badge.className} nova-badge-custom`, text: badge.icon });
				badgeSpan.setCssProps({
					'--badge-color': badge.color,
					'--badge-background': badge.color
				});
			}
			
			// License details
			const detailsDiv = validatedDiv.createDiv({ cls: 'nova-license-details' });
			
			const emailDiv = detailsDiv.createDiv({ cls: 'nova-license-email' });
			emailDiv.createSpan({ cls: 'nova-license-label', text: 'Licensed to:' });
			emailDiv.createSpan({ cls: 'nova-license-value', text: supernovaLicense.email });
			
			const expiryDiv = detailsDiv.createDiv({ cls: 'nova-license-expiry' });
			expiryDiv.createSpan({ cls: 'nova-license-label', text: 'Status:' });
			expiryDiv.createSpan({ cls: 'nova-license-value', text: expiryText });
		}

		// License key input - styled like API keys
		this.createSecureApiKeyInput(container, {
			name: 'License Key',
			desc: 'Enter your Supernova supporter license key',
			placeholder: 'NOVA-XXXX-XXXX-XXXX',
			value: this.plugin.settings.licensing.supernovaLicenseKey || '',
			onChange: async (value) => {
				this.plugin.settings.licensing.supernovaLicenseKey = value;
				await this.plugin.saveSettings();
				
				// Update Supernova license in feature manager
				if (this.plugin.featureManager) {
					await this.plugin.featureManager.updateSupernovaLicense(value || null);
					
					// Fire event for sidebar to update Supernova features
					document.dispatchEvent(new CustomEvent('nova-license-updated', { 
						detail: { 
							hasLicense: this.plugin.featureManager.isSupernovaSupporter(),
							licenseKey: value,
							action: 'change'
						} 
					}));
					
					// Refresh the content to show updated status
					this.updateTabContent();
				}
			}
		});

		// Add validation status message if needed
		const validationEl = container.createDiv({ cls: 'nova-validation-status' });
		validationEl.addClass('nova-validation-element');
	}

	private createSupernovaCTA(container: HTMLElement, options: {
		showOnlyIfNotSupporter?: boolean;
		buttonAction?: 'tab' | 'direct';
		showLearnMore?: boolean;
		marginTop?: string;
		marginBottom?: string;
	} = {}): void {
		// Default options
		const {
			showOnlyIfNotSupporter = false,
			buttonAction = 'tab',
			showLearnMore = true,
			marginTop = '0',
			marginBottom = '32px'
		} = options;
		
		// Check supporter status
		const isSupernova = this.plugin.featureManager?.isSupernovaSupporter() || false;
		
		// Don't render if user is already a supporter and we only want to show for non-supporters
		if (showOnlyIfNotSupporter && isSupernova) {
			return;
		}
		
		// Get license-specific badge information
		const currentLicense = this.getCurrentLicense();
		const badgeInfo = this.getLicenseBadge(currentLicense);
		
		const statusText = badgeInfo ? badgeInfo.text : 'Nova User';
		const statusIcon = badgeInfo ? badgeInfo.icon : '✨';
		
		// Create the CTA section
		const ctaSection = container.createDiv({ cls: 'nova-prominent-supernova-section' });
		// Apply dynamic margin class based on size
		if (marginTop === '32px' && marginBottom === '24px') {
			ctaSection.addClass('nova-cta-section-large');
		} else if (marginTop === '24px' && marginBottom === '16px') {
			ctaSection.addClass('nova-cta-section-medium');
		} else {
			ctaSection.addClass('nova-cta-section-small');
		}
		
		const ctaDiv = ctaSection.createDiv({ cls: 'nova-supernova-cta' });
		
		// Header section
		const headerDiv = ctaDiv.createDiv({ cls: 'nova-supernova-header' });
		const iconSpan = headerDiv.createSpan({ cls: 'nova-supernova-icon' });
		iconSpan.textContent = statusIcon; // statusIcon is an emoji string from badge.icon
		
		const infoDiv = headerDiv.createDiv({ cls: 'nova-supernova-info' });
		infoDiv.createEl('h3', { text: 'Supernova Support' });
		const statusP = infoDiv.createEl('p');
		statusP.textContent = 'Status: ';
		statusP.createEl('strong', { text: statusText });
		
		// Actions section
		const actionsDiv = ctaDiv.createDiv({ cls: 'nova-supernova-actions' });
		const primaryBtn = actionsDiv.createEl('button', { cls: 'nova-supernova-btn primary' });
		if (buttonAction === 'tab') {
			primaryBtn.setAttribute('data-tab', 'supernova');
		}
		primaryBtn.textContent = isSupernova ? (buttonAction === 'tab' ? 'Manage License' : 'Thank You for Supporting!') : 'Become a Supporter';
		
		if (showLearnMore) {
			const secondaryBtn = actionsDiv.createEl('button', { cls: 'nova-supernova-btn secondary' });
			secondaryBtn.setAttribute('data-tab', 'supernova');
			secondaryBtn.textContent = 'Learn More';
		}
		
		// Add click handlers if using tab navigation
		if (buttonAction === 'tab') {
			ctaSection.querySelectorAll('[data-tab="supernova"]').forEach(button => {
				this.registerEventListener(button as HTMLElement, 'click', (e: Event) => {
					e.preventDefault();
					this.switchTab('supernova');
				});
			});
		}

		// Add click handler for direct action "Become a Supporter" button
		if (buttonAction === 'direct' && !isSupernova) {
			const supporterBtn = primaryBtn;
			this.registerEventListener(supporterBtn, 'click', (e: Event) => {
				e.preventDefault();
				window.open('https://novawriter.ai/plans', '_blank');
			});
		}
	}

	private createNavigationHelp(container: HTMLElement): void {
		const navSection = container.createDiv({ cls: 'nova-navigation-section nova-nav-section' });
		
		const navCard = navSection.createDiv({ cls: 'nova-navigation-card' });
		// Header section
		const headerDiv = navCard.createDiv({ cls: 'nova-card-header' });
		headerDiv.createSpan({ cls: 'nova-card-icon', text: '⚡' });
		headerDiv.createEl('h4', { text: 'Quick start' });
		
		// Content section
		const contentDiv = navCard.createDiv({ cls: 'nova-card-content' });
		const stepsDiv = contentDiv.createDiv({ cls: 'nova-next-steps' });
		
		// Step items
		const steps = [
			{ text: '1. Explore privacy and general', link: '→ Go to General tab', tab: 'general' },
			{ text: '2. Configure AI providers', link: '→ Go to AI providers tab', tab: 'providers' },
			{ text: '3. Manage Supernova license', link: '→ Go to Supernova tab', tab: 'supernova' },
			{ text: '4. Explore the user guide', link: '→ Open user guide ↗', href: 'https://novawriter.ai/guide.html', external: true }
		];
		
		steps.forEach(step => {
			const stepDiv = stepsDiv.createDiv({ cls: 'nova-next-step' });
			stepDiv.createSpan({ text: step.text });
			
			const linkEl = stepDiv.createEl('a', { 
				cls: step.external ? 'nova-step-link nova-external-link' : 'nova-step-link',
				text: step.link,
				href: step.href || '#'
			});
			
			if (step.tab) {
				linkEl.setAttribute('data-tab', step.tab);
			}
			if (step.external) {
				linkEl.setAttribute('target', '_blank');
			}
		});
		
		contentDiv.createDiv({ cls: 'nova-tip', text: '💡 Tip: Press Cmd+P (Mac) or Ctrl+P (PC), then choose "Open sidebar" to access Nova' });

		// Add click handlers for navigation links
		navCard.querySelectorAll('.nova-step-link').forEach(link => {
			this.registerEventListener(link as HTMLElement, 'click', (e: Event) => {
				// Only prevent default for internal navigation links, not external links
				if (!(e.target as HTMLElement).classList.contains('nova-external-link')) {
					e.preventDefault();
					const tabId = (e.target as HTMLElement).getAttribute('data-tab') as 'general' | 'providers' | 'supernova';
					this.switchTab(tabId);
				}
				// External links will use default browser behavior (target="_blank")
			});
		});
	}

	/**
	 * Clean up event listeners when settings tab is closed
	 */
	cleanup(): void {
		this.timeoutManager.clearAll();
		// Event listeners are cleaned up automatically by PluginSettingTab
	}
}