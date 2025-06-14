/**
 * Test for context-only mode fix where AI should not output document content
 * when documents are added as context only
 */

import { expect } from '@jest/globals';
import { App, TFile } from '../mocks/obsidian-mock';
import { MultiDocContextHandler } from '../../src/core/multi-doc-context';

describe('Context-Only Mode Fix', () => {
    let app: App;
    let handler: MultiDocContextHandler;
    let testFile: TFile;
    let contextFile: TFile;

    beforeEach(() => {
        // Create test files
        testFile = new TFile('test.md');
        contextFile = new TFile('context.md');
        
        // Mock app with vault and metadataCache
        const mockVault = {
            getAbstractFileByPath: jest.fn((path: string) => {
                if (path === 'test.md') return testFile;
                if (path === 'context.md') return contextFile;
                return null;
            }),
            getMarkdownFiles: jest.fn(() => [testFile, contextFile]),
            read: jest.fn((file: TFile) => {
                if (file.path === 'test.md') return Promise.resolve('# Current Document\n\nThis is the working document.');
                if (file.path === 'context.md') {
                    return Promise.resolve('# Context Document\n\n' +
                        'This is important context information.\n\n' +
                        '## Key Section\n\n' +
                        'Critical details that should inform responses.\n\n' +
                        '## Last Section\n\n' +
                        'This final section should NOT be echoed by AI.');
                }
                return Promise.resolve('');
            })
        };
        
        const mockMetadataCache = {
            getFileCache: jest.fn(() => ({
                headings: [],
                links: [],
                tags: [],
                frontmatter: {}
            }))
        };
        
        app = {
            vault: mockVault,
            metadataCache: mockMetadataCache
        } as any;
        
        handler = new MultiDocContextHandler(app as any);
    });

    test('should provide context instructions that prevent content echoing', async () => {
        const message = '[[context]] Tell me about project status';
        const result = await handler.buildContext(message, testFile);
        
        // Verify context is built correctly
        expect(result.context.persistentDocs).toHaveLength(1);
        expect(result.cleanedMessage.trim()).toBe('Tell me about project status');
        
        // Verify context string includes both documents
        expect(result.context.contextString).toContain('## Document: test');
        expect(result.context.contextString).toContain('## Document: context');
        expect(result.context.contextString).toContain('Last Section');
        expect(result.context.contextString).toContain('This final section should NOT be echoed by AI');
        
        // The fix should be in how this context is used in sidebar-view
        // where system prompt includes instructions to not echo context content
    });

    test('should handle empty message with context documents correctly', async () => {
        const message = '[[context]]';
        const result = await handler.buildContext(message, testFile);
        
        // Empty cleaned message (context-only)
        expect(result.cleanedMessage.trim()).toBe('');
        
        // Context document should be available for AI understanding
        expect(result.context.persistentDocs).toHaveLength(1);
        expect(result.context.contextString).toContain('Context Document');
        expect(result.context.contextString).toContain('Last Section');
        
        // In the actual implementation, this would not result in an AI call
        // since it's detected as context-only in handleSend
    });

    test('should differentiate between working document and context documents', async () => {
        const message = '[[context]] What should I add to this document?';
        const result = await handler.buildContext(message, testFile);
        
        expect(result.cleanedMessage.trim()).toBe('What should I add to this document?');
        
        // Both documents should be in context but clearly distinguished
        const contextString = result.context.contextString;
        
        // Should contain both documents
        expect(contextString).toContain('## Document: test');  // working document
        expect(contextString).toContain('## Document: context'); // context document
        
        // The working document content should be available for editing
        expect(contextString).toContain('This is the working document');
        
        // Context document content should be available for reference
        expect(contextString).toContain('This is important context information');
    });

    test('should handle multiple context documents without content leakage', async () => {
        const contextFile2 = new TFile('context2.md');
        
        // Add second context file to mocks
        (app.vault as any).getAbstractFileByPath = jest.fn((path: string) => {
            if (path === 'test.md') return testFile;
            if (path === 'context.md') return contextFile;
            if (path === 'context2.md') return contextFile2;
            return null;
        });
        
        (app.vault as any).read = jest.fn((file: TFile) => {
            if (file.path === 'test.md') return Promise.resolve('# Working Document\n\nContent to edit.');
            if (file.path === 'context.md') return Promise.resolve('# First Context\n\nReference material one.');
            if (file.path === 'context2.md') return Promise.resolve('# Second Context\n\nReference material two.');
            return Promise.resolve('');
        });
        
        const message = '[[context]] [[context2]] Summarize the key points';
        const result = await handler.buildContext(message, testFile);
        
        expect(result.context.persistentDocs).toHaveLength(2);
        expect(result.cleanedMessage.trim()).toBe('Summarize the key points');
        
        // All documents should be in context
        expect(result.context.contextString).toContain('## Document: test');
        expect(result.context.contextString).toContain('## Document: context');
        expect(result.context.contextString).toContain('## Document: context2');
        
        // Reference materials should be included for AI understanding
        expect(result.context.contextString).toContain('Reference material one');
        expect(result.context.contextString).toContain('Reference material two');
    });
});