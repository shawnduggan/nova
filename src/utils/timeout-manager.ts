/**
 * @file TimeoutManager - Obsidian-compliant timeout management
 */

export class TimeoutManager {
    private timeouts: number[] = [];

    /**
     * Create a timeout with automatic cleanup tracking
     */
    addTimeout(callback: () => void, delay: number): number {
        const id = window.setTimeout(() => {
            callback();
            this.removeTimeout(id);
        }, delay);
        this.timeouts.push(id);
        return id;
    }

    /**
     * Manually remove a specific timeout
     */
    removeTimeout(id: number): void {
        window.clearTimeout(id);
        this.timeouts = this.timeouts.filter(t => t !== id);
    }

    /**
     * Clear all tracked timeouts
     */
    clearAll(): void {
        this.timeouts.forEach(id => window.clearTimeout(id));
        this.timeouts = [];
    }

    /**
     * Get count of active timeouts (for debugging)
     */
    getActiveCount(): number {
        return this.timeouts.length;
    }
}