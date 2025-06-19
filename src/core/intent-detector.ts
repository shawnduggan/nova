export interface IntentClassification {
    type: 'consultation' | 'editing' | 'ambiguous';
    confidence: number;
    matchedPatterns: string[];
}

export class IntentDetector {
    private consultationPatterns = [
        { pattern: /^(Now is|Today|This week|Lately|Currently|These days)/i, name: 'temporal' },
        { pattern: /\b(I'm (feeling|thinking|working|trying)|I've been|I was|I feel)\b/i, name: 'personal_state' },
        { pattern: /\b(reminds me|makes me think|I wonder|I'm wondering)\b/i, name: 'reflective' }
    ];

    private editingPatterns = [
        { pattern: /\b(mak(e|ing)|fix|improve|change|add|remove|rewrite|edit)\b/i, name: 'command_verb' },
        { pattern: /\b(this (section|paragraph|part|text|writing|better)|the writing here|here we|here needs|this is (unclear|wrong|confusing|right))\b/i, name: 'document_reference' },
        { pattern: /\b(unclear|needs work|sounds wrong|too wordy|confusing)\b/i, name: 'quality_assessment' },
        { pattern: /\b(at the end|in the (introduction|conclusion)|before this|after that)\b/i, name: 'document_targeting' }
    ];

    classifyInput(input: string): IntentClassification {
        const consultationMatches: string[] = [];
        const editingMatches: string[] = [];
        
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

        // If only consultation patterns match
        if (consultationMatches.length > 0 && editingMatches.length === 0) {
            return {
                type: 'consultation',
                confidence: 0.9,
                matchedPatterns: consultationMatches
            };
        }

        // If only editing patterns match
        if (editingMatches.length > 0 && consultationMatches.length === 0) {
            return {
                type: 'editing',
                confidence: 0.9,
                matchedPatterns: editingMatches
            };
        }

        return {
            type: 'ambiguous',
            confidence: 0.5,
            matchedPatterns: []
        };
    }
}