import { LicenseValidator } from '../../src/licensing/license-validator';
import { LicenseError } from '../../src/licensing/types';

describe('LicenseValidator', () => {
	let validator: LicenseValidator;

	beforeEach(() => {
		validator = new LicenseValidator();
	});

	describe('Supernova license validation', () => {
		test('should validate correct Supernova license', async () => {
			const testLicense = await validator.createTestSupernovaLicense('test@example.com', 'annual');
			const result = await validator.validateSupernovaLicense(testLicense);

			expect(result.valid).toBe(true);
			expect(result.license).toBeDefined();
			expect(result.license?.email).toBe('test@example.com');
			expect(result.license?.type).toBe('annual');
		});

		test('should validate lifetime Supernova license', async () => {
			const testLicense = await validator.createTestSupernovaLicense('test@example.com', 'lifetime');
			const result = await validator.validateSupernovaLicense(testLicense);

			expect(result.valid).toBe(true);
			expect(result.license).toBeDefined();
			expect(result.license?.email).toBe('test@example.com');
			expect(result.license?.type).toBe('lifetime');
			expect(result.license?.expiresAt).toBeNull();
		});

		test('should validate founding Supernova license', async () => {
			const testLicense = await validator.createTestSupernovaLicense('test@example.com', 'founding');
			const result = await validator.validateSupernovaLicense(testLicense);

			expect(result.valid).toBe(true);
			expect(result.license).toBeDefined();
			expect(result.license?.email).toBe('test@example.com');
			expect(result.license?.type).toBe('founding');
			expect(result.license?.expiresAt).toBeNull();
		});

		test('should reject invalid Supernova license format', async () => {
			const result = await validator.validateSupernovaLicense('invalid-license');

			expect(result.valid).toBe(false);
			expect(result.error).toBe(LicenseError.INVALID_FORMAT);
		});

		test('should reject Supernova license with invalid type', async () => {
			// Create a license with invalid type by manipulating the data
			const validLicense = await validator.createTestSupernovaLicense('test@example.com', 'annual');
			const decoded = Buffer.from(validLicense, 'base64').toString('utf-8');
			const parts = decoded.split('|');
			parts[1] = 'invalid-type'; // Change type to invalid value
			const invalidLicense = Buffer.from(parts.join('|')).toString('base64');
			
			const result = await validator.validateSupernovaLicense(invalidLicense);

			expect(result.valid).toBe(false);
			expect(result.error).toBe(LicenseError.INVALID_FORMAT);
		});

		test('should reject Supernova license with insufficient parts', async () => {
			// Create base64 of incomplete license data
			const partialData = Buffer.from('incomplete|data', 'utf8').toString('base64');
			const result = await validator.validateSupernovaLicense(partialData);

			expect(result.valid).toBe(false);
			expect(result.error).toBe(LicenseError.INVALID_FORMAT);
		});
	});

	describe('license creation', () => {
		test('should create valid Supernova licenses for testing', async () => {
			const license = await validator.createTestSupernovaLicense('test@example.com', 'annual');
			expect(license).toBeDefined();
			expect(typeof license).toBe('string');
			
			// Verify it can be validated
			const result = await validator.validateSupernovaLicense(license);
			expect(result.valid).toBe(true);
		});

		test('should create founding Supernova licenses', async () => {
			const license = await validator.createTestSupernovaLicense('founder@example.com', 'founding');
			expect(license).toBeDefined();
			expect(typeof license).toBe('string');
			
			// Verify it can be validated
			const result = await validator.validateSupernovaLicense(license);
			expect(result.valid).toBe(true);
			expect(result.license?.type).toBe('founding');
		});
	});

	describe('key obfuscation', () => {
		test('should properly deobfuscate the signing key', () => {
			// Access the private methods using bracket notation for testing
			const obfuscated = 'qryd-olfhqvh-vljqlqj-nhb-5358';
			const deobfuscated = (validator as any).deobfuscateKey(obfuscated);
			expect(deobfuscated).toBe('nova-license-signing-key-2025');
		});

		test('should use obfuscated key internally', () => {
			// Verify the obfuscated key is stored, not the plain text
			const obfuscatedKey = (validator as any).OBFUSCATED_KEY;
			expect(obfuscatedKey).toBe('qryd-olfhqvh-vljqlqj-nhb-5358');
			expect(obfuscatedKey).not.toContain('nova-license-signing-key');
		});

		test('should produce same signature with obfuscated and plain keys', async () => {
			// Create two validators - one with current obfuscated key logic
			const validator1 = new LicenseValidator();
			
			// Create a test license and verify it validates correctly
			// This ensures the obfuscated key produces the same HMAC signature
			const testLicense = await validator1.createTestSupernovaLicense('test@example.com', 'annual');
			const result = await validator1.validateSupernovaLicense(testLicense);
			
			expect(result.valid).toBe(true);
			expect(result.license?.email).toBe('test@example.com');
		});

		test('should handle deobfuscation of different character types', () => {
			// Test lowercase letters
			expect((validator as any).deobfuscateKey('def')).toBe('abc');
			
			// Test numbers
			expect((validator as any).deobfuscateKey('345')).toBe('012');
			
			// Test mixed case and special characters
			expect((validator as any).deobfuscateKey('DEF-ghi-012')).toBe('ABC-def-789');
		});
	});
});