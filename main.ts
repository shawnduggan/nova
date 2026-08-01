import { Component, Plugin, WorkspaceLeaf, addIcon, Notice, Editor, MarkdownView, normalizePath } from 'obsidian';
import { NovaSettings, NovaSettingTab, DEFAULT_SETTINGS } from './src/settings';
import { AIProviderManager } from './src/ai/provider-manager';
import { NovaSidebarView, VIEW_TYPE_NOVA_SIDEBAR } from './src/ui/sidebar-view';
import { ReleaseNotesView, VIEW_TYPE_RELEASE_NOTES } from './src/ui/release-notes-view';
import { WritingDashboardView, VIEW_TYPE_WRITING_DASHBOARD } from './src/ui/writing-dashboard-view';
import { ProseLinterView, VIEW_TYPE_PROSE_LINTER } from './src/ui/prose-linter-view';
import { getRecentReleaseNotes, getReleaseNotes, type ReleaseNotesEntry } from './src/release-notes';
import { isVersionNewer } from './src/utils/version';
import { SmartRevisionService } from './src/features/smart-revision/smart-revision-service';
import type { SmartRevisionSourceIssue, SmartRevisionTarget } from './src/features/smart-revision/smart-revision-types';
import { SmartRevisionModal } from './src/ui/smart-revision-modal';
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
import { SelectionContextMenu } from './src/ui/selection-context-menu';
import { TONE_OPTIONS } from './src/ui/tone-selection-modal';
import { AIIntentClassifier } from './src/core/ai-intent-classifier';
import { CryptoService } from './src/core/crypto-service';
import { Logger } from './src/utils/logger';
import { CommandEngine, insertSmartFillPlaceholder } from './src/features/commands/core/CommandEngine';
import { SmartVariableResolver } from './src/features/commands/core/SmartVariableResolver';
import { SmartTimingEngine } from './src/features/commands/core/SmartTimingEngine';
import { MarginIndicators } from './src/features/commands/ui/MarginIndicators';
import { createIndicatorExtension } from './src/features/commands/ui/codemirror-decorations';
import { toSmartTimingSettings } from './src/features/commands/types';
import { WritingAnalysisManager } from './src/ui/writing-analysis-manager';
import { ProseLinterStore } from './src/features/prose-linter/prose-linter-store';
import { FEATURE_SMART_REVISION, FEATURE_SMARTFILL, NOVA_LICENSE_UPDATED_EVENT } from './src/constants';
import {
	DASHBOARD_CACHE_DATA_KEY,
	DASHBOARD_HISTORY_DATA_KEY,
	LEGACY_DASHBOARD_CACHE_FILE,
	LEGACY_DASHBOARD_HISTORY_FILE
} from './src/core/vault-analyzer';
import type { StateField } from '@codemirror/state';
import type { DecorationSet } from '@codemirror/view';

// Nova icon - main plugin icon
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

// Supernova icon - enhanced version for pro users  
const SUPERNOVA_ICON_SVG = `
<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="12" cy="12" r="2.5" fill="currentColor"/>
  <path d="M12 1L12 6" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
  <path d="M12 18L12 23" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
  <path d="M23 12L18 12" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
  <path d="M6 12L1 12" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
  <path d="M18.364 5.636L15.536 8.464" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M8.464 15.536L5.636 18.364" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M18.364 18.364L15.536 15.536" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M8.464 8.464L5.636 5.636" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
</svg>`;

const SETTINGS_DATA_KEYS: ReadonlyArray<keyof NovaSettings> = [
	'aiProviders',
	'platformSettings',
	'general',
	'licensing',
	'commands',
	'writingAnalysis',
	'dashboard',
	'autoContext',
	'features'
];

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
	selectionContextMenu!: SelectionContextMenu;
	commandEngine!: CommandEngine;
	smartVariableResolver!: SmartVariableResolver;
	smartTimingEngine!: SmartTimingEngine;
	marginIndicators!: MarginIndicators;
	indicatorStateField!: StateField<{ decorations: DecorationSet; opportunities: Map<number, unknown> }>;
	writingAnalysisManager!: WritingAnalysisManager;
	writingAnalysisStateField!: StateField<DecorationSet>;
	proseLinterStore!: ProseLinterStore;
	smartRevisionService!: SmartRevisionService;
	private pendingReleaseNotes: ReleaseNotesEntry[] = [];
	private pendingReleaseVersion: string | null = null;
	private dataMutationQueue: Promise<void> = Promise.resolve();
	private insightPanelDocumentLifecycles = new Map<Document, Component>();

	async onload() {
		try {
			await this.loadSettings();
			await this.migrateLegacyDashboardData();


			// Initialize licensing system
			this.licenseValidator = new LicenseValidator();
			this.featureManager = new FeatureManager(
				this.licenseValidator,
				this.settings.licensing.debugSettings
			);
			
			// Update license from settings
			if (this.settings.licensing.supernovaLicenseKey) {
				await this.featureManager.updateSupernovaLicense(this.settings.licensing.supernovaLicenseKey);
			}

			// Dispatch license update event to refresh Supernova UI after startup
			this.app.workspace.onLayoutReady(async () => {
				this.app.workspace.trigger(NOVA_LICENSE_UPDATED_EVENT);

				// Check for release notes after update
				await this.checkAndShowReleaseNotes();
			});


			// Register Nova custom icons with Obsidian
			addIcon('nova-star', NOVA_ICON_SVG);
			addIcon('nova-supernova', SUPERNOVA_ICON_SVG);

			this.aiProviderManager = new AIProviderManager(this.settings, this.featureManager);
			this.aiProviderManager.initialize();
			this.smartRevisionService = new SmartRevisionService(this.aiProviderManager);

			// Initialize conversation manager and document engine
			const dataStore = {
				loadData: (key: string) => this.loadDataWithKey(key),
				saveData: (key: string, data: unknown) => this.saveDataWithKey(key, data),
				registerInterval: (intervalId: number) => this.registerInterval(intervalId)
			};
			this.conversationManager = new ConversationManager(dataStore);
			await this.conversationManager.init();
			this.proseLinterStore = new ProseLinterStore({
				loadData: () => this.loadDataWithKey('proseLinter'),
				saveData: (data) => this.saveDataWithKey('proseLinter', data)
			});
			await this.proseLinterStore.load();
			this.documentEngine = new DocumentEngine(this.app, this.conversationManager);
			this.contextBuilder = new ContextBuilder(this.settings);
			this.commandParser = new CommandParser();
			this.promptBuilder = new PromptBuilder(this.documentEngine, this.conversationManager);
			this.aiIntentClassifier = new AIIntentClassifier(this.aiProviderManager);
			
			// Initialize command implementations
			this.addCommandHandler = new AddCommand(this.app, this.documentEngine, this.contextBuilder, this.aiProviderManager);
			this.editCommandHandler = new EditCommand(this.app, this.documentEngine, this.contextBuilder, this.aiProviderManager);
			this.deleteCommandHandler = new DeleteCommand(this.app, this.documentEngine);
			this.grammarCommandHandler = new GrammarCommand(this.app, this.documentEngine, this.contextBuilder, this.aiProviderManager);
			this.rewriteCommandHandler = new RewriteCommand(this.app, this.documentEngine, this.contextBuilder, this.aiProviderManager);
			this.metadataCommandHandler = new MetadataCommand(this.app, this.documentEngine, this.contextBuilder, this.aiProviderManager);

			// Initialize Nova Commands system
			Logger.info('Initializing Nova Commands system components...');
			this.smartVariableResolver = new SmartVariableResolver(this);
			this.smartTimingEngine = new SmartTimingEngine(this, this.smartVariableResolver);
			
			// Initialize SmartTimingEngine with user settings (converted from simplified)
			const legacyTimingSettings = toSmartTimingSettings(this.settings.commands);
			this.smartTimingEngine.updateSettings(legacyTimingSettings);
			
			this.commandEngine = new CommandEngine(this);

			// Create CodeMirror extension for margin indicators
			const { extension, stateField, writingStateField } = createIndicatorExtension(this);
			this.indicatorStateField = stateField;
			this.writingAnalysisStateField = writingStateField;
			this.registerEditorExtension(extension);

			this.marginIndicators = new MarginIndicators(this, this.smartVariableResolver, this.commandEngine, this.smartTimingEngine);
			this.writingAnalysisManager = new WritingAnalysisManager(this);
			Logger.info('Nova Commands system components created successfully');

			// Initialize MarginIndicators after creation (must be in onLayoutReady for editor access)
			this.app.workspace.onLayoutReady(() => {
				try {
					this.marginIndicators.init();
					this.writingAnalysisManager.init();
					Logger.info('Nova Commands system initialized successfully');
				} catch (error) {
					Logger.error('Failed to initialize Nova Commands system:', error);
				}
			});

			this.registerView(
				VIEW_TYPE_NOVA_SIDEBAR,
				(leaf) => new NovaSidebarView(leaf, this)
			);

			this.registerView(
				VIEW_TYPE_RELEASE_NOTES,
				(leaf) => new ReleaseNotesView(leaf, this.pendingReleaseNotes, this.pendingReleaseVersion ?? '')
			);

			this.registerView(
				VIEW_TYPE_WRITING_DASHBOARD,
				(leaf) => new WritingDashboardView(leaf, this)
			);

			this.registerView(
				VIEW_TYPE_PROSE_LINTER,
				(leaf) => new ProseLinterView(leaf, this)
			);

			// Note: Wikilink autocomplete is now handled directly in sidebar view

			this.addRibbonIcon('nova-star', 'Nova AI', (_evt: MouseEvent) => {
				void this.activateView();
			});

			// Register selection-based commands
			this.addCommand({
				id: 'improve-writing',
				name: 'Improve writing',
				editorCallback: async (editor: Editor) => {
					await this.handleSelectionCommand('improve', editor);
				}
			});

			this.addCommand({
				id: 'make-longer',
				name: 'Make longer',
				editorCallback: async (editor: Editor) => {
					await this.handleSelectionCommand('longer', editor);
				}
			});

			this.addCommand({
				id: 'make-shorter',
				name: 'Make shorter',
				editorCallback: async (editor: Editor) => {
					await this.handleSelectionCommand('shorter', editor);
				}
			});

			// Individual tone commands
			TONE_OPTIONS.forEach(tone => {
				this.addCommand({
					id: `make-${tone.id}`,
					name: `Make ${tone.label.charAt(0).toUpperCase() + tone.label.slice(1)}`,
					editorCallback: async (editor: Editor) => {
						await this.handleToneCommand(tone.id, editor);
					}
				});
			});

			this.addCommand({
				id: 'tell-assistant',
				name: 'Custom prompt',
				editorCallback: async (editor: Editor) => {
					await this.handleSelectionCommand('custom', editor);
				}
			});

			this.addCommand({
				id: 'smart-revision',
				name: 'Smart revision',
				editorCallback: (editor: Editor) => {
					this.startSmartRevisionFromEditor(editor);
				}
			});

			this.addCommand({
				id: 'open-sidebar',
				name: 'Open sidebar',
				callback: () => {
					void this.activateView();
				}
			});

			this.addCommand({
				id: 'open-writing-dashboard',
				name: 'Open writing dashboard',
				callback: () => {
					void this.activateWritingDashboard();
				}
			});

			this.addCommand({
				id: 'open-prose-linter',
				name: 'Open prose linter',
				callback: () => {
					void this.activateProseLinter();
				}
			});

			// Register /fill command for Nova placeholders
			this.addCommand({
				id: 'smartfill',
				name: 'Smart fill (/fill)',
				checkCallback: (checking: boolean) => {
					try {
						const featureEnabled = this.featureManager?.isFeatureEnabled(FEATURE_SMARTFILL) ?? false;

						if (checking) {
							return featureEnabled;
						}

						// Don't execute if feature is disabled (safety check)
						if (!featureEnabled) {
							return false;
						}

						void this.executeFilWithProcessingState();
						return true;
					} catch {
						// Defensive: don't let errors corrupt command state
						return false;
					}
				}
			});

			this.addCommand({
				id: 'insert-placeholder',
				name: 'Insert smart fill placeholder',
				checkCallback: (checking: boolean) => {
					const featureEnabled = this.featureManager?.isFeatureEnabled(FEATURE_SMARTFILL) ?? false;
					if (checking) return featureEnabled;
					if (!featureEnabled) return false;
					const view = this.app.workspace.getActiveViewOfType(MarkdownView);
					if (view?.editor) {
						insertSmartFillPlaceholder(view.editor);
					}
					return true;
				}
			});

			// Initialize selection context menu
			this.selectionContextMenu = new SelectionContextMenu(this.app, this);
			this.selectionContextMenu.register();

			this.settingTab = new NovaSettingTab(this.app, this);
		this.addSettingTab(this.settingTab);
		
		// Register global event handlers for InsightPanel (once per plugin lifecycle)
		this.registerGlobalInsightPanelHandlers();
		
		} catch (error) {
			Logger.error('Failed to initialize Nova plugin:', error);
		}
	}

	onunload() {
		this.aiProviderManager?.cleanup();
		this.conversationManager?.cleanup();
		this.settingTab?.cleanup();
		this.marginIndicators?.cleanup();
		this.writingAnalysisManager?.cleanup();
		this.commandEngine?.cleanup();
		for (const ownerDocument of this.insightPanelDocumentLifecycles.keys()) {
			this.unregisterInsightPanelDocument(ownerDocument);
		}
	}

	/**
	 * Show release notes tab when the plugin has been updated.
	 * - Fresh install (no lastSeenVersion): silently record version
	 * - Setting disabled: skip
	 * - Same or older version: skip
	 * - No notes for this version: silently update version
	 */
	private async checkAndShowReleaseNotes(): Promise<void> {
		const currentVersion = this.manifest.version;
		const lastSeen = this.settings.general.lastSeenVersion;

		// Fresh install — just record version, don't show anything
		if (!lastSeen) {
			this.settings.general.lastSeenVersion = currentVersion;
			await this.saveSettings();
			return;
		}

		if (!this.settings.general.showReleaseNotes) return;
		if (!isVersionNewer(currentVersion, lastSeen)) return;

		const notes = getReleaseNotes(currentVersion);
		if (!notes) {
			// No notes authored for this version — update silently
			this.settings.general.lastSeenVersion = currentVersion;
			await this.saveSettings();
			return;
		}

		// Store content so the registerView factory can pick it up
		this.pendingReleaseNotes = getRecentReleaseNotes(currentVersion);
		this.pendingReleaseVersion = currentVersion;

		const leaf = this.app.workspace.getLeaf('tab');
		await leaf.setViewState({ type: VIEW_TYPE_RELEASE_NOTES, active: true });

		this.settings.general.lastSeenVersion = currentVersion;
		await this.saveSettings();
	}

	/**
	 * Register global event handlers for InsightPanel dismiss functionality
	 * These handlers are registered once and check if a panel is active before acting
	 */
	private registerGlobalInsightPanelHandlers(): void {
		const registerKnownDocuments = (): void => {
			this.registerInsightPanelDocument(this.app.workspace.containerEl.ownerDocument);
			this.app.workspace.iterateAllLeaves((leaf) => {
				this.registerInsightPanelDocument(leaf.view.containerEl.ownerDocument);
			});
		};

		registerKnownDocuments();
		this.registerEvent(this.app.workspace.on('layout-change', registerKnownDocuments));
		this.registerEvent(this.app.workspace.on('window-open', (_workspaceWindow, ownerWindow) => {
			this.registerInsightPanelDocument(ownerWindow.document);
		}));
		this.registerEvent(this.app.workspace.on('window-close', (_workspaceWindow, ownerWindow) => {
			this.unregisterInsightPanelDocument(ownerWindow.document);
		}));
	}

	private registerInsightPanelDocument(ownerDocument: Document): void {
		if (this.insightPanelDocumentLifecycles.has(ownerDocument)) {
			return;
		}
		const lifecycle = this.addChild(new Component());
		this.insightPanelDocumentLifecycles.set(ownerDocument, lifecycle);

		lifecycle.registerDomEvent(ownerDocument, 'click', (event: MouseEvent) => {
			if (this.marginIndicators?.insightPanel?.isActive()) {
				const panelElement = this.marginIndicators.insightPanel.getActivePanel();
				const target = event.target as Element | null;
				if (typeof target?.closest !== 'function') {
					return;
				}
				
				// Don't dismiss if clicking on panel, indicator, or indicator preview
				if (panelElement && !panelElement.contains(target) && 
					!target.classList.contains('nova-margin-indicator') &&
					!target.closest('.nova-margin-indicator')) {
					this.marginIndicators.insightPanel.hidePanel();
				}
			}
		});

		// Global keydown handler for dismissing panels on Escape key
		lifecycle.registerDomEvent(ownerDocument, 'keydown', (event: KeyboardEvent) => {
			if (event.key === 'Escape' && this.marginIndicators?.insightPanel?.isActive()) {
				this.marginIndicators.insightPanel.hidePanel();
			}
		});
	}

	private unregisterInsightPanelDocument(ownerDocument: Document): void {
		const lifecycle = this.insightPanelDocumentLifecycles.get(ownerDocument);
		if (!lifecycle) {
			return;
		}

		this.insightPanelDocumentLifecycles.delete(ownerDocument);
		this.removeChild(lifecycle);
	}

	private migrateDynamicModelCache(provider: 'ollama' | 'openai-compatible'): void {
		const providerSettings = this.settings.aiProviders?.[provider];
		if (!providerSettings) {
			return;
		}

		if (!Array.isArray(providerSettings.models)) {
			providerSettings.models = [];
		}

		const savedModel = providerSettings.model?.trim();
		if (savedModel && providerSettings.models.length === 0) {
			providerSettings.models = [savedModel];
		}
	}

	async loadSettings() {
		const allSavedData = await this.loadData();
		const savedData = this.selectSettingsData(allSavedData);
		const settingsMigrationData = JSON.parse(JSON.stringify(this.toPluginDataRecord(allSavedData)));
		
		// Use Object.assign for top level, but manually merge platformSettings to preserve saved values
		this.settings = Object.assign({}, DEFAULT_SETTINGS, savedData);
		this.settings.aiProviders = {
			claude: Object.assign({}, DEFAULT_SETTINGS.aiProviders.claude, savedData?.aiProviders?.claude || {}),
			openai: Object.assign({}, DEFAULT_SETTINGS.aiProviders.openai, savedData?.aiProviders?.openai || {}),
			google: Object.assign({}, DEFAULT_SETTINGS.aiProviders.google, savedData?.aiProviders?.google || {}),
			ollama: Object.assign({}, DEFAULT_SETTINGS.aiProviders.ollama, savedData?.aiProviders?.ollama || {}),
			'openai-compatible': Object.assign({}, DEFAULT_SETTINGS.aiProviders['openai-compatible'], savedData?.aiProviders?.['openai-compatible'] || {})
		};
		this.migrateDynamicModelCache('ollama');
		this.migrateDynamicModelCache('openai-compatible');
		
		// Manually merge general settings to ensure new fields get defaults
		if (savedData?.general) {
			this.settings.general = Object.assign({}, DEFAULT_SETTINGS.general, savedData.general);
		}

		// Manually merge platformSettings to ensure saved model selections are preserved
		if (savedData?.platformSettings) {
			this.settings.platformSettings = {
				desktop: Object.assign({}, DEFAULT_SETTINGS.platformSettings.desktop, savedData.platformSettings.desktop || {}),
				mobile: Object.assign({}, DEFAULT_SETTINGS.platformSettings.mobile, savedData.platformSettings.mobile || {})
			};
		}

		if (savedData?.writingAnalysis) {
			this.settings.writingAnalysis = Object.assign({}, DEFAULT_SETTINGS.writingAnalysis, savedData.writingAnalysis);
		}

		if (savedData?.dashboard) {
			this.settings.dashboard = Object.assign({}, DEFAULT_SETTINGS.dashboard, savedData.dashboard);
		}
		
		const sensitiveValues: Array<{
			label: string;
			storedValue: string;
			setRuntime: (value: string) => void;
			setStored: (value: string) => void;
		}> = [
			{
				label: 'Claude API key',
				storedValue: savedData?.aiProviders?.claude?.apiKey ?? '',
				setRuntime: (value) => { this.settings.aiProviders.claude.apiKey = value; },
				setStored: (value) => { settingsMigrationData.aiProviders.claude.apiKey = value; }
			},
			{
				label: 'OpenAI API key',
				storedValue: savedData?.aiProviders?.openai?.apiKey ?? '',
				setRuntime: (value) => { this.settings.aiProviders.openai.apiKey = value; },
				setStored: (value) => { settingsMigrationData.aiProviders.openai.apiKey = value; }
			},
			{
				label: 'Google API key',
				storedValue: savedData?.aiProviders?.google?.apiKey ?? '',
				setRuntime: (value) => { this.settings.aiProviders.google.apiKey = value; },
				setStored: (value) => { settingsMigrationData.aiProviders.google.apiKey = value; }
			},
			{
				label: 'OpenAI-compatible API key',
				storedValue: savedData?.aiProviders?.['openai-compatible']?.apiKey ?? '',
				setRuntime: (value) => { this.settings.aiProviders['openai-compatible'].apiKey = value; },
				setStored: (value) => { settingsMigrationData.aiProviders['openai-compatible'].apiKey = value; }
			},
			{
				label: 'Supernova license key',
				storedValue: savedData?.licensing?.supernovaLicenseKey ?? '',
				setRuntime: (value) => { this.settings.licensing.supernovaLicenseKey = value; },
				setStored: (value) => { settingsMigrationData.licensing.supernovaLicenseKey = value; }
			}
		];
		let sensitiveStorageChanged = false;
		let sensitiveValueRemoved = false;
		const migratedSensitiveValues: Array<(value: string) => void> = [];

		for (const sensitiveValue of sensitiveValues) {
			if (!sensitiveValue.storedValue) {
				continue;
			}
			try {
				const preparedValue = await CryptoService.prepareStoredValue(sensitiveValue.storedValue);
				sensitiveValue.setRuntime(preparedValue.runtimeValue);
				if (preparedValue.storageChanged) {
					sensitiveValue.setStored(preparedValue.storageValue);
					sensitiveStorageChanged = true;
					migratedSensitiveValues.push(sensitiveValue.setRuntime);
				}
			} catch (error) {
				Logger.error(`Failed to securely load ${sensitiveValue.label}; removing the stored value.`, error);
				sensitiveValue.setRuntime('');
				sensitiveValue.setStored('');
				sensitiveStorageChanged = true;
				sensitiveValueRemoved = true;
				migratedSensitiveValues.push(sensitiveValue.setRuntime);
			}
		}

		if (sensitiveStorageChanged) {
			try {
				await this.saveData(settingsMigrationData);
			} catch (error) {
				Logger.error('Failed to persist secure credential migration:', error);
				for (const clearRuntimeValue of migratedSensitiveValues) {
					clearRuntimeValue('');
				}
				sensitiveValueRemoved = true;
			}
		}

		if (sensitiveValueRemoved) {
			new Notice('Nova could not securely load one or more saved credentials. The affected values were removed; enter them again in settings.', 7000);
		}

		// Always use default debugSettings (transitory for development sessions)
		if (this.settings.licensing) {
			this.settings.licensing.debugSettings = DEFAULT_SETTINGS.licensing.debugSettings;
		}
	}

	async saveSettings() {
		// Create a copy of settings to encrypt API keys for storage
		const settingsToSave = JSON.parse(JSON.stringify(this.settings));
		
		// Filter out settings for features that are not enabled
		if (settingsToSave.features) {
			const filteredFeatures: Record<string, unknown> = {};

			// Only include Smart Fill settings if the feature is enabled
			if (this.featureManager.isFeatureEnabled(FEATURE_SMARTFILL) && settingsToSave.features.smartfill) {
				filteredFeatures.smartfill = settingsToSave.features.smartfill;
			}

			// Set features to filtered object, or remove it if empty
			if (Object.keys(filteredFeatures).length > 0) {
				settingsToSave.features = filteredFeatures;
			} else {
				delete settingsToSave.features;
			}
		}
		
		// Remove debugSettings from saved data (should be transitory for development sessions)
		if (settingsToSave.licensing?.debugSettings) {
			delete settingsToSave.licensing.debugSettings;
		}
		
		const sensitiveValuesToSave: Array<{
			label: string;
			value: string;
			setStored: (value: string) => void;
			clearRuntime: () => void;
		}> = [
			{
				label: 'Claude API key',
				value: settingsToSave.aiProviders?.claude?.apiKey ?? '',
				setStored: (value) => { settingsToSave.aiProviders.claude.apiKey = value; },
				clearRuntime: () => { this.settings.aiProviders.claude.apiKey = ''; }
			},
			{
				label: 'OpenAI API key',
				value: settingsToSave.aiProviders?.openai?.apiKey ?? '',
				setStored: (value) => { settingsToSave.aiProviders.openai.apiKey = value; },
				clearRuntime: () => { this.settings.aiProviders.openai.apiKey = ''; }
			},
			{
				label: 'Google API key',
				value: settingsToSave.aiProviders?.google?.apiKey ?? '',
				setStored: (value) => { settingsToSave.aiProviders.google.apiKey = value; },
				clearRuntime: () => { this.settings.aiProviders.google.apiKey = ''; }
			},
			{
				label: 'OpenAI-compatible API key',
				value: settingsToSave.aiProviders?.['openai-compatible']?.apiKey ?? '',
				setStored: (value) => { settingsToSave.aiProviders['openai-compatible'].apiKey = value; },
				clearRuntime: () => { this.settings.aiProviders['openai-compatible'].apiKey = ''; }
			},
			{
				label: 'Supernova license key',
				value: settingsToSave.licensing?.supernovaLicenseKey ?? '',
				setStored: (value) => { settingsToSave.licensing.supernovaLicenseKey = value; },
				clearRuntime: () => { this.settings.licensing.supernovaLicenseKey = ''; }
			}
		];
		const failedSensitiveValues: string[] = [];

		for (const sensitiveValue of sensitiveValuesToSave) {
			if (!sensitiveValue.value) {
				continue;
			}
			try {
				sensitiveValue.setStored(await CryptoService.encryptValue(sensitiveValue.value));
			} catch (error) {
				Logger.error(`Failed to securely store ${sensitiveValue.label}; removing the value.`, error);
				sensitiveValue.setStored('');
				sensitiveValue.clearRuntime();
				failedSensitiveValues.push(sensitiveValue.label);
			}
		}
		
		try {
			await this.saveSettingsData(settingsToSave);
			this.aiProviderManager?.updateSettings(this.settings);
			if (failedSensitiveValues.includes('Supernova license key')) {
				await this.featureManager?.updateSupernovaLicense(null);
			}
		} catch (error) {
			Logger.error('Error during save operation:', error);
			throw error;
		}

		if (failedSensitiveValues.length > 0) {
			new Notice('Nova could not securely store one or more credentials. The affected values were removed; enter them again in settings.', 7000);
			throw new Error('Sensitive settings could not be stored securely.');
		}
	}

	private toPluginDataRecord(data: unknown): Record<string, unknown> {
		return data && typeof data === 'object' && !Array.isArray(data)
			? data as Record<string, unknown>
			: {};
	}

	private selectSettingsData(data: unknown): Partial<NovaSettings> {
		const allData = this.toPluginDataRecord(data);
		const settingsData: Record<string, unknown> = {};
		for (const key of SETTINGS_DATA_KEYS) {
			if (Object.prototype.hasOwnProperty.call(allData, key)) {
				settingsData[key] = allData[key];
			}
		}
		return settingsData as Partial<NovaSettings>;
	}

	private async mutatePluginData(update: (data: Record<string, unknown>) => void): Promise<void> {
		const operation = this.dataMutationQueue.then(async () => {
			const currentData = this.toPluginDataRecord(await this.loadData());
			const nextData = { ...currentData };
			update(nextData);
			await this.saveData(nextData);
		});
		this.dataMutationQueue = operation.catch(() => undefined);
		await operation;
	}

	private async saveSettingsData(settingsData: Record<string, unknown>): Promise<void> {
		await this.mutatePluginData((allData) => {
			for (const key of SETTINGS_DATA_KEYS) {
				if (Object.prototype.hasOwnProperty.call(settingsData, key)) {
					allData[key] = settingsData[key];
				} else {
					delete allData[key];
				}
			}
		});
	}

	private async migrateLegacyDashboardData(): Promise<void> {
		const pluginDirectory = `${this.app.vault.configDir}/plugins/${this.manifest.id}`;
		const legacyEntries = [
			{ fileName: LEGACY_DASHBOARD_CACHE_FILE, dataKey: DASHBOARD_CACHE_DATA_KEY },
			{ fileName: LEGACY_DASHBOARD_HISTORY_FILE, dataKey: DASHBOARD_HISTORY_DATA_KEY }
		];

		for (const entry of legacyEntries) {
			const legacyPath = normalizePath(`${pluginDirectory}/${entry.fileName}`);
			if (!await this.app.vault.adapter.exists(legacyPath)) {
				continue;
			}

			try {
				const existingData = await this.loadDataWithKey(entry.dataKey);
				if (existingData === undefined || existingData === null) {
					const legacyData = JSON.parse(await this.app.vault.adapter.read(legacyPath));
					await this.saveDataWithKey(entry.dataKey, legacyData);
				}
				await this.app.vault.adapter.remove(legacyPath);
			} catch {
				Logger.warn('Failed to migrate legacy dashboard data; the legacy file was retained');
			}
		}
	}

	/**
	 * Get the current sidebar view from the workspace (dynamic lookup)
	 * Obsidian owns view instances, so callers resolve the current leaf on demand.
	 */
	getCurrentSidebarView(): NovaSidebarView | null {
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_NOVA_SIDEBAR);
		if (leaves.length > 0 && leaves[0].view instanceof NovaSidebarView) {
			return leaves[0].view;
		}
		return null;
	}

	/**
	 * Execute an async operation with automatic processing state management
	 * Consolidates the pattern of setting processing state before/after operations
	 */
	private async executeWithProcessingState<T>(operation: () => Promise<T>): Promise<T> {
		const sidebarView = this.getCurrentSidebarView();

		if (sidebarView?.inputHandler) {
			sidebarView.inputHandler.setProcessingState(true);
		}

		try {
			return await operation();
		} finally {
			const sidebarView = this.getCurrentSidebarView();
			if (sidebarView?.inputHandler) {
				sidebarView.inputHandler.setProcessingState(false);
			}
		}
	}

	/**
	 * Execute fill with automatic processing state management
	 * This is the single source of truth for all fill operations
	 */
	async executeFilWithProcessingState(): Promise<void> {
		await this.executeWithProcessingState(() => this.commandEngine.executeFill());
	}

	/**
	 * Execute fill single with automatic processing state management
	 */
	async executeFillSingleWithProcessingState(lineNumber: number, instruction?: string): Promise<void> {
		await this.executeWithProcessingState(() => this.commandEngine.executeFillSingle(lineNumber, instruction));
	}

	/**
	 * Cancel all ongoing operations (fill commands and selection edits)
	 */
	cancelAllOperations(): void {
		// Cancel command engine operations (fill commands)
		this.commandEngine?.cancelCurrentOperation();

		// Cancel selection context menu operations (improve writing, etc.)
		this.selectionContextMenu?.cancelCurrentOperation();
	}

	startSmartRevisionFromEditor(editor: Editor): void {
		const selectedText = editor.getSelection();
		if (!selectedText || selectedText.trim().length === 0) {
			new Notice('Please select some text first');
			return;
		}

		const target: SmartRevisionTarget = {
			text: selectedText,
			range: {
				from: editor.getCursor('from'),
				to: editor.getCursor('to')
			},
			filePath: this.app.workspace.getActiveFile()?.path ?? null
		};
		this.openSmartRevision(editor, target);
	}

	openSmartRevision(editor: Editor, target: SmartRevisionTarget, onComplete?: () => void | Promise<void>): void {
		const accessAllowed = this.featureManager?.isFeatureEnabled(FEATURE_SMART_REVISION) ?? false;
		new SmartRevisionModal(
			this,
			editor,
			target,
			this.smartRevisionService,
			{ accessAllowed, onComplete }
		).open();
	}

	openSmartRevisionForIssue(editor: Editor, sourceIssue: SmartRevisionSourceIssue, onComplete?: () => void | Promise<void>): void {
		const from = { line: sourceIssue.targetLine, ch: sourceIssue.targetStartCh };
		const to = { line: sourceIssue.targetLine, ch: sourceIssue.targetEndCh };
		const target: SmartRevisionTarget = {
			text: sourceIssue.targetText,
			range: { from, to },
			filePath: this.app.workspace.getActiveFile()?.path ?? null,
			sourceIssue
		};
		editor.setSelection(from, to);
		this.openSmartRevision(editor, target, onComplete);
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

		if (!leaf) {
			return;
		}

		await workspace.revealLeaf(leaf);
		this.writingAnalysisManager?.setProseLinterReviewActive(false);

	}

	async activateWritingDashboard() {
		const { workspace } = this.app;

		let leaf: WorkspaceLeaf | null;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_WRITING_DASHBOARD);

		if (leaves.length > 0) {
			leaf = leaves[0];
		} else {
			leaf = workspace.getLeaf('tab');
			await leaf?.setViewState({ type: VIEW_TYPE_WRITING_DASHBOARD, active: true });
		}

		if (leaf) {
			void workspace.revealLeaf(leaf);
		}
	}

	async activateProseLinter() {
		const { workspace } = this.app;

		let leaf: WorkspaceLeaf | null;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_PROSE_LINTER);

		if (leaves.length > 0) {
			leaf = leaves[0];
		} else {
			leaf = workspace.getRightLeaf(false);
			await leaf?.setViewState({ type: VIEW_TYPE_PROSE_LINTER, active: true });
		}

		if (leaf) {
			await workspace.revealLeaf(leaf);
			this.writingAnalysisManager?.setProseLinterReviewActive(true);
			if (leaf.view instanceof ProseLinterView) {
				void leaf.view.refresh();
			}
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
			Logger.error('Error executing Nova selection command:', error);
			new Notice('Failed to execute Nova action, please try again', 3000);
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
			Logger.error('Error executing Nova tone command:', error);
			new Notice('Failed to execute Nova action, please try again', 3000);
		}
	}



	// DataStore interface implementation for ConversationManager
	async loadDataWithKey(key: string): Promise<unknown> {
		await this.dataMutationQueue;
		const allData = await this.loadData();
		return this.toPluginDataRecord(allData)[key];
	}

	async saveDataWithKey(key: string, data: unknown): Promise<void> {
		await this.mutatePluginData((allData) => {
			allData[key] = data;
		});
	}

	async deleteDataWithKey(key: string): Promise<void> {
		await this.mutatePluginData((allData) => {
			delete allData[key];
		});
	}
}
