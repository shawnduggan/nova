/**
 * @file VaultAnalyzer Test Suite
 */

import type { App } from 'obsidian';
import {
	DASHBOARD_CACHE_DATA_KEY,
	DASHBOARD_HISTORY_DATA_KEY,
	VaultAnalyzer,
	type DashboardCacheFile,
	type DocumentAnalysisSummary
} from '../../src/core/vault-analyzer';

type FileRecord = {
	path: string;
	basename: string;
};

describe('VaultAnalyzer', () => {
	function createEnvironment(initialFiles: Record<string, string>) {
		// eslint-disable-next-line obsidianmd/hardcoded-config-path -- Test fixture needs a concrete config dir
		const configDir = '.obsidian';
		const contents = new Map(Object.entries(initialFiles));
			const storage = new Map<string, unknown>();
		const files = new Map<string, FileRecord>(
			Object.keys(initialFiles).map((path) => [path, { path, basename: path.split('/').pop()?.replace(/\.md$/, '') ?? path }])
		);

			const dataStore = {
				loadData: jest.fn(async (key: string) => storage.get(key)),
				saveData: jest.fn(async (key: string, data: unknown) => {
					storage.set(key, data);
				}),
				deleteData: jest.fn(async (key: string) => {
					storage.delete(key);
				})
			};

		const app = {
				vault: {
					configDir,
					getMarkdownFiles: () => Array.from(files.values()),
				getFileByPath: (path: string) => files.get(path) ?? null,
				cachedRead: async (file: FileRecord) => contents.get(file.path) ?? ''
			},
			workspace: {
				containerEl: document.body
			}
		} as unknown as App;

			return { app, dataStore, contents, files, storage };
	}

	function createAnalyzer(env: ReturnType<typeof createEnvironment>, settings: {
		dashboard: { excludeFolders: string[]; targetReadabilityGrade: number };
		writingAnalysis: { longSentenceThreshold: number; veryLongSentenceThreshold: number };
	}) {
			return new VaultAnalyzer({
				app: env.app,
				pluginId: 'nova',
				dataStore: env.dataStore,
				getSettings: () => settings as never
		});
	}

	test('reports progress for all files and omits latest summary for skipped files', async () => {
		const env = createEnvironment({
			'notes/essay.md': 'This is a real note. It has enough content to analyze meaningfully.',
			'templates/template.md': 'This template should be excluded from the dashboard.',
			'notes/opted-out.md': ['---', 'nova-analysis: false', '---', 'This file is opted out.'].join('\n')
		});
		const settings = {
			dashboard: { excludeFolders: ['templates/'], targetReadabilityGrade: 8 },
			writingAnalysis: { longSentenceThreshold: 25, veryLongSentenceThreshold: 40 }
		};
		const analyzer = createAnalyzer(env, settings);
		const progress: Array<{ completed: number; total: number; latest?: DocumentAnalysisSummary }> = [];

		const results = await analyzer.analyzeVault((completed, total, latest) => {
			progress.push({ completed, total, latest });
		});

		expect(results).toHaveLength(1);
		expect(progress).toHaveLength(3);
		expect(progress.map((entry) => entry.completed)).toEqual([1, 2, 3]);
		expect(progress.every((entry) => entry.total === 3)).toBe(true);
		expect(progress.filter((entry) => entry.latest).map((entry) => entry.latest?.filePath)).toEqual(['notes/essay.md']);
	});

	test('reuses cached summaries until file content changes', async () => {
		const env = createEnvironment({
			'notes/essay.md': 'This note has enough words to generate a score and be cached for the dashboard.'
		});
		const settings = {
			dashboard: { excludeFolders: [], targetReadabilityGrade: 8 },
			writingAnalysis: { longSentenceThreshold: 25, veryLongSentenceThreshold: 40 }
		};
		const analyzer = createAnalyzer(env, settings);
		const nowSpy = jest.spyOn(Date, 'now');

		nowSpy.mockReturnValue(1000);
		const first = await analyzer.analyzeVault(() => undefined);
		nowSpy.mockReturnValue(2000);
		const second = await analyzer.analyzeVault(() => undefined);

		expect(second[0].analyzedAt).toBe(first[0].analyzedAt);

		env.contents.set('notes/essay.md', 'This note changed enough to require a fresh dashboard summary with a new timestamp.');
		nowSpy.mockReturnValue(3000);
		const third = await analyzer.analyzeVault(() => undefined);

		expect(third[0].analyzedAt).toBe(3000);
		nowSpy.mockRestore();
	});

	test('invalidates cache when analysis thresholds change', async () => {
		const env = createEnvironment({
			'notes/essay.md': 'This sentence is intentionally long enough to react when thresholds change across dashboard runs.'
		});
		const settings = {
			dashboard: { excludeFolders: [], targetReadabilityGrade: 8 },
			writingAnalysis: { longSentenceThreshold: 25, veryLongSentenceThreshold: 40 }
		};
		const analyzer = createAnalyzer(env, settings);
		const nowSpy = jest.spyOn(Date, 'now');

		nowSpy.mockReturnValue(1000);
		const first = await analyzer.analyzeVault(() => undefined);

		settings.writingAnalysis.longSentenceThreshold = 30;
		nowSpy.mockReturnValue(2000);
		const second = await analyzer.analyzeVault(() => undefined);

		expect(second[0].analyzedAt).toBe(2000);
		expect(second[0].analyzedAt).not.toBe(first[0].analyzedAt);
		nowSpy.mockRestore();
	});

	test('removes stale cache entries when files disappear from the vault', async () => {
		const env = createEnvironment({
			'notes/keep.md': 'This note stays in the vault for the dashboard cache test.',
			'notes/remove.md': 'This note will disappear before the second scan.'
		});
		const settings = {
			dashboard: { excludeFolders: [], targetReadabilityGrade: 8 },
			writingAnalysis: { longSentenceThreshold: 25, veryLongSentenceThreshold: 40 }
		};
		const analyzer = createAnalyzer(env, settings);

		await analyzer.analyzeVault(() => undefined);
		env.files.delete('notes/remove.md');
		env.contents.delete('notes/remove.md');

		await analyzer.analyzeVault(() => undefined);

			const cache = env.storage.get(DASHBOARD_CACHE_DATA_KEY) as DashboardCacheFile;

		expect(Object.keys(cache.entries)).toEqual(['notes/keep.md']);
	});

	test('drops excluded folders from results and cache after settings change', async () => {
		const env = createEnvironment({
			'notes/keep.md': 'This note should remain visible in the dashboard after exclusions change.',
			'templates/excluded.md': 'This note should disappear once the templates folder is excluded.'
		});
		const settings = {
			dashboard: { excludeFolders: [], targetReadabilityGrade: 8 },
			writingAnalysis: { longSentenceThreshold: 25, veryLongSentenceThreshold: 40 }
		};
		const analyzer = createAnalyzer(env, settings);

		const firstResults = await analyzer.analyzeVault(() => undefined);
		expect(firstResults.map((summary) => summary.filePath).sort()).toEqual([
			'notes/keep.md',
			'templates/excluded.md'
		]);

		settings.dashboard.excludeFolders = ['templates'];
		const secondResults = await analyzer.analyzeVault(() => undefined);

		expect(secondResults.map((summary) => summary.filePath)).toEqual(['notes/keep.md']);

			const cache = env.storage.get(DASHBOARD_CACHE_DATA_KEY) as DashboardCacheFile;
		expect(Object.keys(cache.entries)).toEqual(['notes/keep.md']);
	});

		test('detects whether dashboard cache has been stored yet', async () => {
		const env = createEnvironment({
			'notes/keep.md': 'This note should create a cache file after the first scan.'
		});
		const settings = {
			dashboard: { excludeFolders: [], targetReadabilityGrade: 8 },
			writingAnalysis: { longSentenceThreshold: 25, veryLongSentenceThreshold: 40 }
		};
		const analyzer = createAnalyzer(env, settings);

		expect(await analyzer.hasStoredCache()).toBe(false);

		await analyzer.analyzeVault(() => undefined);

			expect(await analyzer.hasStoredCache()).toBe(true);
		});

		test('clears cached dashboard data through the plugin data store', async () => {
			const env = createEnvironment({
				'notes/keep.md': 'This note should create a cache before it is cleared.'
			});
			const analyzer = createAnalyzer(env, {
				dashboard: { excludeFolders: [], targetReadabilityGrade: 8 },
				writingAnalysis: { longSentenceThreshold: 25, veryLongSentenceThreshold: 40 }
			});

			await analyzer.analyzeVault(() => undefined);
			await analyzer.clearCache();

			expect(env.dataStore.deleteData).toHaveBeenCalledWith(DASHBOARD_CACHE_DATA_KEY);
			expect(env.storage.has(DASHBOARD_CACHE_DATA_KEY)).toBe(false);
		});

		test('records and reloads dashboard history through the plugin data store', async () => {
			const env = createEnvironment({
				'notes/keep.md': 'This note provides a dashboard snapshot for persisted history.'
			});
			const analyzer = createAnalyzer(env, {
				dashboard: { excludeFolders: [], targetReadabilityGrade: 8 },
				writingAnalysis: { longSentenceThreshold: 25, veryLongSentenceThreshold: 40 }
			});
			const summaries = await analyzer.analyzeVault(() => undefined);

			const recorded = await analyzer.recordSnapshot(summaries);
			const restored = await analyzer.loadHistory();

			expect(recorded).toHaveLength(1);
			expect(restored).toEqual(recorded);
			expect(env.storage.get(DASHBOARD_HISTORY_DATA_KEY)).toMatchObject({
				version: 1,
				snapshots: recorded
			});
		});

	test('loads existing cached summaries for still-included files', async () => {
		const env = createEnvironment({
			'notes/keep.md': 'This note should be available from cache on the next dashboard open.',
			'templates/excluded.md': 'This note should be filtered out once the folder is excluded.'
		});
		const settings = {
			dashboard: { excludeFolders: [], targetReadabilityGrade: 8 },
			writingAnalysis: { longSentenceThreshold: 25, veryLongSentenceThreshold: 40 }
		};
		const analyzer = createAnalyzer(env, settings);

		await analyzer.analyzeVault(() => undefined);

		settings.dashboard.excludeFolders = ['templates'];
		env.files.delete('notes/keep.md');

		const cached = await analyzer.loadCachedSummaries();

		expect(cached).toHaveLength(0);

		env.files.set('notes/keep.md', { path: 'notes/keep.md', basename: 'keep' });
		const restored = await analyzer.loadCachedSummaries();
		expect(restored.map((summary) => summary.filePath)).toEqual(['notes/keep.md']);
	});

	test('restores missing cached file names from file paths', async () => {
		const env = createEnvironment({
			'notes/keep.md': 'This note should recover its display name from the file path.'
		});
		const settings = {
			dashboard: { excludeFolders: [], targetReadabilityGrade: 8 },
			writingAnalysis: { longSentenceThreshold: 25, veryLongSentenceThreshold: 40 }
		};
		const analyzer = createAnalyzer(env, settings);

		await analyzer.analyzeVault(() => undefined);

			const cache = env.storage.get(DASHBOARD_CACHE_DATA_KEY) as DashboardCacheFile;
			delete cache.entries['notes/keep.md'].fileName;
			env.storage.set(DASHBOARD_CACHE_DATA_KEY, cache);

		const restored = await analyzer.loadCachedSummaries();
		expect(restored[0].fileName).toBe('keep');
	});

	test('flushes cache in larger batches during long scans', async () => {
		const fileEntries = Object.fromEntries(
			Array.from({ length: 120 }, (_, index) => [
				`notes/file-${index + 1}.md`,
				'This is a moderately sized note with enough content to produce a dashboard summary during the vault scan.'
			])
		);
		const env = createEnvironment(fileEntries);
		const settings = {
			dashboard: { excludeFolders: [], targetReadabilityGrade: 8 },
			writingAnalysis: { longSentenceThreshold: 25, veryLongSentenceThreshold: 40 }
		};
		const analyzer = createAnalyzer(env, settings);

		await analyzer.analyzeVault(() => undefined);

			expect(env.dataStore.saveData).toHaveBeenCalledTimes(2);
	});

	test('yields through the workspace window during long scans', async () => {
		const fileEntries = Object.fromEntries(
			Array.from({ length: 20 }, (_, index) => [
				`notes/file-${index + 1}.md`,
				'This note has enough content to produce a dashboard summary during the vault scan.'
			])
		);
		const env = createEnvironment(fileEntries);
		const iframe = document.createElement('iframe');
		document.body.appendChild(iframe);
		const iframeDocument = iframe.contentDocument;
		const iframeWindow = iframe.contentWindow;

		expect(iframeDocument).not.toBeNull();
		expect(iframeWindow).not.toBeNull();
		if (!iframeDocument || !iframeWindow) return;

		const containerEl = iframeDocument.createElement('div');
		iframeDocument.body.appendChild(containerEl);
		(env.app.workspace as { containerEl: HTMLElement }).containerEl = containerEl;
		const requestAnimationFrame = jest.fn((callback: FrameRequestCallback): number => {
			callback(0);
			return 1;
		});
		Object.defineProperty(iframeWindow, 'requestAnimationFrame', {
			configurable: true,
			value: requestAnimationFrame
		});
		const analyzer = createAnalyzer(env, {
			dashboard: { excludeFolders: [], targetReadabilityGrade: 8 },
			writingAnalysis: { longSentenceThreshold: 25, veryLongSentenceThreshold: 40 }
		});

		try {
			await analyzer.analyzeVault(() => undefined);
			expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
		} finally {
			iframe.remove();
		}
	});
});
