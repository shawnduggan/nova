import { AIProviderManager } from '../../src/ai/provider-manager';
import { NovaSettings } from '../../src/settings';
import { ProviderType } from '../../src/ai/types';

// Mock the Platform object for testing
jest.mock('obsidian', () => ({
	Platform: {
		isMobile: false
	}
}));

describe('Provider Dropdown Performance', () => {
	let providerManager: AIProviderManager;
	let mockSettings: NovaSettings;

	beforeEach(async () => {
		mockSettings = {
			aiProviders: {
				claude: { apiKey: 'test-key', model: 'claude-3-5-sonnet-20241022' },
				openai: { apiKey: 'test-key', model: 'gpt-4' },
				google: { apiKey: 'test-key', model: 'gemini-pro' },
				ollama: { baseUrl: 'http://localhost:11434', model: 'llama2' }
			},
			platformSettings: {
				desktop: { selectedModel: 'claude-3-5-sonnet-20241022' },
				mobile: { selectedModel: 'claude-3-5-sonnet-20241022' }
			},
			general: {
				defaultTemperature: 0.7,
				defaultMaxTokens: 1000,
				autoSave: true
			},
			commands: {
				suggestionMode: 'balanced',
				responseTime: 'normal',
				hideWhileTyping: true,
				enabledDocumentTypes: []
			},
			licensing: {
				supernovaLicenseKey: '',
				debugSettings: { enabled: false }
			}
		};
		const mockSettingsTyped: NovaSettings = mockSettings;

		providerManager = new AIProviderManager(mockSettingsTyped);
		await providerManager.initialize();
	});

	describe('Provider Availability Caching', () => {
		it('should cache availability results', async () => {
			const providerType: ProviderType = 'claude';
			
			// First call should populate cache
			const result1 = await (providerManager as any).checkProviderAvailability(providerType);
			
			// Check that cache is populated
			const cache = (providerManager as any).availabilityCache;
			expect(cache.has(providerType)).toBe(true);
			
			// Second call should return same result from cache
			const result2 = await (providerManager as any).checkProviderAvailability(providerType);
			
			expect(result1).toBe(result2);
			expect(cache.has(providerType)).toBe(true);
		});

		it('should return cached results within TTL', async () => {
			const providerType: ProviderType = 'claude';
			
			// First call
			const result1 = await (providerManager as any).checkProviderAvailability(providerType);
			
			// Second call immediately should return cached result
			const result2 = await (providerManager as any).checkProviderAvailability(providerType);
			
			expect(result1).toBe(result2);
		});

		it('should clear cache when settings change', async () => {
			// Make initial call to populate cache
			await (providerManager as any).checkProviderAvailability('claude');
			
			// Check cache is populated
			const cache = (providerManager as any).availabilityCache;
			expect(cache.has('claude')).toBe(true);
			
			// Update settings should clear cache
			providerManager.updateSettings(mockSettings);
			
			expect(cache.size).toBe(0);
		});
	});

	describe('Parallel Provider Availability Checks', () => {
		it('should get all providers status in parallel', async () => {
			const start = Date.now();
			const results = await providerManager.getAvailableProvidersWithStatus();
			const duration = Date.now() - start;

			expect(results).toBeInstanceOf(Map);
			expect(results.size).toBeGreaterThan(0);
			
			// Should have results for expected providers
			const allowedProviders = providerManager.getAllowedProviders();
			allowedProviders.forEach(provider => {
				if (provider !== 'none') {
					expect(results.has(provider)).toBe(true);
				}
			});

			// Should be faster than sequential calls due to parallelization
			console.log('Parallel provider check duration:', duration, 'ms');
		});
	});
});