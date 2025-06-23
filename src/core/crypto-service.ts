/**
 * Unified crypto service for Nova plugin
 * Handles both license validation (HMAC-SHA256) and API key encryption (AES-GCM)
 */

export class CryptoService {
    // Fixed encryption key for API keys - ensures cross-device compatibility
    private static readonly API_KEY_ENCRYPTION_DATA = new Uint8Array([
        0x4e, 0x6f, 0x76, 0x61, 0x2d, 0x41, 0x49, 0x2d,
        0x45, 0x6e, 0x63, 0x72, 0x79, 0x70, 0x74, 0x69,
        0x6f, 0x6e, 0x2d, 0x4b, 0x65, 0x79, 0x2d, 0x46,
        0x6f, 0x72, 0x2d, 0x41, 0x50, 0x49, 0x2d, 0x4b
    ]);

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
     * Get the encryption key for API key AES-GCM encryption
     */
    private static async getApiKeyEncryptionKey(): Promise<CryptoKey> {
        return await crypto.subtle.importKey(
            'raw',
            this.API_KEY_ENCRYPTION_DATA,
            { name: 'AES-GCM' },
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
            const key = await this.getApiKeyEncryptionKey();
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
            console.error('Failed to encrypt value:', error);
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
            const key = await this.getApiKeyEncryptionKey();
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
            console.error('Failed to decrypt value:', error);
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