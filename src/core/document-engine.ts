/**
 * Core document engine for Nova
 * Handles all document manipulation and editor interactions
 */

import { App, Editor, MarkdownView, TFile, EditorPosition, Notice } from 'obsidian';
import { DocumentContext, HeadingInfo, EditResult, EditOptions, DocumentSection } from './types';

export class DocumentEngine {
    constructor(private app: App) {}

    /**
     * Get the active editor instance
     */
    getActiveEditor(): Editor | null {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        return view?.editor || null;
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
     * Find a section by heading name
     */
    async findSection(headingText: string): Promise<DocumentSection | null> {
        const context = await this.getDocumentContext();
        if (!context) return null;

        const headingIndex = context.headings.findIndex(h => 
            h.text.toLowerCase().includes(headingText.toLowerCase())
        );

        if (headingIndex === -1) return null;

        const heading = context.headings[headingIndex];
        const nextHeading = context.headings[headingIndex + 1];
        
        const lines = context.content.split('\n');
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
}