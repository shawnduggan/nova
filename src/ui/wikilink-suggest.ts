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

    constructor(app: App, textArea: HTMLTextAreaElement, container?: HTMLElement) {
        this.app = app;
        this.textArea = textArea;
        this.container = container || textArea.parentElement!;
        this.setupEventListeners();
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
        
        // Look for [[ pattern before cursor
        const beforeCursor = text.substring(0, cursorPos);
        const linkMatch = beforeCursor.match(/(\+)?\[\[([^\]]*?)$/);
        
        if (linkMatch) {
            this.currentQuery = linkMatch[2] || '';
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
                if (this.selectedIndex >= 0) {
                    e.preventDefault();
                    this.selectSuggestion(this.suggestions[this.selectedIndex]);
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
        this.selectedIndex = -1;
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
            
            // File name
            const nameEl = document.createElement('div');
            nameEl.className = 'nova-suggestion-name';
            nameEl.textContent = suggestion.file.basename;
            nameEl.style.cssText = `
                font-weight: 500;
                color: var(--text-normal);
                margin-bottom: 4px;
            `;
            item.appendChild(nameEl);
            
            // File path (if different from name)
            if (suggestion.file.path !== suggestion.file.name) {
                const pathEl = document.createElement('div');
                pathEl.className = 'nova-suggestion-path';
                pathEl.textContent = suggestion.file.path;
                pathEl.style.cssText = `
                    font-size: 0.85em;
                    color: var(--text-muted);
                    margin-bottom: 4px;
                `;
                item.appendChild(pathEl);
            }
            
            this.suggestionPopup!.appendChild(item);
            
            item.addEventListener('click', () => {
                this.selectSuggestion(suggestion);
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

    private selectSuggestion(suggestion: WikilinkSuggestion): void {
        const text = this.textArea.value;
        const cursorPos = this.textArea.selectionStart;
        
        // Find the [[ pattern to replace
        const beforeCursor = text.substring(0, cursorPos);
        const linkMatch = beforeCursor.match(/(\+)?\[\[([^\]]*?)$/);
        
        if (!linkMatch) return;
        
        const isPersistent = !!linkMatch[1];
        const startPos = cursorPos - linkMatch[0].length;
        
        // Create the replacement text
        const linkText = `[[${suggestion.file.basename}]]`;
        const replacement = isPersistent ? `+${linkText}` : linkText;
        
        // Replace the text
        const newText = text.substring(0, startPos) + replacement + text.substring(cursorPos);
        this.textArea.value = newText;
        
        // Position cursor after the link
        const newCursorPos = startPos + replacement.length;
        this.textArea.setSelectionRange(newCursorPos, newCursorPos);
        
        // Trigger input event to update any auto-grow functionality
        this.textArea.dispatchEvent(new Event('input', { bubbles: true }));
        
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

    destroy(): void {
        if (this.suggestionPopup) {
            this.suggestionPopup.remove();
        }
    }
}