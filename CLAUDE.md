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

#### Step 1: License Types & Validation Foundation ✅
**Status: COMPLETED**
- [x] 1.1: Create license interface types
- [x] 1.2: Implement offline HMAC license validator
- [x] 1.3: Write comprehensive unit tests (13 test cases)
- [x] 1.4: Validate license detection works

#### Step 2: Feature Flag Manager ✅
**Status: COMPLETED**
- [x] 2.1: Create feature manager with tier-based access
- [x] 2.2: Define Core vs SuperNova feature flags
- [x] 2.3: Write feature access tests (22 test cases)
- [x] 2.4: Validate feature restriction works

#### Step 3: Settings Integration ✅
**Status: COMPLETED**
- [x] 3.1: Add license key input to settings
- [x] 3.2: Add license validation feedback
- [x] 3.3: Add tier status display
- [x] 3.4: Test settings UI integration

#### Step 4: Development Testing Framework ✅
**Status: COMPLETED (Integrated in Steps 2-3)**
- [x] 4.1: Add debug mode toggle
- [x] 4.2: Add tier override functionality
- [x] 4.3: Test easy tier switching
- [x] 4.4: Validate development workflow

#### Step 5: Provider Restrictions
**Status: Ready to start**
- [ ] 5.1: Implement Core tier provider limits
- [ ] 5.2: Block additional provider configurations for Core
- [ ] 5.3: Add provider selection validation in settings
- [ ] 5.4: Test provider restrictions work

#### Step 6: Mobile Platform Blocking
**Status: Ready to start**
- [ ] 6.1: Add platform detection in main plugin
- [ ] 6.2: Block mobile users entirely for Core tier
- [ ] 6.3: Show upgrade prompt for mobile Core users
- [ ] 6.4: Allow mobile access only for SuperNova

#### Step 7: Sidebar Provider Switching UI
**Status: Ready to start**
- [ ] 7.1: Remove provider switching from Core tier chat UI
- [ ] 7.2: Add in-chat provider dropdown for SuperNova
- [ ] 7.3: Implement conversation continuation on provider switch
- [ ] 7.4: Update sidebar UI based on tier

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