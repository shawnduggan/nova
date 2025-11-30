/**
 * Modal for creating and editing custom commands
 */

import { App, Modal, Setting } from 'obsidian';
import { CustomCommand } from '../settings';

export class CustomCommandModal extends Modal {
	private result: CustomCommand | null = null;
	private onSubmit: (command: CustomCommand) => void;
	private existingCommand?: CustomCommand;

	constructor(
		app: App,
		onSubmit: (command: CustomCommand) => void,
		existingCommand?: CustomCommand
	) {
		super(app);
		this.onSubmit = onSubmit;
		this.existingCommand = existingCommand;
	}

	onOpen() {
		const { contentEl } = this;

		contentEl.createEl('h2', { text: this.existingCommand ? 'Edit custom command' : 'New custom command' });

		let nameValue = this.existingCommand?.name || '';
		let triggerValue = this.existingCommand?.trigger || '';
		let descriptionValue = this.existingCommand?.description || '';
		let templateValue = this.existingCommand?.template || '';

		// Command name
		new Setting(contentEl)
			.setName('Command name')
			.setDesc('Display name for this command')
			.addText(text => text
				.setPlaceholder('E.g., expand outline')
				.setValue(nameValue)
				.onChange(value => {
					nameValue = value;
				}));

		// Command trigger
		new Setting(contentEl)
			.setName('Command trigger')
			.setDesc('Shortcut to trigger this command (without colon)')
			.addText(text => text
				.setPlaceholder('E.g., expand')
				.setValue(triggerValue)
				.onChange(value => {
					triggerValue = value;
				}));

		// Description (optional)
		new Setting(contentEl)
			.setName('Description')
			.setDesc('Optional description of what this command does')
			.addText(text => text
				.setPlaceholder('E.g., transform bullet points into flowing prose')
				.setValue(descriptionValue)
				.onChange(value => {
					descriptionValue = value;
				}));

		// Template content
		new Setting(contentEl)
			.setName('Template')
			.setDesc('The prompt template for this command')
			.addTextArea(text => {
				text
					.setPlaceholder('E.g., transform the following bullet points into flowing prose...')
					.setValue(templateValue)
					.onChange(value => {
						templateValue = value;
					});
				text.inputEl.rows = 8;
				text.inputEl.cols = 50;
			});

		// Buttons
		new Setting(contentEl)
			.addButton(btn => btn
				.setButtonText('Cancel')
				.onClick(() => {
					this.close();
				}))
			.addButton(btn => btn
				.setButtonText('Save')
				.setCta()
				.onClick(() => {
					if (!nameValue.trim()) {
						// Could use Notice here for validation feedback
						return;
					}
					if (!triggerValue.trim()) {
						return;
					}
					if (!templateValue.trim()) {
						return;
					}

					this.result = {
						id: this.existingCommand?.id || ('cmd_' + Math.random().toString(36).substring(2, 11)),
						name: nameValue.trim(),
						trigger: triggerValue.toLowerCase().trim(),
						template: templateValue.trim(),
						description: descriptionValue.trim() || undefined
					};

					this.onSubmit(this.result);
					this.close();
				}));
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
