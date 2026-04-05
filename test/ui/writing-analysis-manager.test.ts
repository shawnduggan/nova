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
});
