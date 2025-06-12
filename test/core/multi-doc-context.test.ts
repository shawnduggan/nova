/**
 * Tests for MultiDocContextHandler - multi-document context functionality
 */

import { MultiDocContextHandler } from '../../src/core/multi-doc-context';
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
				frontmatter: {}
			};
		})
	};

	return {
		vault: mockVault,
		metadataCache: mockMetadataCache
	} as any;
};

describe('MultiDocContextHandler', () => {
	let multiDocContext: MultiDocContextHandler;
	let mockApp: App;
	let testFile: TFile;

	beforeEach(() => {
		mockApp = createMockApp();
		multiDocContext = new MultiDocContextHandler(mockApp);
		testFile = new TFile('test.md');
	});

	describe('Message Parsing', () => {
		it('should parse [[document]] references', () => {
			const text = 'Please analyze [[document1]] and compare with [[document2]].';
			const result = multiDocContext.parseMessage(text, 'test.md');
			
			expect(result.references).toHaveLength(2);
			expect(result.references[0].file.basename).toBe('document1');
			expect(result.references[1].file.basename).toBe('document2');
			expect(result.cleanedMessage).toBe('Please analyze and compare with .');
		});

		it('should handle documents with paths', () => {
			const text = 'Check [[sub/document3]] for details.';
			const result = multiDocContext.parseMessage(text, 'test.md');
			
			expect(result.references).toHaveLength(1);
			expect(result.references[0].file.path).toBe('sub/document3.md');
			expect(result.cleanedMessage).toBe('Check for details.');
		});

		it('should handle property references', () => {
			const text = 'Get the [[document1#title]] property.';
			const result = multiDocContext.parseMessage(text, 'test.md');
			
			expect(result.references).toHaveLength(1);
			expect(result.references[0].file.basename).toBe('document1');
			expect(result.references[0].property).toBe('title');
			expect(result.cleanedMessage).toBe('Get the property.');
		});

		it('should ignore malformed references', () => {
			const text = 'This has [[unclosed and ]]closed but empty] references.';
			const result = multiDocContext.parseMessage(text, 'test.md');
			
			expect(result.references).toHaveLength(0);
			expect(result.cleanedMessage).toBe('This has [[unclosed and ]]closed but empty] references.');
		});

		it('should handle non-existent files', () => {
			const text = 'Check [[nonexistent]] file.';
			const result = multiDocContext.parseMessage(text, 'test.md');
			
			expect(result.references).toHaveLength(0);
			expect(result.cleanedMessage).toBe('Check [[nonexistent]] file.');
		});
	});

	describe('Context Building', () => {
		it('should build context from message with references', async () => {
			const message = 'Analyze [[document1]] and [[document2]].';
			const result = await multiDocContext.buildContext(message, testFile);
			
			expect(result.cleanedMessage).toBe('Analyze and .');
			expect(result.context.persistentDocs).toHaveLength(2);
			expect(result.context.contextString).toContain('Document 1');
			expect(result.context.contextString).toContain('Document 2');
			expect(result.context.tokenCount).toBeGreaterThan(0);
		});

		it('should handle empty message', async () => {
			const message = '';
			const result = await multiDocContext.buildContext(message, testFile);
			
			expect(result.cleanedMessage).toBe('');
			expect(result.context.persistentDocs).toHaveLength(0);
			expect(result.context.contextString).toBe('');
			expect(result.context.tokenCount).toBe(0);
		});

		it('should estimate token count', async () => {
			const message = 'Analyze [[document1]].';
			const result = await multiDocContext.buildContext(message, testFile);
			
			expect(result.context.tokenCount).toBeGreaterThan(10);
		});

		it('should detect when approaching token limit', async () => {
			// Mock a very long document
			const longContent = 'This is a very long document. '.repeat(2000);
			(mockApp.vault.read as jest.Mock).mockResolvedValueOnce(longContent);
			
			const message = 'Analyze [[document1]].';
			const result = await multiDocContext.buildContext(message, testFile);
			
			expect(result.context.isNearLimit).toBe(true);
		});
	});

	describe('Persistent Context Management', () => {
		it('should maintain persistent context', async () => {
			const message1 = 'First message with [[document1]].';
			await multiDocContext.buildContext(message1, testFile);
			
			const message2 = 'Second message with [[document2]].';
			const result = await multiDocContext.buildContext(message2, testFile);
			
			// Should have both documents in persistent context
			expect(result.context.persistentDocs).toHaveLength(2);
			expect(result.context.persistentDocs.map(d => d.file.basename)).toContain('document1');
			expect(result.context.persistentDocs.map(d => d.file.basename)).toContain('document2');
		});

		it('should not duplicate documents in persistent context', async () => {
			const message1 = 'First message with [[document1]].';
			await multiDocContext.buildContext(message1, testFile);
			
			const message2 = 'Second message also with [[document1]].';
			const result = await multiDocContext.buildContext(message2, testFile);
			
			// Should only have one instance of document1
			expect(result.context.persistentDocs).toHaveLength(1);
			expect(result.context.persistentDocs[0].file.basename).toBe('document1');
		});

		it('should get persistent context for file', () => {
			multiDocContext.parseMessage('[[document1]]', 'test.md');
			const persistent = multiDocContext.getPersistentContext('test.md');
			
			expect(persistent).toHaveLength(1);
			expect(persistent[0].file.basename).toBe('document1');
		});

		it('should clear persistent context for file', () => {
			multiDocContext.parseMessage('[[document1]]', 'test.md');
			multiDocContext.clearPersistentContext('test.md');
			const persistent = multiDocContext.getPersistentContext('test.md');
			
			expect(persistent).toHaveLength(0);
		});

		it('should remove specific document from persistent context', () => {
			multiDocContext.parseMessage('[[document1]] and [[document2]]', 'test.md');
			multiDocContext.removePersistentDoc('test.md', 'document1.md');
			const persistent = multiDocContext.getPersistentContext('test.md');
			
			expect(persistent).toHaveLength(1);
			expect(persistent[0].file.basename).toBe('document2');
		});
	});

	describe('Context Indicators', () => {
		it('should generate context indicators', async () => {
			const message = 'Analyze [[document1]] and [[document2]].';
			const result = await multiDocContext.buildContext(message, testFile);
			
			const indicators = multiDocContext.getContextIndicators(result.context);
			
			expect(indicators.text).toContain('📚 2');
			expect(indicators.text).toContain('%');
			expect(indicators.className).toBe('nova-context-indicator');
			expect(indicators.tooltip).toContain('2 documents');
		});

		it('should show warning when near token limit', async () => {
			// Mock a very long document
			const longContent = 'This is a very long document. '.repeat(2000);
			(mockApp.vault.read as jest.Mock).mockResolvedValueOnce(longContent);
			
			const message = 'Analyze [[document1]].';
			const result = await multiDocContext.buildContext(message, testFile);
			
			const indicators = multiDocContext.getContextIndicators(result.context);
			
			expect(indicators.className).toContain('nova-context-warning');
			expect(indicators.tooltip).toContain('approaching limit');
		});
	});

	describe('Context Display Formatting', () => {
		it('should format context for display', async () => {
			const message = 'Analyze [[document1]] and [[document2#title]].';
			const result = await multiDocContext.buildContext(message, testFile);
			
			const formatted = multiDocContext.formatContextForDisplay(result.context);
			
			expect(formatted).toContain('+document1');
			expect(formatted).toContain('+document2#title');
		});

		it('should handle empty context', () => {
			const emptyContext = {
				temporaryDocs: [],
				persistentDocs: [],
				contextString: '',
				tokenCount: 0,
				isNearLimit: false
			};
			
			const formatted = multiDocContext.formatContextForDisplay(emptyContext);
			
			expect(formatted).toHaveLength(0);
		});
	});

	describe('Error Handling', () => {
		it('should handle vault read errors gracefully', async () => {
			(mockApp.vault.read as jest.Mock).mockRejectedValueOnce(new Error('File read error'));
			
			const message = 'Analyze [[document1]].';
			const result = await multiDocContext.buildContext(message, testFile);
			
			// Should still parse the reference but context will be empty
			expect(result.cleanedMessage).toBe('Analyze .');
			expect(result.context.contextString).toBe('');
		});

		it('should handle missing files gracefully', () => {
			const text = 'Check [[nonexistent-file]].';
			const result = multiDocContext.parseMessage(text, 'test.md');
			
			expect(result.references).toHaveLength(0);
			expect(result.cleanedMessage).toBe('Check [[nonexistent-file]].');
		});
	});
});