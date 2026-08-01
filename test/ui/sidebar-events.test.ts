import type { Workspace } from 'obsidian';
import {
	SIDEBAR_CHAT_MESSAGE_EVENT,
	SIDEBAR_PROCESSING_EVENT,
	dispatchSidebarChatMessage,
	dispatchSidebarProcessing
} from '../../src/ui/sidebar-events';

describe('sidebar workspace events', () => {
	test('dispatches processing state through the workspace event bus', () => {
		const workspace = { trigger: jest.fn() } as unknown as Workspace;

		dispatchSidebarProcessing(workspace, true);

		expect(workspace.trigger).toHaveBeenCalledWith(SIDEBAR_PROCESSING_EVENT, {
			processing: true
		});
	});

	test('dispatches typed chat details through the workspace event bus', () => {
		const workspace = { trigger: jest.fn() } as unknown as Workspace;

		dispatchSidebarChatMessage(workspace, 'status', 'Challenge canceled', {
			persist: false,
			statusOptions: { type: 'pill', variant: 'system' }
		});

		expect(workspace.trigger).toHaveBeenCalledWith(SIDEBAR_CHAT_MESSAGE_EVENT, {
			type: 'status',
			content: 'Challenge canceled',
			persist: false,
			statusOptions: { type: 'pill', variant: 'system' }
		});
	});
});
