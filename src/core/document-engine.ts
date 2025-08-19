/**
 * Core document engine for Nova
 * Handles all document manipulation and editor interactions
 */

import { App, Editor, MarkdownView, TFile, EditorPosition } from 'obsidian';
import { DocumentContext, HeadingInfo, EditResult, EditOptions, EditCommand } from './types';
import { ConversationManager, DataStore } from './conversation-manager';
import { Logger } from '../utils/logger';

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
     * Get the active editor instance - ensures we get the editor for the active file
     */
    getActiveEditor(): Editor | null {
        // Get the active file first to ensure consistency
        const activeFile = this.getActiveFile();
        if (!activeFile) {
            return null;
        }
        
        // Find the markdown view for the active file specifically
        const leaves = this.app.workspace.getLeavesOfType('markdown');
        for (const leaf of leaves) {
            const view = leaf.view;
            if (view instanceof MarkdownView && view.file === activeFile) {
                return view.editor;
            }
        }
        
        // Fallback: try the workspace active editor if it matches the active file
        const activeEditor = this.app.workspace.activeEditor;
        if (activeEditor?.editor && activeEditor.file === activeFile) {
            return activeEditor.editor;
        }
        
        // Final fallback: try getActiveViewOfType
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (view && view.file === activeFile) {
            return view.editor;
        }
        return null;
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
     * Set the cursor position (optionally focus the editor)
     */
    setCursorPosition(position: EditorPosition, shouldFocus: boolean = false): void {
        const editor = this.getActiveEditor();
        if (!editor) return;
        
        editor.setCursor(position);
        if (shouldFocus) {
            editor.focus();
        }
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
                const contentToInsert = (currentContent.endsWith('\n') ? '' : '\n') + content;
                
                // Use editor interface to preserve cursor, selections, undo/redo
                editor.replaceRange(contentToInsert, appliedAt);
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
     * Delete content at cursor location
     */
    async deleteContent(
        target: 'selection' | 'line'
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
        const editor = this.getActiveEditor();
        
        if (!editor) {
            return {
                success: false,
                error: 'No active editor',
                editType: 'replace'
            };
        }

        try {
            // Use editor interface to preserve cursor, selections, undo/redo
            editor.setValue(content);
            
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
     * Replace selected text with new content
     * Handles undo/redo properly and preserves cursor position
     */
    async replaceSelection(
        newText: string,
        from?: EditorPosition,
        to?: EditorPosition
    ): Promise<EditResult> {
        const editor = this.getActiveEditor();
        const file = this.getActiveFile();
        
        if (!editor || !file) {
            return {
                success: false,
                error: 'No active editor or file',
                editType: 'replace'
            };
        }

        try {
            // Use provided range or current selection
            const fromPos = from || editor.getCursor('from');
            const toPos = to || editor.getCursor('to');
            
            // Perform the replacement using Obsidian's transaction system for proper undo/redo
            editor.replaceRange(newText, fromPos, toPos);
            
            // Set cursor at the end of the replaced text
            const newCursorPos = {
                line: fromPos.line + (newText.split('\n').length - 1),
                ch: newText.includes('\n') ? 
                    newText.split('\n').pop()!.length : 
                    fromPos.ch + newText.length
            };
            
            editor.setCursor(newCursorPos);
            editor.focus();

            return {
                success: true,
                content: newText,
                appliedAt: fromPos,
                editType: 'replace'
            };

        } catch (error) {
            Logger.error('Error replacing selection:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                editType: 'replace'
            };
        }
    }

}