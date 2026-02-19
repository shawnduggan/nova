/**
 * @file SidebarEvents - Custom DOM events for decoupled sidebar communication
 *
 * Components that need to interact with the sidebar (e.g., SelectionContextMenu)
 * dispatch these events instead of importing NovaSidebarView directly.
 * The sidebar subscribes via registerDomEvent for proper Obsidian cleanup.
 */

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

// ── Typed CustomEvent helpers ─────────────────────────────────────────

export type SidebarProcessingEvent = CustomEvent<SidebarProcessingDetail>;
export type SidebarChatMessageEvent = CustomEvent<SidebarChatMessageDetail>;

// ── Dispatch helpers ──────────────────────────────────────────────────

/**
 * Set or clear the sidebar's processing state (e.g., show/hide stop button).
 */
export function dispatchSidebarProcessing(processing: boolean): void {
	document.dispatchEvent(
		new CustomEvent<SidebarProcessingDetail>(SIDEBAR_PROCESSING_EVENT, {
			detail: { processing }
		})
	);
}

/**
 * Send a chat message to the sidebar.
 */
export function dispatchSidebarChatMessage(
	type: SidebarChatMessageType,
	content: string,
	options?: { persist?: boolean; statusOptions?: { type: 'pill'; variant: 'system' } }
): void {
	document.dispatchEvent(
		new CustomEvent<SidebarChatMessageDetail>(SIDEBAR_CHAT_MESSAGE_EVENT, {
			detail: {
				type,
				content,
				persist: options?.persist,
				statusOptions: options?.statusOptions
			}
		})
	);
}

/**
 * Check whether the sidebar is currently mounted (has at least one leaf).
 * This is a lightweight check that avoids importing NovaSidebarView.
 */
export function isSidebarAvailable(app: { workspace: { getLeavesOfType: (type: string) => unknown[] } }): boolean {
	return app.workspace.getLeavesOfType('nova-sidebar').length > 0;
}
