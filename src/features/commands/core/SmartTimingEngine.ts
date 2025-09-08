/**
 * SmartTimingEngine - Centralized timing service for command features
 * Manages typing speed detection, debouncing, and intelligent timing decisions
 */

import { Logger } from '../../../utils/logger';
import { SmartVariableResolver } from './SmartVariableResolver';
import type { 
    DocumentType, 
    SmartTimingSettings, 
    TimingDecision, 
    TypingMetrics 
} from '../types';
import type NovaPlugin from '../../../../main';

// Event interfaces for subscribers
export interface TimingEvents {
    'timing-decision': (decision: TimingDecision) => void;
    'typing-metrics-updated': (metrics: TypingMetrics) => void;
    'analysis-scheduled': (delay: number) => void;
}

/**
 * TypingSpeedTracker - Handles real-time typing speed calculation
 */
class TypingSpeedTracker {
    private keystrokeCount = 0;
    private lastKeystrokeTime = 0;
    private typingSpeedWindow: number;

    constructor(typingSpeedWindow: number) {
        this.typingSpeedWindow = typingSpeedWindow;
    }

    updateKeystroke(): TypingMetrics {
        const now = Date.now();
        
        // Reset if too much time has passed
        if (now - this.lastKeystrokeTime > this.typingSpeedWindow) {
            this.keystrokeCount = 0;
        }

        this.keystrokeCount++;
        this.lastKeystrokeTime = now;

        // Calculate WPM (assuming 5 characters per word)
        const timeMinutes = Math.min(this.typingSpeedWindow, now - (this.lastKeystrokeTime - this.typingSpeedWindow)) / 60000;
        const currentWPM = timeMinutes > 0 ? (this.keystrokeCount / 5) / timeMinutes : 0;

        return {
            currentWPM,
            keystrokeCount: this.keystrokeCount,
            isTypingFast: false, // Will be determined by SmartTimingEngine
            timeSinceLastKeystroke: now - this.lastKeystrokeTime
        };
    }

    getCurrentMetrics(): TypingMetrics {
        const now = Date.now();
        const timeMinutes = Math.min(this.typingSpeedWindow, now - (this.lastKeystrokeTime - this.typingSpeedWindow)) / 60000;
        const currentWPM = timeMinutes > 0 ? (this.keystrokeCount / 5) / timeMinutes : 0;

        return {
            currentWPM,
            keystrokeCount: this.keystrokeCount,
            isTypingFast: false, // Will be determined by SmartTimingEngine
            timeSinceLastKeystroke: now - this.lastKeystrokeTime
        };
    }

    updateSettings(typingSpeedWindow: number): void {
        this.typingSpeedWindow = typingSpeedWindow;
    }
}

/**
 * DebounceManager - Handles intelligent debouncing for different event types
 */
class DebounceManager {
    private plugin: NovaPlugin;
    private timers = new Map<string, number>();
    private logger = Logger.scope('DebounceManager');

    constructor(plugin: NovaPlugin) {
        this.plugin = plugin;
    }

    schedule(key: string, callback: () => void, delay: number): void {
        // Clear existing timer for this key
        this.clearTimer(key);

        // Schedule new timer using TimeoutManager
        const timerId = window.setTimeout(() => {
            this.timers.delete(key);
            callback();
        }, delay);

        this.timers.set(key, timerId);
        this.logger.debug(`Scheduled ${key} with ${delay}ms delay`);
    }

    clearTimer(key: string): void {
        const existingTimer = this.timers.get(key);
        if (existingTimer) {
            clearTimeout(existingTimer);
            this.timers.delete(key);
            this.logger.debug(`Cleared timer for ${key}`);
        }
    }

    clearAllTimers(): void {
        for (const key of this.timers.keys()) {
            this.clearTimer(key);
        }
    }

    hasActiveTimer(key: string): boolean {
        return this.timers.has(key);
    }
}

/**
 * SmartTimingEngine - Main service for intelligent timing decisions
 */
export class SmartTimingEngine {
    private plugin: NovaPlugin;
    private variableResolver: SmartVariableResolver;
    private typingTracker: TypingSpeedTracker;
    private debounceManager: DebounceManager;
    private logger = Logger.scope('SmartTimingEngine');

    // Current settings
    private settings: SmartTimingSettings;
    
    // State tracking
    private lastAnalysisTime = 0;
    private currentDocumentType: DocumentType = 'unknown';
    
    // Event subscribers
    private subscribers = new Map<keyof TimingEvents, Array<(...args: any[]) => void>>();

    constructor(plugin: NovaPlugin, variableResolver: SmartVariableResolver) {
        this.plugin = plugin;
        this.variableResolver = variableResolver;
        
        // Initialize default settings
        this.settings = this.getDefaultSettings();
        
        // Initialize components
        this.typingTracker = new TypingSpeedTracker(this.settings.typingSpeedWindow);
        this.debounceManager = new DebounceManager(plugin);
        
        this.logger.info('SmartTimingEngine initialized');
    }

    /**
     * Get default progressive disclosure settings
     */
    private getDefaultSettings(): SmartTimingSettings {
        return {
            showDelay: 3000, // 3 seconds as per spec
            hideOnFastTyping: true,
            fastTypingThreshold: 30, // 30 WPM
            scrollDebounce: 100, // 100ms
            minAnalysisInterval: 1000, // 1 second
            typingSpeedWindow: 60000, // 1 minute
            documentTypeOverrides: {
                'blog': { showDelay: 2000, fastTypingThreshold: 25 },
                'academic': { showDelay: 4000, fastTypingThreshold: 35 },
                'technical': { showDelay: 3500, fastTypingThreshold: 40 },
                'creative': { showDelay: 2500, fastTypingThreshold: 20 },
                'notes': { showDelay: 2000, fastTypingThreshold: 35 },
                'unknown': {}
            }
        };
    }

    /**
     * Handle editor input event
     */
    onEditorInput(): void {
        // Update typing metrics
        const metrics = this.typingTracker.updateKeystroke();
        const enhancedMetrics = {
            ...metrics,
            isTypingFast: metrics.currentWPM > this.getEffectiveSetting('fastTypingThreshold')
        };

        // Emit metrics update
        this.emit('typing-metrics-updated', enhancedMetrics);

        // Make timing decision
        const decision = this.makeTimingDecision(enhancedMetrics);
        this.emit('timing-decision', decision);

        // Schedule analysis if appropriate
        if (decision.shouldShow && decision.nextCheckDelay) {
            this.scheduleAnalysis(decision.nextCheckDelay);
        }
    }

    /**
     * Handle scroll event
     */
    onScroll(): void {
        const scrollDebounce = this.getEffectiveSetting('scrollDebounce');
        
        this.debounceManager.schedule('scroll-analysis', () => {
            // After scroll stops, check if we should analyze again
            const metrics = this.typingTracker.getCurrentMetrics();
            const enhancedMetrics = {
                ...metrics,
                isTypingFast: metrics.currentWPM > this.getEffectiveSetting('fastTypingThreshold')
            };
            
            const decision = this.makeTimingDecision(enhancedMetrics, 'scroll');
            this.emit('timing-decision', decision);
            
            if (decision.shouldShow && decision.nextCheckDelay) {
                this.scheduleAnalysis(decision.nextCheckDelay);
            }
        }, scrollDebounce);
    }

    /**
     * Make intelligent timing decision based on current state
     */
    private makeTimingDecision(metrics: TypingMetrics, trigger: 'input' | 'scroll' = 'input'): TimingDecision {
        const now = Date.now();
        const minInterval = this.getEffectiveSetting('minAnalysisInterval');
        const showDelay = this.getEffectiveSetting('showDelay');
        const hideOnFastTyping = this.getEffectiveSetting('hideOnFastTyping');

        // Check if we should hide due to fast typing
        if (hideOnFastTyping && metrics.isTypingFast) {
            return {
                shouldShow: false,
                reason: `Hiding due to fast typing: ${metrics.currentWPM.toFixed(1)} WPM`
            };
        }

        // Check minimum interval between analyses
        if (now - this.lastAnalysisTime < minInterval) {
            return {
                shouldShow: false,
                reason: `Too soon since last analysis (${now - this.lastAnalysisTime}ms < ${minInterval}ms)`
            };
        }

        // For scroll events, show immediately if not typing fast
        if (trigger === 'scroll') {
            return {
                shouldShow: true,
                reason: 'Scroll event - showing indicators',
                nextCheckDelay: showDelay
            };
        }

        // For input events, schedule with delay
        return {
            shouldShow: true,
            reason: `Typing stopped - scheduling analysis in ${showDelay}ms`,
            nextCheckDelay: showDelay
        };
    }

    /**
     * Schedule analysis after delay
     */
    private scheduleAnalysis(delay: number): void {
        this.debounceManager.schedule('main-analysis', () => {
            this.lastAnalysisTime = Date.now();
            this.logger.debug('Analysis timer triggered');
        }, delay);

        this.emit('analysis-scheduled', delay);
    }

    /**
     * Get effective setting value considering document type overrides
     */
    private getEffectiveSetting<K extends keyof SmartTimingSettings>(
        key: K
    ): SmartTimingSettings[K] {
        const override = this.settings.documentTypeOverrides[this.currentDocumentType]?.[key];
        return (override !== undefined ? override : this.settings[key]) as SmartTimingSettings[K];
    }

    /**
     * Update document type for context-aware timing
     */
    setDocumentType(documentType: DocumentType): void {
        if (this.currentDocumentType !== documentType) {
            this.currentDocumentType = documentType;
            this.logger.debug(`Document type updated to: ${documentType}`);
        }
    }

    /**
     * Update settings
     */
    updateSettings(newSettings: Partial<SmartTimingSettings>): void {
        this.settings = { ...this.settings, ...newSettings };
        
        // Update typing tracker settings
        if (newSettings.typingSpeedWindow) {
            this.typingTracker.updateSettings(newSettings.typingSpeedWindow);
        }
        
        this.logger.debug('Settings updated', newSettings);
    }

    /**
     * Get current typing metrics
     */
    getCurrentMetrics(): TypingMetrics {
        const metrics = this.typingTracker.getCurrentMetrics();
        return {
            ...metrics,
            isTypingFast: metrics.currentWPM > this.getEffectiveSetting('fastTypingThreshold')
        };
    }

    /**
     * Subscribe to timing events
     */
    on<K extends keyof TimingEvents>(event: K, callback: TimingEvents[K]): void {
        if (!this.subscribers.has(event)) {
            this.subscribers.set(event, []);
        }
        this.subscribers.get(event)!.push(callback);
    }

    /**
     * Unsubscribe from timing events
     */
    off<K extends keyof TimingEvents>(event: K, callback: TimingEvents[K]): void {
        const callbacks = this.subscribers.get(event);
        if (callbacks) {
            const index = callbacks.indexOf(callback);
            if (index !== -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    /**
     * Emit timing event to subscribers
     */
    private emit<K extends keyof TimingEvents>(event: K, ...args: Parameters<TimingEvents[K]>): void {
        const callbacks = this.subscribers.get(event);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(...args);
                } catch (error) {
                    this.logger.error(`Error in timing event callback for ${event}:`, error);
                }
            });
        }
    }

    /**
     * Check if analysis is currently scheduled
     */
    isAnalysisScheduled(): boolean {
        return this.debounceManager.hasActiveTimer('main-analysis');
    }

    /**
     * Cancel any pending analysis
     */
    cancelPendingAnalysis(): void {
        this.debounceManager.clearTimer('main-analysis');
    }

    /**
     * Cleanup when component is destroyed
     */
    cleanup(): void {
        this.debounceManager.clearAllTimers();
        this.subscribers.clear();
        this.logger.debug('SmartTimingEngine cleanup completed');
    }
}