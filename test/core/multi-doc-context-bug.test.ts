/**
 * Test for context-only mode bug where LLM outputs last section
 * when adding document without text selection
 */

import { expect } from '@jest/globals';
import { App, TFile } from '../mocks/obsidian-mock';
import { MultiDocContextHandler } from '../../src/core/multi-doc-context';

describe('MultiDocContextHandler - Context-Only Bug', () => {
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
                if (file.path === 'test.md') return Promise.resolve('Current document content');
                if (file.path === 'context.md') {
                    return Promise.resolve('# Document Title\n\n' +
                        'Some content in first section.\n\n' +
                        '## Second Section\n\n' +
                        'Content in second section.\n\n' +
                        '## Last Section\n\n' +
                        'This is the last section content that should not be output by AI.');
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

    test('should build context without outputting document content directly', async () => {
        // Simulate adding a document as context-only
        const message = '[[context]]';
        
        const result = await handler.buildContext(message, testFile);
        
        // The cleaned message should be empty (just context reference removed)
        expect(result.cleanedMessage.trim()).toBe('');
        
        // Context should include the document
        expect(result.context.persistentDocs).toHaveLength(1);
        expect(result.context.persistentDocs[0].file.basename).toBe('context');
        
        // Context string should include document structure but be marked as context-only
        expect(result.context.contextString).toContain('## Document: context');
        expect(result.context.contextString).toContain('Last Section');
        
        // The key issue: when AI receives this context, it should understand
        // these are reference documents, not content to output
    });

    test('should differentiate between context documents and target documents', async () => {
        // Add a document as context
        const contextMessage = '[[context]]';
        await handler.buildContext(contextMessage, testFile);
        
        // Then send a regular message
        const queryMessage = 'What is this document about?';
        const result = await handler.buildContext(queryMessage, testFile);
        
        // Context should still include the persistent document
        expect(result.context.persistentDocs).toHaveLength(1);
        expect(result.cleanedMessage).toBe(queryMessage);
        
        // The context string should clearly identify which is the working document
        // vs context documents
        expect(result.context.contextString).toContain('## Document: test'); // working document
        expect(result.context.contextString).toContain('## Document: context'); // context document
    });

    test('should handle multiple context documents', async () => {
        const contextFile2 = new TFile('context2.md');
        
        // Update mocks to include the second file
        (app.vault as any).getAbstractFileByPath = jest.fn((path: string) => {
            if (path === 'test.md') return testFile;
            if (path === 'context.md') return contextFile;
            if (path === 'context2.md') return contextFile2;
            return null;
        });
        
        (app.vault as any).read = jest.fn((file: TFile) => {
            if (file.path === 'test.md') return Promise.resolve('Current document content');
            if (file.path === 'context.md') {
                return Promise.resolve('# Document Title\n\nContent from first context file.');
            }
            if (file.path === 'context2.md') {
                return Promise.resolve('# Another Document\n\nWith different content.');
            }
            return Promise.resolve('');
        });
        
        (app.vault as any).getMarkdownFiles = jest.fn(() => [testFile, contextFile, contextFile2]);
        
        const message = '[[context]] [[context2]]';
        const result = await handler.buildContext(message, testFile);
        
        expect(result.context.persistentDocs).toHaveLength(2);
        expect(result.cleanedMessage.trim()).toBe('');
        
        // Both context documents should be included
        expect(result.context.contextString).toContain('## Document: context');
        expect(result.context.contextString).toContain('## Document: context2');
    });

    test('should remove stale references gracefully', async () => {
        // Add context document first
        const message = '[[context]]';
        await handler.buildContext(message, testFile);
        
        // "Remove" the context file by making it return null
        (app.vault as any).getAbstractFileByPath = jest.fn((path: string) => {
            if (path === 'context.md') return null;
            return path === 'test.md' ? testFile : null;
        });
        
        // Try to build context again - should handle stale reference
        const result = await handler.buildContext('What about now?', testFile);
        
        // Stale reference should be filtered out
        expect(result.context.persistentDocs).toHaveLength(0);
        expect(result.context.contextString).not.toContain('## Document: context');
    });
});