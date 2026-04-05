/**
 * @file VaultAnalyzer Test Suite
 */

import type { App } from 'obsidian';
import { VaultAnalyzer, type DashboardCacheFile, type DocumentAnalysisSummary } from '../../src/core/vault-analyzer';

type FileRecord = {
	path: string;
	basename: string;
};

describe('VaultAnalyzer', () => {
	function createEnvironment(initialFiles: Record<string, string>) {
		// eslint-disable-next-line obsidianmd/hardcoded-config-path -- Test fixture needs a concrete config dir
		const configDir = '.obsidian';
		const contents = new Map(Object.entries(initialFiles));
		const storage = new Map<string, string>();
		const directories = new Set<string>([configDir]);
		const files = new Map<string, FileRecord>(
			Object.keys(initialFiles).map((path) => [path, { path, basename: path.split('/').pop()?.replace(/\.md$/, '') ?? path }])
		);

		const adapter = {
			exists: jest.fn(async (path: string) => directories.has(path) || storage.has(path)),
			read: jest.fn(async (path: string) => {
				const value = storage.get(path);
				if (value === undefined) {
					throw new Error(`Missing path: ${path}`);
				}
				return value;
			}),
			write: jest.fn(async (path: string, data: string) => {
				storage.set(path, data);
				const segments = path.split('/');
				segments.pop();
				directories.add(segments.join('/'));
			}),
			mkdir: jest.fn(async (path: string) => {
				directories.add(path);
			}),
			remove: jest.fn(async (path: string) => {
				storage.delete(path);
			})
		};

		const app = {
			vault: {
				configDir,
				adapter,
				getMarkdownFiles: () => Array.from(files.values()),
				getFileByPath: (path: string) => files.get(path) ?? null,
				cachedRead: async (file: FileRecord) => contents.get(file.path) ?? ''
			}
		} as unknown as App;

		return { app, adapter, contents, files, storage };
	}

	function createAnalyzer(env: ReturnType<typeof createEnvironment>, settings: {
		dashboard: { excludeFolders: string[]; targetReadabilityGrade: number };
		writingAnalysis: { longSentenceThreshold: number; veryLongSentenceThreshold: number };
	}) {
		return new VaultAnalyzer({
			app: env.app,
			pluginId: 'nova',
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

		const rawCache = env.storage.get(`${env.app.vault.configDir}/plugins/nova/dashboard-cache.json`);
		const cache = JSON.parse(rawCache ?? '{}') as DashboardCacheFile;

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

		const rawCache = env.storage.get(`${env.app.vault.configDir}/plugins/nova/dashboard-cache.json`);
		const cache = JSON.parse(rawCache ?? '{}') as DashboardCacheFile;
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

		const rawCache = env.storage.get(`${env.app.vault.configDir}/plugins/nova/dashboard-cache.json`);
		const cache = JSON.parse(rawCache ?? '{}') as DashboardCacheFile;
		delete cache.entries['notes/keep.md'].fileName;
		env.storage.set(`${env.app.vault.configDir}/plugins/nova/dashboard-cache.json`, JSON.stringify(cache));

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

		expect(env.adapter.write).toHaveBeenCalledTimes(2);
	});
});
