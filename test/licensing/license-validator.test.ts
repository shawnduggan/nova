import { LicenseValidator } from '../../src/licensing/license-validator';
import { LicenseError, LicenseTier } from '../../src/licensing/types';

describe('LicenseValidator', () => {
	let validator: LicenseValidator;

	beforeEach(() => {
		validator = new LicenseValidator();
	});

	describe('validateLicense', () => {
		test('should validate a valid SuperNova license', async () => {
			const testLicense = await validator.createTestLicense('test@example.com', 'supernova');
			const result = await validator.validateLicense(testLicense);

			expect(result.valid).toBe(true);
			expect(result.license?.email).toBe('test@example.com');
			expect(result.license?.tier).toBe('supernova');
			expect(result.license?.expiresAt).toBeNull(); // lifetime
			expect(result.error).toBeUndefined();
		});

		test('should validate a valid Core license', async () => {
			const testLicense = await validator.createTestLicense('test@example.com', 'core');
			const result = await validator.validateLicense(testLicense);

			expect(result.valid).toBe(true);
			expect(result.license?.email).toBe('test@example.com');
			expect(result.license?.tier).toBe('core');
			expect(result.license?.expiresAt).toBeNull(); // lifetime
			expect(result.error).toBeUndefined();
		});

		test('should validate a valid annual license', async () => {
			const testLicense = await validator.createTestLicense('test@example.com', 'supernova', false);
			const result = await validator.validateLicense(testLicense);

			expect(result.valid).toBe(true);
			expect(result.license?.expiresAt).not.toBeNull();
			expect(result.license?.expiresAt!.getTime()).toBeGreaterThan(Date.now());
		});

		test('should reject invalid license format', async () => {
			const result = await validator.validateLicense('invalid-license-key');

			expect(result.valid).toBe(false);
			expect(result.error).toBe(LicenseError.INVALID_FORMAT);
		});

		test('should reject malformed base64 license', async () => {
			const result = await validator.validateLicense('not-base64!@#$');

			expect(result.valid).toBe(false);
			expect(result.error).toBe(LicenseError.INVALID_FORMAT);
		});

		test('should reject license with wrong number of parts', async () => {
			const malformedData = btoa('email|tier|expires'); // missing parts
			const result = await validator.validateLicense(malformedData);

			expect(result.valid).toBe(false);
			expect(result.error).toBe(LicenseError.INVALID_FORMAT);
		});

		test('should reject license with invalid tier', async () => {
			const malformedData = btoa('test@example.com|invalid|lifetime|2025-01-01T00:00:00.000Z|signature');
			const result = await validator.validateLicense(malformedData);

			expect(result.valid).toBe(false);
			expect(result.error).toBe(LicenseError.INVALID_FORMAT);
		});

		test('should reject license with invalid signature', async () => {
			// Create a valid license then corrupt the signature
			const validLicense = await validator.createTestLicense('test@example.com', 'supernova');
			const decoded = atob(validLicense);
			const parts = decoded.split('|');
			parts[4] = 'invalid-signature'; // corrupt signature
			const corruptedLicense = btoa(parts.join('|'));

			const result = await validator.validateLicense(corruptedLicense);

			expect(result.valid).toBe(false);
			expect(result.error).toBe(LicenseError.INVALID_SIGNATURE);
		});

		test('should reject expired license', async () => {
			// Manually create an expired license
			const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
			const issuedAt = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000); // 1 year ago
			
			// We need to access the private method for testing - create a mock expired license
			const email = 'test@example.com';
			const tier = 'supernova';
			
			// Create signature manually for expired license
			const data = `${email}|${tier}|${yesterday.toISOString()}|${issuedAt.toISOString()}`;
			const encoder = new TextEncoder();
			const keyData = encoder.encode('nova-license-signing-key-2025');
			const messageData = encoder.encode(data);
			
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

			const expiredLicense = btoa(`${email}|${tier}|${yesterday.toISOString()}|${issuedAt.toISOString()}|${signatureHex}`);
			
			const result = await validator.validateLicense(expiredLicense);

			expect(result.valid).toBe(false);
			expect(result.error).toBe(LicenseError.EXPIRED);
		});

		test('should reject future-dated license', async () => {
			// Create a license issued in the future
			const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
			const email = 'test@example.com';
			const tier = 'supernova';
			
			// Create signature for future-dated license
			const data = `${email}|${tier}|lifetime|${tomorrow.toISOString()}`;
			const encoder = new TextEncoder();
			const keyData = encoder.encode('nova-license-signing-key-2025');
			const messageData = encoder.encode(data);
			
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

			const futureLicense = btoa(`${email}|${tier}|lifetime|${tomorrow.toISOString()}|${signatureHex}`);
			
			const result = await validator.validateLicense(futureLicense);

			expect(result.valid).toBe(false);
			expect(result.error).toBe(LicenseError.FUTURE_DATED);
		});

		test('should handle invalid date formats', async () => {
			const malformedData = btoa('test@example.com|supernova|not-a-date|2025-01-01T00:00:00.000Z|signature');
			const result = await validator.validateLicense(malformedData);

			expect(result.valid).toBe(false);
			expect(result.error).toBe(LicenseError.INVALID_FORMAT);
		});
	});

	describe('createTestLicense', () => {
		test('should create a valid lifetime SuperNova license', async () => {
			const license = await validator.createTestLicense('dev@test.com', 'supernova');
			const result = await validator.validateLicense(license);

			expect(result.valid).toBe(true);
			expect(result.license?.email).toBe('dev@test.com');
			expect(result.license?.tier).toBe('supernova');
			expect(result.license?.expiresAt).toBeNull();
		});

		test('should create a valid annual license', async () => {
			const license = await validator.createTestLicense('dev@test.com', 'core', false);
			const result = await validator.validateLicense(license);

			expect(result.valid).toBe(true);
			expect(result.license?.email).toBe('dev@test.com');
			expect(result.license?.tier).toBe('core');
			expect(result.license?.expiresAt).not.toBeNull();
			expect(result.license?.expiresAt!.getTime()).toBeGreaterThan(Date.now());
		});
	});
});