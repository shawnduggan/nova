/**
 * @file StreamingManager notice compatibility tests
 */

import * as obsidian from 'obsidian';
import { Notice } from 'obsidian';
import { StreamingManager } from '../../src/ui/streaming-manager';

type StreamingManagerState = {
	thinkingNotice: Notice | null;
	startNoticeDotsAnimation(actionType: 'chat'): void;
};

describe('StreamingManager notice compatibility', () => {
	beforeEach(() => {
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.restoreAllMocks();
		jest.useRealTimers();
	});

	test('uses containerEl on supported Obsidian versions', () => {
		jest.spyOn(obsidian, 'requireApiVersion').mockReturnValue(true);
		const manager = new StreamingManager({ registerInterval: (id: number) => id } as never);
		const state = manager as unknown as StreamingManagerState;
		const notice = new Notice('Thinking', 0);
		state.thinkingNotice = notice;
		const hide = jest.spyOn(notice, 'hide');

		manager.stopAnimation();

		expect(notice.containerEl.classList.contains('nova-notice-hidden')).toBe(true);
		expect(hide).not.toHaveBeenCalled();
	});

	test('uses noticeEl without breaking later notices on older supported Obsidian versions', () => {
		jest.spyOn(obsidian, 'requireApiVersion').mockReturnValue(false);
		const manager = new StreamingManager({ registerInterval: (id: number) => id } as never);
		const state = manager as unknown as StreamingManagerState;
		const notice = new Notice('Thinking', 0);
		state.thinkingNotice = notice;
		const hide = jest.spyOn(notice, 'hide');

		manager.stopAnimation();

		expect(hide).not.toHaveBeenCalled();
		expect(notice.noticeEl.classList.contains('nova-notice-hidden')).toBe(true);
		expect(notice.containerEl.classList.contains('nova-notice-hidden')).toBe(false);
		const followupNotice = new Notice('Follow-up');
		expect(followupNotice.messageEl.textContent).toBe('Follow-up');
	});

	test('updates notice text through the public Notice API', () => {
		const manager = new StreamingManager({ registerInterval: (id: number) => id } as never);
		const state = manager as unknown as StreamingManagerState;
		const notice = new Notice('Thinking', 0);
		state.thinkingNotice = notice;
		const setMessage = jest.spyOn(notice, 'setMessage');

		state.startNoticeDotsAnimation('chat');
		jest.advanceTimersByTime(400);

		expect(setMessage).toHaveBeenCalledTimes(1);
		manager.stopAnimation();
	});
});
