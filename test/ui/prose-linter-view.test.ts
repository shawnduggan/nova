/**
 * @file ProseLinterView Test Suite
 */

import { Editor, MarkdownView, Platform, TFile, WorkspaceLeaf } from 'obsidian';
import { analyzeWriting, hashContent } from '../../src/core/writing-analysis';
import { createAnalysisRunToken } from '../../src/core/writing-analysis-runner';
import { ProseLinterStore } from '../../src/features/prose-linter/prose-linter-store';
import { ProseLinterView } from '../../src/ui/prose-linter-view';

describe('ProseLinterView', () => {
	beforeEach(() => {
		(Platform as unknown as { isMobile: boolean }).isMobile = false;
		installDomHelpers();
	});

	function createPlugin(content: string, path = 'notes/current.md') {
		const file = new TFile(path);
		const editor = new Editor(content);
		const markdownView = new MarkdownView(null);
		markdownView.file = file;
		markdownView.editor = editor;
		const workspace = {
			getActiveViewOfType: jest.fn((viewType: unknown) => viewType === MarkdownView ? markdownView : null),
			on: jest.fn(() => ({ unsubscribe: () => undefined })),
			openLinkText: jest.fn(async () => undefined),
			getLeavesOfType: jest.fn(() => []),
			getRightLeaf: jest.fn(() => new WorkspaceLeaf()),
			revealLeaf: jest.fn()
		};
		const store = new ProseLinterStore({
			loadData: async () => null,
			saveData: async () => undefined,
			now: () => 1
		});
		const plugin = {
			app: {
				workspace,
				vault: {
					cachedRead: jest.fn(async () => content)
				}
			},
			proseLinterStore: store,
			writingAnalysisManager: {
				getActiveFile: jest.fn(() => file),
				getActiveContent: jest.fn(() => content),
				getActiveEditor: jest.fn(() => editor),
				getActiveRunToken: jest.fn(() => createAnalysisRunToken(path, hashContent(content), 1)),
				setProseLinterIssues: jest.fn(),
				setProseLinterReviewActive: jest.fn(),
				clearProseLinterHighlights: jest.fn()
			},
			openSmartRevisionForIssue: jest.fn(),
			registerDomEvent: jest.fn((element: HTMLElement, type: string, handler: EventListener) => {
				element.addEventListener(type, handler);
			})
		};

		return { plugin, file, editor, markdownView, workspace, store };
	}

	async function openView(plugin: ReturnType<typeof createPlugin>['plugin']): Promise<ProseLinterView> {
		const view = new ProseLinterView(new WorkspaceLeaf(), plugin as never);
		await view.onOpen();
		return view;
	}

	test('renders a no-note state without Supernova or provider setup copy', async () => {
		const { plugin } = createPlugin('');
		plugin.writingAnalysisManager.getActiveFile.mockReturnValue(null);
		plugin.writingAnalysisManager.getActiveContent.mockReturnValue(null);
		plugin.writingAnalysisManager.getActiveEditor.mockReturnValue(null);
		plugin.app.workspace.getActiveViewOfType.mockReturnValue(null);

		const view = await openView(plugin);
		const text = view.containerEl.textContent ?? '';

		expect(view.getDisplayText()).toBe('Nova prose linter');
		expect(plugin.writingAnalysisManager.setProseLinterReviewActive).toHaveBeenCalledWith(true);
		expect(text).toContain('Nova');
		expect(text).toContain('Open a markdown note');
		expect(text).not.toContain('Supernova');
		expect(text).not.toContain('API key');
		expect(text).not.toContain('provider');
	});

	test('renders a compact Hemingway-style review with category cards and bounded issue rows', async () => {
		const content = [
			'Maybe we should utilize numerous screenshots.',
			'The launch was approved quickly.',
			'The draft draft needs work.',
			'Clear launch story matters because clear launch story spreads fast.',
			'This sentence contains enough simple words to cross the long sentence threshold and show up in the linter today.'
		].join('\n');
		const { plugin } = createPlugin(content);
		const view = await openView(plugin);
		const text = view.containerEl.textContent ?? '';

		expect(text).toContain('Grade');
		expect(text).toContain('words');
		expect(text).toContain('weakeners');
		expect(text).toContain('repeated phrases');
		expect(text).toContain('complex words');
		expect(text).not.toContain('repeated words or phrases');
		expect(text).toContain('Jump');
		expect(text).not.toContain('per 1,000 words');
		expect(text).not.toContain('Top categories');
		expect(text).not.toContain('Previous');
		expect(text).not.toContain('Toggle category');
		expect(text).not.toContain('Ignore type');
		expect(view.containerEl.querySelectorAll('.nova-prose-linter-category').length).toBeGreaterThan(0);
		expect(view.containerEl.querySelectorAll('.nova-prose-linter-row').length).toBeGreaterThan(0);
		expect(view.containerEl.querySelector('.nova-prose-linter-row--qualifier')).toBeTruthy();
		expect(view.containerEl.querySelector('.nova-prose-linter-row--complex-word')).toBeTruthy();
		expect(plugin.writingAnalysisManager.setProseLinterIssues).toHaveBeenCalledWith(
			'notes/current.md',
			hashContent(content),
			expect.arrayContaining([
				expect.objectContaining({ type: 'qualifier' }),
				expect.objectContaining({ type: 'complex-word' })
			])
		);
	});

	test('collapses the ignored-items section when there are no ignored items', async () => {
		const content = 'Maybe we should utilize screenshots.';
		const { plugin } = createPlugin(content);
		const view = await openView(plugin);

		const ignoredSection = view.containerEl.querySelector('.nova-prose-linter-ignored') as HTMLElement;

		expect(ignoredSection).toBeTruthy();
		expect(ignoredSection.classList.contains('nova-prose-linter-ignored--empty')).toBe(true);
	});

	test('jump selects the current issue range', async () => {
		const content = 'Maybe we should use plain words.';
		const { plugin, editor } = createPlugin(content);
		const focusSpy = jest.spyOn(editor, 'focus');
		const selectionSpy = jest.spyOn(editor, 'setSelection');
		const scrollSpy = jest.spyOn(editor, 'scrollIntoView');
		const view = await openView(plugin);

		const jumpButton = Array.from(view.containerEl.querySelectorAll('button'))
			.find((button) => button.textContent === 'Jump') as HTMLButtonElement;
		jumpButton.click();

		expect(focusSpy).toHaveBeenCalled();
		expect(selectionSpy).toHaveBeenCalledWith({ line: 0, ch: 0 }, { line: 0, ch: 5 });
		expect(scrollSpy).toHaveBeenCalledWith({
			from: { line: 0, ch: 0 },
			to: { line: 0, ch: 5 }
		}, true);
	});

	test('jump does not focus the editor on mobile', async () => {
		(Platform as unknown as { isMobile: boolean }).isMobile = true;
		const content = 'Maybe we should use plain words.';
		const { plugin, editor } = createPlugin(content);
		const focusSpy = jest.spyOn(editor, 'focus');
		const selectionSpy = jest.spyOn(editor, 'setSelection');
		const scrollSpy = jest.spyOn(editor, 'scrollIntoView');
		const view = await openView(plugin);

		const jumpButton = Array.from(view.containerEl.querySelectorAll('button'))
			.find((button) => button.textContent === 'Jump') as HTMLButtonElement;
		jumpButton.click();

		expect(focusSpy).not.toHaveBeenCalled();
		expect(selectionSpy).toHaveBeenCalledWith({ line: 0, ch: 0 }, { line: 0, ch: 5 });
		expect(scrollSpy).toHaveBeenCalledWith({
			from: { line: 0, ch: 0 },
			to: { line: 0, ch: 5 }
		}, true);
	});

	test('jump activates on the first pointer press without double firing', async () => {
		const content = 'Maybe we should use plain words.';
		const { plugin, editor } = createPlugin(content);
		const selectionSpy = jest.spyOn(editor, 'setSelection');
		const view = await openView(plugin);

		const jumpButton = Array.from(view.containerEl.querySelectorAll('button'))
			.find((button) => button.textContent === 'Jump') as HTMLButtonElement;
		jumpButton.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }));
		jumpButton.click();

		expect(selectionSpy).toHaveBeenCalledTimes(1);
		expect(selectionSpy).toHaveBeenCalledWith({ line: 0, ch: 0 }, { line: 0, ch: 5 });
	});

	test('reactivates review mode when an existing prose linter tab is shown', async () => {
		const content = 'Maybe we should facilitate adoption.';
		const { plugin } = createPlugin(content);
		const view = await openView(plugin);

		plugin.writingAnalysisManager.setProseLinterReviewActive.mockClear();
		plugin.writingAnalysisManager.setProseLinterIssues.mockClear();
		(view as unknown as { isShown: () => boolean }).isShown = () => true;

		view.onResize();

		expect(plugin.writingAnalysisManager.setProseLinterReviewActive).toHaveBeenCalledWith(true);
		expect(plugin.writingAnalysisManager.setProseLinterIssues).toHaveBeenCalledWith(
			'notes/current.md',
			hashContent(content),
			expect.arrayContaining([
				expect.objectContaining({ type: 'qualifier' }),
				expect.objectContaining({ type: 'complex-word' })
			])
		);
	});

	test('does not reactivate review mode when the Nova sidebar is the top visible pane', async () => {
		const content = 'Maybe we should facilitate adoption.';
		const { plugin } = createPlugin(content);
		const view = await openView(plugin);
		const rootEl = (view as any).rootEl as HTMLElement;
		const sidebar = document.createElement('div');
		sidebar.classList.add('nova-sidebar-container');
		document.body.appendChild(sidebar);
		const originalElementFromPoint = document.elementFromPoint;

		plugin.writingAnalysisManager.setProseLinterReviewActive.mockClear();
		plugin.writingAnalysisManager.setProseLinterIssues.mockClear();
		(view as unknown as { isShown: () => boolean }).isShown = () => true;
		Object.defineProperty(rootEl, 'getClientRects', {
			configurable: true,
			value: () => ({ length: 1 })
		});
		Object.defineProperty(rootEl, 'getBoundingClientRect', {
			configurable: true,
			value: () => ({
				left: 100,
				right: 420,
				top: 40,
				bottom: 640,
				width: 320,
				height: 600
			})
		});
		Object.defineProperty(document, 'elementFromPoint', {
			configurable: true,
			value: jest.fn(() => sidebar)
		});

		view.onResize();

		expect(plugin.writingAnalysisManager.setProseLinterReviewActive).not.toHaveBeenCalled();
		expect(plugin.writingAnalysisManager.setProseLinterIssues).not.toHaveBeenCalled();

		Object.defineProperty(document, 'elementFromPoint', {
			configurable: true,
			value: originalElementFromPoint
		});
		sidebar.remove();
	});

	test('does not trust isShown when the hidden prose pane has no layout box', async () => {
		const content = 'Maybe we should facilitate adoption.';
		const { plugin } = createPlugin(content);
		const view = await openView(plugin);
		const rootEl = (view as any).rootEl as HTMLElement;
		const sidebar = document.createElement('div');
		sidebar.classList.add('nova-sidebar-container');
		document.body.appendChild(sidebar);

		plugin.writingAnalysisManager.setProseLinterReviewActive.mockClear();
		plugin.writingAnalysisManager.setProseLinterIssues.mockClear();
		(view as unknown as { isShown: () => boolean }).isShown = () => true;
		Object.defineProperty(rootEl, 'getClientRects', {
			configurable: true,
			value: () => ({ length: 0 })
		});
		Object.defineProperty(sidebar, 'getClientRects', {
			configurable: true,
			value: () => ({ length: 1 })
		});

		view.onResize();

		expect(plugin.writingAnalysisManager.setProseLinterReviewActive).not.toHaveBeenCalled();
		expect(plugin.writingAnalysisManager.setProseLinterIssues).not.toHaveBeenCalled();
		sidebar.remove();
	});

	test('shows Apply only for exact safe replacements and applies through the editor API', async () => {
		const content = 'We should utilize screenshots.';
		const { plugin, editor } = createPlugin(content);
		const replaceSpy = jest.spyOn(editor, 'replaceRange');
		const view = await openView(plugin);

		const applyButton = Array.from(view.containerEl.querySelectorAll('button'))
			.find((button) => button.textContent === 'Apply') as HTMLButtonElement;

		expect(applyButton).toBeDefined();
		applyButton.click();

		expect(replaceSpy).toHaveBeenCalledWith('use', { line: 0, ch: 10 }, { line: 0, ch: 17 });
	});

	test('Apply activates on the first pointer press without double firing', async () => {
		const content = 'We should utilize screenshots.';
		const { plugin, editor } = createPlugin(content);
		const replaceSpy = jest.spyOn(editor, 'replaceRange');
		const view = await openView(plugin);

		const applyButton = Array.from(view.containerEl.querySelectorAll('button'))
			.find((button) => button.textContent === 'Apply') as HTMLButtonElement;
		applyButton.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }));
		applyButton.click();

		expect(replaceSpy).toHaveBeenCalledTimes(1);
		expect(replaceSpy).toHaveBeenCalledWith('use', { line: 0, ch: 10 }, { line: 0, ch: 17 });
	});

	test('starts Smart revision from a prose issue row', async () => {
		const content = 'We should utilize screenshots.';
		const { plugin, editor } = createPlugin(content);
		const view = await openView(plugin);

		const revisionButton = Array.from(view.containerEl.querySelectorAll('button'))
			.find((button) => button.textContent === 'Smart revision') as HTMLButtonElement;
		revisionButton.click();

		expect(plugin.openSmartRevisionForIssue).toHaveBeenCalledWith(
			editor,
			expect.objectContaining({
				label: 'Complex word',
				sourceText: 'utilize',
				targetText: 'We should utilize screenshots.',
				line: 0,
				startCh: 10,
				endCh: 17,
				targetLine: 0,
				targetStartCh: 0,
				targetEndCh: 30
			}),
			expect.any(Function)
		);
	});

	test('refreshes resolved issue rows after Smart revision completes', async () => {
		const content = 'We should utilize screenshots.';
		const { plugin, editor } = createPlugin(content);
		plugin.writingAnalysisManager.getActiveContent.mockImplementation(() => editor.getValue());
		const view = await openView(plugin);

		const revisionButton = Array.from(view.containerEl.querySelectorAll('button'))
			.find((button) => button.textContent === 'Smart revision') as HTMLButtonElement;
		revisionButton.click();

		const onComplete = plugin.openSmartRevisionForIssue.mock.calls[0][2] as () => Promise<void>;
		editor.replaceRange('We should use screenshots.', { line: 0, ch: 0 }, { line: 0, ch: content.length });
		await onComplete();

		expect(view.containerEl.textContent).not.toContain('"utilize" is more complex than this sentence needs.');
		expect(plugin.writingAnalysisManager.setProseLinterIssues).toHaveBeenLastCalledWith(
			'notes/current.md',
			hashContent('We should use screenshots.'),
			[]
		);
	});

	test('hides a category from the current view without persisting it', async () => {
		const content = 'Maybe we should utilize screenshots.';
		const { plugin, store } = createPlugin(content);
		const saveSpy = jest.spyOn(store as never, 'ignoreIssueType');
		const view = await openView(plugin);

		const categoryButton = view.containerEl.querySelector('.nova-prose-linter-category--weakeners') as HTMLButtonElement;
		categoryButton.click();

		expect(view.containerEl.textContent).not.toContain('This qualifier softens the point.');
		expect(saveSpy).not.toHaveBeenCalled();
	});

	test('turns a loaded category off on the first click', async () => {
		const content = 'Maybe we should utilize screenshots.';
		const { plugin } = createPlugin(content);
		const view = await openView(plugin);

		const categoryButton = view.containerEl.querySelector('.nova-prose-linter-category--weakeners') as HTMLButtonElement;
		expect(categoryButton.getAttribute('aria-pressed')).toBe('true');

		categoryButton.click();

		const updatedCategoryButton = view.containerEl.querySelector('.nova-prose-linter-category--weakeners') as HTMLButtonElement;
		const latestHighlightCall = plugin.writingAnalysisManager.setProseLinterIssues.mock.calls.at(-1);

		expect(updatedCategoryButton.getAttribute('aria-pressed')).toBe('false');
		expect(updatedCategoryButton.classList.contains('nova-prose-linter-category--muted')).toBe(true);
		expect(view.containerEl.textContent).not.toContain('This qualifier softens the point.');
		expect(view.containerEl.textContent).toContain('"utilize" is more complex than this sentence needs.');
		expect(latestHighlightCall?.[2]).toEqual(expect.not.arrayContaining([
			expect.objectContaining({ type: 'qualifier' })
		]));
	});

	test('turns a very hard sentence category off on the first pointer press', async () => {
		const content = 'This sentence keeps moving through the launch story, the product promise, the onboarding details, the screenshot plan, the support expectations, and the follow-up work because it tries to solve too many problems at once without giving the reader a clean place to rest or decide what matters most.';
		const { plugin } = createPlugin(content);
		const view = await openView(plugin);

		const categoryButton = view.containerEl.querySelector('.nova-prose-linter-category--very-hard') as HTMLButtonElement;
		expect(categoryButton.getAttribute('aria-pressed')).toBe('true');

		categoryButton.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }));
		categoryButton.click();

		const updatedCategoryButton = view.containerEl.querySelector('.nova-prose-linter-category--very-hard') as HTMLButtonElement;
		const latestHighlightCall = plugin.writingAnalysisManager.setProseLinterIssues.mock.calls.at(-1);

		expect(updatedCategoryButton.getAttribute('aria-pressed')).toBe('false');
		expect(updatedCategoryButton.classList.contains('nova-prose-linter-category--muted')).toBe(true);
		expect(view.containerEl.textContent).not.toContain('This sentence has');
		expect(latestHighlightCall?.[2]).toEqual(expect.not.arrayContaining([
			expect.objectContaining({ type: 'very-long-sentence' })
		]));
	});

	test('load more activates on the first pointer press', async () => {
		const content = Array.from({ length: 60 }, (_, index) => `Maybe we should ship section ${index}.`).join('\n');
		const { plugin } = createPlugin(content);
		const view = await openView(plugin);

		const loadMoreButton = Array.from(view.containerEl.querySelectorAll('button'))
			.find((button) => button.textContent?.startsWith('Show ')) as HTMLButtonElement;
		expect(loadMoreButton).toBeDefined();

		loadMoreButton.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }));
		loadMoreButton.click();

		expect(Array.from(view.containerEl.querySelectorAll('button'))
			.some((button) => button.textContent?.startsWith('Show '))).toBe(false);
		expect(view.containerEl.querySelectorAll('.nova-prose-linter-row').length).toBeGreaterThan(50);
	});

	test('persists one ignored issue without persisting note content', async () => {
		const content = 'Maybe we should utilize screenshots.';
		let saved: unknown = null;
		const { plugin } = createPlugin(content);
		plugin.proseLinterStore = new ProseLinterStore({
			loadData: async () => null,
			saveData: async (data) => {
				saved = data;
			},
			now: () => 10
		});
		const view = await openView(plugin);

		const ignoreButton = Array.from(view.containerEl.querySelectorAll('button'))
			.find((button) => button.textContent === 'Ignore') as HTMLButtonElement;
		ignoreButton.click();
		await flushPromises();

		expect(saved).toEqual(expect.objectContaining({ version: 2 }));
		expect(JSON.stringify(saved)).toContain('ignoredIssues');
		expect(view.containerEl.textContent).not.toContain('"utilize" is more complex than this sentence needs.');
		expect(view.containerEl.textContent).toContain('ignored item');
		expect(JSON.stringify(saved)).not.toContain('Maybe');
		expect(JSON.stringify(saved)).not.toContain('utilize');
	});

	test('restores a persistent ignored issue for the current note', async () => {
		const content = 'Maybe we should utilize screenshots.';
		const { plugin } = createPlugin(content);
		const view = await openView(plugin);

		const ignoreButton = Array.from(view.containerEl.querySelectorAll('button'))
			.find((button) => button.textContent === 'Ignore') as HTMLButtonElement;
		ignoreButton.click();
		await flushPromises();

		expect(view.containerEl.textContent).toContain('ignored item');

		const restoreButton = Array.from(view.containerEl.querySelectorAll('button'))
			.find((button) => button.textContent === 'Restore') as HTMLButtonElement;
		restoreButton.click();
		await flushPromises();

		expect(view.containerEl.textContent).not.toContain('ignored item');
		expect(view.containerEl.textContent).toContain('"utilize" is more complex than this sentence needs.');
	});

	test('Ignore activates on the first pointer press while persisting no note content', async () => {
		const content = 'Maybe we should utilize screenshots.';
		let saved: unknown = null;
		const { plugin } = createPlugin(content);
		plugin.proseLinterStore = new ProseLinterStore({
			loadData: async () => null,
			saveData: async (data) => {
				saved = data;
			},
			now: () => 10
		});
		const view = await openView(plugin);

		const ignoreButton = Array.from(view.containerEl.querySelectorAll('button'))
			.find((button) => button.textContent === 'Ignore') as HTMLButtonElement;
		ignoreButton.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }));
		ignoreButton.click();
		await flushPromises();

		expect(saved).toEqual(expect.objectContaining({ version: 2 }));
		expect(view.containerEl.textContent).not.toContain('"utilize" is more complex than this sentence needs.');
		expect(JSON.stringify(saved)).not.toContain('Maybe');
		expect(JSON.stringify(saved)).not.toContain('utilize');
	});

	test('Analyze note activates on the first pointer press for large notes', async () => {
		const content = 'A large note placeholder.';
		const { plugin } = createPlugin(content);
		const view = await openView(plugin);
		(view as any).state = {
			...(view as any).state,
			oversized: true
		};
		const refreshSpy = jest.spyOn(view, 'refresh').mockResolvedValue(undefined);
		(view as any).render();

		const analyzeButton = Array.from(view.containerEl.querySelectorAll('button'))
			.find((button) => button.textContent === 'Analyze note') as HTMLButtonElement;
		analyzeButton.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }));
		analyzeButton.click();

		expect(refreshSpy).toHaveBeenCalledTimes(1);
		expect(refreshSpy).toHaveBeenCalledWith(true);
	});

	test('uses local analysis for the current note', async () => {
		const content = 'The launch was approved quickly.';
		const { plugin } = createPlugin(content);
		const analysis = analyzeWriting(content);
		const view = await openView(plugin);

		expect(view.containerEl.textContent).toContain('Grade');
		expect(view.containerEl.textContent).toContain(`${Math.round(analysis.readabilityGrade)}`);
	});

	test('clears Prose Linter editor highlights when the view closes', async () => {
		const content = 'Maybe we should utilize screenshots.';
		const { plugin } = createPlugin(content);
		const view = await openView(plugin);

		await view.onClose();

		expect(plugin.writingAnalysisManager.setProseLinterReviewActive).toHaveBeenCalledWith(false);
		expect(plugin.writingAnalysisManager.clearProseLinterHighlights).toHaveBeenCalledWith('notes/current.md');
	});
});

function installDomHelpers(): void {
	const proto = HTMLElement.prototype as HTMLElement & {
		empty?: () => void;
		createEl?: (tag: keyof HTMLElementTagNameMap, attrs?: { text?: string; cls?: string; attr?: Record<string, string> }) => HTMLElement;
		createDiv?: (attrs?: { cls?: string; text?: string }) => HTMLDivElement;
		createSpan?: (attrs?: { cls?: string; text?: string }) => HTMLSpanElement;
		setText?: (text: string) => void;
		addClass?: (cls: string) => void;
		removeClass?: (cls: string) => void;
	};

	proto.empty = function empty() {
		while (this.firstChild) {
			this.removeChild(this.firstChild);
		}
	};
	proto.createEl = function createEl(tag, attrs) {
		const el = document.createElement(tag);
		if (attrs?.text) {
			el.textContent = attrs.text;
		}
		if (attrs?.cls) {
			el.className = attrs.cls;
		}
		if (attrs?.attr) {
			Object.entries(attrs.attr).forEach(([key, value]) => el.setAttribute(key, value));
		}
		this.appendChild(el);
		return el;
	};
	proto.createDiv = function createDiv(attrs) {
		return this.createEl?.('div', attrs) as HTMLDivElement;
	};
	proto.createSpan = function createSpan(attrs) {
		return this.createEl?.('span', attrs) as HTMLSpanElement;
	};
	proto.setText = function setText(text: string) {
		this.textContent = text;
	};
	proto.addClass = function addClass(cls: string) {
		this.classList.add(cls);
	};
	proto.removeClass = function removeClass(cls: string) {
		this.classList.remove(cls);
	};
}

async function flushPromises(): Promise<void> {
	await Promise.resolve();
	await Promise.resolve();
	await Promise.resolve();
	await Promise.resolve();
	await Promise.resolve();
}
