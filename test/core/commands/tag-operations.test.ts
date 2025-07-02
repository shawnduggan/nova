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
        const mockFileData = { path: 'test.md', basename: 'test' };
        const mockFile: TFile = mockFileData as TFile;

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
        const mockFileData = { path: 'test.md', basename: 'test' };
        const mockFile: TFile = mockFileData as TFile;

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

    describe('Tag Space Normalization', () => {
        const mockFileData = { path: 'test.md', basename: 'test' };
        const mockFile: TFile = mockFileData as TFile;

        beforeEach(() => {
            mockDocumentEngine.getDocumentContext.mockResolvedValue({
                file: mockFile,
                filename: 'test',
                content: '---\ntags: []\n---\n# Test Document',
                headings: [],
                selectedText: undefined,
                cursorPosition: undefined,
                surroundingLines: undefined
            });
            
            // Setup mocks for AI-powered operations
            mockDocumentEngine.getConversationContext.mockReturnValue('');
            mockContextBuilder.buildPrompt.mockReturnValue({
                systemPrompt: 'System prompt',
                userPrompt: 'User prompt',
                context: 'Context',
                config: { temperature: 0.7, maxTokens: 1000 }
            });
            mockContextBuilder.validatePrompt.mockReturnValue({ valid: true, issues: [] });
            mockApp.vault.modify = jest.fn().mockResolvedValue(undefined);
        });

        it('should normalize spaces to hyphens in direct tag operations', async () => {
            const command: EditCommand = {
                action: 'metadata',
                target: 'document',
                instruction: 'add tags: machine learning, data science, artificial intelligence',
                context: undefined
            };

            const result = await metadataCommand.execute(command);

            expect(result.success).toBe(true);
            expect(mockApp.vault.modify).toHaveBeenCalledWith(
                mockFile,
                expect.stringContaining('tags: ["machine-learning","data-science","artificial-intelligence"]')
            );
        });

        it('should normalize spaces to hyphens in set tag operations', async () => {
            const command: EditCommand = {
                action: 'metadata',
                target: 'document', 
                instruction: 'set tags: React Component, Best Practices, Web Development',
                context: undefined
            };

            const result = await metadataCommand.execute(command);

            expect(result.success).toBe(true);
            expect(mockApp.vault.modify).toHaveBeenCalledWith(
                mockFile,
                expect.stringContaining('tags: ["react-component","best-practices","web-development"]')
            );
        });

        it('should normalize spaces in AI tag suggestions', async () => {
            const documentContext = {
                file: mockFile,
                filename: 'test',
                content: '---\ntags: []\n---\n# Machine Learning Tutorial',
                headings: [],
                selectedText: undefined,
                cursorPosition: undefined,
                surroundingLines: undefined
            };

            mockDocumentEngine.getDocumentContext.mockResolvedValue(documentContext);

            // AI returns tags with spaces
            const aiResponse = '{"tags": ["Machine Learning", "Artificial Intelligence", "Deep Learning", "Neural Networks"]}';
            mockProviderManager.complete.mockResolvedValue(aiResponse);

            const command: EditCommand = {
                action: 'metadata',
                target: 'document',
                instruction: 'add suggested tags',
                context: undefined
            };

            const result = await metadataCommand.execute(command);

            expect(result.success).toBe(true);
            expect(mockApp.vault.modify).toHaveBeenCalledWith(
                mockFile,
                expect.stringContaining('tags: ["machine-learning","artificial-intelligence","deep-learning","neural-networks"]')
            );
        });

        it('should normalize spaces in general metadata updates', async () => {
            const documentContext = {
                file: mockFile,
                filename: 'test',
                content: '---\ntags: []\ntype: article\n---\n# Test Document',
                headings: [],
                selectedText: undefined,
                cursorPosition: undefined,
                surroundingLines: undefined
            };

            mockDocumentEngine.getDocumentContext.mockResolvedValue(documentContext);

            // AI returns metadata with spaces in tags
            const aiResponse = '{"tags": ["React Native", "Mobile Development"], "type": "tutorial"}';
            mockProviderManager.complete.mockResolvedValue(aiResponse);

            const command: EditCommand = {
                action: 'metadata',
                target: 'document',
                instruction: 'update frontmatter with new values',
                context: undefined
            };

            const result = await metadataCommand.execute(command);

            expect(result.success).toBe(true);
            expect(mockApp.vault.modify).toHaveBeenCalledWith(
                mockFile,
                expect.stringContaining('tags: ["react-native","mobile-development"]')
            );
        });

        it('should normalize spaces in YAML-like AI responses', async () => {
            const documentContext = {
                file: mockFile,
                filename: 'test', 
                content: '---\ntags: []\n---\n# Test Document',
                headings: [],
                selectedText: undefined,
                cursorPosition: undefined,
                surroundingLines: undefined
            };

            mockDocumentEngine.getDocumentContext.mockResolvedValue(documentContext);

            // AI returns YAML-like format with spaces in tags
            const aiResponse = 'tags: ["Vue Components", "Frontend Development", "User Interface"]';
            mockProviderManager.complete.mockResolvedValue(aiResponse);

            const command: EditCommand = {
                action: 'metadata',
                target: 'document',
                instruction: 'update frontmatter with new values',
                context: undefined
            };

            const result = await metadataCommand.execute(command);

            expect(result.success).toBe(true);
            expect(mockApp.vault.modify).toHaveBeenCalledWith(
                mockFile,
                expect.stringContaining('tags: ["vue-components","frontend-development","user-interface"]')
            );
        });

        it('should handle multiple spaces and mixed case', async () => {
            const command: EditCommand = {
                action: 'metadata',
                target: 'document',
                instruction: 'add tags: Machine   Learning, Data     Science, AI   Research',
                context: undefined
            };

            const result = await metadataCommand.execute(command);

            expect(result.success).toBe(true);
            expect(mockApp.vault.modify).toHaveBeenCalledWith(
                mockFile,
                expect.stringContaining('tags: ["machine-learning","data-science","ai-research"]')
            );
        });

        it('should preserve tags without spaces unchanged', async () => {
            const command: EditCommand = {
                action: 'metadata',
                target: 'document',
                instruction: 'add tags: javascript, react, vue',
                context: undefined
            };

            const result = await metadataCommand.execute(command);

            expect(result.success).toBe(true);
            expect(mockApp.vault.modify).toHaveBeenCalledWith(
                mockFile,
                expect.stringContaining('tags: ["javascript","react","vue"]')
            );
        });

        it('should route "update metadata" to general metadata flow, not tag-only', async () => {
            const documentContext = {
                file: mockFile,
                filename: 'test',
                content: '---\ntags: ["old-tag"]\ntype: draft\nstatus: pending\n---\n# Test Document',
                headings: [],
                selectedText: undefined,
                cursorPosition: undefined,
                surroundingLines: undefined
            };

            mockDocumentEngine.getDocumentContext.mockResolvedValue(documentContext);

            // AI returns all properties including tags, type, and status
            const aiResponse = '{"tags": ["updated tag", "new content"], "type": "article", "status": "published", "priority": "high"}';
            mockProviderManager.complete.mockResolvedValue(aiResponse);

            const command: EditCommand = {
                action: 'metadata',
                target: 'document',
                instruction: 'update metadata',
                context: undefined
            };

            const result = await metadataCommand.execute(command);

            expect(result.success).toBe(true);
            
            // Should update ALL properties, not just tags
            expect(mockApp.vault.modify).toHaveBeenCalledWith(
                mockFile,
                expect.stringMatching(/tags:\s*\["updated-tag","new-content"\]/)
            );
            expect(mockApp.vault.modify).toHaveBeenCalledWith(
                mockFile,
                expect.stringContaining('type: article')
            );
            expect(mockApp.vault.modify).toHaveBeenCalledWith(
                mockFile,
                expect.stringContaining('status: published')
            );
            expect(mockApp.vault.modify).toHaveBeenCalledWith(
                mockFile,
                expect.stringContaining('priority: high')
            );
        });
    });
});