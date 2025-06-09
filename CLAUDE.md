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

---

## Current Project State (Updated: June 9, 2025)

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

### 🔴 CURRENT PHASE: Freemium Architecture

#### Step 1: License Types & Validation Foundation
**Status: Not started**
- [ ] 1.1: Create license interface types
- [ ] 1.2: Implement offline HMAC license validator
- [ ] 1.3: Write comprehensive unit tests
- [ ] 1.4: Validate license detection works

#### Step 2: Feature Flag Manager
**Status: Pending Step 1**
- [ ] 2.1: Create feature manager with tier-based access
- [ ] 2.2: Define Core vs SuperNova feature flags
- [ ] 2.3: Write feature access tests
- [ ] 2.4: Validate feature restriction works

#### Step 3: Settings Integration
**Status: Pending Step 2**
- [ ] 3.1: Add license key input to settings
- [ ] 3.2: Add license validation feedback
- [ ] 3.3: Add tier status display
- [ ] 3.4: Test settings UI integration

#### Step 4: Development Testing Framework
**Status: Pending Step 3**
- [ ] 4.1: Add debug mode toggle
- [ ] 4.2: Add tier override functionality
- [ ] 4.3: Test easy tier switching
- [ ] 4.4: Validate development workflow

---

## File Locations
```
main.ts                          # Plugin entry
src/ui/sidebar-view.ts          # WORK HERE FIRST (Task 7)
src/ai/providers/claude.ts      # Then here (Task 8)
src/core/document-engine.ts     # Already complete
styles.css                      # Add chat styles (Task 9)
```

---

## Development Workflow (Freemium Implementation)

### Strict Step-by-Step Process
1. **Single Step Focus**: Complete one step fully before next
2. **Unit Tests Required**: Write tests for all new functionality  
3. **Test Validation**: `npm test` must pass 100%
4. **User Review**: Present changes for validation
5. **Clean Commits**: Descriptive commit messages, push immediately
6. **Sequential Progress**: No parallel work, maintain linear progression

### Quality Gates
- No step complete without passing tests
- No commits without user validation
- No shortcuts or rushing ahead
- Maintain working state at all times

---

## Session Instructions

### Starting a Session
1. Load this file first
2. Show me the current state of sidebar-view.ts
3. Implement the next unchecked task
4. One task at a time only

### Making Changes
1. Show the exact change
2. Explain in 1-2 lines what it does
3. Move to next task only when asked

### Commit Messages
- Do NOT add "Generated with Claude Code" text to commits
- Keep commit messages clean and professional
- Focus on what was changed and why

### If Something Breaks
- Revert the last change
- Try a different approach
- Don't apologize, just fix

---

## Example Prompts for Next Session

### Good First Prompt:
"Show me src/ui/sidebar-view.ts then implement task 7.1: Add message container div"

### Good Follow-up:
"That works. Now do 7.2: Add message display function"

### If Error:
"That threw error X. Revert and try different approach"

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

## Remember
- MVP only - no extra features
- Working > Perfect
- Ship in 3-4 days
- One atomic change at a time