/**
 * @file AIIntentClassifier - AI-powered intent classification for ambiguous inputs
 */

import { AIProviderManager } from '../ai/provider-manager';
import { Logger } from '../utils/logger';
import { IntentDetector } from './intent-detector';

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
    classifyIntent(userInput: string, _hasSelection: boolean = false): UserIntent {
        try {
            // Input validation
            if (!userInput || typeof userInput !== 'string') {
                return 'CHAT';
            }

            const trimmedInput = userInput.trim();
            if (trimmedInput.length === 0) {
                return 'CHAT';
            }

            // Handle special syntax first
            if (trimmedInput.startsWith(':')) {
                // Colon commands are typically provider switches or custom commands
                return 'CHAT';
            }

            // Try fast classification first (90% of cases)
            const fastResult = this.fastClassification(trimmedInput);
            
            // If fast classification is confident, use it
            if (fastResult.confidence >= 0.8) {
                return fastResult.intent;
            }

            // For ambiguous cases, fall back to enhanced heuristics
            return this.enhancedFallbackClassification(trimmedInput, fastResult);

        } catch (error) {
            Logger.error('Error in classifyIntent:', error);
            // Ultimate fallback to safe default
            return 'CHAT';
        }
    }

    /**
     * Fast heuristic classification for 90% of clear cases
     * Returns confidence score to determine if AI classification is needed
     */
    private fastClassification(userInput: string): { intent: UserIntent; confidence: number } {
        // Input validation
        if (!userInput || typeof userInput !== 'string') {
            return { intent: 'CHAT', confidence: 0.3 };
        }

        try {
            const lowerInput = userInput.toLowerCase().trim();

            // Handle empty or whitespace-only input
            if (lowerInput.length === 0) {
                return { intent: 'CHAT', confidence: 0.3 };
            }

            // Check for greetings FIRST (highest confidence)
            if (this.isGreeting(lowerInput)) {
                return { intent: 'CHAT', confidence: 0.95 };
            }

            // Check for direct editing commands SECOND (high confidence)
            // This should take precedence over questions that might appear later in the text
            if (this.isDirectEditingCommand(lowerInput)) {
                // Check if it's metadata-related editing
                if (this.isMetadataRelated(lowerInput)) {
                    return { intent: 'METADATA', confidence: 0.9 };
                }
                return { intent: 'CONTENT', confidence: 0.9 };
            }

            // Check for clear questions THIRD (high confidence)
            // Only after we've ruled out direct editing commands
            if (this.isQuestion(lowerInput)) {
                return { intent: 'CHAT', confidence: 0.9 };
            }

            // Check for metadata-only patterns (high confidence)
            if (this.isMetadataRelated(lowerInput)) {
                return { intent: 'METADATA', confidence: 0.85 };
            }

            // Use IntentDetector for pattern-based classification
            const intentClassification = this.intentDetector.classifyInput(userInput);
            
            // Map IntentDetector results with adjusted confidence
            if (intentClassification.type === 'consultation' && intentClassification.confidence >= 0.8) {
                return { intent: 'CHAT', confidence: intentClassification.confidence };
            }
            
            if (intentClassification.type === 'editing' && intentClassification.confidence >= 0.8) {
                return { intent: 'CONTENT', confidence: intentClassification.confidence };
            }

            // Low confidence - needs enhanced fallback
            return { intent: 'CHAT', confidence: 0.5 };

        } catch (error) {
            Logger.warn('Error in fastClassification:', error);
            // Fallback to safe default
            return { intent: 'CHAT', confidence: 0.3 };
        }
    }

    /**
     * Enhanced question detection
     */
    private isQuestion(lowerInput: string): boolean {
        return (
            lowerInput.includes('?') || 
            lowerInput.startsWith('what') ||
            lowerInput.startsWith('why') ||
            lowerInput.startsWith('how') ||
            lowerInput.startsWith('when') ||
            lowerInput.startsWith('where') ||
            lowerInput.startsWith('who') ||
            lowerInput.startsWith('can you') ||
            lowerInput.startsWith('could you') ||
            lowerInput.startsWith('would you') ||
            lowerInput.startsWith('should i') ||
            // More precise "explain" patterns for questions vs editing commands
            lowerInput.startsWith('explain') ||
            /\b(can you|could you|please|would you)\s+explain\b/i.test(lowerInput) ||
            lowerInput.includes('help me understand') ||
            lowerInput.includes('tell me about') ||
            lowerInput.includes('what about')
        );
    }

    /**
     * Enhanced direct editing command detection for 90% of cases
     */
    private isDirectEditingCommand(lowerInput: string): boolean {
        try {
            if (!lowerInput || typeof lowerInput !== 'string') {
                return false;
            }

            // Direct command verbs at start of input (highest confidence)
            const directCommands = /^(add|write|create|insert|make|generate|compose|draft|build|construct|produce)\s+/i;
            if (directCommands.test(lowerInput)) {
                return true;
            }

            // Action verbs with clear editing intent (avoid question patterns)
            // Don't match questions that contain these verbs
            const questionStarts = /^(what|why|how|when|where|who|can you|could you|would you|should i)\b/i;
            if (!questionStarts.test(lowerInput) && !lowerInput.includes('?')) {
                const editingVerbs = /\b(fix|improve|change|edit|rewrite|update|modify|revise|enhance|refine|polish|correct|adjust)\b/i;
                if (editingVerbs.test(lowerInput)) {
                    return true;
                }
            }

            // Document manipulation commands
            const documentCommands = /\b(delete|remove|clear|replace|substitute|swap|rearrange|reorganize)\b/i;
            if (documentCommands.test(lowerInput)) {
                return true;
            }

            // Specific content requests
            const contentRequests = /\b(paragraph|section|heading|bullet|list|table|summary|conclusion|introduction|outline)\b/i;
            if (contentRequests.test(lowerInput) && !this.isQuestion(lowerInput)) {
                return true;
            }

            return false;
        } catch (error) {
            Logger.warn('Error in isDirectEditingCommand:', error);
            return false;
        }
    }

    /**
     * Enhanced fallback classification for ambiguous cases
     */
    private enhancedFallbackClassification(userInput: string, _fastResult: { intent: UserIntent; confidence: number }): UserIntent {
        const lowerInput = userInput.toLowerCase().trim();

        // Check for subtle editing patterns that fast classification might miss
        const subtleEditingPatterns = [
            /\bmake\s+(this|it|that)\s+(better|clearer|shorter|longer|more|less)\b/i,
            /\b(this|it|that)\s+(needs|requires|should|could)\s+(to\s+be\s+)?(better|clearer|improved|fixed|changed)\b/i,
            /\b(here|there)\s+(is|are)\s+(some|too|not)\s+(issues?|problems?|errors?)\b/i,
            /\blet\s*'?s\s+(add|change|fix|improve|make|create)\b/i,
        ];

        for (const pattern of subtleEditingPatterns) {
            if (pattern.test(userInput)) {
                if (this.isMetadataRelated(lowerInput)) {
                    return 'METADATA';
                }
                return 'CONTENT';
            }
        }

        // Check for conversational patterns
        const conversationalPatterns = [
            /\b(i\s+(think|feel|believe|wonder|notice|see|realize|understand))\b/i,
            /\b(it\s+(seems|appears|looks|feels)\s+like)\b/i,
            /\b(reminds\s+me|makes\s+me\s+think)\b/i,
            /\b(lately|recently|nowadays|these\s+days)\b/i,
        ];

        for (const pattern of conversationalPatterns) {
            if (pattern.test(userInput)) {
                return 'CHAT';
            }
        }

        // For truly ambiguous cases, use context clues
        // Favor CONTENT for inputs with command-like structure
        if (/^[a-z]+\s+[a-z]/i.test(lowerInput) && !this.isQuestion(lowerInput)) {
            return 'CONTENT';
        }

        // Default to CHAT for safety (prevents unwanted edits)
        return 'CHAT';
    }

    /**
     * Enhanced fallback classification using IntentDetector
     */
    private fallbackClassification(userInput: string): UserIntent {
        const lowerInput = userInput.toLowerCase().trim();

        // Check for greetings FIRST (highest priority)
        if (this.isGreeting(lowerInput)) {
            return 'CHAT';
        }

        // Check for questions SECOND (high priority)
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

        // Handle ambiguous cases - check metadata patterns first, then default to chat
        if (intentClassification.type === 'ambiguous') {
            // Check metadata patterns even for ambiguous cases
            if (this.isMetadataRelated(lowerInput)) {
                return 'METADATA';
            }
            
            // For unclear inputs, default to chat
            return 'CHAT';
        }

        // For remaining cases, check metadata patterns
        if (this.isMetadataRelated(lowerInput)) {
            return 'METADATA';
        }

        // Default to chat for anything else that doesn't clearly indicate editing intent
        return 'CHAT';
    }

    /**
     * Helper method to check if input is a greeting
     */
    private isGreeting(lowerInput: string): boolean {
        return (
            // Basic greetings
            /^(hi|hello|hey|hiya|howdy)(\s|$)/i.test(lowerInput) ||
            // Greetings with Nova
            /^(hi|hello|hey|hiya|howdy)\s+(nova|there)(\s|$)/i.test(lowerInput) ||
            // Time-based greetings
            /^(good\s+(morning|afternoon|evening|night))(\s|$)/i.test(lowerInput) ||
            // Just "nova" as a greeting
            /^nova(\s|$)/i.test(lowerInput)
        );
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