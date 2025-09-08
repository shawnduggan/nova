import { ButtonComponent, TextAreaComponent, Platform, FuzzySuggestModal, FuzzyMatch, App } from 'obsidian';
import NovaPlugin from '../../main';
import { CommandEngine } from '../features/commands/core/CommandEngine';
import { CommandRegistry } from '../features/commands/core/CommandRegistry';
import { SmartVariableResolver } from '../features/commands/core/SmartVariableResolver';
import { Logger } from '../utils/logger';
import type { MarkdownCommand } from '../features/commands/types';
import { TimeoutManager } from '../utils/timeout-manager';

interface StructuredCommand {
	name: string;
	description: string;
	command: string;
	template: string;
	example: string;
	keywords: string[];
}


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
	private commandRegistry: CommandRegistry;
	private variableResolver: SmartVariableResolver;
	private logger = Logger.scope('CommandSystem');

	constructor(plugin: NovaPlugin, container: HTMLElement, textArea: TextAreaComponent) {
		this.plugin = plugin;
		this.container = container;
		this.textArea = textArea;
		
		// Use shared Nova Commands components from main plugin (they may not be available yet)
		this.commandEngine = plugin.commandEngine;
		this.commandRegistry = plugin.commandRegistry;
		this.variableResolver = plugin.smartVariableResolver;
	}

	/**
	 * Register event listener using plugin's registration system
	 */
	private registerEventListener(element: HTMLElement, event: string, handler: EventListener): void {
		this.plugin.registerDomEvent(element, event as any, handler);
	}

	createCommandButton(inputRow: HTMLElement): ButtonComponent {
		this.commandButton = new ButtonComponent(inputRow);
		this.commandButton.setIcon('zap');
		this.commandButton.setTooltip('Commands');
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
		if (this.commandButton) {
			const shouldShow = this.shouldShowCommandButton();
			if (shouldShow) {
				this.commandButton.buttonEl.show();
			} else {
				this.commandButton.buttonEl.hide();
			}
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
		if (!this.textArea) {
			return;
		}
		
		const input = this.textArea.getValue();
		
		// Check for "/" trigger (Nova markdown commands)
		if (input.startsWith('/')) {
			// Nova markdown command trigger detected
			const featureEnabled = this.plugin.featureManager.isFeatureEnabled('commands');
			
			if (featureEnabled) {
				this.showMarkdownCommandPicker(input);
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
				this.handleMarkdownCommandSelection();
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
			const allCommands = await this.commandRegistry.searchCommands(filterText);
			const exactMatches = allCommands.filter(cmd => 
				cmd.id.toLowerCase().includes(filterText) ||
				cmd.name.toLowerCase().includes(filterText)
			);
			const filtered = exactMatches.slice(0, 8);
			
			if (this.selectedCommandIndex < filtered.length) {
				const selectedCmd = filtered[this.selectedCommandIndex];
				await this.selectMarkdownCommand(selectedCmd);
			}
		} catch (error) {
			this.logger.error('Error in markdown command selection:', error);
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
	 * Show native command modal for "/" trigger (like wikilink modal)
	 */
	private async showMarkdownCommandPicker(_input: string): Promise<void> {
		// Ensure we have the latest references to Nova Commands components
		if (!this.commandRegistry) {
			this.commandEngine = this.plugin.commandEngine;
			this.commandRegistry = this.plugin.commandRegistry;
			this.variableResolver = this.plugin.smartVariableResolver;
		}
		
		if (!this.commandRegistry) {
			this.logger.warn('CommandRegistry not available yet');
			return;
		}

		// Load commands first, then pass to modal (like WikilinkFileModal pattern)
		const commands = await this.commandRegistry.getAllCommands();
		
		const modal = new CommandModal(
			this.plugin.app,
			commands,
			async (command: MarkdownCommand) => {
				await this.selectMarkdownCommand(command);
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

	/**
	 * Execute a selected markdown command
	 */
	private async selectMarkdownCommand(command: MarkdownCommand): Promise<void> {
		this.hideCommandPicker();
		
		// Ensure we have the latest references to Nova Commands components
		if (!this.variableResolver || !this.commandEngine) {
			this.commandEngine = this.plugin.commandEngine;
			this.commandRegistry = this.plugin.commandRegistry;
			this.variableResolver = this.plugin.smartVariableResolver;
		}
		
		try {
			// Build smart context
			const context = await this.variableResolver.buildSmartContext();
			if (!context) {
				this.logger.warn('Could not build smart context for command execution');
				return;
			}

			// Clear the input (remove the trigger)
			this.textArea.setValue('');
			
			// Execute the command
			await this.commandEngine.executeCommand(command, context, {
				outputMode: 'replace',
				showProgress: true
			});
			
		} catch (error) {
			this.logger.error(`Failed to execute command ${command.name}:`, error);
			// Show error message to user
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			this.textArea.setValue(`Error executing ${command.name}: ${errorMessage}`);
		}
	}

	cleanup(): void {
		// Clean up timeouts
		this.timeoutManager.clearAll();

		// Clean up Nova Commands components
		if (this.commandEngine) {
			this.commandEngine.cleanup();
		}
		if (this.commandRegistry) {
			this.commandRegistry.cleanup();
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
 * Uses the same pattern as WikilinkFileModal for consistency
 */
class CommandModal extends FuzzySuggestModal<MarkdownCommand> {
	private onSelectCallback: (command: MarkdownCommand) => void;
	private onCancelCallback?: () => void;
	private allCommands: MarkdownCommand[] = [];

	constructor(
		app: App,
		commands: MarkdownCommand[],
		onSelect: (command: MarkdownCommand) => void,
		onCancel?: () => void
	) {
		super(app);
		this.allCommands = commands;
		this.onSelectCallback = onSelect;
		this.onCancelCallback = onCancel;
		
		this.setPlaceholder('Search commands...');
		
		// Sort by name for consistent ordering
		this.allCommands.sort((a, b) => a.name.localeCompare(b.name));
	}

	onOpen(): void {
		super.onOpen();
		this.addInstructions();
	}

	private addInstructions(): void {
		// Add the instruction footer like native Obsidian modals
		const instructionsEl = this.modalEl.createDiv({ cls: 'prompt-instructions' });
		
		const navInstruction = instructionsEl.createDiv({ cls: 'prompt-instruction' });
		navInstruction.createSpan({ cls: 'prompt-instruction-command', text: '↑↓' });
		navInstruction.createSpan({ text: 'to navigate' });

		const useInstruction = instructionsEl.createDiv({ cls: 'prompt-instruction' });
		useInstruction.createSpan({ cls: 'prompt-instruction-command', text: '↵' });
		useInstruction.createSpan({ text: 'to use' });

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

	onChooseItem(command: MarkdownCommand): void {
		this.onSelectCallback(command);
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
		titleText.textContent = command.name;
		
		// Description
		if (command.description) {
			const note = container.createDiv({ cls: 'suggestion-note' });
			note.textContent = command.description;
		}
		
		// Category as auxiliary info
		if (command.category) {
			const aux = container.createDiv({ cls: 'suggestion-aux' });
			aux.textContent = command.category;
		}
	}

	onClose(): void {
		super.onClose();
		if (this.onCancelCallback) {
			this.onCancelCallback();
		}
	}
}