/**
 * @file SelectionEditCommand - Handles editing selected text
 */

import { Editor, EditorPosition, Notice } from 'obsidian';
import NovaPlugin from '../../../main';
import { Logger } from '../../utils/logger';

export interface SelectionEditResult {
    success: boolean;
    transformedText?: string;
    error?: string;
    originalRange?: {
        from: EditorPosition;
        to: EditorPosition;
    };
}

export class SelectionEditCommand {
    constructor(private plugin: NovaPlugin) {}

    /**
     * Execute a selection-based edit action
     */
    async execute(action: string, editor: Editor, selectedText: string, customInstruction?: string): Promise<SelectionEditResult> {
        try {
            // Get selection range for later replacement
            const selectionRange = {
                from: editor.getCursor('from'),
                to: editor.getCursor('to')
            };

            // Show loading indicator
            const loadingNotice = new Notice('Nova is processing your request...', 0);

            // Generate prompt based on action
            const prompt = this.buildPrompt(action, selectedText, customInstruction);
            
            // Get AI response using the provider manager
            const response = await this.plugin.aiProviderManager.complete(
                prompt.systemPrompt,
                prompt.userPrompt
            );

            loadingNotice.hide();

            // Use response directly without cleaning
            const transformedText = response.trim();

            return {
                success: true,
                transformedText,
                originalRange: selectionRange
            };

        } catch (error) {
            Logger.error('Selection edit command error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            };
        }
    }

    /**
     * Execute a selection-based edit action with streaming
     */
    async executeStreaming(
        action: string,
        editor: Editor,
        selectedText: string,
        onChunk: (chunk: string, isComplete: boolean) => void,
        customInstruction?: string,
        signal?: AbortSignal
    ): Promise<SelectionEditResult> {
        try {
            // Get selection range for later replacement
            const selectionRange = {
                from: editor.getCursor('from'),
                to: editor.getCursor('to')
            };

            // Generate prompt based on action
            const prompt = this.buildPrompt(action, selectedText, customInstruction);

            let fullResponse = '';

            // Stream AI response with signal for cancellation
            const stream = this.plugin.aiProviderManager.generateTextStream(prompt.userPrompt, {
                systemPrompt: prompt.systemPrompt,
                signal: signal
            });

            for await (const chunk of stream) {
                // Check if operation was aborted
                if (signal?.aborted) {
                    break;
                }

                if (chunk.error) {
                    throw new Error(chunk.error);
                }

                fullResponse += chunk.content;

                // Pass through all chunks without modification
                if (fullResponse.trim().length > 0 || chunk.done) {
                    onChunk(fullResponse, chunk.done);
                }

                if (chunk.done) {
                    break;
                }
            }

            // Check if we actually got a response
            if (!fullResponse.trim()) {
                return {
                    success: false,
                    error: signal?.aborted ? 'Operation canceled' : 'AI provider returned empty response',
                    originalRange: selectionRange
                };
            }

            return {
                success: true,
                transformedText: fullResponse.trim(),
                originalRange: selectionRange
            };

        } catch (error) {
            Logger.error('Selection edit streaming error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            };
        }
    }

    /**
     * Build prompt for the AI based on the action type
     */
    private buildPrompt(action: string, selectedText: string, customInstruction?: string): {
        systemPrompt: string;
        userPrompt: string;
    } {
        const baseSystemPrompt = `You are Nova, an AI writing assistant. Your task is to transform the provided text according to the user's request. 

CRITICAL RULES:
- Provide ONLY the transformed text, no explanations or meta-commentary
- Start your response immediately with the first word of the transformed text
- Do NOT add any introductory phrases like "Here's the...", "The following is...", "Here's a longer version...", etc.
- Do NOT add any concluding phrases or explanations after the transformed text
- Maintain the original meaning unless specifically asked to change it
- Preserve the original format (markdown, structure, etc.) unless instructed otherwise
- Return only the content that should replace the selected text

EXAMPLES:
❌ WRONG: "Here's the improved text: Your original text but improved."
✅ CORRECT: "Your original text but improved."
❌ WRONG: "Here's a shorter version: Condensed text."
✅ CORRECT: "Condensed text."`;

        let specificPrompt = '';
        let userPrompt = '';

        switch (action) {
            case 'improve':
                specificPrompt = `
TASK: Improve the writing quality
- Make the text clearer and more concise
- Improve flow and readability
- Fix any awkward phrasing
- Preserve the original tone and meaning`;
                userPrompt = `Improve this text:\n\n${selectedText}`;
                break;

            case 'longer':
                specificPrompt = `
TASK: Expand the text with more detail
- Add relevant examples, context, or explanations
- Maintain the original style and voice
- Expand ideas without changing the core message
- Make it more comprehensive and detailed`;
                userPrompt = `Make this text longer and more detailed:\n\n${selectedText}`;
                break;

            case 'shorter':
                specificPrompt = `
TASK: Condense the text to essential points
- Remove redundancy and unnecessary words
- Keep all key information and meaning
- Make it more concise and direct
- Preserve the original tone`;
                userPrompt = `Make this text shorter and more concise:\n\n${selectedText}`;
                break;

            case 'tone': {
                const toneMap: Record<string, string> = {
                    'formal': 'professional and structured, suitable for business or academic contexts',
                    'casual': 'relaxed and conversational, suitable for informal communication',
                    'academic': 'scholarly and precise, using technical vocabulary where appropriate',
                    'friendly': 'warm and approachable, building connection with the reader'
                };
                
                const toneDescription = toneMap[customInstruction || 'formal'] || toneMap.formal;
                specificPrompt = `
TASK: Change the tone to be ${toneDescription}
- Adjust language and vocabulary to match the requested tone
- Keep the same content and meaning
- Maintain appropriate formality level for the chosen tone`;
                userPrompt = `Rewrite this text in a ${customInstruction || 'formal'} tone:\n\n${selectedText}`;
                break;
            }

            case 'custom':
                specificPrompt = `
TASK: Apply custom transformation
- Follow the user's specific instruction exactly
- Maintain content integrity unless asked to change it
- Apply the requested changes precisely`;
                userPrompt = `Apply this instruction to the text: "${String(customInstruction)}"\n\nText to transform:\n\n${selectedText}`;
                break;

            default:
                specificPrompt = `
TASK: General text improvement
- Enhance clarity and readability
- Preserve original meaning and tone`;
                userPrompt = `Improve this text:\n\n${selectedText}`;
        }

        return {
            systemPrompt: baseSystemPrompt + '\n' + specificPrompt,
            userPrompt
        };
    }

}