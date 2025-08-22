/**
 * Type definitions for the Nova Commands system
 * Supports markdown-based commands with progressive disclosure UI
 */

export interface MarkdownCommand {
    /** Unique identifier for the command */
    id: string;
    
    /** Display name for the command */
    name: string;
    
    /** Brief description for UI display */
    description: string;
    
    /** Markdown template content with variables */
    template: string;
    
    /** Example of command usage */
    example?: string;
    
    /** Keywords for search/filtering */
    keywords: string[];
    
    /** Category for organization */
    category: 'writing' | 'academic' | 'technical' | 'creative' | 'analysis';
    
    /** Icon type for progressive disclosure */
    iconType: '💡' | '⚡' | '📊' | '✨' | '🔧' | '📝';
    
    /** Variables used in the template */
    variables: TemplateVariable[];
    
    /** File path where command is stored */
    filePath?: string;
}

export interface TemplateVariable {
    /** Variable name (without braces) */
    name: string;
    
    /** Description for UI */
    description: string;
    
    /** Whether variable is required */
    required: boolean;
    
    /** Default value or resolution strategy */
    defaultValue?: string;
    
    /** How to resolve the variable */
    resolver: 'selection' | 'document' | 'cursor' | 'user_input' | 'computed';
}

export interface SmartContext {
    /** Current text selection */
    selection: string;
    
    /** Full document content */
    document: string;
    
    /** Document title */
    title: string;
    
    /** Detected document type */
    documentType: 'blog' | 'academic' | 'technical' | 'creative' | 'notes' | 'unknown';
    
    /** Cursor position context (paragraph/line) */
    cursorContext: string;
    
    /** Document metrics */
    metrics: {
        wordCount: number;
        readingLevel: string;
        tone: string;
    };
    
    /** Inferred audience level */
    audienceLevel: 'beginner' | 'intermediate' | 'expert' | 'general';
}

export interface CommandExecutionContext {
    /** The markdown command to execute */
    command: MarkdownCommand;
    
    /** Resolved template variables */
    variables: Record<string, string>;
    
    /** Smart context about the document */
    context: SmartContext;
    
    /** User's preferred execution options */
    options: ExecutionOptions;
}

export interface ExecutionOptions {
    /** How to handle the output */
    outputMode: 'replace' | 'insert_after' | 'insert_before' | 'new_document';
    
    /** Whether to show streaming animation */
    showProgress: boolean;
    
    /** Custom parameters for the command */
    parameters?: Record<string, unknown>;
}

export interface ProgressiveDisclosureSettings {
    /** When to show margin indicators */
    triggerMode: 'off' | 'minimal' | 'balanced' | 'aggressive';
    
    /** Delay before showing indicators after typing stops */
    showDelay: number;
    
    /** Hide when typing faster than this WPM */
    hideOnFastTyping: number;
    
    /** Which document types to analyze */
    enabledDocumentTypes: string[];
    
    /** Whether to respect per-document frontmatter overrides */
    allowFrontmatterOverride: boolean;
}

export interface CommandRegistry {
    /** Load command by ID */
    loadCommand(commandId: string): Promise<MarkdownCommand | null>;
    
    /** Get all available commands */
    getAllCommands(): Promise<MarkdownCommand[]>;
    
    /** Find commands by category */
    getCommandsByCategory(category: string): Promise<MarkdownCommand[]>;
    
    /** Search commands by keywords */
    searchCommands(query: string): Promise<MarkdownCommand[]>;
    
    /** Cache management */
    clearCache(): void;
}

export interface InsightDetection {
    /** Position where insight applies */
    position: {
        line: number;
        ch: number;
    };
    
    /** Type of insight detected */
    type: 'enhancement' | 'quick_fix' | 'metrics' | 'transformation';
    
    /** Icon to display */
    icon: string;
    
    /** Brief description for hover */
    description: string;
    
    /** Primary suggested command */
    primaryCommand: MarkdownCommand;
    
    /** Alternative commands */
    alternatives: MarkdownCommand[];
    
    /** Confidence score 0-1 */
    confidence: number;
}