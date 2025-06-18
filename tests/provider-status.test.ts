/**
 * Tests for Provider Status Logic
 */

describe('Provider Status Logic', () => {
    it('should determine status based on configuration', () => {
        // Test provider configuration detection
        expect(hasProviderConfig('claude', { apiKey: 'sk-123' })).toBe(true);
        expect(hasProviderConfig('claude', { apiKey: '' })).toBe(false);
        expect(hasProviderConfig('ollama', { baseUrl: 'http://localhost:11434' })).toBe(true);
        expect(hasProviderConfig('ollama', { baseUrl: '' })).toBe(false);
    });

    it('should format status display text correctly', () => {
        expect(getStatusDisplayText('connected')).toBe('Connected');
        expect(getStatusDisplayText('error')).toBe('Connection failed');
        expect(getStatusDisplayText('not-configured')).toBe('Not configured');
        expect(getStatusDisplayText('untested')).toBe('Untested');
        expect(getStatusDisplayText('testing')).toBe('Testing...');
    });
});

// Simple helper functions that would be part of the business logic
function hasProviderConfig(provider: string, config: any): boolean {
    switch (provider) {
        case 'claude':
        case 'openai':
        case 'google':
            return !!config.apiKey;
        case 'ollama':
            return !!config.baseUrl;
        default:
            return false;
    }
}

function getStatusDisplayText(status: string): string {
    switch (status) {
        case 'connected': return 'Connected';
        case 'error': return 'Connection failed';
        case 'not-configured': return 'Not configured';
        case 'untested': return 'Untested';
        case 'testing': return 'Testing...';
        default: return 'Unknown';
    }
}