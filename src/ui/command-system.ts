import { ButtonComponent, TextAreaComponent } from 'obsidian';
import NovaPlugin from '../../main';
import { EditCommand } from '../core/types';

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

	constructor(plugin: NovaPlugin, container: HTMLElement, textArea: TextAreaComponent) {
		this.plugin = plugin;
		this.container = container;
		this.textArea = textArea;
	}

	createCommandButton(inputRow: HTMLElement): ButtonComponent {
		this.commandButton = new ButtonComponent(inputRow);
		this.commandButton.setIcon('zap');
		this.commandButton.setTooltip('Commands');
		this.commandButton.onClick(() => this.toggleCommandMenu());
		this.commandButton.buttonEl.style.cssText = `
			min-width: var(--size-4-9);
			height: var(--size-4-9);
			border-radius: 50%;
			display: ${this.shouldShowCommandButton() ? 'flex' : 'none'};
			align-items: center;
			justify-content: center;
			padding: 0;
			flex-shrink: 0;
			margin-right: var(--size-2-3);
		`;
		return this.commandButton;
	}

	createCommandPicker(): void {
		// Legacy method - use createCommandPickerInContainer instead
		this.createCommandPickerInContainer(this.container);
	}

	createCommandPickerInContainer(container: HTMLElement): void {
		this.commandPicker = container.createDiv({ cls: 'nova-command-picker' });
		this.commandPicker.style.cssText = `
			position: absolute;
			bottom: 100%;
			left: 0;
			right: 0;
			background: var(--background-primary);
			border: 1px solid var(--background-modifier-border);
			border-radius: 8px;
			box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
			max-height: 200px;
			overflow-y: auto;
			z-index: 1000;
			display: none;
			margin-bottom: 4px;
		`;
	}

	shouldShowCommandButton(): boolean {
		return this.plugin.featureManager.isFeatureEnabled('commands');
	}

	updateCommandButtonVisibility(): void {
		if (this.commandButton) {
			const shouldShow = this.shouldShowCommandButton();
			this.commandButton.buttonEl.style.display = shouldShow ? 'flex' : 'none';
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
		this.commandMenu.style.cssText = `
			position: absolute;
			bottom: 100%;
			right: 0;
			background: var(--background-primary);
			border: 1px solid var(--background-modifier-border);
			border-radius: var(--radius-s);
			box-shadow: var(--shadow-s);
			min-width: 250px;
			max-height: 300px;
			overflow-y: auto;
			z-index: 1000;
			display: none;
			padding: var(--size-2-2);
		`;

		// Commands available to all users
		const commands = [
			{ name: 'Improve Writing', description: 'Enhance clarity and flow', command: '/improve' },
			{ name: 'Fix Grammar', description: 'Correct grammar and spelling', command: '/grammar' },
			{ name: 'Summarize', description: 'Create a concise summary', command: '/summarize' },
			{ name: 'Expand Ideas', description: 'Develop thoughts further', command: '/expand' },
			{ name: 'Explain', description: 'Clarify complex concepts', command: '/explain' },
			{ name: 'Continue Writing', description: 'Extend the current text', command: '/continue' }
		];

		const title = this.commandMenu.createEl('div', { text: 'Quick Commands' });
		title.style.cssText = `
			font-size: var(--font-ui-medium);
			font-weight: 600;
			margin-bottom: var(--size-2-3);
			color: var(--text-normal);
		`;

		commands.forEach(cmd => {
			const cmdEl = this.commandMenu.createDiv({ cls: 'nova-command-item' });
			cmdEl.style.cssText = `
				padding: var(--size-2-2) var(--size-2-3);
				border-radius: var(--radius-xs);
				cursor: pointer;
				margin-bottom: var(--size-2-1);
				transition: background-color 0.1s;
			`;

			const nameEl = cmdEl.createEl('div', { text: cmd.name });
			nameEl.style.cssText = `
				font-weight: 500;
				color: var(--text-normal);
				margin-bottom: var(--size-2-1);
			`;

			const descEl = cmdEl.createEl('div', { text: cmd.description });
			descEl.style.cssText = `
				font-size: var(--font-ui-smaller);
				color: var(--text-muted);
			`;

			cmdEl.addEventListener('click', () => {
				this.textArea.setValue(cmd.command + ' ');
				this.textArea.inputEl.focus();
				this.hideCommandMenu();
			});

			cmdEl.addEventListener('mouseenter', () => {
				cmdEl.style.background = 'var(--background-modifier-hover)';
			});

			cmdEl.addEventListener('mouseleave', () => {
				cmdEl.style.background = 'transparent';
			});
		});
	}

	private showCommandMenu(): void {
		if (this.commandMenu) {
			this.commandMenu.style.display = 'block';
			this.isCommandMenuVisible = true;
		}
	}

	hideCommandMenu(): void {
		if (this.commandMenu) {
			this.commandMenu.style.display = 'none';
			this.isCommandMenuVisible = false;
		}
	}

	handleInputChange(): void {
		if (!this.textArea) {
			return;
		}
		
		const input = this.textArea.getValue();
		
		// Handle different triggers
		if (input.startsWith(':')) {
			// Custom command trigger - show structured commands
			this.showStructuredCommandPicker(input);
		} else {
			// No triggers active - hide command picker
			// Note: "/" is handled by section picker, not command system
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
				item.style.cssText = `
					padding: 8px 12px;
					cursor: pointer;
					border-bottom: 1px solid var(--background-modifier-border-hover);
					transition: background-color 0.2s;
				`;

				const nameEl = item.createEl('div', { text: cmd.name });
				nameEl.style.cssText = `
					font-weight: 500;
					color: var(--text-normal);
					margin-bottom: 4px;
				`;

				const descEl = item.createEl('div', { text: cmd.description });
				descEl.style.cssText = `
					font-size: 0.85em;
					color: var(--text-muted);
					margin-bottom: 4px;
				`;

				const exampleEl = item.createEl('div', { text: `Example: ${cmd.example}` });
				exampleEl.style.cssText = `
					font-size: 0.8em;
					color: var(--text-accent);
					font-family: var(--font-monospace);
				`;

				item.addEventListener('click', () => {
					this.selectStructuredCommand(cmd.template);
				});

				item.addEventListener('mouseenter', () => {
					this.selectedCommandIndex = index;
					this.updateCommandPickerSelection();
				});

				this.commandPickerItems.push(item);
			});

			this.commandPicker.style.display = 'block';
		} else {
			this.hideCommandPicker();
		}
	}

	hideCommandPicker(): void {
		this.commandPicker.style.display = 'none';
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
				item.style.background = 'var(--background-modifier-hover)';
			} else {
				item.style.background = 'transparent';
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
		return [
			{
				name: 'Add Section',
				description: 'Add a new section to the document',
				command: 'add section',
				template: 'add section "{cursor}"',
				example: ':add section "Results"',
				keywords: ['create', 'new', 'heading']
			},
			{
				name: 'Edit Section',
				description: 'Edit content in a specific section',
				command: 'edit section',
				template: 'edit {cursor} section',
				example: ':edit Methods section',
				keywords: ['modify', 'update', 'change']
			},
			{
				name: 'Delete Section',
				description: 'Remove a section from the document',
				command: 'delete section',
				template: 'delete {cursor} section',
				example: ':delete Introduction section',
				keywords: ['remove', 'eliminate']
			},
			{
				name: 'Append To',
				description: 'Add content to the end of a section',
				command: 'append to',
				template: 'append {cursor} to /',
				example: ':append conclusion to /Results',
				keywords: ['add', 'attach', 'end']
			},
			{
				name: 'Prepend To',
				description: 'Add content to the beginning of a section',
				command: 'prepend to',
				template: 'prepend {cursor} to /',
				example: ':prepend warning to /Methods',
				keywords: ['add', 'beginning', 'start']
			},
			{
				name: 'Insert After',
				description: 'Insert content after a section heading',
				command: 'insert after',
				template: 'insert {cursor} after / heading',
				example: ':insert diagram after /Methods heading',
				keywords: ['add', 'place', 'after']
			},
			{
				name: 'Insert Before',
				description: 'Insert content before a section heading',
				command: 'insert before',
				template: 'insert {cursor} before / heading',
				example: ':insert note before /Results heading',
				keywords: ['add', 'place', 'before']
			}
		];
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
			setTimeout(() => {
				this.textArea.inputEl.setSelectionRange(cursorPos, cursorPos);
				this.textArea.inputEl.focus();
			}, 0);
		} else {
			this.textArea.setValue(template);
			this.textArea.inputEl.focus();
		}
	}

	cleanup(): void {
		if (this.commandMenu) {
			this.commandMenu.remove();
		}
		if (this.commandPicker) {
			this.commandPicker.remove();
		}
	}
}