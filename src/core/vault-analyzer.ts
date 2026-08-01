/**
 * @file VaultAnalyzer - Vault-wide writing analysis with incremental caching and history snapshots
 */

import type { App, TFile } from 'obsidian';
import { Logger } from '../utils/logger';
import type { NovaSettings } from '../settings';
import { analyzeWriting, hasWritingAnalysisOptOut, hashContent } from './writing-analysis';
import {
	calculateWritingScore,
	type WritingScore,
	WRITING_SCORE_MIN_WORDS
} from './writing-score';

const DASHBOARD_CACHE_VERSION = 1;
const DASHBOARD_HISTORY_VERSION = 1;
export const DASHBOARD_CACHE_DATA_KEY = 'dashboardCache';
export const DASHBOARD_HISTORY_DATA_KEY = 'dashboardHistory';
export const LEGACY_DASHBOARD_CACHE_FILE = 'dashboard-cache.json';
export const LEGACY_DASHBOARD_HISTORY_FILE = 'dashboard-history.json';
const MAIN_THREAD_YIELD_BATCH_SIZE = 20;
const CACHE_FLUSH_BATCH_SIZE = 100;
const HISTORY_RETENTION_DAYS = 365;

export interface DocumentAnalysisSummary {
	filePath: string;
	fileName: string;
	contentHash: string;
	analyzedAt: number;
	wordCount: number;
	sentenceCount: number;
	paragraphCount: number;
	readingTimeMinutes: number;
	readabilityGrade: number;
	readabilityLabel: string;
	passiveVoicePercentage: number;
	adverbDensity: number;
	weakIntensifierCount: number;
	sentenceLengthStdDev: number;
	veryLongSentencePercentage: number;
	score: WritingScore | null;
}

export interface DashboardCacheFile {
	version: 1;
	targetGrade: number;
	longSentenceThreshold: number;
	veryLongSentenceThreshold: number;
	entries: Record<string, DocumentAnalysisSummary>;
}

export interface VaultSnapshot {
	timestamp: number;
	date: string;
	documentCount: number;
	totalWords: number;
	averageCompositeScore: number;
	averageClarityScore: number;
	averageConcisenessScore: number;
	averageVarietyScore: number;
	averageDisciplineScore: number;
	averageReadabilityGrade: number;
	averagePassiveVoice: number;
}

export interface DashboardHistoryFile {
	version: 1;
	snapshots: VaultSnapshot[];
}

export interface DashboardDataStore {
	loadData(key: string): Promise<unknown>;
	saveData(key: string, data: unknown): Promise<void>;
	deleteData(key: string): Promise<void>;
}

interface VaultAnalyzerOptions {
	app: App;
	pluginId: string;
	dataStore: DashboardDataStore;
	getSettings: () => Pick<NovaSettings, 'dashboard' | 'writingAnalysis'>;
}

export class VaultAnalyzer {
	private readonly app: App;
	private readonly pluginId: string;
	private readonly dataStore: DashboardDataStore;
	private readonly getSettings: VaultAnalyzerOptions['getSettings'];
	private readonly logger = Logger.scope('VaultAnalyzer');

	constructor(options: VaultAnalyzerOptions) {
		this.app = options.app;
		this.pluginId = options.pluginId;
		this.dataStore = options.dataStore;
		this.getSettings = options.getSettings;
	}

	async hasStoredCache(): Promise<boolean> {
		const cache = await this.readData<DashboardCacheFile>(DASHBOARD_CACHE_DATA_KEY);
		return Boolean(cache && cache.version === DASHBOARD_CACHE_VERSION && cache.entries && typeof cache.entries === 'object');
	}

	async loadCachedSummaries(): Promise<DocumentAnalysisSummary[]> {
		const cache = await this.loadCache();

		return Object.values(cache.entries)
			.map((summary) => {
				if (!summary?.filePath) {
					return null;
				}

				const file = this.app.vault.getFileByPath(summary.filePath);
				if (!file || this.isExcludedPath(summary.filePath)) {
					return null;
				}

				return this.normalizeSummary(summary, file);
			})
			.filter((summary): summary is DocumentAnalysisSummary => summary !== null);
	}

	async analyzeVault(
		onProgress: (completed: number, total: number, latest?: DocumentAnalysisSummary) => void,
		signal?: AbortSignal
	): Promise<DocumentAnalysisSummary[]> {
		const files = this.app.vault.getMarkdownFiles();
		const total = files.length;
		const summaries = new Map<string, DocumentAnalysisSummary>();
		const cache = await this.loadCache();
		const newEntries: Record<string, DocumentAnalysisSummary> = {};
		let completed = 0;

		for (let index = 0; index < files.length; index++) {
			if (signal?.aborted) {
				await this.saveCache({
					...cache,
					entries: newEntries
				});
				return Array.from(summaries.values());
			}

			const file = files[index];
			let latest: DocumentAnalysisSummary | undefined;

			try {
				latest = await this.analyzeFile(file, cache.entries[file.path]);
				} catch {
					this.logger.warn('Failed to analyze a vault file');
			}

			if (latest) {
				summaries.set(latest.filePath, latest);
				newEntries[latest.filePath] = latest;
			}

			completed++;
			onProgress(completed, total, latest);

			if ((index + 1) % CACHE_FLUSH_BATCH_SIZE === 0) {
				await this.saveCache({
					...cache,
					entries: newEntries
				});
			}

			if ((index + 1) % MAIN_THREAD_YIELD_BATCH_SIZE === 0) {
				await this.yieldToMainThread();
			}
		}

		await this.saveCache({
			...cache,
			entries: newEntries
		});

		return Array.from(summaries.values());
	}

	async clearCache(): Promise<void> {
		await this.dataStore.deleteData(DASHBOARD_CACHE_DATA_KEY);
	}

	async loadHistory(): Promise<VaultSnapshot[]> {
		const history = await this.readData<DashboardHistoryFile>(DASHBOARD_HISTORY_DATA_KEY);
		if (!history || history.version !== DASHBOARD_HISTORY_VERSION || !Array.isArray(history.snapshots)) {
			return [];
		}

		return [...history.snapshots].sort((left, right) => left.timestamp - right.timestamp);
	}

	async recordSnapshot(summaries: DocumentAnalysisSummary[]): Promise<VaultSnapshot[]> {
		const scoredDocuments = summaries.filter((summary) => summary.score !== null);
		const history = await this.loadHistory();
		const snapshot = this.buildSnapshot(scoredDocuments);
		const nextSnapshots = history.filter((entry) => entry.date !== snapshot.date);
		nextSnapshots.push(snapshot);
		nextSnapshots.sort((left, right) => left.timestamp - right.timestamp);

		while (nextSnapshots.length > HISTORY_RETENTION_DAYS) {
			nextSnapshots.shift();
		}

		await this.writeData<DashboardHistoryFile>(DASHBOARD_HISTORY_DATA_KEY, {
			version: DASHBOARD_HISTORY_VERSION,
			snapshots: nextSnapshots
		});

		return nextSnapshots;
	}

	private async analyzeFile(file: TFile, cachedSummary?: DocumentAnalysisSummary): Promise<DocumentAnalysisSummary | undefined> {
		if (this.isExcludedPath(file.path)) {
			return undefined;
		}

		const content = await this.app.vault.cachedRead(file);
		if (hasWritingAnalysisOptOut(content)) {
			return undefined;
		}

		const contentHash = hashContent(content);
		if (cachedSummary && cachedSummary.contentHash === contentHash) {
			return this.normalizeSummary(cachedSummary, file);
		}

		const settings = this.getSettings();
		const analysis = analyzeWriting(content, {
			longSentenceThreshold: settings.writingAnalysis.longSentenceThreshold,
			veryLongSentenceThreshold: settings.writingAnalysis.veryLongSentenceThreshold
		});

		const score = analysis.wordCount < WRITING_SCORE_MIN_WORDS
			? null
			: calculateWritingScore(analysis, settings.dashboard.targetReadabilityGrade);

		return {
			filePath: file.path,
			fileName: file.basename,
			contentHash,
			analyzedAt: Date.now(),
			wordCount: analysis.wordCount,
			sentenceCount: analysis.sentenceCount,
			paragraphCount: analysis.paragraphCount,
			readingTimeMinutes: analysis.readingTimeMinutes,
			readabilityGrade: analysis.readabilityGrade,
			readabilityLabel: analysis.readabilityLabel,
			passiveVoicePercentage: analysis.passiveVoicePercentage,
			adverbDensity: analysis.adverbDensity,
			weakIntensifierCount: analysis.weakIntensifierCount,
			sentenceLengthStdDev: analysis.sentenceLengthStdDev ?? 0,
			veryLongSentencePercentage: analysis.veryLongSentencePercentage ?? 0,
			score
		};
	}

	private async loadCache(): Promise<DashboardCacheFile> {
		const settings = this.getSettings();
		const freshCache = this.createEmptyCacheFile();
		const cache = await this.readData<DashboardCacheFile>(DASHBOARD_CACHE_DATA_KEY);

		if (!cache || cache.version !== DASHBOARD_CACHE_VERSION) {
			return freshCache;
		}

		const thresholdsChanged =
			cache.targetGrade !== settings.dashboard.targetReadabilityGrade ||
			cache.longSentenceThreshold !== settings.writingAnalysis.longSentenceThreshold ||
			cache.veryLongSentenceThreshold !== settings.writingAnalysis.veryLongSentenceThreshold;

		if (thresholdsChanged || !cache.entries || typeof cache.entries !== 'object') {
			return freshCache;
		}

		return cache;
	}

	private createEmptyCacheFile(): DashboardCacheFile {
		const settings = this.getSettings();
		return {
			version: DASHBOARD_CACHE_VERSION,
			targetGrade: settings.dashboard.targetReadabilityGrade,
			longSentenceThreshold: settings.writingAnalysis.longSentenceThreshold,
			veryLongSentenceThreshold: settings.writingAnalysis.veryLongSentenceThreshold,
			entries: {}
		};
	}

	private normalizeSummary(summary: DocumentAnalysisSummary, file: TFile): DocumentAnalysisSummary {
		return {
			...summary,
			filePath: summary.filePath || file.path,
			fileName: summary.fileName?.trim() ? summary.fileName : file.basename
		};
	}

	private async saveCache(cache: DashboardCacheFile): Promise<void> {
		await this.writeData(DASHBOARD_CACHE_DATA_KEY, cache);
	}

	private buildSnapshot(summaries: DocumentAnalysisSummary[]): VaultSnapshot {
		const timestamp = Date.now();
		const date = this.toLocalDateString(new Date(timestamp));
		const totalWords = summaries.reduce((sum, summary) => sum + summary.wordCount, 0);

		return {
			timestamp,
			date,
			documentCount: summaries.length,
			totalWords,
			averageCompositeScore: this.average(summaries.map((summary) => summary.score?.composite ?? 0)),
			averageClarityScore: this.average(summaries.map((summary) => summary.score?.clarity ?? 0)),
			averageConcisenessScore: this.average(summaries.map((summary) => summary.score?.conciseness ?? 0)),
			averageVarietyScore: this.average(summaries.map((summary) => summary.score?.variety ?? 0)),
			averageDisciplineScore: this.average(summaries.map((summary) => summary.score?.discipline ?? 0)),
			averageReadabilityGrade: this.average(summaries.map((summary) => summary.readabilityGrade)),
			averagePassiveVoice: this.average(summaries.map((summary) => summary.passiveVoicePercentage))
		};
	}

	private average(values: number[]): number {
		if (values.length === 0) {
			return 0;
		}

		const total = values.reduce((sum, value) => sum + value, 0);
		return Math.round((total / values.length) * 100) / 100;
	}

	private isExcludedPath(filePath: string): boolean {
		const normalizedConfigPrefix = `${this.app.vault.configDir}/plugins/${this.pluginId}/`;
		if (filePath.startsWith(normalizedConfigPrefix)) {
			return true;
		}

		const excludeFolders = this.getSettings().dashboard.excludeFolders
			.map((folder) => this.normalizeFolderPrefix(folder))
			.filter((folder) => folder.length > 0);

		return excludeFolders.some((folder) => filePath.startsWith(folder));
	}

	private normalizeFolderPrefix(folder: string): string {
		const trimmed = folder.trim().replace(/^\/+/, '');
		if (!trimmed) {
			return '';
		}

		return trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
	}

	private async readData<T>(key: string): Promise<T | null> {
		try {
			const data = await this.dataStore.loadData(key);
			return data === undefined || data === null ? null : data as T;
		} catch {
			this.logger.warn('Failed to read dashboard data');
			return null;
		}
	}

	private async writeData<T>(key: string, data: T): Promise<void> {
		try {
			await this.dataStore.saveData(key, data);
		} catch {
			this.logger.error('Failed to write dashboard data');
		}
	}

	private async yieldToMainThread(): Promise<void> {
		await new Promise<void>((resolve) => {
			const ownerWindow = this.app.workspace.containerEl.ownerDocument.defaultView ?? window;
			if (typeof ownerWindow.requestAnimationFrame === 'function') {
				ownerWindow.requestAnimationFrame(() => resolve());
				return;
			}

			resolve();
		});
	}

	private toLocalDateString(date: Date): string {
		const year = date.getFullYear();
		const month = `${date.getMonth() + 1}`.padStart(2, '0');
		const day = `${date.getDate()}`.padStart(2, '0');
		return `${year}-${month}-${day}`;
	}
}
