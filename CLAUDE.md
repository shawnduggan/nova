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

## Current Project State (Updated: June 15, 2025 - Afternoon)

### ✅ STATUS: Ship Preparation Ready
- **Cursor-only editing system fully implemented and verified**
- **All "/" command functionality removed**
- **No location/targeting UI components remain**
- **":" command system preserved for Custom Commands**
- **Source code builds successfully** (main.js: 289KB)
- **All edits now happen at cursor position only**
- **Clean, simplified architecture achieved**
- **Test suite completely updated and passing** (22/22 test suites)
- **✅ FIXED: Critical cursor position preservation bug**
  - **File-scoped cursor tracking** (eliminates cross-file contamination)
  - **Fixed file-editor consistency** for multi-document workflows
  - **Robust getActiveEditor()** method ensures correct file targeting
- **Critical context removal bug fixed**
- **✅ NEW: Drag-and-Drop File Context Feature**
  - **Drag markdown files** from Obsidian's file explorer onto chat input
  - **Automatic wikilink insertion** (`[[filename]]` syntax) at cursor position
  - **Multiple file support** - drag multiple files simultaneously
  - **Smart filtering** - only accepts `.md` files, rejects folders and other formats
  - **Visual feedback** - accent-colored drop zone with plus icon during drag
  - **User-friendly messages** for invalid drops (folders, non-markdown files)
  - **Clean implementation** - 150 lines, well-separated in InputHandler class
- **✅ NEW: Hybrid Notice-Based Thinking Animation System (Selection)**
  - **Obsidian Notice feedback** - Clean UI thinking phrases with animated dots
  - **Context-aware personality** - 10 unique phrases per action type (improve, longer, shorter, tone, custom)
  - **Perfect streaming** - Text streams cleanly without selection highlighting
  - **Clean undo behavior** - Two-step undo (empty → AI content → original text)
  - **Auto-dismissing notices** - Notice disappears when streaming begins
  - **Progressive dots animation** - Starts with 1 dot, cycles through 5 (. → .. → ... → .... → .....)
  - **Hybrid approach** - Combines notice feedback with document streaming for optimal UX
- **✅ NEW: Unified Streaming System (All Chat Commands)**
  - **StreamingManager** - Shared infrastructure for all command types
  - **Complete streaming coverage** - All AI-powered commands (add, edit, rewrite, grammar) use notice + streaming
  - **Extended thinking phrases** - 10 unique phrases per action type (add, edit, rewrite, grammar, etc.)
  - **Cursor-based streaming** - Clean insertion at cursor position without text selection
  - **Backward compatibility** - Fallback to synchronous mode if streaming fails
  - **Comprehensive testing** - Unit tests verify all streaming functionality
  - **✅ Phase 3 complete** - All chat commands unified with selection-based editing experience
- **✅ NEW: Enhanced File Context Experience**
  - **Auto-add to context** - Files selected via [[ picker or drag-and-drop are automatically added to context
  - **Clean input field** - No more clutter with [[wikilinks]], files go straight to context
  - **Visual feedback** - Success notifications confirm when files are added
  - **Fixed UI layout** - Long filenames now truncate properly with ellipsis
  - **Flexbox improvements** - "read-only" label stays anchored to the right
  - **Seamless workflow** - Type [[, select file, continue typing your message
  - **Code cleanup** - Removed obsolete + prefix handling and simplified pattern matching
  - **Consistent behavior** - Both [[ picker and drag-and-drop use identical workflow
  - **✅ Accurate duplicate detection** - Correctly identifies and reports duplicate files in notifications
  - **✅ Fixed persistent context** - Context is properly maintained between drag operations

---

## 🎯 CURRENT PHASE: Ready for User Testing & Market Preparation - COMPLETE ✅

### ✅ **COMPLETED: Command Palette Cleanup & Mobile UX Enhancement**

#### **Native Selection-Based Command System** ✅
**Successfully replaced confusing commands with native selection actions:**

**Removed 5 problematic commands:**
- `nova-add-content` - Prompted "What would you like to add?" (confusing)
- `nova-edit-content` - Prompted "How would you like to edit?" (vague)  
- `nova-delete-content` - Prompted for deletion target (unclear)
- `nova-rewrite-content` - Prompted for rewrite instruction (vague)
- `nova-fix-grammar` - Prompted for input (inconsistent)

**Added 9 clean, direct-action commands:**
1. `Nova: Improve Writing` - Direct improvement action
2. `Nova: Make Longer` - Expand with detail
3. `Nova: Make Shorter` - Condense to essentials  
4. `Nova: Make Formal` - Professional tone
5. `Nova: Make Casual` - Conversational tone
6. `Nova: Make Academic` - Scholarly language
7. `Nova: Make Friendly` - Warm, approachable tone
8. `Nova: Tell Nova...` - Custom instruction modal
9. `Nova: Open Sidebar` - Utility command

**Key Achievements:**
- ✅ **Individual tone commands** eliminate modal steps for speed
- ✅ **Selection validation** - all commands check for selected text first
- ✅ **Consistent logic** - delegates to `SelectionContextMenu.handleSelectionAction()`
- ✅ **Mobile compatibility** - text selection preserved with command palette
- ✅ **Dual UX patterns** - context menu (discovery) + command palette (efficiency)

#### **Mobile-Optimized "Tell Nova" Modal** ✅
**Completely redesigned for mobile accessibility and usability:**

**Mobile Positioning & Sizing:**
- ✅ **Top-left positioning** (60px from top, 2.5vw from left)
- ✅ **Keyboard-friendly** - stays accessible when mobile keyboard appears
- ✅ **Optimal height** - 80vh max-height, auto-sizing to content
- ✅ **No centering issues** - fixed positioning prevents off-screen problems

**Mobile UX Optimizations:**
- ✅ **Clean, focused layout** - removed examples section (placeholder text sufficient)
- ✅ **3-line input area** - 90px min-height shows proper text input
- ✅ **Tighter spacing** - eliminated dead space around title/description
- ✅ **Touch-friendly buttons** - 48px min-height, full-width layout
- ✅ **Proper touch handling** - touch-action manipulation, visual feedback

**Cross-Platform Compatibility:**
- ✅ **Desktop unchanged** - maintains existing modal experience
- ✅ **Responsive design** - Platform.isMobile detection for conditional styling
- ✅ **Selection requirement maintained** - keeps focused transformation workflow

---

## 🎯 PREVIOUS PHASE: Ready for User Testing - COMPLETE ✅

### 🎯 **Next Phase: Market Readiness** (Ready to Begin)

#### **UI Polish Tasks** (Next Session)
- [ ] **Remove unnecessary separator line**
  - Remove `border-top` from `.nova-input-container` (line 492 in styles.css)
  - Reduces visual clutter between chat and input areas
- [ ] **Update plugin version to 1.0**
  - Update manifest.json version from "0.1.0" to "1.0.0" (package.json already correct)
- [ ] **Fix plugin name consistency**
  - Change `getDisplayText()` in sidebar-view.ts from "Nova AI" to "Nova"
  - Fixes mobile sidebar display showing "Nova AI" instead of "Nova"
- [ ] **Fix double "Nova" prefix in command palette**
  - Remove "Nova: " prefix from all command names in main.ts
  - Obsidian automatically prepends plugin name, causing "Nova: Nova: Make Shorter"
  - Commands should be named like "Make Shorter", "Improve Writing", etc.

#### **Command System Polish (Optional)**
- [ ] **Fix Command Button & ":" System** - Align with Custom Commands feature design
  - Command button should only appear when Custom Commands feature is available (time-gated)
  - "Show Command Button in Chat" setting should be part of Custom Commands feature
  - When clicked, button should trigger the ":" command panel
  - ":" command list should be empty until user adds Custom Commands
  - Should display "No custom commands yet" or similar empty state message
  - The entire ":" system is reserved for future Custom Commands feature

#### **Market Preparation Tasks**
- [ ] Business infrastructure setup
  - [ ] Landing page for novawriter.ai
  - [ ] Payment integration (Stripe/Paddle)
  - [ ] License key generation system
  - [ ] Customer support setup
- [ ] Distribution preparation
  - [ ] Obsidian Community Plugin submission
  - [ ] Marketing materials creation
  - [ ] Documentation site setup

### ✅ **Features Ready for Market Release**
- **✅ Native Command Palette** - 9 clean, direct-action commands
- **✅ Mobile-Optimized Modals** - Perfect mobile UX for "Tell Nova"
- **✅ Selection-Based AI Editing** - Right-click context menu with dynamic thinking phrases
- **✅ File Picker Auto-Selection** - First item auto-selected, Enter key works immediately
- **✅ Mobile File Picker Optimization** - Responsive design with platform-specific UX
  - **Desktop**: 3x taller file picker (600px) for better file visibility
  - **Mobile**: Compact 100px picker with single-line layout, 3-line textarea
  - **Context-aware spacing**: Dynamic 10px bottom padding when no context files
  - **Platform detection**: Seamless mobile/desktop experience with optimal sizing
- **✅ Drag-and-Drop File Context** - Intuitive file addition via drag from file explorer
- **✅ Unified Streaming System** - All chat commands with notice + streaming
- **✅ Enhanced File Context Experience** - Auto-add to context with clean UI
- **✅ Cursor-Only Editing System** - Simplified, predictable document editing
- **✅ Hybrid Notice-Based Thinking Animation** - Context-aware personality
- **✅ Clean Architecture** - 22/22 test suites passing, stable build (347KB)
- **✅ Enhanced Tag Operations** - AI-powered tag suggestions and management
  - **Unified provider handling** - All AI providers use the same code path
  - **Respects user settings** - Uses "Default Max Tokens" from plugin settings
  - **Comprehensive error handling** - All API errors displayed to users in chat
  - **Multi-word tag support** - Spaces converted to hyphens (e.g., "nova scotia" → "nova-scotia")
  - **Smart tag parsing** - Handles JSON, comma-separated, and line-based formats
  - **Clear error messages** - Users see actionable errors for troubleshooting

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
