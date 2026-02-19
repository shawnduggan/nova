/**
 * @file Sidebar Interface - Typed interface for sidebar communication
 * Decouples SelectionContextMenu from NovaSidebarView
 */

import { ChatRenderer } from './chat-renderer';

/**
 * Interface for sidebar operations needed by SelectionContextMenu
 * Allows communication without direct SidebarView dependency
 */
export interface SidebarViewInterface {
	/**
	 * Add a success message to the chat
	 */
	addSuccessMessage(content: string): void;

	/**
	 * Add an error message to the chat
	 */
	addErrorMessage(content: string): void;

	/**
	 * Set the processing state (shows/hides stop button)
	 */
	setProcessingState(isProcessing: boolean): void;

	/**
	 * Get the chat renderer
	 */
	chatRenderer: ChatRenderer;
}

/**
 * Event types for sidebar communication
 */
export const SIDEBAR_EVENTS = {
	PROCESSING_STATE_CHANGE: 'nova:processing-state-change',
	ADD_SUCCESS_MESSAGE: 'nova:add-success-message',
	ADD_ERROR_MESSAGE: 'nova:add-error-message',
	ADD_MESSAGE: 'nova:add-message',
} as const;

/**
 * Payload for processing state change events
 */
export interface ProcessingStateChangePayload {
	isProcessing: boolean;
}

/**
 * Payload for message events
 */
export interface MessagePayload {
	content: string;
}
