/**
 * @file ReleaseNotesView - Full-page tab showing what's new after an update
 */

import { ItemView, MarkdownRenderer, WorkspaceLeaf } from 'obsidian';

export const VIEW_TYPE_RELEASE_NOTES = 'nova-release-notes';

export class ReleaseNotesView extends ItemView {
	private content: string;
	private version: string;

	constructor(leaf: WorkspaceLeaf, content: string, version: string) {
		super(leaf);
		this.content = content;
		this.version = version;
	}

	getViewType(): string {
		return VIEW_TYPE_RELEASE_NOTES;
	}

	getDisplayText(): string {
		return `Nova ${this.version} Release Notes`;
	}

	getIcon(): string {
		return 'nova-star';
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.addClass('nova-release-notes');
		await MarkdownRenderer.render(this.app, this.content, container, '', this);
	}

	async onClose(): Promise<void> {
		await Promise.resolve();
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
	}
}
