/**
 * @file SettingsSecurity - Verifies fail-closed storage for API and license keys
 */

import { App } from 'obsidian';
import NovaPlugin from '../main';
import { DEFAULT_SETTINGS } from '../src/settings';

const originalCrypto = globalThis.crypto;

function createPlugin(savedData: unknown = {}) {
	const plugin = new NovaPlugin(new App(), {} as never);
	const loadData = jest.spyOn(plugin, 'loadData').mockResolvedValue(savedData);
	const saveData = jest.spyOn(plugin, 'saveData').mockResolvedValue(undefined);
	return { plugin, loadData, saveData };
}

function cloneDefaultSettings() {
	return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
}

function installWorkingCrypto(decryptedValue = 'sk-runtime'): void {
	const encoder = new TextEncoder();
	Object.defineProperty(globalThis, 'crypto', {
		configurable: true,
		value: {
			getRandomValues: (value: Uint8Array) => {
				value.fill(7);
				return value;
			},
			subtle: {
				importKey: jest.fn().mockResolvedValue({}),
				deriveKey: jest.fn().mockResolvedValue({}),
				encrypt: jest.fn().mockResolvedValue(encoder.encode('ciphertext').buffer),
				decrypt: jest.fn().mockResolvedValue(encoder.encode(decryptedValue).buffer)
			}
		}
	});
}

function installFailingCrypto(): void {
	Object.defineProperty(globalThis, 'crypto', {
		configurable: true,
		value: {
			getRandomValues: (value: Uint8Array) => value,
			subtle: {
				importKey: jest.fn().mockResolvedValue({}),
				deriveKey: jest.fn().mockRejectedValue(new Error('Web Crypto unavailable'))
			}
		}
	});
}

describe('Nova sensitive settings storage', () => {
	beforeEach(() => {
		jest.spyOn(console, 'error').mockImplementation(() => undefined);
	});

	afterEach(() => {
		jest.restoreAllMocks();
		Object.defineProperty(globalThis, 'crypto', {
			configurable: true,
			value: originalCrypto
		});
	});

	test('loads encrypted values without rewriting storage', async () => {
		installWorkingCrypto();
		const { plugin, saveData } = createPlugin({
			aiProviders: {
				claude: { apiKey: 'encrypted:c3RvcmVk' }
			}
		});

		await plugin.loadSettings();

		expect(plugin.settings.aiProviders.claude.apiKey).toBe('sk-runtime');
		expect(saveData).not.toHaveBeenCalled();
	});

	test('migrates legacy plaintext before startup continues', async () => {
		installWorkingCrypto();
		const { plugin, saveData } = createPlugin({
			aiProviders: {
				claude: { apiKey: 'sk-legacy' }
			}
		});
		await plugin.loadSettings();

		expect(plugin.settings.aiProviders.claude.apiKey).toBe('sk-legacy');
		const migratedSettings = saveData.mock.calls[0][0];
		expect(migratedSettings.aiProviders.claude.apiKey).toMatch(/^encrypted:/);
		expect(JSON.stringify(migratedSettings)).not.toContain('sk-legacy');
	});

	test('clears migrated runtime values when encrypted migration cannot be persisted', async () => {
		installWorkingCrypto();
		const { plugin, saveData } = createPlugin({
			aiProviders: {
				claude: { apiKey: 'sk-legacy' }
			}
		});
		saveData.mockRejectedValueOnce(new Error('Storage unavailable'));

		await plugin.loadSettings();

		expect(saveData).toHaveBeenCalledTimes(1);
		expect(plugin.settings.aiProviders.claude.apiKey).toBe('');
	});

	test('removes a stored value when secure loading fails', async () => {
		installFailingCrypto();
		const { plugin, saveData } = createPlugin({
			licensing: {
				supernovaLicenseKey: 'encrypted:broken'
			}
		});
		await plugin.loadSettings();

		expect(plugin.settings.licensing.supernovaLicenseKey).toBe('');
		expect(saveData).toHaveBeenCalledWith({
			licensing: {
				supernovaLicenseKey: ''
			}
		});
	});

	test('never persists plaintext when encryption fails during save', async () => {
		installFailingCrypto();
		const { plugin, saveData } = createPlugin();
		plugin.settings = cloneDefaultSettings();
		plugin.settings.aiProviders.claude.apiKey = 'sk-plaintext';
		plugin.settings.licensing.supernovaLicenseKey = 'license-plaintext';
		const updateSupernovaLicense = jest.fn().mockResolvedValue(undefined);
		plugin.featureManager = { updateSupernovaLicense } as never;
		await expect(plugin.saveSettings())
			.rejects.toThrow('Sensitive settings could not be stored securely.');

		const storedSettings = saveData.mock.calls[0][0];
		expect(storedSettings.aiProviders.claude.apiKey).toBe('');
		expect(storedSettings.licensing.supernovaLicenseKey).toBe('');
		expect(JSON.stringify(storedSettings)).not.toContain('sk-plaintext');
		expect(JSON.stringify(storedSettings)).not.toContain('license-plaintext');
		expect(plugin.settings.aiProviders.claude.apiKey).toBe('');
		expect(plugin.settings.licensing.supernovaLicenseKey).toBe('');
		expect(updateSupernovaLicense).toHaveBeenCalledWith(null);
	});

	test('encrypts every sensitive field while retaining successful runtime values', async () => {
		installWorkingCrypto();
		const { plugin, saveData } = createPlugin();
		plugin.settings = cloneDefaultSettings();
		plugin.settings.aiProviders.claude.apiKey = 'sk-claude-runtime';
		plugin.settings.aiProviders.openai.apiKey = 'sk-openai-runtime';
		plugin.settings.aiProviders.google.apiKey = 'sk-google-runtime';
		plugin.settings.aiProviders['openai-compatible'].apiKey = 'sk-compatible-runtime';
		plugin.settings.licensing.supernovaLicenseKey = 'license-runtime';

		await plugin.saveSettings();

		const storedSettings = saveData.mock.calls[0][0];
		const storedValues = [
			storedSettings.aiProviders.claude.apiKey,
			storedSettings.aiProviders.openai.apiKey,
			storedSettings.aiProviders.google.apiKey,
			storedSettings.aiProviders['openai-compatible'].apiKey,
			storedSettings.licensing.supernovaLicenseKey
		];
		for (const storedValue of storedValues) {
			expect(storedValue).toMatch(/^encrypted:/);
		}
		const serializedSettings = JSON.stringify(storedSettings);
		expect(serializedSettings).not.toContain('sk-claude-runtime');
		expect(serializedSettings).not.toContain('sk-openai-runtime');
		expect(serializedSettings).not.toContain('sk-google-runtime');
		expect(serializedSettings).not.toContain('sk-compatible-runtime');
		expect(serializedSettings).not.toContain('license-runtime');
		expect(plugin.settings.aiProviders.claude.apiKey).toBe('sk-claude-runtime');
		expect(plugin.settings.aiProviders.openai.apiKey).toBe('sk-openai-runtime');
		expect(plugin.settings.aiProviders.google.apiKey).toBe('sk-google-runtime');
		expect(plugin.settings.aiProviders['openai-compatible'].apiKey).toBe('sk-compatible-runtime');
		expect(plugin.settings.licensing.supernovaLicenseKey).toBe('license-runtime');
	});

	test('takes a deep snapshot and preserves non-transient licensing fields during async saves', async () => {
		let signalEncryptionStarted: (() => void) | undefined;
		const encryptionStarted = new Promise<void>((resolve) => {
			signalEncryptionStarted = resolve;
		});
		let releaseEncryption: (() => void) | undefined;
		const encryptionGate = new Promise<void>((resolve) => {
			releaseEncryption = resolve;
		});
		const encoder = new TextEncoder();
		Object.defineProperty(globalThis, 'crypto', {
			configurable: true,
			value: {
				getRandomValues: (value: Uint8Array) => value,
				subtle: {
					importKey: jest.fn().mockResolvedValue({}),
					deriveKey: jest.fn().mockResolvedValue({}),
					encrypt: jest.fn().mockImplementation(async () => {
						signalEncryptionStarted?.();
						await encryptionGate;
						return encoder.encode('ciphertext').buffer;
					})
				}
			}
		});
		const { plugin, saveData } = createPlugin();
		plugin.settings = cloneDefaultSettings();
		plugin.settings.aiProviders.claude.apiKey = 'sk-runtime';
		const licensing = plugin.settings.licensing as unknown as Record<string, unknown>;
		licensing.futureEntitlement = { active: true };
		const originalShowReleaseNotes = plugin.settings.general.showReleaseNotes;

		const savePromise = plugin.saveSettings();
		await encryptionStarted;
		plugin.settings.general.showReleaseNotes = !originalShowReleaseNotes;
		(licensing.futureEntitlement as { active: boolean }).active = false;
		releaseEncryption?.();
		await savePromise;

		const storedSettings = saveData.mock.calls[0][0];
		expect(storedSettings.general.showReleaseNotes).toBe(originalShowReleaseNotes);
		expect(storedSettings.licensing.futureEntitlement).toEqual({ active: true });
		expect(storedSettings.licensing.debugSettings).toBeUndefined();
	});
});
