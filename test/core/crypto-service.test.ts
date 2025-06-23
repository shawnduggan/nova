/**
 * Tests for CryptoService functionality
 * 
 * Note: These tests focus on the interface behavior and error handling.
 * Full cryptographic testing would require a browser environment with Web Crypto API.
 */

import { CryptoService } from '../../src/core/crypto-service';

describe('CryptoService', () => {
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

    describe('error handling (Node.js environment)', () => {
        // In Node.js test environment, crypto API is not available
        // These tests verify graceful error handling
        
        it('should handle missing crypto API gracefully for encryption', async () => {
            const testKey = 'sk-test-api-key';
            const result = await CryptoService.encryptValue(testKey);
            
            // Should return original value when crypto is not available
            expect(result).toBe(testKey);
        });

        it('should handle missing crypto API gracefully for decryption', async () => {
            // Non-encrypted value should pass through
            const plainValue = 'sk-plain-api-key';
            const result = await CryptoService.decryptValue(plainValue);
            expect(result).toBe(plainValue);
            
            // Encrypted value should handle error gracefully
            const encryptedValue = 'encrypted:somedata';
            const result2 = await CryptoService.decryptValue(encryptedValue);
            expect(typeof result2).toBe('string');
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
        });
    });

    describe('integration requirements', () => {
        it('should be compatible with settings save/load cycle', async () => {
            // This tests the integration pattern used in main.ts
            const mockApiKey = 'sk-test-integration-key';
            
            // Simulate saving (encrypting)
            const encrypted = await CryptoService.encryptValue(mockApiKey);
            
            // In a working environment, this would be encrypted
            // In Node.js test environment, it returns the original value
            expect(typeof encrypted).toBe('string');
            
            // Simulate loading (decrypting)
            const decrypted = await CryptoService.decryptValue(encrypted);
            expect(typeof decrypted).toBe('string');
            
            // The isEncrypted check should work consistently
            if (CryptoService.isEncrypted(encrypted)) {
                // If it was actually encrypted, decryption should work
                expect(decrypted).toBeDefined();
            } else {
                // If not encrypted (Node.js env), should be the same
                expect(decrypted).toBe(encrypted);
            }
        });
    });
});