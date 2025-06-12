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

## 📝 SESSION SUMMARY (June 11, 2025)

### COMPLETED THIS SESSION ✅
1. **Complete Command System Implementation**
   - Colon trigger system (`:claude`, `:chatgpt`, `:gemini`, `:ollama`)
   - Command picker dropdown with live filtering, keyboard/mouse navigation
   - Command button (⚡) with rich menu interface for mobile users
   - Custom command framework with template storage
   - Settings UI for managing custom commands (add/edit/delete)
   - Feature gating for Catalyst early access (Sep 15, 2025)

2. **Auto-Growing Input Area Implementation**
   - Platform-aware defaults (3 lines desktop, 2 lines mobile)
   - Smooth height transitions with 0.1s ease-out animation
   - Max height limits (6 lines desktop, 8 lines mobile)
   - Automatic scrollbar when content exceeds max height
   - Proper integration with command button and picker
   - Fixed sidebar height with 25px bottom padding on desktop to avoid status bar overlap

3. **Technical Achievements**
   - All 453 tests passing
   - TypeScript errors resolved
   - Professional UI/UX implementation
   - Cross-platform compatibility (desktop/mobile)
   - Proper feature management integration

4. **Files Modified**
   - `src/ui/sidebar-view.ts` - Command picker, command button, auto-growing textarea
   - `src/settings.ts` - Custom command management UI
   - `main.ts` - Settings tab property addition
   - `CLAUDE.md` - Progress tracking updates

### NEXT SESSION PRIORITY
**Phase 0 Day 6-7: Multi-Document Context**
- Parse `[[doc]]` syntax for temporary context (current request only)
- Parse `+[[doc]]` syntax for persistent context (conversation-wide)
- Implement token counting with 80% limit warnings
- Add visual context indicators in sidebar
- Handle metadata property reading from cache

### IMPORTANT NOTES FOR NEXT SESSION
- All command system features are working and tested
- 453 tests passing - maintain this status
- Feature gating is properly implemented for Catalyst model
- Auto-growing input is the next atomic change to implement

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
- [ ] **Day 6-7: Multi-Document Context**
  - [ ] Parse `[[doc]]` syntax for temporary context (current request only)
  - [ ] Parse `+[[doc]]` syntax for persistent context (conversation-wide)
  - [ ] Implement token counting with 80% limit warnings
  - [ ] Add visual context indicators in sidebar
  - [ ] Handle metadata property reading from cache
  - [ ] Write comprehensive tests

- [ ] **Day 8-9: Time Gate Configuration**
  - [ ] Create feature-config.ts with flexible date settings
  - [ ] Implement isFeatureEnabled() with date checking
  - [ ] Add "Early Access" indicators for Catalyst features
  - [ ] Test time gate functionality
  - [ ] Ensure easy date modification for feature releases

- [ ] **Day 10: Settings & Debug Mode**
  - [ ] Remove tier-based settings UI
  - [ ] Add Catalyst license input and validation
  - [ ] Implement debug mode for development builds only
  - [ ] Add feature date overrides for testing
  - [ ] Ensure debug stripped from production builds

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