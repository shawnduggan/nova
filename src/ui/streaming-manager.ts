/**
 * @file StreamingManager - Manages AI response streaming to editor
 */

import { Editor, Notice, EditorPosition } from 'obsidian';
import { Logger } from '../utils/logger';
import { TimeoutManager } from '../utils/timeout-manager';
import type NovaPlugin from '../../main';

export interface StreamingOptions {
    onChunk?: (chunk: string, isComplete: boolean) => void;
    onComplete?: () => void;
    onError?: (error: Error) => void;
    animationMode?: 'notice' | 'inline'; // Controls whether to use Notice animations or inline
    scrollBehavior?: 'smooth' | 'instant'; // Scroll animation style (default: 'smooth')
}

export type ActionType = 'improve' | 'longer' | 'shorter' | 'tone' | 'custom' | 'chat' | 'add' | 'edit' | 'rewrite' | 'grammar' | 'delete';

export class StreamingManager {
    private plugin: NovaPlugin;
    private dotsAnimationInterval: number | null = null;
    private thinkingNotice: Notice | null = null;
    private currentStreamingEndPos: EditorPosition | null = null;
    private streamingStartPos: EditorPosition | null = null;
    private originalPosition: { from: EditorPosition; to?: EditorPosition } | null = null;
    private scrollThrottleTimeout: number | null = null;
    private timeoutManager = new TimeoutManager();

    constructor(plugin: NovaPlugin) {
        this.plugin = plugin;
    }
    
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
            this.thinkingNotice = new Notice(`${randomPhrase}.`, 0);
            
            // Show initial state with 1 dot immediately
            const initialNoticeText = `${randomPhrase}.`;
            const noticeWithEl = this.thinkingNotice as Notice & { messageEl?: HTMLElement };
            const messageEl = noticeWithEl.messageEl;
            if (messageEl) {
                messageEl.textContent = initialNoticeText;
            }
            
            // Start cycling animation with all phrases for this action type
            this.startNoticeDotsAnimation(actionType);
            
        } catch (error) {
            Logger.warn('Failed to create thinking notice:', error);
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
        startPos: EditorPosition,
        endPos?: EditorPosition,
        options: StreamingOptions = {}
    ): {
        updateStream: (newText: string, isComplete: boolean) => void;
        stopStream: () => void;
    } {
        // Clear margin indicators when streaming starts
        if (this.plugin.marginIndicators?.clearIndicators) {
            this.plugin.marginIndicators.clearIndicators();
        }
        
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
    private magicalScrollToCursor(editor: Editor, position: EditorPosition, options: StreamingOptions): void {
        // Use throttled updates for smooth 60fps experience
        if (this.scrollThrottleTimeout) {
            this.timeoutManager.removeTimeout(this.scrollThrottleTimeout);
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
                    
                    Logger.debug('Magical scroll: smooth scroll to line', position.line);
                } else {
                    // Instant scroll for performance when configured
                    editor.scrollIntoView({
                        from: position,
                        to: position
                    }, false);
                    
                    Logger.debug('Magical scroll: instant scroll to line', position.line);
                }
            } catch (error) {
                // Make failures visible during development
                Logger.warn('Magical scroll failed:', error);
            }
        };
        
        // Immediate scroll for responsive experience
        performScroll();
        
        // Also schedule a throttled update for optimization
        this.scrollThrottleTimeout = this.timeoutManager.addTimeout(() => {
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
            if (isComplete && this.currentStreamingEndPos) {
                editor.setCursor(this.currentStreamingEndPos);
                editor.focus();  // Ensure editor has focus after content insertion
                
                // Re-analyze margin indicators after streaming completes
                if (this.plugin.marginIndicators?.analyzeCurrentContext) {
                    void this.plugin.marginIndicators.analyzeCurrentContext();
                }
                
                this.cleanup();
                
                // Trigger completion callback
                if (options.onComplete) {
                    options.onComplete();
                }
            }
        } catch (error) {
            Logger.warn('Error updating streaming text:', error);
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
        
        this.dotsAnimationInterval = this.plugin.registerInterval(window.setInterval(() => {
            try {
                if (!this.thinkingNotice) return;
                
                // Get current phrase and add dots
                const currentPhrase = phrases[phraseIndex];
                const dots = '.'.repeat(dotCount);
                const noticeText = `${currentPhrase}${dots}`;
                
                // Update notice text directly
                const noticeWithEl = this.thinkingNotice as Notice & { messageEl?: HTMLElement };
            const messageEl = noticeWithEl.messageEl;
                if (messageEl) {
                    messageEl.textContent = noticeText;
                }
                
                // Increment dot count, and when it reaches max, move to next phrase
                dotCount++;
                if (dotCount > 3) {
                    dotCount = 1;
                    phraseIndex = (phraseIndex + 1) % phrases.length;
                }
                
            } catch (error) {
                Logger.warn('Error in notice dots animation:', error);
                this.stopDotsAnimation();
            }
        }, 400));
    }

    /**
     * Stop the dots animation and dismiss notice
     */
    private stopDotsAnimation(): void {
        if (this.dotsAnimationInterval) {
            window.clearInterval(this.dotsAnimationInterval);
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
        // Don't stop notice animation here - let caller control it
        // This allows multi-fill operations to keep the notice visible across fills

        // Clear scroll throttle timeout
        if (this.scrollThrottleTimeout) {
            this.timeoutManager.removeTimeout(this.scrollThrottleTimeout);
            this.scrollThrottleTimeout = null;
        }

        // Clear all timeouts
        this.timeoutManager.clearAll();

        this.currentStreamingEndPos = null;
        this.streamingStartPos = null;
        this.originalPosition = null;
    }

    /**
     * Get the original position before streaming started
     */
    getOriginalPosition(): { from: EditorPosition; to?: EditorPosition } | null {
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
    startSelectionStreaming(
        editor: Editor,
        originalRange: { from: EditorPosition; to: EditorPosition; text: string },
        actionType: ActionType,
        streamingCallback: (chunk: string, isComplete: boolean) => void,
        options: StreamingOptions = {}
    ): (chunk: string, isComplete: boolean) => void {
        // Set animation mode to 'notice' for selection operations
        const selectionOptions = { ...options, animationMode: 'notice' as const };
        
        // Show thinking notice for selection operations
        this.showThinkingNotice(actionType, 'notice');
        
        // Clear the selection and prepare for streaming
        editor.replaceRange('', originalRange.from, originalRange.to);
        this.currentStreamingEndPos = originalRange.from;
        this.streamingStartPos = null;

        // Create the streaming interface
        const { updateStream } = this.startStreaming(
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
        return wrappedCallback;
    }
}