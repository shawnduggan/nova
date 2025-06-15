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
			this.app.workspace.onLayoutReady(() => {
				const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_NOVA_SIDEBAR);
				if (leaves.length > 0) {
					const sidebarView = leaves[0].view as NovaSidebarView;
					sidebarView.refreshSupernovaUI();
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
			this.contextBuilder = new ContextBuilder();
			this.commandParser = new CommandParser();
			this.promptBuilder = new PromptBuilder(this.documentEngine, this.conversationManager);
			
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

			// Register core document editing commands
			this.addCommand({
				id: 'nova-add-content',
				name: 'Nova: Add content',
				editorCallback: async (editor: Editor, ctx: MarkdownView | MarkdownFileInfo) => {
					await this.handleAddCommand();
				}
			});

			this.addCommand({
				id: 'nova-edit-content',
				name: 'Nova: Edit content',
				editorCallback: async (editor: Editor, ctx: MarkdownView | MarkdownFileInfo) => {
					await this.handleEditCommand();
				}
			});

			this.addCommand({
				id: 'nova-delete-content',
				name: 'Nova: Delete content',
				editorCallback: async (editor: Editor, ctx: MarkdownView | MarkdownFileInfo) => {
					await this.handleDeleteCommand();
				}
			});

			this.addCommand({
				id: 'nova-fix-grammar',
				name: 'Nova: Fix grammar',
				editorCallback: async (editor: Editor, ctx: MarkdownView | MarkdownFileInfo) => {
					await this.handleGrammarCommand();
				}
			});

			this.addCommand({
				id: 'nova-rewrite-content',
				name: 'Nova: Rewrite content',
				editorCallback: async (editor: Editor, ctx: MarkdownView | MarkdownFileInfo) => {
					await this.handleRewriteCommand();
				}
			});

			this.addCommand({
				id: 'open-nova-sidebar',
				name: 'Nova: Open sidebar',
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
		
		// Store reference to sidebar view
		if (leaf?.view instanceof NovaSidebarView) {
			this.sidebarView = leaf.view;
		}
	}

	/**
	 * Handle add content command with user input
	 */
	private async handleAddCommand(): Promise<void> {
		const instruction = await this.promptForInstruction('What would you like to add?');
		if (!instruction) return;

		try {
			const documentContext = await this.documentEngine.getDocumentContext();
			const hasSelection = !!(documentContext?.selectedText);
			const command = this.commandParser.parseCommand(instruction, hasSelection);
			const result = await this.addCommandHandler.execute(command);
			
			if (result.success) {
				new Notice('Content added successfully');
			} else {
				new Notice(`Failed to add content: ${result.error}`);
			}
		} catch (error) {
			new Notice(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	/**
	 * Handle edit content command with user input
	 */
	private async handleEditCommand(): Promise<void> {
		const instruction = await this.promptForInstruction('How would you like to edit the content?');
		if (!instruction) return;

		try {
			const documentContext = await this.documentEngine.getDocumentContext();
			const hasSelection = !!(documentContext?.selectedText);
			const command = this.commandParser.parseCommand(instruction, hasSelection);
			const result = await this.editCommandHandler.execute(command);
			
			if (result.success) {
				new Notice('Content edited successfully');
			} else {
				new Notice(`Failed to edit content: ${result.error}`);
			}
		} catch (error) {
			new Notice(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	/**
	 * Handle delete content command with user input
	 */
	private async handleDeleteCommand(): Promise<void> {
		const instruction = await this.promptForInstruction('What would you like to delete?');
		if (!instruction) return;

		try {
			const documentContext = await this.documentEngine.getDocumentContext();
			const hasSelection = !!(documentContext?.selectedText);
			const command = this.commandParser.parseCommand(instruction, hasSelection);
			const result = await this.deleteCommandHandler.execute(command);
			
			if (result.success) {
				new Notice('Content deleted successfully');
			} else {
				new Notice(`Failed to delete content: ${result.error}`);
			}
		} catch (error) {
			new Notice(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	/**
	 * Handle grammar correction command
	 */
	private async handleGrammarCommand(): Promise<void> {
		const documentContext = await this.documentEngine.getDocumentContext();
		if (!documentContext) {
			new Notice('No active document found');
			return;
		}

		// Determine target based on selection
		let target: 'selection' | 'document' = 'document';
		let instruction = 'Fix grammar and spelling errors';
		
		if (documentContext.selectedText) {
			target = 'selection';
			instruction = 'Fix grammar and spelling errors in the selected text';
		}

		try {
			const command = {
				action: 'grammar' as const,
				target,
				instruction
			};
			
			const result = await this.grammarCommandHandler.execute(command);
			
			if (result.success) {
				new Notice('Grammar corrected successfully');
			} else {
				new Notice(`Failed to correct grammar: ${result.error}`);
			}
		} catch (error) {
			new Notice(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	/**
	 * Handle rewrite content command with user input
	 */
	private async handleRewriteCommand(): Promise<void> {
		const instruction = await this.promptForInstruction('How would you like to rewrite the content?');
		if (!instruction) return;

		try {
			const documentContext = await this.documentEngine.getDocumentContext();
			const hasSelection = !!(documentContext?.selectedText);
			const command = this.commandParser.parseCommand(instruction, hasSelection);
			const result = await this.rewriteCommandHandler.execute(command);
			
			if (result.success) {
				new Notice('Content rewritten successfully');
			} else {
				new Notice(`Failed to rewrite content: ${result.error}`);
			}
		} catch (error) {
			new Notice(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}

	/**
	 * Prompt user for instruction input
	 */
	private async promptForInstruction(placeholder: string): Promise<string | null> {
		return new Promise((resolve) => {
			const modal = document.createElement('div');
			modal.className = 'modal nova-input-modal';
			modal.innerHTML = `
				<div class="modal-container">
					<div class="modal-bg" onclick="this.parentElement.parentElement.remove(); resolve(null);"></div>
					<div class="modal-content">
						<div class="modal-header">
							<h3>Nova AI Command</h3>
							<button class="modal-close-button" onclick="this.closest('.modal').remove(); resolve(null);">×</button>
						</div>
						<div class="modal-body">
							<input type="text" class="nova-instruction-input" placeholder="${placeholder}" autofocus>
						</div>
						<div class="modal-footer">
							<button class="mod-cta nova-submit-btn">Execute</button>
							<button class="nova-cancel-btn">Cancel</button>
						</div>
					</div>
				</div>
			`;

			const input = modal.querySelector('.nova-instruction-input') as HTMLInputElement;
			const submitBtn = modal.querySelector('.nova-submit-btn') as HTMLButtonElement;
			const cancelBtn = modal.querySelector('.nova-cancel-btn') as HTMLButtonElement;

			const handleSubmit = () => {
				const value = input.value.trim();
				modal.remove();
				resolve(value || null);
			};

			const handleCancel = () => {
				modal.remove();
				resolve(null);
			};

			input.addEventListener('keydown', (e) => {
				if (e.key === 'Enter') {
					e.preventDefault();
					handleSubmit();
				} else if (e.key === 'Escape') {
					e.preventDefault();
					handleCancel();
				}
			});

			submitBtn.addEventListener('click', handleSubmit);
			cancelBtn.addEventListener('click', handleCancel);

			document.body.appendChild(modal);
			input.focus();
		});
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