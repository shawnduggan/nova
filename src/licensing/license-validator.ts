import { License, SupernovaLicense, LicenseValidationResult, SupernovaValidationResult, LicenseError } from './types';
import { CryptoService } from '../core/crypto-service';

export class LicenseValidator {
	// Embedded signing key - in production this would be obfuscated
	private readonly SECRET_KEY = 'nova-license-signing-key-2025';
	
	/**
	 * Validates a license key and returns validation result
	 */
	async validateLicense(licenseKey: string): Promise<LicenseValidationResult> {
		try {
			const license = this.parseLicenseKey(licenseKey);
			if (!license) {
				return { 
					valid: false, 
					error: LicenseError.INVALID_FORMAT 
				};
			}

			const validationError = await this.validateLicenseObject(license);
			if (validationError) {
				return { 
					valid: false, 
					license,
					error: validationError 
				};
			}

			return { 
				valid: true, 
				license 
			};
		} catch (error) {
			return { 
				valid: false, 
				error: LicenseError.MALFORMED_DATA 
			};
		}
	}

	/**
	 * Parses a license key string into a License object
	 */
	private parseLicenseKey(licenseKey: string): License | null {
		try {
			// License key format: base64(email|tier|expiresAt|issuedAt|signature)
			const decoded = this.base64Decode(licenseKey);
			const parts = decoded.split('|');
			
			if (parts.length !== 5) {
				return null;
			}

			const [email, tier, expiresAtStr, issuedAtStr, signature] = parts;

			// Skip tier validation since we're removing tiers

			// Parse dates
			const expiresAt = expiresAtStr === 'lifetime' ? null : new Date(expiresAtStr);
			const issuedAt = new Date(issuedAtStr);

			// Validate dates
			if (isNaN(issuedAt.getTime())) {
				return null;
			}

			if (expiresAt && isNaN(expiresAt.getTime())) {
				return null;
			}

			return {
				email,
				expiresAt,
				issuedAt,
				signature,
				licenseKey
			};
		} catch (error) {
			return null;
		}
	}

	/**
	 * Safe base64 decode that handles both browser and Node.js environments
	 */
	private base64Decode(str: string): string {
		return CryptoService.base64Decode(str);
	}

	/**
	 * Safe base64 encode that handles both browser and Node.js environments
	 */
	private base64Encode(str: string): string {
		return CryptoService.base64Encode(str);
	}

	/**
	 * Validates a license object
	 */
	private async validateLicenseObject(license: License): Promise<LicenseError | null> {
		// 1. Verify HMAC signature
		const expectedSignature = await this.generateSignature(
			license.email,
			'legacy', // Use legacy for old licenses
			license.expiresAt,
			license.issuedAt
		);

		if (license.signature !== expectedSignature) {
			return LicenseError.INVALID_SIGNATURE;
		}

		// 2. Check expiration
		if (license.expiresAt && new Date() > license.expiresAt) {
			return LicenseError.EXPIRED;
		}

		// 3. Validate issue date (prevent future-dated licenses)
		if (license.issuedAt > new Date()) {
			return LicenseError.FUTURE_DATED;
		}

		return null;
	}

	/**
	 * Generates HMAC-SHA256 signature for license data
	 */
	private async generateSignature(
		email: string,
		tier: string,
		expiresAt: Date | null,
		issuedAt: Date
	): Promise<string> {
		const data = `${email}|${tier}|${expiresAt?.toISOString() || 'lifetime'}|${issuedAt.toISOString()}`;
		return CryptoService.generateHmacSignature(data, this.SECRET_KEY);
	}

	/**
	 * Creates a test license for development purposes
	 */
	async createTestLicense(email: string, tier: string, lifetimeMode = true): Promise<string> {
		const issuedAt = new Date();
		const expiresAt = lifetimeMode ? null : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year

		const signature = await this.generateSignature(email, tier, expiresAt, issuedAt);
		
		const licenseData = `${email}|${tier}|${expiresAt?.toISOString() || 'lifetime'}|${issuedAt.toISOString()}|${signature}`;
		
		return this.base64Encode(licenseData);
	}

	/**
	 * Validates a Supernova license key
	 */
	async validateSupernovaLicense(licenseKey: string): Promise<SupernovaValidationResult> {
		try {
			const license = this.parseSupernovaLicenseKey(licenseKey);
			if (!license) {
				return { 
					valid: false, 
					error: LicenseError.INVALID_FORMAT 
				};
			}

			const validationError = await this.validateSupernovaLicenseObject(license);
			if (validationError) {
				return { 
					valid: false, 
					license,
					error: validationError 
				};
			}

			return { 
				valid: true, 
				license 
			};
		} catch (error) {
			return { 
				valid: false, 
				error: LicenseError.MALFORMED_DATA 
			};
		}
	}

	/**
	 * Parses a Supernova license key string
	 */
	private parseSupernovaLicenseKey(licenseKey: string): SupernovaLicense | null {
		try {
			// Supernova license key format: base64(email|type|expiresAt|issuedAt|signature)
			const decoded = this.base64Decode(licenseKey);
			const parts = decoded.split('|');
			
			if (parts.length !== 5) {
				return null;
			}

			const [email, type, expiresAtStr, issuedAtStr, signature] = parts;

			// Validate type
			if (type !== 'annual' && type !== 'lifetime' && type !== 'founding') {
				return null;
			}

			// Parse dates
			const expiresAt = expiresAtStr === 'lifetime' ? null : new Date(expiresAtStr);
			const issuedAt = new Date(issuedAtStr);

			// Validate dates
			if (isNaN(issuedAt.getTime())) {
				return null;
			}

			if (expiresAt && isNaN(expiresAt.getTime())) {
				return null;
			}

			return {
				email,
				type: type as 'annual' | 'lifetime' | 'founding',
				expiresAt,
				issuedAt,
				signature,
				licenseKey
			};
		} catch (error) {
			return null;
		}
	}

	/**
	 * Validates a Supernova license object
	 */
	private async validateSupernovaLicenseObject(license: SupernovaLicense): Promise<LicenseError | null> {
		// 1. Verify HMAC signature
		const expectedSignature = await this.generateSupernovaSignature(
			license.email,
			license.type,
			license.expiresAt,
			license.issuedAt
		);

		if (license.signature !== expectedSignature) {
			return LicenseError.INVALID_SIGNATURE;
		}

		// 2. Check expiration
		if (license.expiresAt && new Date() > license.expiresAt) {
			return LicenseError.EXPIRED;
		}

		// 3. Validate issue date
		if (license.issuedAt > new Date()) {
			return LicenseError.FUTURE_DATED;
		}

		return null;
	}

	/**
	 * Generates HMAC-SHA256 signature for Supernova license
	 */
	private async generateSupernovaSignature(
		email: string,
		type: 'annual' | 'lifetime' | 'founding',
		expiresAt: Date | null,
		issuedAt: Date
	): Promise<string> {
		const data = `${email}|${type}|${expiresAt?.toISOString() || 'lifetime'}|${issuedAt.toISOString()}`;
		return CryptoService.generateHmacSignature(data, this.SECRET_KEY);
	}

	/**
	 * Creates a test Supernova license for development
	 */
	async createTestSupernovaLicense(email: string, type: 'annual' | 'lifetime' | 'founding'): Promise<string> {
		const issuedAt = new Date();
		const expiresAt = (type === 'lifetime' || type === 'founding') ? null : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year

		const signature = await this.generateSupernovaSignature(email, type, expiresAt, issuedAt);
		
		const licenseData = `${email}|${type}|${expiresAt?.toISOString() || 'lifetime'}|${issuedAt.toISOString()}|${signature}`;
		
		return this.base64Encode(licenseData);
	}
}