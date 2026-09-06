/**
 * @file SettingsCloudConnection - Verifies the bounded Claude credential probe
 */

import { App, Setting } from 'obsidian';
import { ClaudeProvider } from '../src/ai/providers/claude';
import { DEFAULT_SETTINGS, NovaSettingTab, NovaSettings } from '../src/settings';

interface ConnectionTestTab {
	performRealConnectionTest(provider: 'claude'): Promise<unknown>;
	createTestConnectionButton(container: HTMLElement, provider: 'claude'): void;
	updateConnectionStatus(): void;
}

function createTab() {
	const settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS)) as NovaSettings;
	settings.aiProviders.claude.model = 'claude-fable-5-1';
	const app = new App();
	const tab = new NovaSettingTab(app, { app, settings } as never);
	return { settings, tab: tab as unknown as ConnectionTestTab };
}

describe('Claude settings connection test', () => {
	afterEach(() => jest.restoreAllMocks());

	it('checks credentials with Haiku without changing the saved Fable model', async () => {
		const complete = jest.spyOn(ClaudeProvider.prototype, 'complete').mockResolvedValue('Hi');
		const { settings, tab } = createTab();

		await expect(tab.performRealConnectionTest('claude')).resolves.toEqual({});

		expect(complete).toHaveBeenCalledWith('Reply with only Hi.', 'Hi', {
			model: 'claude-haiku-4-5-20251001',
			maxTokens: 8
		});
		expect(settings.aiProviders.claude.model).toBe('claude-fable-5-1');
	});

	it('preserves a failed credential probe as an error', async () => {
		jest.spyOn(ClaudeProvider.prototype, 'complete').mockRejectedValue(new Error('Claude API error: 401'));
		const { tab } = createTab();

		await expect(tab.performRealConnectionTest('claude')).rejects.toThrow('Claude API error: 401');
	});

	it('explains that the credential check does not verify the selected model', () => {
		const setDesc = jest.spyOn(Setting.prototype, 'setDesc');
		jest.spyOn(Setting.prototype, 'addButton').mockReturnThis();
		const { tab } = createTab();
		jest.spyOn(tab, 'updateConnectionStatus').mockImplementation(() => undefined);

		tab.createTestConnectionButton(document.createElement('div'), 'claude');

		expect(setDesc).toHaveBeenCalledWith('Check credentials with Haiku. Access to your selected model is checked when you use it.');
	});
});
