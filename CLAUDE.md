# Nova Plugin Development – CLAUDE.md

## 🧠 Core Engineering Principles

- ✅ **Extend, Don't Duplicate** – Reuse existing patterns. Never add redundant logic.
- ✅ **DRY + SOLID** – Clear separation of concerns. No copy-paste logic or tight coupling.
- ✅ **Stable Contracts** – Never break existing provider, UI, or state interfaces.
- ✅ **Performance-Aware** – Avoid unnecessary DOM updates. Profile when needed.

## 📚 Required Context & Strategic Documentation

**Before coding, read Nova's core strategic docs** in /Users/shawn/Library/Mobile Documents/iCloud~md~obsidian/Documents/Basecamp/07-Projects/Nova/Core Docs/

**Strategic Focus:** Nova solves "where did AI put that?" by letting users control exactly where edits happen.

**Notify me when significant changes might affect Core Docs:** New features, architecture changes, competitive positioning shifts, major technical debt resolution.

## 🧱 Architecture Constraints

- ✅ **Event-driven communication**: No direct component method calls. Use `StateManager` events only.
- ✅ **UI components listen** to state, never control other parts.
- ✅ **Explicit initialization**: Avoid side effects in constructors. Use `init()` methods.
- ✅ **Constants**: Use `constants.ts` or `config.ts` for all strings/selectors.

## 🧪 Testing & Quality Requirements

### Test Requirements
1. ✅ **Business Logic** (MANDATORY): Unit tests, edge cases, validation, state management
2. ✅ **Integration** (REQUIRED): StateManager communication, API interactions, file operations
3. ✅ **Obsidian APIs** (CRITICAL): Mock consistently, test cleanup, verify registration patterns
4. ❌ **UI Snapshots** (AVOID): Focus on behavior, not DOM structure

### Test Naming
```typescript
// ✅ Behavior-focused: 'should persist conversation state between sessions'
// ❌ Implementation-focused: 'should call saveData method'
```

### Mock Strategy & Coverage
- **Obsidian APIs**: Consistent mocks, realistic return values
- **Provider APIs**: Success/error scenarios, rate limiting, streaming
- **StateManager**: Event emission/subscription, cleanup verification
- **Coverage**: 100% utilities, 90%+ managers, 80%+ UI components

### Error Scenarios to Test
- Network failures, timeouts, malformed responses
- File system errors, permissions, corrupted configs
- User input edge cases, null/empty values, encoding issues

## 🚨 Error Recovery

### Build Failures
- TypeScript errors → Fix types, check imports
- Clean rebuild: `rm -rf dist/ && npm run build`
- Rollback: `git diff`, then `git checkout -- <file>`

### Test Failures
- Single failure → Debug specific component
- Multiple failures → Check mocks, shared state
- All failing → Rollback and isolate changes
- Debug: `npm test -- conversation-manager.test.ts --verbose`

### ESLint Errors
- `npx eslint src/ --fix` for auto-fixes
- Common fixes: Remove unused imports, fix naming, add types, remove console.log

### Plugin Runtime Issues
- Check browser console for errors
- Verify main.ts exports, onload/onunload, manifest.json
- Search for unregistered `addEventListener` calls
- Use dev tools Memory tab for leak detection

### Rollback Strategy
```bash
git status && git diff  # See changes
git reset --hard HEAD   # Full rollback
git checkout HEAD -- src/file.ts  # Specific file
```

## 🛑 Strict Rules

- ❌ **No coding until explicitly instructed**
- ❌ **No commits without explicit approval of commit message**
- ❌ **No new tasks without confirmation**
- ❌ **No inline styles - use CSS**
- ❌ **No innerHTML/outerHTML - use DOM API**
- ❌ **No Claude/AI attribution in commits**
- ❌ **No console statements - use Logger**
- ❌ **No type assertions - use proper interfaces**

> Default mode: read-only analysis. Write only when prompted.

## 🚫 Git Commit Control

**CRITICAL: Never auto-commit - User must approve ALL commit messages**

- ❌ **NEVER auto-commit** after changes
- ❌ **NEVER commit without showing commit message first** - User must review and approve
- ✅ **Only commit when explicitly asked**: "commit this", "create a commit"
- ✅ **Before committing, show**: `git status` and `git diff`
- ✅ **ALWAYS show proposed commit message**: Wait for explicit user approval
- ✅ **User must approve commit message**: Never proceed without confirmation

> User controls commits AND commit messages, not AI.

## 📋 Session Continuity

**CLAUDE.md is the authoritative source for ALL ongoing work**

### End Session Requirements
- ✅ **Update Current Tasks**: IN PROGRESS/BLOCKED/PENDING with next steps
- ✅ **Document work-in-progress**: Files modified, architectural decisions
- ✅ **Record QA status**: Build/test/lint status
- ✅ **Add discovered issues** to Known Issues

### Start Session Requirements  
- ✅ **Check Current Tasks FIRST** before new work
- ✅ **Resume IN PROGRESS tasks** before anything new
- ✅ **Verify system state**: Build, test, git status
- ✅ **Ask for clarification** if insufficient context

### Task Format
Each task needs: Context, Progress, Current State (files:lines), Next Steps, Dependencies, Quality Status

## 🔍 Pre-Implementation Research

**MANDATORY before ANY code changes:**

### Understanding Phase
1. ✅ **Search existing patterns**: Use `Grep`/`Task`, study 3+ similar components
2. ✅ **Map relationships**: Dependencies, state flows, interfaces to preserve
3. ✅ **Verify extension opportunities**: Reuse existing functionality, avoid redundancy

### Architecture Verification
1. ✅ **Interface compatibility**: No breaking changes to providers/UI/StateManager
2. ✅ **Performance impact**: DOM updates, memory leaks, large vault impact

### Documentation Review
1. ✅ **Read Core Docs** for architectural changes
2. ✅ **Check Obsidian compliance** requirements
3. ✅ **Review existing tests** for behavior patterns

**Never implement without completing research phase.**

## 🛠️ Tool Usage Guidelines

### Task Tool Usage
**When to use Task tool:**
- ✅ Complex multi-file searches, architecture analysis (5+ files), compliance verification
- ❌ Simple file reads (use Read), single patterns (use Grep)

**Limitations:** No persistent state, single prompt instructions, specify return format

### Tool Selection
- Know file path? → Read
- Know pattern? → Grep  
- Multiple patterns/analysis? → Task

## 🧩 Pattern Consistency

**Before ANY new functionality:**

### Pattern Analysis
1. ✅ **Study 3+ similar components**: Document patterns, note deviations
2. ✅ **Follow conventions**: PascalCase classes, camelCase methods, consistent imports/events

### Consistency Verification
1. ✅ **Interface design**: Same parameter/return patterns, consistent error handling
2. ✅ **Architecture**: StateManager for state, event-driven communication, no direct calls
3. ✅ **Document deviations**: WHY breaking patterns, get approval for changes

## 🔒 Obsidian Plugin Compliance

**CRITICAL for Community Plugin store approval:**

### Event Listeners & Timers
- ❌ **No direct `addEventListener()`** → Use `this.registerDomEvent()`
- ❌ **No unregistered timers** → Use `this.registerInterval(window.setInterval())`

### APIs & Performance
- ❌ **No deprecated APIs**: `activeLeaf`, `fetch()`, `vault.modify()`
- ✅ **Use modern APIs**: `getActiveViewOfType()`, `requestUrl()`, Editor API
- ❌ **No inefficient file ops**: Use `vault.getFileByPath()` not `getMarkdownFiles().find()`

### CSS & UI
- ❌ **No inline styles/innerHTML** → Use CSS classes and DOM API
- ❌ **No core overrides** → Scope styles to plugin containers
- ✅ **Use native components**: `DropdownComponent`, `Setting().setHeading()`

### Commands & Settings
- ❌ **No plugin name prefixes** → Use "open-sidebar" not "nova-open-sidebar"
- ❌ **No "PluginName Settings" headings** → Context already clear

### Security & Data
- ❌ **No analytics collection** → Use "recordForState" not "trackForAnalytics"
- ❌ **No plaintext sensitive keys** → Obfuscate license keys

### Verification (Required)
Before marking compliance complete: `Grep` searches, build success, 0 ESLint errors, all tests pass

## ✅ Quality Assurance Checklist

**MANDATORY after ANY code changes:**

### Core Verification (Must Pass All)
1. ✅ `npm run build` - 0 errors, no module resolution failures
2. ✅ `npm test` - ALL tests pass (490+ expected)
3. ✅ `npx eslint src/ --format=unix | grep error` - 0 errors
4. ✅ No console statements in production code

### Compliance & Performance
5. ✅ Event listeners use `registerDomEvent`
6. ✅ Timers use `registerInterval`
7. ✅ No deprecated APIs (activeLeaf, fetch, vault.modify)
8. ✅ Proper cleanup methods implemented
9. ✅ Efficient API usage (no getMarkdownFiles for single lookups)

### Code Quality
10. ✅ Follow established patterns
11. ✅ No breaking interface changes
12. ✅ Complex logic documented
13. ✅ Update CLAUDE.md task status

**Task incomplete until ALL steps pass**

## 🔧 Obsidian API Quick Reference

### File Operations
- **Modify content**: Editor API (`editor.replaceRange`, `editor.setValue`) - NEVER `vault.modify()`
- **Find file**: `vault.getFileByPath()` - NOT `getAbstractFileByPath`
- **File metadata**: `metadataCache.getFileCache()`
- **Create/delete**: `vault.create()`, `vault.delete()`

### Workspace & Views
- **Active editor**: `workspace.getActiveViewOfType(MarkdownView)` - NOT `activeLeaf`
- **Deferred views**: Check `view.isDeferred`, use `view.loadIfDeferred()`
- **Open file**: `workspace.openLinkText()` or `workspace.getLeaf().openFile()`

### Network & UI
- **HTTP requests**: `requestUrl()` - NOT `fetch()`
- **Dropdowns**: `DropdownComponent` - NOT custom implementations
- **Settings sections**: `Setting().setHeading()` - NOT `createEl`
- **Icons**: `setIcon()` with `addIcon()`

### Event Handling
- **Event listeners**: `this.registerDomEvent()` - NEVER direct `addEventListener()`
- **Timers**: `this.registerInterval(window.setInterval())` - NEVER unregistered timers
- **Cleanup**: Connect all resources to plugin registration system

### Performance
- **File searches**: Use MetadataCache, avoid iterating all files
- **DOM updates**: Debounce, use DocumentFragment
- **State**: StateManager events, avoid direct coupling

## 🔄 Common Anti-Patterns

### Architecture
❌ **Direct coupling**: `this.sidebarView.refreshConversation()`
✅ **Event-driven**: `this.stateManager.emit('conversation-updated', data)`

❌ **Constructor side effects**: API calls, DOM manipulation in constructor
✅ **Explicit init**: Use `async init()` methods

### Obsidian APIs
❌ **Deprecated**: `activeLeaf`, direct `addEventListener`, `vault.modify()`
✅ **Modern**: `getActiveViewOfType()`, `registerDomEvent()`, Editor API

### Performance  
❌ **Inefficient**: `getMarkdownFiles().find()`, DOM updates on every input
✅ **Efficient**: `getFileByPath()`, debounced updates

### Testing
❌ **Implementation-focused**: Test private methods, empty mocks
✅ **Behavior-focused**: Test observable behavior, realistic mocks

## 🎯 Performance Guidelines

### When to Profile
- File operations (100+ files), real-time features, recursive algorithms, DOM-heavy operations

### Methods
- **DevTools**: Performance/Memory/Network tabs
- **Obsidian metrics**: Plugin reload, vault switch, large file handling
- **User benchmarks**: Time to interaction, response times, memory growth

### Thresholds
- **Load time**: <500ms, **Commands**: <200ms, **API calls**: <5000ms
- **Memory**: <50MB baseline, <200MB with conversations
- **File ops**: <100ms single, <2000ms batch

## 📚 Documentation & Commits

### Update Documentation For
- ✅ API changes, new features, architectural changes, breaking changes
- ❌ Internal refactoring only

### Commit Format: `type(scope): description`
- **Types**: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`
- ❌ No AI attribution
- ✅ Present tense, <72 chars, focus on "why"

## 🎯 Development Workflow

### 1. Session Start
- ✅ Check Current Tasks, resume IN PROGRESS work first
- ✅ Verify build/test status from last session

### 2. Planning  
- ✅ Research patterns, map relationships, verify compatibility
- ✅ Check Obsidian compliance requirements

### 3. Implementation
- ✅ Follow established patterns, use proper APIs
- ✅ Event-driven architecture, write/update tests

### 4. Verification
- ✅ Complete QA checklist (build, tests, ESLint, compliance)

### 5. Pre-Commit (USER CONTROLLED)
- ❌ **NEVER auto-commit** - wait for explicit request
- ❌ **NEVER commit without showing proposed commit message** - user must approve
- ✅ Show `git status`/`git diff`, allow user review
- ✅ Show proposed commit message and wait for explicit approval

### 6. Session End
- ✅ Update Current Tasks, document next steps
- ✅ Record build/test/lint status, add issues

**Accuracy over speed - every step builds reliability**

## 🐛 Known Issues (Priority=Low/Medium/High/Critical)

### ✅ RESOLVED - All Critical Compliance Issues Fixed

**FIXED - Non-compliant setTimeout calls** ✅
- Fixed all unregistered `setTimeout` calls in core UI components  
- All one-time timers now use `TimeoutManager.addTimeout()` for proper cleanup
- IMPORTANT: `registerInterval()` should ONLY be used with `setInterval()`, NOT `setTimeout()`
- Fixed files: input-handler.ts, custom-instruction-modal.ts, chat-renderer.ts, sidebar-view.ts, command-system.ts, settings.ts
- Build status: ✅ 0 errors, only minor type warnings remain
- Status: **Ready for Plugin Store submission**

**FIXED - Event cleanup** ✅  
- Removed manual `removeEventListener` from wikilink-suggest.ts
- All event cleanup now handled automatically by `registerDomEvent`
- Status: **Compliant**

**Note**: AI provider files contain setTimeout in Promise contexts for backoff/retry logic - these are acceptable patterns and don't violate plugin guidelines.

## 📋 Current Tasks

### ✅ COMPLETED - Critical Obsidian Plugin Compliance Fixes
**Context**: Fixed all setTimeout calls and event cleanup issues that were blocking plugin store submission
**Progress**: COMPLETE - All critical compliance issues resolved
**Current State**: 
- Fixed 20 unregistered setTimeout calls across 6 core UI files:
  * input-handler.ts: 6 calls (focus delays, cursor positioning, animations)
  * custom-instruction-modal.ts: 1 call (focus delay)  
  * chat-renderer.ts: 1 call (scroll animation)
  * sidebar-view.ts: 8 calls (debouncing, animations, Promise delays)
  * command-system.ts: 1 call (cursor positioning)
  * settings.ts: 3 calls (button states, connection timeouts)
- Fixed 14 setTimeout calls in test files (conversation-context-persistence.test.ts)
- Fixed 1 mock plugin in test file (unified-system-integration.test.js)
- Removed manual event cleanup in wikilink-suggest.ts (registerDomEvent handles automatically)
- All setTimeout calls now use `TimeoutManager.addTimeout()` for proper cleanup
- Special handling for Promise-based timeouts implemented correctly
- Build passes with 0 errors (only TypeScript 'any' warnings remain)
- All 491 tests passing
**Next Steps**: Ready for plugin store submission
**Dependencies**: None
**Quality Status**: Production-ready and fully Obsidian compliant

### ✅ COMPLETED - Comprehensive Compliance Audit & Final Fixes
**Context**: Thorough review and fixing of remaining compliance issues after initial setTimeout fixes
**Progress**: COMPLETE - All critical compliance issues resolved
**Current State**: 
- Fixed unregistered setTimeout in streaming-manager.ts:295 (CRITICAL fix)
- Replaced innerHTML usage in sidebar-view.ts:2334 with safe DOM API (HIGH priority fix)
- Removed redundant event listener tracking in input-handler.ts (cleanup improvement)
- Fixed final setTimeout in test file conversation-context-persistence.test.ts
- Comprehensive audit confirmed full compliance across all categories:
  * Event Listeners: ✅ All use registerDomEvent()
  * Timers: ✅ All use registerInterval()
  * DOM/Security: ✅ No innerHTML, proper DOM API usage
  * APIs: ✅ Modern Obsidian APIs only
  * Performance: ✅ Efficient file operations
  * Plugin Structure: ✅ Proper lifecycle management
- Build passes: 0 errors (only TypeScript 'any' warnings remain)
- All 491 tests passing including modified compliance fixes
**Next Steps**: Final plugin store submission
**Dependencies**: None
**Quality Status**: FULLY COMPLIANT - Plugin store ready

### Phase 1 Tasks (HIGH PRIORITY - Days 1-5)

#### Core Infrastructure
- [ ] Create CommandEngine with markdown file loading system
  - Location: src/features/commands/core/CommandEngine.ts
  - Loads commands from Commands/ folder in vault
  - Executes with streaming support via StreamingManager
- [ ] Implement SmartVariableResolver for template variables
  - Variables: {text}, {selection}, {document}, {title}, {document_type}, {metrics}, {audience_level}
  - Smart context resolution based on cursor/selection
- [ ] Build CommandRegistry for lazy loading commands
  - Lazy load commands on first use (<50MB memory)
  - Cache loaded commands for session
- [ ] Integrate with existing `/` trigger detection in CommandSystem
  - Extend src/ui/command-system.ts for markdown commands
  - Update CommandParser for new command types

#### Progressive Disclosure UI
- [ ] Create MarginIndicators component
  - 14px icons at 40% opacity in right margin
  - Icon types: 💡 enhancement, ⚡ quick fix, 📊 metrics, ✨ transformation
- [ ] Implement hover preview system
  - 200ms fade-in on hover
  - Single-line description with primary command
- [ ] Build InsightPanels for full intelligence
  - Positioned near text without covering
  - Multiple approach options
  - Clear action buttons
- [ ] Add SmartTimingEngine
  - 3 second delay after typing stops
  - Hide when typing >30 WPM
  - Respect document type settings

#### Settings Integration
- [ ] Add Commands tab to NovaSettingTab
  - Location: src/settings.ts (extend existing)
  - CommandSettings interface with all options
- [ ] Implement sidebar quick controls
  - Add to NovaSidebarView for easy access
  - Dropdown: Off/Minimal/Balanced/Aggressive
- [ ] Support per-document frontmatter overrides
  - Read nova-insights from frontmatter
  - Override global settings per document

#### 7 Flagship Commands (MUST BE EXCEPTIONAL)
- [ ] `/expand-outline` - Transform bullets to flowing prose
  - Multiple expansion styles: Detailed/Concise/Narrative
  - Maintain logical flow and hierarchy
- [ ] `/perspective-shift` - Rewrite from different viewpoints
  - Stakeholder/Temporal/Expertise/Cultural perspectives
  - Preserve core message accuracy
- [ ] `/strengthen-hook` - 5 psychological hook styles
  - Question/Statistics/Story/Challenge/Promise hooks
  - Rank by predicted engagement
- [ ] `/add-examples` - 3 types per concept
  - Quick analogy (1 sentence)
  - Detailed scenario (paragraph)
  - Case study reference (real-world)
- [ ] `/show-through-scene` - Convert telling to showing
  - Multiple intensity levels: Subtle/Standard/Dramatic
  - Maintain pacing awareness
- [ ] `/thesis-strengthen` - 3 academic argument versions
  - Narrowed/Provocative/Expanded approaches
  - Include counter-argument considerations
- [ ] `/troubleshooting-guide` - Symptom→cause→solution format
  - Common failure analysis
  - Diagnostic and verification steps

### Phase 2 Tasks (MEDIUM PRIORITY - Days 6-8)

#### 13 Domain Excellence Commands
- [ ] Blog commands: `/add-subheadings`, `/simplify-language`, `/extract-takeaways`
- [ ] Fiction commands: `/dialogue-punch`, `/sensory-details`, `/tension-curve`
- [ ] Academic commands: `/argument-structure`, `/evidence-integration`, `/academic-tone`
- [ ] Technical commands: `/add-context-blocks`, `/example-generation`, `/prerequisite-check`
- [ ] Universal command: `/voice-match` - Match another document's style

#### Advanced Features
- [ ] Build WritingContextPanel with real-time metrics
- [ ] Create MobileBottomSheet for mobile UI (60% screen height max)
- [ ] Implement DocumentTypeDetector for automatic detection
- [ ] Add session preference memory

### Phase 3 Tasks (POLISH - Days 9-10)
- [ ] Performance optimization (<100ms insight detection, <50ms command start)
- [ ] Edge case handling (network failures, large documents, malformed commands)
- [ ] Create default command templates in Commands/ folder
- [ ] Professional writer beta testing
- [ ] Documentation and video demonstrations

### Future Enhancements

**LOW Remove privacy indicator on mobile view**: It doesn't provide value on mobile - all models are cloud

**MEDIUM Mobile Model Dropdown has no padding**: The selected model names are left-aligned and need padding. This does not happen on desktop.

**LOW Consolidate input trigger detection**: Currently wikilinks (`[[`) and commands (`:`) use separate input listeners. Should consolidate into unified trigger detection system in InputHandler for better performance and cleaner architecture.

### Someday Maybe

**LOW Add slider setting for scroll speed**: Maybe on the General settings tab.

**MEDIUM User-configurable log levels**: Add setting in plugin settings tab to allow users to adjust logging verbosity (Debug, Info, Warn, Error). Currently hardcoded to INFO level. Would help with troubleshooting and support, and allow users to reduce logging overhead if needed.
