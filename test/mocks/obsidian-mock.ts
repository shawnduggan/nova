/**
 * Mock implementation of Obsidian API for testing
 */

// EventRef type for event subscriptions
export type EventRef = { unsubscribe?: () => void };

// DataWriteOptions interface
export interface DataWriteOptions {
    ctime?: number;
    mtime?: number;
}

// Stat type matching Obsidian's
export interface Stat {
    type: 'file' | 'folder';
    ctime: number;
    mtime: number;
    size: number;
}

// DataAdapter interface (minimal mock)
export interface DataAdapter {
    getName(): string;
    exists(normalizedPath: string, sensitive?: boolean): Promise<boolean>;
    stat(normalizedPath: string): Promise<Stat | null>;
    list(normalizedPath: string): Promise<{ files: string[]; folders: string[] }>;
    read(normalizedPath: string): Promise<string>;
    readBinary(normalizedPath: string): Promise<ArrayBuffer>;
    write(normalizedPath: string, data: string, options?: DataWriteOptions): Promise<void>;
    writeBinary(normalizedPath: string, data: ArrayBuffer, options?: DataWriteOptions): Promise<void>;
    append(normalizedPath: string, data: string, options?: DataWriteOptions): Promise<void>;
    process(normalizedPath: string, fn: (data: string) => string, options?: DataWriteOptions): Promise<string>;
    getResourcePath(normalizedPath: string): string;
    remove(normalizedPath: string): Promise<void>;
    rmdir(normalizedPath: string, recursive: boolean): Promise<void>;
    mkdir(normalizedPath: string): Promise<void>;
    trashSystem(normalizedPath: string): Promise<boolean>;
    trashLocal(normalizedPath: string): Promise<void>;
    rename(normalizedPath: string, normalizedNewPath: string): Promise<void>;
    copy(normalizedPath: string, normalizedNewPath: string): Promise<void>;
}

// Mock DataAdapter implementation
class MockDataAdapter implements DataAdapter {
    getName(): string { return 'mock-adapter'; }
    exists(_normalizedPath: string, _sensitive?: boolean): Promise<boolean> { return Promise.resolve(false); }
    stat(_normalizedPath: string): Promise<Stat | null> { return Promise.resolve(null); }
    list(_normalizedPath: string): Promise<{ files: string[]; folders: string[] }> { return Promise.resolve({ files: [], folders: [] }); }
    read(_normalizedPath: string): Promise<string> { return Promise.resolve(''); }
    readBinary(_normalizedPath: string): Promise<ArrayBuffer> { return Promise.resolve(new ArrayBuffer(0)); }
    write(_normalizedPath: string, _data: string, _options?: DataWriteOptions): Promise<void> { return Promise.resolve(); }
    writeBinary(_normalizedPath: string, _data: ArrayBuffer, _options?: DataWriteOptions): Promise<void> { return Promise.resolve(); }
    append(_normalizedPath: string, _data: string, _options?: DataWriteOptions): Promise<void> { return Promise.resolve(); }
    process(_normalizedPath: string, fn: (data: string) => string, _options?: DataWriteOptions): Promise<string> { return Promise.resolve(fn('')); }
    getResourcePath(normalizedPath: string): string { return `app://local/${normalizedPath}`; }
    remove(_normalizedPath: string): Promise<void> { return Promise.resolve(); }
    rmdir(_normalizedPath: string, _recursive: boolean): Promise<void> { return Promise.resolve(); }
    mkdir(_normalizedPath: string): Promise<void> { return Promise.resolve(); }
    trashSystem(_normalizedPath: string): Promise<boolean> { return Promise.resolve(true); }
    trashLocal(_normalizedPath: string): Promise<void> { return Promise.resolve(); }
    rename(_normalizedPath: string, _normalizedNewPath: string): Promise<void> { return Promise.resolve(); }
    copy(_normalizedPath: string, _normalizedNewPath: string): Promise<void> { return Promise.resolve(); }
}

// Forward declaration for circular reference
let mockVaultInstance: Vault | null = null;
let isConstructingVault = false;

// WeakMap to store vault references without adding properties to TAbstractFile
// This avoids structural type incompatibility with real Obsidian types
const vaultMap = new WeakMap<TAbstractFile, Vault>();

function getMockVault(): Vault {
    if (!mockVaultInstance && !isConstructingVault) {
        isConstructingVault = true;
        mockVaultInstance = new Vault();
        isConstructingVault = false;
    }
    return mockVaultInstance!;
}

// TAbstractFile base class
export abstract class TAbstractFile {
    path: string;
    name: string;
    parent: TFolder | null;

    constructor(path?: string) {
        this.path = path || '';
        this.name = this.path.split('/').pop() || '';
        this.parent = null;
    }

    // Lazy vault getter to avoid circular reference during construction
    get vault(): Vault {
        let v = vaultMap.get(this);
        if (!v) {
            v = getMockVault();
            vaultMap.set(this, v);
        }
        return v;
    }

    set vault(v: Vault) {
        vaultMap.set(this, v);
    }
}

export class TFolder extends TAbstractFile {
    children: TAbstractFile[];

    constructor(path?: string) {
        super(path);
        this.children = [];
    }

    isRoot(): boolean {
        return this.path === '' || this.path === '/';
    }
}

export class TFile extends TAbstractFile {
    extension: string;
    basename: string;
    stat: { ctime: number; mtime: number; size: number };

    constructor(path?: string) {
        super(path || 'test.md');
        const parts = this.name.split('.');
        this.extension = parts.length > 1 ? parts.pop() || '' : '';
        this.basename = parts.join('.');
        this.stat = {
            ctime: Date.now(),
            mtime: Date.now(),
            size: 0
        };
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
    
    replaceRange(replacement: string, _from: EditorPosition, _to?: EditorPosition): void {
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
    
    getCursor(_from?: string): EditorPosition {
        return this.cursor;
    }
    
    setSelection(from: EditorPosition, to: EditorPosition): void {
        this.selection = { from, to };
    }
    
    scrollIntoView(_range: { from: EditorPosition; to: EditorPosition }, _center?: boolean): void {
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
    keymap: Record<string, unknown>;
    scope: Record<string, unknown>;
    fileManager: Record<string, unknown>;
    lastEvent: Event | null;

    constructor() {
        this.vault = new Vault();
        this.workspace = new Workspace();
        this.metadataCache = new MetadataCache();
        this.keymap = {};
        this.scope = {};
        this.fileManager = {};
        this.lastEvent = null;
    }

    loadLocalStorage(_key: string): string | null {
        return null;
    }

    saveLocalStorage(_key: string, _value: string): void {
        // Mock implementation
    }

    loadData(_key: string): Promise<unknown> {
        return Promise.resolve(null);
    }

    saveData(_key: string, _data: unknown): Promise<void> {
        return Promise.resolve();
    }
}

// WeakMaps to store Vault internal state without adding properties
// This avoids structural type incompatibility with real Obsidian types
const vaultRootFolders = new WeakMap<Vault, TFolder>();
const vaultEventHandlers = new WeakMap<Vault, Map<string, Array<(...args: unknown[]) => unknown>>>();

export class Vault {
    // Required properties
    adapter: DataAdapter;
    configDir: string;

    constructor() {
        this.adapter = new MockDataAdapter();
        // eslint-disable-next-line obsidianmd/hardcoded-config-path -- Mock implementation uses fixed test value
        this.configDir = '.obsidian';
        vaultRootFolders.set(this, new TFolder('/'));
        vaultEventHandlers.set(this, new Map());
    }

    // Required methods
    getName(): string {
        return 'TestVault';
    }

    getRoot(): TFolder {
        return vaultRootFolders.get(this) || new TFolder('/');
    }

    read(_file: TFile): Promise<string> {
        return Promise.resolve('mock file content');
    }

    cachedRead(_file: TFile): Promise<string> {
        return Promise.resolve('mock cached content');
    }

    readBinary(_file: TFile): Promise<ArrayBuffer> {
        return Promise.resolve(new ArrayBuffer(0));
    }

    modify(_file: TFile, _content: string, _options?: DataWriteOptions): Promise<void> {
        return Promise.resolve();
    }

    modifyBinary(_file: TFile, _data: ArrayBuffer, _options?: DataWriteOptions): Promise<void> {
        return Promise.resolve();
    }

    append(_file: TFile, _data: string, _options?: DataWriteOptions): Promise<void> {
        return Promise.resolve();
    }

    process(_file: TFile, fn: (data: string) => string, _options?: DataWriteOptions): Promise<string> {
        return Promise.resolve(fn('mock content'));
    }

    create(path: string, _content: string, _options?: DataWriteOptions): Promise<TFile> {
        return Promise.resolve(new TFile(path));
    }

    createBinary(path: string, _data: ArrayBuffer, _options?: DataWriteOptions): Promise<TFile> {
        return Promise.resolve(new TFile(path));
    }

    createFolder(path: string): Promise<TFolder> {
        return Promise.resolve(new TFolder(path));
    }

    delete(_file: TAbstractFile, _force?: boolean): Promise<void> {
        return Promise.resolve();
    }

    trash(_file: TAbstractFile, _system: boolean): Promise<void> {
        return Promise.resolve();
    }

    rename(_file: TAbstractFile, _newPath: string): Promise<void> {
        return Promise.resolve();
    }

    copy(_file: TFile, _newPath: string): Promise<TFile> {
        return Promise.resolve(new TFile(_newPath));
    }

    getAbstractFileByPath(path: string): TAbstractFile | null {
        if (!path) return null;
        return new TFile(path);
    }

    getFileByPath(path: string): TFile | null {
        if (!path) return null;
        return new TFile(path);
    }

    getFolderByPath(path: string): TFolder | null {
        if (!path || path === '/') return this.getRoot();
        return new TFolder(path);
    }

    getResourcePath(_file: TFile): string {
        return 'app://local/mock-resource-path';
    }

    getAllLoadedFiles(): TAbstractFile[] {
        return [];
    }

    getMarkdownFiles(): TFile[] {
        return [];
    }

    getFiles(): TFile[] {
        return [];
    }

    getAllFolders(): TFolder[] {
        return [];
    }

    // Event handling
    on(name: string, callback: (...data: unknown[]) => unknown, _ctx?: unknown): EventRef {
        const handlers = vaultEventHandlers.get(this) || new Map();
        if (!handlers.has(name)) {
            handlers.set(name, []);
        }
        handlers.get(name)!.push(callback);
        return {
            unsubscribe: () => {
                const h = handlers.get(name);
                if (h) {
                    const idx = h.indexOf(callback);
                    if (idx !== -1) h.splice(idx, 1);
                }
            }
        };
    }

    off(name: string, callback: (...data: unknown[]) => unknown): void {
        const handlers = vaultEventHandlers.get(this);
        if (handlers) {
            const h = handlers.get(name);
            if (h) {
                const idx = h.indexOf(callback);
                if (idx !== -1) h.splice(idx, 1);
            }
        }
    }

    offref(ref: EventRef): void {
        ref.unsubscribe?.();
    }

    trigger(name: string, ...data: unknown[]): void {
        const handlers = vaultEventHandlers.get(this);
        const h = handlers?.get(name) || [];
        h.forEach(handler => handler(...data));
    }

    tryTrigger(_evt: EventRef, _args: unknown[]): void {
        // Mock implementation
    }
}

// Type for view constructor
type ViewConstructor<T> = new (...args: unknown[]) => T;

// Interface for workspace leaf (internal use)
interface WorkspaceLeafLike {
    view: MarkdownView | null;
}

export class Workspace {
    activeEditor: { editor: Editor | null; file: TFile | null } | null = null;
    private eventHandlers: Map<string, Array<() => void>> = new Map();

    getActiveFile(): TFile | null {
        return this.activeEditor?.file || null;
    }

    getActiveViewOfType<T>(_type: ViewConstructor<T>): T | null {
        return null;
    }

    getLeavesOfType(_type: string): WorkspaceLeafLike[] {
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

// Interface for cached file metadata
interface CachedMetadata {
    headings: Array<{ heading: string; level: number; position: { start: { line: number; col: number; offset: number }; end: { line: number; col: number; offset: number } } }>;
    sections: unknown[];
    links: unknown[];
    embeds: unknown[];
    tags: unknown[];
    frontmatter: Record<string, unknown> | null;
}

export class MetadataCache {
    getFileCache(_file: TFile): CachedMetadata {
        return {
            headings: [
                { heading: 'Test Document', level: 1, position: { start: { line: 0, col: 0, offset: 0 }, end: { line: 0, col: 15, offset: 15 } } }
            ],
            sections: [],
            links: [],
            embeds: [],
            tags: [],
            frontmatter: null
        };
    }

    getFirstLinkpathDest(_linkpath: string, _sourcePath: string): TFile | null {
        // Mock implementation - return a test file
        return new TFile('test.md');
    }
}

// Extend HTMLElement to add Obsidian-specific methods
class ExtendedHTMLElement extends HTMLElement {
    empty(): void {
        while (this.firstChild) {
            this.removeChild(this.firstChild);
        }
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

    constructor(_leaf: WorkspaceLeaf | null) {
        this.app = new App();
        this.containerEl = this.createExtendedElement('div');
        
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
        const element = document.createElement(tag) as unknown as ExtendedHTMLElement;
        // Copy all methods from ExtendedHTMLElement prototype
        Object.setPrototypeOf(element, ExtendedHTMLElement.prototype);
        const proto = ExtendedHTMLElement.prototype as unknown as Record<string, unknown>;
        Object.getOwnPropertyNames(ExtendedHTMLElement.prototype).forEach(name => {
            if (name !== 'constructor' && typeof proto[name] === 'function') {
                (element as unknown as Record<string, unknown>)[name] = proto[name];
            }
        });
        return element;
    }

    onOpen(): Promise<void> { return Promise.resolve(); }
    onClose(): Promise<void> { return Promise.resolve(); }
    getViewType(): string { return ''; }
    getDisplayText(): string { return ''; }
    getIcon(): string { return ''; }

    registerEvent(_event: EventRef): void {
        // Mock implementation
    }
    
    registerDomEvent(element: EventTarget, type: string, handler: EventListener): void {
        // Mock implementation for DOM event registration
        element.addEventListener(type, handler);
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
    
    async saveData(_data: any): Promise<void> {}
    
    registerView(_type: string, _viewCreator: any): void {}
    
    addCommand(_command: any): void {}
    
    addRibbonIcon(_icon: string, _title: string, _callback: any): void {}
    
    addSettingTab(_tab: any): void {}
    
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
    controlEl: HTMLElement;
    
    constructor(containerEl: HTMLElement) {
        this.settingEl = document.createElement('div');
        this.controlEl = document.createElement('div') as any;
        this.controlEl.createDiv = function(options?: any) {
            const div = document.createElement('div') as any;
            if (options?.cls) div.className = options.cls;
            if (options?.text) div.textContent = options.text;
            this.appendChild(div);
            div.createDiv = this.createDiv;
            return div;
        };
        this.settingEl.appendChild(this.controlEl);
        containerEl.appendChild(this.settingEl);
    }
    
    setName(_name: string): this {
        return this;
    }
    
    setDesc(_desc: string): this {
        return this;
    }
    
    addText(callback: (text: any) => void): this {
        const inputEl = document.createElement('input');
        callback({
            inputEl: inputEl,
            setPlaceholder: function(placeholder: string) { 
                inputEl.placeholder = placeholder;
                return this;
            },
            setValue: function(value: string) { 
                inputEl.value = value;
                return this;
            },
            onChange: function(handler: (value: string) => void) { 
                inputEl.addEventListener('change', (e) => handler((e.target as HTMLInputElement).value));
                return this;
            }
        });
        return this;
    }
    
    addToggle(callback: (toggle: any) => void): this {
        const toggleEl = document.createElement('input');
        toggleEl.type = 'checkbox';
        callback({
            toggleEl: toggleEl,
            setValue: function(value: boolean) {
                toggleEl.checked = value;
                return this;
            },
            onChange: function(handler: (value: boolean) => void) {
                toggleEl.addEventListener('change', (e) => handler((e.target as HTMLInputElement).checked));
                return this;
            }
        });
        return this;
    }
    
    addDropdown(callback: (dropdown: any) => void): this {
        const selectEl = document.createElement('select');
        callback({
            selectEl: selectEl,
            addOption: function(value: string, display: string) {
                const option = document.createElement('option');
                option.value = value;
                option.textContent = display;
                selectEl.appendChild(option);
                return this;
            },
            setValue: function(value: string) {
                selectEl.value = value;
                return this;
            },
            onChange: function(handler: (value: string) => void) {
                selectEl.addEventListener('change', (e) => handler((e.target as HTMLSelectElement).value));
                return this;
            }
        });
        return this;
    }
    
    addSlider(callback: (slider: any) => void): this {
        const sliderEl = document.createElement('input');
        sliderEl.type = 'range';
        callback({
            sliderEl: sliderEl,
            setLimits: function(min: number, max: number, step: number) {
                sliderEl.min = min.toString();
                sliderEl.max = max.toString();
                sliderEl.step = step.toString();
                return this;
            },
            setValue: function(value: number) {
                sliderEl.value = value.toString();
                return this;
            },
            setDynamicTooltip: function() {
                return this;
            },
            onChange: function(handler: (value: number) => void) {
                sliderEl.addEventListener('change', (e) => handler(parseFloat((e.target as HTMLInputElement).value)));
                return this;
            }
        });
        return this;
    }
    
    addButton(callback: (button: any) => void): this {
        const buttonEl = document.createElement('button');
        callback({
            buttonEl: buttonEl,
            setButtonText: function(text: string) {
                buttonEl.textContent = text;
                return this;
            },
            onClick: function(handler: () => void) {
                buttonEl.addEventListener('click', handler);
                return this;
            }
        });
        return this;
    }
}

export class Notice {
    messageEl: HTMLElement;
    
    constructor(_message: string, _timeout?: number) {
        // Mock implementation - create a mock element
        this.messageEl = document.createElement('div');
    }
    
    hide(): void {
        // Mock implementation
    }
}

export class WorkspaceLeaf {
    view: ItemView | null = null;
    
    constructor() {}
    
    getViewState(): any {
        return { type: 'test-view' };
    }
    
    setViewState(_state: any): void {
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

export class Modal {
    app: App;
    contentEl: ExtendedHTMLElement;
    private _isOpen: boolean = false;
    
    constructor(app: App) {
        this.app = app;
        this.contentEl = this.createExtendedElement('div');
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
    
    open(): void {
        this._isOpen = true;
        this.onOpen();
    }
    
    close(): void {
        this._isOpen = false;
        this.onClose();
    }
    
    onOpen(): void {
        // Override in subclasses
    }
    
    onClose(): void {
        // Override in subclasses
    }
}

export class FuzzySuggestModal<T> extends Modal {
    inputEl!: HTMLInputElement;

    constructor(app: App) {
        super(app);
        this.inputEl = document.createElement('input');
    }

    getItems(): T[] {
        return [];
    }

    getItemText(item: T): string {
        return String(item);
    }

    onChooseItem(_item: T): void {
        // Override in subclasses
    }

    renderSuggestion(_match: any, _el: HTMLElement): void {
        // Override in subclasses
    }

    setPlaceholder(placeholder: string): void {
        this.inputEl.placeholder = placeholder;
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
    TextAreaComponent,
    Modal,
    FuzzySuggestModal
};