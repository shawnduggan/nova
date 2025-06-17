# Nova - AI Thinking Partner for Obsidian

## ⚠️ CRITICAL: NEVER COMMIT WITHOUT EXPLICIT APPROVAL
**ALWAYS ask "Should I commit these changes?" before ANY git operations**
**NEVER auto-commit or auto-push - wait for explicit confirmation**
**NO exceptions to this rule - user must explicitly approve all commits**

## BEHAVIORAL COMMANDS - READ FIRST

### MANDATORY RULES
**NEVER start responses with explanations like "You're absolutely right" or "I'll help you" - RESPOND OR CODE IMMEDIATELY**
**ONE CHANGE PER RESPONSE** - If it involves multiple concerns, refuse and break it down
**ONE STEP AT A TIME** - If the plan involves multiple steps, pause after each step and ask if you should continue
**WAIT FOR TEST CONFIRMATION** - After any fix, ask user to test before proceeding to next task
**NO TODOS/STUBS** - Every function must work when implemented
**MOVE COMPLETED ITEMS** - When items finish, REMOVE from CLAUDE.md to keep it focused on current work only

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

---

## 🎯 CURRENT FOCUS: Chat UI Contextualization

---

## 🎯 IMPLEMENTATION QUEUE

### **Next: Chat UI Contextualization**
- **Concept**: Transform from chat-first to document-first collaborative writing partner
- **Key changes**: Remove chatbot personality, immediate document context understanding
- **UX shift**: Actionable suggestions based on document structure analysis
- **Input transformation**: "Ask Nova anything" → "How can I help with your writing?"
- **Detailed specs**: Will be provided at implementation time

### **Lower Priority Items**
- **Normalize streaming typewriter effect across all providers** - Anthropic models dump all text at once, OpenAI streams too fast, Google now has good pacing. Make all providers use consistent 3-character chunks with 20ms delays for smooth typewriter effect.
- **Remove console logging before production launch** - Clean up debug logging from Google provider fixes and other development debugging.
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
**When work completes: REMOVE from here to keep focus on current tasks**

### Making Changes
1. Focus on current phase tasks in order
2. One atomic change at a time only
3. **When tasks complete: REMOVE from CLAUDE.md to keep focus on current work**
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
- **All completed work is tracked in git commit history**
- Detailed specs provided at implementation time
