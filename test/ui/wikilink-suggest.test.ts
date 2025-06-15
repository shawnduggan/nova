import { NovaWikilinkAutocomplete } from '../../src/ui/wikilink-suggest';
import { App, TFile, Vault } from 'obsidian';

// Mock the Obsidian modules
jest.mock('obsidian', () => ({
    TFile: class TFile {
        name: string;
        basename: string;
        path: string;
        
        constructor(name: string, path: string = name) {
            this.name = name;
            this.path = path;
            this.basename = name.replace(/\.md$/, '');
        }
    }
}));

// Mock DOM methods
Object.defineProperty(HTMLElement.prototype, 'createDiv', {
    value: function(this: HTMLElement, options?: any) {
        const div = document.createElement('div');
        if (options?.cls) {
            div.className = options.cls;
        }
        this.appendChild(div);
        return div;
    }
});

Object.defineProperty(HTMLElement.prototype, 'empty', {
    value: function(this: HTMLElement) {
        this.innerHTML = '';
    }
});

describe('NovaWikilinkAutocomplete', () => {
    let autocomplete: NovaWikilinkAutocomplete;
    let mockApp: App;
    let mockVault: Vault;
    let mockFiles: TFile[];
    let mockTextArea: HTMLTextAreaElement;
    let mockContainer: HTMLElement;

    beforeEach(() => {
        // Create mock files
        mockFiles = [
            new (TFile as any)('Note 1.md', 'Note 1.md'),
            new (TFile as any)('Note 2.md', 'subfolder/Note 2.md'),
            new (TFile as any)('Important Document.md', 'docs/Important Document.md'),
            new (TFile as any)('Test File.md', 'Test File.md')
        ];

        mockVault = {
            getMarkdownFiles: jest.fn().mockReturnValue(mockFiles)
        } as any;

        mockApp = {
            vault: mockVault
        } as any;

        // Create mock DOM elements
        mockContainer = document.createElement('div');
        mockTextArea = document.createElement('textarea');
        mockContainer.appendChild(mockTextArea);
        document.body.appendChild(mockContainer);

        // Mock textarea properties and methods
        Object.defineProperty(mockTextArea, 'selectionStart', {
            get: jest.fn(() => 0),
            set: jest.fn(),
            configurable: true
        });

        Object.defineProperty(mockTextArea, 'parentElement', {
            get: () => mockContainer,
            configurable: true
        });

        mockTextArea.setSelectionRange = jest.fn();
        mockTextArea.focus = jest.fn();

        autocomplete = new NovaWikilinkAutocomplete(mockApp, mockTextArea);
    });

    afterEach(() => {
        if (autocomplete) {
            autocomplete.destroy();
        }
        document.body.removeChild(mockContainer);
    });

    describe('File Scoring', () => {
        it('should score exact matches highest', () => {
            // Access private method for testing
            const score = (autocomplete as any).scoreFile(mockFiles[0], 'note 1');
            expect(score).toBe(100);
        });

        it('should score starts-with matches high', () => {
            const score = (autocomplete as any).scoreFile(mockFiles[0], 'note');
            expect(score).toBe(80);
        });

        it('should score contains matches medium', () => {
            const score = (autocomplete as any).scoreFile(mockFiles[2], 'document');
            expect(score).toBe(60);
        });

        it('should return 0 for non-matching files', () => {
            const score = (autocomplete as any).scoreFile(mockFiles[0], 'xyz');
            expect(score).toBe(0);
        });
    });

    describe('Fuzzy Matching', () => {
        it('should match consecutive characters', () => {
            const result = (autocomplete as any).fuzzyMatch('note', 'not');
            expect(result).toBe(true);
        });

        it('should match non-consecutive characters', () => {
            const result = (autocomplete as any).fuzzyMatch('important document', 'ipt');
            expect(result).toBe(true);
        });

        it('should not match if all characters are not present', () => {
            const result = (autocomplete as any).fuzzyMatch('note', 'xyz');
            expect(result).toBe(false);
        });
    });

    describe('Suggestion Generation', () => {
        it('should return suggestions for empty query', () => {
            const suggestions = (autocomplete as any).getSuggestions('');
            expect(suggestions.length).toBeGreaterThan(0);
            expect(suggestions.length).toBeLessThanOrEqual(8);
        });

        it('should filter suggestions by query', () => {
            const suggestions = (autocomplete as any).getSuggestions('note');
            expect(suggestions.length).toBe(2); // Note 1 and Note 2
            expect(suggestions[0].file.basename).toMatch(/note/i);
        });

        it('should limit results to 8', () => {
            // Add more files to test limit
            const manyFiles = [];
            for (let i = 0; i < 20; i++) {
                manyFiles.push(new (TFile as any)(`File ${i}.md`));
            }
            mockVault.getMarkdownFiles = jest.fn().mockReturnValue(manyFiles);
            
            const suggestions = (autocomplete as any).getSuggestions('file');
            expect(suggestions.length).toBeLessThanOrEqual(8);
        });
    });

    describe('Input Detection', () => {
        it('should detect [[ pattern', () => {
            mockTextArea.value = 'Some text [[';
            Object.defineProperty(mockTextArea, 'selectionStart', {
                get: () => 13,
                configurable: true
            });

            const inputEvent = new Event('input');
            mockTextArea.dispatchEvent(inputEvent);

            // Should create suggestion popup (tested indirectly)
            expect(mockVault.getMarkdownFiles).toHaveBeenCalled();
        });

        it('should detect +[[ pattern for persistent context', () => {
            mockTextArea.value = 'Some text +[[';
            Object.defineProperty(mockTextArea, 'selectionStart', {
                get: () => 14,
                configurable: true
            });

            const inputEvent = new Event('input');
            mockTextArea.dispatchEvent(inputEvent);

            expect(mockVault.getMarkdownFiles).toHaveBeenCalled();
        });
    });

    describe('Cleanup', () => {
        it('should properly clean up DOM elements', () => {
            const popup = (autocomplete as any).suggestionPopup;
            if (popup) {
                expect(popup.parentElement).toBeTruthy();
            }
            
            autocomplete.destroy();
            
            if (popup) {
                expect(popup.parentElement).toBeFalsy();
            }
        });
    });

    describe('Auto-selection', () => {
        it('should auto-select first item when showing suggestions', () => {
            // Trigger suggestions
            mockTextArea.value = 'Test [[';
            Object.defineProperty(mockTextArea, 'selectionStart', {
                get: () => 7,
                configurable: true
            });

            const inputEvent = new Event('input');
            mockTextArea.dispatchEvent(inputEvent);

            // Check that first item is selected
            expect((autocomplete as any).selectedIndex).toBe(0);
        });

        it('should select first item on Enter even if not explicitly selected', () => {
            // Setup suggestions
            mockTextArea.value = '[[note';
            Object.defineProperty(mockTextArea, 'selectionStart', {
                get: () => 6,
                configurable: true
            });

            mockTextArea.dispatchEvent(new Event('input'));

            // Reset selection to -1 to simulate no explicit selection
            (autocomplete as any).selectedIndex = -1;

            // Press Enter
            const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
            Object.defineProperty(enterEvent, 'preventDefault', { value: jest.fn() });
            
            mockTextArea.dispatchEvent(enterEvent);

            // Should have selected something
            expect(enterEvent.preventDefault).toHaveBeenCalled();
            expect(mockTextArea.value).toContain('[[Note');
        });
    });
});