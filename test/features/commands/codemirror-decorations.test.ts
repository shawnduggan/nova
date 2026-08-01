/**
 * @file CodeMirror decoration lifecycle regression tests
 */

import { Component } from 'obsidian';
import type { EditorView } from '@codemirror/view';
import { IndicatorWidget } from '../../../src/features/commands/ui/codemirror-decorations';

describe('IndicatorWidget lifecycle', () => {
	test('releases widget-scoped listeners when CodeMirror destroys an indicator', () => {
		const onIndicatorClick = jest.fn();
		const plugin = {
			addChild: jest.fn((component: Component) => {
				component.load();
				return component;
			}),
			removeChild: jest.fn((component: Component) => {
				component.unload();
				return component;
			})
		};
		const widget = new IndicatorWidget({
			line: 0,
			column: 0,
			type: 'enhancement',
			icon: '✨',
			commands: [],
			confidence: 0.9
		}, onIndicatorClick, plugin as never);
		const editorDom = document.createElement('div');
		const indicator = widget.toDOM({ dom: editorDom } as EditorView);

		indicator.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(onIndicatorClick).toHaveBeenCalledTimes(1);

		widget.destroy(indicator);
		indicator.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		expect(onIndicatorClick).toHaveBeenCalledTimes(1);
		expect(plugin.removeChild).toHaveBeenCalledTimes(1);
	});
});
