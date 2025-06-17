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

## Current Project State (Updated: June 17, 2025)

### ✅ STATUS: Ship Ready - Core Features Complete
- **Cursor-only editing system fully implemented and verified**
- **Selection-based AI editing with context menu** (right-click → Nova actions)
- **Command palette integration** (9 clean commands without confusing modals)
- **Drag-and-drop file context** from Obsidian file explorer
- **Native Obsidian file picker** for `[[` wikilink autocomplete (indistinguishable from core Obsidian)
- **Unified streaming system** with notice-based thinking animations
- **Mobile-optimized UI** with responsive design
- **Test suite passing** (34/34 test suites, 368 tests total)
- **Clean architecture** with simplified document editing
- **✅ UNIFIED MESSAGE SYSTEM** - All success/error messages now use consistent styled pills

---

## 🎯 CURRENT FOCUS: Chat UI Contextualization

---

## 🎯 IMPLEMENTATION QUEUE

### **Next: Remaining Critical Bug Fixes**
1. **Welcome message styling broken** - When editing or viewing a document for the first time, shows ugly unstyled message "Working on [filename]" instead of the nicely styled welcome message
2. **File drawer header row vertical centering** - Header row that shows when closed needs vertical centering
3. **Remove thinking notice from chat** - When adding via chat, don't use thinking notice. Keep thinking notice for menu commands only.

### **Second: Chat UI Contextualization**
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

## ✅ COMPLETED FIXES (June 17, 2025)

### **Unified Message System Implementation**
**Problem**: Three different message creation paths caused inconsistent UX:
- Success messages = Styled green pills ("✓ Content added")
- Command failures = Plain assistant bubbles ("Failed to add content") 
- System errors = Icon messages with mixed styling

**Solution**: Implemented unified error handling to match success message patterns:
- Added `addErrorIndicator()` method to sidebar matching `addSuccessIndicator()`
- Removed all `addAssistantMessage()` calls from command handlers for failures
- Updated sidebar command execution to use unified error display
- Both success and error messages now use consistent styled pills

**Result**: 
- Success = "✓ Content added" (styled green pill)
- Failure = "❌ Failed to add content" (styled red pill)  
- Both persist and restore consistently with conversation history
- All 34 test suites passing (368 tests)

### **Model Switch Message Persistence Fixed** 
**Problem**: Model/provider switch messages used HTML icon messages that were too long, causing them to display as unstyled bubbles instead of styled pills, and weren't persisting to conversation history.

**Solution**: 
- Replaced `createIconMessage()` calls with simple text in `switchToModel()` and `switchToProvider()` methods
- Updated colon command handlers (`:claude`, `:chatgpt`, etc.) to use plain text messages
- Fixed 6 additional system messages that weren't using unified message system
- Enforced emoji policy: only checkmark (✓) for success, X (❌) for errors

**Changes Made**:
- `switchToModel`: `createIconMessage` → `✓ Switched to ${provider} ${model}`
- `switchToProvider`: `createIconMessage` → `✓ Switched to ${provider}`  
- Colon commands: `createIconMessage` → `✓ Switched to ${provider}`
- Feature gates: `createIconMessage` → `❌ Commands are currently in early access...`
- Multi-doc context: `createIconMessage` → `✓ Included ${count} documents...`
- Custom templates: `createIconMessage` → `✓ Loaded template: ${name}`

**Result**: All model switch and system messages now appear as properly styled pills, persist to conversation history, and restore correctly when switching files.

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
