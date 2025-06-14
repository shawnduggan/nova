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
        targets: ['selection', 'document']
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
        targets: ['selection']
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
        targets: ['end']
    },
    {
        action: 'edit',
        patterns: [
            /\b(edit|modify|change|update|revise|improve|enhance)\b/i,
            /\bmake\s+.*\b(better|clearer|more|less|formal|professional|detailed|comprehensive)\b/i,
            /\b(fix|correct|adjust)\b(?!.*\b(grammar|spelling|errors)\b)/i,
            /\b(expand|shorten|condense)\b/i
        ],
        targets: ['selection']
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
 * Target type detection patterns - simplified for cursor-only editing
 */
const TARGET_PATTERNS = [
    { pattern: /\b(?:selected|highlighted|chosen)\s+(?:text|content)/i, target: 'selection' },
    { pattern: /\b(?:entire|whole|full)\s+(?:document|file|note)/i, target: 'document' },
    { pattern: /\b(?:end|bottom|conclusion)/i, target: 'end' }
];

export class CommandParser {
    
    /**
     * Parse natural language input into an EditCommand
     */
    parseCommand(input: string, hasSelection: boolean = false): EditCommand {
        const normalizedInput = input.trim().toLowerCase();
        
        // Detect the action type
        const action = this.detectAction(normalizedInput);
        
        // Detect the target type (simplified for cursor-only editing)
        const target = this.detectTarget(normalizedInput, hasSelection, action);
        
        // Build context from the input
        const context = this.extractContext(input);
        
        return {
            action,
            target,
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
     * Detect the target type from the input (simplified for cursor-only editing)
     */
    private detectTarget(
        input: string, 
        hasSelection: boolean, 
        action: EditAction
    ): EditCommand['target'] {
        // Check explicit target patterns
        for (const targetPattern of TARGET_PATTERNS) {
            if (targetPattern.pattern.test(input)) {
                return targetPattern.target as EditCommand['target'];
            }
        }
        
        // Context-based target detection
        if (hasSelection && (action === 'edit' || action === 'grammar' || action === 'delete')) {
            return 'selection';
        }
        
        // Action-specific defaults
        switch (action) {
            case 'add':
                return 'end';
            case 'edit':
                return hasSelection ? 'selection' : 'cursor';
            case 'delete':
                return hasSelection ? 'selection' : 'cursor';
            case 'grammar':
                return hasSelection ? 'selection' : 'document';
            case 'rewrite':
                return 'end';
            case 'metadata':
                return 'document';
            default:
                return 'cursor';
        }
    }
    
    
    /**
     * Extract additional context from the input
     */
    private extractContext(input: string): string {
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
    getSuggestions(hasSelection: boolean): string[] {
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
                'Add content at cursor',
                'Fix grammar in this document',
                'Add conclusion at end',
                'Create a summary'
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
        const { action, target } = command;
        
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
                description = 'Generate new content';
                break;
            case 'metadata':
                description = 'Update document metadata';
                break;
        }
        
        switch (target) {
            case 'selection':
                description += ' in selected text';
                break;
            case 'cursor':
                description += ' at cursor position';
                break;
            case 'document':
                description += ' in entire document';
                break;
            case 'end':
                description += ' at end of document';
                break;
        }
        
        return description;
    }
}