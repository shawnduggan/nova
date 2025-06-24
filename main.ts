import { Plugin, WorkspaceLeaf, ItemView, addIcon, Notice, Editor, MarkdownView, MarkdownFileInfo, Platform } from 'obsidian';
import { NovaSettings, NovaSettingTab, DEFAULT_SETTINGS } from './src/settings';
import { AIProviderManager } from './src/ai/provider-manager';
import { NovaSidebarView, VIEW_TYPE_NOVA_SIDEBAR } from './src/ui/sidebar-view';
import { DocumentEngine } from './src/core/document-engine';
import { ContextBuilder } from './src/core/context-builder';
import { CommandParser } from './src/core/command-parser';
import { PromptBuilder } from './src/core/prompt-builder';
import { ConversationManager } from './src/core/conversation-manager';
import { AddCommand } from './src/core/commands/add-command';
import { EditCommand } from './src/core/commands/edit-command';
import { DeleteCommand } from './src/core/commands/delete-command';
import { GrammarCommand } from './src/core/commands/grammar-command';
import { RewriteCommand } from './src/core/commands/rewrite-command';
import { MetadataCommand } from './src/core/commands/metadata-command';
import { FeatureManager } from './src/licensing/feature-manager';
import { LicenseValidator } from './src/licensing/license-validator';
import { NovaWikilinkAutocomplete } from './src/ui/wikilink-suggest';
import { SelectionContextMenu } from './src/ui/selection-context-menu';
import { TONE_OPTIONS } from './src/ui/tone-selection-modal';
import { AIIntentClassifier } from './src/core/ai-intent-classifier';
import { CryptoService } from './src/core/crypto-service';

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
	documentEngine!: DocumentEngine;
	contextBuilder!: ContextBuilder;
	commandParser!: CommandParser;
	promptBuilder!: PromptBuilder;
	conversationManager!: ConversationManager;
	aiIntentClassifier!: AIIntentClassifier;
	addCommandHandler!: AddCommand;
	editCommandHandler!: EditCommand;
	deleteCommandHandler!: DeleteCommand;
	grammarCommandHandler!: GrammarCommand;
	rewriteCommandHandler!: RewriteCommand;
	metadataCommandHandler!: MetadataCommand;
	featureManager!: FeatureManager;
	licenseValidator!: LicenseValidator;
	settingTab!: NovaSettingTab;
	sidebarView!: NovaSidebarView;
	selectionContextMenu!: SelectionContextMenu;

	async onload() {
		try {
			await this.loadSettings();


			// Initialize licensing system
			this.licenseValidator = new LicenseValidator();
			this.featureManager = new FeatureManager(
				this.licenseValidator,
				this.settings.licensing.debugSettings
			);
			
			// Update license from settings
			if (this.settings.licensing.licenseKey) {
				await this.featureManager.updateSupernovaLicense(this.settings.licensing.licenseKey);
			}

			// Refresh Supernova UI after license validation to handle expired licenses
			this.app.workspace.onLayoutReady(async () => {
				const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_NOVA_SIDEBAR);
				if (leaves.length > 0) {
					const sidebarView = leaves[0].view as NovaSidebarView;
					sidebarView.refreshSupernovaUI();
					// Update provider dropdown display to reflect loaded settings
					if ((sidebarView as any).currentProviderDropdown?.updateCurrentProvider) {
						try {
							(sidebarView as any).currentProviderDropdown.updateCurrentProvider();
						} catch (error) {
							console.error('❌ Failed to update provider dropdown on startup:', error);
						}
					}
				}
			});

			// Note: Mobile access restrictions are now handled in sidebar UI
			// This allows Core mobile users to see the upgrade interface rather than a broken plugin

			// Register custom icon
			addIcon('nova-star', NOVA_ICON_SVG);

			this.aiProviderManager = new AIProviderManager(this.settings, this.featureManager);
			await this.aiProviderManager.initialize();

			// Initialize conversation manager and document engine
			const dataStore = {
				loadData: (key: string) => this.loadDataWithKey(key),
				saveData: (key: string, data: any) => this.saveDataWithKey(key, data)
			};
			this.conversationManager = new ConversationManager(dataStore);
			this.documentEngine = new DocumentEngine(this.app, dataStore);
			this.documentEngine.setConversationManager(this.conversationManager);
			this.contextBuilder = new ContextBuilder(this.settings);
			this.commandParser = new CommandParser();
			this.promptBuilder = new PromptBuilder(this.documentEngine, this.conversationManager);
			this.aiIntentClassifier = new AIIntentClassifier(this.aiProviderManager);
			
			// Initialize command implementations
			this.addCommandHandler = new AddCommand(this.app, this.documentEngine, this.contextBuilder, this.aiProviderManager);
			this.editCommandHandler = new EditCommand(this.app, this.documentEngine, this.contextBuilder, this.aiProviderManager);
			this.deleteCommandHandler = new DeleteCommand(this.app, this.documentEngine, this.contextBuilder, this.aiProviderManager);
			this.grammarCommandHandler = new GrammarCommand(this.app, this.documentEngine, this.contextBuilder, this.aiProviderManager);
			this.rewriteCommandHandler = new RewriteCommand(this.app, this.documentEngine, this.contextBuilder, this.aiProviderManager);
			this.metadataCommandHandler = new MetadataCommand(this.app, this.documentEngine, this.contextBuilder, this.aiProviderManager);

			this.registerView(
				VIEW_TYPE_NOVA_SIDEBAR,
				(leaf) => new NovaSidebarView(leaf, this)
			);

			// Note: Wikilink autocomplete is now handled directly in sidebar view

			const ribbonIcon = this.addRibbonIcon('nova-star', 'Nova AI', (evt: MouseEvent) => {
				this.activateView();
			});

			// Register selection-based commands
			this.addCommand({
				id: 'nova-improve-writing',
				name: 'Improve Writing',
				editorCallback: async (editor: Editor) => {
					await this.handleSelectionCommand('improve', editor);
				}
			});

			this.addCommand({
				id: 'nova-make-longer',
				name: 'Make Longer',
				editorCallback: async (editor: Editor) => {
					await this.handleSelectionCommand('longer', editor);
				}
			});

			this.addCommand({
				id: 'nova-make-shorter',
				name: 'Make Shorter',
				editorCallback: async (editor: Editor) => {
					await this.handleSelectionCommand('shorter', editor);
				}
			});

			// Individual tone commands
			TONE_OPTIONS.forEach(tone => {
				this.addCommand({
					id: `nova-make-${tone.id}`,
					name: `Make ${tone.label}`,
					editorCallback: async (editor: Editor) => {
						await this.handleToneCommand(tone.id, editor);
					}
				});
			});

			this.addCommand({
				id: 'nova-tell-nova',
				name: 'Tell Nova...',
				editorCallback: async (editor: Editor) => {
					await this.handleSelectionCommand('custom', editor);
				}
			});

			this.addCommand({
				id: 'open-nova-sidebar',
				name: 'Open sidebar',
				callback: () => {
					this.activateView();
				}
			});

			// Initialize selection context menu
			this.selectionContextMenu = new SelectionContextMenu(this.app, this);
			this.selectionContextMenu.register();

			this.settingTab = new NovaSettingTab(this.app, this);
		this.addSettingTab(this.settingTab);
		} catch (error) {
		}
	}

	onunload() {
		this.aiProviderManager?.cleanup();
		this.conversationManager?.cleanup();
	}

	async loadSettings() {
		const savedData = await this.loadData();
		
		// Use Object.assign for top level, but manually merge platformSettings to preserve saved values
		this.settings = Object.assign({}, DEFAULT_SETTINGS, savedData);
		
		// Manually merge platformSettings to ensure saved model selections are preserved
		if (savedData?.platformSettings) {
			this.settings.platformSettings = {
				desktop: Object.assign({}, DEFAULT_SETTINGS.platformSettings.desktop, savedData.platformSettings.desktop || {}),
				mobile: Object.assign({}, DEFAULT_SETTINGS.platformSettings.mobile, savedData.platformSettings.mobile || {})
			};
		}
		
		// Decrypt API keys if they are encrypted
		if (this.settings.aiProviders) {
			try {
				if (this.settings.aiProviders.claude?.apiKey) {
					this.settings.aiProviders.claude.apiKey = await CryptoService.decryptValue(this.settings.aiProviders.claude.apiKey);
				}
				if (this.settings.aiProviders.openai?.apiKey) {
					this.settings.aiProviders.openai.apiKey = await CryptoService.decryptValue(this.settings.aiProviders.openai.apiKey);
				}
				if (this.settings.aiProviders.google?.apiKey) {
					this.settings.aiProviders.google.apiKey = await CryptoService.decryptValue(this.settings.aiProviders.google.apiKey);
				}
			} catch (error) {
				console.error('❌ Failed to decrypt API keys:', error);
			}
		}
		
		// Decrypt license keys if they are encrypted
		if (this.settings.licensing) {
			try {
				if (this.settings.licensing.licenseKey) {
					this.settings.licensing.licenseKey = await CryptoService.decryptValue(this.settings.licensing.licenseKey);
				}
				if (this.settings.licensing.supernovaLicenseKey) {
					this.settings.licensing.supernovaLicenseKey = await CryptoService.decryptValue(this.settings.licensing.supernovaLicenseKey);
				}
			} catch (error) {
				console.error('❌ Failed to decrypt license keys:', error);
			}
		}
		
		// Always use default debugSettings (transitory for development sessions)
		if (this.settings.licensing) {
			this.settings.licensing.debugSettings = DEFAULT_SETTINGS.licensing.debugSettings;
		}
	}


	/**
	 * Deep merge two objects, preserving nested structures
	 */
	private deepMerge(target: any, source: any): any {
		if (!source) return target;
		
		const result = { ...target };
		
		for (const key in source) {
			if (source.hasOwnProperty(key)) {
				if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
					result[key] = this.deepMerge(target[key] || {}, source[key]);
				} else {
					result[key] = source[key];
				}
			}
		}
		
		return result;
	}

	async saveSettings() {
		// Create a copy of settings to encrypt API keys for storage
		const settingsToSave = JSON.parse(JSON.stringify(this.settings));
		
		// Remove debugSettings from saved data (should be transitory for development sessions)
		if (settingsToSave.licensing?.debugSettings) {
			delete settingsToSave.licensing.debugSettings;
		}
		
		// Encrypt API keys before saving
		if (settingsToSave.aiProviders) {
			try {
				if (settingsToSave.aiProviders.claude?.apiKey) {
					settingsToSave.aiProviders.claude.apiKey = await CryptoService.encryptValue(settingsToSave.aiProviders.claude.apiKey);
				}
				if (settingsToSave.aiProviders.openai?.apiKey) {
					settingsToSave.aiProviders.openai.apiKey = await CryptoService.encryptValue(settingsToSave.aiProviders.openai.apiKey);
				}
				if (settingsToSave.aiProviders.google?.apiKey) {
					settingsToSave.aiProviders.google.apiKey = await CryptoService.encryptValue(settingsToSave.aiProviders.google.apiKey);
				}
			} catch (error) {
				console.error('❌ Failed to encrypt API keys:', error);
				// Fall back to saving without encryption if encryption fails
			}
		}
		
		// Encrypt license keys before saving
		if (settingsToSave.licensing) {
			try {
				if (settingsToSave.licensing.licenseKey) {
					settingsToSave.licensing.licenseKey = await CryptoService.encryptValue(settingsToSave.licensing.licenseKey);
				}
				if (settingsToSave.licensing.supernovaLicenseKey) {
					settingsToSave.licensing.supernovaLicenseKey = await CryptoService.encryptValue(settingsToSave.licensing.supernovaLicenseKey);
				}
			} catch (error) {
				console.error('❌ Failed to encrypt license keys:', error);
				// Fall back to saving without encryption if encryption fails
			}
		}
		
		try {
			// Force save multiple times to ensure it persists
			await this.saveData(settingsToSave);
			
			// Add delay and try again
			await new Promise(resolve => setTimeout(resolve, 200));
			await this.saveData(settingsToSave);
			
			// Add another delay and verify
			await new Promise(resolve => setTimeout(resolve, 200));
			
			// Verify the save by reading it back
			const readBack = await this.loadData();
			
			// Check if the save actually worked
			const currentPlatform = Platform.isMobile ? 'mobile' : 'desktop';
			const expectedModel = this.settings.platformSettings[currentPlatform].selectedModel;
			const actualModel = readBack?.platformSettings?.[currentPlatform]?.selectedModel;
			
			if (expectedModel !== actualModel) {
				console.error('❌ Save verification STILL failed after retry!', {
					expected: expectedModel,
					actual: actualModel,
					platform: currentPlatform
				});
				
				// Try one more time with manual file write
				await this.saveData(settingsToSave);
				await new Promise(resolve => setTimeout(resolve, 300));
				
				const finalCheck = await this.loadData();
				const finalActual = finalCheck?.platformSettings?.[currentPlatform]?.selectedModel;
				if (expectedModel !== finalActual) {
					console.error('❌ Forced save also failed!', { finalActual });
				}
			}
			
			this.aiProviderManager?.updateSettings(this.settings);
		} catch (error) {
			console.error('❌ Error during save operation:', error);
			throw error;
		}
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
		
		// Store reference to sidebar view
		if (leaf?.view instanceof NovaSidebarView) {
			this.sidebarView = leaf.view;
		}
	}

	/**
	 * Handle selection-based commands
	 */
	private async handleSelectionCommand(actionId: string, editor: Editor): Promise<void> {
		try {
			const selectedText = editor.getSelection();
			if (!selectedText || selectedText.trim().length === 0) {
				new Notice('Please select some text first');
				return;
			}

			await this.selectionContextMenu.handleSelectionAction(actionId, editor, selectedText);
		} catch (error) {
			console.error('Error executing Nova selection command:', error);
			new Notice('Failed to execute Nova action. Please try again.', 3000);
		}
	}

	/**
	 * Handle tone-specific commands
	 */
	private async handleToneCommand(toneId: string, editor: Editor): Promise<void> {
		try {
			const selectedText = editor.getSelection();
			if (!selectedText || selectedText.trim().length === 0) {
				new Notice('Please select some text first');
				return;
			}

			// Call handleSelectionAction with tone action and the specific tone
			await this.selectionContextMenu.handleSelectionAction('tone', editor, selectedText, toneId);
		} catch (error) {
			console.error('Error executing Nova tone command:', error);
			new Notice('Failed to execute Nova action. Please try again.', 3000);
		}
	}


	/**
	 * Show upgrade prompt for Core tier mobile users
	 */
	private showMobileUpgradePrompt(): void {
		const modal = document.createElement('div');
		modal.className = 'modal nova-mobile-upgrade-modal';
		modal.innerHTML = `
			<div class="modal-container">
				<div class="modal-bg"></div>
				<div class="modal-content">
					<div class="modal-header">
						<h3>Nova SuperNova Required</h3>
					</div>
					<div class="modal-body">
						<div class="nova-tier-badge core" style="margin-bottom: 1em;">
							<span class="tier-icon">FREE</span>
							<span class="tier-name">Core (Free)</span>
						</div>
						<p>Mobile access is available with Nova SuperNova.</p>
						<p>Core tier is limited to desktop use only.</p>
						<div class="nova-feature-list">
							<h4>SuperNova includes:</h4>
							<ul>
								<li>Mobile device support</li>
								<li>Multiple AI providers</li>
								<li>In-chat provider switching</li>
								<li>Advanced templates</li>
								<li>Priority support</li>
							</ul>
						</div>
					</div>
					<div class="modal-footer">
						<button class="mod-cta nova-upgrade-btn">Upgrade to SuperNova</button>
						<button class="nova-close-btn">Close</button>
					</div>
				</div>
			</div>
		`;

		const upgradeBtn = modal.querySelector('.nova-upgrade-btn') as HTMLButtonElement;
		const closeBtn = modal.querySelector('.nova-close-btn') as HTMLButtonElement;
		const modalBg = modal.querySelector('.modal-bg') as HTMLElement;

		const closeModal = () => {
			modal.remove();
		};

		upgradeBtn.addEventListener('click', () => {
			window.open('https://novawriter.ai/upgrade', '_blank');
			closeModal();
		});

		closeBtn.addEventListener('click', closeModal);
		modalBg.addEventListener('click', closeModal);

		document.body.appendChild(modal);

		// Show notice as well
		new Notice('Nova mobile access requires SuperNova license', 8000);
	}

	// DataStore interface implementation for ConversationManager
	async loadDataWithKey(key: string): Promise<any> {
		const allData = await this.loadData();
		return allData ? allData[key] : undefined;
	}

	async saveDataWithKey(key: string, data: any): Promise<void> {
		const allData = await this.loadData() || {};
		allData[key] = data;
		return await this.saveData(allData);
	}
}