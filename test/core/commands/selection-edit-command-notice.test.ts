/**
 * @file SelectionEditCommand notice compatibility tests
 */

import * as obsidian from 'obsidian';
import { Notice } from 'obsidian';
import { SelectionEditCommand } from '../../../src/core/commands/selection-edit-command';

describe('SelectionEditCommand notice compatibility', () => {
	afterEach(() => {
		jest.restoreAllMocks();
	});

	test('uses noticeEl instead of hide on older supported Obsidian versions', async () => {
		jest.spyOn(obsidian, 'requireApiVersion').mockReturnValue(false);
		const hide = jest.spyOn(Notice.prototype, 'hide');
		const addClass = jest.spyOn(DOMTokenList.prototype, 'add');
		const command = new SelectionEditCommand({
			aiProviderManager: {
				complete: jest.fn().mockResolvedValue('Revised text')
			}
		} as never);
		const editor = {
			getCursor: jest.fn().mockReturnValue({ line: 0, ch: 0 })
		};

		const result = await command.execute('improve', editor as never, 'Original text');

		expect(result.success).toBe(true);
		expect(hide).not.toHaveBeenCalled();
		expect(addClass).toHaveBeenCalledWith('nova-notice-hidden');
		const followupNotice = new Notice('Follow-up');
		expect(followupNotice.messageEl.textContent).toBe('Follow-up');
	});
});
