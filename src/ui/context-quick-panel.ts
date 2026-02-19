/**
 * @file ContextQuickPanel - Collapsible panel at top of sidebar for quick context actions
 * Extracted from sidebar-view.ts as part of sidebar architecture refactor
 */

import { App } from 'obsidian';
import NovaPlugin from '../../main';

/**
 * ContextQuickPanel provides a collapsible panel at the top of the sidebar
 * for quick context-related actions and information display.
 * 
 * This is a placeholder implementation extracted from NovaSidebarView.
 * Full implementation will be completed as part of the Auto-Context System.
 */
export class ContextQuickPanel {
	private containerEl: HTMLElement;
	private plugin: NovaPlugin;
	private app: App;

	constructor(
		plugin: NovaPlugin,
		app: App,
		parentContainer: HTMLElement
	) {
		this.plugin = plugin;
		this.app = app;
		this.containerEl = parentContainer.createDiv({ cls: 'nova-context-quick-panel' });
	}

	/**
	 * Get the container element for the quick panel
	 */
	getContainer(): HTMLElement {
		return this.containerEl;
	}

	/**
	 * Show the quick panel
	 */
	show(): void {
		this.containerEl.addClass('show');
	}

	/**
	 * Hide the quick panel
	 */
	hide(): void {
		this.containerEl.removeClass('show');
	}

	/**
	 * Toggle the quick panel visibility
	 */
	toggle(): void {
		this.containerEl.toggleClass('show', !this.containerEl.hasClass('show'));
	}

	/**
	 * Destroy and clean up the panel
	 */
	destroy(): void {
		this.containerEl.empty();
		this.containerEl.remove();
	}
}
