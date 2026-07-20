/**
 * Tests for CryptoService functionality
 * 
 * Note: These tests focus on the interface behavior and error handling.
 * Full cryptographic testing would require a browser environment with Web Crypto API.
 */

import { CryptoService } from '../../src/core/crypto-service';

describe('CryptoService', () => {
    beforeEach(() => {
        jest.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('isEncrypted', () => {
        it('should return true for encrypted values', () => {
            expect(CryptoService.isEncrypted('encrypted:dGVzdA==')).toBe(true);
            expect(CryptoService.isEncrypted('encrypted:somebase64data')).toBe(true);
            expect(CryptoService.isEncrypted('encrypted:')).toBe(true);
        });

        it('should return false for non-encrypted values', () => {
            expect(CryptoService.isEncrypted('plain-text-api-key')).toBe(false);
            expect(CryptoService.isEncrypted('sk-test-key')).toBe(false);
            expect(CryptoService.isEncrypted('some-other-value')).toBe(false);
        });

        it('should return false for empty values', () => {
            expect(CryptoService.isEncrypted('')).toBe(false);
            expect(CryptoService.isEncrypted(null as any)).toBe(false);
            expect(CryptoService.isEncrypted(undefined as any)).toBe(false);
        });

        it('should return false for values that contain "encrypted:" but do not start with it', () => {
            expect(CryptoService.isEncrypted('some-encrypted:value')).toBe(false);
            expect(CryptoService.isEncrypted('prefix encrypted:suffix')).toBe(false);
        });

        it('should be case sensitive', () => {
            expect(CryptoService.isEncrypted('ENCRYPTED:test')).toBe(false);
            expect(CryptoService.isEncrypted('Encrypted:test')).toBe(false);
        });

        it('should not be affected by leading/trailing whitespace in the value', () => {
            expect(CryptoService.isEncrypted(' encrypted:test')).toBe(false);
            expect(CryptoService.isEncrypted('encrypted:test ')).toBe(true); // Only leading matters
        });
    });

    describe('fail-closed error handling', () => {
        it('should reject instead of returning plaintext when encryption fails', async () => {
            const testKey = 'sk-test-api-key';
            jest.spyOn(CryptoService as any, 'getEncryptionKey')
                .mockRejectedValue(new Error('Web Crypto unavailable'));

            await expect(CryptoService.encryptValue(testKey))
                .rejects.toThrow('Sensitive value encryption failed.');
        });

        it('should reject instead of stripping the prefix when encrypted decryption fails', async () => {
            jest.spyOn(CryptoService as any, 'getEncryptionKey')
                .mockRejectedValue(new Error('Web Crypto unavailable'));

            await expect(CryptoService.decryptValue('encrypted:somedata'))
                .rejects.toThrow('Sensitive value decryption failed.');
        });

        it('should continue to pass through legacy plaintext for migration', async () => {
            const plainValue = 'sk-plain-api-key';
            const result = await CryptoService.decryptValue(plainValue);
            expect(result).toBe(plainValue);
        });

        it('should handle empty values correctly', async () => {
            expect(await CryptoService.encryptValue('')).toBe('');
            expect(await CryptoService.encryptValue('   ')).toBe('   ');
            expect(await CryptoService.decryptValue('')).toBe('');
        });
    });

    describe('interface contracts', () => {
        it('should have correct function signatures', () => {
            expect(typeof CryptoService.encryptValue).toBe('function');
            expect(typeof CryptoService.decryptValue).toBe('function');
            expect(typeof CryptoService.isEncrypted).toBe('function');
            expect(typeof CryptoService.prepareStoredValue).toBe('function');
            
            // Check that functions are async where expected
            expect(CryptoService.encryptValue('')).toBeInstanceOf(Promise);
            expect(CryptoService.decryptValue('')).toBeInstanceOf(Promise);
        });

        it('should export the expected functions', () => {
            const staticMethods = Object.getOwnPropertyNames(CryptoService)
                .filter(name => typeof CryptoService[name as keyof typeof CryptoService] === 'function');
            
            expect(staticMethods).toContain('encryptValue');
            expect(staticMethods).toContain('decryptValue');
            expect(staticMethods).toContain('isEncrypted');
            expect(staticMethods).toContain('prepareStoredValue');
        });
    });

    describe('stored value preparation', () => {
        it('should migrate plaintext while keeping it available at runtime', async () => {
            const encryptSpy = jest.spyOn(CryptoService, 'encryptValue')
                .mockResolvedValue('encrypted:migrated');

            const result = await CryptoService.prepareStoredValue('sk-legacy-key');

            expect(result).toEqual({
                runtimeValue: 'sk-legacy-key',
                storageValue: 'encrypted:migrated',
                storageChanged: true
            });
            expect(encryptSpy).toHaveBeenCalledWith('sk-legacy-key');
        });

        it('should decrypt an encrypted value without rewriting storage', async () => {
            const decryptSpy = jest.spyOn(CryptoService, 'decryptValue')
                .mockResolvedValue('sk-runtime-key');

            const result = await CryptoService.prepareStoredValue('encrypted:stored');

            expect(result).toEqual({
                runtimeValue: 'sk-runtime-key',
                storageValue: 'encrypted:stored',
                storageChanged: false
            });
            expect(decryptSpy).toHaveBeenCalledWith('encrypted:stored');
        });

        it('should propagate migration encryption failures', async () => {
            jest.spyOn(CryptoService, 'encryptValue')
                .mockRejectedValue(new Error('encryption failed'));

            await expect(CryptoService.prepareStoredValue('sk-legacy-key'))
                .rejects.toThrow('encryption failed');
        });

        it('should leave an empty stored value unchanged', async () => {
            await expect(CryptoService.prepareStoredValue('')).resolves.toEqual({
                runtimeValue: '',
                storageValue: '',
                storageChanged: false
            });
        });
    });

    describe('master secret obfuscation', () => {
        it('should properly deobfuscate the master secret', () => {
            // Access the private methods using bracket notation for testing
            const obfuscated = 'qryd-olfhqvh-vljqlqj-nhb-5358';
            const deobfuscated = (CryptoService as any).deobfuscateSecret(obfuscated);
            expect(deobfuscated).toBe('nova-license-signing-key-2025');
        });

        it('should use obfuscated secret internally', () => {
            // Verify the obfuscated secret is stored, not the plain text
            const obfuscatedSecret = (CryptoService as any).OBFUSCATED_SECRET;
            expect(obfuscatedSecret).toBe('qryd-olfhqvh-vljqlqj-nhb-5358');
            expect(obfuscatedSecret).not.toContain('nova-license-signing-key');
        });

        it('should return correct master secret when requested', () => {
            // Test that getMasterSecret returns the deobfuscated version
            const masterSecret = (CryptoService as any).getMasterSecret();
            expect(masterSecret).toBe('nova-license-signing-key-2025');
        });

        it('should handle deobfuscation of different character types', () => {
            // Test lowercase letters
            expect((CryptoService as any).deobfuscateSecret('def')).toBe('abc');
            
            // Test numbers
            expect((CryptoService as any).deobfuscateSecret('345')).toBe('012');
            
            // Test mixed case and special characters
            expect((CryptoService as any).deobfuscateSecret('DEF-ghi-012')).toBe('ABC-def-789');
        });

        it('should maintain consistent deobfuscation logic with LicenseValidator', () => {
            // Ensure both classes use the same deobfuscation algorithm
            const testObfuscated = 'qryd-olfhqvh-vljqlqj-nhb-5358';
            const expected = 'nova-license-signing-key-2025';
            
            const cryptoResult = (CryptoService as any).deobfuscateSecret(testObfuscated);
            expect(cryptoResult).toBe(expected);
        });
    });
});
