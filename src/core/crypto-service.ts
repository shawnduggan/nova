/**
 * @file CryptoService - Encrypts/decrypts sensitive data like API keys
 */

import { Logger } from '../utils/logger';

export class CryptoService {
    // Obfuscated master secret for key derivation - shared with license generator
    private static readonly OBFUSCATED_SECRET = 'qryd-olfhqvh-vljqlqj-nhb-5358';

    /**
     * Simple string deobfuscation using Caesar cipher with offset 3
     */
    private static deobfuscateSecret(obfuscated: string): string {
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
     * Get the deobfuscated master secret
     */
    private static getMasterSecret(): string {
        return this.deobfuscateSecret(this.OBFUSCATED_SECRET);
    }

    /**
     * Safe base64 decode that handles both browser and Node.js environments
     */
    static base64Decode(str: string): string {
        if (typeof atob !== 'undefined') {
            return atob(str);
        }
        // Fallback for Node.js environment
        return Buffer.from(str, 'base64').toString('utf8');
    }

    /**
     * Safe base64 encode that handles both browser and Node.js environments
     */
    static base64Encode(str: string): string {
        if (typeof btoa !== 'undefined') {
            return btoa(str);
        }
        // Fallback for Node.js environment
        return Buffer.from(str, 'utf8').toString('base64');
    }

    /**
     * Derive encryption key using PBKDF2 for API key AES-GCM encryption
     */
    private static async getEncryptionKey(): Promise<CryptoKey> {
        const encoder = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            encoder.encode(this.getMasterSecret()),
            'PBKDF2',
            false,
            ['deriveKey']
        );
        
        return crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: encoder.encode('nova-api-keys-salt'),
                iterations: 100000,
                hash: 'SHA-256'
            },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    }

    /**
     * Encrypt a string value (typically an API key) using AES-GCM
     */
    static async encryptValue(value: string): Promise<string> {
        if (!value || value.trim() === '') {
            return value; // Don't encrypt empty values
        }

        try {
            const key = await this.getEncryptionKey();
            const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for GCM
            const encoder = new TextEncoder();
            const data = encoder.encode(value);

            const encrypted = await crypto.subtle.encrypt(
                {
                    name: 'AES-GCM',
                    iv: iv
                },
                key,
                data
            );

            // Combine IV and encrypted data, then base64 encode
            const combined = new Uint8Array(iv.length + encrypted.byteLength);
            combined.set(iv);
            combined.set(new Uint8Array(encrypted), iv.length);

            // Convert to base64 and add prefix to identify encrypted values
            return 'encrypted:' + this.base64Encode(String.fromCharCode(...combined));
        } catch (error) {
            Logger.error('Failed to encrypt value:', error);
            return value; // Return original value if encryption fails
        }
    }

    /**
     * Decrypt a string value (typically an API key) using AES-GCM
     */
    static async decryptValue(encryptedValue: string): Promise<string> {
        if (!encryptedValue || !encryptedValue.startsWith('encrypted:')) {
            return encryptedValue; // Return as-is if not encrypted
        }

        try {
            const key = await this.getEncryptionKey();
            const base64Data = encryptedValue.substring('encrypted:'.length);
            
            // Decode base64
            const combined = new Uint8Array(
                this.base64Decode(base64Data).split('').map(char => char.charCodeAt(0))
            );

            // Extract IV and encrypted data
            const iv = combined.slice(0, 12);
            const encrypted = combined.slice(12);

            const decrypted = await crypto.subtle.decrypt(
                {
                    name: 'AES-GCM',
                    iv: iv
                },
                key,
                encrypted
            );

            const decoder = new TextDecoder();
            return decoder.decode(decrypted);
        } catch (error) {
            Logger.error('Failed to decrypt value:', error);
            // Return the original value without the prefix if decryption fails
            return encryptedValue.startsWith('encrypted:') 
                ? encryptedValue.substring('encrypted:'.length) 
                : encryptedValue;
        }
    }

    /**
     * Check if a value is encrypted
     */
    static isEncrypted(value: string): boolean {
        return !!(value && value.startsWith('encrypted:'));
    }

    /**
     * Generate HMAC-SHA256 signature for license validation
     */
    static async generateHmacSignature(
        data: string,
        secretKey: string
    ): Promise<string> {
        const encoder = new TextEncoder();
        const keyData = encoder.encode(secretKey);
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
}