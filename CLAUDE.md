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

### Bug Fix Workflow
- **ONE FIX AT A TIME**: Only work on one bug/task per session
- **ALWAYS ASK FOR TESTING**: After implementing a fix, ask user to test it before proceeding
- **NO AUTO-COMMITS**: Never commit or move to next task unless explicitly asked
- **WAIT FOR CONFIRMATION**: User must confirm fix works before moving forward

### Complete Code Only
- No TODOs, no stubs, no placeholders
- Every function must work when implemented
- Make reasonable decisions instead of asking

### Progress Tracking
- **ALWAYS use this CLAUDE.md file for tracking PENDING work only**
- Do NOT use TodoWrite/TodoRead or any session-based tracking
- When tasks are completed: **REMOVE from this file and APPEND to COMPLETED.md**
- Add new bugs/tasks to the appropriate phase section
- Keep this file focused on current/future work only

### Design Guidelines
- **ALWAYS use Obsidian's native design language and iconography**
- NO emojis - use clean SVG outline icons that match Obsidian's style
- Use ButtonComponent.setIcon() for all buttons and UI elements
- Maintain consistent spacing, colors, and typography with Obsidian
- Icons should use currentColor for theme compatibility
- Follow Obsidian's responsive design patterns for mobile/desktop

### Code Quality Principles
**ALWAYS strive for simple, clean, and maintainable code:**
- **Simplicity**: Remove unnecessary complexity, prefer straightforward solutions
- **Cleanliness**: No dead code, clear naming, consistent formatting
- **Maintainability**: Easy to understand, modify, and extend
- **When refactoring**: Always simplify and clean up, don't just add features
- **Code reviews**: Ask "Is this the simplest way to solve this problem?"

---

## Current Project State (Updated: June 13, 2025)

### ✅ STATUS: Phase 0 (Monetization Pivot) COMPLETE
- **All 502 tests passing** (100% pass rate - including 9 metadata tests + 5 security tests)
- **All Core/Supernova tier restrictions removed**
- **Supernova time-based feature system implemented**
- **Command system fully implemented**
- **Multi-document context with security enforcement**
- **Professional UI/UX with native Obsidian design**
- **Critical security features implemented**
- **Performance optimizations complete**
- **Production code quality achieved** (zero debug logging, optimized performance)

---

## 🎯 CURRENT PHASE: Ship Preparation

### Critical Tasks Remaining

#### 📋 **COMPLETED: UI Picker Architecture** ✅
- ✅ **Privacy indicators implemented** - Lock/unlock icons now show data handling for each provider in sidebar header
- ✅ **Provider status dots removed** - Eliminated confusing green/red status dots, simplified UI to focus on provider selection
- ✅ **Provider dropdown styling fixed** - Improved visual consistency and active appearance for provider selection UI
- ✅ **Ollama filtered from mobile** - Ollama no longer appears in provider dropdown on mobile devices (requires local server)
- ✅ **CRITICAL: Clean Architecture Implementation** - Fixed circular dependencies and legacy code cleanup
- ✅ **Legacy compatibility removal** - Removed 12+ old properties and cleaned up sidebar-view.ts
- ✅ **Component initialization fix** - Proper dependency order: InputHandler → CommandSystem → Integration
- ✅ **Compilation fix** - All TypeScript errors resolved, build succeeds
#### 📋 **COMPLETED: Picker Architecture & Alignment** ✅
- ✅ **Fix : trigger** - Command picker now appears correctly with proper DOM positioning
- ✅ **Standardize picker widths** - All three pickers ([[ : /) now use inputRow container for consistent width
- ✅ **Fix picker alignment** - All pickers aligned to left edge of textarea with full sidebar width
- ✅ **Standardize picker styling** - Applied : command picker visual style to [[ and / pickers for full consistency
- ✅ **Fix textarea styling** - Increased minimum height to 40px using proper Obsidian CSS variable (var(--size-4-6))
- ✅ **Fix command button positioning** - Command button now appears to left of send button with proper DOM order
- [ ] **Improve / trigger UX** - Add selected sections to bottom panel instead of inserting text paths
- [ ] **Consider enhanced context panel** - Add files and paths sections for better UX

#### 📋 **COMPLETED: Input Row UI Fixes** ✅
- ✅ **1. Fix textarea height and vertical alignment** - Textarea now displays 4 lines (80px) by default, auto-grows to ~8-10 lines (200px), and all input row elements are properly vertically centered
- ✅ **2. Fix command button setting** - "Show Command Button in Chat" setting now works correctly, respecting both user preference and feature permissions
- [ ] **3. Thoroughly test : command functionality** - Ensure : command picker works flawlessly before moving forward
- [ ] **4. Implement / command path persistence** - Selected paths need to be persisted visually (like [[ files in context), not just inserted as text strings. Only one path per operation.
- [ ] **5. Test : and / commands together** - Comprehensive integration testing of both command systems

#### 📋 **COMPLETED: Complete Picker Polish** ✅
- ✅ **Picker functionality working** - All three triggers ([[ : /) now display pickers correctly
- ✅ **Picker width consistency** - All use full sidebar width with proper alignment
- ✅ **Visual styling standardization** - All pickers now have identical 3-line structure:
  - Name: font-weight 500, --text-normal color
  - Description: 0.85em size, --text-muted color
  - Example/Preview: 0.8em size, --text-accent color, monospace font
- ✅ **Consistent hover states and spacing** - 8px/12px padding, identical borders and transitions
- ✅ **Clean CSS architecture** - Removed redundant styles, unified base container styles
- ✅ **Input UI improvements** - Fixed textarea height (40px) and button positioning (command button left of send)
- [ ] **Enhanced UX features** - Improve / trigger to use context panel integration

#### 📋 **User Testing & Polish** 
- ✅ **Initial picker integration testing** - Basic functionality validated, issues identified
- ✅ **Picker core functionality** - All three triggers working with consistent width/alignment
- ✅ **Complete visual polish** - All pickers now have standardized styling with identical 3-line structure
- [ ] Mobile performance testing on actual devices
- ✅ Error handling improvements and loading state optimizations
- ✅ **System testing preparation complete** (code quality, performance, UI consistency)

#### 📋 **Documentation & Repository Prep** 
- ✅ Update README.md with Supernova model
- ✅ Remove all Core/Supernova references from documentation
- ✅ Prepare LICENSE.md for public repository
- ✅ Create CONTRIBUTING.md
- ✅ Clean repository history of sensitive data

#### 📋 **Comprehensive Manual Testing**
- ✅ Create manual testing plan document (MANUAL_TESTING_PLAN.md)
- ✅ Create bug report template (BUG_REPORT_TEMPLATE.md) 
- ✅ Validate MANUAL_TESTING_PLAN.md includes all new features and security implementations
- [ ] Execute end-to-end user workflow testing
- [ ] Real device testing (mobile, desktop, tablets)
- [ ] Cross-platform compatibility validation

#### 📋 **Performance & Polish**
- ✅ Bundle size analysis: 255KB bundle size is reasonable for feature set
- ✅ Fixed critical memory leaks
- ✅ Memory usage optimization 
- ✅ UI Polish and Consistency
- [ ] Final performance validation on actual devices

---

## 🎯 COMPLETED: UI Picker Architecture

### **New Picker System Implementation ✅**

The new dual-trigger picker system is now fully integrated and working:

#### **Architecture Overview**
- **InputHandler**: Manages all input UI creation and event handling
- **CommandSystem**: Handles ":" trigger with structured editing commands
- **SectionPicker**: Handles "/" trigger with hierarchical document sections
- **ContextManager**: Manages multi-document context indicators

#### **Trigger System**
- **":" → Command Picker**: Shows structured editing commands (append, prepend, edit, etc.)
- **"/" → Section Picker**: Shows hierarchical document sections for targeting
- **"[[" → Wikilink Picker**: Existing file autocomplete (unchanged)

#### **Implementation Details**
- **Consistent Styling**: All pickers use same dimensions (200px height, 4px margin)
- **Legacy Compatibility**: Old sidebar-view methods stubbed out for smooth transition
- **Clean Integration**: New architecture replaces old command picker completely
- **No Debug Logging**: Production-ready with clean console output

#### **File Changes Made**
- `src/ui/sidebar-view.ts` - Replaced old input system with new InputHandler integration
- `src/ui/input-handler.ts` - Enhanced with "/" trigger detection
- `src/ui/command-system.ts` - Removed legacy "/" command support, fixed picker sizing
- `src/ui/section-picker.ts` - Integrated with InputHandler, fixed DOM compatibility
- `src/ui/context-manager.ts` - Made contextIndicator/Preview public for compatibility

#### **Success Criteria Met**
- ✅ ":" shows properly sized command picker with editing commands only
- ✅ "/" shows section picker with hierarchical document sections
- ✅ Both match wikilink picker styling exactly
- ✅ No TypeScript compilation errors
- ✅ Clean console output (no debug logging)

---

## 📋 FUTURE PHASES (Lower Priority)

### **Phase 2: Market Readiness** (Next 2-4 weeks)
- [ ] Business infrastructure
  - [ ] Landing page for novawriter.ai
  - [ ] Payment integration (Stripe/Paddle)
  - [ ] License key generation system
  - [ ] Customer support setup
- [ ] Distribution preparation
  - [ ] Obsidian Community Plugin submission
  - [ ] Marketing materials creation
  - [ ] Documentation site setup

### **Phase 3: Advanced Features** (DEFERRED - Based on User Feedback)
- Templates system implementation
- Command usage analytics and smart sorting
- Usage insights dashboard
- Enterprise features development
- Advanced conversation management

---

## File Locations
```
main.ts                          # Plugin entry (complete)
src/ui/sidebar-view.ts          # Main sidebar UI with new picker integration (complete)
src/ui/input-handler.ts         # Input management and event handling (complete)
src/ui/command-system.ts        # ":" trigger command picker (complete)
src/ui/section-picker.ts        # "/" trigger section picker (complete)
src/ui/context-manager.ts       # Multi-document context UI (complete)
src/ui/chat-renderer.ts         # Message rendering (complete)
src/core/document-engine.ts     # Document editing with hierarchical sections (complete)
src/licensing/feature-manager.ts # Freemium logic (complete)
styles.css                      # All UI styles (complete)
```

---

## Development Workflow

### ⚠️ IMPORTANT: Progress Tracking
**Track PENDING work only in this CLAUDE.md file.**
**When work completes: REMOVE from here and APPEND to COMPLETED.md**
**Do NOT use TodoWrite/TodoRead or any other session-based tracking tools.**

### Making Changes
1. Focus on current phase tasks in order
2. One atomic change at a time only
3. **When tasks complete: REMOVE from CLAUDE.md and APPEND to COMPLETED.md**
4. **Add any new bugs/tasks to the appropriate phase section**
5. **Always prioritize code simplicity and maintainability**

### Commit Messages
- Do NOT add "Generated with Claude Code" text to commits
- Keep commit messages clean and professional
- Focus on what was changed and why
- **NEVER commit changes unless explicitly asked by the user**
- Always wait for user confirmation before committing and pushing

### If Something Breaks
- Revert the last change
- Try a different approach
- Don't apologize, just fix

---

## Key Technical Patterns

### Core Patterns
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

## Remember
- MVP only - no extra features
- Working > Perfect  
- One atomic change at a time
- Build everything, gate for Supernova value
- **All completed work is archived in COMPLETED.md**