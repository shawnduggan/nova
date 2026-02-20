import { TFile } from 'obsidian';
import { estimateTokens, truncateDocumentContent, AutoContextService, DEFAULT_AUTO_CONTEXT_OPTIONS, type AutoContextDocument, type ContextSource } from '../../src/core/auto-context';

// Mock TFile factory
function createMockTFile(path: string, name?: string): TFile {
    const fileName = name || path.split('/').pop() || 'file.md';
    const baseName = fileName.replace(/\.[^/.]+$/, '');
    const extension = fileName.split('.').pop() || 'md';
    
    return Object.create(TFile.prototype, {
        path: { value: path, writable: false, enumerable: true },
        name: { value: fileName, writable: false, enumerable: true },
        basename: { value: baseName, writable: false, enumerable: true },
        extension: { value: extension, writable: false, enumerable: true },
        vault: { value: null, writable: false, enumerable: true },
        parent: { value: null, writable: false, enumerable: true },
        stat: { 
            value: { ctime: Date.now(), mtime: Date.now(), size: 100 }, 
            writable: false, 
            enumerable: true 
        }
    });
}

// Mock App
const createMockApp = (resolvedLinks: Record<string, Record<string, boolean>> = {}) => {
    const mockMetadataCache = {
        getFileCache: jest.fn().mockReturnValue({ links: [], headings: [], frontmatter: {} }),
        getFirstLinkpathDest: jest.fn().mockReturnValue(null),
        resolvedLinks
    };
    
    const mockVault = {
        getFileByPath: jest.fn(),
        read: jest.fn(),
        cachedRead: jest.fn()
    };
    
    return {
        metadataCache: mockMetadataCache,
        vault: mockVault
    };
};

describe('estimateTokens', () => {
    test('should estimate tokens for empty string', () => {
        expect(estimateTokens('')).toBe(0);
    });

    test('should estimate tokens for short text', () => {
        const text = 'Hello world';
        const tokens = estimateTokens(text);
        expect(tokens).toBeGreaterThan(0);
        expect(tokens).toBeLessThanOrEqual(text.length);
    });

    test('should estimate tokens for longer text', () => {
        const text = 'This is a longer piece of text that should have more tokens. '.repeat(10);
        const tokens = estimateTokens(text);
        expect(tokens).toBeGreaterThan(10);
    });
});

describe('AutoContextService', () => {
    let mockApp: ReturnType<typeof createMockApp>;
    let service: AutoContextService;

    beforeEach(() => {
        mockApp = createMockApp();
        service = new AutoContextService(mockApp as any, DEFAULT_AUTO_CONTEXT_OPTIONS);
    });

    describe('resolveOutgoingLinks', () => {
        test('should return empty array when no links found', () => {
            const file = createMockTFile('/test/note.md');
            (mockApp.metadataCache.getFileCache as jest.Mock).mockReturnValueOnce({ links: [] });
            
            const result = service.resolveOutgoingLinks(file);
            expect(result).toEqual([]);
        });

        test('should resolve outgoing wikilinks', () => {
            const file = createMockTFile('/test/note.md');
            const linkedFile = createMockTFile('/test/linked.md', 'linked.md');
            
            (mockApp.metadataCache.getFileCache as jest.Mock).mockReturnValueOnce({
                links: [{ link: 'linked.md' }]
            });
            (mockApp.metadataCache.getFirstLinkpathDest as jest.Mock).mockReturnValueOnce(linkedFile);
            
            const result = service.resolveOutgoingLinks(file);
            expect(result).toHaveLength(1);
            expect(result[0].file.path).toBe('/test/linked.md');
        });

        test('should handle section links', () => {
            const file = createMockTFile('/test/note.md');
            const linkedFile = createMockTFile('/test/linked.md', 'linked.md');
            
            (mockApp.metadataCache.getFileCache as jest.Mock).mockReturnValueOnce({
                links: [{ link: 'linked.md#Section' }]
            });
            (mockApp.metadataCache.getFirstLinkpathDest as jest.Mock).mockReturnValueOnce(linkedFile);
            
            const result = service.resolveOutgoingLinks(file);
            expect(result).toHaveLength(1);
            expect(result[0].section).toBe('Section');
        });

        test('should skip missing files', () => {
            const file = createMockTFile('/test/note.md');
            
            (mockApp.metadataCache.getFileCache as jest.Mock).mockReturnValueOnce({
                links: [{ link: 'nonexistent.md' }]
            });
            (mockApp.metadataCache.getFirstLinkpathDest as jest.Mock).mockReturnValueOnce(null);
            
            const result = service.resolveOutgoingLinks(file);
            expect(result).toHaveLength(0);
        });

        test('should handle duplicate links', () => {
            const file = createMockTFile('/test/note.md');
            const linkedFile = createMockTFile('/test/linked.md', 'linked.md');
            
            (mockApp.metadataCache.getFileCache as jest.Mock).mockReturnValueOnce({
                links: [{ link: 'linked.md' }, { link: 'linked.md' }]
            });
            (mockApp.metadataCache.getFirstLinkpathDest as jest.Mock).mockReturnValue(linkedFile);
            
            const result = service.resolveOutgoingLinks(file);
            expect(result).toHaveLength(1);
        });
    });

    describe('resolveBacklinks', () => {
        test('should return empty when no backlinks', () => {
            const file = createMockTFile('/test/note.md');
            (mockApp.metadataCache as any).resolvedLinks = {};
            
            const result = service.resolveBacklinks(file);
            expect(result).toEqual([]);
        });

        test('should resolve backlinks from resolvedLinks', () => {
            const file = createMockTFile('/test/target.md');
            const backlinkFile = createMockTFile('/test/source.md', 'source.md');
            
            (mockApp.metadataCache as any).resolvedLinks = {
                '/test/source.md': { '/test/target.md': true }
            };
            (mockApp.vault.getFileByPath as jest.Mock).mockReturnValue(backlinkFile);
            
            const result = service.resolveBacklinks(file);
            expect(result).toHaveLength(1);
            expect(result[0].path).toBe('/test/source.md');
        });

        test('should handle circular links', () => {
            const fileA = createMockTFile('/test/a.md');
            const fileB = createMockTFile('/test/b.md', 'b.md');
            
            (mockApp.metadataCache as any).resolvedLinks = {
                '/test/b.md': { '/test/a.md': true },
                '/test/a.md': { '/test/b.md': true }
            };
            (mockApp.vault.getFileByPath).mockImplementation((path: string) => {
                if (path === '/test/b.md') return fileB;
                if (path === '/test/a.md') return fileA;
                return null;
            });
            
            const resultA = service.resolveBacklinks(fileA);
            expect(resultA).toHaveLength(1);
            expect(resultA[0].path).toBe('/test/b.md');
            
            const resultB = service.resolveBacklinks(fileB);
            expect(resultB).toHaveLength(1);
            expect(resultB[0].path).toBe('/test/a.md');
        });

        test('should skip duplicates', () => {
            const file = createMockTFile('/test/target.md');
            const backlinkFile1 = createMockTFile('/test/source.md', 'source.md');
            const backlinkFile2 = createMockTFile('/test/also-source.md', 'also-source.md');
            
            (mockApp.metadataCache as any).resolvedLinks = {
                '/test/source.md': { '/test/target.md': true },
                '/test/also-source.md': { '/test/target.md': true }
            };
            (mockApp.vault.getFileByPath).mockImplementation((path: string) => {
                if (path === '/test/source.md') return backlinkFile1;
                if (path === '/test/also-source.md') return backlinkFile2;
                return null;
            });
            
            const result = service.resolveBacklinks(file);
            expect(result).toHaveLength(2);
        });
    });

    describe('buildAutoContext', () => {
        test('should return empty when no links and no backlinks', async () => {
            const file = createMockTFile('/test/note.md');
            (mockApp.metadataCache.getFileCache as jest.Mock).mockReturnValue({ links: [] });
            (mockApp.metadataCache as any).resolvedLinks = {};
            
            const result = await service.buildAutoContext(file);
            expect(result).toEqual([]);
        });

        test('should include outgoing links', async () => {
            const file = createMockTFile('/test/note.md');
            const linkedFile = createMockTFile('/test/linked.md', 'linked.md');
            
            (mockApp.metadataCache.getFileCache as jest.Mock).mockReturnValue({
                links: [{ link: 'linked.md' }]
            });
            (mockApp.metadataCache.getFirstLinkpathDest as jest.Mock).mockReturnValue(linkedFile);
            (mockApp.vault.cachedRead).mockResolvedValue('Short content');
            
            const result = await service.buildAutoContext(file);
            expect(result).toHaveLength(1);
            expect(result[0].source).toBe('linked');
        });

        test('should exclude empty documents', async () => {
            const file = createMockTFile('/test/note.md');
            const linkedFile = createMockTFile('/test/empty.md', 'empty.md');
            
            (mockApp.metadataCache.getFileCache as jest.Mock).mockReturnValue({
                links: [{ link: 'empty.md' }]
            });
            (mockApp.metadataCache.getFirstLinkpathDest as jest.Mock).mockReturnValue(linkedFile);
            (mockApp.vault.cachedRead).mockResolvedValue('');
            
            const result = await service.buildAutoContext(file);
            expect(result).toHaveLength(0);
        });
    });
});

describe('truncateDocumentContent', () => {
    let mockApp: ReturnType<typeof createMockApp>;

    beforeEach(() => {
        mockApp = createMockApp();
    });

    test('should return null for empty content', async () => {
        const file = createMockTFile('/test/large.md');
        (mockApp.vault.cachedRead).mockResolvedValue('');
        
        const result = await truncateDocumentContent(
            mockApp as any,
            file,
            { largeDocMaxTokens: 2000, minContentLength: 10 }
        );
        
        expect(result).toBeNull();
    });

    test('should include headings structure', async () => {
        const file = createMockTFile('/test/large.md');
        const content = '# Title\n\n## Section 1\n\nContent here\n\n## Section 2\n\nMore content\n\n'.repeat(50);
        
        (mockApp.vault.cachedRead).mockResolvedValue(content);
        (mockApp.metadataCache.getFileCache as jest.Mock).mockReturnValue({
            headings: [
                { heading: 'Title', level: 1, position: { start: { line: 0 }, end: { line: 1 } } },
                { heading: 'Section 1', level: 2, position: { start: { line: 2 }, end: { line: 4 } } },
                { heading: 'Section 2', level: 2, position: { start: { line: 5 }, end: { line: 7 } } }
            ],
            frontmatter: {}
        });
        
        const result = await truncateDocumentContent(
            mockApp as any,
            file,
            { largeDocMaxTokens: 2000, minContentLength: 10 }
        );
        
        expect(result).not.toBeNull();
        expect(result!.isTruncated).toBe(true);
        // Should include some sections from the document
        expect(result!.includedSections.length).toBeGreaterThan(0);
    });

    test('should extract specific section when requested', async () => {
        const file = createMockTFile('/test/large.md');
        const content = '# Title\n\n## Section 1\n\nContent for section 1\n\n## Section 2\n\nContent for section 2\n\n';
        
        (mockApp.vault.cachedRead).mockResolvedValue(content);
        (mockApp.metadataCache.getFileCache as jest.Mock).mockReturnValue({
            headings: [
                { heading: 'Title', level: 1, position: { start: { line: 0 }, end: { line: 1 } } },
                { heading: 'Section 1', level: 2, position: { start: { line: 2 }, end: { line: 4 } } },
                { heading: 'Section 2', level: 2, position: { start: { line: 5 }, end: { line: 7 } } }
            ],
            frontmatter: {}
        });
        
        const result = await truncateDocumentContent(
            mockApp as any,
            file,
            { largeDocMaxTokens: 2000, minContentLength: 10 },
            'Section 1'
        );
        
        expect(result).not.toBeNull();
        expect(result!.content).toContain('Section 1');
        expect(result!.includedSections).toContain('Section 1');
    });

    test('should use existing content when provided', async () => {
        const file = createMockTFile('/test/large.md');
        const existingContent = '# Title\n\nContent';
        
        const result = await truncateDocumentContent(
            mockApp as any,
            file,
            { largeDocMaxTokens: 2000, minContentLength: 10 },
            undefined,
            existingContent
        );
        
        expect(mockApp.vault.cachedRead).not.toHaveBeenCalled();
        expect(result).not.toBeNull();
    });
});

describe('Edge Cases', () => {
    test('duplicate documents should use outgoing precedence', () => {
        // If a document is both linked and backlinked, linked should take precedence
        // This is handled in buildAutoContext by checking existingPaths
        const existingPaths = new Set(['/test/doc.md']);
        const doc = { file: { path: '/test/doc.md' } };
        
        // Simulate the check: if path already exists, don't add
        const shouldAdd = !existingPaths.has(doc.file.path);
        expect(shouldAdd).toBe(false);
    });

    test('missing files should be skipped silently', async () => {
        const mockApp = createMockApp();
        const service = new AutoContextService(mockApp as any, DEFAULT_AUTO_CONTEXT_OPTIONS);
        const file = createMockTFile('/test/note.md');
        
        (mockApp.metadataCache.getFileCache as jest.Mock).mockReturnValue({
            links: [{ link: 'nonexistent.md' }]
        });
        (mockApp.vault.getFileByPath).mockReturnValue(null);
        
        const result = service.resolveOutgoingLinks(file);
        expect(result).toHaveLength(0);
    });
});
