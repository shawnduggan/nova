/**
 * @file CommandSystem - Handles slash command detection and picker UI
 */

import { ButtonComponent, TextAreaComponent, Platform } from 'obsidian';
import NovaPlugin from '../../main';
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

	constructor(plugin: NovaPlugin, container: HTMLElement, textArea: TextAreaComponent) {
		this.plugin = plugin;
		this.container = container;
		this.textArea = textArea;
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
		
		// Check for triggers first (fast), then check permissions (slow)
		if (input.startsWith(':')) {
			// Custom command trigger detected - check if feature is enabled
			const featureEnabled = this.plugin.featureManager.isFeatureEnabled('commands');
			
			if (featureEnabled) {
				this.showStructuredCommandPicker(input);
			} else {
				this.hideCommandPicker();
			}
		} else {
			// No triggers active - hide command picker
			this.hideCommandPicker();
		}
	}


	/**
	 * Show structured command picker for ":" trigger  
	 */
	private showStructuredCommandPicker(input: string): void {
		if (!this.commandPicker) {
			return;
		}
		
		const structuredCommands = this.getStructuredCommands();
		const filterText = input.slice(1).toLowerCase(); // Remove ":"
		
		const filtered = structuredCommands.filter(cmd => 
			cmd.name.toLowerCase().includes(filterText) ||
			cmd.command.toLowerCase().includes(filterText) ||
			cmd.keywords.some(keyword => keyword.toLowerCase().includes(filterText))
		);

		this.commandPickerItems = [];
		this.commandPicker.empty();
		this.selectedCommandIndex = -1;

		if (filtered.length > 0) {
			filtered.forEach((cmd, index) => {
				const item = this.commandPicker.createDiv({ cls: 'nova-command-picker-item' });

				item.createEl('div', { 
					text: cmd.name,
					cls: 'nova-command-picker-name'
				});

				item.createEl('div', { 
					text: cmd.description,
					cls: 'nova-command-picker-desc'
				});

				item.createEl('div', { 
					text: `Example: ${cmd.example}`,
					cls: 'nova-command-picker-example'
				});

				this.registerEventListener(item, 'click', () => {
					this.selectStructuredCommand(cmd.template);
				});

				this.registerEventListener(item, 'mouseenter', () => {
					this.selectedCommandIndex = index;
					this.updateCommandPickerSelection();
				});

				this.commandPickerItems.push(item);
			});

			this.commandPicker.addClass('show');
		} else {
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
			// For structured commands, we need to get the selected command from the filtered list
			const commands = this.getStructuredCommands();
			const input = this.textArea.getValue();
			if (input.startsWith(':')) {
				const filterText = input.slice(1).toLowerCase();
				const filtered = commands.filter(cmd => 
					cmd.name.toLowerCase().includes(filterText) ||
					cmd.command.toLowerCase().includes(filterText) ||
					cmd.keywords.some(keyword => keyword.toLowerCase().includes(filterText))
				);
				
				if (this.selectedCommandIndex < filtered.length) {
					const selectedCmd = filtered[this.selectedCommandIndex];
					this.selectStructuredCommand(selectedCmd.template);
					return true;
				}
			}
		}
		return false;
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

	private selectCommand(command: string): void {
		this.textArea.setValue(command + ' ');
		this.textArea.inputEl.focus();
		
		// Position cursor at end
		const length = this.textArea.getValue().length;
		this.textArea.inputEl.setSelectionRange(length, length);
		
		this.hideCommandPicker();
	}


	/**
	 * Get structured commands for ":" trigger
	 */
	private getStructuredCommands(): StructuredCommand[] {
		const commands = [
			{
				name: 'Add content',
				description: 'Add new content at cursor position',
				command: 'add',
				template: 'add {cursor}',
				example: ':add paragraph about methodology',
				keywords: ['create', 'new', 'insert', 'write']
			},
			{
				name: 'Edit selection',
				description: 'Edit the selected text',
				command: 'edit',
				template: 'edit to {cursor}',
				example: ':edit to be more formal',
				keywords: ['modify', 'update', 'change', 'revise']
			},
			{
				name: 'Delete selection',
				description: 'Remove the selected text',
				command: 'delete',
				template: 'delete {cursor}',
				example: ':delete selected text',
				keywords: ['remove', 'eliminate', 'erase']
			},
			{
				name: 'Rewrite',
				description: 'Rewrite content with specific style',
				command: 'rewrite',
				template: 'rewrite as {cursor}',
				example: ':rewrite as bullet points',
				keywords: ['rephrase', 'restructure', 'reword']
			},
			{
				name: 'Fix grammar',
				description: 'Correct grammar and spelling errors',
				command: 'grammar',
				template: 'fix grammar {cursor}',
				example: ':fix grammar in selection',
				keywords: ['correct', 'proofread', 'spelling']
			},
			{
				name: 'Continue',
				description: 'Continue writing from current position',
				command: 'continue',
				template: 'continue {cursor}',
				example: ':continue with examples',
				keywords: ['extend', 'expand', 'proceed']
			},
			{
				name: 'Update metadata',
				description: 'Update document properties',
				command: 'metadata',
				template: 'update {cursor} property',
				example: ':update tags property',
				keywords: ['frontmatter', 'properties', 'tags']
			}
		];
		return commands;
	}

	/**
	 * Select a structured command and insert template
	 */
	private selectStructuredCommand(template: string): void {
		this.hideCommandPicker();
		
		// Replace cursor placeholder and insert template
		const cursorPos = template.indexOf('{cursor}');
		if (cursorPos !== -1) {
			const beforeCursor = template.slice(0, cursorPos);
			const afterCursor = template.slice(cursorPos + 8); // Length of '{cursor}'
			this.textArea.setValue(beforeCursor + afterCursor);
			
			// Position cursor where {cursor} was
			this.timeoutManager.addTimeout(() => {
				this.textArea.inputEl.setSelectionRange(cursorPos, cursorPos);
				this.textArea.inputEl.focus();
			}, 0);
		} else {
			this.textArea.setValue(template);
			this.textArea.inputEl.focus();
		}
	}

	cleanup(): void {
		// Clean up timeouts
		this.timeoutManager.clearAll();

		if (this.commandMenu) {
			this.commandMenu.remove();
		}
		if (this.commandPicker) {
			this.commandPicker.remove();
		}
	}
}