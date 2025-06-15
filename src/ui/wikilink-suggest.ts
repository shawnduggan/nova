/**
 * Custom wikilink autocomplete for Nova textarea
 * Provides [[document]] suggestions when typing in Nova's textarea
 */

import { TFile, App } from 'obsidian';

export interface WikilinkSuggestion {
    file: TFile;
    displayText: string;
    score: number;
}

export class NovaWikilinkAutocomplete {
    private app: App;
    private textArea: HTMLTextAreaElement;
    private container: HTMLElement;
    private suggestionPopup: HTMLElement | null = null;
    private suggestions: WikilinkSuggestion[] = [];
    private selectedIndex: number = -1;
    private isVisible: boolean = false;
    private currentQuery: string = '';
    private currentTriggerPos: number = -1;
    private sidebarView: any; // Reference to NovaSidebarView

    constructor(app: App, textArea: HTMLTextAreaElement, container?: HTMLElement) {
        this.app = app;
        this.textArea = textArea;
        this.container = container || textArea.parentElement!;
        this.setupEventListeners();
    }

    setSidebarView(sidebarView: any): void {
        this.sidebarView = sidebarView;
    }

    private setupEventListeners(): void {
        this.textArea.addEventListener('input', this.handleInput.bind(this));
        this.textArea.addEventListener('keydown', this.handleKeydown.bind(this));
        
        // Close on focus loss
        this.textArea.addEventListener('blur', () => {
            // Delay to allow selection clicks
            setTimeout(() => this.hideSuggestions(), 150);
        });
        
        // Handle click outside
        document.addEventListener('click', (e) => {
            if (this.suggestionPopup && !this.suggestionPopup.contains(e.target as Node) && e.target !== this.textArea) {
                this.hideSuggestions();
            }
        });
    }

    private handleInput(): void {
        const text = this.textArea.value;
        const cursorPos = this.textArea.selectionStart;
        
        // Look for [[ pattern before cursor (simplified - no need for + prefix anymore)
        const beforeCursor = text.substring(0, cursorPos);
        const linkMatch = beforeCursor.match(/\[\[([^\]]*?)$/);
        
        if (linkMatch) {
            this.currentQuery = linkMatch[1] || '';
            this.currentTriggerPos = cursorPos - linkMatch[0].length;
            this.showSuggestions();
        } else {
            this.hideSuggestions();
        }
    }

    private handleKeydown(e: KeyboardEvent): void {
        if (!this.isVisible) return;
        
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                this.selectedIndex = Math.min(this.selectedIndex + 1, this.suggestions.length - 1);
                this.updateSelection();
                break;
                
            case 'ArrowUp':
                e.preventDefault();
                this.selectedIndex = Math.max(this.selectedIndex - 1, -1);
                this.updateSelection();
                break;
                
            case 'Enter':
            case 'Tab':
                if (this.selectedIndex >= 0 || this.suggestions.length > 0) {
                    e.preventDefault();
                    const index = this.selectedIndex >= 0 ? this.selectedIndex : 0;
                    this.selectSuggestion(this.suggestions[index]).then();
                }
                break;
                
            case 'Escape':
                e.preventDefault();
                this.hideSuggestions();
                break;
        }
    }

    private showSuggestions(): void {
        this.suggestions = this.getSuggestions(this.currentQuery);
        
        if (this.suggestions.length === 0) {
            this.hideSuggestions();
            return;
        }
        
        if (!this.suggestionPopup) {
            this.createSuggestionPopup();
        }
        
        this.renderSuggestions();
        this.positionPopup();
        this.isVisible = true;
        this.selectedIndex = 0;
        this.updateSelection();
    }

    private hideSuggestions(): void {
        if (this.suggestionPopup) {
            this.suggestionPopup.style.display = 'none';
        }
        this.isVisible = false;
        this.selectedIndex = -1;
    }

    private createSuggestionPopup(): void {
        this.suggestionPopup = document.createElement('div');
        this.suggestionPopup.className = 'nova-wikilink-suggestions';
        this.suggestionPopup.style.cssText = `
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
        
        // Insert in the provided container for consistent width
        this.container.appendChild(this.suggestionPopup);
    }

    private renderSuggestions(): void {
        if (!this.suggestionPopup) return;
        
        this.suggestionPopup.innerHTML = '';
        
        this.suggestions.forEach((suggestion, index) => {
            const item = document.createElement('div');
            item.className = 'nova-suggestion-item';
            item.style.cssText = `
                padding: 8px 12px;
                cursor: pointer;
                border-bottom: 1px solid var(--background-modifier-border-hover);
                transition: background-color 0.2s;
            `;
            
            // Name (standardized to match command picker)
            const nameEl = document.createElement('div');
            nameEl.className = 'nova-suggestion-name';
            nameEl.textContent = suggestion.file.basename;
            nameEl.style.cssText = `
                font-weight: 500;
                color: var(--text-normal);
                margin-bottom: 4px;
            `;
            item.appendChild(nameEl);
            
            // Description (standardized)
            const descEl = document.createElement('div');
            descEl.className = 'nova-suggestion-desc';
            descEl.textContent = `Link to document in ${suggestion.file.path.includes('/') ? suggestion.file.path.substring(0, suggestion.file.path.lastIndexOf('/')) : 'root'}`;
            descEl.style.cssText = `
                font-size: 0.85em;
                color: var(--text-muted);
                margin-bottom: 4px;
            `;
            item.appendChild(descEl);
            
            // Content Preview (standardized with monospace)
            const exampleEl = document.createElement('div');
            exampleEl.className = 'nova-suggestion-example';
            this.getFilePreview(suggestion.file).then(preview => {
                exampleEl.textContent = `Preview: ${preview}`;
            });
            exampleEl.style.cssText = `
                font-size: 0.8em;
                color: var(--text-accent);
                font-family: var(--font-monospace);
            `;
            item.appendChild(exampleEl);
            
            this.suggestionPopup!.appendChild(item);
            
            item.addEventListener('click', async () => {
                await this.selectSuggestion(suggestion);
            });
            
            item.addEventListener('mouseenter', () => {
                this.selectedIndex = index;
                this.updateSelection();
            });
        });
        
        this.suggestionPopup.style.display = 'block';
    }

    private updateSelection(): void {
        if (!this.suggestionPopup) return;
        
        const items = this.suggestionPopup.querySelectorAll('.nova-suggestion-item');
        items.forEach((item, index) => {
            const element = item as HTMLElement;
            if (index === this.selectedIndex) {
                element.style.backgroundColor = 'var(--background-modifier-hover)';
            } else {
                element.style.backgroundColor = '';
            }
        });
    }

    private positionPopup(): void {
        if (!this.suggestionPopup) return;
        
        // Position above the textarea with full container width (matching other pickers)
        this.suggestionPopup.style.position = 'absolute';
        this.suggestionPopup.style.left = '0';
        this.suggestionPopup.style.right = '0';
        this.suggestionPopup.style.bottom = '100%';
        this.suggestionPopup.style.marginBottom = '4px';
    }

    private async selectSuggestion(suggestion: WikilinkSuggestion): Promise<void> {
        const text = this.textArea.value;
        const cursorPos = this.textArea.selectionStart;
        
        // Find the [[ pattern to remove (simplified - no + prefix needed)
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
            await this.sidebarView.addFilesToContext([suggestion.file.basename]);
        }
        
        this.hideSuggestions();
        this.textArea.focus();
    }

    private getSuggestions(query: string): WikilinkSuggestion[] {
        const files = this.app.vault.getMarkdownFiles();
        const suggestions: WikilinkSuggestion[] = [];
        
        for (const file of files) {
            const score = this.scoreFile(file, query);
            if (score > 0) {
                suggestions.push({
                    file,
                    displayText: file.basename,
                    score
                });
            }
        }
        
        // Sort by score (highest first) and limit results
        return suggestions
            .sort((a, b) => b.score - a.score)
            .slice(0, 8);
    }

    private scoreFile(file: TFile, query: string): number {
        if (!query) return 50; // Show all files when no query
        
        const basename = file.basename.toLowerCase();
        const path = file.path.toLowerCase();
        const queryLower = query.toLowerCase();
        
        // Exact match
        if (basename === queryLower) return 100;
        
        // Starts with query
        if (basename.startsWith(queryLower)) return 80;
        
        // Contains query
        if (basename.includes(queryLower)) return 60;
        
        // Path contains query
        if (path.includes(queryLower)) return 40;
        
        // Fuzzy match
        if (this.fuzzyMatch(basename, queryLower)) return 20;
        
        return 0;
    }

    private fuzzyMatch(text: string, query: string): boolean {
        let textIndex = 0;
        let queryIndex = 0;
        
        while (textIndex < text.length && queryIndex < query.length) {
            if (text[textIndex] === query[queryIndex]) {
                queryIndex++;
            }
            textIndex++;
        }
        
        return queryIndex === query.length;
    }

    private async getFilePreview(file: TFile): Promise<string> {
        try {
            const content = await this.app.vault.read(file);
            
            // Remove frontmatter if present
            let textContent = content;
            if (content.startsWith('---')) {
                const frontmatterEnd = content.indexOf('---', 3);
                if (frontmatterEnd !== -1) {
                    textContent = content.substring(frontmatterEnd + 3);
                }
            }
            
            // Get first 50 characters of actual text content, removing markdown formatting
            const plainText = textContent
                .replace(/^#+ /gm, '') // Remove headings
                .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
                .replace(/\*(.*?)\*/g, '$1') // Remove italic
                .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Remove links
                .replace(/\n/g, ' ') // Replace newlines with spaces
                .trim();
            
            return plainText.length > 50 ? plainText.substring(0, 50) + '...' : plainText || 'Empty file';
        } catch (error) {
            return 'Unable to load preview';
        }
    }

    destroy(): void {
        if (this.suggestionPopup) {
            this.suggestionPopup.remove();
        }
    }
}