import { License, LicenseValidationResult, LicenseError, LicenseTier } from './types';

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

			// Validate tier
			if (tier !== 'core' && tier !== 'supernova') {
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
				tier: tier as LicenseTier,
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
		if (typeof atob !== 'undefined') {
			return atob(str);
		}
		// Fallback for Node.js environment
		return Buffer.from(str, 'base64').toString('utf8');
	}

	/**
	 * Safe base64 encode that handles both browser and Node.js environments
	 */
	private base64Encode(str: string): string {
		if (typeof btoa !== 'undefined') {
			return btoa(str);
		}
		// Fallback for Node.js environment
		return Buffer.from(str, 'utf8').toString('base64');
	}

	/**
	 * Validates a license object
	 */
	private async validateLicenseObject(license: License): Promise<LicenseError | null> {
		// 1. Verify HMAC signature
		const expectedSignature = await this.generateSignature(
			license.email,
			license.tier,
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
		tier: LicenseTier,
		expiresAt: Date | null,
		issuedAt: Date
	): Promise<string> {
		const data = `${email}|${tier}|${expiresAt?.toISOString() || 'lifetime'}|${issuedAt.toISOString()}`;
		
		const encoder = new TextEncoder();
		const keyData = encoder.encode(this.SECRET_KEY);
		const messageData = encoder.encode(data);
		
		const cryptoKey = await crypto.subtle.importKey(
			'raw',
			keyData,
			{ name: 'HMAC', hash: 'SHA-256' },
			false,
			['sign']
		);
		
		const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
		return Array.from(new Uint8Array(signature))
			.map(b => b.toString(16).padStart(2, '0'))
			.join('');
	}

	/**
	 * Creates a test license for development purposes
	 */
	async createTestLicense(email: string, tier: LicenseTier, lifetimeMode = true): Promise<string> {
		const issuedAt = new Date();
		const expiresAt = lifetimeMode ? null : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year

		const signature = await this.generateSignature(email, tier, expiresAt, issuedAt);
		
		const licenseData = `${email}|${tier}|${expiresAt?.toISOString() || 'lifetime'}|${issuedAt.toISOString()}|${signature}`;
		
		return this.base64Encode(licenseData);
	}
}