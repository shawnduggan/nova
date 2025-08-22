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
- ❌ **No commits unless told to**
- ❌ **No new tasks without confirmation**
- ❌ **No inline styles - use CSS**
- ❌ **No innerHTML/outerHTML - use DOM API**
- ❌ **No Claude/AI attribution in commits**
- ❌ **No console statements - use Logger**
- ❌ **No type assertions - use proper interfaces**

> Default mode: read-only analysis. Write only when prompted.

## 🚫 Git Commit Control

**CRITICAL: Never auto-commit - User must test first**

- ❌ **NEVER auto-commit** after changes
- ✅ **Only commit when explicitly asked**: "commit this", "create a commit"
- ✅ **Before committing, show**: `git status` and `git diff`
- ✅ **Allow user review** before proceeding

> User drives commits, not AI.

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

## 🛑 STOP AND COPY

**UI Pattern Rule: If Obsidian has it, copy it exactly**

### When Building UI That Mirrors Obsidian
- ✅ **Autocomplete/Suggestions**: MUST find and copy existing pattern (e.g., `[[` WikilinkFileModal)
- ✅ **Command Selection**: Use FuzzySuggestModal - never create custom
- ✅ **Modal Dialogs**: Copy existing modal patterns exactly
- ✅ **Settings UI**: Use Setting() components only

### Mandatory Questions Before UI Implementation
1. **Does this UI behavior exist in Obsidian core?** (If yes → copy exactly)
2. **Have I found the exact pattern match?** (If no → search more)
3. **Am I copying the implementation approach?** (If no → STOP)

### Examples That Should Have Been Copied
- `[[` wikilink autocomplete → Copy for `/` command autocomplete
- Command palette → Copy for any command selection UI
- Settings tabs → Copy for plugin settings

**If your UI solution is more complex than existing Obsidian patterns, you're doing it wrong.**

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
1. ✅ **MANDATORY: Find exact UI pattern match FIRST**: If UI behavior exists in Obsidian core, copy it exactly - no exceptions
2. ✅ **Study 3+ similar components**: Document patterns, note deviations  
3. ✅ **Follow conventions**: PascalCase classes, camelCase methods, consistent imports/events

### Pre-Implementation Checklist
- [ ] Have I found the exact pattern match in Obsidian core?
- [ ] Am I copying the implementation exactly?  
- [ ] If not copying, have I documented WHY and gotten approval?

### Consistency Verification
1. ✅ **Interface design**: Same parameter/return patterns, consistent error handling
2. ✅ **Architecture**: StateManager for state, event-driven communication, no direct calls
3. ✅ **Document deviations**: WHY breaking patterns, get approval for changes

## ⚠️ Complexity Trap Warning

**Red Flags That You're Over-Engineering:**

### Stop Signs
- ✅ **Your solution has more files than the original** → Too complex
- ✅ **You're creating new UI patterns** → Copy existing instead  
- ✅ **More than 50 lines for simple UI** → Find simpler approach
- ✅ **Adding configuration for basic behavior** → Use defaults
- ✅ **Custom event systems for standard UI** → Use native patterns

### Golden Rules
1. **Simple copy > clever innovation**
2. **If your solution is more complex than existing code, you're doing it wrong**
3. **When in doubt, grep for similar UI behaviors and copy them**
4. **Default to the most boring, obvious implementation**

### Recovery Action  
When you catch yourself over-engineering:
1. **STOP coding immediately**
2. **Find the simplest existing pattern**
3. **Copy it exactly**
4. **Remove custom complexity**

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

## 📖 UI Pattern Reference

**ALWAYS use these existing patterns - never create custom alternatives**

### Autocomplete & Suggestions
- **Wikilink autocomplete (`[[`)**: WikilinkFileModal pattern → Copy for `/` commands  
- **Tag autocomplete (`#`)**: SuggestModal pattern → Copy for tag-based features
- **File search**: QuickSwitcher pattern → Copy for file selection UI

### Modal Dialogs
- **Command selection**: FuzzySuggestModal → Copy for command pickers
- **File selection**: SuggestModal → Copy for file choosers  
- **Simple prompts**: Modal class → Copy for confirmations

### Settings & Controls
- **Setting sections**: `Setting().setHeading()` → Copy for plugin settings
- **Dropdowns**: `DropdownComponent` → Copy for option selection
- **Toggle buttons**: `Setting().addToggle()` → Copy for boolean settings
- **Text inputs**: `Setting().addText()` → Copy for text configuration

### Quick Reference
```typescript
// ✅ Copy this pattern for command autocomplete
new FuzzySuggestModal(app)
  .setItems(items)
  .setPlaceholder("Type command name...")
  .onChooseItem((item) => executeCommand(item))

// ✅ Copy this pattern for file selection  
new SuggestModal(app)
  .setSuggestions(files)
  .onChooseSuggestion((file) => openFile(file))
```

**If you can't find the pattern here, search the Obsidian codebase first before creating anything new.**

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

### UI Patterns  
❌ **Creating new UI patterns when Obsidian patterns exist**: Custom autocomplete instead of copying `[[` wikilink pattern
❌ **Writing custom modals instead of using FuzzySuggestModal**: Complex modal systems for simple selection
❌ **Implementing custom autocomplete instead of copying wikilink pattern**: Building from scratch when WikilinkFileModal exists
❌ **Custom dropdowns when DropdownComponent exists**: Reinventing native components
❌ **Complex event handling for simple UI**: Over-engineering when native patterns work

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
- ✅ Show `git status`/`git diff`, allow user review

### 6. Session End
- ✅ Update Current Tasks, document next steps
- ✅ Record build/test/lint status, add issues

**Accuracy over speed - every step builds reliability**

## 🐛 Known Issues (Priority=Low/Medium/High/Critical)

## 📋 Current Tasks

### ✅ COMPLETED - MarginIndicators Implementation
**Context**: Intelligent margin indicators for command suggestions with progressive disclosure UI
**Progress**: COMPLETE and fully compliant with Obsidian guidelines
**Current State**: 
- MarginIndicators fully functional with detection logic (21 tests passing)
- Proper positioning with frontmatter offset handling
- Viewport optimization with line-level caching for performance
- All critical compliance issues resolved:
  * Fixed unregistered timers using registerInterval()
  * Removed console statements (replaced with Logger)
  * Fixed type safety (removed 'any' usage)
  * CSS-first approach (removed inline styles)
- Visual improvements: opacity 0.4 → 0.6 for better visibility
- Comprehensive test suite covering detection, positioning, performance
**Next Steps**: 
- Implement hover preview system
- Build InsightPanels for full intelligence  
- Add SmartTimingEngine
- Load actual commands into CommandRegistry
**Dependencies**: Command loading implementation
**Quality Status**: Production-ready and Obsidian compliant

### Phase 1 Tasks (HIGH PRIORITY - Days 1-5)

#### Core Infrastructure (COMPLETED)
- [x] Create CommandEngine with markdown file loading system
  - Location: src/features/commands/core/CommandEngine.ts
  - Loads commands from Commands/ folder in vault
  - Executes with streaming support via StreamingManager
- [x] Implement SmartVariableResolver for template variables
  - Variables: {text}, {selection}, {document}, {title}, {document_type}, {metrics}, {audience_level}
  - Smart context resolution based on cursor/selection
- [x] Build CommandRegistry for lazy loading commands
  - Lazy load commands on first use (<50MB memory)
  - Cache loaded commands for session
- [x] Integrate with existing `/` trigger detection in CommandSystem
  - COMPLETED: Native FuzzySuggestModal implementation in src/ui/command-system.ts
  - Follows WikilinkFileModal pattern exactly for consistency
  - Mobile and desktop UX identical to [[ file picker

#### Progressive Disclosure UI
- [x] Create MarginIndicators component
  - 14px icons at 40% opacity in right margin
  - Icon types: 💡 enhancement, ⚡ quick fix, 📊 metrics, ✨ transformation
  - Location: src/features/commands/ui/MarginIndicators.ts
  - Integrated with main plugin and SmartVariableResolver
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
