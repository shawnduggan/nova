export interface License {
	email: string;
	tier: LicenseTier;
	expiresAt: Date | null; // null for lifetime licenses
	issuedAt: Date;
	signature: string; // HMAC-SHA256 signature for validation
	licenseKey: string; // The original license key string
}

export type LicenseTier = 'core' | 'supernova';

export interface LicenseValidationResult {
	valid: boolean;
	license?: License;
	error?: LicenseError;
}

export enum LicenseError {
	INVALID_FORMAT = 'INVALID_FORMAT',
	INVALID_SIGNATURE = 'INVALID_SIGNATURE',
	EXPIRED = 'EXPIRED',
	FUTURE_DATED = 'FUTURE_DATED',
	MALFORMED_DATA = 'MALFORMED_DATA'
}

export interface FeatureFlag {
	key: string;
	requiredTier: LicenseTier;
	enabled: boolean;
	description: string;
	fallbackBehavior?: 'disable' | 'prompt_upgrade' | 'limited_usage';
}

export enum FeatureTier {
	CORE = 'core',
	SUPERNOVA = 'supernova'
}

export interface FeatureAccessResult {
	allowed: boolean;
	reason?: string;
	fallbackBehavior?: 'disable' | 'prompt_upgrade' | 'limited_usage';
	upgradePrompt?: string;
}

// Debug mode interfaces for development
export interface DebugSettings {
	enabled: boolean;
	overrideTier?: LicenseTier;
}