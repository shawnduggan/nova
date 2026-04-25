/**
 * @file ReleaseNotesView - Full-page tab showing what's new after an update
 */

import { ItemView, MarkdownRenderer, WorkspaceLeaf } from 'obsidian';
import { KOFI_URL } from '../constants';
import type { ReleaseNotesEntry } from '../release-notes';

export const VIEW_TYPE_RELEASE_NOTES = 'nova-release-notes';

export class ReleaseNotesView extends ItemView {
	private releaseNotes: ReleaseNotesEntry[];
	private version: string;

	constructor(leaf: WorkspaceLeaf, releaseNotes: ReleaseNotesEntry[], version: string) {
		super(leaf);
		this.releaseNotes = releaseNotes;
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

		const pageEl = container.createDiv({ cls: 'nova-release-notes-page' });
		this.renderHeader(pageEl);

		const listEl = pageEl.createDiv({ cls: 'nova-release-notes-list' });
		for (const entry of this.releaseNotes) {
			await this.renderReleaseEntry(listEl, entry);
		}

		this.renderSupportLink(pageEl);
	}

	async onClose(): Promise<void> {
		await Promise.resolve();
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
	}

	private renderHeader(container: HTMLElement): void {
		const headerEl = container.createDiv({ cls: 'nova-release-notes-header' });
		const titleRowEl = headerEl.createDiv({ cls: 'nova-release-notes-title-row' });
		const iconEl = titleRowEl.createSpan({ cls: 'nova-release-notes-icon', text: '*' });
		iconEl.setAttr('aria-hidden', 'true');
		titleRowEl.createEl('h1', { text: 'What\'s new in Nova' });

		const subtitleEl = headerEl.createEl('p');
		subtitleEl.setText(this.releaseNotes.length > 1
			? `Nova ${this.version} plus the latest ${this.releaseNotes.length - 1} prior releases.`
			: `Nova ${this.version} release notes.`);
	}

	private async renderReleaseEntry(container: HTMLElement, entry: ReleaseNotesEntry): Promise<void> {
		const cardEl = container.createDiv({
			cls: entry.isCurrent
				? 'nova-release-card nova-release-card-current'
				: 'nova-release-card nova-release-card-previous'
		});

		const headerEl = cardEl.createDiv({ cls: 'nova-release-card-header' });
		headerEl.createEl('h2', { text: `Nova ${entry.version}` });
		headerEl.createSpan({
			cls: entry.isCurrent ? 'nova-release-badge nova-release-badge-current' : 'nova-release-badge',
			text: entry.isCurrent ? 'Current release' : 'Previous release'
		});

		const contentEl = cardEl.createDiv({ cls: 'nova-release-card-content' });
		await MarkdownRenderer.render(this.app, this.stripReleaseTitle(entry.content), contentEl, '', this);
	}

	private renderSupportLink(container: HTMLElement): void {
		const supportEl = container.createDiv({ cls: 'nova-release-notes-support' });
		const supportTextEl = supportEl.createEl('p');
		supportTextEl.setText('Nova is free to use with your own AI provider keys.');

		const link = supportEl.createEl('a', {
			href: KOFI_URL,
			cls: 'nova-kofi-link',
		});
		link.setText('Support Nova on Ko-fi');
		link.setAttr('target', '_blank');
	}

	private stripReleaseTitle(content: string): string {
		return content.replace(/^## What's New in Nova [^\n]+\n\n?/u, '');
	}
}
