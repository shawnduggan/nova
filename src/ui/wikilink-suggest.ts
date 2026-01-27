/**
 * @file WikilinkSuggest - Autocomplete for [[wikilinks]] in input
 */

import { TFile, App, FuzzySuggestModal, FuzzyMatch, Plugin } from 'obsidian';

export class NovaWikilinkAutocomplete {
    private app: App;
    private plugin: Plugin;
    private textArea: HTMLTextAreaElement;
    private sidebarView: { addFilesToContext: (filenames: string[]) => Promise<void> } | null = null; // Reference to NovaSidebarView
    private lastTriggerPos: number = -1;
    private inputHandler!: (event: Event) => void;

    constructor(app: App, plugin: Plugin, textArea: HTMLTextAreaElement, _container?: HTMLElement) {
        this.app = app;
        this.plugin = plugin;
        this.textArea = textArea;
        this.setupEventListeners();
    }

    setSidebarView(sidebarView: { addFilesToContext: (filenames: string[]) => Promise<void> }): void {
        this.sidebarView = sidebarView;
    }

    private setupEventListeners(): void {
        this.inputHandler = this.handleInput.bind(this);
        this.plugin.registerDomEvent(this.textArea, 'input', this.inputHandler);
    }

    private handleInput(): void {
        const text = this.textArea.value;
        const cursorPos = this.textArea.selectionStart;
        
        // Look for [[ pattern before cursor
        const beforeCursor = text.substring(0, cursorPos);
        const linkMatch = beforeCursor.match(/\[\[([^\]]*?)$/);
        
        if (linkMatch && cursorPos !== this.lastTriggerPos) {
            this.lastTriggerPos = cursorPos;
            this.showNativeFileModal();
        }
    }

    private showNativeFileModal(): void {
        // Get current file from sidebar view or workspace
        const currentFile = this.app.workspace.getActiveFile();
        
        const modal = new WikilinkFileModal(
            this.app,
            (file: TFile) => {
                void this.selectFile(file);
            },
            () => {
                // User cancelled - reset trigger position
                this.lastTriggerPos = -1;
            },
            currentFile
        );
        modal.open();
    }

    private async selectFile(file: TFile): Promise<void> {
        const text = this.textArea.value;
        const cursorPos = this.textArea.selectionStart;
        
        // Find the [[ pattern to remove
        const beforeCursor = text.substring(0, cursorPos);
        const linkMatch = beforeCursor.match(/\[\[([^\]]*?)$/);
        
        if (linkMatch) {
            const startPos = cursorPos - linkMatch[0].length;
            
            // Remove the incomplete [[ pattern from the input
            const newText = text.substring(0, startPos) + text.substring(cursorPos);
            this.textArea.value = newText;
            
            // Position cursor at the cleared position
            this.textArea.setSelectionRange(startPos, startPos);
            
            // Trigger input event to update any auto-grow functionality
            this.textArea.dispatchEvent(new Event('input', { bubbles: true }));
        }
        
        // Add file to context automatically 
        if (this.sidebarView && this.sidebarView.addFilesToContext) {
            await this.sidebarView.addFilesToContext([file.basename]);
        }
        
        // Reset trigger position
        this.lastTriggerPos = -1;
        this.textArea.focus();
    }

    destroy(): void {
        // Event listener cleanup is handled automatically by registerDomEvent
        // No manual cleanup needed
    }
}

/**
 * Native Obsidian file modal for wikilink selection
 */
class WikilinkFileModal extends FuzzySuggestModal<TFile> {
    private onSelectCallback: (file: TFile) => void;
    private onCancelCallback?: () => void;
    private currentFile: TFile | null;
    private allFiles: TFile[] = [];

    constructor(
        app: App,
        onSelect: (file: TFile) => void,
        onCancel?: () => void,
        currentFile?: TFile | null
    ) {
        super(app);
        this.onSelectCallback = onSelect;
        this.onCancelCallback = onCancel;
        this.currentFile = currentFile || null;
        
        this.setPlaceholder('Search files to add to context...');
        this.loadFiles();
    }

    onOpen(): void {
        void super.onOpen();
        this.addInstructions();
    }

    private addInstructions(): void {
        // Add the instruction footer like native Obsidian modals
        const instructionsEl = this.modalEl.createDiv({ cls: 'prompt-instructions' });
        
        const navInstruction = instructionsEl.createDiv({ cls: 'prompt-instruction' });
        navInstruction.createSpan({ cls: 'prompt-instruction-command', text: '↑↓' });
        navInstruction.createSpan({ text: 'to navigate' });

        const useInstruction = instructionsEl.createDiv({ cls: 'prompt-instruction' });
        useInstruction.createSpan({ cls: 'prompt-instruction-command', text: '↵' });
        useInstruction.createSpan({ text: 'to use' });

        const escInstruction = instructionsEl.createDiv({ cls: 'prompt-instruction' });
        escInstruction.createSpan({ cls: 'prompt-instruction-command', text: 'esc' });
        escInstruction.createSpan({ text: 'to dismiss' });
    }

    private loadFiles(): void {
        this.allFiles = this.app.vault.getMarkdownFiles();
        
        // Filter out the current file if it exists
        if (this.currentFile) {
            this.allFiles = this.allFiles.filter(file => file.path !== this.currentFile!.path);
        }
        
        // Sort by modification time (most recent first)
        this.allFiles.sort((a, b) => b.stat.mtime - a.stat.mtime);
    }

    getItems(): TFile[] {
        return this.allFiles;
    }

    getItemText(file: TFile): string {
        return file.basename;
    }

    onChooseItem(file: TFile): void {
        this.onSelectCallback(file);
    }

    renderSuggestion(match: FuzzyMatch<TFile>, el: HTMLElement): void {
        const file = match.item;
        
        // Create container with native Obsidian suggestion styling
        const container = el.createDiv({ cls: 'suggestion-content' });
        
        // Title
        const title = container.createDiv({ cls: 'suggestion-title' });
        title.textContent = file.basename;
        
        // Auxiliary info (path)
        const aux = container.createDiv({ cls: 'suggestion-aux' });
        aux.textContent = file.path;
    }

    onClose(): void {
        super.onClose();
        if (this.onCancelCallback) {
            this.onCancelCallback();
        }
    }
}