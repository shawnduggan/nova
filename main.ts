import { Plugin, WorkspaceLeaf, ItemView } from 'obsidian';
import { NovaSettings, NovaSettingTab, DEFAULT_SETTINGS } from './src/settings';
import { AIProviderManager } from './src/ai/provider-manager';
import { NovaSidebarView, VIEW_TYPE_NOVA_SIDEBAR } from './src/ui/sidebar-view';

export default class NovaPlugin extends Plugin {
	settings!: NovaSettings;
	aiProviderManager!: AIProviderManager;

	async onload() {
		await this.loadSettings();

		this.aiProviderManager = new AIProviderManager(this.settings);
		await this.aiProviderManager.initialize();

		this.registerView(
			VIEW_TYPE_NOVA_SIDEBAR,
			(leaf) => new NovaSidebarView(leaf, this)
		);

		this.addRibbonIcon('bot', 'Nova AI', (evt: MouseEvent) => {
			this.activateView();
		});

		this.addCommand({
			id: 'open-nova-sidebar',
			name: 'Open Nova sidebar',
			callback: () => {
				this.activateView();
			}
		});

		this.addSettingTab(new NovaSettingTab(this.app, this));
	}

	onunload() {
		this.aiProviderManager?.cleanup();
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.aiProviderManager?.updateSettings(this.settings);
	}

	async activateView() {
		const { workspace } = this.app;

		let leaf: WorkspaceLeaf | null;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_NOVA_SIDEBAR);

		if (leaves.length > 0) {
			leaf = leaves[0];
		} else {
			leaf = workspace.getRightLeaf(false);
			await leaf?.setViewState({ type: VIEW_TYPE_NOVA_SIDEBAR, active: true });
		}

		workspace.revealLeaf(leaf!);
	}
}