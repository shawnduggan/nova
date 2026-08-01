/**
 * Test suite for MetadataCommand
 */

import { App, TFile } from 'obsidian';
import { MetadataCommand } from '../../../src/core/commands/metadata-command';
import { createMockTFile } from '../../test-utils';
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
    let writtenFrontmatter: Record<string, unknown> | null;

    beforeEach(() => {
        writtenFrontmatter = null;
        mockApp = {
            workspace: {
                getActiveFile: jest.fn(() => mockDocumentEngine.getDocumentContext()?.file ?? null)
            },
            metadataCache: {
                getFileCache: jest.fn(() => ({ frontmatter: writtenFrontmatter ?? {} }))
            },
            fileManager: {
                processFrontMatter: jest.fn(async (_file, update) => {
                    const frontmatter = { ...(writtenFrontmatter ?? {}) };
                    update(frontmatter);
                    writtenFrontmatter = frontmatter;
                })
            }
        } as any;

        const mockEditor = {
            setValue: jest.fn()
        };

        mockDocumentEngine = new DocumentEngine(mockApp as any, {} as any) as jest.Mocked<DocumentEngine>;
        mockDocumentEngine.getActiveEditor = jest.fn().mockReturnValue(mockEditor);
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
            file: createMockTFile('test.md', 'test.md'),
            filename: 'test',
            content: '# Test Content\nSome content here.',
            headings: [],
            selectedText: undefined,
            cursorPosition: undefined,
            surroundingLines: undefined
        };

        beforeEach(() => {
            mockDocumentEngine.getDocumentContext.mockReturnValue(mockDocumentContext);
            mockDocumentEngine.getConversationContext.mockReturnValue('');
            mockContextBuilder.buildPrompt.mockReturnValue({
                systemPrompt: 'System prompt',
                userPrompt: 'User prompt',
                context: 'Context',
                config: { temperature: 0.7, maxTokens: 1000 }
            });
            mockContextBuilder.validatePrompt.mockReturnValue({ valid: true, issues: [] });
        });

        it('should successfully update metadata with valid AI response', async () => {
            const aiResponse = '{"title": "Test Document", "tags": ["work", "important"], "date": "2025-01-01"}';
            mockProviderManager.complete.mockResolvedValue(aiResponse);

            const result = await metadataCommand.execute(mockCommand);

            expect(result.success).toBe(true);
            expect(mockProviderManager.complete).toHaveBeenCalled();
            expect(mockApp.fileManager.processFrontMatter).toHaveBeenCalledWith(
                mockDocumentContext.file,
                expect.any(Function)
            );
            expect(mockDocumentEngine.getActiveEditor).not.toHaveBeenCalled();
            expect(writtenFrontmatter).toEqual({
                title: 'Test Document',
                tags: ['work', 'important'],
                date: '2025-01-01'
            });
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
            mockDocumentEngine.getDocumentContext.mockReturnValue(null);

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

        it('should not apply an AI response after the active document changes', async () => {
            const otherFile = createMockTFile('other.md', 'other.md');
            (mockApp.workspace.getActiveFile as jest.Mock).mockReturnValue(otherFile);
            mockProviderManager.complete.mockResolvedValue('{"status":"published"}');

            const result = await metadataCommand.execute(mockCommand);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Active document changed');
            expect(mockApp.fileManager.processFrontMatter).not.toHaveBeenCalled();
        });
    });

    describe('applyMetadataUpdates', () => {
        it('should create fields when frontmatter is empty', () => {
            const frontmatter: Record<string, unknown> = {};

            (metadataCommand as any).applyMetadataUpdates(frontmatter, { title: 'Test', tags: ['test'] });

            expect(frontmatter).toEqual({ title: 'Test', tags: ['test'] });
        });

        it('should preserve existing key casing and unrelated nested values', () => {
            const nested = { audience: ['writers'], flags: { reviewed: true } };
            const frontmatter: Record<string, unknown> = {
                Title: 'Old Title',
                status: 'draft',
                details: nested
            };

            (metadataCommand as any).applyMetadataUpdates(frontmatter, {
                title: 'New Title',
                tags: ['updated']
            });

            expect(frontmatter).toEqual({
                Title: 'New Title',
                status: 'draft',
                details: nested,
                tags: ['updated']
            });
        });

        it('should delete null fields and reject protected field changes', () => {
            const frontmatter: Record<string, unknown> = {
                title: 'Test',
                status: 'draft',
                created: '2025-01-01'
            };

            (metadataCommand as any).applyMetadataUpdates(frontmatter, {
                title: 'Updated',
                status: null,
                created: 'replaced'
            });

            expect(frontmatter).toEqual({ title: 'Updated', created: '2025-01-01' });
        });

        it('should not create duplicates when parsing quoted property names', () => {
            const frontmatter: Record<string, unknown> = { tags: ['existing'], status: 'draft' };
            const aiResponse = '"tags": ["updated", "work"]\n"status": "published"';
            const updates = (metadataCommand as any).parsePropertyUpdates(aiResponse);

            (metadataCommand as any).applyMetadataUpdates(frontmatter, updates);

            expect(frontmatter).toEqual({ tags: ['updated', 'work'], status: 'published' });
            expect(Object.keys(frontmatter)).toEqual(['tags', 'status']);
        });

        it('should handle direct JSON response without code blocks', () => {
            const frontmatter: Record<string, unknown> = { alias: '', tags: [], type: '', status: '' };
            const aiResponse = '{"tags": ["Canada", "Maritime provinces", "Nova Scotia", "Geography", "History"], "type": "reference", "status": "complete"}';
            const updates = (metadataCommand as any).parsePropertyUpdates(aiResponse);

            expect(updates).not.toBeNull();
            expect(updates.tags).toEqual(["canada", "maritime-provinces", "nova-scotia", "geography", "history"]);
            expect(updates.type).toBe("reference");
            expect(updates.status).toBe("complete");

            (metadataCommand as any).applyMetadataUpdates(frontmatter, updates);

            expect(frontmatter).toEqual({
                alias: '',
                tags: ['canada', 'maritime-provinces', 'nova-scotia', 'geography', 'history'],
                type: 'reference',
                status: 'complete'
            });
        });
    });

    describe('normalizeTagValue', () => {
        it('should handle special characters in tags for Obsidian compatibility', () => {
            // Access the private method through any
            const normalize = (tag: string) => (metadataCommand as any).normalizeTagValue(tag);

            // Test apostrophes (both straight and curly)
            expect(normalize("mi'kmaq")).toBe("mikmaq");
            expect(normalize("don't")).toBe("dont");
            expect(normalize("user's")).toBe("users");
            expect(normalize("we're")).toBe("were");

            // Test periods
            expect(normalize("user.guide")).toBe("user-guide");
            expect(normalize("v1.0.2")).toBe("v1-0-2");

            // Test spaces (existing behavior should still work)
            expect(normalize("tag with spaces")).toBe("tag-with-spaces");

            // Test multiple special characters
            expect(normalize("user's.guide")).toBe("users-guide");
            expect(normalize("test@email.com")).toBe("testemail-com");

            // Test symbols and punctuation
            expect(normalize("C++")).toBe("c");
            expect(normalize("tag!")).toBe("tag");
            expect(normalize("test$tag")).toBe("testtag");
            expect(normalize("tag&more")).toBe("tagmore");

            // Test multiple hyphens
            expect(normalize("multi---dash")).toBe("multi-dash");
            expect(normalize("test--tag")).toBe("test-tag");

            // Test leading/trailing hyphens
            expect(normalize("-leading")).toBe("leading");
            expect(normalize("trailing-")).toBe("trailing");
            expect(normalize("-both-")).toBe("both");

            // Test valid characters should be preserved
            expect(normalize("valid_tag")).toBe("valid_tag");
            expect(normalize("nested/tag")).toBe("nested/tag");
            expect(normalize("tag-with-hyphens")).toBe("tag-with-hyphens");
            expect(normalize("TAG123")).toBe("tag123");

            // Test edge cases
            expect(normalize("")).toBe("");
            expect(normalize("   ")).toBe("");
            expect(normalize("---")).toBe("");
            expect(normalize("!@#$%")).toBe("");

            // Test real-world indigenous language examples
            expect(normalize("Mi'kmaq")).toBe("mikmaq");
            expect(normalize("Anishinaabe")).toBe("anishinaabe");
            expect(normalize("Haudenosaunee")).toBe("haudenosaunee");
        });
    });
});
