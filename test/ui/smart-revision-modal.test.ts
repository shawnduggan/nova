/**
 * @file SmartRevisionModal Test Suite
 */

import { Editor } from 'obsidian';
import { SmartRevisionModal } from '../../src/ui/smart-revision-modal';
import type { SmartRevisionService } from '../../src/features/smart-revision/smart-revision-service';
import {
	DEFAULT_SMART_REVISION_BRIEF,
	getSmartRevisionPass,
	type SmartRevisionSourceIssue,
	type SmartRevisionSession
} from '../../src/features/smart-revision/smart-revision-types';

describe('SmartRevisionModal', () => {
	beforeEach(() => {
		installDomHelpers();
	});

	test('renders a static preview for free users without generating', () => {
		const editor = createEditor('This is very unclear.');
		const service = createService(createSession('This is very unclear.', 'This is clear.'));
		const modal = new SmartRevisionModal(
			createPlugin(),
			editor,
			createTarget('This is very unclear.'),
			service,
			{ accessAllowed: false }
		);

		modal.open();

		expect(modal.contentEl.textContent).toContain('premium feature unlocked by Supernova');
		expect(modal.contentEl.textContent).toContain('Unlock Smart Revision with Supernova');
		expect(modal.contentEl.textContent).toContain('Split long sentence');
		expect(service.generateSession).not.toHaveBeenCalled();
	});

	test('opens the plans URL from the free preview CTA', () => {
		const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
		const editor = createEditor('This is very unclear.');
		const service = createService(createSession('This is very unclear.', 'This is clear.'));
		const modal = new SmartRevisionModal(
			createPlugin(),
			editor,
			createTarget('This is very unclear.'),
			service,
			{ accessAllowed: false, plansUrl: 'https://example.com/plans' }
		);

		modal.open();
		clickByText(modal.contentEl, 'Unlock Smart Revision with Supernova');

		expect(openSpy).toHaveBeenCalledWith('https://example.com/plans', '_blank', 'noopener');
		expect(service.generateSession).not.toHaveBeenCalled();

		openSpy.mockRestore();
	});

	test('focuses the brief surface instead of outlining a pass on initial open', () => {
		jest.useFakeTimers();
		const editor = createEditor('This is very unclear.');
		const service = createService(createSession('This is very unclear.', 'This is clear.'));
		const modal = new SmartRevisionModal(
			createPlugin(),
			editor,
			createTarget('This is very unclear.', 'repeated-phrase'),
			service,
			{ accessAllowed: true }
		);
		document.body.appendChild(modal.contentEl);

		try {
			modal.open();
			jest.advanceTimersByTime(75);

			const clarityButton = findButtonContainingText(modal.contentEl, 'Clarity');
			const flowButton = findButtonContainingText(modal.contentEl, 'Flow');
			expect(flowButton.getAttribute('aria-pressed')).toBe('true');
			expect(document.activeElement).toBe(modal.contentEl);
			expect(clarityButton).not.toBe(document.activeElement);
			expect(flowButton).not.toBe(document.activeElement);
		} finally {
			modal.close();
			modal.contentEl.remove();
			jest.useRealTimers();
		}
	});

	test('shows progress while generating a proposal', async () => {
		const editor = createEditor('This is very unclear.');
		const { service, resolve } = createDeferredService(createSession('This is very unclear.', 'This is clear.'));
		const modal = new SmartRevisionModal(
			createPlugin(),
			editor,
			createTarget('This is very unclear.'),
			service,
			{ accessAllowed: true }
		);

		modal.open();
		clickButtonContainingText(modal.contentEl, 'Flow');
		clickButtonContainingText(modal.contentEl, 'Bold');
		clickCheckboxByLabel(modal.contentEl, 'Preserve Markdown');
		setFieldValue(modal.contentEl, 'Who this passage is for', 'Newsletter readers');
		setFieldValue(modal.contentEl, 'What this passage needs to do', 'Make the point faster');
		setFieldValue(modal.contentEl, 'Names, terms, claims, or phrases to preserve', 'Product names and quoted claims');
		clickByText(modal.contentEl, 'Generate proposal');

		const progressEl = modal.contentEl.querySelector('.nova-smart-revision-progress');
		expect(progressEl?.getAttribute('role')).toBe('progressbar');
		expect(progressEl?.getAttribute('aria-valuetext')).toBe('Generating proposal');
		expect(modal.contentEl.textContent).toContain('Preparing Flow revision');
		expect(modal.contentEl.textContent).toContain('Request summary');
		expect(modal.contentEl.textContent).toContain('Pass: Flow');
		expect(modal.contentEl.textContent).toContain('Posture: Bold');
		expect(modal.contentEl.textContent).toContain('Guardrails: Voice, Meaning, No new facts');
		expect(modal.contentEl.textContent).toContain('Audience: Newsletter readers');
		expect(modal.contentEl.textContent).toContain('Goal: Make the point faster');
		expect(modal.contentEl.textContent).toContain('Do not change: Product names and quoted claims');
		expect(modal.contentEl.textContent).not.toContain('Preserve Markdown');
		expect(modal.contentEl.querySelector('.nova-smart-revision-loading-step')).toBeNull();
		expect(modal.contentEl.textContent).not.toContain('Reviewing selection');

		resolve();
		await flushPromises();
		expect(modal.contentEl.textContent).toContain('Proposed revision');
	});

	test('accepts safe cards and applies one editor replacement', async () => {
		const editor = createEditor('This is very unclear.');
		const replaceSpy = jest.spyOn(editor, 'replaceRange');
		const service = createService(createSession('This is very unclear.', 'This is clear.'));
		const writingAnalysisManager = { analyzeNow: jest.fn(async () => undefined) };
		const onComplete = jest.fn();
		const modal = new SmartRevisionModal(
			createPlugin({ writingAnalysisManager }),
			editor,
			createTarget('This is very unclear.'),
			service,
			{ accessAllowed: true, onComplete }
		);

		modal.open();
		clickByText(modal.contentEl, 'Generate proposal');
		await flushPromises();
		clickByText(modal.contentEl, 'Accept all');
		clickByText(modal.contentEl, 'Apply accepted');
		await flushPromises();

		expect(replaceSpy).toHaveBeenCalledTimes(1);
		expect(replaceSpy).toHaveBeenCalledWith('This is clear.', { line: 0, ch: 0 }, { line: 0, ch: 21 });
		expect(writingAnalysisManager.analyzeNow).toHaveBeenCalledTimes(1);
		expect(onComplete).toHaveBeenCalled();
		expect(writingAnalysisManager.analyzeNow.mock.invocationCallOrder[0]).toBeLessThan(onComplete.mock.invocationCallOrder[0]);
	});

	test('updates the proposed revision when cards are accepted or rejected', async () => {
		const originalText = 'This is very unclear today.';
		const session = createSession(originalText, 'This is clear now.');
		session.cards = [
			createCard('card-1', 'Simplified phrase', 'very unclear', 'clear', 8, 20, 'accepted'),
			createCard('card-2', 'Tightened timing', 'today', 'now', 21, 26, 'accepted')
		];
		const editor = createEditor(originalText);
		const service = createService(session);
		const modal = new SmartRevisionModal(
			createPlugin(),
			editor,
			createTarget(originalText),
			service,
			{ accessAllowed: true }
		);

		modal.open();
		clickByText(modal.contentEl, 'Generate proposal');
		await flushPromises();

		expect(getInsertedDiffText(modal.contentEl)).toContain('clear');
		expect(getInsertedDiffText(modal.contentEl)).toContain('now');
		expect(getCardChangeText(modal.contentEl, 'Simplified phrase')).toContain('Beforevery unclear');
		expect(getCardChangeText(modal.contentEl, 'Simplified phrase')).toContain('Afterclear');

		clickCardAction(modal.contentEl, 'Simplified phrase', 'Reject');

		expect(getInsertedDiffText(modal.contentEl)).not.toContain('clear');
		expect(getInsertedDiffText(modal.contentEl)).toContain('now');

		clickCardAction(modal.contentEl, 'Simplified phrase', 'Accept');

		expect(getInsertedDiffText(modal.contentEl)).toContain('clear');
		expect(getInsertedDiffText(modal.contentEl)).toContain('now');
	});

	test('passes selected revision options and optional context to the service', async () => {
		const editor = createEditor('This is very unclear.');
		const service = createService(createSession('This is very unclear.', 'This is clear.'));
		const modal = new SmartRevisionModal(
			createPlugin(),
			editor,
			createTarget('This is very unclear.'),
			service,
			{ accessAllowed: true }
		);

		modal.open();
		clickButtonContainingText(modal.contentEl, 'Flow');
		clickButtonContainingText(modal.contentEl, 'Bold');
		clickCheckboxByLabel(modal.contentEl, 'Preserve Markdown');
		setFieldValue(modal.contentEl, 'Who this passage is for', 'Newsletter readers');
		setFieldValue(modal.contentEl, 'What this passage needs to do', 'Make the point faster');
		setFieldValue(modal.contentEl, 'Optional extra direction for this pass', 'Keep the shorthand style.');
		clickByText(modal.contentEl, 'Generate proposal');
		await flushPromises();

		expect(service.generateSession).toHaveBeenCalledWith({
			target: createTarget('This is very unclear.'),
			brief: expect.objectContaining({
				passId: 'flow',
				posture: 'bold',
				preserveMarkdown: false,
				audience: 'Newsletter readers',
				goal: 'Make the point faster',
				customInstruction: 'Keep the shorthand style.'
			})
		});
	});

	test('keeps high-risk cards out of accept all', async () => {
		const editor = createEditor('Revenue grew 12%.');
		const replaceSpy = jest.spyOn(editor, 'replaceRange');
		const session = createSession('Revenue grew 12%.', 'Revenue grew 18%.');
		session.cards[0].risk = {
			level: 'high',
			flags: [{ id: 'numbers', label: 'Numbers changed', severity: 'high', detail: '12 to 18' }]
		};
		const service = createService(session);
		const modal = new SmartRevisionModal(
			createPlugin(),
			editor,
			createTarget('Revenue grew 12%.'),
			service,
			{ accessAllowed: true }
		);

		modal.open();
		clickByText(modal.contentEl, 'Generate proposal');
		await flushPromises();
		clickByText(modal.contentEl, 'Accept all');
		clickByText(modal.contentEl, 'Apply accepted');
		await flushPromises();

		expect(replaceSpy).not.toHaveBeenCalled();
		expect(modal.contentEl.textContent).toContain('pending');
	});
});

function createPlugin(overrides: Record<string, unknown> = {}) {
	return {
		app: {},
		registerDomEvent: jest.fn((element: HTMLElement, type: string, handler: EventListener) => {
			element.addEventListener(type, handler);
		}),
		...overrides
	} as never;
}

function createEditor(content: string): Editor {
	const editor = new Editor(content);
	editor.setSelection({ line: 0, ch: 0 }, { line: 0, ch: content.length });
	return editor;
}

function createTarget(text: string, sourceIssueType?: SmartRevisionSourceIssue['type']) {
	return {
		text,
		range: { from: { line: 0, ch: 0 }, to: { line: 0, ch: text.length } },
		filePath: 'note.md',
		...(sourceIssueType ? { sourceIssue: createSourceIssue(text, sourceIssueType) } : {})
	};
}

function createSourceIssue(text: string, type: SmartRevisionSourceIssue['type']): SmartRevisionSourceIssue {
	return {
		id: 'issue-1',
		type,
		label: 'Repeated phrase',
		excerpt: text,
		sourceText: text,
		targetText: text,
		explanation: 'Keep the stronger use and rewrite or remove the echo.',
		suggestion: 'Smooth the repeated phrasing.',
		line: 0,
		startCh: 0,
		endCh: text.length,
		targetLine: 0,
		targetStartCh: 0,
		targetEndCh: text.length
	};
}

function createService(session: SmartRevisionSession): jest.Mocked<Pick<SmartRevisionService, 'generateSession'>> {
	return {
		generateSession: jest.fn(async () => session)
	};
}

function createDeferredService(session: SmartRevisionSession): {
	service: jest.Mocked<Pick<SmartRevisionService, 'generateSession'>>;
	resolve: () => void;
} {
	let resolvePromise: () => void = () => undefined;
	const promise = new Promise<SmartRevisionSession>((resolve) => {
		resolvePromise = () => resolve(session);
	});
	return {
		service: {
			generateSession: jest.fn(() => promise)
		},
		resolve: resolvePromise
	};
}

function createSession(originalText: string, revisedText: string): SmartRevisionSession {
	return {
		id: 'session-1',
		pass: getSmartRevisionPass('clarity'),
		brief: { ...DEFAULT_SMART_REVISION_BRIEF },
		snapshot: {
			originalText,
			range: { from: { line: 0, ch: 0 }, to: { line: 0, ch: originalText.length } },
			filePath: 'note.md',
			createdAt: 1
		},
		revisedText,
		cards: [{
			id: 'card-1',
			label: 'Revised passage',
			originalText,
			revisedText,
			rationale: 'Clearer phrasing.',
			impact: { summary: '1 measure improved', metrics: [] },
			risk: { level: 'low', flags: [] },
			status: 'pending',
			startIndex: 0,
			endIndex: originalText.length
		}],
		impact: { summary: '1 measure improved', metrics: [] },
		risk: { level: 'low', flags: [] },
		modelRationale: 'Clearer phrasing.'
	};
}

function createCard(
	id: string,
	label: string,
	originalText: string,
	revisedText: string,
	startIndex: number,
	endIndex: number,
	status: SmartRevisionSession['cards'][number]['status']
): SmartRevisionSession['cards'][number] {
	return {
		id,
		label,
		originalText,
		revisedText,
		rationale: 'Clearer phrasing.',
		impact: { summary: '1 measure improved', metrics: [] },
		risk: { level: 'low', flags: [] },
		status,
		startIndex,
		endIndex
	};
}

function clickByText(container: HTMLElement, text: string): void {
	const button = Array.from(container.querySelectorAll('button'))
		.find((candidate) => candidate.textContent === text) as HTMLButtonElement | undefined;
	if (!button) {
		throw new Error(`Button not found: ${text}`);
	}
	button.click();
}

function clickButtonContainingText(container: HTMLElement, text: string): void {
	findButtonContainingText(container, text).click();
}

function findButtonContainingText(container: HTMLElement, text: string): HTMLButtonElement {
	const button = Array.from(container.querySelectorAll('button'))
		.find((candidate) => candidate.textContent?.includes(text)) as HTMLButtonElement | undefined;
	if (!button) {
		throw new Error(`Button not found: ${text}`);
	}
	return button;
}

function clickCardAction(container: HTMLElement, cardLabel: string, actionText: string): void {
	const card = findCard(container, cardLabel);
	const button = Array.from(card?.querySelectorAll('button') ?? [])
		.find((candidate) => candidate.textContent === actionText) as HTMLButtonElement | undefined;
	if (!button) {
		throw new Error(`Card action not found: ${cardLabel} ${actionText}`);
	}
	button.click();
}

function findCard(container: HTMLElement, cardLabel: string): Element | undefined {
	return Array.from(container.querySelectorAll('.nova-smart-revision-card'))
		.find((candidate) => candidate.textContent?.includes(cardLabel));
}

function getCardChangeText(container: HTMLElement, cardLabel: string): string {
	const changeEl = findCard(container, cardLabel)?.querySelector('.nova-smart-revision-card-change');
	if (!changeEl) {
		throw new Error(`Card change not found: ${cardLabel}`);
	}
	return changeEl.textContent ?? '';
}

function getInsertedDiffText(container: HTMLElement): string {
	return Array.from(container.querySelectorAll('.nova-smart-revision-diff-segment--insert'))
		.map((element) => element.textContent ?? '')
		.join('');
}

function clickCheckboxByLabel(container: HTMLElement, text: string): void {
	const label = Array.from(container.querySelectorAll('label'))
		.find((candidate) => candidate.textContent?.includes(text));
	const checkbox = label?.querySelector('input[type="checkbox"]') as HTMLInputElement | undefined;
	if (!checkbox) {
		throw new Error(`Checkbox not found: ${text}`);
	}
	checkbox.checked = !checkbox.checked;
	checkbox.dispatchEvent(new Event('change', { bubbles: true }));
}

function setFieldValue(container: HTMLElement, placeholder: string, value: string): void {
	const field = container.querySelector(`[placeholder="${placeholder}"]`) as HTMLInputElement | HTMLTextAreaElement | null;
	if (!field) {
		throw new Error(`Field not found: ${placeholder}`);
	}
	field.value = value;
	field.dispatchEvent(new Event('input', { bubbles: true }));
}

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
}
