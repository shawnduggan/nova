/**
 * @file WritingAnalysisManager Test Suite
 */

import { Component, Editor, MarkdownView, TFile } from 'obsidian';
import { VIEW_TYPE_NOVA_SIDEBAR, VIEW_TYPE_PROSE_LINTER } from '../../src/constants';
import { hashContent, MAX_WRITING_ANALYSIS_CHAR_LENGTH } from '../../src/core/writing-analysis';
import { WRITING_ANALYSIS_UPDATED_EVENT, WritingAnalysisManager, type WritingAnalysisUpdateDetail } from '../../src/ui/writing-analysis-manager';

describe('WritingAnalysisManager', () => {
	type WorkspaceEventCallback = (...data: unknown[]) => void;

	function createWorkspace() {
		const handlers = new Map<string, WorkspaceEventCallback[]>();
		return {
			containerEl: document.body,
			getActiveViewOfType: jest.fn(() => null as MarkdownView | null),
			getLeavesOfType: jest.fn(() => []),
			iterateAllLeaves: jest.fn((_callback: (leaf: unknown) => void) => undefined),
			on: jest.fn((event: string, handler: WorkspaceEventCallback) => {
				const eventHandlers = handlers.get(event) ?? [];
				eventHandlers.push(handler);
				handlers.set(event, eventHandlers);
				return {
					unsubscribe: () => {
						const registeredHandlers = handlers.get(event) ?? [];
						const index = registeredHandlers.indexOf(handler);
						if (index >= 0) {
							registeredHandlers.splice(index, 1);
						}
					}
				};
			}),
			trigger: jest.fn((event: string, ...data: unknown[]) => {
				(handlers.get(event) ?? []).forEach((handler) => handler(...data));
			})
		};
	}

	function getWritingAnalysisUpdates(workspace: ReturnType<typeof createWorkspace>): WritingAnalysisUpdateDetail[] {
		return workspace.trigger.mock.calls
			.filter(([event]) => event === WRITING_ANALYSIS_UPDATED_EVENT)
			.map(([, detail]) => detail as WritingAnalysisUpdateDetail);
	}

	function createManager(activeLeafViewType: string) {
		const workspace = createWorkspace();

		const plugin = {
			app: {
				workspace,
				vault: {
					cachedRead: jest.fn(async () => '')
				}
			},
			settings: {
				writingAnalysis: {
					enabled: true,
					longSentenceThreshold: 25,
					veryLongSentenceThreshold: 40
				}
			},
			registerEvent: jest.fn(),
			registerDomEvent: jest.fn(),
			addChild: jest.fn((component: Component) => {
				component.load();
				return component;
			}),
			removeChild: jest.fn((component: Component) => {
				component.unload();
				return component;
			}),
			writingAnalysisStateField: {}
		};

		return {
			workspace,
			plugin,
			manager: new WritingAnalysisManager(plugin as never)
		};
	}

	function createTrackedMarkdownView(): MarkdownView {
		const view = new MarkdownView(null);
		view.file = new TFile('notes/current.md');
		view.editor = new Editor('A tracked note with enough text to stand in for the active markdown editor.');
		return view;
	}

	function attachHighlightSpy(manager: WritingAnalysisManager) {
		const highlightManager = {
			updateHighlights: jest.fn(),
			clearHighlights: jest.fn()
		};
		(manager as any).highlightManager = highlightManager;
		return highlightManager;
	}

	function createFakeEditorViewDoc(content: string) {
		const lines = content.split('\n');
		return {
			state: {
				doc: {
					lines: lines.length,
					line: (lineNumber: number) => {
						const zeroBased = lineNumber - 1;
						const from = lines.slice(0, zeroBased).reduce((offset, line) => offset + line.length + 1, 0);
						return {
							from,
							to: from + (lines[zeroBased]?.length ?? 0)
						};
					}
				}
			}
		};
	}

	test('clears writing analysis when the active leaf becomes the writing dashboard', async () => {
		const { manager, workspace } = createManager('nova-writing-dashboard');
		const trackedView = createTrackedMarkdownView();
		(manager as any).activeView = trackedView;
		(manager as any).latestAnalysis = { readabilityGrade: 8 } as never;
		(manager as any).currentLeafViewType = 'nova-writing-dashboard';

		await manager.refreshForActiveView(true);
		const detail = getWritingAnalysisUpdates(workspace).at(-1);

		expect(manager.getActiveFile()).toBeNull();
		expect(manager.getLatestAnalysis()).toBeNull();
		expect(detail?.eligible).toBe(false);
		expect(detail?.filePath).toBeNull();
	});

	test('preserves writing analysis when focus moves to the file explorer', async () => {
		const { manager } = createManager('file-explorer');
		const trackedView = createTrackedMarkdownView();
		(manager as any).activeView = trackedView;
		(manager as any).latestAnalysis = { readabilityGrade: 8 } as never;
		(manager as any).currentLeafViewType = 'file-explorer';

		await manager.refreshForActiveView(true);

		expect(manager.getActiveFile()?.path).toBe('notes/current.md');
		expect(manager.getLatestAnalysis()).toEqual({ readabilityGrade: 8 });
	});

	test('preserves writing analysis when focus moves into the Nova sidebar', async () => {
		const { manager } = createManager(VIEW_TYPE_NOVA_SIDEBAR);
		const trackedView = createTrackedMarkdownView();
		(manager as any).activeView = trackedView;
		(manager as any).latestAnalysis = { readabilityGrade: 8 } as never;
		(manager as any).currentLeafViewType = VIEW_TYPE_NOVA_SIDEBAR;

		await manager.refreshForActiveView(true);

		expect(manager.getActiveFile()?.path).toBe('notes/current.md');
		expect(manager.getLatestAnalysis()).toEqual({ readabilityGrade: 8 });
	});

	test('hides editor highlights when focus moves from prose linter to another Nova pane', async () => {
		const { manager } = createManager(VIEW_TYPE_NOVA_SIDEBAR);
		(manager as any).activeView = createTrackedMarkdownView();
		(manager as any).latestAnalysis = { readabilityGrade: 8 } as never;
		(manager as any).proseLinterHighlights = [{
			from: 0,
			to: 8,
			type: 'complex-word',
			title: 'Complex word: use a simpler alternative.'
		}];
		(manager as any).proseLinterHighlightFilePath = 'notes/current.md';
		(manager as any).proseLinterHighlightContentHash = hashContent(manager.getActiveContent() ?? '');
		const highlightManager = attachHighlightSpy(manager);

		(manager as any).handleActiveLeafChange({
			view: { getViewType: () => VIEW_TYPE_PROSE_LINTER }
		});
		expect(highlightManager.updateHighlights).toHaveBeenCalledWith(expect.arrayContaining([
			expect.objectContaining({ type: 'complex-word' })
		]));

		(manager as any).handleActiveLeafChange({
			view: { getViewType: () => VIEW_TYPE_NOVA_SIDEBAR }
		});

		expect(highlightManager.clearHighlights).toHaveBeenCalled();
		expect(manager.getActiveFile()?.path).toBe('notes/current.md');
		expect(manager.getLatestAnalysis()).toEqual({ readabilityGrade: 8 });
	});

	test('hides prose linter highlights when layout reports the Nova sidebar as active', () => {
		const { manager } = createManager(VIEW_TYPE_NOVA_SIDEBAR);
		(manager as any).activeView = createTrackedMarkdownView();
		(manager as any).proseLinterReviewActive = true;
		(manager as any).currentLeafViewType = VIEW_TYPE_NOVA_SIDEBAR;
		const highlightManager = attachHighlightSpy(manager);

		(manager as any).reconcileProseLinterReviewMode();

		expect((manager as any).proseLinterReviewActive).toBe(false);
		expect(highlightManager.clearHighlights).toHaveBeenCalled();
	});

	test('hides prose linter highlights when the Nova tab header is clicked', () => {
		const { manager } = createManager(VIEW_TYPE_NOVA_SIDEBAR);
		(manager as any).activeView = createTrackedMarkdownView();
		(manager as any).proseLinterReviewActive = true;
		const highlightManager = attachHighlightSpy(manager);
		const tabHeader = document.createElement('div');
		tabHeader.setAttribute('aria-label', 'Nova');
		const tabIcon = document.createElement('span');
		tabHeader.appendChild(tabIcon);
		document.body.appendChild(tabHeader);

		(manager as any).handleWorkspaceInteraction({ target: tabIcon });

		expect((manager as any).proseLinterReviewActive).toBe(false);
		expect(highlightManager.clearHighlights).toHaveBeenCalled();
		tabHeader.remove();
	});

	test('does not register edit-time analysis listeners when tracking an active editor', async () => {
		const { workspace, plugin, manager } = createManager('markdown');
		const trackedView = createTrackedMarkdownView();
		const editorEl = trackedView.containerEl.createDiv({ cls: 'cm-editor' });
		workspace.getActiveViewOfType.mockReturnValue(trackedView);

		await manager.refreshForActiveView(true);

		const registeredEditorInputListener = plugin.registerDomEvent.mock.calls.some(([element, type]) => {
			return element === editorEl && type === 'input';
		});
		expect(registeredEditorInputListener).toBe(false);
	});

	test('marks current analysis stale on editor changes without discarding stats', () => {
		const { manager, workspace } = createManager('markdown');
		const trackedView = createTrackedMarkdownView();
		const previousAnalysis = { readabilityGrade: 8, wordCount: 12 } as never;
		(manager as any).activeView = trackedView;
		(manager as any).latestAnalysis = previousAnalysis;

		(manager as any).handleEditorChange(trackedView.editor);

		const emitted = getWritingAnalysisUpdates(workspace);
		expect(manager.getLatestAnalysis()).toBe(previousAnalysis);
		expect(manager.isAnalysisStale()).toBe(true);
		expect(emitted).toHaveLength(1);
		expect(emitted.at(-1)).toEqual(expect.objectContaining({
			analysis: previousAnalysis,
			eligible: true,
			stale: true
		}));
	});

	test('does not emit repeated stale updates while typing continues', () => {
		const { manager, workspace } = createManager('markdown');
		const trackedView = createTrackedMarkdownView();
		(manager as any).activeView = trackedView;
		(manager as any).latestAnalysis = { readabilityGrade: 8, wordCount: 12 } as never;

		(manager as any).handleEditorChange(trackedView.editor);
		(manager as any).handleEditorChange(trackedView.editor);
		(manager as any).handleEditorChange(trackedView.editor);

		expect(manager.isAnalysisStale()).toBe(true);
		expect(getWritingAnalysisUpdates(workspace)).toHaveLength(1);
	});

	test('keeps stale analysis when focus returns to the same markdown editor', async () => {
		const { workspace, manager } = createManager('markdown');
		const trackedView = createTrackedMarkdownView();
		const previousAnalysis = { readabilityGrade: 8, wordCount: 12 } as never;
		workspace.getActiveViewOfType.mockReturnValue(trackedView);
		(manager as any).activeView = trackedView;
		(manager as any).latestAnalysis = previousAnalysis;
		(manager as any).analysisStale = true;

		(manager as any).handleActiveLeafChange({
			view: { getViewType: () => 'markdown' }
		});
		await Promise.resolve();
		await Promise.resolve();

		expect(manager.getLatestAnalysis()).toBe(previousAnalysis);
		expect(manager.isAnalysisStale()).toBe(true);
	});

	test('shows prose linter highlights when the prose linter tab header is clicked', () => {
		const { manager } = createManager(VIEW_TYPE_PROSE_LINTER);
		(manager as any).activeView = createTrackedMarkdownView();
		(manager as any).proseLinterReviewActive = false;
		(manager as any).proseLinterHighlights = [{
			from: 0,
			to: 8,
			type: 'complex-word',
			title: 'Complex word: use a simpler alternative.'
		}];
		(manager as any).proseLinterHighlightFilePath = 'notes/current.md';
		(manager as any).proseLinterHighlightContentHash = hashContent(manager.getActiveContent() ?? '');
		const highlightManager = attachHighlightSpy(manager);
		const tabHeader = document.createElement('div');
		tabHeader.setAttribute('aria-label', 'Nova prose linter');
		const tabIcon = document.createElement('span');
		tabHeader.appendChild(tabIcon);
		document.body.appendChild(tabHeader);

		(manager as any).handleWorkspaceInteraction({ target: tabIcon });

		expect((manager as any).proseLinterReviewActive).toBe(true);
		expect(highlightManager.updateHighlights).toHaveBeenCalledWith(expect.arrayContaining([
			expect.objectContaining({ type: 'complex-word' })
		]));
		tabHeader.remove();
	});

	test('hides prose linter highlights when the Nova sidebar body is the visible Nova surface', () => {
		const { manager } = createManager(VIEW_TYPE_NOVA_SIDEBAR);
		(manager as any).activeView = createTrackedMarkdownView();
		(manager as any).proseLinterReviewActive = true;
		const highlightManager = attachHighlightSpy(manager);
		const sidebar = document.createElement('div');
		sidebar.classList.add('nova-sidebar-container');
		Object.defineProperty(sidebar, 'getClientRects', {
			value: () => ({ length: 1 })
		});
		document.body.appendChild(sidebar);

		(manager as any).reconcileProseLinterReviewMode();

		expect((manager as any).proseLinterReviewActive).toBe(false);
		expect(highlightManager.clearHighlights).toHaveBeenCalled();
		sidebar.remove();
	});

	test('shows prose linter highlights when the prose linter body is the visible Nova surface', () => {
		const { manager } = createManager(VIEW_TYPE_PROSE_LINTER);
		(manager as any).activeView = createTrackedMarkdownView();
		(manager as any).proseLinterReviewActive = false;
		(manager as any).proseLinterHighlights = [{
			from: 0,
			to: 8,
			type: 'complex-word',
			title: 'Complex word: use a simpler alternative.'
		}];
		(manager as any).proseLinterHighlightFilePath = 'notes/current.md';
		(manager as any).proseLinterHighlightContentHash = hashContent(manager.getActiveContent() ?? '');
		const highlightManager = attachHighlightSpy(manager);
		const proseLinter = document.createElement('div');
		proseLinter.classList.add('nova-prose-linter-view');
		Object.defineProperty(proseLinter, 'getClientRects', {
			value: () => ({ length: 1 })
		});
		document.body.appendChild(proseLinter);

		(manager as any).reconcileProseLinterReviewMode();

		expect((manager as any).proseLinterReviewActive).toBe(true);
		expect(highlightManager.updateHighlights).toHaveBeenCalledWith(expect.arrayContaining([
			expect.objectContaining({ type: 'complex-word' })
		]));
		proseLinter.remove();
	});

	test('uses the topmost right-pane surface when both Nova panes have layout boxes', () => {
		const { manager } = createManager(VIEW_TYPE_NOVA_SIDEBAR);
		(manager as any).activeView = createTrackedMarkdownView();
		(manager as any).proseLinterReviewActive = true;
		const highlightManager = attachHighlightSpy(manager);
		const sidebar = document.createElement('div');
		sidebar.classList.add('nova-sidebar-container');
		const proseLinter = document.createElement('div');
		proseLinter.classList.add('nova-prose-linter-view');
		[sidebar, proseLinter].forEach((element) => {
			Object.defineProperty(element, 'getClientRects', {
				value: () => ({ length: 1 })
			});
			document.body.appendChild(element);
		});
		const originalElementFromPoint = document.elementFromPoint;
		Object.defineProperty(document, 'elementFromPoint', {
			configurable: true,
			value: jest.fn(() => sidebar)
		});

		(manager as any).reconcileProseLinterReviewMode();

		expect((manager as any).proseLinterReviewActive).toBe(false);
		expect(highlightManager.clearHighlights).toHaveBeenCalled();

		Object.defineProperty(document, 'elementFromPoint', {
			configurable: true,
			value: originalElementFromPoint
		});
		sidebar.remove();
		proseLinter.remove();
	});

	test('samples multiple right-pane points when reconciling the visible Nova surface', () => {
		const { manager } = createManager(VIEW_TYPE_NOVA_SIDEBAR);
		(manager as any).activeView = createTrackedMarkdownView();
		(manager as any).proseLinterReviewActive = true;
		const highlightManager = attachHighlightSpy(manager);
		const sidebar = document.createElement('div');
		sidebar.classList.add('nova-sidebar-container');
		Object.defineProperty(sidebar, 'getClientRects', {
			value: () => ({ length: 1 })
		});
		document.body.appendChild(sidebar);
		const originalElementFromPoint = document.elementFromPoint;
		Object.defineProperty(document, 'elementFromPoint', {
			configurable: true,
			value: jest.fn()
				.mockReturnValueOnce(null)
				.mockReturnValueOnce(sidebar)
		});

		(manager as any).reconcileProseLinterReviewMode();

		expect((manager as any).proseLinterReviewActive).toBe(false);
		expect(highlightManager.clearHighlights).toHaveBeenCalled();

		Object.defineProperty(document, 'elementFromPoint', {
			configurable: true,
			value: originalElementFromPoint
		});
		sidebar.remove();
	});

	test('reconciles Nova surfaces in the document that received the latest interaction', () => {
		const { manager } = createManager(VIEW_TYPE_PROSE_LINTER);
		(manager as any).activeView = createTrackedMarkdownView();
		(manager as any).proseLinterReviewActive = false;
		(manager as any).proseLinterHighlights = [{
			from: 0,
			to: 8,
			type: 'complex-word',
			title: 'Complex word: use a simpler alternative.'
		}];
		(manager as any).proseLinterHighlightFilePath = 'notes/current.md';
		(manager as any).proseLinterHighlightContentHash = hashContent(manager.getActiveContent() ?? '');
		const highlightManager = attachHighlightSpy(manager);

		const mainWindowSidebar = document.createElement('div');
		mainWindowSidebar.classList.add('nova-sidebar-container');
		Object.defineProperty(mainWindowSidebar, 'getClientRects', {
			value: () => ({ length: 1 })
		});
		document.body.appendChild(mainWindowSidebar);

		const popoutDocument = document.implementation.createHTMLDocument('Nova pop-out');
		const popoutProseLinter = popoutDocument.createElement('div');
		popoutProseLinter.classList.add('nova-prose-linter-view');
		Object.defineProperty(popoutProseLinter, 'getClientRects', {
			value: () => ({ length: 1 })
		});
		const popoutTarget = popoutDocument.createElement('span');
		popoutProseLinter.appendChild(popoutTarget);
		popoutDocument.body.appendChild(popoutProseLinter);

		(manager as any).handleWorkspaceInteraction({ target: popoutTarget });
		(manager as any).reconcileProseLinterReviewMode();

		expect((manager as any).activeSurfaceDocument).toBe(popoutDocument);
		expect((manager as any).proseLinterReviewActive).toBe(true);
		expect(highlightManager.updateHighlights).toHaveBeenCalledWith(expect.arrayContaining([
			expect.objectContaining({ type: 'complex-word' })
		]));
		mainWindowSidebar.remove();
	});

	test('releases and re-registers pop-out listeners across close and reopen', () => {
		const { manager, plugin, workspace } = createManager('markdown');
		manager.init();
		const popoutDocument = document.implementation.createHTMLDocument('Nova pop-out');
		const target = popoutDocument.createElement('button');
		popoutDocument.body.appendChild(target);

		workspace.trigger('window-open', {}, { document: popoutDocument });
		const firstLifecycle = (manager as any).interactionDocumentLifecycles.get(popoutDocument);
		target.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		expect(firstLifecycle).toBeDefined();
		expect((manager as any).activeSurfaceDocument).toBe(popoutDocument);

		workspace.trigger('window-close', {}, { document: popoutDocument });
		expect((manager as any).interactionDocumentLifecycles.has(popoutDocument)).toBe(false);
		expect((manager as any).activeSurfaceDocument).toBeNull();
		expect(plugin.removeChild).toHaveBeenCalledWith(firstLifecycle);

		target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect((manager as any).activeSurfaceDocument).toBeNull();

		workspace.trigger('window-open', {}, { document: popoutDocument });
		const reopenedLifecycle = (manager as any).interactionDocumentLifecycles.get(popoutDocument);
		target.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		expect(reopenedLifecycle).toBeDefined();
		expect(reopenedLifecycle).not.toBe(firstLifecycle);
		expect((manager as any).activeSurfaceDocument).toBe(popoutDocument);
		manager.cleanup();
	});

	test('keeps prose linter review mode active when focus returns to the markdown editor', () => {
		const { manager } = createManager('markdown');
		(manager as any).activeView = createTrackedMarkdownView();
		(manager as any).proseLinterReviewActive = true;
		(manager as any).proseLinterHighlights = [{
			from: 0,
			to: 8,
			type: 'complex-word',
			title: 'Complex word: use a simpler alternative.'
		}];
		(manager as any).proseLinterHighlightFilePath = 'notes/current.md';
		(manager as any).proseLinterHighlightContentHash = hashContent(manager.getActiveContent() ?? '');
		const highlightManager = attachHighlightSpy(manager);

		(manager as any).handleActiveLeafChange({
			view: { getViewType: () => 'markdown' }
		});

		expect((manager as any).proseLinterReviewActive).toBe(true);
		expect(highlightManager.clearHighlights).not.toHaveBeenCalled();
	});

	test('expands repeated issue related ranges into editor highlights', () => {
		const { manager } = createManager(VIEW_TYPE_PROSE_LINTER);
		const content = 'Clear launch story matters.\nClear launch story spreads.';
		const view = createTrackedMarkdownView();
		view.editor = new Editor(content);
		(view.editor as unknown as { cm: unknown }).cm = createFakeEditorViewDoc(content);
		(manager as any).activeView = view;
		(manager as any).proseLinterReviewActive = true;
		const highlightManager = attachHighlightSpy(manager);

		manager.setProseLinterIssues('notes/current.md', hashContent(content), [{
			id: 'issue-1',
			ignoreKey: 'repeated-phrase:1:test',
			type: 'repeated-phrase',
			severity: 'warning',
			line: 1,
			startCh: 0,
			endCh: 18,
			excerpt: 'Clear launch story spreads.',
			sourceText: 'Clear launch story',
			explanation: 'This phrase appears 2 times nearby.',
			suggestion: 'Keep the stronger use and rewrite or remove the echo.',
			relatedRanges: [
				{ line: 0, startCh: 0, endCh: 18 },
				{ line: 1, startCh: 0, endCh: 18 }
			]
		}]);

		expect(highlightManager.updateHighlights).toHaveBeenCalledWith([
			expect.objectContaining({ from: 0, to: 18, type: 'repeated-phrase' }),
			expect.objectContaining({ from: 28, to: 46, type: 'repeated-phrase' })
		]);
	});

	describe('size gate', () => {
		function createManagerWithEditor(docLength: number) {
			const workspace = createWorkspace();
			const plugin = {
				app: {
					workspace,
					vault: { cachedRead: jest.fn(async () => 'x'.repeat(docLength)) }
				},
				settings: {
					writingAnalysis: {
						enabled: true,
						longSentenceThreshold: 25,
						veryLongSentenceThreshold: 40
					}
				},
				registerEvent: jest.fn(),
				registerDomEvent: jest.fn(),
				writingAnalysisStateField: {}
			};
			const manager = new WritingAnalysisManager(plugin as never);

			const fakeEditor = {
				getValue: () => 'x'.repeat(docLength),
				cm: { state: { doc: { length: docLength } } }
			};
			const view = new MarkdownView(null);
			view.file = new TFile('notes/big.md');
			view.editor = fakeEditor as unknown as Editor;
			(manager as any).activeView = view;

			return { manager, fakeEditor, workspace };
		}

		test('analyzes medium-large notes during explicit snapshot analysis', async () => {
			const { manager } = createManagerWithEditor(9_000);

			await manager.analyzeNow();

			expect(manager.isActiveFileOversized()).toBe(false);
			expect(manager.isAnalysisStale()).toBe(false);
			expect(manager.getLatestAnalysis()).toEqual(expect.objectContaining({
				wordCount: expect.any(Number)
			}));
		});

		test('analyzeNow respects the oversized document gate', async () => {
			const { manager, workspace } = createManagerWithEditor(MAX_WRITING_ANALYSIS_CHAR_LENGTH + 1);

			await manager.analyzeNow();

			expect(manager.isActiveFileOversized()).toBe(true);
			expect(manager.isAnalysisStale()).toBe(false);
			expect(manager.getLatestAnalysis()).toBeNull();
			expect(getWritingAnalysisUpdates(workspace).at(-1)).toEqual(expect.objectContaining({
				eligible: true,
				oversized: true,
				stale: false,
				analysis: null,
				filePath: 'notes/big.md'
			}));
		});
	});

	describe('editor focus preservation', () => {
		function createFocusedAnalysisManager(content = 'This is a short note. It has another sentence.'): {
			manager: WritingAnalysisManager;
			workspace: ReturnType<typeof createWorkspace>;
			cm: { focus: jest.Mock };
			editorInput: HTMLElement;
			cleanup: () => void;
		} {
			const workspace = createWorkspace();
			const plugin = {
				app: {
					workspace,
					vault: { cachedRead: jest.fn(async () => content) }
				},
				settings: {
					writingAnalysis: {
						enabled: true,
						longSentenceThreshold: 25,
						veryLongSentenceThreshold: 40
					}
				},
				registerEvent: jest.fn(),
				registerDomEvent: jest.fn(),
				writingAnalysisStateField: {}
			};
			const manager = new WritingAnalysisManager(plugin as never);
			const editorDom = document.createElement('div');
			const editorInput = document.createElement('div');
			editorDom.classList.add('cm-editor');
			editorInput.tabIndex = 0;
			editorDom.appendChild(editorInput);
			document.body.appendChild(editorDom);

			const cm = {
				dom: editorDom,
				focus: jest.fn(() => editorInput.focus()),
				state: { doc: { length: content.length } }
			};
			const fakeEditor = {
				getValue: () => content,
				cm
			};
			const view = new MarkdownView(null);
			view.file = new TFile('notes/current.md');
			view.editor = fakeEditor as unknown as Editor;
			(manager as any).activeView = view;

			return {
				manager,
				workspace,
				cm,
				editorInput,
				cleanup: () => editorDom.remove()
			};
		}

		test('restores editor focus when analysis update leaves focus on the document shell', async () => {
			const { manager, workspace, cm, editorInput, cleanup } = createFocusedAnalysisManager();
			const listener = () => {
				editorInput.blur();
			};
			const eventRef = workspace.on(WRITING_ANALYSIS_UPDATED_EVENT, listener);

			try {
				(manager as any).analysisStale = true;
				editorInput.focus();

				await manager.analyzeNow();

				expect(cm.focus).toHaveBeenCalledTimes(1);
				expect(manager.isAnalysisStale()).toBe(false);
				expect(document.activeElement).toBe(editorInput);
			} finally {
				eventRef.unsubscribe();
				cleanup();
			}
		});

		test('does not steal focus from another interactive element', async () => {
			const { manager, workspace, cm, editorInput, cleanup } = createFocusedAnalysisManager();
			const button = document.createElement('button');
			button.textContent = 'Sidebar action';
			document.body.appendChild(button);
			const listener = () => {
				button.focus();
			};
			const eventRef = workspace.on(WRITING_ANALYSIS_UPDATED_EVENT, listener);

			try {
				editorInput.focus();

				await manager.analyzeNow();

				expect(cm.focus).not.toHaveBeenCalled();
				expect(document.activeElement).toBe(button);
			} finally {
				eventRef.unsubscribe();
				button.remove();
				cleanup();
			}
		});
	});

		describe('stale analysis protection', () => {
		function createAsyncEditor(): Editor {
			return {
				getValue: () => undefined
			} as unknown as Editor;
		}

		function createView(path: string): MarkdownView {
			const view = new MarkdownView(null);
			view.file = new TFile(path);
			view.editor = createAsyncEditor();
			return view;
		}

		test('does not assign or emit a delayed result after the active file changes', async () => {
			let resolveOldRead: (content: string) => void = () => undefined;
			const oldRead = new Promise<string>((resolve) => {
				resolveOldRead = resolve;
			});
			const newContent = 'This active sentence stays current.';
			const cachedRead = jest.fn((file: TFile) => {
				if (file.path === 'notes/old.md') {
					return oldRead;
				}
				return Promise.resolve(newContent);
			});
			const workspace = createWorkspace();
			const plugin = {
				app: {
					workspace,
					vault: { cachedRead }
				},
				settings: {
					writingAnalysis: {
						enabled: true,
						longSentenceThreshold: 25,
						veryLongSentenceThreshold: 40
					}
				},
				registerEvent: jest.fn(),
				registerDomEvent: jest.fn(),
				writingAnalysisStateField: {}
			};
			const manager = new WritingAnalysisManager(plugin as never);
			(manager as any).activeView = createView('notes/old.md');
			const oldRun = (manager as any).runAnalysis();

			(manager as any).activeView = createView('notes/new.md');
			await (manager as any).runAnalysis();
			resolveOldRead('The old report was written carefully.');
			await oldRun;

			expect(manager.getActiveFile()?.path).toBe('notes/new.md');
			expect(manager.getLatestAnalysis()?.wordCount).toBe(5);
			expect(manager.getActiveRunToken()).toEqual({
				filePath: 'notes/new.md',
				contentHash: hashContent(newContent),
				sequence: 2
			});
			expect(getWritingAnalysisUpdates(workspace).map((detail) => detail.filePath)).toEqual(['notes/new.md']);
		});
	});

	});
