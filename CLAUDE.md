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

### DESIGN GUIDELINES
- **ALWAYS use Obsidian's native design language and iconography**
- NO emojis - use clean SVG outline icons that match Obsidian's style
- Use ButtonComponent.setIcon() for all buttons and UI elements
- Maintain consistent spacing, colors, and typography with Obsidian
- Icons should use currentColor for theme compatibility
- Follow Obsidian's responsive design patterns for mobile/desktop

---

## Current Project State (Updated: June 16, 2025)

### ✅ STATUS: Ship Ready - Core Features Complete
- **Cursor-only editing system fully implemented and verified**
- **Selection-based AI editing with context menu** (right-click → Nova actions)
- **Command palette integration** (9 clean commands without confusing modals)
- **Drag-and-drop file context** from Obsidian file explorer
- **Native Obsidian file picker** for `[[` wikilink autocomplete (indistinguishable from core Obsidian)
- **Unified streaming system** with notice-based thinking animations
- **Mobile-optimized UI** with responsive design
- **Test suite passing** (22/22 test suites, 321 tests total)
- **Clean architecture** with simplified document editing

---

## 🎯 CURRENT FOCUS: Chat UI Contextualization

### **✅ COMPLETED: Context Menu Function Repair**
- **Problem Solved**: Right-click context menu actions removed text but didn't replace with AI output
- **Root Cause**: Streaming text replacement had flawed position tracking and no error recovery
- **Solution**: Fixed streaming logic, added original text restoration on failures
- **Key Fixes**: Enhanced `updateStreamingText()`, added `restoreOriginalText()`, improved error handling
- **Result**: All context menu actions (Make Shorter, Make Longer, Improve Writing, Change Tone, Tell Nova) now work correctly

### **✅ COMPLETED: Native File Picker Implementation**
- **Problem Solved**: Custom file picker UI didn't match Obsidian design standards
- **Solution**: Replaced custom HTML/CSS popup with Obsidian's native `FuzzySuggestModal`
- **Trigger**: Type `[[` in Nova textarea → native Obsidian file picker opens
- **Features**: Search, navigation arrows, instruction footer - exactly like core Obsidian
- **Code Reduction**: 425 lines → 153 lines (-68% in wikilink-suggest.ts)
- **Architecture**: Simplified from custom popup to native modal integration

---

## 🎯 IMPLEMENTATION QUEUE

### **Next: Chat UI Contextualization**
- **Concept**: Transform from chat-first to document-first collaborative writing partner
- **Key changes**: Remove chatbot personality, immediate document context understanding
- **UX shift**: Actionable suggestions based on document structure analysis
- **Input transformation**: "Ask Nova anything" → "How can I help with your writing?"
- **Detailed specs**: Will be provided at implementation time

### **Lower Priority Items**
- Command System Polish (Custom Commands feature alignment)
- Market Preparation Tasks (business infrastructure, plugin submission)
- Technical Debt Cleanup (sidebar refactoring, legacy code removal)

---

## File Architecture (Current)
```
main.ts                          # Plugin entry (cursor-only)
src/ui/sidebar-view.ts          # Main sidebar UI (simplified)
src/ui/input-handler.ts         # Input management (cursor-focused)
src/ui/command-system.ts        # ":" trigger for Custom Commands (reserved)
src/ui/context-manager.ts       # Multi-document context UI (simplified)
src/ui/chat-renderer.ts         # Message rendering
src/core/document-engine.ts     # Document editing (cursor-only operations)
src/core/context-builder.ts     # AI prompt generation
src/core/command-parser.ts      # Natural language processing
src/core/commands/*.ts          # Command handlers (all cursor-only)
src/licensing/feature-manager.ts # Freemium logic
styles.css                      # All UI styles
```

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

---

## Development Workflow

### ⚠️ IMPORTANT: Progress Tracking
**Track PENDING work only in this CLAUDE.md file.**
**When work completes: REMOVE from here and APPEND to COMPLETED.md**

### Making Changes
1. Focus on current phase tasks in order
2. One atomic change at a time only
3. **When tasks complete: REMOVE from CLAUDE.md and APPEND to COMPLETED.md**
4. **Always prioritize code simplicity and maintainability**

### Commit Messages
- Do NOT add "Generated with Claude Code" text to commits
- Keep commit messages clean and professional
- **NEVER commit changes unless explicitly asked by the user**
- Always wait for user confirmation before committing and pushing

---

## Remember
- MVP only - no extra features
- Working > Perfect  
- One atomic change at a time
- **All completed work is archived in COMPLETED.md**
- Detailed specs provided at implementation time
