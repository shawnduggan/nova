/**
 * @file Typed registration for plugin-defined Obsidian workspace events
 */

import type { EventRef, Workspace } from 'obsidian';

interface CustomWorkspaceEventSource<T> {
	on(name: string, callback: (detail: T) => unknown): EventRef;
}

/**
 * Register a plugin-defined workspace event without weakening event payload types.
 * Obsidian supports custom names at runtime, but its Workspace.on declarations
 * enumerate only core event names.
 */
export function onWorkspaceEvent<T>(
	workspace: Workspace,
	name: string,
	callback: (detail: T) => unknown
): EventRef {
	return (workspace as unknown as CustomWorkspaceEventSource<T>).on(name, callback);
}
