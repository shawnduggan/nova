/**
 * @file WritingDashboardView Test Suite
 */

import { WorkspaceLeaf } from 'obsidian';
import { type DocumentAnalysisSummary } from '../../src/core/vault-analyzer';
import { WritingDashboardView } from '../../src/ui/writing-dashboard-view';

describe('WritingDashboardView', () => {
	beforeEach(() => {
		installDomHelpers();
	});

	test('rerenders responsive rows in the adopted pop-out window on resize', () => {
		const app = {
			vault: {
				getMarkdownFiles: jest.fn(() => []),
				getFileByPath: jest.fn(() => ({ path: 'notes/example.md', basename: 'example' }))
			},
			workspace: {
				containerEl: document.body,
				openLinkText: jest.fn()
			}
		};
		const plugin = {
			app,
			manifest: { id: 'nova' },
			loadDataWithKey: jest.fn().mockResolvedValue(undefined),
			saveDataWithKey: jest.fn().mockResolvedValue(undefined),
			deleteDataWithKey: jest.fn().mockResolvedValue(undefined),
			settings: {
				dashboard: { excludeFolders: [], targetReadabilityGrade: 8 },
				writingAnalysis: { longSentenceThreshold: 25, veryLongSentenceThreshold: 40 }
			}
		};
		const view = new WritingDashboardView(new WorkspaceLeaf(), plugin as never);
		(view as unknown as { app: typeof app }).app = app;
		(view as unknown as { buildLayout: () => void }).buildLayout();

		const summary: DocumentAnalysisSummary = {
			filePath: 'notes/example.md',
			fileName: 'Example',
			contentHash: 'hash',
			analyzedAt: 1,
			wordCount: 100,
			sentenceCount: 5,
			paragraphCount: 2,
			readingTimeMinutes: 1,
			readabilityGrade: 8,
			readabilityLabel: 'Plain',
			passiveVoicePercentage: 2,
			adverbDensity: 1,
			weakIntensifierCount: 0,
			sentenceLengthStdDev: 5,
			veryLongSentencePercentage: 0,
			score: {
				composite: 80,
				clarity: 20,
				conciseness: 20,
				variety: 20,
				discipline: 20
			}
		};
		(view as unknown as { summaries: Map<string, DocumentAnalysisSummary> }).summaries.set(summary.filePath, summary);

		const rootEl = (view as unknown as { rootEl: HTMLElement }).rootEl;
		Object.defineProperty(rootEl, 'clientWidth', { configurable: true, value: 800 });
		(view as unknown as { render: () => void }).render();

		const tableWrapper = rootEl.querySelector('.nova-writing-dashboard-table-wrapper');
		const mobileList = rootEl.querySelector('.nova-writing-dashboard-mobile-list');
		expect(tableWrapper?.classList.contains('nova-hidden')).toBe(false);
		expect(mobileList?.classList.contains('nova-hidden')).toBe(true);

		const iframe = document.createElement('iframe');
		document.body.appendChild(iframe);
		const popoutDocument = iframe.contentDocument;
		const popoutWindow = iframe.contentWindow;
		expect(popoutDocument).not.toBeNull();
		expect(popoutWindow).not.toBeNull();
		if (!popoutDocument || !popoutWindow) return;

		popoutDocument.body.appendChild(popoutDocument.adoptNode(view.containerEl));
		const requestAnimationFrame = jest.fn((callback: FrameRequestCallback): number => {
			callback(0);
			return 1;
		});
		Object.defineProperty(popoutWindow, 'requestAnimationFrame', {
			configurable: true,
			value: requestAnimationFrame
		});
		Object.defineProperty(popoutWindow, 'matchMedia', {
			configurable: true,
			value: jest.fn(() => ({ matches: true }))
		});
		Object.defineProperty(rootEl, 'clientWidth', { configurable: true, value: 600 });

		view.onResize();

		expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
		expect(tableWrapper?.classList.contains('nova-hidden')).toBe(true);
		expect(mobileList?.classList.contains('nova-hidden')).toBe(false);
		expect(mobileList?.querySelectorAll('.nova-writing-dashboard-mobile-card')).toHaveLength(1);

		Object.defineProperty(popoutWindow, 'matchMedia', {
			configurable: true,
			value: jest.fn(() => ({ matches: false }))
		});
		Object.defineProperty(rootEl, 'clientWidth', { configurable: true, value: 800 });
		view.onResize();

		expect(tableWrapper?.classList.contains('nova-hidden')).toBe(false);
		expect(mobileList?.classList.contains('nova-hidden')).toBe(true);
		iframe.remove();
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
