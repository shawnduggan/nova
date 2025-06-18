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

## 🎯 IMPLEMENTATION QUEUE

### **Settings UX Improvements (Critical/Important Priority)**

#### Phase 1: Core Tab Structure (Critical)
1. **Create tab navigation system in settings.ts** - Replace single display() method with tab-based layout implementing horizontal tab system: General | AI Providers | Advanced with tab switching logic and visual states
2. **Add API key security (password toggle functionality)** - Add password/text toggle for all API key fields, implement masking (show first 8, last 4 characters when hidden), add eye icon toggle buttons with proper states
3. **Standardize input field sizing** - Update CSS: API key fields to 400px width, 40px height, apply monospace font for API keys, standardize all form field heights to 40px

#### Phase 2: Provider Testing & Status (Important)
4. **Implement Test Connection functionality** - Add "Test Connection" buttons for each provider (Claude, OpenAI, Google, Ollama), create provider validation with specific error messages, add timeout handling (10 seconds) and loading states
5. **Add provider status indicators** - Green dot: Connected and working, Red dot: Connection failed with error details, Amber dot: Configured but untested, Gray dot: Not configured

#### Phase 3: Content Organization (Important)
6. **Organize General tab content** - Move Supernova Supporter Status to top, group Basic Settings (temperature, tokens, auto-save), clean up layout and spacing
7. **Reorganize AI Providers tab content** - Group provider sections with status indicators, add connection testing interface, include recommended defaults guidance, improve model selection interface
8. **Structure Advanced tab content** - Move Custom Commands to Advanced tab, group Development Settings (debug mode), relocate Platform Settings to Advanced tab

#### Phase 4: Visual Polish (Polish)
9. **Improve spacing and typography** - Apply consistent 24px tab content padding, add 32px spacing between provider sections, standardize 16px spacing between form fields, enhance visual hierarchy
10. **Add mobile responsiveness** - Implement horizontal scrolling tabs on narrow screens, make form fields full-width on mobile, ensure touch targets are 44px minimum
11. **Enhance accessibility** - Add proper keyboard navigation, implement screen reader support, add high contrast focus indicators

### **Lower Priority Items**
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
