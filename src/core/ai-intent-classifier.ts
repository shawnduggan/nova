/**
 * AI Intent Classifier for Nova
 * Determines whether user input is a chat, metadata command, or content command
 */

import { AIProviderManager } from '../ai/provider-manager';
import { IntentDetector, IntentClassification } from './intent-detector';

export type UserIntent = 'CHAT' | 'METADATA' | 'CONTENT';

export class AIIntentClassifier {
    private intentDetector: IntentDetector;

    constructor(
        private providerManager: AIProviderManager
    ) {
        this.intentDetector = new IntentDetector();
    }

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
     * Enhanced fallback classification using IntentDetector
     */
    private fallbackClassification(userInput: string): UserIntent {
        const lowerInput = userInput.toLowerCase().trim();

        // Check for questions FIRST (highest priority)
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

        // Use our new IntentDetector for consultation vs editing patterns
        const intentClassification = this.intentDetector.classifyInput(userInput);
        
        // Map IntentDetector results to our system
        if (intentClassification.type === 'consultation') {
            return 'CHAT';
        }
        
        if (intentClassification.type === 'editing') {
            // Check if it's metadata-related editing
            if (this.isMetadataRelated(lowerInput)) {
                return 'METADATA';
            }
            return 'CONTENT';
        }

        // For ambiguous cases, check metadata patterns
        if (this.isMetadataRelated(lowerInput)) {
            return 'METADATA';
        }

        // Default to content editing for other commands
        return 'CONTENT';
    }

    /**
     * Helper method to check if input is metadata-related
     */
    private isMetadataRelated(lowerInput: string): boolean {
        return (
            // Tag-specific patterns
            /\btags?\b/i.test(lowerInput) ||
            /\btagging\b/i.test(lowerInput) ||
            // Property patterns
            /\b(title|author|date|status|category|categories)\b/i.test(lowerInput) ||
            // Metadata/frontmatter patterns
            /\b(metadata|frontmatter|properties|property)\b/i.test(lowerInput) ||
            // Common metadata actions
            /^(add|update|set|remove|clean|optimize)\s+(tags?|title|author|metadata)/i.test(lowerInput)
        );
    }
}