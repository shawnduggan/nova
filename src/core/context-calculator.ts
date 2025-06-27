import { getContextLimit } from '../ai/context-limits';

export interface ContextUsage {
    totalTokens: number;
    contextLimit: number;
    usagePercentage: number;
    breakdown: {
        conversationHistory: number;
        fileAttachments: number;
        currentInput: number;
        recentResponse: number;
    };
}

/**
 * Character-based token estimation (1 token ≈ 4 characters)
 * More accurate than word-based for code/technical content
 */
export function estimateTokens(text: string): number {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
}

/**
 * Calculate total context usage across all sources
 */
export function calculateContextUsage(
    provider: string,
    model: string,
    conversationHistory: Array<{content: string}> = [],
    fileAttachments: Array<{content: string}> = [],
    currentInput: string = '',
    recentResponse: string = '',
    ollamaContextSize: number = 32000
): ContextUsage {
    // Get context limit for the provider/model
    let contextLimit: number;
    if (provider.toLowerCase() === 'ollama') {
        contextLimit = ollamaContextSize;
    } else {
        contextLimit = getContextLimit(provider, model);
    }
    
    // Calculate tokens for each context component
    const conversationTokens = conversationHistory.reduce((total, msg) => {
        return total + estimateTokens(msg.content);
    }, 0);
    
    const fileTokens = fileAttachments.reduce((total, file) => {
        return total + estimateTokens(file.content);
    }, 0);
    
    const inputTokens = estimateTokens(currentInput);
    const responseTokens = estimateTokens(recentResponse);
    
    // Calculate total usage
    const totalTokens = conversationTokens + fileTokens + inputTokens + responseTokens;
    const usagePercentage = Math.round((totalTokens / contextLimit) * 100);
    
    return {
        totalTokens,
        contextLimit,
        usagePercentage,
        breakdown: {
            conversationHistory: conversationTokens,
            fileAttachments: fileTokens,
            currentInput: inputTokens,
            recentResponse: responseTokens
        }
    };
}

/**
 * Get remaining context percentage for display
 */
export function getRemainingContextPercentage(usage: ContextUsage): number {
    return Math.max(0, 100 - usage.usagePercentage);
}

/**
 * Check if context usage is in warning territory
 */
export function getContextWarningLevel(usage: ContextUsage): 'safe' | 'warning' | 'critical' {
    const remainingPercentage = getRemainingContextPercentage(usage);
    
    if (remainingPercentage <= 5) {
        return 'critical';
    } else if (remainingPercentage <= 15) {
        return 'warning';
    } else {
        return 'safe';
    }
}

/**
 * Get formatted context usage string for display
 */
export function formatContextUsage(usage: ContextUsage): string {
    const remainingPercentage = getRemainingContextPercentage(usage);
    const warningLevel = getContextWarningLevel(usage);
    
    if (warningLevel === 'critical') {
        return `${remainingPercentage}% left!`;
    } else {
        return `${remainingPercentage}% left`;
    }
}

/**
 * Get detailed tooltip content for context usage
 */
export function getContextTooltip(usage: ContextUsage): string {
    const { totalTokens, contextLimit, breakdown } = usage;
    const remainingTokens = contextLimit - totalTokens;
    
    const lines = [
        `Context Usage: ${totalTokens.toLocaleString()} / ${contextLimit.toLocaleString()} tokens`,
        `Remaining: ${remainingTokens.toLocaleString()} tokens`,
        '',
        'Breakdown:'
    ];
    
    if (breakdown.conversationHistory > 0) {
        lines.push(`• Conversation: ${breakdown.conversationHistory.toLocaleString()} tokens`);
    }
    
    if (breakdown.fileAttachments > 0) {
        lines.push(`• File context: ${breakdown.fileAttachments.toLocaleString()} tokens`);
    }
    
    if (breakdown.currentInput > 0) {
        lines.push(`• Current input: ${breakdown.currentInput.toLocaleString()} tokens`);
    }
    
    if (breakdown.recentResponse > 0) {
        lines.push(`• Recent response: ${breakdown.recentResponse.toLocaleString()} tokens`);
    }
    
    return lines.join('\n');
}