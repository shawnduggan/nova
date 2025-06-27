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

        // Try AI classification first with improved error handling
        try {
            // Simplified prompt for better compatibility
            const prompt = `Classify this text as CHAT, METADATA, or CONTENT:
"${userInput}"

CHAT = questions/discussion/analysis
METADATA = tags/properties/frontmatter  
CONTENT = edit document text/add content

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
            console.warn('AI intent classification failed, using fallback:', error);
            // Use fallback heuristic
            return this.fallbackClassification(userInput);
        }
    }

    /**
     * Enhanced fallback classification using IntentDetector
     */
    private fallbackClassification(userInput: string): UserIntent {
        const lowerInput = userInput.toLowerCase().trim();

        // Check for specific greetings FIRST
        if (this.isGreeting(lowerInput)) {
            return 'CHAT';
        }

        // Check for explicit questions SECOND (high priority)
        if (this.isQuestion(lowerInput)) {
            return 'CHAT';
        }

        // Check for primary editing verbs at start of sentence THIRD (for cursor insertion)
        if (this.isPrimaryEditingAction(lowerInput)) {
            // Check if it's metadata-related editing
            if (this.isMetadataRelated(lowerInput)) {
                return 'METADATA';
            }
            return 'CONTENT';
        }

        // Check for primary analysis/discussion verbs that should be chat FOURTH
        if (this.isPrimaryAnalysisAction(lowerInput)) {
            return 'CHAT';
        }

        // Fallback to general editing verb detection FIFTH
        if (this.isEditingVerb(lowerInput)) {
            // Check if it's metadata-related editing
            if (this.isMetadataRelated(lowerInput)) {
                return 'METADATA';
            }
            return 'CONTENT';
        }

        // Use IntentDetector for consultation vs editing patterns SIXTH
        const intentClassification = this.intentDetector.classifyInput(userInput);
        
        // Map IntentDetector results to our system, prioritizing editing
        if (intentClassification.type === 'editing') {
            // Check if it's metadata-related editing
            if (this.isMetadataRelated(lowerInput)) {
                return 'METADATA';
            }
            return 'CONTENT';
        }
        
        if (intentClassification.type === 'consultation') {
            return 'CHAT';
        }

        // Handle ambiguous cases - check metadata patterns first
        if (intentClassification.type === 'ambiguous') {
            // Check metadata patterns for ambiguous cases
            if (this.isMetadataRelated(lowerInput)) {
                return 'METADATA';
            }
            
            // For single editing words, default to CONTENT for cursor insertion
            if (this.isSingleEditingWord(lowerInput)) {
                return 'CONTENT';
            }
            
            // For other unclear inputs, default to chat
            return 'CHAT';
        }

        // Final check for metadata patterns
        if (this.isMetadataRelated(lowerInput)) {
            return 'METADATA';
        }

        // Default to CONTENT for any remaining editing-like inputs, CHAT for others
        return this.containsEditingLanguage(lowerInput) ? 'CONTENT' : 'CHAT';
    }

    /**
     * Check if input contains explicit editing verbs that should trigger cursor insertion
     */
    private isEditingVerb(lowerInput: string): boolean {
        const editingVerbs = [
            'write', 'add', 'create', 'insert', 'make', 'fix', 'improve', 'change', 
            'edit', 'compose', 'draft', 'generate', 'modify', 'update', 'revise', 
            'enhance', 'append', 'prepend', 'correct', 'adjust', 'expand', 'shorten', 
            'condense', 'rewrite', 'remove', 'delete'
        ];
        
        // Check if the input starts with or prominently contains editing verbs
        return editingVerbs.some(verb => {
            return lowerInput === verb || 
                   lowerInput.startsWith(verb + ' ') ||
                   new RegExp(`\\b${verb}\\b`).test(lowerInput);
        });
    }

    /**
     * Check if input has a primary editing action at the start (higher priority than mixed cases)
     */
    private isPrimaryEditingAction(lowerInput: string): boolean {
        const primaryEditingVerbs = [
            'write', 'add', 'create', 'insert', 'make', 'edit', 'compose', 'draft', 
            'generate', 'modify', 'update', 'revise', 'enhance', 'append', 'prepend'
        ];
        
        // Check if input starts with primary editing verbs
        return primaryEditingVerbs.some(verb => {
            return lowerInput === verb || lowerInput.startsWith(verb + ' ');
        });
    }

    /**
     * Check if input has a primary analysis action at the start (not mixed with editing)
     */
    private isPrimaryAnalysisAction(lowerInput: string): boolean {
        const primaryAnalysisVerbs = [
            'summarize', 'analyze', 'describe', 'discuss', 'review',
            'evaluate', 'assess', 'compare', 'contrast', 'tell', 'show', 'list',
            'find', 'search', 'identify', 'explain'
        ];
        
        // Check if input starts with primary analysis verbs (not embedded in editing context)
        return primaryAnalysisVerbs.some(verb => {
            return lowerInput === verb || lowerInput.startsWith(verb + ' ');
        });
    }

    /**
     * Check if input contains analysis/discussion verbs that should be chat
     */
    private isAnalysisVerb(lowerInput: string): boolean {
        const analysisVerbs = [
            'summarize', 'analyze', 'describe', 'discuss', 'review',
            'evaluate', 'assess', 'compare', 'contrast', 'tell', 'show', 'list',
            'find', 'search', 'identify'
        ];
        
        // Check for analysis verbs, but exclude 'explain' when it's in a question format
        const hasAnalysisVerb = analysisVerbs.some(verb => {
            return lowerInput === verb || 
                   lowerInput.startsWith(verb + ' ') ||
                   new RegExp(`\\b${verb}\\b`).test(lowerInput);
        });
        
        // Special handling for 'explain' - only treat as analysis if not in question format
        const hasExplain = /\bexplain\b/.test(lowerInput);
        if (hasExplain && !hasAnalysisVerb) {
            // If it's a question format with explain, it should be handled by question detection
            if (/^(can you|could you|please)\s.*explain/.test(lowerInput) || 
                /^(what|why|how|when|where|who)\s.*explain/.test(lowerInput) ||
                lowerInput.includes('?')) {
                return false;
            }
            return true;
        }
        
        return hasAnalysisVerb;
    }

    /**
     * Check if input is a single editing word (for cursor insertion)
     */
    private isSingleEditingWord(lowerInput: string): boolean {
        const singleWords = ['add', 'write', 'create', 'insert', 'make', 'edit', 'fix'];
        return singleWords.includes(lowerInput.trim());
    }

    /**
     * Check if input contains general editing language
     */
    private containsEditingLanguage(lowerInput: string): boolean {
        return /\b(better|clearer|more|less|section|paragraph|text|content|here|this)\b/.test(lowerInput);
    }

    /**
     * Helper method to check if input is a greeting (more restrictive)
     */
    private isGreeting(lowerInput: string): boolean {
        return (
            // Must be exact matches or followed by space/punctuation
            /^(hi|hello|hey|hiya|howdy)(\s|$|[.,!?])/i.test(lowerInput) ||
            // Greetings with Nova (exact match)
            /^(hi|hello|hey|hiya|howdy)\s+(nova|there)(\s|$|[.,!?])/i.test(lowerInput) ||
            // Time-based greetings (exact match at start)
            /^(good\s+(morning|afternoon|evening|night))(\s|$|[.,!?])/i.test(lowerInput) ||
            // Just "nova" as a greeting (exact match)
            /^nova(\s|$|[.,!?])/i.test(lowerInput)
        );
    }

    /**
     * Helper method to check if input is a question (more restrictive)
     */
    private isQuestion(lowerInput: string): boolean {
        return (
            // Must contain question mark
            lowerInput.includes('?') ||
            // Question words at start followed by space
            /^(what|why|how|when|where|who)\s/.test(lowerInput) ||
            // Explicit help requests
            /^(can you|could you|please)\s/.test(lowerInput) ||
            // Contains explain with context
            (/\bexplain\b/.test(lowerInput) && lowerInput.length > 10) ||
            // Help me understand
            /\bhelp me understand\b/.test(lowerInput)
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