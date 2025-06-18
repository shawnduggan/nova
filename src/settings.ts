import { App, PluginSettingTab, Setting, Platform } from 'obsidian';
import NovaPlugin from '../main';
import { AIProviderSettings, PlatformSettings, ProviderType } from './ai/types';
import { DebugSettings } from './licensing/types';
import { VIEW_TYPE_NOVA_SIDEBAR, NovaSidebarView } from './ui/sidebar-view';
import { getAvailableModels } from './ai/models';
import { ClaudeProvider } from './ai/providers/claude';
import { OpenAIProvider } from './ai/providers/openai';
import { GoogleProvider } from './ai/providers/google';
import { OllamaProvider } from './ai/providers/ollama';

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
	providerStatus?: {
		[key: string]: {
			status: 'connected' | 'error' | 'not-configured' | 'untested' | 'testing';
			message?: string;
			lastChecked?: Date | string | null;
		};
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
	},
	providerStatus: {}
};

export class NovaSettingTab extends PluginSettingTab {
	plugin: NovaPlugin;
	private activeTab: 'getting-started' | 'general' | 'providers' | 'supernova' | 'debug' = 'getting-started';

	constructor(app: App, plugin: NovaPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl('h2', { text: 'Nova Settings' });

		this.createTabNavigation();
		this.createTabContent();
	}

	private createTabNavigation(): void {
		const tabContainer = this.containerEl.createDiv({ cls: 'nova-tab-container' });
		
		const tabs = [
			{ id: 'getting-started', label: 'Getting Started' },
			{ id: 'general', label: 'General' },
			{ id: 'providers', label: 'AI Providers' },
			{ id: 'supernova', label: 'Supernova' }
		];

		// Add Debug tab only for debug builds
		if (process.env.NODE_ENV === 'development' || this.plugin.settings.licensing.debugSettings.enabled) {
			tabs.push({ id: 'debug', label: 'Debug' });
		}

		tabs.forEach(tab => {
			const tabEl = tabContainer.createDiv({ 
				cls: `nova-tab ${this.activeTab === tab.id ? 'active' : ''}`,
				text: tab.label
			});
			
			tabEl.addEventListener('click', () => {
				this.switchTab(tab.id as 'getting-started' | 'general' | 'providers' | 'supernova' | 'debug');
			});
		});
	}

	private switchTab(tabId: 'getting-started' | 'general' | 'providers' | 'supernova' | 'debug'): void {
		this.activeTab = tabId;
		this.display(); // Re-render with new active tab
	}

	private createTabContent(): void {
		const contentContainer = this.containerEl.createDiv({ cls: 'nova-tab-content' });
		
		switch (this.activeTab) {
			case 'getting-started':
				this.createGettingStartedTabContent(contentContainer);
				break;
			case 'general':
				this.createGeneralTabContent(contentContainer);
				break;
			case 'providers':
				this.createProvidersTabContent(contentContainer);
				break;
			case 'supernova':
				this.createSupernovaTabContent(contentContainer);
				break;
			case 'debug':
				this.createDebugTabContent(contentContainer);
				break;
		}
	}

	private createGeneralTabContent(container: HTMLElement): void {
		// Show supporter CTA only if not already a supporter
		this.createSupernovaCTA(container, { 
			showOnlyIfNotSupporter: true,
			buttonAction: 'tab',
			showLearnMore: false
		});
		
		this.createGeneralSettings(container);
		this.createPrivacySettings(container);
	}

	private createProvidersTabContent(container: HTMLElement): void {
		// Show supporter CTA only if not already a supporter
		this.createSupernovaCTA(container, { 
			showOnlyIfNotSupporter: true,
			buttonAction: 'tab',
			showLearnMore: false
		});
		
		this.createProviderSettings(container);
	}


	private createGettingStartedTabContent(container: HTMLElement): void {
		this.createWelcomeSection(container);
		this.createCompactSupernovaSection(container);
		this.createQuickStartGuide(container);
		this.createNavigationHelp(container);
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
		benefitsSection.style.marginTop = '32px';
		benefitsSection.createEl('h3', { text: 'Supernova Benefits' });
		benefitsSection.createEl('hr', { cls: 'nova-section-divider' });
		
		const benefitsContent = benefitsSection.createDiv({ cls: 'nova-benefits-content' });
		benefitsContent.innerHTML = `
			<p style="margin-bottom: 20px;">Support Nova development and get early access to new features. All features eventually become free for everyone.</p>
			
			<div class="nova-benefits-list">
				<div class="nova-benefit-item">
					<span class="nova-benefit-icon">⚡</span>
					<div class="nova-benefit-content">
						<strong>Early Access</strong>
						<span>Get new features 2-4 months before general release</span>
					</div>
				</div>
				<div class="nova-benefit-item">
					<span class="nova-benefit-icon">💬</span>
					<div class="nova-benefit-content">
						<strong>Priority Support</strong>
						<span>Direct access to developers for feature requests and bug reports</span>
					</div>
				</div>
				<div class="nova-benefit-item">
					<span class="nova-benefit-icon">🗳️</span>
					<div class="nova-benefit-content">
						<strong>Vote on Features</strong>
						<span>Help shape Nova's development and future direction</span>
					</div>
				</div>
				<div class="nova-benefit-item">
					<span class="nova-benefit-icon">🏆</span>
					<div class="nova-benefit-content">
						<strong>Supporter Badge</strong>
						<span>Recognition in the Nova community (coming soon)</span>
					</div>
				</div>
				<div class="nova-benefit-item">
					<span class="nova-benefit-icon">❤️</span>
					<div class="nova-benefit-content">
						<strong>Open Source Support</strong>
						<span>Directly fund continued development of Nova</span>
					</div>
				</div>
			</div>
			
			<p style="margin-top: 20px; font-size: 0.9em; color: var(--text-muted);">Your support keeps Nova free and open source for everyone.</p>
		`;
		
		// License settings section - styled like API keys
		const licenseSection = container.createDiv({ cls: 'nova-provider-section' });
		licenseSection.style.marginTop = '32px';
		licenseSection.createEl('h3', { text: 'License Management' });
		
		this.createSupernovaLicenseInput(licenseSection);
	}

	private createDebugTabContent(container: HTMLElement): void {
		// Debug Settings Section
		const debugSection = container.createDiv({ cls: 'nova-debug-section' });
		debugSection.createEl('h3', { text: 'Debug Settings' });
		debugSection.createEl('hr', { cls: 'nova-section-divider' });
		
		const infoEl = debugSection.createDiv({ cls: 'nova-debug-info' });
		infoEl.innerHTML = `
			<div class="nova-info-card">
				<p>Debug settings for development and testing. These options help developers troubleshoot issues and test new features.</p>
			</div>
			<div class="nova-info-card">
				<h4>⚠️ Developer Settings</h4>
				<ul class="nova-debug-features">
					<li><strong>Debug Mode</strong> - Enable detailed logging and development features</li>
					<li><strong>Override Date</strong> - Test time-sensitive features with custom dates</li>
					<li><strong>Force Supernova</strong> - Test Supernova-only features without a license</li>
				</ul>
				<p class="nova-debug-note">Only modify these settings if you understand their purpose.</p>
			</div>
		`;
		
		this.createDebugSettings(debugSection);
	}

	private createPrivacySettings(container: HTMLElement): void {
		// Privacy & Platform Section
		const privacySection = container.createDiv({ cls: 'nova-privacy-section' });
		privacySection.createEl('h3', { text: 'Privacy & Platform Settings' });
		privacySection.createEl('hr', { cls: 'nova-section-divider' });
		
		const infoEl = privacySection.createDiv({ cls: 'nova-privacy-info' });
		infoEl.innerHTML = `
			<div class="nova-info-card">
				<h4>🔒 Your Privacy Matters</h4>
				<p>Nova respects your privacy and gives you full control over how your data is handled. 
				All AI providers are accessed using your own API keys, so your content stays between you and your chosen AI service.</p>
			</div>
			<div class="nova-info-card">
				<h4>📱 Mobile Support</h4>
				<p>Mobile support is <strong>disabled by default</strong> to protect your privacy. 
				When enabled, Nova works seamlessly across desktop and mobile with cloud-based AI providers.</p>
				<ul class="nova-privacy-features">
					<li><strong>Local-first</strong> - Ollama and desktop-only providers keep everything on your device</li>
					<li><strong>Your choice</strong> - Enable mobile only when you need cross-device access</li>
					<li><strong>Same experience</strong> - Mobile provides the same editing capabilities as desktop</li>
				</ul>
			</div>
		`;
		
		// Mobile Support Toggle
		new Setting(privacySection)
			.setName('Enable Mobile Support')
			.setDesc('Allow Nova to work on mobile devices using cloud-based AI providers')
			.addToggle(toggle => {
				const currentMobileProvider = this.plugin.settings.platformSettings.mobile.primaryProvider;
				const isMobileEnabled = currentMobileProvider !== 'none';
				
				toggle
					.setValue(isMobileEnabled)
					.onChange(async (value) => {
						if (value) {
							// Enable mobile with Claude as default (most reliable)
							this.plugin.settings.platformSettings.mobile.primaryProvider = 'claude';
						} else {
							// Disable mobile
							this.plugin.settings.platformSettings.mobile.primaryProvider = 'none';
						}
						await this.plugin.saveSettings();
						if (this.plugin.aiProviderManager) {
							this.plugin.aiProviderManager.updateSettings(this.plugin.settings);
						}
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
			text.inputEl.style.fontFamily = 'var(--font-monospace)';
			text.inputEl.style.width = '400px';
			text.inputEl.style.height = '40px';
			text.inputEl.style.position = 'relative';
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
				inputContainer.style.position = 'relative';
				
				const toggleBtn = inputContainer.createEl('button', { cls: 'nova-toggle-btn' });
				toggleBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
					<circle cx="12" cy="12" r="3"/>
				</svg>`;

				toggleBtn.addEventListener('click', (e) => {
					e.preventDefault();
					isVisible = !isVisible;
					
					if (isVisible) {
						text.inputEl.type = 'text';
						text.setValue(actualValue);
						toggleBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="m9.88 9.88a3 3 0 1 0 4.24 4.24"/>
							<path d="m10.73 5.08a10.43 10.43 0 0 1 1.27-.08c7 0 11 8 11 8a13.16 13.16 0 0 1-1.67 2.68"/>
							<path d="M6.61 6.61A13.526 13.526 0 0 0 1 12s4 8 11 8a9.74 9.74 0 0 0 5.39-1.61"/>
							<line x1="2" y1="2" x2="22" y2="22"/>
						</svg>`;
					} else {
						text.inputEl.type = 'password';
						if (actualValue && actualValue.length > 12) {
							const masked = actualValue.slice(0, 8) + '••••••••••••••••••••••••' + actualValue.slice(-4);
							text.setValue(masked);
						} else {
							text.setValue(actualValue);
						}
						toggleBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
							<circle cx="12" cy="12" r="3"/>
						</svg>`;
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
			const statusEl = statusContainer.createDiv({ cls: `nova-provider-status ${status.status}` });
			
			// Status dot
			const dot = statusEl.createSpan({ cls: 'nova-status-dot' });
			
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
			console.error('Error creating provider status indicator:', error);
			// Fallback: create a simple status indicator
			const statusEl = statusContainer.createDiv({ cls: 'nova-provider-status untested' });
			const dot = statusEl.createSpan({ cls: 'nova-status-dot' });
			const text = statusEl.createSpan({ cls: 'nova-status-text' });
			text.textContent = 'Status unknown';
		}
		
		return statusContainer;
	}

	private getProviderStatus(provider: 'claude' | 'openai' | 'google' | 'ollama'): { status: string, message?: string, lastChecked?: Date | string | null } {
		try {
			const savedStatus = this.plugin.settings.providerStatus?.[provider];
			if (savedStatus) {
				return savedStatus;
			}
			
			// Determine initial status based on configuration
			const hasConfig = this.hasProviderConfig(provider);
			return {
				status: hasConfig ? 'untested' : 'not-configured',
				message: hasConfig ? 'Configuration not tested' : 'No API key configured',
				lastChecked: null
			};
		} catch (error) {
			console.error(`Error getting provider status for ${provider}:`, error);
			return {
				status: 'not-configured',
				message: 'Status unavailable',
				lastChecked: null
			};
		}
	}

	private getStatusDisplayText(status: { status: string, message?: string }): string {
		switch (status.status) {
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
			.setName('Connection Status')
			.setDesc('Test your API connection');

		// Create status indicator first (to the left)
		const statusContainer = setting.controlEl.createDiv({ cls: 'nova-connection-status-container' });
		
		setting.addButton(button => {
			button.setButtonText('Test Connection')
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
		
		console.log(`Starting connection test for ${provider}, button disabled: ${button.disabled}`);
		
		// Force enable and set initial state
		button.disabled = false;
		button.textContent = 'Testing...';
		button.style.opacity = '0.6';
		
		// Update provider status to testing
		await this.updateProviderStatus(provider, 'testing', 'Testing connection...');
		
		// Show testing status
		this.setConnectionStatus(statusContainer, 'testing', 'Testing...');
		
		// Use a backup timer to ensure button gets restored
		const restoreButton = () => {
			button.disabled = false;
			button.textContent = originalText;
			button.style.opacity = '1';
			console.log(`Button force-restored for ${provider}`);
		};
		
		const backupTimer = setTimeout(restoreButton, 12000); // 12 second backup
		
		try {
			// Check basic configuration first
			const hasConfig = this.hasProviderConfig(provider);
			if (!hasConfig) {
				throw new Error('Provider not configured - missing API key or settings');
			}

			// Set timeout for 10 seconds
			const timeoutPromise = new Promise<never>((_, reject) => {
				setTimeout(() => reject(new Error('Connection timeout')), 10000);
			});

			// Test the connection using the plugin's provider system
			const testPromise = this.performRealConnectionTest(provider);
			
			await Promise.race([testPromise, timeoutPromise]);
			
			// Update provider status to connected
			await this.updateProviderStatus(provider, 'connected', 'Connected successfully');
			this.setConnectionStatus(statusContainer, 'success', '● Connected');
			console.log(`Connection test successful for ${provider}`);
			
		} catch (error: any) {
			console.log(`Connection test failed for ${provider}:`, error);
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
		} finally {
			// Clear backup timer and restore button
			clearTimeout(backupTimer);
			restoreButton();
		}
	}

	private async updateProviderStatus(provider: 'claude' | 'openai' | 'google' | 'ollama', status: 'connected' | 'error' | 'not-configured' | 'untested' | 'testing', message?: string): Promise<void> {
		if (!this.plugin.settings.providerStatus) {
			this.plugin.settings.providerStatus = {};
		}
		
		this.plugin.settings.providerStatus[provider] = {
			status,
			message,
			lastChecked: status === 'testing' ? null : new Date()
		};
		
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
			statusEl.className = `nova-provider-status ${status.status}`;
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
		console.log(`Starting real connection test for ${provider}`);
		
		// Test the provider classes directly
		switch (provider) {
			case 'claude': {
				const claudeProvider = new ClaudeProvider(this.plugin.settings.aiProviders.claude);
				// For Claude, just test a minimal completion instead of getAvailableModels
				await claudeProvider.complete('You are a helpful assistant.', 'Hi', { maxTokens: 1 });
				break;
			}
			case 'openai': {
				const openaiProvider = new OpenAIProvider(this.plugin.settings.aiProviders.openai);
				await openaiProvider.getAvailableModels();
				break;
			}
			case 'google': {
				const googleProvider = new GoogleProvider(this.plugin.settings.aiProviders.google);
				await googleProvider.getAvailableModels();
				break;
			}
			case 'ollama': {
				const ollamaProvider = new OllamaProvider(this.plugin.settings.aiProviders.ollama);
				// Ollama doesn't have getAvailableModels, check connection with isAvailable
				const isAvailable = await ollamaProvider.isAvailable();
				if (!isAvailable) {
					throw new Error('Ollama connection failed');
				}
				break;
			}
		}
		console.log(`Connection test successful for ${provider}`);
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

		// Supernova license key input using secure input pattern
		this.createSecureApiKeyInput(licenseContainer, {
			name: 'Supernova License Key (Optional)',
			desc: 'Enter your Supernova supporter license key for early access to new features',
			placeholder: 'Enter Supernova license key...',
			value: this.plugin.settings.licensing.supernovaLicenseKey || '',
			onChange: async (value) => {
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
			}
		});

		// Add validation button separately
		const validateSetting = new Setting(licenseContainer)
			.setDesc('Validate your Supernova license key')
			.addButton(button => {
				button.setButtonText('Validate License')
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
							button.setButtonText('Validate License');
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

	private createGeneralSettings(containerEl = this.containerEl) {
		// Core Settings section with clean header
		const coreSection = containerEl.createDiv({ cls: 'nova-core-settings-section' });
		coreSection.createEl('h3', { text: 'Core Settings' });
		
		// Add section spacing per specification
		coreSection.style.marginBottom = '32px';

		new Setting(coreSection)
			.setName('Default Temperature')
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
			.setName('Default Max Tokens')
			.setDesc('Maximum length of AI responses (higher = longer responses)')
			.addText(text => {
				text.inputEl.type = 'number';
				text.inputEl.style.width = '150px';
				text.inputEl.style.height = '40px';
				return text
					.setPlaceholder('1000')
					.setValue(this.plugin.settings.general.defaultMaxTokens.toString())
					.onChange(async (value) => {
						const numValue = parseInt(value);
						if (!isNaN(numValue) && numValue > 0) {
							this.plugin.settings.general.defaultMaxTokens = numValue;
							await this.plugin.saveSettings();
						}
					});
			});

		new Setting(coreSection)
			.setName('Auto-save settings')
			.setDesc('Automatically save configuration changes')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.general.autoSave)
				.onChange(async (value) => {
					this.plugin.settings.general.autoSave = value;
					await this.plugin.saveSettings();
				}));

	}

	private createProviderSettings(containerEl = this.containerEl) {
		// Configure Your API Keys Section
		const apiKeysSection = containerEl.createDiv({ cls: 'nova-api-keys-section' });
		apiKeysSection.createEl('h3', { text: 'Configure Your API Keys' });
		apiKeysSection.createEl('hr', { cls: 'nova-section-divider' });
		
		const infoEl = apiKeysSection.createDiv({ cls: 'nova-provider-info' });
		infoEl.innerHTML = `
			<div class="nova-info-card">
				<p>Nova connects to AI providers using your own API keys. All providers are available to all users - 
				just add your API keys below to get started.</p>
			</div>
			<div class="nova-info-card nova-model-guidance">
				<h4>Recommended Defaults</h4>
				<ul class="nova-model-recommendations">
					<li><strong>Claude Sonnet 4</strong> - Latest generation with excellent instruction following for collaborative editing</li>
					<li><strong>GPT-4.1 Mini</strong> - Current-generation model that outperforms GPT-4o while remaining cost-effective</li>
					<li><strong>Gemini 2.5 Flash</strong> - Best price/performance with "thinking" capabilities and strong coding support</li>
				</ul>
				<p class="nova-guidance-note">These defaults offer modern AI capabilities without premium pricing.</p>
			</div>
		`;

		// Configuration Subsection (within API Keys section)
		const configSection = apiKeysSection.createDiv({ cls: 'nova-provider-config-section' });
		configSection.createEl('h4', { text: 'Configuration' });
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

		// Model setting with refresh button
		const modelSetting = new Setting(claudeContainer)
			.setName('Model')
			.setDesc('Claude model to use');

		let modelDropdown: any;
		
		modelSetting.addDropdown(dropdown => {
			modelDropdown = dropdown;
			dropdown.selectEl.style.width = '200px';
			dropdown.selectEl.style.height = '40px';
			this.populateClaudeModels(dropdown);
			return dropdown
				.setValue(this.plugin.settings.aiProviders.claude.model || 'claude-sonnet-4-20250514')
				.onChange(async (value) => {
					this.plugin.settings.aiProviders.claude.model = value;
					await this.plugin.saveSettings();
				});
		});

		// Claude models are hardcoded - no refresh needed
	}

	private populateClaudeModels(dropdown: any) {
		// Clear existing options
		dropdown.selectEl.empty();
		
		// Use centralized model definitions
		const currentModels = getAvailableModels('claude');

		currentModels.forEach(model => {
			dropdown.addOption(model.value, model.label);
		});
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

		// Model setting with refresh button
		const modelSetting = new Setting(openaiContainer)
			.setName('Model')
			.setDesc('OpenAI model to use');

		let modelDropdown: any;
		
		modelSetting.addDropdown(dropdown => {
			modelDropdown = dropdown;
			dropdown.selectEl.style.width = '200px';
			dropdown.selectEl.style.height = '40px';
			this.populateOpenAIModels(dropdown);
			return dropdown
				.setValue(this.plugin.settings.aiProviders.openai.model || 'gpt-4.1-mini-2025-04-14')
				.onChange(async (value) => {
					this.plugin.settings.aiProviders.openai.model = value;
					await this.plugin.saveSettings();
				});
		});

		// OpenAI models are hardcoded - no refresh needed
	}

	private populateOpenAIModels(dropdown: any) {
		// Clear existing options
		dropdown.selectEl.empty();
		
		// Use centralized model definitions
		const currentModels = getAvailableModels('openai');

		currentModels.forEach(model => {
			dropdown.addOption(model.value, model.label);
		});
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

		// Model setting with refresh button
		const modelSetting = new Setting(googleContainer)
			.setName('Model')
			.setDesc('Gemini model to use');

		let modelDropdown: any;
		
		modelSetting.addDropdown(dropdown => {
			modelDropdown = dropdown;
			dropdown.selectEl.style.width = '200px';
			dropdown.selectEl.style.height = '40px';
			this.populateGoogleModels(dropdown);
			return dropdown
				.setValue(this.plugin.settings.aiProviders.google.model || 'gemini-2.5-flash-preview-04-17')
				.onChange(async (value) => {
					this.plugin.settings.aiProviders.google.model = value;
					await this.plugin.saveSettings();
				});
		});

		// Google models are hardcoded - no refresh needed
	}

	private populateGoogleModels(dropdown: any) {
		// Clear existing options
		dropdown.selectEl.empty();
		
		// Use centralized model definitions
		const currentModels = getAvailableModels('google');

		currentModels.forEach(model => {
			dropdown.addOption(model.value, model.label);
		});
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
				text.inputEl.style.width = '350px';
				text.inputEl.style.height = '40px';
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
				text.inputEl.style.width = '200px';
				text.inputEl.style.height = '40px';
				return text
					.setPlaceholder('llama2')
					.setValue(this.plugin.settings.aiProviders.ollama.model || '')
					.onChange(async (value) => {
						this.plugin.settings.aiProviders.ollama.model = value;
						await this.plugin.saveSettings();
					});
			});
	}

	private createPlatformSettings(containerEl = this.containerEl) {
		containerEl.createEl('h3', { text: 'Platform Settings' });
		
		// Info about platform settings
		const infoEl = containerEl.createDiv({ cls: 'nova-platform-info' });
		infoEl.innerHTML = `
			<div class="nova-info-card">
				<h4>🖥️ Platform Configuration</h4>
				<p>Configure which AI provider to use as your primary provider on different platforms. 
				Nova works seamlessly across desktop and mobile with all providers.</p>
			</div>
		`;
		
		containerEl.createEl('h4', { text: 'Desktop' });
		const desktopDropdown = new Setting(containerEl)
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

		containerEl.createEl('h4', { text: 'Mobile' });
		const mobileSetting = new Setting(containerEl)
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

	private createCommandSettings(containerEl = this.containerEl) {
		containerEl.createEl('h3', { text: 'Custom Commands' });

		// Feature availability check
		if (!this.plugin.featureManager.isFeatureEnabled('commands')) {
			const noticeEl = containerEl.createDiv({ cls: 'nova-feature-notice' });
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
		const descEl = containerEl.createDiv({ cls: 'nova-command-description' });
		descEl.innerHTML = `
			<p style="color: var(--text-muted); margin-bottom: 16px;">
				Create custom command shortcuts that insert predefined text templates when triggered with <code>:trigger</code>.
			</p>
		`;

		// Show Command Button setting (Supernova-only, Mobile-only)
		new Setting(containerEl)
			.setName('Show Command Button in Chat (Mobile)')
			.setDesc('Show the Commands button beside the Send button for mobile quick access to Nova commands and selection actions')
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
		const buttonEl = containerEl.createDiv({ cls: 'nova-add-command' });
		buttonEl.style.cssText = 'margin-bottom: 16px;';
		
		new Setting(buttonEl)
			.addButton(button => 
				button
					.setButtonText('+ Add Custom Command')
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

	private createWelcomeSection(container: HTMLElement): void {
		const welcomeSection = container.createDiv({ cls: 'nova-welcome-section' });
		
		// Nova logo and title
		const headerDiv = welcomeSection.createDiv({ cls: 'nova-welcome-header' });
		headerDiv.innerHTML = `
			<div class="nova-welcome-logo">
				${NOVA_ICON_SVG}
			</div>
			<div class="nova-welcome-content">
				<h2>Welcome to Nova</h2>
				<p class="nova-tagline">Your AI writing partner to make the writing process smoother</p>
				<p class="nova-story">Removes the friction of copy/paste from LLMs to Obsidian, and provides actionable insights to help improve your writing</p>
			</div>
		`;
	}

	private createQuickStartGuide(container: HTMLElement): void {
		const guideSection = container.createDiv({ cls: 'nova-quick-start-section' });
		guideSection.style.marginTop = '32px';
		
		// Selection-Based Editing
		const selectionCard = guideSection.createDiv({ cls: 'nova-quick-start-card' });
		selectionCard.innerHTML = `
			<div class="nova-card-header">
				<span class="nova-card-icon">🎯</span>
				<h4>Selection-Based Editing</h4>
			</div>
			<div class="nova-card-content">
				<ol>
					<li>Select any text in your document</li>
					<li>Right-click to open context menu</li>
					<li>Choose Nova action (Improve Writing, Make Longer)</li>
					<li>Watch AI transform text exactly in place</li>
				</ol>
				<div class="nova-tip">💡 Tip: Select any text in your document and right-click to see Nova actions</div>
			</div>
		`;

		// Chat Commands
		const chatCard = guideSection.createDiv({ cls: 'nova-quick-start-card' });
		chatCard.style.marginTop = '24px';
		chatCard.innerHTML = `
			<div class="nova-card-header">
				<span class="nova-card-icon">💬</span>
				<h4>Chat-Based Targeting</h4>
			</div>
			<div class="nova-card-content">
				<ol>
					<li>Place cursor where you want content</li>
					<li>Type command: "Add conclusion section"</li>
					<li>Nova edits precisely at cursor location</li>
				</ol>
				<div class="nova-tip">📱 Works identically on desktop and mobile</div>
			</div>
		`;

		// AI Provider Selection
		const providerCard = guideSection.createDiv({ cls: 'nova-quick-start-card' });
		providerCard.style.marginTop = '24px';
		providerCard.innerHTML = `
			<div class="nova-card-header">
				<span class="nova-card-icon">🤖</span>
				<h4>AI Provider Selection</h4>
			</div>
			<div class="nova-card-content">
				<p>Choose the right AI for your task:</p>
				<ul>
					<li><strong>Claude</strong> - For complex reasoning and analysis</li>
					<li><strong>OpenAI</strong> - For balanced performance and creativity</li>
					<li><strong>Gemini</strong> - For fast responses and research</li>
					<li><strong>Ollama</strong> - For local privacy and offline use 🔒</li>
				</ul>
				<div class="nova-tip">Configure providers in the AI Providers tab</div>
			</div>
		`;
	}

	private createCompactSupernovaSection(container: HTMLElement): void {
		// Use the reusable CTA component
		this.createSupernovaCTA(container, {
			buttonAction: 'tab',
			showLearnMore: true,
			marginTop: '32px',
			marginBottom: '32px'
		});
	}

	private createSupernovaLicenseInput(container: HTMLElement): void {
		// Current Supernova status
		const isSupernova = this.plugin.featureManager?.isSupernovaSupporter() || false;
		const supernovaLicense = this.plugin.featureManager?.getSupernovaLicense();
		
		// Status display
		if (supernovaLicense) {
			const statusEl = container.createDiv({ cls: 'nova-license-status' });
			const expiryText = supernovaLicense.expiresAt 
				? `Expires: ${supernovaLicense.expiresAt.toLocaleDateString()}`
				: 'Lifetime Support';
			statusEl.innerHTML = `
				<div class="license-info" style="margin-bottom: 16px; padding: 12px; background: var(--background-modifier-form-field); border-radius: var(--radius-s);">
					<div style="display: flex; justify-content: space-between; align-items: center;">
						<span style="color: var(--text-normal);">${supernovaLicense.email}</span>
						<span style="color: var(--text-muted); font-size: 0.9em;">${expiryText}</span>
					</div>
				</div>
			`;
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
					
					// Refresh sidebar to update feature availability
					const leaves = this.plugin.app.workspace.getLeavesOfType(VIEW_TYPE_NOVA_SIDEBAR);
					if (leaves.length > 0) {
						const sidebarView = leaves[0].view as NovaSidebarView;
						sidebarView.refreshSupernovaUI();
					}
					
					// Refresh the display to show updated status
					this.display();
				}
			}
		});

		// Add validation status message if needed
		const validationEl = container.createDiv({ cls: 'nova-validation-status' });
		validationEl.style.marginTop = '8px';
		validationEl.style.fontSize = '0.9em';
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
		
		const statusText = isSupernova ? 'Supernova Supporter' : 'Nova User';
		const statusIcon = isSupernova ? '⭐' : '🌟';
		
		// Create the CTA section
		const ctaSection = container.createDiv({ cls: 'nova-prominent-supernova-section' });
		ctaSection.style.marginTop = marginTop;
		ctaSection.style.marginBottom = marginBottom;
		
		ctaSection.innerHTML = `
			<div class="nova-supernova-cta">
				<div class="nova-supernova-header">
					<span class="nova-supernova-icon">${statusIcon}</span>
					<div class="nova-supernova-info">
						<h3>Supernova Support</h3>
						<p>Status: <strong>${statusText}</strong></p>
					</div>
				</div>
				<div class="nova-supernova-actions">
					<button class="nova-supernova-btn primary" ${buttonAction === 'tab' ? 'data-tab="supernova"' : ''}>
						${isSupernova ? (buttonAction === 'tab' ? 'Manage License' : 'Thank You for Supporting!') : 'Become a Supporter'}
					</button>
					${showLearnMore ? '<button class="nova-supernova-btn secondary" data-tab="supernova">Learn More</button>' : ''}
				</div>
			</div>
		`;
		
		// Add click handlers if using tab navigation
		if (buttonAction === 'tab') {
			ctaSection.querySelectorAll('[data-tab="supernova"]').forEach(button => {
				button.addEventListener('click', (e) => {
					e.preventDefault();
					this.switchTab('supernova');
				});
			});
		}
	}

	private createNavigationHelp(container: HTMLElement): void {
		const navSection = container.createDiv({ cls: 'nova-navigation-section' });
		navSection.style.marginTop = '32px';
		
		const navCard = navSection.createDiv({ cls: 'nova-navigation-card' });
		navCard.innerHTML = `
			<div class="nova-card-header">
				<span class="nova-card-icon">📚</span>
				<h4>Next Steps</h4>
			</div>
			<div class="nova-card-content">
				<div class="nova-next-steps">
					<div class="nova-next-step">
						<span>1. Configure AI providers</span>
						<a href="#" class="nova-step-link" data-tab="providers">→ Go to AI Providers tab</a>
					</div>
					<div class="nova-next-step">
						<span>2. Explore Privacy and General Settings</span>
						<a href="#" class="nova-step-link" data-tab="general">→ Go to General tab</a>
					</div>
					<div class="nova-next-step">
						<span>3. Manage Supernova License</span>
						<a href="#" class="nova-step-link" data-tab="supernova">→ Go to Supernova tab</a>
					</div>
				</div>
			</div>
		`;

		// Add click handlers for navigation links
		navCard.querySelectorAll('.nova-step-link').forEach(link => {
			link.addEventListener('click', (e) => {
				e.preventDefault();
				const tabId = (e.target as HTMLElement).getAttribute('data-tab') as 'general' | 'providers' | 'supernova';
				this.switchTab(tabId);
			});
		});
	}
}