/**
 * @file Nova plugin-data persistence tests
 */

import { App } from 'obsidian';
import NovaPlugin from '../main';
import {
	DASHBOARD_CACHE_DATA_KEY,
	DASHBOARD_HISTORY_DATA_KEY,
	LEGACY_DASHBOARD_CACHE_FILE,
	LEGACY_DASHBOARD_HISTORY_FILE
} from '../src/core/vault-analyzer';

function createPluginDataHarness(initialData: Record<string, unknown> = {}) {
	const plugin = new NovaPlugin(new App(), {} as never);
	let storedData = { ...initialData };
	const loadData = jest.spyOn(plugin, 'loadData').mockImplementation(async () => ({ ...storedData }));
	const saveData = jest.spyOn(plugin, 'saveData').mockImplementation(async (data: Record<string, unknown>) => {
		await Promise.resolve();
		storedData = { ...data };
	});

	return {
		plugin,
		loadData,
		saveData,
		getStoredData: () => storedData
	};
}

describe('Nova plugin-data store', () => {
	test('serializes concurrent key writes without losing data', async () => {
		const harness = createPluginDataHarness({ existing: true });

		await Promise.all([
			harness.plugin.saveDataWithKey('first', 1),
			harness.plugin.saveDataWithKey('second', 2),
			harness.plugin.saveDataWithKey('third', 3)
		]);

		expect(harness.getStoredData()).toEqual({
			existing: true,
			first: 1,
			second: 2,
			third: 3
		});
	});

	test('keeps the mutation queue usable after a failed write', async () => {
		const harness = createPluginDataHarness({ existing: true });
		harness.saveData.mockRejectedValueOnce(new Error('Storage unavailable'));

		await expect(harness.plugin.saveDataWithKey('failed', true)).rejects.toThrow('Storage unavailable');
		await harness.plugin.saveDataWithKey('recovered', true);

		expect(harness.getStoredData()).toEqual({ existing: true, recovered: true });
	});

	test('replaces settings fields while preserving unrelated plugin data', async () => {
		const harness = createPluginDataHarness({
			general: { previous: true },
			features: { stale: true },
			'nova-conversations': [{ id: 'conversation' }],
			[DASHBOARD_CACHE_DATA_KEY]: { version: 1 },
			futureData: { preserved: true }
		});

		await (harness.plugin as unknown as {
			saveSettingsData(settings: Record<string, unknown>): Promise<void>;
		}).saveSettingsData({ general: { updated: true } });

		expect(harness.getStoredData()).toEqual({
			general: { updated: true },
			'nova-conversations': [{ id: 'conversation' }],
			[DASHBOARD_CACHE_DATA_KEY]: { version: 1 },
			futureData: { preserved: true }
		});
	});

	test('does not treat non-settings plugin data as runtime settings', async () => {
		const harness = createPluginDataHarness({
			general: { showReleaseNotes: false },
			[DASHBOARD_CACHE_DATA_KEY]: { version: 1 },
			'nova-conversations': [{ id: 'conversation' }]
		});

		await harness.plugin.loadSettings();

		expect(harness.plugin.settings.general.showReleaseNotes).toBe(false);
		expect((harness.plugin.settings as unknown as Record<string, unknown>)[DASHBOARD_CACHE_DATA_KEY]).toBeUndefined();
		expect((harness.plugin.settings as unknown as Record<string, unknown>)['nova-conversations']).toBeUndefined();
	});

	test('migrates legacy dashboard files before removing them', async () => {
		const harness = createPluginDataHarness();
		const cache = { version: 1, entries: { note: { filePath: 'note.md' } } };
		const history = { version: 1, snapshots: [{ date: '2026-08-01' }] };
		const legacyFiles = new Map([
			[LEGACY_DASHBOARD_CACHE_FILE, JSON.stringify(cache)],
			[LEGACY_DASHBOARD_HISTORY_FILE, JSON.stringify(history)]
		]);
		const removedFiles: string[] = [];
		Object.defineProperty(harness.plugin, 'manifest', {
			configurable: true,
			value: { id: 'nova' }
		});
		harness.plugin.app.vault.adapter.exists = jest.fn(async (path: string) =>
			Array.from(legacyFiles.keys()).some((fileName) => path.endsWith(fileName))
		);
		harness.plugin.app.vault.adapter.read = jest.fn(async (path: string) => {
			const entry = Array.from(legacyFiles.entries()).find(([fileName]) => path.endsWith(fileName));
			if (!entry) throw new Error('Missing legacy file');
			return entry[1];
		});
		harness.plugin.app.vault.adapter.remove = jest.fn(async (path: string) => {
			removedFiles.push(path);
		});

		await (harness.plugin as unknown as { migrateLegacyDashboardData(): Promise<void> })
			.migrateLegacyDashboardData();

		expect(harness.getStoredData()).toMatchObject({
			[DASHBOARD_CACHE_DATA_KEY]: cache,
			[DASHBOARD_HISTORY_DATA_KEY]: history
		});
		expect(removedFiles).toHaveLength(2);
	});
});
