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
    documentType: DocumentType;
    
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

export type DocumentType = 'blog' | 'academic' | 'technical' | 'creative' | 'notes' | 'unknown';

/** Simplified Commands Settings - Single interface for all command behavior */
export interface CommandSuggestionsSettings {
    /** When and how aggressively to show command suggestions */
    suggestionMode: 'off' | 'minimal' | 'balanced' | 'aggressive';
    
    /** How quickly to respond after typing stops */
    responseTime: 'fast' | 'normal' | 'relaxed';
    
    /** Hide suggestions while typing fast */
    hideWhileTyping: boolean;
    
    /** Which document types to analyze (empty = all types) */
    enabledDocumentTypes: string[];
    
}

// Legacy interfaces for backward compatibility during transition
export interface ProgressiveDisclosureSettings {
    triggerMode: 'off' | 'minimal' | 'balanced' | 'aggressive';
    showDelay: number;
    hideOnFastTyping: number;
    enabledDocumentTypes: string[];
    allowFrontmatterOverride: boolean;
}

export interface SmartTimingSettings {
    showDelay: number;
    hideOnFastTyping: boolean;
    fastTypingThreshold: number;
    scrollDebounce: number;
    minAnalysisInterval: number;
    typingSpeedWindow: number;
    documentTypeOverrides: Record<DocumentType, Partial<SmartTimingSettings>>;
}

export interface TimingDecision {
    shouldShow: boolean;
    reason: string;
    nextCheckDelay?: number;
}

export interface TypingMetrics {
    currentWPM: number;
    keystrokeCount: number;
    isTypingFast: boolean;
    timeSinceLastKeystroke: number;
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

/**
 * Utility functions for converting simplified settings to internal engine settings
 */

/** Convert response time preset to milliseconds */
export function responseTimeToMs(responseTime: 'fast' | 'normal' | 'relaxed'): number {
    switch (responseTime) {
        case 'fast': return 1500;
        case 'normal': return 3000;
        case 'relaxed': return 5000;
    }
}

/** Convert simplified settings to legacy ProgressiveDisclosureSettings */
export function toProgressiveDisclosureSettings(settings: CommandSuggestionsSettings): ProgressiveDisclosureSettings {
    return {
        triggerMode: settings.suggestionMode,
        showDelay: responseTimeToMs(settings.responseTime),
        hideOnFastTyping: settings.hideWhileTyping ? 30 : 999, // 30 WPM threshold or effectively disabled
        enabledDocumentTypes: settings.enabledDocumentTypes,
        allowFrontmatterOverride: false // Removed from simplified UI
    };
}

/** Convert simplified settings to legacy SmartTimingSettings */
export function toSmartTimingSettings(settings: CommandSuggestionsSettings): SmartTimingSettings {
    const showDelay = responseTimeToMs(settings.responseTime);
    return {
        showDelay,
        hideOnFastTyping: settings.hideWhileTyping,
        fastTypingThreshold: 30, // Fixed threshold
        scrollDebounce: 100, // Fixed value
        minAnalysisInterval: Math.floor(showDelay / 3), // Automatic calculation
        typingSpeedWindow: 60000, // Fixed 1 minute
        documentTypeOverrides: {
            unknown: {},
            blog: {},
            academic: {},
            technical: {},
            creative: {},
            notes: {}
        }
    };
}