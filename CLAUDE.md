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

## Current Project State (Updated: Dec 8, 2024)

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

### 🔴 MISSING for MVP (Must Complete)

#### Task 7: Wire Up Sidebar Chat UI
**Status: Sidebar exists but no chat UI**
- [ ] 7.1: Add message container div to sidebar
- [ ] 7.2: Add message display function (user/assistant/system)
- [ ] 7.3: Add input field at bottom of sidebar
- [ ] 7.4: Add send button next to input
- [ ] 7.5: Wire Enter key to send message
- [ ] 7.6: Display provider name and status icon in header
- [ ] 7.7: Load conversation history on file change
- [ ] 7.8: Add "Clear Chat" button to header

#### Task 8: Connect AI Providers to Commands
**Status: Providers exist but not connected**
- [ ] 8.1: Implement Claude provider complete() method
- [ ] 8.2: Add system/user prompt building
- [ ] 8.3: Connect sidebar input to command parser
- [ ] 8.4: Route parsed commands to appropriate handler
- [ ] 8.5: Display AI response in chat
- [ ] 8.6: Show loading indicator during AI call
- [ ] 8.7: Handle and display errors gracefully
- [ ] 8.8: Test with real Claude API key

#### Task 9: Test Core Functionality
**Status: Ready to test once 7&8 complete**
- [ ] 9.1: Test "add a section about X" command
- [ ] 9.2: Test "edit this paragraph" with selection
- [ ] 9.3: Test "fix grammar" on whole document
- [ ] 9.4: Test "delete section X"
- [ ] 9.5: Test "rewrite this" with selection
- [ ] 9.6: Verify Cmd+Z undo works
- [ ] 9.7: Test provider switching
- [ ] 9.8: Add basic CSS styling

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