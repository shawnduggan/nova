/**
 * @file CommandSystem - Handles slash command detection and picker UI
 * Simplified to support single /fill command for Nova markers
 */

import { ButtonComponent, TextAreaComponent, Platform, FuzzySuggestModal, FuzzyMatch, App } from 'obsidian';
import NovaPlugin from '../../main';
import { CommandEngine } from '../features/commands/core/CommandEngine';
import { SmartVariableResolver } from '../features/commands/core/SmartVariableResolver';
import { Logger } from '../utils/logger';
import type { MarkdownCommand } from '../features/commands/types';
import { TimeoutManager } from '../utils/timeout-manager';


/**
 * Handles command picker, command menu, and command execution
 */
export class CommandSystem {
	private plugin: NovaPlugin;
	private container: HTMLElement;
	private textArea: TextAreaComponent;
	private commandButton!: ButtonComponent;
	private commandPicker!: HTMLElement;
	private commandPickerItems: HTMLElement[] = [];
	private selectedCommandIndex: number = -1;
	private commandMenu!: HTMLElement;
	private isCommandMenuVisible: boolean = false;
	private timeoutManager = new TimeoutManager();

	// Nova Commands System integration
	private commandEngine: CommandEngine;
	private variableResolver: SmartVariableResolver;
	private logger = Logger.scope('CommandSystem');

	constructor(plugin: NovaPlugin, container: HTMLElement, textArea: TextAreaComponent) {
		this.plugin = plugin;
		this.container = container;
		this.textArea = textArea;

		// Use shared Nova Commands components from main plugin (they may not be available yet)
		this.commandEngine = plugin.commandEngine;
		this.variableResolver = plugin.smartVariableResolver;
	}

	/**
	 * Register event listener using plugin's registration system
	 */
	private registerEventListener<K extends keyof HTMLElementEventMap>(element: HTMLElement, event: K, handler: (this: HTMLElement, ev: HTMLElementEventMap[K]) => void): void {
		this.plugin.registerDomEvent(element, event, handler);
	}

	createCommandButton(inputRow: HTMLElement): ButtonComponent {
		this.commandButton = new ButtonComponent(inputRow);
		this.commandButton.setIcon('zap');
		this.commandButton.setTooltip('Smart Fill');
		this.commandButton.onClick(() => this.toggleCommandMenu());
		this.commandButton.buttonEl.addClass('nova-command-button-styled');
		if (!this.shouldShowCommandButton()) {
			this.commandButton.buttonEl.hide();
		}
		return this.commandButton;
	}

	createCommandPicker(): void {
		this.createCommandPickerInContainer(this.container);
	}

	createCommandPickerInContainer(container: HTMLElement): void {
		this.commandPicker = container.createDiv({ cls: 'nova-command-picker nova-command-picker-styled' });
	}

	shouldShowCommandButton(): boolean {
		return Platform.isMobile && this.plugin.featureManager.isFeatureEnabled('commands') && (this.plugin.settings.features?.commands?.showCommandButton ?? true);
	}

	updateCommandButtonVisibility(): void {
		const shouldShow = this.shouldShowCommandButton();
		if (shouldShow) {
			this.commandButton?.buttonEl.show();
		} else {
			this.commandButton?.buttonEl.hide();
		}
	}

	toggleCommandMenu(): void {
		if (!this.commandMenu) {
			this.createCommandMenu();
		}
		
		if (this.isCommandMenuVisible) {
			this.hideCommandMenu();
		} else {
			this.showCommandMenu();
		}
	}

	private createCommandMenu(): void {
		this.commandMenu = this.container.createDiv({ cls: 'nova-command-menu' });
		// Position at bottom since we're in the bottom bar - styles defined in CSS

		// Commands available to all users
		const commands = [
			{ name: 'Improve writing', description: 'Enhance clarity and flow', command: 'improve writing' },
			{ name: 'Fix grammar', description: 'Correct grammar and spelling', command: 'fix grammar' },
			{ name: 'Summarize', description: 'Create a concise summary', command: 'summarize' },
			{ name: 'Expand ideas', description: 'Develop thoughts further', command: 'expand' },
			{ name: 'Explain', description: 'Clarify complex concepts', command: 'explain this' },
			{ name: 'Continue writing', description: 'Extend the current text', command: 'continue writing' }
		];

		this.commandMenu.createEl('div', { 
			text: 'Quick commands',
			cls: 'nova-command-menu-title'
		});
		// Title styles defined in CSS

		commands.forEach(cmd => {
			const cmdEl = this.commandMenu.createDiv({ cls: 'nova-command-menu-item' });
			// Command item styles defined in CSS

			cmdEl.createEl('div', { 
				text: cmd.name,
				cls: 'nova-command-name'
			});
			// Name element styles defined in CSS

			cmdEl.createEl('div', { 
				text: cmd.description,
				cls: 'nova-command-desc'
			});

			this.registerEventListener(cmdEl, 'click', () => {
				this.textArea.setValue(cmd.command + ' ');
				this.textArea.inputEl.focus();
				this.hideCommandMenu();
			});

			// Hover effect handled by CSS
		});
	}

	private showCommandMenu(): void {
		if (this.commandMenu) {
			this.commandMenu.addClass('show');
			this.isCommandMenuVisible = true;
		}
	}

	hideCommandMenu(): void {
		if (this.commandMenu) {
			this.commandMenu.removeClass('show');
			this.isCommandMenuVisible = false;
		}
	}

	handleInputChange(): void {
		const input = this.textArea?.getValue();
		if (!input) {
			return;
		}

		// Check for "/" trigger (Nova markdown commands)
		if (input.startsWith('/')) {
			// Nova markdown command trigger detected - check if feature is enabled
			const featureEnabled = this.plugin.featureManager.isFeatureEnabled('commands');
			
			if (featureEnabled) {
				void this.showMarkdownCommandPicker(input);
			} else {
				this.hideCommandPicker();
			}
		} else {
			// No triggers active - hide command picker
			this.hideCommandPicker();
		}
	}



	hideCommandPicker(): void {
		this.commandPicker.removeClass('show');
		this.commandPickerItems = [];
		this.selectedCommandIndex = -1;
	}

	handleCommandPickerNavigation(key: string): boolean {
		if (this.commandPickerItems.length === 0) return false;

		if (key === 'ArrowDown') {
			this.selectedCommandIndex = Math.min(this.selectedCommandIndex + 1, this.commandPickerItems.length - 1);
			this.updateCommandPickerSelection();
			return true;
		} else if (key === 'ArrowUp') {
			this.selectedCommandIndex = Math.max(this.selectedCommandIndex - 1, -1);
			this.updateCommandPickerSelection();
			return true;
		} else if (key === 'Tab' && this.selectedCommandIndex >= 0) {
			// Use the same logic as handleCommandPickerSelection for Tab
			return this.handleCommandPickerSelection();
		}

		return false;
	}

	handleCommandPickerSelection(): boolean {
		if (this.selectedCommandIndex >= 0 && this.commandPickerItems.length > 0) {
			const input = this.textArea.getValue();
			
			if (input.startsWith('/')) {
				// Handle markdown commands
				void this.handleMarkdownCommandSelection();
				return true;
			}
		}
		return false;
	}

	/**
	 * Handle selection of markdown commands from picker
	 */
	private async handleMarkdownCommandSelection(): Promise<void> {
		const input = this.textArea.getValue();
		const filterText = input.slice(1).toLowerCase(); // Remove "/"

		try {
			// Only /fill command is available now
			if ('fill'.includes(filterText) && this.selectedCommandIndex === 0) {
				await this.executeFillCommand();
			}
		} catch (error) {
			this.logger.error('Error in markdown command selection:', error);
		}
	}

	/**
	 * Execute the /fill command
	 */
	private async executeFillCommand(): Promise<void> {
		this.hideCommandPicker();
		this.textArea.setValue('');

		try {
			await this.commandEngine.executeFill();
		} catch (error) {
			this.logger.error('Failed to execute /fill:', error);
		}
	}

	private updateCommandPickerSelection(): void {
		this.commandPickerItems.forEach((item, index) => {
			if (index === this.selectedCommandIndex) {
				item.addClass('selected');
			} else {
				item.removeClass('selected');
			}
		});
	}


	/**
	 * Show command modal for "/" trigger - simplified to show /fill
	 */
	private showMarkdownCommandPicker(_input: string): void {
		// Ensure we have the latest references to Nova Commands components
		if (!this.commandEngine) {
			this.commandEngine = this.plugin.commandEngine;
			this.variableResolver = this.plugin.smartVariableResolver;
		}

		// Create the single /fill command
		const fillCommand: MarkdownCommand = {
			id: 'fill',
			name: 'Fill placeholders',
			description: 'Fill all <!-- nova: --> placeholders in the document',
			template: '',
			keywords: ['fill', 'placeholders', 'nova'],
			category: 'writing',
			iconType: '📝',
			variables: []
		};

		const modal = new CommandModal(
			this.plugin.app,
			[fillCommand],
			() => {
				void this.executeFillCommand();
			},
			() => {
				// User cancelled - clear the input trigger
				this.textArea.setValue('');
				this.timeoutManager.addTimeout(() => {
					this.textArea.inputEl.focus();
				}, 0);
			}
		);
		modal.open();
	}


	cleanup(): void {
		// Clean up timeouts
		this.timeoutManager.clearAll();

		// Clean up Nova Commands components
		if (this.commandEngine) {
			this.commandEngine.cleanup();
		}

		if (this.commandMenu) {
			this.commandMenu.remove();
		}
		if (this.commandPicker) {
			this.commandPicker.remove();
		}

		this.logger.info('CommandSystem cleaned up');
	}
}

/**
 * Native Obsidian command modal for "/" selection
 * Simplified to show /fill command
 */
class CommandModal extends FuzzySuggestModal<MarkdownCommand> {
	private onSelectCallback: () => void;
	private onCancelCallback?: () => void;
	private allCommands: MarkdownCommand[] = [];

	constructor(
		app: App,
		commands: MarkdownCommand[],
		onSelect: () => void,
		onCancel?: () => void
	) {
		super(app);
		this.allCommands = commands;
		this.onSelectCallback = onSelect;
		this.onCancelCallback = onCancel;

		this.setPlaceholder('Type /fill to fill placeholders...');
	}

	onOpen(): void {
		super.onOpen();
		this.addInstructions();
	}

	private addInstructions(): void {
		// Add the instruction footer like native Obsidian modals
		const instructionsEl = this.modalEl.createDiv({ cls: 'prompt-instructions' });

		const useInstruction = instructionsEl.createDiv({ cls: 'prompt-instruction' });
		useInstruction.createSpan({ cls: 'prompt-instruction-command', text: '↵' });
		useInstruction.createSpan({ text: 'to fill placeholders' });

		const escInstruction = instructionsEl.createDiv({ cls: 'prompt-instruction' });
		escInstruction.createSpan({ cls: 'prompt-instruction-command', text: 'esc' });
		escInstruction.createSpan({ text: 'to dismiss' });
	}

	getItems(): MarkdownCommand[] {
		return this.allCommands;
	}

	getItemText(command: MarkdownCommand): string {
		return command.name;
	}

	onChooseItem(_command: MarkdownCommand): void {
		this.onSelectCallback();
	}

	renderSuggestion(match: FuzzyMatch<MarkdownCommand>, el: HTMLElement): void {
		const command = match.item;

		// Create container with native Obsidian suggestion styling
		const container = el.createDiv({ cls: 'suggestion-content' });

		// Title with icon
		const title = container.createDiv({ cls: 'suggestion-title' });
		if (command.iconType) {
			const icon = title.createSpan({ cls: 'suggestion-flair' });
			icon.textContent = command.iconType;
		}
		const titleText = title.createSpan();
		titleText.textContent = `/fill - ${command.name}`;

		// Description
		if (command.description) {
			const note = container.createDiv({ cls: 'suggestion-note' });
			note.textContent = command.description;
		}
	}

	onClose(): void {
		super.onClose();
		if (this.onCancelCallback) {
			this.onCancelCallback();
		}
	}
}