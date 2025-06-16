/**
 * AI Intent Classifier for Nova
 * Determines whether user input is a chat, metadata command, or content command
 */

import { AIProviderManager } from '../ai/provider-manager';

export type UserIntent = 'CHAT' | 'METADATA' | 'CONTENT';

export class AIIntentClassifier {
    constructor(
        private providerManager: AIProviderManager
    ) {}

    /**
     * Classify user input into one of three intents
     */
    async classifyIntent(userInput: string, hasSelection: boolean = false): Promise<UserIntent> {
        // Handle special syntax first
        if (userInput.startsWith(':')) {
            // Colon commands are typically provider switches or custom commands
            return 'CHAT';
        }

        // Always use fallback for now - AI classification is causing issues
        // We can re-enable this once we have a more reliable approach
        return this.fallbackClassification(userInput);
        
        /* Disabled AI classification due to provider compatibility issues
        try {
            // Simplified prompt for better compatibility
            const prompt = `Classify this text as CHAT, METADATA, or CONTENT:
"${userInput}"

CHAT = questions/discussion
METADATA = tags/properties/frontmatter
CONTENT = edit document text

Answer with one word only:`;

            const response = await this.providerManager.complete('', prompt, {
                temperature: 0.1,
                maxTokens: 10
            });

            const classification = response.trim().toUpperCase();
            
            // Validate response
            if (classification === 'CHAT' || classification === 'METADATA' || classification === 'CONTENT') {
                return classification as UserIntent;
            }

            // Fallback heuristic if AI gives unexpected response
            return this.fallbackClassification(userInput);
        } catch (error) {
            console.error('AI intent classification failed:', error);
            // Use fallback heuristic
            return this.fallbackClassification(userInput);
        }
        */
    }

    /**
     * Simple heuristic fallback for when AI classification fails
     */
    private fallbackClassification(userInput: string): UserIntent {
        const lowerInput = userInput.toLowerCase().trim();

        // Check for question indicators FIRST
        if (lowerInput.includes('?') || 
            lowerInput.startsWith('what') ||
            lowerInput.startsWith('why') ||
            lowerInput.startsWith('how') ||
            lowerInput.startsWith('when') ||
            lowerInput.startsWith('where') ||
            lowerInput.startsWith('who') ||
            lowerInput.startsWith('can you') ||
            lowerInput.startsWith('could you') ||
            lowerInput.includes('explain') ||
            lowerInput.includes('help me understand')) {
            return 'CHAT';
        }

        // Check for metadata keywords - be more specific
        if (
            // Tag-specific patterns
            /\btags?\b/i.test(lowerInput) ||
            /\btagging\b/i.test(lowerInput) ||
            // Property patterns
            /\b(title|author|date|status|category|categories)\b/i.test(lowerInput) ||
            // Metadata/frontmatter patterns
            /\b(metadata|frontmatter|properties|property)\b/i.test(lowerInput) ||
            // Common metadata actions
            /^(add|update|set|remove|clean|optimize)\s+(tags?|title|author|metadata)/i.test(lowerInput)
        ) {
            return 'METADATA';
        }

        // Common content editing patterns
        if (
            /^(add|write|create|insert)\s+(a\s+)?(section|paragraph|conclusion|introduction|summary)/i.test(lowerInput) ||
            /^(fix|correct|improve)\s+(grammar|spelling|writing)/i.test(lowerInput) ||
            /^(make|rewrite|edit|modify|change)/i.test(lowerInput) ||
            /^(delete|remove)\s+(the\s+)?(section|paragraph|sentence)/i.test(lowerInput)
        ) {
            return 'CONTENT';
        }

        // Default to content editing for other commands
        return 'CONTENT';
    }
}