/**
 * @file LicensingTypes - Type definitions for licensing system
 */

export interface SupernovaLicense {
	email: string;
	type: 'annual' | 'lifetime' | 'founding';
	expiresAt: Date | null; // null for lifetime
	issuedAt: Date;
	signature: string;
	licenseKey: string;
}

export type FeatureAccessPolicy = 'core' | 'permanent';
export type FeatureCategory = 'core' | 'advanced-revision';

export interface SupernovaValidationResult {
	valid: boolean;
	license?: SupernovaLicense;
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
	enabled: boolean;
	description: string;
	access?: FeatureAccessPolicy;
	supernovaOnly?: boolean;
}

export interface FeatureAccessResult {
	allowed: boolean;
	reason?: string;
	isSupernovaFeature?: boolean;
	access?: FeatureAccessPolicy;
	upgradeRequired?: boolean;
}

// Debug mode interfaces for development
export interface DebugSettings {
	enabled: boolean;
	forceSupernova?: boolean; // Force Supernova status for testing
}
