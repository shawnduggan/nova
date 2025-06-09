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
    
    constructor(path?: string) {
        this.path = path || 'test.md';
        this.name = this.path.split('/').pop() || '';
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
    
    lastLine(): number {
        return this.lineCount() - 1;
    }
    
    getCursor(from?: string): EditorPosition {
        return this.cursor;
    }
    
    setSelection(from: EditorPosition, to: EditorPosition): void {
        this.selection = { from, to };
    }
    
    scrollIntoView(range: any, center?: boolean): void {
        // Mock implementation
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
    keymap: any;
    scope: any;
    fileManager: any;
    lastEvent: any;
    
    constructor() {
        this.vault = new Vault();
        this.workspace = new Workspace();
        this.metadataCache = new MetadataCache();
        this.keymap = {};
        this.scope = {};
        this.fileManager = {};
        this.lastEvent = null;
    }
    
    loadLocalStorage(key: string): string | null {
        return null;
    }
    
    saveLocalStorage(key: string, value: string): void {
        // Mock implementation
    }
    
    async loadData(key: string): Promise<any> {
        return null;
    }
    
    async saveData(key: string, data: any): Promise<void> {
        // Mock implementation
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
    private eventHandlers: Map<string, Array<() => void>> = new Map();
    
    getActiveFile(): TFile | null {
        return this.activeEditor?.file || null;
    }
    
    getActiveViewOfType<T>(type: any): T | null {
        return null;
    }
    
    getLeavesOfType(type: string): any[] {
        return [];
    }
    
    on(event: string, handler: () => void): { unsubscribe: () => void } {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event)!.push(handler);
        
        return {
            unsubscribe: () => {
                const handlers = this.eventHandlers.get(event);
                if (handlers) {
                    const index = handlers.indexOf(handler);
                    if (index !== -1) {
                        handlers.splice(index, 1);
                    }
                }
            }
        };
    }
    
    trigger(event: string): void {
        const handlers = this.eventHandlers.get(event) || [];
        handlers.forEach(handler => handler());
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

// Extend HTMLElement to add Obsidian-specific methods
class ExtendedHTMLElement extends HTMLElement {
    empty(): void {
        this.innerHTML = '';
    }
    
    createEl<T extends keyof HTMLElementTagNameMap>(
        tag: T, 
        attrs?: { text?: string; cls?: string; attr?: Record<string, string> }
    ): HTMLElementTagNameMap[T] {
        const el = document.createElement(tag);
        if (attrs?.text) el.textContent = attrs.text;
        if (attrs?.cls) el.className = attrs.cls;
        if (attrs?.attr) {
            Object.entries(attrs.attr).forEach(([key, value]) => {
                el.setAttribute(key, value);
            });
        }
        this.appendChild(el);
        return el;
    }
    
    createDiv(attrs?: { cls?: string; text?: string }): HTMLDivElement {
        return this.createEl('div', attrs);
    }
    
    createSpan(attrs?: { cls?: string; text?: string }): HTMLSpanElement {
        return this.createEl('span', attrs);
    }
    
    setText(text: string): void {
        this.textContent = text;
    }
    
    addClass(cls: string): void {
        this.classList.add(cls);
    }
    
    removeClass(cls: string): void {
        this.classList.remove(cls);
    }
    
    hasClass(cls: string): boolean {
        return this.classList.contains(cls);
    }
}

export class ItemView {
    app: App;
    containerEl: ExtendedHTMLElement;
    private _children: ExtendedHTMLElement[] = [];
    
    constructor(leaf: any) {
        this.app = new App();
        this.containerEl = this.createExtendedElement('div') as ExtendedHTMLElement;
        
        // Add child elements that Obsidian normally provides  
        const child1 = this.createExtendedElement('div');
        const child2 = this.createExtendedElement('div');
        this._children = [child1, child2];
        this.containerEl.appendChild(child1);
        this.containerEl.appendChild(child2);
        
        // Override children property
        Object.defineProperty(this.containerEl, 'children', {
            get: () => this._children
        });
    }
    
    private createExtendedElement(tag: string): ExtendedHTMLElement {
        const element = document.createElement(tag) as any;
        // Copy all methods from ExtendedHTMLElement prototype
        Object.setPrototypeOf(element, ExtendedHTMLElement.prototype);
        Object.getOwnPropertyNames(ExtendedHTMLElement.prototype).forEach(name => {
            if (name !== 'constructor' && typeof (ExtendedHTMLElement.prototype as any)[name] === 'function') {
                element[name] = (ExtendedHTMLElement.prototype as any)[name];
            }
        });
        return element as ExtendedHTMLElement;
    }
    
    async onOpen(): Promise<void> {}
    async onClose(): Promise<void> {}
    getViewType(): string { return ''; }
    getDisplayText(): string { return ''; }
    getIcon(): string { return ''; }
    
    registerEvent(event: any): void {
        // Mock implementation
    }
}

export class MarkdownView extends ItemView {
    editor: Editor | null = null;
    file: TFile | null = null;
    
    constructor(leaf: any) {
        super(leaf);
    }
    
    getViewType(): string { return 'markdown'; }
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

export class WorkspaceLeaf {
    view: ItemView | null = null;
    
    constructor() {}
    
    getViewState(): any {
        return { type: 'test-view' };
    }
    
    setViewState(state: any): void {
        // Mock implementation
    }
}

export class ButtonComponent {
    buttonEl: HTMLButtonElement;
    private clickHandler?: () => void;
    private disabled: boolean = false;
    
    constructor(containerEl: HTMLElement) {
        this.buttonEl = document.createElement('button');
        containerEl.appendChild(this.buttonEl);
    }
    
    setButtonText(text: string): this {
        this.buttonEl.textContent = text;
        return this;
    }
    
    setCta(): this {
        this.buttonEl.classList.add('mod-cta');
        return this;
    }
    
    setDisabled(disabled: boolean): this {
        this.disabled = disabled;
        this.buttonEl.disabled = disabled;
        return this;
    }
    
    onClick(handler: () => void): this {
        this.clickHandler = handler;
        this.buttonEl.addEventListener('click', handler);
        return this;
    }
}

export class TextAreaComponent {
    inputEl: HTMLTextAreaElement;
    private value: string = '';
    
    constructor(containerEl: HTMLElement) {
        this.inputEl = document.createElement('textarea');
        containerEl.appendChild(this.inputEl);
    }
    
    setPlaceholder(placeholder: string): this {
        this.inputEl.placeholder = placeholder;
        return this;
    }
    
    getValue(): string {
        return this.value;
    }
    
    setValue(value: string): this {
        this.value = value;
        this.inputEl.value = value;
        return this;
    }
}

export default {
    App,
    Editor,
    ItemView,
    MarkdownView,
    Plugin,
    PluginSettingTab,
    Setting,
    TFile,
    Notice,
    Vault,
    Workspace,
    MetadataCache,
    WorkspaceLeaf,
    ButtonComponent,
    TextAreaComponent
};