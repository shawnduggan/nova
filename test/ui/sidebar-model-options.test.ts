/**
 * @file SidebarModelOptions - Preserves selected models outside the curated list
 */

import { Platform } from 'obsidian';
import { DEFAULT_SETTINGS, NovaSettings } from '../../src/settings';
import { NovaSidebarView } from '../../src/ui/sidebar-view';

interface ModelOptionsView {
	providerDropdown: { selectEl: HTMLSelectElement; setValue(value: string): void };
	getAvailableModels(provider: string): Array<{ value: string; label: string }>;
	updateProviderOptions(): Promise<void>;
}

function addObsidianDOMMethods<T extends HTMLElement>(element: T): T {
	element.empty = () => element.replaceChildren();
	element.createEl = ((tag: keyof HTMLElementTagNameMap) => {
		const child = addObsidianDOMMethods(document.createElement(tag));
		element.appendChild(child);
		return child;
	}) as typeof element.createEl;
	return element;
}

function createView(model: string, platform: 'desktop' | 'mobile' = 'desktop') {
	const settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS)) as NovaSettings;
	settings.platformSettings[platform] = { selectedProvider: 'claude', selectedModel: model };
	settings.aiProviders.claude = { apiKey: 'mock-key', model, status: { state: 'connected' } };
	settings.aiProviders.openai = { apiKey: 'mock-key', status: { state: 'connected' } };
	const plugin = {
		settings,
		aiProviderManager: {
			getCurrentProviderType: jest.fn().mockResolvedValue('claude'),
			getCurrentModel: () => settings.platformSettings[platform].selectedModel,
			getAvailableProvidersWithStatus: jest.fn().mockResolvedValue([['claude', true], ['openai', true]])
		}
	};
	const view = new NovaSidebarView({} as never, plugin as never) as unknown as ModelOptionsView;
	const selectEl = addObsidianDOMMethods(document.createElement('select'));
	view.providerDropdown = { selectEl, setValue: value => { selectEl.value = value; } };
	jest.spyOn(view, 'getAvailableModels').mockImplementation(provider => provider === 'claude'
		? [{ value: 'claude-opus-5', label: 'Claude Opus 5' }]
		: [{ value: 'gpt-5.6-sol', label: 'GPT-5.6 Sol' }]);
	return { view, selectEl, settings };
}

describe('Sidebar saved model selection', () => {
	afterEach(() => {
		(Platform as unknown as { isMobile: boolean }).isMobile = false;
		jest.restoreAllMocks();
	});

	it.each(['desktop', 'mobile'] as const)('keeps a saved legacy model selected on %s without migrating it', async platform => {
		(Platform as unknown as { isMobile: boolean }).isMobile = platform === 'mobile';
		const { view, selectEl, settings } = createView('claude-opus-4-6', platform);
		const before = JSON.stringify(settings);

		await view.updateProviderOptions();

		expect(selectEl.value).toBe('claude::claude-opus-4-6');
		expect(selectEl.selectedOptions[0].textContent).toBe('claude-opus-4-6 (saved)');
		expect(selectEl.selectedOptions[0].parentElement?.tagName).toBe('OPTGROUP');
		expect(selectEl.querySelector('option[value="openai::claude-opus-4-6"]')).toBeNull();
		expect(JSON.stringify(settings)).toBe(before);
	});

	it('does not duplicate or relabel a curated selection', async () => {
		const { view, selectEl } = createView('claude-opus-5');

		await view.updateProviderOptions();
		await view.updateProviderOptions();

		expect(selectEl.value).toBe('claude::claude-opus-5');
		expect(selectEl.selectedOptions[0].textContent).toBe('Claude Opus 5');
		expect(selectEl.querySelectorAll('option[value="claude::claude-opus-5"]')).toHaveLength(1);
		expect(selectEl.textContent).not.toContain('(saved)');
	});

	it('preserves the mobile-disabled state instead of adding saved models', async () => {
		(Platform as unknown as { isMobile: boolean }).isMobile = true;
		const { view, selectEl } = createView('none', 'mobile');

		await view.updateProviderOptions();

		expect(selectEl.options).toHaveLength(1);
		expect(selectEl.options[0].textContent).toBe('Mobile disabled');
		expect(selectEl.options[0].disabled).toBe(true);
	});
});
