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
			model: 'gemini-2.5-flash',
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
		this.createPlatformSettings();
		this.createProviderSettings();
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
				.addOption('gemini-2.5-flash', 'Gemini 2.5 Flash')
				.addOption('gemini-2.5-pro', 'Gemini 2.5 Pro')
				.addOption('gemini-pro', 'Gemini Pro')
				.addOption('gemini-pro-vision', 'Gemini Pro Vision')
				.setValue(this.plugin.settings.aiProviders.google.model || 'gemini-2.5-flash')
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