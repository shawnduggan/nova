/**
 * Constants for Nova Commands system
 * Centralized configuration to avoid magic numbers
 */

// InsightPanel Configuration
export const INSIGHT_PANEL = {
    /** Maximum number of commands to show initially before "Show More" */
    MAX_VISIBLE_COMMANDS: 4,
    
    /** Animation timing to match CSS transitions */
    ANIMATION_DURATION: 200, // ms
    
    /** Positioning offset from trigger element */
    TRIGGER_OFFSET: 30, // px
    
    /** Minimum distance from viewport edges */
    EDGE_PADDING: 10, // px
    
    /** Default position for edge cases */
    DEFAULT_POSITION: 30, // px
} as const;

// MarginIndicators Configuration  
export const MARGIN_INDICATORS = {
    /** Analysis timing */
    ANALYSIS_DEBOUNCE: 3000, // 3 seconds as per spec
    SCROLL_DEBOUNCE: 100, // ms
    MIN_ANALYSIS_INTERVAL: 1000, // ms
    
    /** Typing speed thresholds */
    TYPING_SPEED_WINDOW: 60000, // 1 minute window
    FAST_TYPING_THRESHOLD: 30, // WPM
    
    /** Performance limits */
    MAX_INDICATORS: 20,
    
    /** Positioning */
    INDICATOR_RIGHT_OFFSET: 10, // px from right edge
    PREVIEW_OFFSET: 25, // px from indicator
} as const;

// UI Component Constants
export const UI = {
    /** CSS transition timing */
    TRANSITION_DURATION: 200, // ms
    
    /** Z-index layering */
    PANEL_Z_INDEX: 1002,
    INDICATOR_Z_INDEX: 1001,
    
    /** Common spacing */
    SPACING_SM: 4, // px
    SPACING_MD: 8, // px
    SPACING_LG: 12, // px
    SPACING_XL: 16, // px
} as const;

// Command System Constants
export const COMMANDS = {
    /** Search placeholder text */
    SEARCH_PLACEHOLDER: 'Search commands...',
    
    /** Default opportunity title fallback */
    DEFAULT_TITLE: 'Command options',
    
    /** Button labels */
    APPLY_BUTTON_TEXT: 'Apply',
    SHOW_MORE_TEXT_TEMPLATE: 'Show all {count} options...',
} as const;

/** Opportunity type display titles */
export const OPPORTUNITY_TITLES = {
    enhancement: 'Writing enhancement',
    quickfix: 'Issues', 
    metrics: 'Document analysis',
    transform: 'Content transform'
} as const;

/** CSS class prefixes for consistency */
export const CSS_CLASSES = {
    // InsightPanel
    INSIGHT_PANEL: 'nova-insight-panel',
    PANEL_HEADER: 'nova-insight-panel-header',
    PANEL_CONTENT: 'nova-insight-panel-content',
    PANEL_FOOTER: 'nova-insight-panel-footer',
    
    // Command options
    COMMAND_OPTION: 'nova-command-option',
    COMMAND_NAME: 'nova-command-option-name',
    COMMAND_ACTION: 'nova-command-option-action',
    COMMAND_DESCRIPTION: 'nova-command-option-description',
    
    // Buttons and controls
    SHOW_MORE_BUTTON: 'nova-show-more-button',
    
    // MarginIndicators
    MARGIN_INDICATOR: 'nova-margin-indicator',
    INDICATOR_PREVIEW: 'nova-indicator-preview',
} as const;

/** CodeMirror selectors */
export const CM_SELECTORS = {
    SCROLLER: '.cm-scroller',
    CONTENT: '.cm-content', 
    LINE: '.cm-line',
    EDITOR: '.cm-editor'
} as const;