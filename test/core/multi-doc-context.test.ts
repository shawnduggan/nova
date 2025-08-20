/**
 * Tests for ContextManager - multi-document context functionality
 */

import { ContextManager } from '../../src/ui/context-manager';
import { TFile } from '../mocks/obsidian-mock';
import { App } from 'obsidian';

// Mock Obsidian App
const createMockApp = (): App => {
	const mockFiles: TFile[] = [
		new TFile('document1.md'),
		new TFile('document2.md'),
		new TFile('sub/document3.md'),
		new TFile('project-notes.md'),
		new TFile('meeting-transcript.md')
	];

	const mockVault = {
		getAbstractFileByPath: jest.fn((path: string) => {
			return mockFiles.find(f => f.path === path) || null;
		}),
		getMarkdownFiles: jest.fn(() => mockFiles),
		read: jest.fn((file: TFile) => {
			const content: Record<string, string> = {
				'document1.md': '# Document 1\n\nThis is the first document content.',
				'document2.md': '# Document 2\n\nThis is the second document.',
				'sub/document3.md': '# Document 3\n\nNested document content.',
				'project-notes.md': '# Project Notes\n\nImportant project information.',
				'meeting-transcript.md': '# Meeting Transcript\n\nDiscussion notes from the meeting.'
			};
			return Promise.resolve(content[file.path] || '');
		})
	};

	const mockMetadataCache = {
		getFileCache: jest.fn((file: TFile) => {
			return {
				headings: [
					{ heading: file.basename, level: 1, position: { start: { line: 0, col: 0 }, end: { line: 0, col: 10 } } }
				],
				links: [],
				tags: [],
				frontmatter: file.basename === 'document1' ? {
					title: 'Test Document 1',
					tags: ['test', 'sample'],
					date: '2025-01-01'
				} : {}
			};
		}),
		getFirstLinkpathDest: jest.fn((linkpath: string, _sourcePath: string) => {
			// Find file by basename or exact path
			return mockFiles.find(f => 
				f.basename === linkpath || 
				f.path === linkpath || 
				f.path === linkpath + '.md'
			) || null;
		})
	};

	return {
		vault: mockVault,
		metadataCache: mockMetadataCache
	} as any;
};

describe('ContextManager', () => {
	let contextManager: ContextManager;
	let mockApp: App;
	let testFile: TFile;

	beforeEach(() => {
		mockApp = createMockApp();
		// Create a minimal mock plugin and container for ContextManager
		const mockPlugin = { 
			featureManager: { isFeatureEnabled: () => true }, 
			settings: { general: { defaultMaxTokens: 8000 } } 
		};
		const mockContainer = { 
			createDiv: jest.fn(() => ({ 
				style: { cssText: '' },
				createStan: jest.fn(() => ({ style: { cssText: '' } })),
				querySelector: jest.fn()
			})) 
		};
		contextManager = new ContextManager(mockPlugin as any, mockApp, mockContainer as any);
		testFile = new TFile('test.md');
		
		// Initialize context manager for this file
		contextManager.setCurrentFile(testFile);
	});

	describe('Message Parsing', () => {
		it('should parse [[document]] references', () => {
			const text = 'Please analyze [[document1]] and compare with [[document2]].';
			const result = contextManager.parseMessage(text, 'test.md');
			
			expect(result.references).toHaveLength(2);
			expect(result.references[0].file.basename).toBe('document1');
			expect(result.references[1].file.basename).toBe('document2');
			expect(result.cleanedMessage).toBe('Please analyze and compare with .');
		});

		it('should handle documents with paths', () => {
			const text = 'Check [[sub/document3]] for details.';
			const result = contextManager.parseMessage(text, 'test.md');
			
			expect(result.references).toHaveLength(1);
			expect(result.references[0].file.path).toBe('sub/document3.md');
			expect(result.cleanedMessage).toBe('Check for details.');
		});

		it('should handle property references', () => {
			const text = 'Get the [[document1#title]] property.';
			const result = contextManager.parseMessage(text, 'test.md');
			
			expect(result.references).toHaveLength(1);
			expect(result.references[0].file.basename).toBe('document1');
			expect(result.references[0].property).toBe('title');
			expect(result.cleanedMessage).toBe('Get the property.');
		});

		it('should ignore malformed references', () => {
			const text = 'This has [[unclosed and ]]closed but empty] references.';
			const result = contextManager.parseMessage(text, 'test.md');
			
			expect(result.references).toHaveLength(0);
			expect(result.cleanedMessage).toBe('This has [[unclosed and ]]closed but empty] references.');
		});

		it('should handle non-existent files', () => {
			const text = 'Check [[nonexistent]] file.';
			const result = contextManager.parseMessage(text, 'test.md');
			
			expect(result.references).toHaveLength(0);
			expect(result.cleanedMessage).toBe('Check [[nonexistent]] file.');
		});
	});

	describe('Context Building', () => {
		it('should build context from message with references', async () => {
			const message = 'Analyze [[document1]] and [[document2]].';
			const context = await contextManager.buildContext(message, testFile);
			const parsed = contextManager.parseMessage(message, testFile.path);
			
			expect(context).not.toBeNull();
			expect(parsed.cleanedMessage).toBe('Analyze and .');
			expect(context!.persistentDocs).toHaveLength(2);
			expect(context!.contextString).toContain('Document 1');
			expect(context!.contextString).toContain('Document 2');
			expect(context!.tokenCount).toBeGreaterThan(0);
		});

		it('should handle empty message but include current file', async () => {
			const message = '';
			const context = await contextManager.buildContext(message, testFile);
			
			expect(context).not.toBeNull();
			expect(contextManager.parseMessage(message, testFile.path).cleanedMessage).toBe('');
			expect(context!.persistentDocs).toHaveLength(0);
			// Current file is always included in context
			expect(context!.contextString).toContain('Document: test');
			expect(context!.tokenCount).toBeGreaterThan(0);
		});

		it('should estimate token count', async () => {
			const message = 'Analyze [[document1]].';
			const context = await contextManager.buildContext(message, testFile);
			
			expect(context).not.toBeNull();
			expect(context!.tokenCount).toBeGreaterThan(10);
		});

		it('should calculate token count for long documents', async () => {
			// Mock a very long document
			const longContent = 'This is a very long document. '.repeat(2000);
			(mockApp.vault.read as jest.Mock).mockResolvedValueOnce(longContent);
			
			const message = 'Analyze [[document1]].';
			const context = await contextManager.buildContext(message, testFile);
			
			expect(context).not.toBeNull();
			expect(context!.tokenCount).toBeGreaterThan(10000); // Long document should have many tokens
			expect(context!.totalContextUsage).toBeDefined(); // Should have total context usage calculation
		});
	});

	describe('Persistent Context Management', () => {
		it('should maintain persistent context', async () => {
			const message1 = 'First message with [[document1]].';
			await contextManager.buildContext(message1, testFile);
			
			const message2 = 'Second message with [[document2]].';
			const context = await contextManager.buildContext(message2, testFile);
			
			expect(context).not.toBeNull();
			// Should have both documents in persistent context
			expect(context!.persistentDocs).toHaveLength(2);
			expect(context!.persistentDocs.map((d: any) => d.file.basename)).toContain('document1');
			expect(context!.persistentDocs.map((d: any) => d.file.basename)).toContain('document2');
		});

		it('should not duplicate documents in persistent context', async () => {
			const message1 = 'First message with [[document1]].';
			await contextManager.buildContext(message1, testFile);
			
			const message2 = 'Second message also with [[document1]].';
			const context = await contextManager.buildContext(message2, testFile);
			
			expect(context).not.toBeNull();
			// Should only have one instance of document1
			expect(context!.persistentDocs).toHaveLength(1);
			expect(context!.persistentDocs[0].file.basename).toBe('document1');
		});

		it('should get persistent context for file', () => {
			contextManager.parseMessage('[[document1]]', 'test.md');
			const persistent = contextManager.getPersistentContext('test.md');
			
			expect(persistent).toHaveLength(1);
			expect(persistent[0].file.basename).toBe('document1');
		});

		it('should clear persistent context for file', () => {
			contextManager.parseMessage('[[document1]]', 'test.md');
			contextManager.clearPersistentContext('test.md');
			const persistent = contextManager.getPersistentContext('test.md');
			
			expect(persistent).toHaveLength(0);
		});

		it('should remove specific document from persistent context', () => {
			contextManager.parseMessage('[[document1]] and [[document2]]', 'test.md');
			contextManager.removePersistentDoc('test.md', 'document1.md');
			const persistent = contextManager.getPersistentContext('test.md');
			
			expect(persistent).toHaveLength(1);
			expect(persistent[0].file.basename).toBe('document2');
		});
	});

	describe('Context Indicators', () => {
		it('should generate context indicators', async () => {
			const message = 'Analyze [[document1]] and [[document2]].';
			const context = await contextManager.buildContext(message, testFile);
			
			const indicators = contextManager.getContextIndicators(context!);
			
			expect(indicators.text).toBe('2 docs');
			expect(indicators.className).toBe('nova-context-indicator');
			expect(indicators.tooltip).toContain('2 documents');
			expect(indicators.tooltip).toContain('tokens');
		});

		it('should show document count correctly for large contexts', async () => {
			// Mock a very long document
			const longContent = 'This is a very long document. '.repeat(2000);
			(mockApp.vault.read as jest.Mock).mockResolvedValueOnce(longContent);
			
			const message = 'Analyze [[document1]].';
			const context = await contextManager.buildContext(message, testFile);
			
			const indicators = contextManager.getContextIndicators(context!);
			
			expect(indicators.text).toBe('1 docs');
			expect(indicators.className).toBe('nova-context-indicator');
			expect(indicators.tooltip).toContain('1 document');
		});
	});

	describe('Context Display Formatting', () => {
		it('should format context for display', async () => {
			const message = 'Analyze [[document1]] and [[document2#title]].';
			const context = await contextManager.buildContext(message, testFile);
			
			const formatted = contextManager.formatContextForDisplay(context!);
			
			expect(formatted).toContain('document1');
			expect(formatted).toContain('document2#title');
		});

		it('should handle empty context', () => {
			const emptyContext = {
				persistentDocs: [],
				contextString: '',
				tokenCount: 0,
				isNearLimit: false
			};
			
			const formatted = contextManager.formatContextForDisplay(emptyContext);
			
			expect(formatted).toHaveLength(0);
		});
	});

	describe('Error Handling', () => {
		it('should handle vault read errors gracefully', async () => {
			// First call fails (current file), second call succeeds (referenced doc)
			(mockApp.vault.read as jest.Mock)
				.mockRejectedValueOnce(new Error('File read error'))
				.mockResolvedValueOnce('# Document 1\nThis is the first document content.');
			
			const message = 'Analyze [[document1]].';
			const context = await contextManager.buildContext(message, testFile);
			
			expect(context).not.toBeNull();
			// Should still parse the reference and include the document that could be read
			expect(contextManager.parseMessage(message, testFile.path).cleanedMessage).toBe('Analyze .');
			expect(context!.contextString).toContain('Document: document1');
			expect(context!.persistentDocs).toHaveLength(1);
		});

		it('should handle missing files gracefully', () => {
			const text = 'Check [[nonexistent-file]].';
			const result = contextManager.parseMessage(text, 'test.md');
			
			expect(result.references).toHaveLength(0);
			expect(result.cleanedMessage).toBe('Check [[nonexistent-file]].');
		});
	});

	describe('Metadata/Properties Handling', () => {
		it('should include metadata for all documents including current file', async () => {
			const message = 'Analyze [[document1]].';
			const context = await contextManager.buildContext(message, testFile);
			
			expect(context).not.toBeNull();
			// Check that metadata is included for document1
			expect(context!.contextString).toContain('Properties/Metadata:');
			expect(context!.contextString).toContain('title: Test Document 1');
			expect(context!.contextString).toContain('tags: ["test","sample"]');
			expect(context!.contextString).toContain('date: 2025-01-01');
			
			// Current file should also be in context
			expect(context!.contextString).toContain('Document: test');
		});

		it('should include document content without frontmatter duplication', async () => {
			// Mock a file with frontmatter
			(mockApp.vault.read as jest.Mock).mockResolvedValueOnce('---\ntitle: Test\n---\n# Main Content\nThis is the content.');
			
			const message = '';
			const context = await contextManager.buildContext(message, testFile);
			
			expect(context).not.toBeNull();
			// Should not duplicate frontmatter in content section
			expect(context!.contextString).toContain('### Content:');
			expect(context!.contextString).toContain('# Main Content');
			expect(context!.contextString).not.toMatch(/### Content:[\s\S]*---[\s\S]*title:/);
		});
	});
});