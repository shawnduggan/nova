/**
 * Mock implementation of Obsidian API for testing
 */

export class TFile {
    path: string;
    name: string;
    extension: string;
    basename: string;
    parent: any;
    stat: { ctime: number; mtime: number; size: number };
    vault: any;
    
    constructor(path: string) {
        this.path = path;
        this.name = path.split('/').pop() || '';
        const parts = this.name.split('.');
        this.extension = parts.length > 1 ? parts.pop() || '' : '';
        this.basename = parts.join('.');
        this.parent = null;
        this.stat = {
            ctime: Date.now(),
            mtime: Date.now(),
            size: 0
        };
        this.vault = null;
    }
}

export class Editor {
    private content: string;
    private cursor: EditorPosition;
    private selection: { from: EditorPosition; to: EditorPosition } | null;
    
    constructor(content: string = '') {
        this.content = content;
        this.cursor = { line: 0, ch: 0 };
        this.selection = null;
    }
    
    getValue(): string {
        return this.content;
    }
    
    setValue(content: string): void {
        this.content = content;
    }
    
    getSelection(): string {
        if (!this.selection) return '';
        // Simplified selection logic for testing
        return 'selected text';
    }
    
    getCursor(): EditorPosition {
        return this.cursor;
    }
    
    setCursor(pos: EditorPosition): void {
        this.cursor = pos;
    }
    
    replaceSelection(replacement: string): void {
        // Simplified replacement logic
        this.content = this.content + replacement;
    }
    
    replaceRange(replacement: string, from: EditorPosition, to?: EditorPosition): void {
        // Simplified replacement logic
        this.content = replacement;
    }
    
    getLine(line: number): string {
        const lines = this.content.split('\n');
        return lines[line] || '';
    }
    
    lineCount(): number {
        return this.content.split('\n').length;
    }
}

export interface EditorPosition {
    line: number;
    ch: number;
}

export class App {
    vault: Vault;
    workspace: Workspace;
    metadataCache: MetadataCache;
    
    constructor() {
        this.vault = new Vault();
        this.workspace = new Workspace();
        this.metadataCache = new MetadataCache();
    }
}

export class Vault {
    async read(file: TFile): Promise<string> {
        return 'mock file content';
    }
    
    async modify(file: TFile, content: string): Promise<void> {
        // Mock modify
    }
    
    async create(path: string, content: string): Promise<TFile> {
        return new TFile(path);
    }
    
    async delete(file: TFile): Promise<void> {
        // Mock delete
    }
    
    getAbstractFileByPath(path: string): TFile | null {
        return new TFile(path);
    }
}

export class Workspace {
    activeEditor: { editor: Editor | null; file: TFile | null } | null = null;
    
    getActiveFile(): TFile | null {
        return this.activeEditor?.file || null;
    }
    
    getActiveViewOfType<T>(type: any): T | null {
        return null;
    }
}

export class MetadataCache {
    getFileCache(file: TFile): any {
        return {
            headings: [
                { heading: 'Test Heading', level: 1, position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 0, col: 13, offset: 13 } } },
                { heading: 'Subheading', level: 2, position: { start: { line: 5, col: 0, offset: 50 }, end: { line: 5, col: 12, offset: 62 } } }
            ],
            sections: [],
            links: [],
            embeds: [],
            tags: [],
            frontmatter: null
        };
    }
}

export class ItemView {
    app: App;
    containerEl: HTMLElement;
    
    constructor(leaf: any) {
        this.app = new App();
        this.containerEl = document.createElement('div');
    }
    
    async onOpen(): Promise<void> {}
    async onClose(): Promise<void> {}
    getViewType(): string { return ''; }
    getDisplayText(): string { return ''; }
}

export class Plugin {
    app: App;
    manifest: any;
    
    constructor(app: App, manifest: any) {
        this.app = app;
        this.manifest = manifest;
    }
    
    async loadData(): Promise<any> {
        return {};
    }
    
    async saveData(data: any): Promise<void> {}
    
    registerView(type: string, viewCreator: any): void {}
    
    addCommand(command: any): void {}
    
    addRibbonIcon(icon: string, title: string, callback: any): void {}
    
    addSettingTab(tab: any): void {}
    
    async onload(): Promise<void> {}
    
    onunload(): void {}
}

export class PluginSettingTab {
    app: App;
    plugin: any;
    containerEl: HTMLElement;
    
    constructor(app: App, plugin: any) {
        this.app = app;
        this.plugin = plugin;
        this.containerEl = document.createElement('div');
    }
    
    display(): void {}
    hide(): void {}
}

export class Setting {
    settingEl: HTMLElement;
    
    constructor(containerEl: HTMLElement) {
        this.settingEl = document.createElement('div');
        containerEl.appendChild(this.settingEl);
    }
    
    setName(name: string): this {
        return this;
    }
    
    setDesc(desc: string): this {
        return this;
    }
    
    addText(callback: (text: any) => void): this {
        callback({
            setPlaceholder: () => {},
            setValue: () => {},
            onChange: () => {}
        });
        return this;
    }
    
    addToggle(callback: (toggle: any) => void): this {
        callback({
            setValue: () => {},
            onChange: () => {}
        });
        return this;
    }
    
    addDropdown(callback: (dropdown: any) => void): this {
        callback({
            addOption: () => {},
            setValue: () => {},
            onChange: () => {}
        });
        return this;
    }
}

export class Notice {
    constructor(message: string, timeout?: number) {
        // Mock implementation
    }
}

export default {
    App,
    Editor,
    ItemView,
    Plugin,
    PluginSettingTab,
    Setting,
    TFile,
    Notice,
    Vault,
    Workspace,
    MetadataCache
};