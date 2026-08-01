/**
 * @file SidebarEvents - Workspace events for decoupled sidebar communication
 *
 * Components that need to interact with the sidebar (e.g., SelectionContextMenu)
 * trigger these events instead of importing NovaSidebarView directly.
 * The sidebar subscribes via registerEvent for proper Obsidian cleanup.
 */

import type { Workspace } from 'obsidian';

// ── Event name constants ──────────────────────────────────────────────

export const SIDEBAR_PROCESSING_EVENT = 'nova-sidebar-processing';
export const SIDEBAR_CHAT_MESSAGE_EVENT = 'nova-sidebar-chat-message';

// ── Event detail types ────────────────────────────────────────────────

export interface SidebarProcessingDetail {
	processing: boolean;
}

export type SidebarChatMessageType =
	| 'user'
	| 'assistant'
	| 'success'
	| 'error'
	| 'status';

export interface SidebarChatMessageDetail {
	type: SidebarChatMessageType;
	content: string;
	/** Whether to persist the message to conversation history */
	persist?: boolean;
	/** Status message options (only for type 'status') */
	statusOptions?: { type: 'pill'; variant: 'system' };
}

// ── Dispatch helpers ──────────────────────────────────────────────────

/**
 * Set or clear the sidebar's processing state (e.g., show/hide stop button).
 */
export function dispatchSidebarProcessing(workspace: Workspace, processing: boolean): void {
	workspace.trigger(SIDEBAR_PROCESSING_EVENT, { processing } satisfies SidebarProcessingDetail);
}

/**
 * Send a chat message to the sidebar.
 */
export function dispatchSidebarChatMessage(
	workspace: Workspace,
	type: SidebarChatMessageType,
	content: string,
	options?: { persist?: boolean; statusOptions?: { type: 'pill'; variant: 'system' } }
): void {
	workspace.trigger(SIDEBAR_CHAT_MESSAGE_EVENT, {
		type,
		content,
		persist: options?.persist,
		statusOptions: options?.statusOptions
	} satisfies SidebarChatMessageDetail);
}

/**
 * Check whether the sidebar is currently mounted (has at least one leaf).
 * This is a lightweight check that avoids importing NovaSidebarView.
 */
export function isSidebarAvailable(app: { workspace: { getLeavesOfType: (type: string) => unknown[] } }): boolean {
	return app.workspace.getLeavesOfType('nova-sidebar').length > 0;
}
