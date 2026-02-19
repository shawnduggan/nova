// Set test environment before any imports to fix feature-manager.test.ts failures
process.env.NODE_ENV = 'test';

// Jest setup file to provide missing browser APIs in Node.js test environment

import { TextEncoder, TextDecoder } from 'util';

// Make TextEncoder and TextDecoder available globally
(global as any).TextEncoder = TextEncoder;
(global as any).TextDecoder = TextDecoder;

// Mock crypto.subtle for license validation tests
const crypto = require('crypto');

Object.defineProperty(global, 'crypto', {
  value: {
    subtle: {
      importKey: async (format: string, keyData: ArrayBuffer, algorithm: any, extractable: boolean, keyUsages: string[]) => {
        return { algorithm, extractable, type: 'secret', usages: keyUsages };
      },
      sign: async (algorithm: string, key: any, data: ArrayBuffer) => {
        const hmac = crypto.createHmac('sha256', new Uint8Array(keyData));
        hmac.update(new Uint8Array(data));
        return hmac.digest();
      }
    }
  }
});

// Store the key data for the crypto mock
let keyData: ArrayBuffer;

// Override importKey to store the key
Object.defineProperty(global.crypto.subtle, 'importKey', {
  value: async (format: string, key: ArrayBuffer, algorithm: any, extractable: boolean, keyUsages: string[]) => {
    keyData = key;
    return { algorithm, extractable, type: 'secret', usages: keyUsages };
  }
});

// Use stored key in sign
Object.defineProperty(global.crypto.subtle, 'sign', {
  value: async (algorithm: string, key: any, data: ArrayBuffer) => {
    const hmac = crypto.createHmac('sha256', new Uint8Array(keyData));
    hmac.update(new Uint8Array(data));
    return hmac.digest();
  }
});

// Mock btoa and atob if not available
if (typeof global.btoa === 'undefined') {
  global.btoa = (str: string) => Buffer.from(str, 'utf8').toString('base64');
}

if (typeof global.atob === 'undefined') {
  global.atob = (str: string) => Buffer.from(str, 'base64').toString('utf8');
}