# Nova - AI Thinking Partner for Obsidian

## CRITICAL: Read These Rules First

### Atomic Changes Only
**One small testable change per response. Period.**
- If it takes >2 minutes to implement, it's too big
- Each change must be immediately testable
- No bundling multiple features

### Action Over Discussion
- CODE FIRST, explain later (if needed)
- No "I'll help you..." preambles
- No long explanations before coding
- Start typing code within first 3 lines

### Complete Code Only
- No TODOs, no stubs, no placeholders
- Every function must work when implemented
- Make reasonable decisions instead of asking

### Progress Tracking
- **ALWAYS use this CLAUDE.md file for tracking progress**
- Do NOT use TodoWrite/TodoRead or any session-based tracking
- Update checkboxes in this file when completing tasks
- Add new bugs/tasks to the appropriate phase section

---

## Current Project State (Updated: June 11, 2025)

### ✅ COMPLETED Components
- Plugin structure and TypeScript setup
- Settings UI with provider selection
- Multi-provider architecture (4 providers)
- Document engine with all edit operations
- Command parser for intent detection
- All 5 MVP commands implemented
- Conversation manager for file-scoped chat
- Context builder for document analysis
- Platform-aware provider switching
- Custom Nova icon
- **Complete sidebar chat UI implementation**
- **Full AI provider connections and command routing**
- **Professional chat interface with loading states**
- **License validation system (ready for Catalyst model)**
- **COMPLETE COMMAND SYSTEM with all features**

### 🔄 CURRENT PHASE: Monetization Pivot to Catalyst Model - PHASE 0 IN PROGRESS

#### New Business Model - IMPLEMENTED ✅
**FROM**: Feature-tier model (Core free with limits, Supernova paid with features)  
**TO**: Community-supported model (ALL features free with user API keys, Catalyst supporters get early access)

#### Catalyst Supporter Tiers - IMPLEMENTED ✅
- **Nova (Free)**: All features available with user-provided API keys
- **Catalyst ($29/year or $199 lifetime)**: 3-6 month early access to new features, priority support, supporter badge

#### Technical Infrastructure Status - COMPLETED ✅
- [x] License validation system built and tested
- [x] Feature flag system converted to time-based
- [x] Provider system supports all users (gates removed)
- [x] 453 tests updated and passing
- [x] Time-based feature release system implemented
- [x] Catalyst supporter UI elements added
- [x] All Core/Supernova tier restrictions removed

#### Command System Implementation - COMPLETED ✅
- [x] **Colon trigger system** (`:claude`, `:chatgpt`, `:gemini`, `:ollama`)
- [x] **Command picker dropdown** with live filtering, keyboard navigation, mouse support
- [x] **Command button (⚡)** for mobile discovery with rich menu interface
- [x] **Custom command framework** with template support and storage
- [x] **Settings UI** for command management (add/edit/delete custom commands)
- [x] **Feature gating** for Catalyst early access (Sep 15, 2025 for all users)
- [x] **All integrations working** - commands appear in picker, button menu, and settings

---

## 📝 SESSION SUMMARY (June 12, 2025)

### COMPLETED THIS SESSION ✅
1. **Wikilink Autocomplete Implementation**
   - Created `WikilinkSuggest` class extending Obsidian's `EditorSuggest` API
   - Triggers on `[[` pattern with intelligent edge case handling
   - Fuzzy search with scoring algorithm (exact match > starts with > contains > path > fuzzy)
   - Professional suggestion popup with file names and paths
   - Proper wikilink insertion with `[[filename]]` format
   - Smart detection to avoid triggering inside existing links
   - Comprehensive test suite with 20 test cases covering all functionality
   - CSS styling for suggestion popup matching Obsidian's design language

2. **Technical Implementation Details**
   - `onTrigger` method detects `[[` pattern and validates cursor position
   - `getSuggestions` filters vault files using scoring algorithm
   - `renderSuggestion` creates professional UI with file names and paths
   - `selectSuggestion` inserts wikilink and positions cursor correctly
   - Registered EditorSuggest in main plugin file for automatic activation
   - All 466 tests passing including enhanced wikilink autocomplete suite

3. **Enhanced Multi-Document UX**
   - Custom wikilink autocomplete with [[document]] suggestions
   - Fuzzy search with smart scoring (exact, starts-with, contains, path, fuzzy)
   - Real-time context preview showing "Context will include: Document A, Document B"
   - Support for both combined workflow (docs + question) and separate workflow (docs only)
   - Visual confirmation messages when documents are loaded
   - Context-only commands with persistent document addition
   - Professional styling matching Obsidian's design language

4. **Files Created/Modified**
   - **New**: `/src/ui/wikilink-suggest.ts` - Custom wikilink autocomplete implementation
   - **New**: `/test/ui/wikilink-suggest.test.ts` - Comprehensive test suite (20 tests)
   - **Modified**: `/src/ui/sidebar-view.ts` - Integrated autocomplete, context preview, enhanced UX
   - **Modified**: `/main.ts` - Removed old EditorSuggest registration
   - **Modified**: `/styles.css` - Added autocomplete and context preview styling

4. **Previous Session Achievements (Maintained)**
   - All 453 tests passing
   - TypeScript errors resolved
   - Professional UI/UX implementation
   - Cross-platform compatibility (desktop/mobile)
   - Proper feature management integration
   - Multi-document context fully integrated

5. **Files Modified**
   - `src/ui/sidebar-view.ts` - Command picker, command button, auto-growing textarea, multi-doc context integration
   - `src/settings.ts` - Custom command management UI
   - `src/core/multi-doc-context.ts` - NEW: Multi-document context handler
   - `styles.css` - Context indicator styling
   - `main.ts` - Settings tab property addition, multi-doc context initialization
   - `CLAUDE.md` - Progress tracking updates

### COMPLETED THIS SESSION ✅
**MAJOR ACHIEVEMENT: Complete Multi-Document Context UX Overhaul**

**Phase 1: Enhanced Context Management Panel** ✅
- [x] Implemented interactive document cards with individual remove buttons
- [x] Added professional context panel header with token usage display
- [x] Created hover effects and visual feedback for all interactive elements
- [x] Maintained both "Clear All" and individual document removal functionality
- [x] Added proper async handling for context refresh operations

**Phase 2: Simplified Syntax Implementation** ✅
- [x] Removed temporary vs persistent context distinction for simpler UX
- [x] Made all `[[document]]` references persistent and manageable
- [x] Updated parsing logic to treat all documents consistently
- [x] Simplified UI to show clean document names without `+` prefix
- [x] All remove buttons now work for all documents in context
- [x] Fixed context panel persistence after message submission
- [x] Context panel now stays visible when documents are in context

**Phase 3: Mobile-First Expandable Design** ✅
- [x] **Revolutionary expandable thin line design**:
  - Thin line under textarea (exactly like live preview panel styling)
  - Only appears when documents are in context (smart visibility)
  - Click/tap anywhere on line to expand management overlay **upward over textarea**
  - **Space-efficient design**: Overlay expands upward, not downward, saving precious screen space

**Phase 4: Mobile-Optimized Touch Interface** ✅
- [x] **44px+ touch targets** for all interactive elements (Apple/Google guidelines)
- [x] **Platform-aware styling**: Different sizing/spacing for mobile vs desktop using `Platform.isMobile`
- [x] **Smart text truncation**: Shorter labels on mobile (45% vs 45% tokens) for space efficiency
- [x] **Touch-friendly interactions**: touchstart/touchend events instead of hover states on mobile
- [x] **Responsive overlay sizing**: Full-width on mobile, constrained on desktop with proper shadows

**Phase 5: Professional Polish & UX Details** ✅
- [x] **Clean iconography**: 🧹 broom button (tooltip only), ••• more menu indicator, × remove buttons
- [x] **Proper event handling**: Fixed pointer-events conflicts, proper click propagation
- [x] **Perfect positioning**: position: relative/absolute with upward expansion (bottom: 100%)
- [x] **Consistent typography**: Expanded panel uses sidebar text sizes (1em) for readability
- [x] **Visual feedback**: Touch/hover states with proper transitions and color changes
- [x] **Auto-collapse**: Smart outside-click detection with proper event handling

**Technical Implementation Highlights** ✅
- [x] **Simplified parsing**: All `[[document]]` refs become persistent (removed `+[[]]` complexity)
- [x] **Mobile detection**: Uses `Platform.isMobile` for responsive behavior
- [x] **Event architecture**: Proper stopPropagation, pointer-events: none on child elements
- [x] **CSS positioning**: Fixed relative/absolute positioning context for proper overlay placement
- [x] **Touch accessibility**: All buttons meet minimum 44px touch target requirements

**User Experience Achievements** ✅
- [x] **Unified workflow**: Single syntax `[[document]]` for all document addition
- [x] **Progressive disclosure**: Thin line → expandable management when needed
- [x] **Space efficiency**: Upward expansion saves vertical space on mobile
- [x] **Visual consistency**: Matches live preview panel styling perfectly
- [x] **Cross-platform**: Seamless experience on mobile, tablet, and desktop
- [x] **Intuitive interactions**: Click anywhere to expand, click outside to collapse
- [x] **Professional aesthetics**: Clean icons, proper spacing, smooth animations

**Quality Assurance** ✅
- [x] All 466 tests passing with enhanced expandable context UX
- [x] No TypeScript errors or build issues
- [x] Proper error handling and edge case management
- [x] Memory management with event cleanup

### COMPLETED THIS SESSION ✅
**Phase 0 Completion & Comprehensive Multi-Document Context Testing**

1. **Time Gate Configuration (Day 8-9) - COMPLETED ✅**
   - ✅ Already had flexible date-based feature configuration system
   - ✅ Already had isFeatureEnabled() with date checking logic
   - ✅ Already had "Early Access" indicators for Catalyst features
   - ✅ Already had time gate functionality working
   - ✅ Already had easy date modification for feature releases

2. **Settings & Debug Mode (Day 10) - COMPLETED ✅**
   - ✅ Removed remaining tier-based settings UI elements (isProviderAllowedForCoreTier, createRestrictedProviderNotice)
   - ✅ Updated outdated comments referencing Core tier
   - ✅ Verified Catalyst license input and validation working
   - ✅ Confirmed debug mode properly restricted to development builds only
   - ✅ Verified feature date overrides working for testing
   - ✅ Confirmed debug stripped from production builds

3. **Comprehensive Multi-Document Context Testing - COMPLETED ✅**
   - ✅ Created complete test suite for `MultiDocContextHandler` (20 tests)
   - ✅ Tests cover message parsing, context building, persistent context management
   - ✅ Tests cover context indicators, display formatting, and error handling
   - ✅ Fixed implementation issues found during testing (space cleanup, duplicate detection)
   - ✅ All 486 tests passing including new multi-document context tests
   - ✅ Comprehensive coverage of [[document]] syntax parsing and persistent context
   - ✅ Token counting, limit detection, and context visualization testing

### NEXT SESSION PRIORITY
**Phase 1: Ship Preparation**
With Phase 0 (Monetization Pivot) now COMPLETE, focus moves to comprehensive manual testing and bug resolution:

1. **Comprehensive Manual Testing**
   - Create manual testing plan document (MANUAL_TESTING_PLAN.md)
   - Create bug report template (BUG_REPORT_TEMPLATE.md) 
   - Execute end-to-end user workflow testing
   - Real device testing (mobile, desktop, tablets)
   - Cross-platform compatibility validation

2. **Critical Bug Resolution**
   - **FIX: File context tracking bug** - Nova shows wrong file in context when multiple files are open
     - Issue: In `sidebar-view.ts` line 531, fallback uses `leaves[0]` instead of active leaf
     - Fix: Update `loadConversationForActiveFile()` to check `app.workspace.activeLeaf` before falling back to first file

3. **Performance & Polish**
   - Bundle size analysis and optimization
   - Memory usage validation with large documents
   - Mobile performance testing on actual devices
   - Error handling improvements and loading state optimizations

### IMPORTANT NOTES FOR NEXT SESSION
- **Wikilink autocomplete completed**: Custom textarea-based implementation with 20 comprehensive tests
- **Enhanced multi-doc UX completed**: Autocomplete, real-time preview, context-only workflow
- All command system features are working and tested
- Multi-document context fully implemented and integrated  
- 466 tests passing - maintain this status
- Feature gating is properly implemented for Catalyst model

---

## 📋 PLANNED: Multi-Document Context UX Improvements

### **Current Issues Identified**
1. **Document Removal UX**: Only global "Clear All" button, no individual document removal
2. **Temporary vs Persistent Complexity**: Two syntaxes (`[[doc]]` vs `+[[doc]]`) create cognitive overhead
3. **Context Display Issues**: Plain text list, no visual distinction, limited interactivity

### **Recommended Path: Simplified Persistent-Only Model**
**Strategy**: Remove temporary vs persistent distinction for simpler UX
- **Single syntax**: `[[document]]` always adds to conversation context
- **Context persists** until manually removed or conversation cleared
- **Benefits**: Simpler mental model, fewer decisions, cleaner UX

### **Phase 1: Enhanced Context Management Panel**
```
📚 Context (3 documents, 45% tokens)
┌─────────────────────────────────────┐
│ [📄] Project Notes              [×] │
│ [📄] Meeting Transcript         [×] │  
│ [📄] Requirements Document      [×] │
└─────────────────────────────────────┘
```

**Features to Implement**:
- **Interactive document cards** with hover states and individual remove buttons
- **Expandable/collapsible** context panel below input area
- **Token usage visualization** with progress bar
- **Smart truncation** of long document names
- **Drag to reorder** documents in context (future enhancement)

### **Phase 2: Simplified Syntax Implementation**
- **Remove `+[[]]` syntax** entirely (keep temporarily for migration)
- **All `[[document]]` references** add to persistent context
- **Auto-cleanup** when conversation is cleared
- **Migration path**: Deprecate `+[[]]` while maintaining backward compatibility

### **Phase 3: Advanced UX Enhancements**
- **Smart context suggestions** based on current conversation
- **Document content preview** on hover
- **Context templates** for common document sets
- **Keyboard shortcuts** (Ctrl+D to add, Ctrl+Shift+C to clear all)

### **Technical Implementation Plan**
**Files to Modify**:
- `src/ui/sidebar-view.ts` - Context panel redesign, individual remove handlers
- `src/core/multi-doc-context.ts` - Simplified model (remove temp/persistent distinction)
- `styles.css` - Document card styling, context panel improvements
- Tests - Update for simplified model and new UI interactions

**Migration Strategy**:
1. Keep both syntaxes working but show all docs as persistent context
2. Update UI to interactive document cards with individual removal
3. Eventually deprecate `+[[]]` syntax entirely
4. Maintain backward compatibility during transition

### **After Context UX: Time Gate Configuration**
**Phase 0 Day 8-9: Time Gate Configuration** (Moved to after context improvements)
- Create flexible date-based feature configuration
- Implement isFeatureEnabled() with date checking
- Add "Early Access" indicators for Catalyst features
- Test time gate functionality
- Ensure easy date modification for feature releases

---

## 🎯 NEXT DEVELOPMENT PHASES

### **Phase 0: Monetization Pivot & Feature Implementation** (2-3 weeks)
**Priority: IMMEDIATE**

#### Week 1: Remove Feature Gates & Build Core Features - COMPLETED ✅
- [x] **Day 1-2: Monetization Infrastructure - COMPLETED ✅**
  - [x] Transform feature-manager.ts from tier-based to time-based gating
  - [x] Update license system to validate Catalyst supporter status only
  - [x] Remove all Core/Supernova tier restrictions
  - [x] Add Catalyst badge and early access UI elements
  - [x] Update settings to remove tier selection, add Catalyst status
  - [x] Remove all "upgrade to Supernova" prompts

- [x] **Day 3-4: Command System Implementation - COMPLETED ✅**
  - [x] Implement `:` trigger system for all commands
  - [x] Create command picker dropdown UI
  - [x] Add provider switching commands (`:claude`, `:chatgpt`, `:gemini`, `:ollama`)
  - [x] Add custom command system with user-defined shortcuts
  - [x] Add command button (⚡) for mobile/discovery
  - [x] Build settings UI for command management

- [x] **Day 5: Auto-Growing Input Area - COMPLETED ✅**
  - [x] Replace current input with auto-growing textarea
  - [x] Platform-aware defaults (1 line desktop, 2 lines mobile)
  - [x] Implement smooth height transitions (max 6-8 lines)
  - [x] Integrate with command button
  - [x] Cross-platform testing

#### Week 2: Advanced Features & Time Gates
- [x] **Day 6-7: Multi-Document Context - COMPLETED ✅**
  - [x] Parse `[[doc]]` syntax for temporary context (current request only)
  - [x] Parse `+[[doc]]` syntax for persistent context (conversation-wide)
  - [x] Implement token counting with 80% limit warnings
  - [x] Add visual context indicators in sidebar
  - [x] Handle metadata property reading from cache
  - [x] Write comprehensive tests for multi-document context

- [x] **Day 8-9: Time Gate Configuration - COMPLETED ✅**
  - [x] Create feature-config.ts with flexible date settings
  - [x] Implement isFeatureEnabled() with date checking
  - [x] Add "Early Access" indicators for Catalyst features
  - [x] Test time gate functionality
  - [x] Ensure easy date modification for feature releases

- [x] **Day 10: Settings & Debug Mode - COMPLETED ✅**
  - [x] Remove tier-based settings UI
  - [x] Add Catalyst license input and validation
  - [x] Implement debug mode for development builds only
  - [x] Add feature date overrides for testing
  - [x] Ensure debug stripped from production builds

#### Week 3: Testing, Documentation & Launch Prep
- [x] **Day 11-12: Update Test Suite**
  - [x] Remove all tier-based tests
  - [x] Add Catalyst supporter validation tests
  - [x] Add time-based feature release tests
  - [x] Test all features work with user API keys
  - [x] Ensure 453+ tests passing

- [ ] **Day 13-14: Documentation & Repository Prep**
  - [ ] Update README.md with Catalyst model
  - [ ] Remove all Core/Supernova references
  - [ ] Update this CLAUDE.md file
  - [ ] Prepare LICENSE.md for public repository
  - [ ] Create CONTRIBUTING.md
  - [ ] Clean repository history of sensitive data

### **Phase 1: Ship Preparation** (Next 1-2 weeks)
**Priority: HIGH**

- [ ] **Comprehensive Manual Testing**
  - [ ] Create manual testing plan document (MANUAL_TESTING_PLAN.md)
  - [ ] Create bug report template (BUG_REPORT_TEMPLATE.md) 
  - [ ] Execute end-to-end user workflow testing
  - [ ] Real device testing (mobile, desktop, tablets)
  - [ ] Cross-platform compatibility validation

- [ ] **Bug Tracking & Resolution System**
  - [ ] Document bug reporting workflow
  - [ ] Test licensing features thoroughly (Core vs Supernova)
  - [ ] Validate mobile upgrade interface on real devices
  - [ ] Performance testing with large documents
  - [ ] **FIX: File context tracking bug** - Nova shows wrong file in context when multiple files are open
    - Issue: In `sidebar-view.ts` line 531, fallback uses `leaves[0]` instead of active leaf
    - Fix: Update `loadConversationForActiveFile()` to check `app.workspace.activeLeaf` before falling back to first file

- [ ] Performance optimization review
  - [ ] Bundle size analysis (`npm run build` + size check)
  - [ ] Memory usage validation (large documents)
  - [ ] Mobile performance testing (actual devices)

- [ ] Final testing validation
  - [ ] Test Core tier mobile upgrade interface on real devices
  - [ ] Test Supernova provider switching on mobile
  - [ ] Cross-platform compatibility check

- [ ] User experience polish
  - [ ] Beta user feedback collection
  - [ ] Error handling improvements
  - [ ] Loading state optimizations

### **Phase 2: Market Readiness** (Next 2-4 weeks)
**Priority: MEDIUM**
- [ ] Business infrastructure
  - [ ] Landing page for novawriter.ai
  - [ ] Payment integration (Stripe/Paddle)
  - [ ] License key generation system
  - [ ] Customer support setup
- [ ] Distribution preparation
  - [ ] Obsidian Community Plugin submission
  - [ ] Marketing materials creation
  - [ ] Documentation site setup
  - [ ] Update README.md with all new features

### **Phase 3: Advanced Features** (DEFERRED - Based on User Feedback)
**Priority: NONE - Not planned for initial development**
- Templates system implementation
- Command usage analytics and smart sorting
- Usage insights dashboard
- Enterprise features development
- Advanced conversation management

---

## Implementation Details for Catalyst Model

### Feature Release Configuration
```typescript
// feature-config.ts - Easy to modify post-launch
export const CATALYST_FEATURES = {
  'command-system': {
    catalystDate: '2025-06-15',  // Launch day
    generalDate: '2025-09-15',   // 3 months later
  },
  'multi-doc-context': {
    catalystDate: '2025-06-15',  // Launch day  
    generalDate: '2025-08-15',   // 2 months later
  },
  'auto-input': {
    catalystDate: '2025-06-15',  // Launch day
    generalDate: '2025-07-15',   // 1 month later
  }
};
```

### New Settings Structure
```typescript
interface NovaSettings {
  // No more tier selection
  providers: Record<string, ProviderConfig>;
  customCommands: CustomCommand[];
  catalystLicense?: CatalystLicense;
  isCatalyst: boolean;
  // ... other settings
}
```

### Feature Checking Logic
```typescript
function isFeatureEnabled(featureId: string, user: User): boolean {
  const feature = CATALYST_FEATURES[featureId];
  const now = new Date();
  
  if (now >= new Date(feature.generalDate)) return true;
  if (user.isCatalyst && now >= new Date(feature.catalystDate)) return true;
  
  return false;
}
```

---

## File Locations
```
main.ts                          # Plugin entry (complete)
src/ui/sidebar-view.ts          # Sidebar UI (complete)
src/licensing/feature-manager.ts # Freemium logic (complete)
src/core/document-engine.ts     # Document editing (complete)
styles.css                      # All UI styles (complete)
```

---

## Development Workflow (Current Phase: Monetization Pivot)

### ⚠️ IMPORTANT: Progress Tracking
**All progress tracking must be done in this CLAUDE.md file by updating checkboxes.**
**Do NOT use TodoWrite/TodoRead or any other session-based tracking tools.**

### Current Focus: Catalyst Model Implementation
1. **Remove Feature Gates**: All features free with user API keys
2. **Build Catalyst System**: Time-based early access for supporters
3. **Implement New Features**: Command system, multi-doc context, UI
4. **Test Coverage**: Update 476 tests for new model
5. **Atomic Changes**: One small testable change per response

---

## Session Instructions

### Starting a Session (Monetization Pivot Phase)
1. Load this file first
2. Review Catalyst model requirements
3. Focus on Phase 0 tasks in order
4. One atomic change at a time only
5. **Track all progress by updating checkboxes in this file**

### Making Changes (Catalyst Implementation)
1. Remove tier restrictions systematically
2. Implement time-based feature gates
3. Build all features, gate for Catalyst early access
4. Update tests as you go
5. **Mark completed tasks with [x] in this CLAUDE.md file**
6. **Add any new bugs/tasks to the appropriate phase section**

### Commit Messages
- Do NOT add "Generated with Claude Code" text to commits
- Keep commit messages clean and professional
- Focus on what was changed and why

### If Something Breaks
- Revert the last change
- Try a different approach
- Don't apologize, just fix

---

## Example Prompts for Next Session (Monetization Pivot)

### Good First Prompt:
"Start Phase 0 Day 1: Transform feature-manager.ts to time-based gating"

### Removing Tier Gates:
"Remove Core/Supernova tier restrictions from sidebar-view.ts"

### Building New Features:
"Implement : command trigger system for provider switching"

### Time Gate Implementation:
"Create feature-config.ts with Catalyst early access dates"

### If Issues Found:
"Fix failing tests after removing tier logic"

---

## Technical Context

### Key Patterns
- Use `app.vault.modify()` for all edits (undo support)
- Messages stored in `.obsidian/plugins/nova/conversations/[file-hash].json`
- All provider calls are async
- Platform.isDesktopApp determines provider

### Provider Interface
```typescript
interface AIProvider {
    complete(systemPrompt: string, userPrompt: string, options?: any): Promise<string>;
}
```

### Message Types
```typescript
type MessageRole = 'user' | 'assistant' | 'system';
interface ChatMessage {
    role: MessageRole;
    content: string;
    timestamp: number;
    command?: EditCommand;
    result?: EditResult;
}
```

---

## Feature Availability Summary

### MVP Features (Available to ALL users at launch)
- ✅ 5 core editing commands (add, edit, delete, grammar, rewrite)
- ✅ Sidebar chat interface with conversations
- ✅ File-scoped conversation memory
- ✅ 4 AI providers with user's own API keys
- ✅ Settings UI with API key configuration
- ✅ Desktop and mobile support

### Catalyst Early Access Features (Built but time-gated)
- ⏰ `:` command system (provider switching + custom commands)
- ⏰ Multi-document context (`[[doc]]` and `+[[doc]]`)
- ⏰ Auto-growing input area
- ⏰ Command button (⚡)
- ⏰ Enhanced provider management

### Key Principles
- ALL features free with user API keys
- Catalyst supporters get 3-6 month early access
- Time gates are flexible and can be adjusted
- No permanent feature restrictions
- Debug mode only in development builds

## Remember
- MVP only - no extra features
- Working > Perfect  
- One atomic change at a time
- Build everything, gate for Catalyst value