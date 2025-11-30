import { SupernovaLicense, SupernovaValidationResult, LicenseError } from './types';
import { CryptoService } from '../core/crypto-service';

export class LicenseValidator {
	// Obfuscated signing key for license validation
	private readonly OBFUSCATED_KEY = 'qryd-olfhqvh-vljqlqj-nhb-5358';

	/**
	 * Simple string deobfuscation using Caesar cipher with offset 3
	 */
	private deobfuscateKey(obfuscated: string): string {
		return obfuscated
			.split('')
			.map(char => {
				const code = char.charCodeAt(0);
				if (code >= 97 && code <= 122) { // lowercase a-z
					return String.fromCharCode(((code - 97 - 3 + 26) % 26) + 97);
				} else if (code >= 65 && code <= 90) { // uppercase A-Z
					return String.fromCharCode(((code - 65 - 3 + 26) % 26) + 65);
				} else if (code >= 48 && code <= 57) { // digits 0-9
					return String.fromCharCode(((code - 48 - 3 + 10) % 10) + 48);
				}
				return char; // Keep other characters unchanged
			})
			.join('');
	}

	/**
	 * Get the deobfuscated secret key
	 */
	private getSecretKey(): string {
		return this.deobfuscateKey(this.OBFUSCATED_KEY);
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
				type,
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
		return CryptoService.generateHmacSignature(data, this.getSecretKey());
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