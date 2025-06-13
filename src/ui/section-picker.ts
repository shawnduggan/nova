import { App, TFile } from 'obsidian';
import { DocumentEngine } from '../core/document-engine';

export interface SectionPathItem {
    /** Display name with proper indentation */
    displayName: string;
    /** Actual path for targeting (e.g., "Methods/Data Collection") */
    targetPath: string;
    /** Original heading text */
    headingText: string;
    /** Nesting level (0 = top level) */
    level: number;
    /** Line number in document */
    line: number;
    /** Content preview */
    preview?: string;
}

/**
 * Section path picker component for "/" trigger
 * Displays hierarchical document structure for precise targeting
 */
export class SectionPicker {
    private app: App;
    private documentEngine: DocumentEngine;
    private container: HTMLElement;
    private pickerEl!: HTMLElement;
    private items: SectionPathItem[] = [];
    private filteredItems: SectionPathItem[] = [];
    private selectedIndex: number = -1;
    private isVisible: boolean = false;
    private onSelectCallback?: (path: string) => void;
    private onCancelCallback?: () => void;

    constructor(app: App, documentEngine: DocumentEngine, container: HTMLElement) {
        this.app = app;
        this.documentEngine = documentEngine;
        this.container = container;
        this.createPicker();
    }

    private createPicker(): void {
        // Create the picker element manually since container might not have createDiv
        this.pickerEl = document.createElement('div');
        this.pickerEl.className = 'nova-section-picker';
        this.pickerEl.style.cssText = `
            position: absolute;
            bottom: 100%;
            left: 0;
            right: 0;
            background: var(--background-primary);
            border: 1px solid var(--background-modifier-border);
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            max-height: 200px;
            overflow-y: auto;
            z-index: 1000;
            display: none;
            margin-bottom: 4px;
        `;
        
        // Add the empty method for Obsidian compatibility
        (this.pickerEl as any).empty = function() {
            this.innerHTML = '';
        };
        
        // Add the createDiv method for Obsidian compatibility
        (this.pickerEl as any).createDiv = function(options?: { cls?: string }) {
            const div = document.createElement('div');
            if (options?.cls) {
                div.className = options.cls;
            }
            this.appendChild(div);
            
            // Add empty method to created divs too
            (div as any).empty = function() {
                this.innerHTML = '';
            };
            (div as any).createDiv = this.createDiv;
            (div as any).createEl = function(tag: string, options?: { text?: string; cls?: string }) {
                const el = document.createElement(tag);
                if (options?.text) el.textContent = options.text;
                if (options?.cls) el.className = options.cls;
                this.appendChild(el);
                return el;
            };
            
            return div;
        };
        
        // Add the createEl method
        (this.pickerEl as any).createEl = function(tag: string, options?: { text?: string; cls?: string }) {
            const el = document.createElement(tag);
            if (options?.text) el.textContent = options.text;
            if (options?.cls) el.className = options.cls;
            this.appendChild(el);
            return el;
        };
        
        // Append to container
        this.container.appendChild(this.pickerEl);
    }

    /**
     * Show the section picker with current document sections
     */
    async show(filterText: string = ''): Promise<void> {
        await this.loadSections();
        this.applyFilter(filterText);
        this.render();
        this.pickerEl.style.display = 'block';
        this.isVisible = true;
        this.selectedIndex = 0; // Select first item by default
        this.updateSelection();
    }

    /**
     * Hide the section picker
     */
    hide(): void {
        this.pickerEl.style.display = 'none';
        this.isVisible = false;
        this.selectedIndex = -1;
    }

    /**
     * Check if picker is currently visible
     */
    getIsVisible(): boolean {
        return this.isVisible;
    }

    /**
     * Load sections from current document
     */
    private async loadSections(): Promise<void> {
        try {
            const sectionPaths = await this.documentEngine.getAllSectionPaths();
            this.items = sectionPaths.map(section => ({
                displayName: section.displayName,
                targetPath: section.targetPath,
                headingText: section.headingText,
                level: section.level,
                line: section.line,
                preview: section.preview
            }));
        } catch (error) {
            console.error('Failed to load sections:', error);
            this.items = [];
        }
    }


    /**
     * Apply filter to sections based on search text
     */
    private applyFilter(filterText: string): void {
        if (!filterText.trim()) {
            this.filteredItems = [...this.items];
            return;
        }

        const searchLower = filterText.toLowerCase();
        this.filteredItems = this.items.filter(item =>
            item.headingText.toLowerCase().includes(searchLower) ||
            item.targetPath.toLowerCase().includes(searchLower)
        );
    }

    /**
     * Render the picker items
     */
    private render(): void {
        this.pickerEl.empty();

        if (this.filteredItems.length === 0) {
            const noResultsEl = (this.pickerEl as any).createDiv({ cls: 'nova-section-picker-no-results' });
            noResultsEl.style.cssText = `
                padding: 12px;
                text-align: center;
                color: var(--text-muted);
                font-size: 0.9em;
            `;
            noResultsEl.textContent = 'No sections found';
            return;
        }

        this.filteredItems.forEach((item, index) => {
            const itemEl = (this.pickerEl as any).createDiv({ cls: 'nova-section-picker-item' });
            itemEl.style.cssText = `
                padding: 8px 12px;
                cursor: pointer;
                border-bottom: 1px solid var(--background-modifier-border-hover);
                transition: background-color 0.2s;
            `;

            // Display name with proper indentation
            const nameEl = document.createElement('div');
            nameEl.textContent = item.displayName;
            nameEl.style.cssText = `
                font-weight: 500;
                color: var(--text-normal);
                margin-bottom: 4px;
                white-space: pre;
                font-family: var(--font-monospace);
            `;
            itemEl.appendChild(nameEl);

            // Path preview
            const pathEl = document.createElement('div');
            pathEl.textContent = item.targetPath;
            pathEl.style.cssText = `
                font-size: 0.85em;
                color: var(--text-muted);
                margin-bottom: 4px;
            `;
            itemEl.appendChild(pathEl);

            // Click handler
            itemEl.addEventListener('click', () => {
                this.selectItem(index);
            });

            // Hover effects
            itemEl.addEventListener('mouseenter', () => {
                this.selectedIndex = index;
                this.updateSelection();
            });
        });

        this.updateSelection();
    }

    /**
     * Update visual selection state
     */
    private updateSelection(): void {
        const items = this.pickerEl.querySelectorAll('.nova-section-picker-item');
        items.forEach((item, index) => {
            const element = item as HTMLElement;
            if (index === this.selectedIndex) {
                element.style.background = 'var(--background-modifier-hover)';
            } else {
                element.style.background = 'transparent';
            }
        });
    }

    /**
     * Handle keyboard navigation
     */
    handleKeyDown(event: KeyboardEvent): boolean {
        if (!this.isVisible) return false;

        switch (event.key) {
            case 'ArrowDown':
                this.selectedIndex = Math.min(this.selectedIndex + 1, this.filteredItems.length - 1);
                this.updateSelection();
                return true;

            case 'ArrowUp':
                this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
                this.updateSelection();
                return true;

            case 'Enter':
                if (this.selectedIndex >= 0 && this.selectedIndex < this.filteredItems.length) {
                    this.selectItem(this.selectedIndex);
                }
                return true;

            case 'Escape':
                this.cancel();
                return true;

            default:
                return false;
        }
    }

    /**
     * Select a section by index
     */
    private selectItem(index: number): void {
        if (index >= 0 && index < this.filteredItems.length) {
            const item = this.filteredItems[index];
            this.hide();
            this.onSelectCallback?.(item.targetPath);
        }
    }

    /**
     * Cancel selection
     */
    private cancel(): void {
        this.hide();
        this.onCancelCallback?.();
    }

    /**
     * Update filter and re-render
     */
    updateFilter(filterText: string): void {
        this.applyFilter(filterText);
        this.render();
        this.selectedIndex = this.filteredItems.length > 0 ? 0 : -1;
        this.updateSelection();
    }

    /**
     * Set selection callback
     */
    onSelect(callback: (path: string) => void): void {
        this.onSelectCallback = callback;
    }

    /**
     * Set cancel callback
     */
    onCancel(callback: () => void): void {
        this.onCancelCallback = callback;
    }

    /**
     * Get current selected item
     */
    getSelectedItem(): SectionPathItem | null {
        if (this.selectedIndex >= 0 && this.selectedIndex < this.filteredItems.length) {
            return this.filteredItems[this.selectedIndex];
        }
        return null;
    }

    /**
     * Cleanup resources
     */
    cleanup(): void {
        this.hide();
        this.pickerEl.remove();
    }
}