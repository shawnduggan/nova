import { App, PluginSettingTab, Setting } from 'obsidian';
import NovaPlugin from '../main';
import { AIProviderSettings, PlatformSettings, ProviderType } from './ai/types';

export interface NovaSettings {
	aiProviders: AIProviderSettings;
	platformSettings: PlatformSettings;
	general: {
		defaultTemperature: number;
		defaultMaxTokens: number;
		autoSave: boolean;
	};
}

export const DEFAULT_SETTINGS: NovaSettings = {
	aiProviders: {
		claude: {
			enabled: false,
			apiKey: '',
			model: 'claude-3-haiku-20240307',
			temperature: 0.7,
			maxTokens: 1000
		},
		openai: {
			enabled: false,
			apiKey: '',
			baseUrl: 'https://api.openai.com/v1',
			model: 'gpt-3.5-turbo',
			temperature: 0.7,
			maxTokens: 1000
		},
		google: {
			enabled: false,
			apiKey: '',
			model: 'gemini-pro',
			temperature: 0.7,
			maxTokens: 1000
		},
		ollama: {
			enabled: false,
			baseUrl: 'http://localhost:11434',
			model: 'llama2',
			temperature: 0.7,
			maxTokens: 1000
		}
	},
	platformSettings: {
		desktop: {
			primaryProvider: 'claude',
			fallbackProviders: ['openai', 'google', 'ollama']
		},
		mobile: {
			primaryProvider: 'claude',
			fallbackProviders: ['openai', 'google']
		}
	},
	general: {
		defaultTemperature: 0.7,
		defaultMaxTokens: 1000,
		autoSave: true
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

		this.createGeneralSettings();
		this.createProviderSettings();
		this.createPlatformSettings();
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

		this.createClaudeSettings();
		this.createOpenAISettings();
		this.createGoogleSettings();
		this.createOllamaSettings();
	}

	private createClaudeSettings() {
		const { containerEl } = this;
		const claudeContainer = containerEl.createDiv({ cls: 'nova-provider-section' });
		claudeContainer.createEl('h4', { text: 'Claude (Anthropic)' });

		new Setting(claudeContainer)
			.setName('Enable Claude')
			.setDesc('Use Claude for AI responses')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.aiProviders.claude.enabled)
				.onChange(async (value) => {
					this.plugin.settings.aiProviders.claude.enabled = value;
					await this.plugin.saveSettings();
				}));

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
				.addOption('claude-3-haiku-20240307', 'Claude 3 Haiku')
				.addOption('claude-3-sonnet-20240229', 'Claude 3 Sonnet')
				.addOption('claude-3-opus-20240229', 'Claude 3 Opus')
				.setValue(this.plugin.settings.aiProviders.claude.model || 'claude-3-haiku-20240307')
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
			.setName('Enable OpenAI')
			.setDesc('Use OpenAI for AI responses')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.aiProviders.openai.enabled)
				.onChange(async (value) => {
					this.plugin.settings.aiProviders.openai.enabled = value;
					await this.plugin.saveSettings();
				}));

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
				.addOption('gpt-3.5-turbo', 'GPT-3.5 Turbo')
				.addOption('gpt-4', 'GPT-4')
				.addOption('gpt-4-turbo-preview', 'GPT-4 Turbo')
				.setValue(this.plugin.settings.aiProviders.openai.model || 'gpt-3.5-turbo')
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
			.setName('Enable Google')
			.setDesc('Use Google Gemini for AI responses')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.aiProviders.google.enabled)
				.onChange(async (value) => {
					this.plugin.settings.aiProviders.google.enabled = value;
					await this.plugin.saveSettings();
				}));

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
				.addOption('gemini-pro', 'Gemini Pro')
				.addOption('gemini-pro-vision', 'Gemini Pro Vision')
				.setValue(this.plugin.settings.aiProviders.google.model || 'gemini-pro')
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
			.setName('Enable Ollama')
			.setDesc('Use local Ollama for AI responses')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.aiProviders.ollama.enabled)
				.onChange(async (value) => {
					this.plugin.settings.aiProviders.ollama.enabled = value;
					await this.plugin.saveSettings();
				}));

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
				.onChange(async (value: ProviderType) => {
					this.plugin.settings.platformSettings.desktop.primaryProvider = value;
					await this.plugin.saveSettings();
				}));

		platformContainer.createEl('h4', { text: 'Mobile' });
		new Setting(platformContainer)
			.setName('Primary Provider')
			.setDesc('Primary AI provider for mobile')
			.addDropdown(dropdown => dropdown
				.addOption('claude', 'Claude')
				.addOption('openai', 'OpenAI')
				.addOption('google', 'Google')
				.setValue(this.plugin.settings.platformSettings.mobile.primaryProvider)
				.onChange(async (value: ProviderType) => {
					this.plugin.settings.platformSettings.mobile.primaryProvider = value;
					await this.plugin.saveSettings();
				}));
	}
}