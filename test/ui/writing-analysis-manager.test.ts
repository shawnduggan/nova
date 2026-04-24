/**
 * @file WritingAnalysisManager Test Suite
 */

import { Editor, MarkdownView, TFile } from 'obsidian';
import { VIEW_TYPE_NOVA_SIDEBAR } from '../../src/constants';
import { WRITING_ANALYSIS_UPDATED_EVENT, WritingAnalysisManager, type WritingAnalysisUpdateDetail } from '../../src/ui/writing-analysis-manager';

describe('WritingAnalysisManager', () => {
	function createManager(activeLeafViewType: string) {
		const workspace = {
			getActiveViewOfType: jest.fn(() => null),
			on: jest.fn(() => ({ unsubscribe: () => undefined }))
		};

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
			writingAnalysisStateField: {}
		};

		return {
			workspace,
			manager: new WritingAnalysisManager(plugin as never)
		};
	}

	function createTrackedMarkdownView(): MarkdownView {
		const view = new MarkdownView(null);
		view.file = new TFile('notes/current.md');
		view.editor = new Editor('A tracked note with enough text to stand in for the active markdown editor.');
		return view;
	}

	test('clears writing analysis when the active leaf becomes the writing dashboard', async () => {
		const { manager } = createManager('nova-writing-dashboard');
		const trackedView = createTrackedMarkdownView();
		(manager as any).activeView = trackedView;
		(manager as any).latestAnalysis = { readabilityGrade: 8 } as never;
		(manager as any).currentLeafViewType = 'nova-writing-dashboard';

		const updatePromise = new Promise<WritingAnalysisUpdateDetail>((resolve) => {
			document.addEventListener(
				WRITING_ANALYSIS_UPDATED_EVENT,
				(event) => resolve((event as CustomEvent<WritingAnalysisUpdateDetail>).detail),
				{ once: true }
			);
		});

		await manager.refreshForActiveView(true);
		const detail = await updatePromise;

		expect(manager.getActiveFile()).toBeNull();
		expect(manager.getLatestAnalysis()).toBeNull();
		expect(detail.eligible).toBe(false);
		expect(detail.filePath).toBeNull();
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

	describe('size gate', () => {
		function createManagerWithEditor(docLength: number) {
			const workspace = {
				getActiveViewOfType: jest.fn(() => null),
				on: jest.fn(() => ({ unsubscribe: () => undefined }))
			};
			const plugin = {
				app: {
					workspace,
					vault: { cachedRead: jest.fn(async () => 'x'.repeat(docLength)) }
				},
				settings: {
					writingAnalysis: {
						enabled: true,
						longSentenceThreshold: 25,
						veryLongSentenceThreshold: 40,
						highlightLongSentences: true,
						highlightPassiveVoice: true,
						highlightAdverbs: true,
						highlightWeakIntensifiers: true
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

			return { manager, fakeEditor };
		}

		test('scheduleAnalysis skips documents over the size threshold', () => {
			const { manager } = createManagerWithEditor(60_000);
			const spy = jest.spyOn(manager as any, 'runAnalysis');

			manager.scheduleAnalysis();

			expect((manager as any).pendingAnalysisTimeout).toBeNull();
			expect(spy).not.toHaveBeenCalled();
		});

		test('scheduleAnalysis schedules analysis for documents under the threshold', () => {
			const { manager } = createManagerWithEditor(1_000);

			manager.scheduleAnalysis();

			expect((manager as any).pendingAnalysisTimeout).not.toBeNull();
		});

		test('analyzeNow bypasses the size gate', async () => {
			const { manager } = createManagerWithEditor(60_000);
			const spy = jest.spyOn(manager as any, 'runAnalysis').mockResolvedValue(undefined);

			await manager.analyzeNow();

			expect(spy).toHaveBeenCalledTimes(1);
		});
	});

	describe('debounce timing', () => {
		test('ANALYSIS_DEBOUNCE_MS is set to 1500 ms', () => {
			expect((WritingAnalysisManager as any).ANALYSIS_DEBOUNCE_MS).toBe(1500);
		});
	});

	describe('idle scheduling', () => {
		function createManagerWithEditor(docLength: number) {
			const workspace = {
				getActiveViewOfType: jest.fn(() => null),
				on: jest.fn(() => ({ unsubscribe: () => undefined }))
			};
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
			const view = new MarkdownView(null);
			view.file = new TFile('notes/small.md');
			view.editor = {
				getValue: () => 'x'.repeat(docLength),
				cm: { state: { doc: { length: docLength } } }
			} as unknown as Editor;
			(manager as any).activeView = view;
			return manager;
		}

		test('defers runAnalysis to an idle callback when the debounce fires', () => {
			jest.useFakeTimers();
			const idleCallback = jest.fn((cb: () => void) => {
				// Invoke synchronously so we can observe deferral without wall time.
				cb();
				return 42;
			});
			(window as any).requestIdleCallback = idleCallback;
			(window as any).cancelIdleCallback = jest.fn();

			try {
				const manager = createManagerWithEditor(1_000);
				const spy = jest.spyOn(manager as any, 'runAnalysis').mockResolvedValue(undefined);

				manager.scheduleAnalysis();
				expect(spy).not.toHaveBeenCalled();

				jest.advanceTimersByTime(1500);

				expect(idleCallback).toHaveBeenCalledTimes(1);
				expect(idleCallback.mock.calls[0][1]).toEqual({ timeout: 2000 });
				expect(spy).toHaveBeenCalledTimes(1);
			} finally {
				delete (window as any).requestIdleCallback;
				delete (window as any).cancelIdleCallback;
				jest.useRealTimers();
			}
		});

		test('cancels a pending idle callback when analyzeNow is invoked', async () => {
			jest.useFakeTimers();
			const cancelIdle = jest.fn();
			(window as any).requestIdleCallback = jest.fn(() => 7);
			(window as any).cancelIdleCallback = cancelIdle;

			try {
				const manager = createManagerWithEditor(1_000);
				const spy = jest.spyOn(manager as any, 'runAnalysis').mockResolvedValue(undefined);

				manager.scheduleAnalysis();
				jest.advanceTimersByTime(1500);
				expect((manager as any).pendingIdleHandle).toBe(7);

				await manager.analyzeNow();

				expect(cancelIdle).toHaveBeenCalledWith(7);
				expect((manager as any).pendingIdleHandle).toBeNull();
				expect(spy).toHaveBeenCalledTimes(1);
			} finally {
				delete (window as any).requestIdleCallback;
				delete (window as any).cancelIdleCallback;
				jest.useRealTimers();
			}
		});
	});
});
