/**
 * @file Nova plugin lifecycle regression tests
 */

import { App } from 'obsidian';
import NovaPlugin from '../main';

describe('Nova plugin document lifecycle', () => {
	test('releases and re-registers InsightPanel listeners across pop-out close and reopen', () => {
		const plugin = new NovaPlugin(new App(), {} as never);
		const hidePanel = jest.fn();
		(plugin as any).marginIndicators = {
			cleanup: jest.fn(),
			insightPanel: {
				isActive: () => true,
				getActivePanel: () => document.createElement('div'),
				hidePanel
			}
		};

		(plugin as any).registerGlobalInsightPanelHandlers();
		const popoutDocument = document.implementation.createHTMLDocument('Nova pop-out');
		const ownerWindow = { document: popoutDocument };
		const target = popoutDocument.createElement('button');
		popoutDocument.body.appendChild(target);

		plugin.app.workspace.trigger('window-open', {}, ownerWindow);
		const firstLifecycle = (plugin as any).insightPanelDocumentLifecycles.get(popoutDocument);
		target.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		expect(firstLifecycle).toBeDefined();
		expect(hidePanel).toHaveBeenCalledTimes(1);

		plugin.app.workspace.trigger('window-close', {}, ownerWindow);
		expect((plugin as any).insightPanelDocumentLifecycles.has(popoutDocument)).toBe(false);
		target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(hidePanel).toHaveBeenCalledTimes(1);

		plugin.app.workspace.trigger('window-open', {}, ownerWindow);
		const reopenedLifecycle = (plugin as any).insightPanelDocumentLifecycles.get(popoutDocument);
		target.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		expect(reopenedLifecycle).toBeDefined();
		expect(reopenedLifecycle).not.toBe(firstLifecycle);
		expect(hidePanel).toHaveBeenCalledTimes(2);
		plugin.unload();
	});
});
