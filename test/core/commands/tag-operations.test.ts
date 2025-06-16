/**
 * Test suite for tag operations in MetadataCommand
 */

import { App, TFile } from 'obsidian';
import { MetadataCommand } from '../../../src/core/commands/metadata-command';
import { DocumentEngine } from '../../../src/core/document-engine';
import { ContextBuilder } from '../../../src/core/context-builder';
import { AIProviderManager } from '../../../src/ai/provider-manager';
import { EditCommand } from '../../../src/core/types';

// Mock the dependencies
jest.mock('../../../src/core/document-engine');
jest.mock('../../../src/core/context-builder');
jest.mock('../../../src/ai/provider-manager');

describe('Tag Operations', () => {
    let metadataCommand: MetadataCommand;
    let mockApp: jest.Mocked<App>;
    let mockDocumentEngine: jest.Mocked<DocumentEngine>;
    let mockContextBuilder: jest.Mocked<ContextBuilder>;
    let mockProviderManager: jest.Mocked<AIProviderManager>;

    beforeEach(() => {
        mockApp = {
            vault: {
                modify: jest.fn()
            }
        } as any;

        mockDocumentEngine = new DocumentEngine(mockApp as any, {} as any) as jest.Mocked<DocumentEngine>;
        mockContextBuilder = new ContextBuilder() as jest.Mocked<ContextBuilder>;
        mockProviderManager = new AIProviderManager({} as any, {} as any) as jest.Mocked<AIProviderManager>;

        metadataCommand = new MetadataCommand(mockApp, mockDocumentEngine, mockContextBuilder, mockProviderManager);
    });

    describe('Direct tag operations', () => {
        const mockFile = { path: 'test.md', basename: 'test' } as TFile;

        it('should add tags without duplicates', async () => {
            const documentContext = {
                file: mockFile,
                filename: 'test',
                content: '---\ntags: ["existing-tag"]\n---\n# Test Content',
                headings: [],
                selectedText: undefined,
                cursorPosition: undefined,
                surroundingLines: undefined
            };

            mockDocumentEngine.getDocumentContext.mockResolvedValue(documentContext);

            const command: EditCommand = {
                action: 'metadata',
                target: 'document',
                instruction: 'Add tags: research, important, existing-tag',
                context: undefined
            };

            const result = await metadataCommand.execute(command);

            expect(result.success).toBe(true);
            expect(result.successMessage).toBe('Added 2 tags: research, important');
            expect(mockApp.vault.modify).toHaveBeenCalledWith(
                mockFile,
                expect.stringContaining('tags: ["existing-tag","research","important"]')
            );
        });

        it('should remove tags case-insensitively', async () => {
            const documentContext = {
                file: mockFile,
                filename: 'test',
                content: '---\ntags: ["Research", "important", "draft"]\n---\n# Test Content',
                headings: [],
                selectedText: undefined,
                cursorPosition: undefined,
                surroundingLines: undefined
            };

            mockDocumentEngine.getDocumentContext.mockResolvedValue(documentContext);

            const command: EditCommand = {
                action: 'metadata',
                target: 'document',
                instruction: 'Remove tags: research, DRAFT',
                context: undefined
            };

            const result = await metadataCommand.execute(command);

            expect(result.success).toBe(true);
            expect(result.successMessage).toBe('Removed 2 tags');
            expect(mockApp.vault.modify).toHaveBeenCalledWith(
                mockFile,
                expect.stringContaining('tags: ["important"]')
            );
        });

        it('should set/replace all tags', async () => {
            const documentContext = {
                file: mockFile,
                filename: 'test',
                content: '---\ntags: ["old-tag1", "old-tag2"]\n---\n# Test Content',
                headings: [],
                selectedText: undefined,
                cursorPosition: undefined,
                surroundingLines: undefined
            };

            mockDocumentEngine.getDocumentContext.mockResolvedValue(documentContext);

            const command: EditCommand = {
                action: 'metadata',
                target: 'document',
                instruction: 'Set tags: new-tag1, new-tag2',
                context: undefined
            };

            const result = await metadataCommand.execute(command);

            expect(result.success).toBe(true);
            expect(result.successMessage).toBe('Set 2 tags');
            expect(mockApp.vault.modify).toHaveBeenCalledWith(
                mockFile,
                expect.stringContaining('tags: ["new-tag1","new-tag2"]')
            );
        });

        it('should create frontmatter if missing when adding tags', async () => {
            const documentContext = {
                file: mockFile,
                filename: 'test',
                content: '# Test Document\nNo frontmatter here.',
                headings: [],
                selectedText: undefined,
                cursorPosition: undefined,
                surroundingLines: undefined
            };

            mockDocumentEngine.getDocumentContext.mockResolvedValue(documentContext);

            const command: EditCommand = {
                action: 'metadata',
                target: 'document',
                instruction: 'Add tags: test, example',
                context: undefined
            };

            const result = await metadataCommand.execute(command);

            expect(result.success).toBe(true);
            expect(result.successMessage).toBe('Added 2 tags: test, example');
            expect(mockApp.vault.modify).toHaveBeenCalledWith(
                mockFile,
                expect.stringContaining('---\ntags: ["test","example"]\n---\n')
            );
        });
    });

    describe('AI-powered tag operations', () => {
        const mockFile = { path: 'test.md', basename: 'test' } as TFile;

        beforeEach(() => {
            mockContextBuilder.buildPrompt.mockReturnValue({
                systemPrompt: 'System prompt',
                userPrompt: 'User prompt',
                context: 'Context',
                config: { temperature: 0.7, maxTokens: 1000 }
            });
            mockContextBuilder.validatePrompt.mockReturnValue({ valid: true, issues: [] });
        });

        it('should handle AI parsing errors gracefully', async () => {
            const documentContext = {
                file: mockFile,
                filename: 'test',
                content: '# New Document\nThis is a new document without tags.',
                headings: [],
                selectedText: undefined,
                cursorPosition: undefined,
                surroundingLines: undefined
            };

            mockDocumentEngine.getDocumentContext.mockResolvedValue(documentContext);

            // AI returns unparseable response
            const aiResponse = 'I cannot determine appropriate tags for this document.';
            mockProviderManager.complete.mockResolvedValue(aiResponse);

            const command: EditCommand = {
                action: 'metadata',
                target: 'document',
                instruction: 'add tags',
                context: undefined
            };

            const result = await metadataCommand.execute(command);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Could not parse AI tag suggestions');
            expect(result.error).toContain('I cannot determine appropriate tags');
        });

        it('should treat "add tags" (no colon) as AI suggestion', async () => {
            const documentContext = {
                file: mockFile,
                filename: 'test',
                content: '---\ntags: ["programming"]\n---\n# React Performance Optimization\nThis guide covers React hooks, memoization, and virtual DOM optimization techniques.',
                headings: [],
                selectedText: undefined,
                cursorPosition: undefined,
                surroundingLines: undefined
            };

            mockDocumentEngine.getDocumentContext.mockResolvedValue(documentContext);

            const aiResponse = '{"tags": ["programming", "react", "performance", "optimization", "hooks", "memoization"], "reasoning": "Added React-specific tags"}';
            mockProviderManager.complete.mockResolvedValue(aiResponse);

            const command: EditCommand = {
                action: 'metadata',
                target: 'document',
                instruction: 'add tags',  // No colon, no specific tags
                context: undefined
            };

            const result = await metadataCommand.execute(command);

            expect(result.success).toBe(true);
            expect(result.successMessage).toContain('Added');
            expect(result.successMessage).toContain('suggested tag');
            expect(mockProviderManager.complete).toHaveBeenCalled();
            
            // Verify AI was asked to analyze the document
            const aiCall = mockProviderManager.complete.mock.calls[0];
            expect(aiCall[1]).toContain('React Performance Optimization');
            expect(aiCall[1]).toContain('DOCUMENT TO ANALYZE');
        });

        it('should add suggested tags based on content', async () => {
            const documentContext = {
                file: mockFile,
                filename: 'test',
                content: '---\ntags: ["existing"]\n---\n# Machine Learning Tutorial\nThis document covers neural networks and deep learning.',
                headings: [],
                selectedText: undefined,
                cursorPosition: undefined,
                surroundingLines: undefined
            };

            mockDocumentEngine.getDocumentContext.mockResolvedValue(documentContext);

            const aiResponse = '{"tags": ["existing", "machine-learning", "neural-networks", "deep-learning", "ai"], "reasoning": "Added ML-related tags"}';
            mockProviderManager.complete.mockResolvedValue(aiResponse);

            const command: EditCommand = {
                action: 'metadata',
                target: 'document',
                instruction: 'add suggested tags',
                context: undefined
            };

            const result = await metadataCommand.execute(command);

            expect(result.success).toBe(true);
            expect(result.successMessage).toBe('Added 4 suggested tags: machine-learning, neural-networks, deep-learning, ai');
        });

        it('should clean up tags', async () => {
            const documentContext = {
                file: mockFile,
                filename: 'test',
                content: '---\ntags: ["JavaScript", "JS", "javascript", "node.js", "NodeJS"]\n---\n# Content',
                headings: [],
                selectedText: undefined,
                cursorPosition: undefined,
                surroundingLines: undefined
            };

            mockDocumentEngine.getDocumentContext.mockResolvedValue(documentContext);

            const aiResponse = '{"tags": ["javascript", "nodejs"], "reasoning": "Consolidated duplicate tags"}';
            mockProviderManager.complete.mockResolvedValue(aiResponse);

            const command: EditCommand = {
                action: 'metadata',
                target: 'document',
                instruction: 'clean up tags',
                context: undefined
            };

            const result = await metadataCommand.execute(command);

            expect(result.success).toBe(true);
            expect(result.successMessage).toBe('Cleaned up tags: 5 → 2 tags');
        });

        it('should optimize tags', async () => {
            const documentContext = {
                file: mockFile,
                filename: 'test',
                content: '---\ntags: ["code", "programming", "text", "document"]\n---\n# React Component Best Practices',
                headings: [],
                selectedText: undefined,
                cursorPosition: undefined,
                surroundingLines: undefined
            };

            mockDocumentEngine.getDocumentContext.mockResolvedValue(documentContext);

            const aiResponse = '{"tags": ["react", "javascript", "frontend", "best-practices", "components"], "reasoning": "More specific tags"}';
            mockProviderManager.complete.mockResolvedValue(aiResponse);

            const command: EditCommand = {
                action: 'metadata',
                target: 'document',
                instruction: 'optimize tags',
                context: undefined
            };

            const result = await metadataCommand.execute(command);

            expect(result.success).toBe(true);
            expect(result.successMessage).toBe('Optimized tags: 5 tags (was 4)');
        });
    });
});