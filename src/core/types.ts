/**
 * Core types for Nova document engine
 */

import { Editor, EditorPosition, TFile } from 'obsidian';

/**
 * Supported edit actions for document manipulation
 */
export type EditAction = 'add' | 'edit' | 'delete' | 'grammar' | 'rewrite' | 'metadata';

/**
 * Represents a parsed command from user input
 */
export interface EditCommand {
    /** The type of edit action to perform */
    action: EditAction;
    
    /** The target element in the document - simplified for cursor-only editing */
    target: 'cursor' | 'selection' | 'document' | 'end';
    
    /** The user's original instruction */
    instruction: string;
    
    /** Additional context from the conversation */
    context?: string;
}

/**
 * Document context for AI processing
 */
export interface DocumentContext {
    /** The file being edited */
    file: TFile;
    
    /** Filename without extension */
    filename: string;
    
    /** Full document content */
    content: string;
    
    /** Document headings structure */
    headings: HeadingInfo[];
    
    /** Currently selected text (if any) */
    selectedText?: string;
    
    /** Cursor position */
    cursorPosition?: EditorPosition;
    
    /** Lines around cursor for context */
    surroundingLines?: {
        before: string[];
        after: string[];
    };
}

/**
 * Information about a document heading
 */
export interface HeadingInfo {
    /** The heading text */
    text: string;
    
    /** Heading level (1-6) */
    level: number;
    
    /** Line number where heading appears */
    line: number;
    
    /** Character position in document */
    position: {
        start: number;
        end: number;
    };
}

/**
 * Result of an edit operation
 */
export interface EditResult {
    /** Whether the edit was successful */
    success: boolean;
    
    /** The modified content (if successful) */
    content?: string;
    
    /** Error message (if failed) */
    error?: string;
    
    /** Location where edit was applied */
    appliedAt?: {
        line: number;
        ch: number;
    };
    
    /** Type of edit that was performed */
    editType: 'insert' | 'replace' | 'append' | 'delete';
}

/**
 * Options for document editing operations
 */
export interface EditOptions {
    /** Whether to maintain cursor position after edit */
    maintainCursor?: boolean;
    
    /** Whether to select the newly inserted/edited text */
    selectNewText?: boolean;
    
    /** Whether to scroll to the edit location */
    scrollToEdit?: boolean;
    
    /** Custom undo message */
    undoMessage?: string;
}

/**
 * Document section information
 */
export interface DocumentSection {
    /** Section heading */
    heading: string;
    
    /** Heading level */
    level: number;
    
    /** Section content (excluding heading) */
    content: string;
    
    /** Start and end line numbers */
    range: {
        start: number;
        end: number;
    };
}

/**
 * Configuration for AI prompt generation
 */
export interface PromptConfig {
    /** Maximum lines of context to include */
    maxContextLines: number;
    
    /** Whether to include document structure */
    includeStructure: boolean;
    
    /** Whether to include previous conversation */
    includeHistory: boolean;
    
    /** Temperature for AI generation */
    temperature?: number;
    
    /** Maximum tokens for response */
    maxTokens?: number;
}

/**
 * Conversation message for file-scoped history
 */
export interface ConversationMessage {
    /** Unique message ID */
    id: string;
    
    /** Message role */
    role: 'user' | 'assistant' | 'system';
    
    /** Message content */
    content: string;
    
    /** Timestamp */
    timestamp: number;
    
    /** Associated command (if any) */
    command?: EditCommand;
    
    /** Result of command execution */
    result?: EditResult;
}

/**
 * File-scoped conversation storage
 */
export interface ConversationData {
    /** File path this conversation belongs to */
    filePath: string;
    
    /** Conversation messages */
    messages: ConversationMessage[];
    
    /** Last updated timestamp */
    lastUpdated: number;
    
    /** Conversation metadata */
    metadata?: {
        /** Number of edits made */
        editCount: number;
        
        /** Most used commands */
        commandFrequency: Record<EditAction, number>;
    };
}