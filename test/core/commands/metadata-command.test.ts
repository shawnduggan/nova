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

// Helper function to create properly typed mock files
function createMockFile(props: Partial<TFile>): TFile {
    const mockFile: TFile = props as TFile;
    return mockFile;
}

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
            file: createMockFile({ path: 'test.md', basename: 'test' }),
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
        });

        it('should successfully update metadata with valid AI response', async () => {
            const aiResponse = '{"title": "Test Document", "tags": ["work", "important"], "date": "2025-01-01"}';
            mockProviderManager.complete.mockResolvedValue(aiResponse);

            const result = await metadataCommand.execute(mockCommand);

            expect(result.success).toBe(true);
            expect(mockProviderManager.complete).toHaveBeenCalled();
            expect(mockDocumentEngine.getActiveEditor).toHaveBeenCalled();
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
        it('should create frontmatter for non-existing frontmatter (correct behavior for metadata operations)', () => {
            const content = '# Test Document\nSome content here.';
            const updates = { title: 'Test', tags: ['test'] };
            
            // Access the private method through any
            const result = (metadataCommand as any).updateFrontmatter(content, updates);
            
            // Should create new frontmatter when none exists
            expect(result).toContain('---\ntitle: Test\ntags: ["test"]\n---');
            expect(result).toContain('# Test Document\nSome content here.');
        });

        it('should return original content when no updates provided and no frontmatter exists', () => {
            const content = '# Test Document\nSome content here.';
            const updates = {};
            
            // Access the private method through any
            const result = (metadataCommand as any).updateFrontmatter(content, updates);
            
            // Should return original content when no updates to apply
            expect(result).toBe(content);
        });

        it('should update existing fields and add new non-protected fields (correct behavior)', () => {
            const content = '---\ntitle: Old Title\nstatus: draft\n---\n# Test Document\nContent here.';
            const updates = { title: 'New Title', tags: ['updated'] };
            
            const result = (metadataCommand as any).updateFrontmatter(content, updates);
            
            expect(result).toContain('title: New Title'); // Updated existing field
            expect(result).toContain('tags: ["updated"]'); // Added new field (now allowed)
            expect(result).toContain('status: draft'); // Preserved existing
        });

        it('should handle null values for property deletion', () => {
            const content = '---\ntitle: Test\nstatus: draft\n---\n# Document';
            const updates = { title: 'Updated', status: null };
            
            const result = (metadataCommand as any).updateFrontmatter(content, updates);
            
            expect(result).toContain('title: Updated');
            expect(result).not.toContain('status:'); // Should be removed
        });

        it('should not create duplicates when parsing quoted property names', () => {
            const content = '---\ntags: ["existing"]\nstatus: draft\n---\n# Document';
            
            // Simulate AI response with quoted key names
            const aiResponse = '"tags": ["updated", "work"]\n"status": "published"';
            const updates = (metadataCommand as any).parsePropertyUpdates(aiResponse);
            
            const result = (metadataCommand as any).updateFrontmatter(content, updates);
            
            // Should not have both `tags:` and `"tags":` in the result
            const tagMatches = result.match(/tags:/g);
            expect(tagMatches).toHaveLength(1); // Only one tags field
            
            const statusMatches = result.match(/status:/g);
            expect(statusMatches).toHaveLength(1); // Only one status field
            
            expect(result).toContain('tags: ["updated","work"]');
            expect(result).toContain('status: published');
        });

        it('should handle direct JSON response without code blocks', () => {
            const content = '---\nalias: \ntags: []\ntype: \nstatus: \n---\n# Document';
            
            // Simulate direct JSON AI response (the problematic case)
            const aiResponse = '{"tags": ["Canada", "Maritime provinces", "Nova Scotia", "Geography", "History"], "type": "reference", "status": "complete"}';
            const updates = (metadataCommand as any).parsePropertyUpdates(aiResponse);
            
            expect(updates).not.toBeNull();
            expect(updates.tags).toEqual(["canada", "maritime-provinces", "nova-scotia", "geography", "history"]);
            expect(updates.type).toBe("reference");
            expect(updates.status).toBe("complete");
            
            const result = (metadataCommand as any).updateFrontmatter(content, updates);
            
            // Should properly update the frontmatter without duplicates
            expect(result).toContain('tags: ["canada","maritime-provinces","nova-scotia","geography","history"]');
            expect(result).toContain('type: reference');
            expect(result).toContain('status: complete');
            
            // Should not contain the raw JSON object
            expect(result).not.toContain('{"tags":');
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