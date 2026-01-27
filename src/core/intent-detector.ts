/**
 * @file IntentDetector - Classifies user input as editing vs consultation
 */

import { Logger } from '../utils/logger';

export interface IntentClassification {
    type: 'consultation' | 'editing' | 'ambiguous';
    confidence: number;
    matchedPatterns: string[];
}

export class IntentDetector {
    private consultationPatterns = [
        // Enhanced temporal context indicators
        { pattern: /^(Now is|Today|This week|Lately|Currently|These days|Recently|Nowadays|At the moment)/i, name: 'temporal' },
        
        // Enhanced personal state sharing with more patterns
        { pattern: /\b(I'm (feeling|thinking|working|trying|struggling|wondering|concerned|worried|excited|curious)|I've been|I was|I feel|I find myself|I tend to|I usually|I often)\b/i, name: 'personal_state' },
        
        // Enhanced reflective language
        { pattern: /\b(reminds me|makes me think|I wonder|I'm wondering|I'm curious|it occurs to me|I realize|I've noticed|I've observed|I've learned)\b/i, name: 'reflective' },
        
        // Enhanced opinion and observation patterns
        { pattern: /\b(I think|I believe|I suspect|I notice|seems like|appears|looks like|I assume|I imagine|I suppose|I reckon|I sense|I get the impression)\b/i, name: 'opinion_observation' },
        
        // Enhanced speculation patterns
        { pattern: /\b(might be|could be|may be|probably|perhaps|maybe|possibly|likely|unlikely|I doubt|not sure if|uncertain whether)\b/i, name: 'speculation' },
        
        // Conversational openings and context sharing
        { pattern: /\b(by the way|speaking of|that reminds me|on a related note|incidentally|interestingly|actually|to be honest|frankly)\b/i, name: 'conversational' },
        
        // Experience sharing patterns
        { pattern: /\b(in my experience|from what I've seen|in my opinion|from my perspective|as I see it|the way I look at it)\b/i, name: 'experience_sharing' }
    ];

    private editingPatterns = [
        // Enhanced command verbs with more comprehensive coverage
        { pattern: /\b(write|mak(e|ing)|fix|improve|change|add|remove|rewrite|edit|create|compose|draft|generate|insert|delete|update|modify|revise|enhance|refine|polish|correct|adjust|build|construct|produce)\b/i, name: 'command_verb' },
        
        // Enhanced document references with clearer patterns  
        { pattern: /\b(this (section|paragraph|part|text|writing|sentence|phrase|word|line)|the writing here|here we|here needs|this is (unclear|wrong|confusing|right|awkward|verbose|redundant))\b/i, name: 'document_reference' },
        
        // Enhanced quality assessments
        { pattern: /\b(unclear|needs work|sounds wrong|too wordy|confusing|awkward|redundant|verbose|repetitive|hard to read|difficult to understand|not clear|poorly written)\b/i, name: 'quality_assessment' },
        
        // Enhanced document targeting with more specific locations
        { pattern: /\b(at the (end|beginning|start|top|bottom)|in the (introduction|conclusion|middle|summary|abstract)|before (this|that)|after (this|that)|between these|above this|below that)\b/i, name: 'document_targeting' },
        
        // Direct content type requests
        { pattern: /\b(paragraph|section|heading|bullet point|list|table|summary|conclusion|introduction|outline|example|citation|reference)\b/i, name: 'content_type' },
        
        // Imperative mood indicators (stronger editing intent)
        { pattern: /^(let\s*'?s\s+(add|change|fix|improve|make|create)|please\s+(add|change|fix|improve|make|create)|can\s+you\s+(add|change|fix|improve|make|create))/i, name: 'imperative_request' }
    ];

    classifyInput(input: string): IntentClassification {
        if (!input || typeof input !== 'string') {
            return {
                type: 'ambiguous',
                confidence: 0.0,
                matchedPatterns: []
            };
        }

        const consultationMatches: string[] = [];
        const editingMatches: string[] = [];
        
        // Safe pattern matching with error handling
        try {
            for (const { pattern, name } of this.consultationPatterns) {
                if (pattern.test(input)) {
                    consultationMatches.push(name);
                }
            }

            for (const { pattern, name } of this.editingPatterns) {
                if (pattern.test(input)) {
                    editingMatches.push(name);
                }
            }
        } catch (error) {
            Logger.warn('Pattern matching error in IntentDetector:', error);
            return {
                type: 'ambiguous',
                confidence: 0.3,
                matchedPatterns: []
            };
        }

        // Calculate confidence based on number and strength of matches
        const consultationScore = this.calculateMatchScore(consultationMatches);
        const editingScore = this.calculateMatchScore(editingMatches);

        // If only consultation patterns match
        if (consultationMatches.length > 0 && editingMatches.length === 0) {
            return {
                type: 'consultation',
                confidence: Math.min(0.95, 0.7 + (consultationScore * 0.1)),
                matchedPatterns: consultationMatches
            };
        }

        // If only editing patterns match
        if (editingMatches.length > 0 && consultationMatches.length === 0) {
            return {
                type: 'editing',
                confidence: Math.min(0.95, 0.7 + (editingScore * 0.1)),
                matchedPatterns: editingMatches
            };
        }

        // If both patterns match, use weighted scoring
        if (consultationMatches.length > 0 && editingMatches.length > 0) {
            // Strong consultation indicators override editing
            const hasStrongConsultation = consultationMatches.includes('speculation') || 
                                        consultationMatches.includes('opinion_observation') ||
                                        consultationMatches.includes('experience_sharing');
            
            // Strong editing indicators override consultation
            const hasStrongEditing = editingMatches.includes('command_verb') ||
                                   editingMatches.includes('imperative_request');

            if (hasStrongConsultation && !hasStrongEditing) {
                return {
                    type: 'consultation',
                    confidence: 0.75,
                    matchedPatterns: consultationMatches
                };
            }

            if (hasStrongEditing && !hasStrongConsultation) {
                return {
                    type: 'editing',
                    confidence: 0.75,
                    matchedPatterns: editingMatches
                };
            }

            // Truly mixed signals - treat as ambiguous
            return {
                type: 'ambiguous',
                confidence: 0.4,
                matchedPatterns: [...consultationMatches, ...editingMatches]
            };
        }

        // No patterns matched
        return {
            type: 'ambiguous',
            confidence: 0.5,
            matchedPatterns: []
        };
    }

    /**
     * Calculate match strength score based on pattern types
     */
    private calculateMatchScore(matches: string[]): number {
        if (matches.length === 0) return 0;
        
        // Weight different pattern types
        const weights: Record<string, number> = {
            'command_verb': 3,
            'imperative_request': 3,
            'temporal': 2,
            'personal_state': 2,
            'experience_sharing': 2,
            'document_reference': 2,
            'content_type': 2,
            'quality_assessment': 1.5,
            'document_targeting': 1.5,
            'opinion_observation': 1,
            'speculation': 1,
            'reflective': 1,
            'conversational': 0.5
        };

        const totalWeight = matches.reduce((sum, match) => sum + (weights[match] || 1), 0);
        return Math.min(totalWeight, 5); // Cap at 5 for confidence calculation
    }
}