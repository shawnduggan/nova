/**
 * Unified streaming and notice management for Nova
 * Provides consistent visual feedback and streaming across all command types
 */

import { Editor, Notice } from 'obsidian';

export interface StreamingOptions {
    onChunk?: (chunk: string, isComplete: boolean) => void;
    onComplete?: () => void;
    onError?: (error: Error) => void;
}

export type ActionType = 'improve' | 'longer' | 'shorter' | 'tone' | 'custom' | 'chat' | 'add' | 'edit' | 'rewrite' | 'grammar' | 'delete';

export class StreamingManager {
    private dotsAnimationInterval: NodeJS.Timeout | null = null;
    private thinkingNotice: Notice | null = null;
    private currentStreamingEndPos: any = null;
    private streamingStartPos: any = null;
    private originalPosition: any = null;

    // Comprehensive thinking phrases for all action types
    private static readonly THINKING_PHRASES: Record<ActionType, string[]> = {
        'improve': [
            'refining...',
            'polishing...',
            'enhancing...',
            'crafting...',
            'perfecting...',
            'smoothing...',
            'sharpening...',
            'elevating...',
            'fine-tuning...',
            'sculpting...'
        ],
        'longer': [
            'expanding...',
            'developing...',
            'elaborating...',
            'building...',
            'enriching...',
            'deepening...',
            'growing...',
            'extending...',
            'amplifying...',
            'unfolding...'
        ],
        'shorter': [
            'condensing...',
            'distilling...',
            'tightening...',
            'focusing...',
            'streamlining...',
            'compressing...',
            'trimming...',
            'clarifying...',
            'simplifying...',
            'concentrating...'
        ],
        'tone': [
            'adjusting tone...',
            'reshaping...',
            'reframing...',
            'adapting...',
            'transforming...',
            'modulating...',
            'recasting...',
            'shifting...',
            'reforming...',
            'reimagining...'
        ],
        'custom': [
            'working on it...',
            'considering...',
            'thinking...',
            'processing...',
            'analyzing...',
            'contemplating...',
            'understanding...',
            'interpreting...',
            'exploring...',
            'evaluating...'
        ],
        'chat': [
            'composing...',
            'drafting...',
            'creating...',
            'generating...',
            'writing...',
            'crafting...',
            'formulating...',
            'developing...',
            'building...',
            'constructing...'
        ],
        'add': [
            'composing...',
            'drafting...',
            'creating...',
            'generating...',
            'writing...',
            'crafting...',
            'formulating...',
            'developing...',
            'building...',
            'constructing...'
        ],
        'edit': [
            'refining...',
            'polishing...',
            'enhancing...',
            'crafting...',
            'perfecting...',
            'smoothing...',
            'sharpening...',
            'elevating...',
            'fine-tuning...',
            'sculpting...'
        ],
        'rewrite': [
            'refining...',
            'polishing...',
            'enhancing...',
            'crafting...',
            'perfecting...',
            'smoothing...',
            'sharpening...',
            'elevating...',
            'fine-tuning...',
            'sculpting...'
        ],
        'grammar': [
            'refining...',
            'polishing...',
            'enhancing...',
            'crafting...',
            'perfecting...',
            'smoothing...',
            'sharpening...',
            'elevating...',
            'fine-tuning...',
            'sculpting...'
        ],
        'delete': [
            'condensing...',
            'distilling...',
            'tightening...',
            'focusing...',
            'streamlining...',
            'compressing...',
            'trimming...',
            'clarifying...',
            'simplifying...',
            'concentrating...'
        ]
    };

    /**
     * Show thinking notice with context-aware phrase and animated dots
     */
    showThinkingNotice(actionType: ActionType): void {
        try {
            // Select random phrase based on action type
            const phrases = StreamingManager.THINKING_PHRASES[actionType] || StreamingManager.THINKING_PHRASES['chat'];
            const randomPhrase = phrases[Math.floor(Math.random() * phrases.length)];
            
            // Create persistent notice (0 timeout = manual dismissal)
            this.thinkingNotice = new Notice(`Nova: ${randomPhrase}.`, 0);
            
            // Show initial state with 1 dot immediately
            const initialNoticeText = `Nova: ${randomPhrase}.`;
            const noticeEl = (this.thinkingNotice as any).noticeEl;
            if (noticeEl) {
                noticeEl.textContent = initialNoticeText;
            }
            
            // Start dots animation in notice
            this.startNoticeDotsAnimation(randomPhrase);
            
        } catch (error) {
            console.warn('Failed to create thinking notice:', error);
        }
    }

    /**
     * Start streaming at a specific position with hybrid approach
     * For selection replacement: startPos and endPos define the range to replace
     * For cursor insertion: startPos is the cursor position, endPos should be null
     */
    startStreaming(
        editor: Editor, 
        startPos: any, 
        endPos?: any, 
        options: StreamingOptions = {}
    ): {
        updateStream: (newText: string, isComplete: boolean) => void;
        stopStream: () => void;
    } {
        // Store original position(s)
        this.originalPosition = { from: startPos, to: endPos };
        
        if (endPos) {
            // Selection replacement mode - clear the selection
            editor.replaceRange('', startPos, endPos);
            this.currentStreamingEndPos = startPos;
        } else {
            // Cursor insertion mode - set position for streaming
            this.currentStreamingEndPos = startPos;
        }
        
        this.streamingStartPos = null; // Will be set on first chunk

        const updateStream = (newText: string, isComplete: boolean) => {
            this.updateStreamingText(editor, newText, isComplete, options);
        };

        const stopStream = () => {
            this.stopAnimation();
            this.cleanup();
        };

        return { updateStream, stopStream };
    }

    /**
     * Update streaming text with proper position tracking
     */
    private updateStreamingText(
        editor: Editor, 
        newText: string, 
        isComplete: boolean,
        options: StreamingOptions
    ): void {
        try {
            if (this.currentStreamingEndPos) {
                // Stop the notice animation since streaming is starting (only on first chunk)
                if (this.thinkingNotice) {
                    this.stopDotsAnimation();
                }
                
                // If we don't have a start position yet, set it
                if (!this.streamingStartPos) {
                    this.streamingStartPos = { ...this.currentStreamingEndPos };
                }
                
                // Calculate new end position based on the complete new text
                const lines = newText.split('\n');
                const newEndPos = {
                    line: this.streamingStartPos.line + lines.length - 1,
                    ch: lines.length > 1 ? lines[lines.length - 1].length : this.streamingStartPos.ch + newText.length
                };

                // Replace all content from start to current end with new text
                editor.replaceRange(newText, this.streamingStartPos, this.currentStreamingEndPos);
                this.currentStreamingEndPos = newEndPos;

                // Trigger chunk callback
                if (options.onChunk) {
                    options.onChunk(newText, isComplete);
                }
            }
            
            // Set cursor at the end of the new text only when complete
            if (isComplete) {
                editor.setCursor(this.currentStreamingEndPos);
                this.cleanup();
                
                // Trigger completion callback
                if (options.onComplete) {
                    options.onComplete();
                }
            }
        } catch (error) {
            console.warn('Error updating streaming text:', error);
            this.cleanup();
            
            // Trigger error callback
            if (options.onError) {
                options.onError(error instanceof Error ? error : new Error(String(error)));
            }
        }
    }

    /**
     * Animate dots in notice text
     */
    private startNoticeDotsAnimation(basePhrase: string): void {
        let dotCount = 1;
        
        this.dotsAnimationInterval = setInterval(() => {
            try {
                if (!this.thinkingNotice) return;
                
                dotCount++;
                if (dotCount > 5) {
                    dotCount = 1;
                }
                
                const dots = '.'.repeat(dotCount);
                const noticeText = `Nova: ${basePhrase}${dots}`;
                
                // Update notice text directly
                const noticeEl = (this.thinkingNotice as any).noticeEl;
                if (noticeEl) {
                    noticeEl.textContent = noticeText;
                }
                
            } catch (error) {
                console.warn('Error in notice dots animation:', error);
                this.stopDotsAnimation();
            }
        }, 400);
    }

    /**
     * Stop the dots animation and dismiss notice
     */
    private stopDotsAnimation(): void {
        if (this.dotsAnimationInterval) {
            clearInterval(this.dotsAnimationInterval);
            this.dotsAnimationInterval = null;
        }
        
        // Dismiss thinking notice
        if (this.thinkingNotice) {
            this.thinkingNotice.hide();
            this.thinkingNotice = null;
        }
    }

    /**
     * Stop all animations and clean up
     */
    stopAnimation(): void {
        this.stopDotsAnimation();
    }

    /**
     * Clean up all internal state
     */
    private cleanup(): void {
        this.currentStreamingEndPos = null;
        this.streamingStartPos = null;
        this.originalPosition = null;
    }

    /**
     * Get the original position before streaming started
     */
    getOriginalPosition(): { from: any; to?: any } | null {
        return this.originalPosition;
    }

    /**
     * Check if currently streaming
     */
    isStreaming(): boolean {
        return this.currentStreamingEndPos !== null;
    }
}