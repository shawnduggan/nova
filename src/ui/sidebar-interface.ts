/**
 * @file SidebarInterface - Interface for sidebar communication
 * Used to decouple SelectionContextMenu from direct NovaSidebarView coupling
 */

import type { ChatRenderer } from './chat-renderer';
import type { InputHandler } from './input-handler';
import type NovaPlugin from '../../main';

/**
 * Interface for sidebar communication
 * SelectionContextMenu uses this instead of directly referencing NovaSidebarView
 */
export interface ISidebarController {
    /** Get the input handler for setting processing state */
    getInputHandler(): InputHandler | null;
    
    /** Get the chat renderer for adding messages */
    getChatRenderer(): ChatRenderer | null;
}

/**
 * Default implementation that wraps a plugin's getCurrentSidebarView
 */
export class SidebarController implements ISidebarController {
    constructor(private getSidebarView: () => import('./sidebar-view').NovaSidebarView | null) {}
    
    getInputHandler(): InputHandler | null {
        const view = this.getSidebarView();
        return view?.inputHandler || null;
    }
    
    getChatRenderer(): ChatRenderer | null {
        const view = this.getSidebarView();
        return view?.chatRenderer || null;
    }
}
