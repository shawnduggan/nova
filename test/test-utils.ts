import { TFile } from 'obsidian';

/**
 * Creates a mock TFile object for testing purposes.
 * This avoids the need for type casting (as TFile) which Obsidian flagged.
 * 
 * @param path - The file path
 * @param name - Optional file name (defaults to extracting from path)
 * @returns A proper TFile-like object
 */
export function createMockTFile(path: string, name?: string): TFile {
    const fileName = name || path.split('/').pop() || 'file.md';
    const baseName = fileName.replace(/\.[^/.]+$/, ''); // Remove extension
    const extension = fileName.split('.').pop() || 'md';
    
    // Create an object that properly extends TFile prototype
    return Object.create(TFile.prototype, {
        path: { value: path, writable: false, enumerable: true },
        name: { value: fileName, writable: false, enumerable: true },
        basename: { value: baseName, writable: false, enumerable: true },
        extension: { value: extension, writable: false, enumerable: true },
        vault: { value: null, writable: false, enumerable: true },
        parent: { value: null, writable: false, enumerable: true },
        stat: { 
            value: { 
                ctime: Date.now(), 
                mtime: Date.now(), 
                size: 100 
            }, 
            writable: false, 
            enumerable: true 
        }
    });
}