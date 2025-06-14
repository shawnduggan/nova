/**
 * Test suite for MetadataCommand
 */

import { App, TFile } from 'obsidian';
import { MetadataCommand } from '../../../src/core/commands/metadata-command';
import { DocumentEngine } from '../../../src/core/document-engine';
import { ContextBuilder } from '../../../src/core/context-builder';
import { AIProviderManager } from '../../../src/ai/provider-manager';
import { EditCommand, DocumentContext } from '../../../src/core/types';

// Mock the dependencies
jest.mock('../../../src/core/document-engine');
jest.mock('../../../src/core/context-builder');
jest.mock('../../../src/ai/provider-manager');

describe('MetadataCommand', () => {
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

    describe('execute', () => {
        const mockCommand: EditCommand = {
            action: 'metadata',
            target: 'document',
            instruction: 'Set title to "Test Document" and add tags: work, important',
            context: undefined
        };

        const mockDocumentContext: DocumentContext = {
            file: { path: 'test.md', basename: 'test' } as TFile,
            filename: 'test',
            content: '# Test Content\nSome content here.',
            headings: [],
            selectedText: undefined,
            cursorPosition: undefined,
            surroundingLines: undefined
        };

        beforeEach(() => {
            mockDocumentEngine.getDocumentContext.mockResolvedValue(mockDocumentContext);
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

        it('should successfully update metadata with valid AI response', async () => {
            const aiResponse = '{"title": "Test Document", "tags": ["work", "important"], "date": "2025-01-01"}';
            mockProviderManager.complete.mockResolvedValue(aiResponse);

            const result = await metadataCommand.execute(mockCommand);

            expect(result.success).toBe(true);
            expect(mockProviderManager.complete).toHaveBeenCalled();
            expect(mockApp.vault.modify).toHaveBeenCalled();
        });

        it('should handle JSON response in code block', async () => {
            const aiResponse = '```json\n{"title": "Updated Title", "status": "draft"}\n```';
            mockProviderManager.complete.mockResolvedValue(aiResponse);

            const result = await metadataCommand.execute(mockCommand);

            expect(result.success).toBe(true);
        });

        it('should handle YAML-like response format', async () => {
            const aiResponse = 'title: My Document\ntags: ["test", "sample"]\ndate: 2025-01-01';
            mockProviderManager.complete.mockResolvedValue(aiResponse);

            const result = await metadataCommand.execute(mockCommand);

            expect(result.success).toBe(true);
        });

        it('should fail when no document context is available', async () => {
            mockDocumentEngine.getDocumentContext.mockResolvedValue(null);

            const result = await metadataCommand.execute(mockCommand);

            expect(result.success).toBe(false);
            expect(result.error).toBe('No active document found');
        });

        it('should fail when AI response has no parseable updates', async () => {
            const aiResponse = 'This is just text without any property updates.';
            mockProviderManager.complete.mockResolvedValue(aiResponse);

            const result = await metadataCommand.execute(mockCommand);

            expect(result.success).toBe(false);
            expect(result.error).toBe('No property updates found in AI response');
        });

        it('should fail on prompt validation error', async () => {
            mockContextBuilder.validatePrompt.mockReturnValue({
                valid: false,
                issues: ['Prompt too long']
            });

            const result = await metadataCommand.execute(mockCommand);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Prompt validation failed');
        });
    });

    describe('updateFrontmatter', () => {
        it('should add frontmatter to document without existing frontmatter', () => {
            const content = '# Test Document\nSome content here.';
            const updates = { title: 'Test', tags: ['test'] };
            
            // Access the private method through any
            const result = (metadataCommand as any).updateFrontmatter(content, updates);
            
            expect(result).toContain('---');
            expect(result).toContain('title: Test');
            expect(result).toContain('tags: ["test"]');
            expect(result).toContain('# Test Document');
        });

        it('should update existing frontmatter', () => {
            const content = '---\ntitle: Old Title\nstatus: draft\n---\n# Test Document\nContent here.';
            const updates = { title: 'New Title', tags: ['updated'] };
            
            const result = (metadataCommand as any).updateFrontmatter(content, updates);
            
            expect(result).toContain('title: New Title');
            expect(result).toContain('tags: ["updated"]');
            expect(result).toContain('status: draft'); // Preserved existing
        });

        it('should handle null values for property deletion', () => {
            const content = '---\ntitle: Test\nstatus: draft\n---\n# Document';
            const updates = { title: 'Updated', status: null };
            
            const result = (metadataCommand as any).updateFrontmatter(content, updates);
            
            expect(result).toContain('title: Updated');
            expect(result).not.toContain('status:'); // Should be removed
        });
    });
});