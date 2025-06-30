/**
 * Unified streaming and notice management for Nova
 * Provides consistent visual feedback and streaming across all command types
 */

import { Editor, Notice } from 'obsidian';

export interface StreamingOptions {
    onChunk?: (chunk: string, isComplete: boolean) => void;
    onComplete?: () => void;
    onError?: (error: Error) => void;
    animationMode?: 'notice' | 'inline'; // Controls whether to use Notice animations or inline
    scrollBehavior?: 'smooth' | 'instant'; // Scroll animation style (default: 'smooth')
}

export type ActionType = 'improve' | 'longer' | 'shorter' | 'tone' | 'custom' | 'chat' | 'add' | 'edit' | 'rewrite' | 'grammar' | 'delete';

export class StreamingManager {
    private dotsAnimationInterval: NodeJS.Timeout | null = null;
    private thinkingNotice: Notice | null = null;
    private currentStreamingEndPos: any = null;
    private streamingStartPos: any = null;
    private originalPosition: any = null;
    private scrollThrottleTimeout: NodeJS.Timeout | null = null;
    
    // Magical scroll configuration
    private static readonly SCROLL_THROTTLE_MS = 16; // 60fps for smooth experience
    // Removed SCROLL_MARGIN - using always-scroll approach instead

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
     * Only shows notice if animation mode is 'notice' or not specified (default)
     */
    showThinkingNotice(actionType: ActionType, animationMode: 'notice' | 'inline' = 'notice'): void {
        // Only show notice for 'notice' mode (menu/selection actions)
        if (animationMode !== 'notice') {
            return;
        }

        try {
            // Select random phrase based on action type for initial display
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
            
            // Start cycling animation with all phrases for this action type
            this.startNoticeDotsAnimation(actionType);
            
        } catch (error) {
            console.warn('Failed to create thinking notice:', error);
        }
    }

    /**
     * Start streaming at a specific position with hybrid approach
     * For selection replacement: startPos and endPos define the range to replace
     * For cursor insertion: startPos is the cursor position, endPos should be null
     * 
     * Features magical smooth scroll-to-cursor by default for enhanced UX
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
    /**
     * Magically smooth scroll to keep streaming cursor in view
     * Uses throttling to prevent jerky movements and provides smooth experience
     */
    private magicalScrollToCursor(editor: Editor, position: any, options: StreamingOptions): void {
        // Use throttled updates for smooth 60fps experience
        if (this.scrollThrottleTimeout) {
            clearTimeout(this.scrollThrottleTimeout);
        }
        
        // Immediate scroll for responsive experience
        const performScroll = () => {
            try {
                // Always scroll during streaming to keep cursor visible
                const scrollBehavior = options.scrollBehavior || 'smooth';
                
                if (scrollBehavior === 'smooth') {
                    // Use Obsidian's smooth scroll method
                    editor.scrollIntoView({
                        from: position,
                        to: position
                    }, true); // true enables smooth animation
                    
                    console.debug('Magical scroll: smooth scroll to line', position.line);
                } else {
                    // Instant scroll for performance when configured
                    editor.scrollIntoView({
                        from: position,
                        to: position
                    }, false);
                    
                    console.debug('Magical scroll: instant scroll to line', position.line);
                }
            } catch (error) {
                // Make failures visible during development
                console.warn('Magical scroll failed:', error);
            }
        };
        
        // Immediate scroll for responsive experience
        performScroll();
        
        // Also schedule a throttled update for optimization
        this.scrollThrottleTimeout = setTimeout(() => {
            performScroll();
        }, StreamingManager.SCROLL_THROTTLE_MS);
    }

    private updateStreamingText(
        editor: Editor, 
        newText: string, 
        isComplete: boolean,
        options: StreamingOptions
    ): void {
        try {
            if (this.currentStreamingEndPos) {
                // Keep notice animation running during streaming for notice mode
                // It will be stopped when streaming completes (isComplete = true)
                
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

                // Apply magical smooth scroll to keep cursor in view during streaming
                this.magicalScrollToCursor(editor, this.currentStreamingEndPos, options);

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
    private startNoticeDotsAnimation(actionType: ActionType): void {
        const phrases = StreamingManager.THINKING_PHRASES[actionType] || StreamingManager.THINKING_PHRASES['chat'];
        let phraseIndex = 0;
        let dotCount = 1;
        
        this.dotsAnimationInterval = setInterval(() => {
            try {
                if (!this.thinkingNotice) return;
                
                // Get current phrase and add dots
                const currentPhrase = phrases[phraseIndex];
                const dots = '.'.repeat(dotCount);
                const noticeText = `Nova: ${currentPhrase}${dots}`;
                
                // Update notice text directly
                const noticeEl = (this.thinkingNotice as any).noticeEl;
                if (noticeEl) {
                    noticeEl.textContent = noticeText;
                }
                
                // Increment dot count, and when it reaches max, move to next phrase
                dotCount++;
                if (dotCount > 3) {
                    dotCount = 1;
                    phraseIndex = (phraseIndex + 1) % phrases.length;
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
        // Stop notice animation if it's running
        this.stopDotsAnimation();
        
        // Clear scroll throttle timeout
        if (this.scrollThrottleTimeout) {
            clearTimeout(this.scrollThrottleTimeout);
            this.scrollThrottleTimeout = null;
        }
        
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

    /**
     * Unified streaming method for selection-based operations
     * Handles both notice animations and document updates
     */
    async startSelectionStreaming(
        editor: Editor,
        originalRange: { from: any; to: any; text: string },
        actionType: ActionType,
        streamingCallback: (chunk: string, isComplete: boolean) => void,
        options: StreamingOptions = {}
    ): Promise<void> {
        // Set animation mode to 'notice' for selection operations
        const selectionOptions = { ...options, animationMode: 'notice' as const };
        
        // Show thinking notice for selection operations
        this.showThinkingNotice(actionType, 'notice');
        
        // Clear the selection and prepare for streaming
        editor.replaceRange('', originalRange.from, originalRange.to);
        this.currentStreamingEndPos = originalRange.from;
        this.streamingStartPos = null;

        // Create the streaming interface
        const { updateStream, stopStream } = this.startStreaming(
            editor,
            originalRange.from,
            undefined,
            selectionOptions
        );

        // Set up the callback to forward chunks
        const wrappedCallback = (chunk: string, isComplete: boolean) => {
            updateStream(chunk, isComplete);
            streamingCallback(chunk, isComplete);
        };

        // Return the wrapped callback for external use
        return wrappedCallback as any;
    }
}