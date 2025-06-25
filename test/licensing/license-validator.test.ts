import { LicenseValidator } from '../../src/licensing/license-validator';
import { LicenseError } from '../../src/licensing/types';

describe('LicenseValidator', () => {
	let validator: LicenseValidator;

	beforeEach(() => {
		validator = new LicenseValidator();
	});

	describe('validateSupernovaLicense', () => {
		test('should validate a valid annual Supernova license', async () => {
			const testLicense = await validator.createTestSupernovaLicense('test@example.com', 'annual');
			const result = await validator.validateSupernovaLicense(testLicense);

			expect(result.valid).toBe(true);
			expect(result.license?.email).toBe('test@example.com');
			expect(result.license?.type).toBe('annual');
			expect(result.license?.expiresAt).not.toBeNull(); // annual license has expiry
			expect(result.error).toBeUndefined();
		});

		test('should validate a valid lifetime Supernova license', async () => {
			const testLicense = await validator.createTestSupernovaLicense('test@example.com', 'lifetime');
			const result = await validator.validateSupernovaLicense(testLicense);

			expect(result.valid).toBe(true);
			expect(result.license?.email).toBe('test@example.com');
			expect(result.license?.type).toBe('lifetime');
			expect(result.license?.expiresAt).toBeNull(); // lifetime
			expect(result.error).toBeUndefined();
		});

		test('should reject invalid license format', async () => {
			const result = await validator.validateSupernovaLicense('invalid-license');

			expect(result.valid).toBe(false);
			expect(result.error).toBe(LicenseError.INVALID_FORMAT);
		});

		test('should reject malformed base64', async () => {
			const result = await validator.validateSupernovaLicense('this-is-not-base64!@#$');

			expect(result.valid).toBe(false);
			expect(result.error).toBe(LicenseError.INVALID_FORMAT);
		});

		test('should reject license with invalid signature', async () => {
			// Create a valid license then modify it
			const validLicense = await validator.createTestSupernovaLicense('test@example.com', 'annual');
			const decoded = Buffer.from(validLicense, 'base64').toString('utf8');
			const parts = decoded.split('|');
			
			// Modify the email but keep the original signature (making it invalid)
			parts[0] = 'hacker@example.com';
			const tamperedLicense = Buffer.from(parts.join('|'), 'utf8').toString('base64');

			const result = await validator.validateSupernovaLicense(tamperedLicense);

			expect(result.valid).toBe(false);
			expect(result.error).toBe(LicenseError.INVALID_SIGNATURE);
		});

		test('should reject future-dated license', async () => {
			// Create a license manually with future issue date
			const futureDate = new Date(Date.now() + 86400000); // +1 day
			const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // +1 year
			
			const encoder = new TextEncoder();
			const keyData = encoder.encode('nova-license-signing-key-2025');
			const messageData = encoder.encode(`test@example.com|annual|${expiresAt.toISOString()}|${futureDate.toISOString()}`);
			
			const cryptoKey = await crypto.subtle.importKey(
				'raw',
				keyData,
				{ name: 'HMAC', hash: 'SHA-256' },
				false,
				['sign']
			);
			
			const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
			const signatureHex = Array.from(new Uint8Array(signature))
				.map(b => b.toString(16).padStart(2, '0'))
				.join('');

			const licenseData = `test@example.com|annual|${expiresAt.toISOString()}|${futureDate.toISOString()}|${signatureHex}`;
			const futureLicense = Buffer.from(licenseData, 'utf8').toString('base64');

			const result = await validator.validateSupernovaLicense(futureLicense);

			expect(result.valid).toBe(false);
			expect(result.error).toBe(LicenseError.FUTURE_DATED);
		});
	});

	describe('legacy license support', () => {
		test('should handle legacy license validation for backward compatibility', async () => {
			const testLicense = await validator.createTestLicense('test@example.com', 'legacy');
			const result = await validator.validateLicense(testLicense);

			expect(result.valid).toBe(true);
			expect(result.license?.email).toBe('test@example.com');
			expect(result.license?.expiresAt).toBeNull(); // lifetime
			expect(result.error).toBeUndefined();
		});

		test('should reject legacy license with invalid format', async () => {
			const result = await validator.validateLicense('invalid-license');

			expect(result.valid).toBe(false);
			expect(result.error).toBe(LicenseError.INVALID_FORMAT);
		});
	});

	describe('license creation', () => {
		test('should create valid Supernova licenses', async () => {
			const annualLicense = await validator.createTestSupernovaLicense('test@example.com', 'annual');
			const lifetimeLicense = await validator.createTestSupernovaLicense('test@example.com', 'lifetime');

			expect(annualLicense).toBeDefined();
			expect(lifetimeLicense).toBeDefined();
			expect(annualLicense).not.toBe(lifetimeLicense);

			// Verify they can be validated
			const annualResult = await validator.validateSupernovaLicense(annualLicense);
			const lifetimeResult = await validator.validateSupernovaLicense(lifetimeLicense);

			expect(annualResult.valid).toBe(true);
			expect(lifetimeResult.valid).toBe(true);
		});

		test('should create legacy licenses for testing', async () => {
			const legacyLicense = await validator.createTestLicense('test@example.com', 'legacy');

			expect(legacyLicense).toBeDefined();

			// Verify it can be validated
			const result = await validator.validateLicense(legacyLicense);
			expect(result.valid).toBe(true);
		});

		test('should create and validate founding Supernova licenses', async () => {
			const foundingLicense = await validator.createTestSupernovaLicense('founder@example.com', 'founding');

			expect(foundingLicense).toBeDefined();

			// Verify it can be validated
			const result = await validator.validateSupernovaLicense(foundingLicense);
			expect(result.valid).toBe(true);
			expect(result.license?.email).toBe('founder@example.com');
			expect(result.license?.type).toBe('founding');
			expect(result.license?.expiresAt).toBeNull(); // founding is lifetime
		});
	});

	describe('error handling', () => {
		test('should handle crypto errors gracefully', async () => {
			// Test with completely malformed data
			const result = await validator.validateSupernovaLicense('');

			expect(result.valid).toBe(false);
			expect(result.error).toBeDefined();
		});

		test('should handle partial license data', async () => {
			// Create base64 of incomplete license data
			const partialData = Buffer.from('incomplete|data', 'utf8').toString('base64');
			const result = await validator.validateSupernovaLicense(partialData);

			expect(result.valid).toBe(false);
			expect(result.error).toBe(LicenseError.INVALID_FORMAT);
		});
	});
});