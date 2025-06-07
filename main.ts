import { Plugin, WorkspaceLeaf, ItemView, addIcon } from 'obsidian';
import { NovaSettings, NovaSettingTab, DEFAULT_SETTINGS } from './src/settings';
import { AIProviderManager } from './src/ai/provider-manager';
import { NovaSidebarView, VIEW_TYPE_NOVA_SIDEBAR } from './src/ui/sidebar-view';

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

export default class NovaPlugin extends Plugin {
	settings!: NovaSettings;
	aiProviderManager!: AIProviderManager;

	async onload() {
		try {
			console.log('Nova: onload starting...');
			await this.loadSettings();
			console.log('Nova: settings loaded');

			// Register custom icon
			addIcon('nova-star', NOVA_ICON_SVG);
			console.log('Nova: icon registered');

			this.aiProviderManager = new AIProviderManager(this.settings);
			await this.aiProviderManager.initialize();
			console.log('Nova: AI provider manager initialized');

			this.registerView(
				VIEW_TYPE_NOVA_SIDEBAR,
				(leaf) => new NovaSidebarView(leaf, this)
			);
			console.log('Nova: view registered');

			const ribbonIcon = this.addRibbonIcon('nova-star', 'Nova AI', (evt: MouseEvent) => {
				this.activateView();
			});
			console.log('Nova: ribbon icon added');
			console.log('Nova: ribbon icon element:', ribbonIcon);
			console.log('Nova: ribbon icon innerHTML:', ribbonIcon.innerHTML);
			console.log('Nova: ribbon icon classList:', ribbonIcon.classList.toString());

			this.addCommand({
				id: 'open-nova-sidebar',
				name: 'Open Nova sidebar',
				callback: () => {
					this.activateView();
				}
			});
			console.log('Nova: command added');

			this.addSettingTab(new NovaSettingTab(this.app, this));
			console.log('Nova: settings tab added');
			console.log('Nova: onload completed successfully');
		} catch (error) {
			console.error('Nova: Error in onload:', error);
		}
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