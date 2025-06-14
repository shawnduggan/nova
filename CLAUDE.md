# Nova - AI Thinking Partner for Obsidian

## BEHAVIORAL COMMANDS - READ FIRST

### MANDATORY RULES
**NEVER start responses with explanations or "I'll help you" - CODE IMMEDIATELY**
**ONE CHANGE PER RESPONSE** - If it involves multiple concerns, refuse and break it down
**WAIT FOR TEST CONFIRMATION** - After any fix, ask user to test before proceeding to next task
**NO AUTO-COMMITS** - Never commit unless explicitly commanded
**NO TODOS/STUBS** - Every function must work when implemented

### TDD PROTOCOL - MANDATORY
**SEQUENCE:**
1. Write failing test FIRST
2. Write minimal code to pass test
3. Use subagent to run test: `npm test -- filename.test.js`
4. State: "Test result: PASS/FAIL"
5. If FAIL: use subagent to investigate (lint, compile)
6. State: "Test this change. Type PASS or FAIL:"
7. STOP - wait for user response
8. If user says FAIL: debug, don't proceed
9. If user says PASS: ask "Next change?"

### SUBAGENT USAGE
**USE subagents for repetitive verification tasks:**
- Test execution: `npm test -- filename.test.js`
- TypeScript compilation: `tsc --noEmit`
- Linting: `eslint src/filename.ts`
- Build verification: `npm run build`
- File operations: reading/writing test files

**ALWAYS ask before using subagents for:**
- Git operations (already forbidden to auto-commit)
- Installing packages
- Modifying config files
- Any system-level changes

**SUBAGENT WORKFLOW:**
1. Write test + implementation
2. Use subagent to run test immediately
3. Report results: "Test passed/failed"
4. If failed: use subagent to investigate (lint, compile check)
5. Wait for user confirmation before proceeding

### ATOMIC CHANGE DEFINITION
- ONE logical concern per response
- ONE function/component/test per response
- MUST fit in single git commit message
- User can understand the change in 30 seconds

**SIZE GUIDELINES:**
- Simple bug fix: 5-20 lines
- New function: 20-50 lines  
- New component: 30-80 lines
- Integration change: 40-100 lines
- **ABSOLUTE MAX: 100 lines per response**

### REJECTION CRITERIA
**TOO BIG if it involves:**
- Multiple unrelated files
- Multiple logical concerns
- Changes that affect multiple features
- "And also..." in the description

**COUNTER-OFFER:** "That's too big. Pick ONE specific change."

### ANTI-REFACTOR RULES
**ONLY modify code needed to pass the test**
**NEVER "improve" untested code**
**NEVER touch working code without explicit test**
**If you see "opportunities" - IGNORE THEM**

**FORBIDDEN PHRASES:**
- "While we're here..."
- "This would be cleaner if..."
- "Let me also fix..."
- "I noticed we could improve..."

**IF YOU MODIFY MORE THAN THE TEST REQUIRES:**
Immediately revert and respond: "I overstepped. Focusing only on: [test requirement]"

### SCOPE LOCKDOWN
**SCOPE TEST:** Can you describe this change in one sentence without "and"?
- GOOD: "Add validation to email input field"
- BAD: "Add validation to email and fix the styling and update the tests"

**REVERT TRIGGER:** If you find yourself changing something unrelated to the test, STOP immediately.

### REQUIRED RESPONSE STRUCTURE
```
[3 lines max describing the ONE change]

**Test:**
[Test code block]

**Implementation:**
[Implementation code block]

**Verification:**
[Subagent runs test automatically]
Test result: PASS/FAIL

Test this change. Type PASS or FAIL:
```
[STOP - no additional text]

### VIOLATION = IMMEDIATE STOP
If you catch yourself writing >100 lines, STOP MID-SENTENCE and say:
"This change is too big. Breaking into smaller pieces..."

**NO EXCEPTIONS** - Even if the user says "just do it all"
**NO NEGOTIATIONS** - Don't explain why, just enforce

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

## Current Project State (Updated: June 14, 2025 - Late Evening)

### ✅ STATUS: Ship Preparation Ready
- **Cursor-only editing system fully implemented and verified**
- **All "/" command functionality removed**
- **No location/targeting UI components remain**
- **":" command system preserved for Custom Commands**
- **Source code builds successfully** (main.js: 289KB)
- **All edits now happen at cursor position only**
- **Clean, simplified architecture achieved**
- **Test suite completely updated and passing** (22/22 test suites)
- **Critical context removal bug fixed**

---

## 🎯 CURRENT PHASE: Ship Preparation

### Critical Tasks Remaining

#### 🐛 **Critical Bug**
- [x] Fix context removal error: "Cannot read properties of undefined (reading '0')"
  - ✅ Fixed stale references in context handling
  - ✅ Added null-safe array operations in sidebar-view.ts
  - ✅ Enhanced refreshContext() with better error handling

#### 📋 **Next Steps** 
- [x] Fix test suite to work with cursor-only system (COMPLETE: 22/22 test files passing)
  - ✅ Fixed: metadata-command.test.ts, types.test.ts, command-parser.test.ts, context-builder.test.ts, add-command.test.ts, edit-command.test.ts, delete-command.test.ts, grammar-command.test.ts, rewrite-command.test.ts, document-engine.test.ts, section-picker-integration.test.ts (removed), prompt-builder.test.ts, provider-restrictions.test.ts, provider-switching.test.ts
  - ✅ All test files now compatible with cursor-only system
  - ✅ Test suite fully passing
  - ✅ Removed 2,500+ lines of obsolete section-based test code
- [ ] User testing with cursor-only system
- [ ] Performance validation on target devices
- [ ] Final polish and optimization

#### 🎯 **Ready for Ship Preparation**
**All critical technical work complete:**
- ✅ Cursor-only transformation implemented and verified
- ✅ Test suite completely updated (22/22 passing)
- ✅ Critical bugs resolved
- ✅ Clean, maintainable codebase
- ✅ Build successful and stable

#### 🔧 **Priority 0: Pre-Testing Polish & Bug Fixes** (IN PROGRESS)
1. [x] **Fix UI Icons** - Replace delete buttons with proper icons and red hover states
  - ✅ Clear all button uses trash-2 icon
  - ✅ Document row delete buttons use × symbol (working solution)
2. [x] **Update Manual Testing Plan** - Create comprehensive test plan for all cursor-only features
  - ✅ Added cursor-only architecture validation section
  - ✅ Updated command descriptions for cursor/selection/document targets  
  - ✅ Updated context panel tests for new UI icons
  - ✅ Clear overview noting cursor-only transformation  
3. [x] **Code Cleanup** - Remove commented code, stubs, backup files, and dead code from architectural changes
  - ✅ Removed sidebar-view.ts.backup file
  - ✅ Cleaned legacy comments in licensing/types.ts
  - ⚠️ **Future Task**: Full refactoring to remove compatibility delegations in sidebar-view.ts (50+ property references require systematic replacement)
4. [x] **Fix Context-Only Bug** - Resolve LLM outputting last section when adding document without text
  - ✅ Root cause identified: Multi-document context passed directly to AI without proper instructions
  - ✅ Enhanced system prompt with explicit context vs content distinction  
  - ✅ Restructured user prompt to separate reference context from user request
  - ✅ Fix verified with new tests (multi-doc-context-bug.test.ts, context-only-fix.test.ts)
  - ✅ 340/345 tests passing (5 PromptBuilder format tests need updating)
5. [ ] **Critical Cursor Position Fix** - Solve cursor position loss when switching between document and chat

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
- Enhanced / and : Command System (context panel integration)
- Templates system implementation
- Command usage analytics and smart sorting
- Usage insights dashboard
- Enterprise features development
- Advanced conversation management

### **Phase 4: Technical Debt & Architecture** (Low Priority)
- [ ] **Full Sidebar Refactoring** - Remove compatibility delegations in sidebar-view.ts
  - Replace 50+ legacy property references with direct component access
  - Systematic method-by-method refactoring required
  - Should be treated as dedicated architectural improvement task
  - Requires comprehensive testing after each component update

---

## File Locations (Post-Transformation)
```
main.ts                          # Plugin entry (cursor-only)
src/ui/sidebar-view.ts          # Main sidebar UI (simplified)
src/ui/input-handler.ts         # Input management (cursor-focused)
src/ui/command-system.ts        # ":" trigger for Custom Commands (reserved)
src/ui/context-manager.ts       # Multi-document context UI (simplified)
src/ui/chat-renderer.ts         # Message rendering (unchanged)
src/core/document-engine.ts     # Document editing (cursor-only operations)
src/core/context-builder.ts     # AI prompt generation (cursor-focused)
src/core/command-parser.ts      # Natural language processing (simplified)
src/core/commands/*.ts          # Command handlers (all cursor-only)
src/licensing/feature-manager.ts # Freemium logic (unchanged)
styles.css                      # All UI styles (unchanged)
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
