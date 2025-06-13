import { ButtonComponent, TextAreaComponent } from 'obsidian';
import NovaPlugin from '../../main';
import { EditCommand } from '../core/types';

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
			min-width: var(--input-height);
			height: var(--input-height);
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
		this.commandPicker = this.container.createDiv({ cls: 'nova-command-picker' });
		this.commandPicker.style.cssText = `
			position: absolute;
			bottom: 100%;
			left: 0;
			right: 0;
			background: var(--background-primary);
			border: 1px solid var(--background-modifier-border);
			border-radius: var(--radius-s);
			box-shadow: var(--shadow-s);
			max-height: 200px;
			overflow-y: auto;
			z-index: 1000;
			display: none;
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
		const input = this.textArea.getValue();
		
		// Command picker logic
		if (input.startsWith('/')) {
			this.showCommandPicker(input);
		} else {
			this.hideCommandPicker();
		}
	}

	private showCommandPicker(input: string): void {
		const commands = this.getAvailableCommands();
		const filtered = commands.filter(cmd => 
			cmd.name.toLowerCase().includes(input.slice(1).toLowerCase()) ||
			cmd.command.toLowerCase().includes(input.toLowerCase())
		);

		this.commandPickerItems = [];
		this.commandPicker.empty();
		this.selectedCommandIndex = -1;

		if (filtered.length > 0) {
			filtered.forEach((cmd, index) => {
				const item = this.commandPicker.createDiv({ cls: 'nova-command-picker-item' });
				item.style.cssText = `
					padding: var(--size-2-2) var(--size-2-3);
					cursor: pointer;
					border-bottom: 1px solid var(--background-modifier-border);
				`;

				const nameEl = item.createEl('div', { text: cmd.name });
				nameEl.style.cssText = 'font-weight: 500; color: var(--text-normal);';

				const descEl = item.createEl('div', { text: cmd.description });
				descEl.style.cssText = 'font-size: var(--font-ui-smaller); color: var(--text-muted);';

				item.addEventListener('click', () => {
					this.selectCommand(cmd.command);
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
			const selectedCmd = this.getSelectedCommand();
			if (selectedCmd) {
				this.selectCommand(selectedCmd.command);
				return true;
			}
		}

		return false;
	}

	handleCommandPickerSelection(): boolean {
		if (this.selectedCommandIndex >= 0 && this.commandPickerItems.length > 0) {
			const selectedCmd = this.getSelectedCommand();
			if (selectedCmd) {
				this.selectCommand(selectedCmd.command);
				return true;
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

	private getSelectedCommand(): EditCommand | null {
		if (this.selectedCommandIndex >= 0) {
			const commands = this.getAvailableCommands();
			return commands[this.selectedCommandIndex] || null;
		}
		return null;
	}

	private getAvailableCommands(): EditCommand[] {
		return [
			{ name: 'Improve Writing', description: 'Enhance clarity and flow', command: '/improve' },
			{ name: 'Fix Grammar', description: 'Correct grammar and spelling', command: '/grammar' },
			{ name: 'Summarize', description: 'Create a concise summary', command: '/summarize' },
			{ name: 'Expand Ideas', description: 'Develop thoughts further', command: '/expand' },
			{ name: 'Explain', description: 'Clarify complex concepts', command: '/explain' },
			{ name: 'Continue Writing', description: 'Extend the current text', command: '/continue' },
			{ name: 'Add Title', description: 'Generate a title for the document', command: '/title' },
			{ name: 'Add Tags', description: 'Suggest relevant tags', command: '/tags' },
			{ name: 'Add Summary', description: 'Add a summary property', command: '/summary' },
			{ name: 'Add Author', description: 'Add author information', command: '/author' },
			{ name: 'Add Date', description: 'Add creation date', command: '/date' },
			{ name: 'Add Category', description: 'Categorize the document', command: '/category' }
		];
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