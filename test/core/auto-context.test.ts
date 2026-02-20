/**
 * Tests for AutoContextService - automatic context population from wikilinks
 */

import { AutoContextService, estimateTokens, extractSectionContent, truncateDocumentContent } from '../../src/core/auto-context';
import { TFile } from '../mocks/obsidian-mock';

// Mock Obsidian App
const createMockApp = () => {
	const mockFiles: TFile[] = [
		new TFile('document1.md'),
		new TFile('document2.md'),
		new TFile('sub/document3.md'),
		new TFile('large-doc.md'),
		new TFile('empty.md'),
		new TFile('current.md')
	];

	const fileContents: Record<string, string> = {
		'document1.md': '# Document 1\n\nThis is the first document content.',
		'document2.md': '# Document 2\n\nThis is the second document with more content.\n\n## Section A\nContent in section A.\n\n## Section B\nContent in section B.',
		'sub/document3.md': '# Document 3\n\nNested document content.',
		'large-doc.md': '# Large Document\n\n' + 'x'.repeat(50000), // > 8K tokens
		'empty.md': '',
		'current.md': '# Current Document\n\nLinks to [[document1]] and [[document2#Section A]].'
	};

	const mockVault = {
		getFileByPath: jest.fn((path: string) => {
			return mockFiles.find(f => f.path === path) || null;
		}),
		read: jest.fn((file: TFile) => {
			return Promise.resolve(fileContents[file.path] || '');
		})
	};

	const mockMetadataCache = {
		getFileCache: jest.fn((file: TFile) => {
			const contents = fileContents[file.path] || '';
			const headings: Array<{ heading: string; level: number; position: { start: { line: number } } }> = [];
			
			// Simple heading extraction
			contents.split('\n').forEach((line, index) => {
				const match = line.match(/^(#{1,6})\s+(.+)$/);
				if (match) {
					headings.push({
						heading: match[2],
						level: match[1].length,
						position: { start: { line: index } }
					});
				}
			});

			const links: Array<{ link: string; position: { start: { line: number } } }> = [];
			
			// Extract wikilinks
			const linkRegex = /\[\[([^\]]+)\]\]/g;
			let match;
			while ((match = linkRegex.exec(contents)) !== null) {
				links.push({
					link: match[1],
					position: { start: { line: 0 } }
				});
			}

			return {
				headings,
				links,
				frontmatter: {}
			};
		}),
		getFirstLinkpathDest: jest.fn((linkpath: string, _sourcePath: string) => {
			// Handle section references
			const basePath = linkpath.split('#')[0];
			return mockFiles.find(f => 
				f.basename === basePath || 
				f.path === basePath || 
				f.path === basePath + '.md'
			) || null;
		}),
		getBacklinksForFile: jest.fn((file: TFile) => {
			// Return files that link to this file
			const backlinks = new Map<string, unknown>();
			
			if (file.path === 'document1.md') {
				// current.md links to document1
				backlinks.set('current.md', { position: { start: { line: 0 } } });
			}
			
			return backlinks;
		})
	};

	return {
		vault: mockVault,
		metadataCache: mockMetadataCache
	} as any;
};

describe('AutoContextService', () => {
	let autoContext: AutoContextService;
	let mockApp: any;

	beforeEach(() => {
		mockApp = createMockApp();
		autoContext = new AutoContextService(mockApp);
	});

	describe('resolveOutgoingLinks', () => {
		it('should resolve wikilinks from a file', () => {
			const currentFile = new TFile('current.md');
			const links = autoContext.resolveOutgoingLinks(currentFile);

			expect(links).toHaveLength(2);
			expect(links[0].file.basename).toBe('document1');
			expect(links[1].file.basename).toBe('document2');
			expect(links[1].section).toBe('Section A');
		});

		it('should handle files with no links', () => {
			const doc1 = new TFile('document1.md');
			const links = autoContext.resolveOutgoingLinks(doc1);

			expect(links).toHaveLength(0);
		});

		it('should deduplicate links', () => {
			// Create a file with duplicate links
			const duplicateFile = new TFile('dup.md');
			mockApp.metadataCache.getFileCache = jest.fn(() => ({
				links: [
					{ link: 'document1', position: { start: { line: 0 } } },
					{ link: 'document1', position: { start: { line: 1 } } }
				],
				frontmatter: {}
			}));

			const links = autoContext.resolveOutgoingLinks(duplicateFile);
			expect(links).toHaveLength(1);
		});
	});

	describe('resolveBacklinks', () => {
		it('should resolve backlinks to a file', () => {
			const doc1 = new TFile('document1.md');
			const backlinks = autoContext.resolveBacklinks(doc1);

			expect(backlinks).toHaveLength(1);
			expect(backlinks[0].basename).toBe('current');
		});

		it('should return empty array for files with no backlinks', () => {
			const doc2 = new TFile('document2.md');
			const backlinks = autoContext.resolveBacklinks(doc2);

			expect(backlinks).toHaveLength(0);
		});
	});

	describe('buildAutoContext', () => {
		it('should build context with outgoing links only (default)', async () => {
			const currentFile = new TFile('current.md');
			const docs = await autoContext.buildAutoContext(currentFile);

			expect(docs).toHaveLength(2);
			expect(docs[0].source).toBe('linked');
			expect(docs[1].source).toBe('linked');
		});

		it('should include backlinks when enabled', async () => {
			autoContext.setOptions({ includeOutgoing: false, includeBacklinks: true });
			
			const doc1 = new TFile('document1.md');
			const docs = await autoContext.buildAutoContext(doc1);

			expect(docs).toHaveLength(1);
			expect(docs[0].source).toBe('backlink');
		});

		it('should respect existing manual docs (no duplicates)', async () => {
			const currentFile = new TFile('current.md');
			const existingManual = [new TFile('document1.md')];
			
			const docs = await autoContext.buildAutoContext(currentFile, existingManual);

			// document1 should be skipped since it's already in manual context
			expect(docs).toHaveLength(1);
			expect(docs[0].file.basename).toBe('document2');
		});

		it('should skip empty documents', async () => {
			// Create a file that links to empty.md
			const file = new TFile('links-to-empty.md');
			mockApp.metadataCache.getFileCache = jest.fn(() => ({
				links: [{ link: 'empty', position: { start: { line: 0 } } }],
				frontmatter: {}
			}));

			const docs = await autoContext.buildAutoContext(file);
			expect(docs).toHaveLength(0);
		});
	});

	describe('token estimation', () => {
		it('should estimate tokens correctly', async () => {
			const currentFile = new TFile('current.md');
			const docs = await autoContext.buildAutoContext(currentFile);

			// document1 has ~50 chars = ~13 tokens
			const doc1Tokens = docs.find(d => d.file.basename === 'document1')?.tokenCount;
			expect(doc1Tokens).toBeGreaterThan(0);
			expect(doc1Tokens).toBeLessThan(100);
		});

		it('should mark large documents as truncated', async () => {
			// Create a file that links to large-doc.md
			const file = new TFile('links-to-large.md');
			mockApp.metadataCache.getFileCache = jest.fn(() => ({
				links: [{ link: 'large-doc', position: { start: { line: 0 } } }],
				frontmatter: {}
			}));

			const docs = await autoContext.buildAutoContext(file);
			expect(docs).toHaveLength(1);
			expect(docs[0].isTruncated).toBe(true);
			expect(docs[0].fullTokenCount).toBeGreaterThan(8000);
		});
	});
});

describe('estimateTokens', () => {
	it('should estimate tokens as ~4 chars per token', () => {
		expect(estimateTokens('')).toBe(0);
		expect(estimateTokens('test')).toBe(1);
		expect(estimateTokens('testing')).toBe(2); // 7 chars = 2 tokens (ceil)
		expect(estimateTokens('x'.repeat(4000))).toBe(1000);
	});
});

describe('extractSectionContent', () => {
	const content = `# Main Heading

Introduction text.

## Section A
Content in section A.
More content.

## Section B
Content in section B.

### Subsection
Nested content.

## Section C
Final section.`;

	const headings = [
		{ heading: 'Main Heading', level: 1, position: { start: { line: 0, col: 0 }, end: { line: 0, col: 10 } } },
		{ heading: 'Section A', level: 2, position: { start: { line: 4, col: 0 }, end: { line: 4, col: 10 } } },
		{ heading: 'Section B', level: 2, position: { start: { line: 8, col: 0 }, end: { line: 8, col: 10 } } },
		{ heading: 'Subsection', level: 3, position: { start: { line: 11, col: 0 }, end: { line: 11, col: 10 } } },
		{ heading: 'Section C', level: 2, position: { start: { line: 14, col: 0 }, end: { line: 14, col: 10 } } }
	];

	it('should extract content between headings', () => {
		const sectionA = extractSectionContent(content, 'Section A', headings);
		expect(sectionA).toContain('Content in section A');
		expect(sectionA).not.toContain('Section B');
	});

	it('should respect heading levels (stop at same or higher level)', () => {
		const sectionB = extractSectionContent(content, 'Section B', headings);
		expect(sectionB).toContain('Content in section B');
		expect(sectionB).toContain('Nested content'); // Subsection is lower level, should be included
		expect(sectionB).not.toContain('Section C'); // Same level, should stop before
	});

	it('should return null for non-existent sections', () => {
		const result = extractSectionContent(content, 'Non Existent', headings);
		expect(result).toBeNull();
	});
});
