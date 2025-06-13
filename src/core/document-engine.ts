/**
 * Core document engine for Nova
 * Handles all document manipulation and editor interactions
 */

import { App, Editor, MarkdownView, TFile, EditorPosition, Notice } from 'obsidian';
import { DocumentContext, HeadingInfo, EditResult, EditOptions, DocumentSection, EditCommand } from './types';
import { ConversationManager, DataStore } from './conversation-manager';

export class DocumentEngine {
    private conversationManager: ConversationManager | null = null;

    constructor(private app: App, dataStore?: DataStore) {
        if (dataStore) {
            this.conversationManager = new ConversationManager(dataStore);
        }
    }

    /**
     * Set conversation manager (for dependency injection)
     */
    setConversationManager(conversationManager: ConversationManager): void {
        this.conversationManager = conversationManager;
    }

    /**
     * Get the active editor instance
     */
    getActiveEditor(): Editor | null {
        // First try the workspace method
        const activeEditor = this.app.workspace.activeEditor;
        if (activeEditor?.editor) {
            return activeEditor.editor;
        }
        
        // Try to get the active markdown view
        let view = this.app.workspace.getActiveViewOfType(MarkdownView);
        
        // If no active markdown view, try to find any markdown view
        if (!view) {
            const leaves = this.app.workspace.getLeavesOfType('markdown');
            for (const leaf of leaves) {
                const leafView = leaf.view;
                if (leafView instanceof MarkdownView) {
                    view = leafView;
                    break;
                }
            }
        }
        
        if (!view) {
            return null;
        }
        
        // Try different ways to get the editor
        const editor = view.editor;
        
        return editor || null;
    }

    /**
     * Get the active file
     */
    getActiveFile(): TFile | null {
        return this.app.workspace.getActiveFile();
    }

    /**
     * Get the currently selected text
     */
    getSelectedText(): string {
        const editor = this.getActiveEditor();
        if (!editor) return '';
        
        return editor.getSelection();
    }

    /**
     * Get the current cursor position
     */
    getCursorPosition(): EditorPosition | null {
        const editor = this.getActiveEditor();
        if (!editor) return null;
        
        return editor.getCursor();
    }

    /**
     * Extract comprehensive document context
     */
    async getDocumentContext(): Promise<DocumentContext | null> {
        const file = this.getActiveFile();
        const editor = this.getActiveEditor();
        
        if (!file || !editor) {
            return null;
        }

        const content = editor.getValue();
        const selectedText = this.getSelectedText();
        const cursorPosition = this.getCursorPosition();
        
        // Extract headings from the document
        const headings = this.extractHeadings(content);
        
        // Get surrounding lines for context
        const surroundingLines = cursorPosition ? 
            this.getSurroundingLines(content, cursorPosition.line) : 
            undefined;

        return {
            file,
            filename: file.basename,
            content,
            headings,
            selectedText: selectedText || undefined,
            cursorPosition: cursorPosition || undefined,
            surroundingLines
        };
    }

    /**
     * Extract headings from document content
     */
    private extractHeadings(content: string): HeadingInfo[] {
        const lines = content.split('\n');
        const headings: HeadingInfo[] = [];
        let charCount = 0;

        lines.forEach((line, index) => {
            const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
            if (headingMatch) {
                const level = headingMatch[1].length;
                const text = headingMatch[2];
                
                headings.push({
                    text,
                    level,
                    line: index,
                    position: {
                        start: charCount,
                        end: charCount + line.length
                    }
                });
            }
            
            // Add line length + newline character
            charCount += line.length + 1;
        });

        return headings;
    }

    /**
     * Get lines surrounding the cursor position
     */
    private getSurroundingLines(
        content: string, 
        currentLine: number, 
        contextSize: number = 5
    ): { before: string[]; after: string[] } {
        const lines = content.split('\n');
        
        const startLine = Math.max(0, currentLine - contextSize);
        const endLine = Math.min(lines.length - 1, currentLine + contextSize);
        
        return {
            before: lines.slice(startLine, currentLine),
            after: lines.slice(currentLine + 1, endLine + 1)
        };
    }

    /**
     * Apply an edit to the document
     */
    async applyEdit(
        content: string,
        position: 'cursor' | 'selection' | 'end' | { line: number; ch: number },
        options: EditOptions = {}
    ): Promise<EditResult> {
        const editor = this.getActiveEditor();
        const file = this.getActiveFile();
        
        if (!editor || !file) {
            return {
                success: false,
                error: 'No active editor or file',
                editType: 'insert'
            };
        }

        try {
            let appliedAt: EditorPosition;
            
            if (position === 'cursor') {
                // Insert at cursor position
                appliedAt = editor.getCursor();
                editor.replaceRange(content, appliedAt);
            } else if (position === 'selection') {
                // Replace current selection
                const selection = editor.getSelection();
                if (!selection) {
                    return {
                        success: false,
                        error: 'No text selected',
                        editType: 'replace'
                    };
                }
                appliedAt = editor.getCursor('from');
                editor.replaceSelection(content);
            } else if (position === 'end') {
                // Append to end of document
                const lastLine = editor.lastLine();
                const lastLineLength = editor.getLine(lastLine).length;
                appliedAt = { line: lastLine, ch: lastLineLength };
                
                const currentContent = editor.getValue();
                const newContent = currentContent + (currentContent.endsWith('\n') ? '' : '\n') + content;
                
                // Use vault.modify for undo/redo support
                await this.app.vault.modify(file, newContent);
            } else {
                // Insert at specific position
                appliedAt = position;
                editor.replaceRange(content, appliedAt);
            }

            // Handle post-edit options
            if (options.selectNewText) {
                const endPos = {
                    line: appliedAt.line + content.split('\n').length - 1,
                    ch: content.includes('\n') ? 
                        content.split('\n').pop()!.length : 
                        appliedAt.ch + content.length
                };
                editor.setSelection(appliedAt, endPos);
            }

            if (options.scrollToEdit) {
                editor.scrollIntoView({
                    from: appliedAt,
                    to: appliedAt
                }, true);
            }

            return {
                success: true,
                content,
                editType: position === 'selection' ? 'replace' : 
                         position === 'end' ? 'append' : 'insert',
                appliedAt
            };

        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                editType: 'insert'
            };
        }
    }

    /**
     * Delete content at a specific location
     */
    async deleteContent(
        target: 'selection' | 'line' | 'section',
        location?: string
    ): Promise<EditResult> {
        const editor = this.getActiveEditor();
        const file = this.getActiveFile();
        
        if (!editor || !file) {
            return {
                success: false,
                error: 'No active editor or file',
                editType: 'delete'
            };
        }

        try {
            if (target === 'selection') {
                const selection = editor.getSelection();
                if (!selection) {
                    return {
                        success: false,
                        error: 'No text selected',
                        editType: 'delete'
                    };
                }
                editor.replaceSelection('');
                return {
                    success: true,
                    editType: 'delete'
                };
            } else if (target === 'line') {
                const cursor = editor.getCursor();
                const line = cursor.line;
                editor.replaceRange('', 
                    { line, ch: 0 }, 
                    { line: line + 1, ch: 0 }
                );
                return {
                    success: true,
                    editType: 'delete',
                    appliedAt: { line, ch: 0 }
                };
            } else if (target === 'section' && location) {
                const section = await this.findSection(location);
                if (!section) {
                    return {
                        success: false,
                        error: `Section "${location}" not found`,
                        editType: 'delete'
                    };
                }
                
                // Delete the section including its heading
                const content = editor.getValue();
                const lines = content.split('\n');
                const newLines = lines.filter((_, index) => 
                    index < section.range.start || index > section.range.end
                );
                
                await this.app.vault.modify(file, newLines.join('\n'));
                
                return {
                    success: true,
                    editType: 'delete',
                    appliedAt: { line: section.range.start, ch: 0 }
                };
            }

            return {
                success: false,
                error: 'Invalid delete target',
                editType: 'delete'
            };

        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                editType: 'delete'
            };
        }
    }

    /**
     * Build hierarchical path for a heading
     */
    private buildSectionPath(headings: HeadingInfo[], targetIndex: number): string {
        const target = headings[targetIndex];
        const path: string[] = [target.text];
        
        // Walk backwards to find parent headings
        for (let i = targetIndex - 1; i >= 0; i--) {
            const heading = headings[i];
            if (heading.level < target.level) {
                path.unshift(heading.text);
                // Only include immediate parent for now (single level up)
                break;
            }
        }
        
        return path.join('::');
    }

    /**
     * Find a section by heading name (supports hierarchical paths with :: or /)
     */
    async findSection(headingText: string): Promise<DocumentSection | null> {
        const context = await this.getDocumentContext();
        if (!context) return null;

        const normalizedTarget = headingText.toLowerCase().trim();
        
        // Check if this is a hierarchical path (contains :: or /)
        if (normalizedTarget.includes('::') || normalizedTarget.includes('/')) {
            // Normalize path separators to compare both formats
            const targetPath = normalizedTarget.replace(/::/g, '/');
            
            // Find headings that match the hierarchical path
            for (let i = 0; i < context.headings.length; i++) {
                const heading = context.headings[i];
                
                // Try both old format (::) and new format (/)
                const legacyPath = this.buildSectionPath(context.headings, i).toLowerCase();
                const newPath = this.buildFullSectionPath(context.headings, i).toLowerCase();
                
                if (legacyPath === normalizedTarget || newPath === targetPath) {
                    return this.buildDocumentSection(heading, context.headings, i, context.content);
                }
            }
            
            return null;
        } else {
            // Simple section name - find first match (backwards compatible)
            const headingIndex = context.headings.findIndex(h => 
                h.text.toLowerCase().includes(normalizedTarget)
            );

            if (headingIndex === -1) return null;

            const heading = context.headings[headingIndex];
            return this.buildDocumentSection(heading, context.headings, headingIndex, context.content);
        }
    }

    /**
     * Build DocumentSection object from heading info
     */
    private buildDocumentSection(
        heading: HeadingInfo, 
        allHeadings: HeadingInfo[], 
        headingIndex: number, 
        content: string
    ): DocumentSection {
        const nextHeading = allHeadings[headingIndex + 1];
        const lines = content.split('\n');
        const endLine = nextHeading ? nextHeading.line - 1 : lines.length - 1;

        // Extract section content (excluding the heading line)
        const sectionLines = lines.slice(heading.line + 1, endLine + 1);
        const sectionContent = sectionLines.join('\n').trim();

        return {
            heading: heading.text,
            level: heading.level,
            content: sectionContent,
            range: {
                start: heading.line,
                end: endLine
            }
        };
    }

    /**
     * Get the full document content
     */
    async getDocumentContent(): Promise<string | null> {
        const editor = this.getActiveEditor();
        if (!editor) return null;
        
        return editor.getValue();
    }

    /**
     * Replace the entire document content
     */
    async setDocumentContent(content: string): Promise<EditResult> {
        const file = this.getActiveFile();
        
        if (!file) {
            return {
                success: false,
                error: 'No active file',
                editType: 'replace'
            };
        }

        try {
            await this.app.vault.modify(file, content);
            
            return {
                success: true,
                content,
                editType: 'replace'
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                editType: 'replace'
            };
        }
    }

    // Conversation management methods

    /**
     * Add user message to conversation
     */
    async addUserMessage(content: string, command?: EditCommand): Promise<void> {
        if (!this.conversationManager) return;
        
        const file = this.getActiveFile();
        if (file) {
            await this.conversationManager.addUserMessage(file, content, command);
        }
    }

    /**
     * Add assistant response to conversation
     */
    async addAssistantMessage(content: string, result?: EditResult): Promise<void> {
        if (!this.conversationManager) return;
        
        const file = this.getActiveFile();
        if (file) {
            await this.conversationManager.addAssistantMessage(file, content, result);
        }
    }

    /**
     * Add system message to conversation
     */
    async addSystemMessage(content: string): Promise<void> {
        if (!this.conversationManager) return;
        
        const file = this.getActiveFile();
        if (file) {
            await this.conversationManager.addSystemMessage(file, content);
        }
    }

    /**
     * Get conversation context for AI prompts
     */
    getConversationContext(maxMessages: number = 6): string {
        if (!this.conversationManager) return '';
        
        const file = this.getActiveFile();
        if (!file) return '';
        
        return this.conversationManager.getConversationContext(file, maxMessages);
    }

    /**
     * Clear conversation for current file
     */
    async clearConversation(): Promise<void> {
        if (!this.conversationManager) return;
        
        const file = this.getActiveFile();
        if (file) {
            await this.conversationManager.clearConversation(file);
        }
    }

    /**
     * Get conversation statistics for current file
     */
    getConversationStats(): {
        messageCount: number;
        editCount: number;
        mostUsedCommand: string | null;
        conversationAge: number;
    } | null {
        if (!this.conversationManager) return null;
        
        const file = this.getActiveFile();
        if (!file) return null;
        
        return this.conversationManager.getStats(file);
    }

    /**
     * Check if current file has an active conversation
     */
    hasConversation(): boolean {
        if (!this.conversationManager) return false;
        
        const file = this.getActiveFile();
        if (!file) return false;
        
        return this.conversationManager.hasConversation(file);
    }

    /**
     * Export conversation for current file
     */
    exportConversation(): string | null {
        if (!this.conversationManager) return null;
        
        const file = this.getActiveFile();
        if (!file) return null;
        
        return this.conversationManager.exportConversation(file);
    }

    /**
     * Get all section paths for section picker
     */
    async getAllSectionPaths(): Promise<Array<{
        displayName: string;
        targetPath: string;
        headingText: string;
        level: number;
        line: number;
        preview?: string;
    }>> {
        const context = await this.getDocumentContext();
        if (!context) return [];

        return context.headings.map((heading, index) => {
            // Build full hierarchical path
            const targetPath = this.buildFullSectionPath(context.headings, index);
            
            // Create indented display name
            const displayName = this.createDisplayName(heading.text, heading.level);
            
            // Get content preview
            const preview = this.getSectionPreview(context.headings, index, context.content);

            return {
                displayName,
                targetPath,
                headingText: heading.text,
                level: heading.level,
                line: heading.line,
                preview
            };
        });
    }

    /**
     * Build full hierarchical path including all parents
     */
    private buildFullSectionPath(headings: HeadingInfo[], targetIndex: number): string {
        const target = headings[targetIndex];
        const path: string[] = [target.text];
        
        // Walk backwards to find all parent headings
        let currentLevel = target.level;
        for (let i = targetIndex - 1; i >= 0; i--) {
            const heading = headings[i];
            // Only add heading if it's a parent (lower level number = higher hierarchy)
            if (heading.level < currentLevel) {
                path.unshift(heading.text);
                currentLevel = heading.level;
            }
        }
        
        return path.join('/');
    }

    /**
     * Create indented display name for hierarchical view
     */
    private createDisplayName(text: string, level: number): string {
        const indent = '  '.repeat(Math.max(0, level - 1));
        const icon = level === 1 ? '📄 ' : '';
        return `${indent}${icon}${text}`;
    }

    /**
     * Get section content preview
     */
    private getSectionPreview(headings: HeadingInfo[], headingIndex: number, content: string): string {
        const heading = headings[headingIndex];
        const nextHeading = headings[headingIndex + 1];
        const lines = content.split('\n');
        
        // Get first few lines of section content (excluding heading)
        const startLine = heading.line + 1;
        const endLine = nextHeading ? Math.min(nextHeading.line, startLine + 3) : Math.min(lines.length, startLine + 3);
        
        const sectionLines = lines.slice(startLine, endLine)
            .filter(line => line.trim().length > 0)
            .slice(0, 2); // Max 2 lines
        
        if (sectionLines.length === 0) {
            return 'Empty section';
        }
        
        const preview = sectionLines.join(' ').substring(0, 100);
        return preview.length > 97 ? preview + '...' : preview;
    }

    /**
     * Enhanced section finding with better path support
     */
    async findSectionByPath(sectionPath: string): Promise<DocumentSection | null> {
        const context = await this.getDocumentContext();
        if (!context) return null;

        const normalizedPath = sectionPath.toLowerCase().trim();
        
        // Try to find by full path first
        for (let i = 0; i < context.headings.length; i++) {
            const fullPath = this.buildFullSectionPath(context.headings, i);
            if (fullPath.toLowerCase() === normalizedPath) {
                return this.buildDocumentSection(context.headings[i], context.headings, i, context.content);
            }
        }
        
        // Fallback to simple text matching
        const headingIndex = context.headings.findIndex(h => 
            h.text.toLowerCase().includes(normalizedPath)
        );

        if (headingIndex === -1) return null;

        const heading = context.headings[headingIndex];
        return this.buildDocumentSection(heading, context.headings, headingIndex, context.content);
    }
}