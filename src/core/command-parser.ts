/**
 * Command parser for Nova
 * Converts natural language input into structured EditCommand objects
 */

import { EditCommand, EditAction } from './types';

/**
 * Patterns for detecting different command types
 */
interface CommandPattern {
    action: EditAction;
    patterns: RegExp[];
    targets: string[];
}

/**
 * Command parsing rules
 */
const COMMAND_PATTERNS: CommandPattern[] = [
    {
        action: 'grammar',
        patterns: [
            /\b(grammar|spell|spelling|proofread|polish)\b/i,
            /\bcheck\b.*\b(grammar|spelling|errors)\b/i,
            /\bmake\s+.*\b(grammatical|correct|proper)\b/i,
            /\bfix\s+.*\b(grammar|errors|mistakes|typos)\b/i,
            /\bcorrect\b.*\b(grammar|spelling|errors)\b/i
        ],
        targets: ['selection', 'document', 'paragraph']
    },
    {
        action: 'rewrite',
        patterns: [
            /\b(rewrite|reword|rephrase|restructure|reorganize)\b/i,
            /\bwrite\s+.*\b(new|different|alternative)\b/i,
            /\bgenerate\s+.*\b(sections|parts|multiple)\b/i,
            /\bmake\s+.*\b(sections|parts|multiple)\b/i
        ],
        targets: ['document', 'end']
    },
    {
        action: 'delete',
        patterns: [
            /\b(delete|remove|eliminate|cut|erase)\b/i,
            /\bget\s+rid\s+of\b/i,
            /\btake\s+out\b/i,
            /\bdrop\b.*\b(section|paragraph|part)\b/i
        ],
        targets: ['selection', 'section', 'line']
    },
    {
        action: 'add',
        patterns: [
            /\b(add|create|write|insert|include|append|prepend)\b.*\b(section|paragraph|heading|content|text|part)\b/i,
            /\b(add|create|write|insert|append|prepend)\b(?!\s+.*\b(better|clearer|more|less)\b)/i,
            /\bmake\s+.*\b(section|part)\b/i,
            /\bgenerate\b.*\b(section|content|text)\b/i,
            // Specific patterns for append/prepend with location
            /\b(append|add)\b.*\b(after|following)\b/i,
            /\b(prepend|add)\b.*\b(before|preceding)\b/i
        ],
        targets: ['end', 'section', 'paragraph']
    },
    {
        action: 'edit',
        patterns: [
            /\b(edit|modify|change|update|revise|improve|enhance)\b/i,
            /\bmake\s+.*\b(better|clearer|more|less|formal|professional|detailed|comprehensive)\b/i,
            /\b(fix|correct|adjust)\b(?!.*\b(grammar|spelling|errors)\b)/i,
            /\b(expand|shorten|condense)\b/i
        ],
        targets: ['selection', 'section', 'paragraph']
    },
    {
        action: 'metadata',
        patterns: [
            /\b(update|set|change|modify|add)\s+.*\b(property|properties|metadata|frontmatter|tag|tags)\b/i,
            /\b(set|update|change|add)\s+.*\b(title|author|date|status)\b/i,
            /\bupdate\s+.*\bfrontmatter\b/i,
            /\b(add|remove|update)\s+.*\btag[s]?\b/i,
            /\bset\s+.*\bproperty\b/i
        ],
        targets: ['document']
    }
];

/**
 * Location extraction patterns
 */
const LOCATION_PATTERNS = [
    // New semantic patterns for append/prepend to
    /\b(?:append|prepend)\s+.*?\bto\s+(?:the\s+)?["']([^"']+?)["']/i,
    /\b(?:append|prepend)\s+.*?\bto\s+(?:the\s+)?([A-Za-z][A-Za-z0-9\s:&]*?)(?:\s+(?:section|heading|part))?$/i,
    /\b(?:append|prepend)\s+.*?\bto\s+([A-Za-z][A-Za-z0-9\s:&]*?)\s+(?:section|heading|part)/i,
    
    // Append/prepend with after/before (for mixed syntax like "append X after Y")
    /\b(?:append|prepend)\s+.*?\b(?:after|before)\s+(?:the\s+)?["']([^"']+?)["']\s+(?:section|heading)/i,
    /\b(?:append|prepend)\s+.*?\b(?:after|before)\s+(?:the\s+)?([A-Za-z][A-Za-z0-9\s:&]*?)\s+(?:section|heading)/i,
    
    // Insert patterns with after/before
    /\binsert\s+.*?\b(?:after|before)\s+(?:the\s+)?["']([^"']+?)["']\s+heading/i,
    /\binsert\s+.*?\b(?:after|before)\s+(?:the\s+)?([A-Za-z][A-Za-z0-9\s:&]*?)\s+heading/i,
    
    // Original patterns for after/before the X heading/section
    /\b(?:after|before|following|preceding)\s+(?:the\s+)?["']([^"']+?)["']\s+(?:section|heading|part)/i,
    /\b(?:after|before|following|preceding)\s+the\s+([^"'\s]+(?:\s+(?:and|&)\s+[^"'\s]+)*)\s+(?:section|heading|part)/i,
    
    // Standard quoted patterns
    /\b(?:to|in|at|under|within|inside)\s+(?:the\s+)?["']([^"']+?)["']\s+(?:section|heading|part)/i,
    /\b(?:the\s+)?["']([^"']+?)["']\s+(?:section|heading|part)/i,
    /\b(?:section|heading|part)\s+["']([^"']+?)["']/i,
    /\b(?:section|heading)\s+(?:called|titled|named)\s+["']([^"']+?)["']/i,
    /\b(?:called|titled|named)\s+["']([^"']+?)["']/i,
    
    // Generic pattern - must be last and more restrictive
    /\b(?:in|at|under|within)\s+(?:the\s+)?([a-zA-Z][a-zA-Z\s&]*?)\s+(?:section|heading)\b/i
];

/**
 * Target type detection patterns
 */
const TARGET_PATTERNS = [
    { pattern: /\b(?:selected|highlighted|chosen)\s+(?:text|content)/i, target: 'selection' },
    { pattern: /\b(?:this|current|selected)\s+(?:paragraph|line)/i, target: 'paragraph' },
    { pattern: /\b(?:entire|whole|full)\s+(?:document|file|note)/i, target: 'document' },
    { pattern: /\b(?:end|bottom|conclusion)/i, target: 'end' },
    { pattern: /\b(?:section|heading|part)/i, target: 'section' }
];

export class CommandParser {
    /**
     * Convert path-style syntax (/) to hierarchical syntax (::) 
     */
    private convertPathSyntax(input: string): string {
        // Convert forward slashes to :: for hierarchical paths
        // But only for paths that look like section references
        return input.replace(/\b([A-Za-z][A-Za-z0-9\s]*?)\/([A-Za-z][A-Za-z0-9\s\/]*)\b/g, '$1::$2');
    }
    
    /**
     * Parse natural language input into an EditCommand
     */
    parseCommand(input: string, hasSelection: boolean = false): EditCommand {
        // First convert path syntax (/) to hierarchical syntax (::)
        const convertedInput = this.convertPathSyntax(input);
        const normalizedInput = convertedInput.trim().toLowerCase();
        
        // Detect the action type
        const action = this.detectAction(normalizedInput);
        
        // Detect the target type AND position hint
        const { target, positionHint } = this.detectTargetAndPosition(normalizedInput, hasSelection, action);
        
        // Extract location if specified (use converted input)
        const location = this.extractLocation(convertedInput);
        
        // Build context from the input (including position hint)
        const context = this.extractContext(convertedInput, positionHint);
        
        return {
            action,
            target,
            location,
            instruction: input, // Keep original input for display
            context
        };
    }
    
    /**
     * Detect the action type from the input
     */
    private detectAction(input: string): EditAction {
        // Check patterns in order of specificity
        for (const commandPattern of COMMAND_PATTERNS) {
            for (const pattern of commandPattern.patterns) {
                if (pattern.test(input)) {
                    return commandPattern.action;
                }
            }
        }
        
        // Default fallback logic with more specific checks
        if (/\b(add|create|write|insert|include|generate.*section)\b/i.test(input)) {
            return 'add';
        }
        if (/\b(fix|correct|grammar|spell|proofread|polish)\b/i.test(input)) {
            return 'grammar';
        }
        if (/\b(delete|remove|eliminate)\b/i.test(input)) {
            return 'delete';
        }
        if (/\b(rewrite|rephrase|restructure|generate.*new)\b/i.test(input)) {
            return 'rewrite';
        }
        if (/\b(update|set|change|modify|add).*\b(property|properties|metadata|frontmatter|tag|tags|title|author|date|status)\b/i.test(input)) {
            return 'metadata';
        }
        
        // Default to edit for ambiguous cases
        return 'edit';
    }
    
    /**
     * Detect the target type AND position hint for the command
     */
    private detectTargetAndPosition(
        input: string, 
        hasSelection: boolean, 
        action: EditAction
    ): { target: EditCommand['target'], positionHint?: string } {
        let positionHint: string | undefined;
        
        // Check for specific position indicators
        if (/\bappend\s+.*?\b(?:to|after)\b/i.test(input)) {
            positionHint = 'section-end';
        } else if (/\bprepend\s+.*?\b(?:to|before)\b/i.test(input)) {
            positionHint = 'section-start';
        } else if (/\binsert\s+.*?\bafter\s+.*?\bheading\b/i.test(input)) {
            positionHint = 'after-heading';
        } else if (/\binsert\s+.*?\bbefore\s+.*?\bheading\b/i.test(input)) {
            positionHint = 'before-heading';
        }
        
        // Check explicit target patterns
        for (const targetPattern of TARGET_PATTERNS) {
            if (targetPattern.pattern.test(input)) {
                return { 
                    target: targetPattern.target as EditCommand['target'],
                    positionHint 
                };
            }
        }
        
        // Context-based target detection
        if (hasSelection && (action === 'edit' || action === 'grammar' || action === 'delete')) {
            return { target: 'selection', positionHint };
        }
        
        // Action-specific defaults
        let target: EditCommand['target'];
        switch (action) {
            case 'add':
                target = input.includes('section') || input.includes('heading') ? 'section' : 'end';
                break;
            case 'edit':
                target = hasSelection ? 'selection' : 'paragraph';
                break;
            case 'delete':
                target = hasSelection ? 'selection' : 'section';
                break;
            case 'grammar':
                target = hasSelection ? 'selection' : 'document';
                break;
            case 'rewrite':
                target = 'end';
                break;
            default:
                target = 'paragraph';
        }
        
        return { target, positionHint };
    }
    
    /**
     * Detect the target type from the input (legacy wrapper)
     */
    private detectTarget(
        input: string, 
        hasSelection: boolean, 
        action: EditAction
    ): EditCommand['target'] {
        const { target } = this.detectTargetAndPosition(input, hasSelection, action);
        return target;
    }
    
    /**
     * Extract location information from the input
     */
    private extractLocation(input: string): string | undefined {
        for (const pattern of LOCATION_PATTERNS) {
            const match = pattern.exec(input);
            if (match && match[1]) {
                return match[1].trim();
            }
        }
        
        return undefined;
    }
    
    /**
     * Extract additional context from the input
     */
    private extractContext(input: string, positionHint?: string): string {
        // Extract style/tone indicators
        const styleIndicators = [
            'formal', 'informal', 'casual', 'professional', 'academic', 'technical',
            'simple', 'complex', 'detailed', 'brief', 'concise', 'verbose',
            'friendly', 'serious', 'humorous', 'creative', 'analytical'
        ];
        
        const foundStyles = styleIndicators.filter(style => 
            input.toLowerCase().includes(style)
        );
        
        let context = '';
        if (foundStyles.length > 0) {
            context += `Style: ${foundStyles.join(', ')}. `;
        }
        
        // Extract length indicators
        if (input.includes('short') || input.includes('brief') || input.includes('concise')) {
            context += 'Keep it brief. ';
        }
        if (input.includes('long') || input.includes('detailed') || input.includes('comprehensive')) {
            context += 'Provide detailed content. ';
        }
        
        // Extract specific requirements
        if (input.includes('bullet') || input.includes('list')) {
            context += 'Use bullet points or lists. ';
        }
        if (input.includes('example') || input.includes('examples')) {
            context += 'Include examples. ';
        }
        if (input.includes('number') || input.includes('numbered')) {
            context += 'Use numbered lists. ';
        }
        
        // Add position hint context
        if (positionHint) {
            switch (positionHint) {
                case 'section-end':
                    context += 'Position: Add at the end of the section. ';
                    break;
                case 'section-start':
                    context += 'Position: Add at the start of the section (right after the heading). ';
                    break;
                case 'after-heading':
                    context += 'Position: Insert immediately after the heading line. ';
                    break;
                case 'before-heading':
                    context += 'Position: Insert immediately before the heading line. ';
                    break;
            }
        }
        
        return context.trim();
    }
    
    /**
     * Validate if a command can be executed
     */
    validateCommand(command: EditCommand, hasSelection: boolean): {
        valid: boolean;
        error?: string;
    } {
        // Check if selection is required but not available
        if (command.target === 'selection' && !hasSelection) {
            return {
                valid: false,
                error: 'This command requires text to be selected first'
            };
        }
        
        // Check if location is required but not provided
        if (command.target === 'section' && command.action === 'delete' && !command.location) {
            return {
                valid: false,
                error: 'Please specify which section to delete'
            };
        }
        
        // Validate action-target combinations
        if (command.action === 'add' && command.target === 'selection') {
            return {
                valid: false,
                error: 'Cannot add content to a selection. Use "edit" to modify selected text'
            };
        }
        
        return { valid: true };
    }
    
    /**
     * Get suggested commands based on context
     */
    getSuggestions(hasSelection: boolean, hasHeadings: boolean): string[] {
        const suggestions: string[] = [];
        
        if (hasSelection) {
            suggestions.push(
                'Make this more concise',
                'Fix grammar in this text',
                'Make this more professional',
                'Expand on this point'
            );
        } else {
            suggestions.push(
                'Add a conclusion section',
                'Fix grammar in this document',
                'Add an introduction',
                'Create a summary'
            );
        }
        
        if (hasHeadings) {
            suggestions.push(
                'Add content to the introduction section',
                'Expand the methodology section'
            );
        }
        
        return suggestions;
    }
    
    /**
     * Parse multiple commands from a single input
     */
    parseMultipleCommands(input: string): EditCommand[] {
        // Split on common command separators
        const separators = /\b(?:then|also|and then|after that|next|additionally)\b/i;
        const parts = input.split(separators);
        
        if (parts.length === 1) {
            return [this.parseCommand(input)];
        }
        
        return parts
            .map(part => part.trim())
            .filter(part => part.length > 0)
            .map(part => this.parseCommand(part));
    }
    
    /**
     * Get command description for display
     */
    getCommandDescription(command: EditCommand): string {
        const { action, target, location } = command;
        
        let description = '';
        
        switch (action) {
            case 'add':
                description = 'Add new content';
                break;
            case 'edit':
                description = 'Edit existing content';
                break;
            case 'delete':
                description = 'Remove content';
                break;
            case 'grammar':
                description = 'Fix grammar and spelling';
                break;
            case 'rewrite':
                description = 'Generate new sections';
                break;
        }
        
        if (location) {
            description += ` in "${location}"`;
        } else {
            switch (target) {
                case 'selection':
                    description += ' in selected text';
                    break;
                case 'section':
                    description += ' in current section';
                    break;
                case 'paragraph':
                    description += ' in current paragraph';
                    break;
                case 'document':
                    description += ' in entire document';
                    break;
                case 'end':
                    description += ' at end of document';
                    break;
            }
        }
        
        return description;
    }
}