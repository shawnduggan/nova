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

#### 📋 **NEXT PRIORITY: Fix Known Issues**
- ✅ **Privacy indicators implemented** - Lock/unlock icons now show data handling for each provider in sidebar header
- ✅ **Provider status dots removed** - Eliminated confusing green/red status dots, simplified UI to focus on provider selection
- ✅ **Provider dropdown styling fixed** - Improved visual consistency and active appearance for provider selection UI
- ✅ **Ollama filtered from mobile** - Ollama no longer appears in provider dropdown on mobile devices (requires local server)
- [ ] **System instruction optimization** - Nova has targeting issues (always wants to insert at cursor instead of where requested). Explore optimizing system instruction for better Nova behavior and accuracy.
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
src/ui/sidebar-view.ts          # Sidebar UI (complete)
src/licensing/feature-manager.ts # Freemium logic (complete)
src/core/document-engine.ts     # Document editing (complete)
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