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

### ✅ COMPLETED PHASE: Freemium Architecture (PRODUCTION READY)

#### Step 1: License Types & Validation Foundation ✅
**Status: COMPLETED**
- [x] 1.1: Create license interface types
- [x] 1.2: Implement offline HMAC license validator
- [x] 1.3: Write comprehensive unit tests (13 test cases)
- [x] 1.4: Validate license detection works

#### Step 2: Feature Flag Manager ✅
**Status: COMPLETED**
- [x] 2.1: Create feature manager with tier-based access
- [x] 2.2: Define Core vs Supernova feature flags
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

#### Step 5: Provider Restrictions ✅
**Status: COMPLETED**
- [x] 5.1: Implement Core tier provider limits
- [x] 5.2: Block additional provider configurations for Core
- [x] 5.3: Add provider selection validation in settings
- [x] 5.4: Test provider restrictions work

#### Step 6: Mobile Upgrade Interface ✅
**Status: COMPLETED (UX Breakthrough)**
- [x] 6.1: Add platform detection in main plugin
- [x] 6.2: Show professional upgrade interface for Core mobile users
- [x] 6.3: Transform mobile "blocking" to "upgrade opportunity"
- [x] 6.4: Allow mobile access only for Supernova

#### Step 7: Sidebar Provider Switching UI ✅
**Status: COMPLETED**
- [x] 7.1: Remove provider switching from Core tier chat UI
- [x] 7.2: Add in-chat provider dropdown for Supernova
- [x] 7.3: Implement conversation continuation on provider switch
- [x] 7.4: Update sidebar UI based on tier

### 🎉 FREEMIUM ARCHITECTURE: 100% COMPLETE
**All 476 tests passing ✅ | Production build working ✅ | Ready for market deployment**

### 🚀 CURRENT STATUS: PRODUCTION READY

#### Validation Complete (June 9, 2025)
- [x] All 476 tests passing (comprehensive validation)
- [x] Production build successful  
- [x] Documentation updated (CLAUDE.md + README.md)
- [x] UX breakthrough: Mobile "blocking" → "upgrade interface"
- [x] All freemium features tested and working

---

## 🎯 NEXT DEVELOPMENT PHASES

### **Phase 0: Technical Features** (Immediate - Next 2-3 weeks)
**Priority: IMMEDIATE**

#### Week 1: Core Infrastructure
- [ ] **Update SuperNova to Supernova Branding** (PRIORITY 1)
  - [ ] Find/replace across 14 files (77 occurrences)
  - [ ] Run all tests to ensure nothing broke
  - [ ] Build project to verify
  - [ ] Quick 15-20 minute task before other features

- [ ] **Custom Command System (Core Feature)**
  - [ ] Implement dual trigger system (`:` for desktop, ⚡ button universal)
  - [ ] Create command picker (dropdown desktop, bottom sheet mobile)
  - [ ] Add system commands with full names (`:claude`, `:gemini`, `:gpt4`, `:ollama`)
  - [ ] Add universal commands (`:process`, `:yolo`)
  - [ ] Build settings UI with table-based command management
  - [ ] Write unit and integration tests

- [ ] **Auto-Growing Input Area**
  - [ ] Replace current input with auto-growing textarea
  - [ ] Platform-aware defaults (1 line desktop, 2 lines mobile)
  - [ ] Implement smooth height transitions (max 6-8 lines)
  - [ ] Integrate command button (⚡) in input container
  - [ ] Cross-platform testing (desktop, mobile, tablet)

#### Week 2: Advanced Features
- [ ] **Multi-Document Context (Supernova Feature)**
  - [ ] Parse `[[doc]]` syntax for temporary context (current request only)
  - [ ] Parse `+[[doc]]` syntax for persistent context (conversation-wide)
  - [ ] Implement token counting with 80% limit warnings
  - [ ] Fix metadata property reading from cache
  - [ ] Add visual context indicators in sidebar
  - [ ] Feature gate with Supernova upgrade prompts
  - [ ] Write comprehensive tests

- [ ] **Settings Reorganization**
  - [ ] Create collapsible sections component
  - [ ] Build provider configuration table
  - [ ] Build command management table
  - [ ] Implement automatic settings migration
  - [ ] Test UI interactions and persistence

#### Week 3: Integration & Polish
- [ ] **Comprehensive Testing Suite**
  - [ ] Unit tests for all new components (target: 500+ total tests)
  - [ ] Integration tests for cross-feature workflows
  - [ ] Performance benchmarks (command picker <200ms, context loading <1s)
  - [ ] Mobile-specific touch interaction tests
  - [ ] End-to-end user workflow validation

- [ ] **Documentation Updates**
  - [ ] Update technical architecture docs
  - [ ] Create user guides for new features
  - [ ] Document API changes and interfaces
  - [ ] Prepare beta testing instructions

### **Phase 1: Ship Preparation** (Next 1-2 weeks)
**Priority: HIGH**

- [ ] **Comprehensive Manual Testing**
  - [ ] Create manual testing plan document (MANUAL_TESTING_PLAN.md)
  - [ ] Create bug report template (BUG_REPORT_TEMPLATE.md) 
  - [ ] Execute end-to-end user workflow testing
  - [ ] Real device testing (mobile, desktop, tablets)
  - [ ] Cross-platform compatibility validation

- [ ] **Bug Tracking & Resolution System**
  - [ ] Document bug reporting workflow
  - [ ] Test licensing features thoroughly (Core vs Supernova)
  - [ ] Validate mobile upgrade interface on real devices
  - [ ] Performance testing with large documents

- [ ] Performance optimization review
  - [ ] Bundle size analysis (`npm run build` + size check)
  - [ ] Memory usage validation (large documents)
  - [ ] Mobile performance testing (actual devices)

- [ ] Final testing validation
  - [ ] Test Core tier mobile upgrade interface on real devices
  - [ ] Test Supernova provider switching on mobile
  - [ ] Cross-platform compatibility check

- [ ] User experience polish
  - [ ] Beta user feedback collection
  - [ ] Error handling improvements
  - [ ] Loading state optimizations

### **Phase 2: Market Readiness** (Next 2-4 weeks)
**Priority: MEDIUM**
- [ ] Business infrastructure
  - [ ] Landing page for novawriter.ai
  - [ ] Payment integration (Stripe/Paddle)
  - [ ] License key generation system
  - [ ] Customer support setup
- [ ] Distribution preparation
  - [ ] Obsidian Community Plugin submission
  - [ ] Marketing materials creation
  - [ ] Documentation site setup
  - [ ] Update README.md with all new features

### **Phase 3: Advanced Features** (Future)
**Priority: LOW**
- [ ] Templates system implementation
- [ ] Command usage analytics and smart sorting
- [ ] Usage insights dashboard
- [ ] Enterprise features development
- [ ] Advanced conversation management

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

## Development Workflow (Current Phase: Technical Features)

### Current Focus: Phase 0 Implementation
1. **Feature Development**: Custom commands, multi-doc context, UI improvements
2. **Core vs Supernova**: Properly gate premium features
3. **Test Coverage**: Maintain 100% coverage with new features
4. **Atomic Changes**: One small testable change per response
5. **Integration**: Ensure new features work with existing code

---

## Session Instructions

### Starting a Session (Technical Features Phase)
1. Load this file first
2. Check current production status (all tests passing)
3. Focus on Phase 0 tasks: custom commands, multi-doc context, UI
4. One atomic change at a time only

### Making Changes (Feature Development)
1. Test before and after every change
2. Properly gate Supernova features
3. Maintain 100% test coverage
4. Follow existing code patterns

### Commit Messages
- Do NOT add "Generated with Claude Code" text to commits
- Keep commit messages clean and professional
- Focus on what was changed and why

### If Something Breaks
- Revert the last change
- Try a different approach
- Don't apologize, just fix

---

## Example Prompts for Next Session (Technical Features)

### Good First Prompt:
"Start Phase 0: Create the custom command system types and interfaces"

### Good Follow-up:
"Implement the colon trigger for desktop command picker"

### Feature Implementation:
"Add multi-document context parsing for [[doc]] syntax"

### If Issues Found:
"Fix failing tests while maintaining feature functionality"

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