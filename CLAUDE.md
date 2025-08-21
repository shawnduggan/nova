# Nova Plugin Development – CLAUDE.md

## 🧠 Core Engineering Principles

- ✅ **Extend, Don't Duplicate** – Reuse existing patterns and functions. Never add redundant logic.
- ✅ **DRY + SOLID** – Apply clear separation of concerns. No copy-paste logic, magic strings, or tightly coupled flows.
- ✅ **Stable Contracts** – Changes must not break existing provider, UI, or state interfaces.
- ✅ **Performance-Aware** – Avoid unnecessary DOM updates or state recalculations. Profile when needed.

## 📚 Required Context & Strategic Documentation

**Before coding, read Nova's core strategic docs** in /Users/shawn/Library/Mobile Documents/iCloud~md~obsidian/Documents/Basecamp/07-Projects/Nova/Core Docs/ to understand Nova.

**Strategic Focus:** Nova solves "where did AI put that?" by letting users control exactly where edits happen - select text to transform it, place cursor to create content exactly there.

**Notify me when significant changes might affect the Core Docs:** New features, architecture changes, competitive positioning shifts, or major technical debt resolution.

## 🧱 Architecture Constraints

- ✅ Use **event-driven communication**:
  - One component must never directly call methods on another.
  - All shared updates must go through a `StateManager` or emit/subscribed events.
  - No chained `.refresh()` calls across views or managers.
- ✅ UI components **listen** to state, not control other parts of the system.
- ✅ Avoid side effects in constructor/init logic. Use explicit `init()` methods where needed.
- ✅ Use `constants.ts` or `config.ts` for all strings, selectors, and static values.

## 🧪 Testing Strategy & Guidelines

**Comprehensive testing approach for reliable Nova development:**

### Test Requirements by Code Type
1. ✅ **Business Logic** (MANDATORY):
   - Unit tests for all data processing methods
   - Edge case coverage for error conditions
   - Input validation and sanitization testing
   - State management and transformation logic

2. ✅ **Integration Testing** (REQUIRED):
   - Cross-component communication via StateManager
   - API provider interactions and responses
   - File operations with mocked Obsidian APIs
   - Event flow between UI components and managers

3. ✅ **Obsidian API Integration** (CRITICAL):
   - Mock all Obsidian APIs consistently
   - Test proper cleanup method implementation
   - Verify event listener registration patterns
   - Confirm Editor API usage over vault operations

4. ❌ **UI Snapshot/DOM Testing** (AVOID):
   - No Jest snapshots of DOM structure
   - No detailed DOM unit tests unless explicitly requested
   - Focus on behavior, not visual structure

### Test Naming & Organization
```typescript
// ✅ Good test names (behavior-focused)
describe('ConversationManager', () => {
  it('should persist conversation state between sessions', () => {})
  it('should handle provider switching without data loss', () => {})
  it('should recover from interrupted streaming responses', () => {})
})

// ❌ Poor test names (implementation-focused)
describe('ConversationManager', () => {
  it('should call saveData method', () => {})
  it('should set isStreaming to false', () => {})
})
```

### Mock Strategy
1. ✅ **Obsidian API Mocks**:
   - Use consistent mocks across all test files
   - Mock app.vault, app.workspace, app.metadataCache
   - Provide realistic return values, not just empty objects
   - Update mocks when Obsidian APIs change

2. ✅ **Provider API Mocks**:
   - Mock HTTP responses with realistic data
   - Test both success and error scenarios
   - Include rate limiting and timeout conditions
   - Mock streaming responses for real-time testing

3. ✅ **StateManager Mocks**:
   - Mock event emission and subscription
   - Test state transitions and side effects
   - Verify cleanup of event listeners

### Test Coverage Requirements
- ✅ **100% coverage** for utility functions and data processors
- ✅ **90%+ coverage** for managers and core business logic
- ✅ **80%+ coverage** for UI components (behavior, not DOM)
- ✅ **All error paths tested** - don't just test happy path
- ✅ **Edge cases documented** with specific test cases

### Error Scenario Testing
1. ✅ **Network failures**:
   - API timeouts and connection errors
   - Invalid API responses and malformed data
   - Rate limiting and quota exceeded scenarios

2. ✅ **File system errors**:
   - Permission denied for file operations
   - Corrupted or missing configuration files
   - Vault access issues and file locks

3. ✅ **User input edge cases**:
   - Empty, null, or malformed user inputs
   - Extremely long content and memory limits
   - Special characters and encoding issues

## 🚨 Error Handling & Recovery Instructions

**Comprehensive error recovery patterns for robust Nova operation:**

### Build Failure Recovery
**When `npm run build` fails:**
1. ✅ **Identify the error type**:
   - TypeScript compilation errors → Fix type issues
   - Import/export errors → Check module paths and exports
   - Dependency issues → Run `npm install` and verify versions

2. ✅ **Common build fixes**:
   ```bash
   # Clean build artifacts and retry
   rm -rf dist/
   npm run build
   
   # If still failing, check for syntax errors
   npx tsc --noEmit
   
   # Verify all imports are correct
   npx tsc --listFiles | grep "error"
   ```

3. ✅ **Rollback strategy**:
   - Use `git diff` to see what changed since last working build
   - Revert problematic changes: `git checkout -- <file>`
   - Test build after each revert to isolate issue

### Test Failure Recovery
**When `npm test` fails:**
1. ✅ **Analyze failure patterns**:
   - Single test failure → Focus on specific component
   - Multiple test failures → Check for mock issues or shared state
   - All tests failing → Check for fundamental setup problems

2. ✅ **Test debugging workflow**:
   ```bash
   # Run single test file for focused debugging
   npm test -- conversation-manager.test.ts
   
   # Run tests with verbose output
   npm test -- --verbose
   
   # Update test snapshots if needed (but avoid DOM snapshots)
   npm test -- --updateSnapshot
   ```

3. ✅ **Mock verification**:
   - Ensure all Obsidian API methods are properly mocked
   - Check that mock return values match expected types
   - Verify mock cleanup between tests

### ESLint Error Resolution
**When ESLint shows errors:**
1. ✅ **Fix errors systematically**:
   ```bash
   # Show only errors (not warnings)
   npx eslint src/ --format=unix | grep error
   
   # Fix auto-fixable issues
   npx eslint src/ --fix
   
   # Check specific file
   npx eslint src/specific-file.ts
   ```

2. ✅ **Common ESLint fixes**:
   - Remove unused imports and variables
   - Fix naming convention violations
   - Add proper type annotations
   - Remove any console.log statements

### Plugin Runtime Error Recovery
**When plugin fails to load in Obsidian:**
1. ✅ **Check browser console** for error details
2. ✅ **Verify plugin registration**:
   - Ensure main.ts exports Plugin class properly
   - Check onload/onunload method implementations
   - Verify manifest.json is valid

3. ✅ **Common runtime fixes**:
   - Check for unhandled Promise rejections
   - Verify all async operations have error handling
   - Ensure proper cleanup in onunload method

### Memory Leak Detection & Recovery
**When plugin causes performance issues:**
1. ✅ **Audit event listeners**:
   - Search for `addEventListener` calls without `registerDomEvent`
   - Check that all components implement cleanup methods
   - Verify timers are registered and cleared properly

2. ✅ **Memory profiling**:
   - Use browser dev tools Memory tab
   - Check for growing object counts after plugin reload
   - Monitor DOM node count increases

### Rollback Procedures
**When changes break functionality:**
1. ✅ **Immediate rollback**:
   ```bash
   # See what changed
   git status
   git diff
   
   # Rollback all changes
   git reset --hard HEAD
   
   # Or rollback specific files
   git checkout HEAD -- src/specific-file.ts
   ```

2. ✅ **Partial rollback**:
   - Use `git log --oneline -10` to see recent commits
   - Create branch from last known good state
   - Cherry-pick working changes back

3. ✅ **Recovery verification**:
   - Run full test suite after rollback
   - Verify build succeeds
   - Test plugin loading in Obsidian
   - Check that all features still work

**Recovery Decision Tree:**
```
Build/Test Failure?
├─ Syntax/Type Error? → Fix immediately, retest
├─ Single Test Failure? → Debug specific test, check mocks
├─ Multiple Failures? → Check for shared mock issues
├─ All Tests Failing? → Rollback and isolate changes
└─ Plugin Won't Load? → Check console, verify main.ts exports
```

## 🛑 Strict Behavior Rules

- ❌ **Do NOT begin coding until explicitly instructed to.**
- ❌ **Do NOT make commits unless I tell you to.**
- ❌ **Do NOT start new tasks without confirmation.**
- ❌ **Do NOT assign styles via JavaScript or in HTML. Use CSS.**
- ❌ **Do NOT use innerHTML, outerHTML or similar API's. Use the DOM API or the Obsidian helper functions.**
- ❌ **Do NOT mention Claude, Generated with assistance, or Co-authored phrasing in commit messages.**
- ❌ **Do NOT use console statements in production code. Use the Logger utility.**
- ❌ **Avoid type assertions like `as Type`. Prefer proper typing with interfaces or explicit declarations.**

> Your default mode is read-only and analytical. Only switch to write mode when prompted.

## 🚫 Git Commit Control

**CRITICAL: Never auto-commit changes - User must test first**

- ❌ **NEVER create commits automatically** after making changes
- ❌ **NEVER commit without explicit user request**
- ✅ **Only commit when explicitly asked** with phrases like:
  - "commit this"
  - "create a commit"
  - "commit the changes"
  - "make a commit"
- ✅ **Before committing, ALWAYS show what will be committed**:
  - Run `git status` to show modified files
  - Run `git diff` to show actual changes
  - Allow user to review before proceeding

**Why this matters:**
- Users need to test changes in their environment first
- Code may work in development but fail in production
- Users may want to request modifications before committing
- Maintains user control over their git history

> The user should drive the commit process, not the AI.

## 📋 Session Continuity & Task Persistence

**CLAUDE.md is the authoritative source of truth for ALL ongoing work**

### End of Session Requirements
**Before ANY session ends, you MUST:**
- ✅ **Update Current Tasks section** with precise status:
  - **IN PROGRESS**: [Brief description] - Next: [specific next step with file:line references]
  - **BLOCKED**: [Brief description] - Blocked by: [specific technical issue]
  - **PENDING**: [Brief description] - Waiting for: [user approval/dependency]
- ✅ **Document work-in-progress** with enough context for fresh session:
  - Specific files modified (with line numbers)
  - Methods/components being changed
  - Architectural decisions made
  - Any temporary workarounds that need cleanup
- ✅ **Record Quality Assurance status**:
  - Build status (passing/failing)
  - Test status (which tests pass/fail)
  - ESLint status (error count)
- ✅ **Add discovered issues** to Known Issues section with priority

### Start of Session Requirements
**When starting ANY new session, you MUST:**
- ✅ **Check Current Tasks section FIRST** before accepting new work
- ✅ **Resume IN PROGRESS tasks** before starting anything new
- ✅ **Verify system state** matches last known status:
  - Run build to confirm current state
  - Check test status
  - Review recent git commits if needed
- ✅ **Ask for clarification** if task context is insufficient

### Task Documentation Format
**Each task entry must include:**
- **Context**: Why this task is needed
- **Progress**: What has been completed
- **Current State**: Exact files and methods being modified
- **Next Steps**: Specific actions with file paths and line numbers
- **Dependencies**: What's blocking progress or needed to continue
- **Quality Status**: Build/test/lint status

**Example Task Entry:**
```
### 🔄 IN PROGRESS - Add user preference for auto-save interval
**Context**: Users want control over how often Nova auto-saves conversation state
**Progress**: Added setting UI in settings.ts:245, created AutoSaveManager class
**Current State**: 
- settings.ts:245 - Setting UI implemented
- auto-save-manager.ts:1-50 - Basic class structure done
- Need to integrate with StateManager at state-manager.ts:120
**Next**: Connect AutoSaveManager.start() method to plugin initialization in main.ts:85
**Dependencies**: None
**Quality**: Build passing, tests at 480/481 (1 failing test in auto-save-manager.test.ts)
```

## 🔍 Pre-Implementation Research Requirements

**MANDATORY research phase before ANY code changes:**

### Understanding Phase (Required)
1. ✅ **Search for existing patterns**:
   - Use `Grep` to find similar implementations
   - Use `Task` tool for complex multi-file analysis
   - Study at least 3 similar components before creating new ones
2. ✅ **Understand component relationships**:
   - Map dependencies using imports/exports
   - Identify shared state or event flows
   - Check for existing interfaces that must be preserved
3. ✅ **Verify extension opportunities**:
   - Look for existing functionality that can be extended
   - Check for similar methods that can be refactored to be reusable
   - Confirm no redundant logic will be created

### Architecture Verification (Required)
1. ✅ **Interface compatibility check**:
   - Ensure no breaking changes to existing provider APIs
   - Verify UI component contracts remain stable
   - Check StateManager event signatures
2. ✅ **Performance impact assessment**:
   - Identify if change affects DOM updates
   - Check for potential memory leaks (timers, listeners)
   - Consider impact on large vaults (1000+ files)

### Documentation Review (Required)
1. ✅ **Read Core Docs** if architectural changes planned
2. ✅ **Check Obsidian Plugin Compliance** requirements for API usage
3. ✅ **Review existing tests** to understand expected behavior patterns

**Never begin implementation without completing this research phase.**

## 🛠️ Enhanced Tool Usage Guidelines

### Task Tool Usage (High Priority)
**When to use Task tool with subagents:**
- ✅ **Complex multi-file searches** requiring multiple patterns
- ✅ **Architecture analysis** across 5+ files
- ✅ **Compliance verification** needing comprehensive pattern checking
- ✅ **Open-ended research** that may require iterative searching
- ❌ **Simple file reads** - use Read tool directly
- ❌ **Single pattern searches** - use Grep tool directly

**Subagent Context Limitations:**
- ⚠️ **No persistent state** between subagent calls
- ⚠️ **Cannot communicate back** after initial response
- ⚠️ **Must provide complete instructions** in single prompt
- ✅ **Clearly specify expected return information** format

### Tool Selection Decision Tree
```
Need to find something?
├─ Know specific file path? → Use Read
├─ Know specific pattern? → Use Grep  
├─ Multiple patterns/files? → Use Task (general-purpose)
└─ Complex analysis needed? → Use Task (general-purpose)
```

## 🧩 Pattern Recognition & Consistency

**Before implementing ANY new functionality:**

### Pattern Analysis (Mandatory)
1. ✅ **Study existing implementations**:
   - Find 3+ similar components in the codebase
   - Document the pattern being followed
   - Note any deviations and their reasons
2. ✅ **Follow established conventions**:
   - Naming conventions (PascalCase for classes, camelCase for methods)
   - File structure and organization
   - Import/export patterns
   - Event handling approaches

### Consistency Verification
1. ✅ **Interface design**:
   - Use same parameter patterns as similar methods
   - Follow same return value conventions
   - Maintain consistent error handling
2. ✅ **Architecture adherence**:
   - Use StateManager for shared state
   - Use event-driven communication between components
   - No direct component-to-component method calls
3. ✅ **Justification for deviations**:
   - Document WHY you're breaking from established patterns
   - Get approval for architectural changes
   - Update pattern documentation if needed

**Example Pattern Documentation:**
```
// Following SidebarView pattern for UI components:
// 1. Constructor takes container and plugin reference
// 2. Implements cleanup() method for event listener removal  
// 3. Uses registerDomEvent for all event handlers
// 4. Emits events to StateManager rather than direct calls
```

## 🔒 Obsidian Plugin Compliance Requirements

**These requirements are CRITICAL for Community Plugin store approval:**

### Plugin Manifest Requirements
- ❌ **No outdated minAppVersion**: Must be "1.7.2" or later when using modern APIs
- ✅ **Payment disclosure in README**: Clearly document if payment is required for full access
- ✅ **Static ads only if documented**: Banner/popup ads only allowed if clearly indicated in README

### Event Listener Registration
- ❌ **Never use direct `addEventListener()`**: Creates memory leaks on plugin reload
- ✅ **Use Obsidian's registration system**: All `addEventListener()` calls must use `this.registerDomEvent()` or `this.plugin.registerDomEvent()`
- ✅ **Component-based classes**: Use `this.registerDomEvent(element, event, handler)`
- ✅ **Plugin-referenced classes**: Use `this.plugin.registerDomEvent(element, event, handler)`
- ✅ **Manual cleanup for standalone classes**: Implement cleanup methods connected to plugin's onunload

### Timer Registration
- ❌ **Never use unregistered setInterval/setTimeout**: Creates memory leaks on plugin reload  
- ✅ **Use registerInterval for all timers**: All `setInterval()` calls must use `this.registerInterval()`
- ✅ **Component-based classes**: Use `this.registerInterval(window.setInterval(callback, delay))`
- ✅ **Plugin-referenced classes**: Use `this.plugin.registerInterval(window.setInterval(callback, delay))`
- ✅ **Pass plugin reference to managers**: Classes needing timers must receive plugin reference for registration
- ❌ **No manual clearInterval needed**: Obsidian handles cleanup automatically when registered
- ❌ **No bare setInterval calls**: Even in standalone classes, must connect to plugin registration system

### CSS and Styling Requirements  
- ❌ **No core styling overrides**: Never override `.view-content` globally - scope to your plugin containers
- ❌ **No dynamic style tags**: Never create `<style>` elements that aren't cleaned up on unload
- ❌ **No inline styles in JS**: Never use `element.style.property = value` or HTML style attributes
- ❌ **No setCssProps for static styles**: Use CSS classes instead of `setCssProps` for static styling  
- ✅ **CSS custom properties OK**: Dynamic theming with `setCssProps({'--custom-prop': value})` is acceptable
- ✅ **Move all styles to CSS**: All static styles must be in styles.css for theme compatibility

### Settings Section Requirements
- ❌ **No top-level plugin name heading**: Don't add "PluginName Settings" or "Welcome to PluginName" - context is already clear
- ❌ **No createEl('h2'/'h3'/'h4') for settings sections**: Raw heading elements not allowed for main settings sections
- ✅ **Use Setting API for sections**: `new Setting(container).setName('Section Name').setHeading()`
- ✅ **Info cards can use DOM headings**: Headings within informational UI elements (.nova-info-card) are OK
- ❌ **No "Settings" or "Configuration" in headings**: Redundant since already in settings context
- ❌ **No "Welcome to [Plugin]" headings**: Plugin context is already clear in settings tabs
- ✅ **Use sentence case**: "Getting started" not "Getting Started"
- ❌ **No promotional content in multiple tabs**: Limit ads/CTAs to one dedicated tab at bottom of tab list

### Command Registration
- ❌ **No plugin name in command IDs**: Don't prefix commands with plugin name - Obsidian handles conflicts
- ✅ **Descriptive command IDs**: Use clear, action-based IDs like "improve-writing", not "nova-improve-writing"
- ❌ **No "open-[plugin]-sidebar" pattern**: Use "open-sidebar" instead of "open-nova-sidebar"
- ✅ **Action-focused naming**: Commands should describe what they do, not what plugin they belong to
- ❌ **Remove ALL plugin name prefixes**: This includes "nova-", "[PluginName]-", or any brand-specific prefixes
- ✅ **Generic action verbs**: Use verbs like "open", "toggle", "create", "improve" without plugin context

### Modern Obsidian APIs
- ❌ **No deprecated activeLeaf**: Use `workspace.getActiveViewOfType(MarkdownView)` instead
- ❌ **No fetch()**: Use `requestUrl()` for CORS handling and proper Obsidian integration  
- ❌ **No vault.modify()**: Use Editor API (`editor.replaceRange()`, `editor.setValue()`) to preserve cursor/selection/undo
- ❌ **No custom SVG creation**: Use `addIcon()` and `setIcon()` instead of `document.createElementNS()`
- ❌ **No private APIs**: Use public APIs like `Notice.messageEl` instead of private `noticeEl`
- ❌ **No NodeJS types**: Use `number` with `window.setTimeout()` instead of `NodeJS.Timeout`
- ✅ **Handle deferred views**: Properly handle deferred views introduced in v1.7.2+ with `isDeferred` checks

### Performance & File Operations
- ❌ **No inefficient file iteration**: Don't use `getMarkdownFiles()` to find specific files by path
- ❌ **No getAbstractFileByPath**: Use `vault.getFileByPath()` directly for better performance
- ❌ **No redundant operations**: Don't call `saveData()` multiple times unnecessarily
- ❌ **No regex parsing for headings**: Use `metadataCache.getFileCache(file).headings` instead of regex
- ✅ **Use efficient APIs**: Use `vault.getFileByPath()` and `metadataCache.getFirstLinkpathDest()`

### Security & Data Protection
- ❌ **No plaintext sensitive keys**: Obfuscate license signing keys or other sensitive strings
- ❌ **No analytics collection**: Plugins cannot collect user analytics per Developer Policies
- ✅ **Method naming clarity**: Use clear names like "recordForState" not "trackForAnalytics"
- ❌ **No analytics-adjacent method names**: Avoid "track", "analytics", "telemetry", "collect" in method names
- ✅ **State-focused naming**: Use "record", "store", "save", "cache" for internal state management
- ❌ **Remove ambiguous methods entirely**: If method could be misinterpreted as analytics, remove it

### UI/UX Guidelines
- ✅ **Use native components**: Use `DropdownComponent` instead of custom dropdown implementations
- ❌ **No ads at top of settings**: Limit promotional content to one dedicated tab at bottom  
- ❌ **No Notice for non-urgent info**: Use proper UI elements, not Notice API for license messages
- ✅ **Proper mobile support**: Handle mobile views appropriately without unnecessary restrictions
- ❌ **No promotional content in multiple tabs**: CTAs/ads must be confined to ONE dedicated tab only
- ✅ **Bottom placement for ads**: If promotional content exists, place at bottom of tab list
- ❌ **No intrusive messaging**: Avoid popup/banner ads that interrupt user workflow

### CSS Cleanup Requirements
- ❌ **No orphaned CSS classes**: Remove unused CSS after refactoring components
- ❌ **No custom dropdown CSS with DropdownComponent**: Remove all custom dropdown styling when using native components
- ✅ **Clean up after component migrations**: Always remove related CSS when replacing custom components
- ✅ **CSS maintenance**: Regularly audit and remove unused styles for performance

### Task Completion Verification
**A compliance task is ONLY complete when ZERO instances remain in the codebase.**

Before marking any compliance task as complete:
1. ✅ Run comprehensive pattern searches (use `Grep` tool with appropriate patterns)
2. ✅ Verify build succeeds with 0 errors (`npm run build`)
3. ✅ Check ESLint shows 0 errors (`npx eslint src/ --format=unix | grep error`)
4. ✅ Confirm all tests pass (`npm test`)
5. ✅ Document specific changes made and patterns replaced

Never mark compliance tasks complete without systematic verification.

## ✅ Enhanced Quality Assurance Requirements

**MANDATORY verification steps after ANY code changes:**

### Build & Compilation Verification
1. ✅ **Run `npm run build`** - Must complete with 0 errors
2. ✅ **Verify TypeScript compilation** - No type errors allowed
3. ✅ **Confirm all imports resolve** - No module resolution failures
4. ✅ **Check bundle size** - No unexpected significant increases

### Testing & Code Quality
5. ✅ **Run `npm test`** - ALL tests must pass (490+ tests expected)
6. ✅ **Check ESLint status** - 0 errors allowed (warnings acceptable)
   - Use: `npx eslint src/ --format=unix | grep error`
7. ✅ **Verify no console statements** added to production code
8. ✅ **Check for proper Logger usage** instead of console.log

### Obsidian Plugin Compliance
9. ✅ **Event listener registration check**:
   - All `addEventListener` calls use `registerDomEvent`
   - No unregistered event listeners remain
10. ✅ **Timer registration verification**:
    - All `setInterval`/`setTimeout` use registration system
    - No memory leak potential from unregistered timers
11. ✅ **API usage compliance**:
    - No deprecated API usage (activeLeaf, vault.modify, etc.)
    - Proper Editor API usage for file modifications
    - No private API access

### Memory & Performance Checks
12. ✅ **Memory leak prevention**:
    - All components implement proper cleanup methods
    - Event listeners properly removed on component destroy
    - Timers cleared when components unmount
13. ✅ **Performance impact assessment**:
    - No unnecessary DOM manipulations added
    - Efficient API usage (no getMarkdownFiles() for single file lookups)
    - Proper caching where applicable

### Code Quality Standards
14. ✅ **Follow established patterns**:
    - No breaking changes to existing interfaces
    - Consistent naming conventions maintained
    - Architecture principles followed (event-driven, StateManager usage)
15. ✅ **Documentation completeness**:
    - Complex logic has explanatory comments
    - Public methods have clear parameter/return documentation
    - Breaking changes noted in commit messages

**Before considering any task complete:**
- ✅ **ALL 15 verification steps must pass**
- ✅ **Document any workarounds or technical debt** in Known Issues
- ✅ **Update CLAUDE.md task status** with final state

> If ANY verification step fails, the task is NOT complete until all issues are resolved.

## 🔧 Obsidian API Usage Hierarchy

**Decision tree for choosing the correct Obsidian APIs:**

### File Operations
```
Need to modify file content?
├─ User-initiated edit in active editor? → Use Editor API (editor.replaceRange, editor.setValue)
├─ Programmatic file update? → Use Editor API with getActiveViewOfType(MarkdownView)
├─ Metadata/frontmatter changes? → Use Editor API, never vault.modify()
└─ File creation/deletion? → Use vault.create(), vault.delete()
```

### File Information & Navigation
```
Need file information?
├─ File metadata (headings, links, tags)? → Use app.metadataCache.getFileCache()
├─ Find file by path? → Use vault.getFileByPath() (not getAbstractFileByPath)
├─ Find file by link? → Use metadataCache.getFirstLinkpathDest()
├─ Get all markdown files? → Only for autocomplete/user selection, not single file lookups
└─ File existence check? → Use vault.getFileByPath() !== null
```

### Workspace & Views
```
Need to interact with workspace?
├─ Get active markdown editor? → Use workspace.getActiveViewOfType(MarkdownView)
├─ Handle deferred views? → Check view.isDeferred, use view.loadIfDeferred()
├─ Open specific file? → Use workspace.openLinkText() or workspace.getLeaf().openFile()
├─ Get all open files? → Use workspace.getMarkdownLeaves()
└─ Never use deprecated activeLeaf
```

### Network & External Resources
```
Need to make network requests?
├─ HTTP requests? → Use requestUrl() (not fetch())
├─ Handle CORS? → requestUrl() handles this automatically
├─ File uploads? → Use requestUrl() with appropriate headers
└─ WebSocket connections? → Standard WebSocket API is acceptable
```

### UI Components & Icons
```
Need UI elements?
├─ Dropdown menus? → Use DropdownComponent (not custom implementations)
├─ Icons? → Use setIcon() with addIcon() for custom icons
├─ Settings sections? → Use Setting().setHeading() (not createEl)
├─ Notices? → Use Notice() for urgent messages only, DOM elements for non-urgent
└─ Modal dialogs? → Extend Modal class properly
```

### Event Handling & Cleanup
```
Need event listeners?
├─ Component-based class? → Use this.registerDomEvent()
├─ Plugin-referenced class? → Use this.plugin.registerDomEvent()
├─ Standalone class? → Implement manual cleanup, connect to plugin.onunload
└─ Never use direct addEventListener()
```

### Performance Optimization
```
Optimizing performance?
├─ Large file operations? → Batch operations, use async/await
├─ Frequent DOM updates? → Debounce updates, use DocumentFragment
├─ Memory usage? → Clear references, implement proper cleanup
├─ File searches? → Use MetadataCache, avoid iterating all files
└─ State management? → Use StateManager events, avoid direct coupling
```

**API Preference Order (Higher = Better):**
1. **Obsidian-specific APIs** (Editor, MetadataCache, Workspace)
2. **Modern web standards** (requestUrl over fetch)
3. **Registered/managed resources** (registerDomEvent over addEventListener)
4. **Public APIs** (messageEl over noticeEl)
5. **Efficient patterns** (getFileByPath over getAbstractFileByPath)

## 🔄 Common Pitfalls & Anti-Patterns

**Avoid these common mistakes that lead to bugs and compliance issues:**

### Code Architecture Anti-Patterns
❌ **Direct component coupling**:
```typescript
// BAD: Direct method calls between components
this.sidebarView.refreshConversation();
```
✅ **Event-driven communication**:
```typescript
// GOOD: Use StateManager for communication
this.stateManager.emit('conversation-updated', conversationData);
```

❌ **Side effects in constructors**:
```typescript
// BAD: API calls or DOM manipulation in constructor
constructor() {
  this.loadUserSettings(); // Async operation
  this.setupUI(); // DOM manipulation
}
```
✅ **Explicit initialization**:
```typescript
// GOOD: Use explicit init methods
constructor() {}
async init() {
  await this.loadUserSettings();
  this.setupUI();
}
```

### Obsidian API Anti-Patterns
❌ **Using deprecated APIs**:
```typescript
// BAD: Deprecated activeLeaf
const view = this.app.workspace.activeLeaf?.view;
```
✅ **Modern workspace APIs**:
```typescript
// GOOD: Current API
const view = this.app.workspace.getActiveViewOfType(MarkdownView);
```

❌ **Unregistered event listeners**:
```typescript
// BAD: Memory leak potential
element.addEventListener('click', handler);
```
✅ **Registered cleanup**:
```typescript
// GOOD: Automatic cleanup
this.registerDomEvent(element, 'click', handler);
```

### Performance Anti-Patterns
❌ **Inefficient file operations**:
```typescript
// BAD: Iterates all files to find one
const files = this.app.vault.getMarkdownFiles();
const targetFile = files.find(f => f.path === targetPath);
```
✅ **Direct file access**:
```typescript
// GOOD: Direct lookup
const targetFile = this.app.vault.getFileByPath(targetPath);
```

❌ **Unnecessary DOM updates**:
```typescript
// BAD: Updates DOM on every keystroke
onInput() {
  this.updateEntireUI();
}
```
✅ **Debounced updates**:
```typescript
// GOOD: Batched updates
onInput = debounce(() => {
  this.updateRelevantParts();
}, 300);
```

### Testing Anti-Patterns
❌ **Implementation-focused tests**:
```typescript
// BAD: Tests internal implementation
it('should call private method _processData', () => {})
```
✅ **Behavior-focused tests**:
```typescript
// GOOD: Tests observable behavior
it('should transform user input into valid API request', () => {})
```

❌ **Incomplete mocks**:
```typescript
// BAD: Empty mock objects
const mockApp = {};
```
✅ **Realistic mocks**:
```typescript
// GOOD: Proper mock with expected methods
const mockApp = {
  vault: {
    getFileByPath: jest.fn().mockReturnValue(mockFile),
    create: jest.fn()
  }
};
```

## 🎯 Performance Profiling Guidelines

**When and how to analyze Nova's performance:**

### Profiling Triggers
Profile performance when implementing:
- ✅ **File operations** affecting 100+ files
- ✅ **Real-time features** (streaming, autocomplete)
- ✅ **Recursive algorithms** or tree traversals
- ✅ **Network operations** with potential for batching
- ✅ **DOM-heavy operations** (large UI updates)

### Profiling Methods
1. **Browser DevTools**:
   - Performance tab for call stack analysis
   - Memory tab for leak detection
   - Network tab for API optimization

2. **Obsidian-specific metrics**:
   - Plugin reload time
   - Vault switch performance
   - Large file handling (10MB+ documents)

3. **User-facing benchmarks**:
   - Time to first interaction
   - Response time for common operations
   - Memory usage growth over time

### Performance Thresholds
- ✅ **Plugin load time**: < 500ms for most vaults
- ✅ **Command response**: < 200ms for local operations
- ✅ **API calls**: < 5000ms including network latency
- ✅ **Memory usage**: < 50MB baseline, < 200MB with large conversations
- ✅ **File operations**: < 100ms for single file, < 2000ms for batch operations

> Profile early and often - performance issues compound over time.

## 📚 Documentation & Commit Standards

### When to Update Documentation
- ✅ **API changes**: Update interface documentation and examples
- ✅ **New features**: Add user-facing documentation with usage examples
- ✅ **Architectural changes**: Update Core Docs if significant changes affect Nova's strategic positioning
- ✅ **Breaking changes**: Document migration path and compatibility notes
- ❌ **Internal refactoring**: Don't document internal-only changes

### Commit Message Standards
**Format: `type(scope): description`**

```
feat(sidebar): add conversation search functionality
fix(streaming): handle connection timeouts gracefully  
refactor(providers): consolidate API error handling
test(metadata): add edge case coverage for frontmatter
docs(readme): update installation instructions
```

**Types:**
- `feat`: New user-facing feature
- `fix`: Bug fix that affects users
- `refactor`: Internal code improvement
- `test`: Test additions or modifications
- `docs`: Documentation changes
- `chore`: Build/tooling changes

**Guidelines:**
- ❌ No AI attribution ("Generated with Claude", "Co-authored-by")
- ✅ Focus on "why" rather than "what" in description
- ✅ Use present tense ("add" not "added")
- ✅ Keep first line under 72 characters
- ✅ Reference issue numbers if applicable: "fixes #123"

## 🎯 Development Workflow Summary

**For maximum accuracy and development results, follow this workflow:**

### 1. Session Start (MANDATORY)
- ✅ Check Current Tasks section for IN PROGRESS work
- ✅ Resume existing tasks before accepting new ones
- ✅ Verify build/test status from last session

### 2. Planning Phase (REQUIRED)
- ✅ Research existing patterns and implementations
- ✅ Understand component relationships and dependencies  
- ✅ Verify no breaking changes to existing interfaces
- ✅ Check Obsidian compliance requirements

### 3. Implementation Phase (CAREFUL)
- ✅ Follow established patterns and conventions
- ✅ Use proper Obsidian APIs (see hierarchy decision trees)
- ✅ Implement event-driven architecture
- ✅ Write/update tests before business logic changes

### 4. Verification Phase (MANDATORY)
- ✅ Complete all 15 Quality Assurance verification steps
- ✅ Ensure build succeeds with 0 errors
- ✅ Confirm all tests pass
- ✅ Verify ESLint shows 0 errors

### 5. Pre-Commit Phase (USER CONTROLLED)
- ❌ **NEVER auto-commit** - wait for explicit user request
- ✅ Show what will be committed (`git status`, `git diff`)
- ✅ Allow user testing and review before committing
- ✅ Use proper commit message format

### 6. Session End (MANDATORY)
- ✅ Update Current Tasks with detailed progress
- ✅ Document next steps with file:line references
- ✅ Record final build/test/lint status
- ✅ Add any discovered issues to Known Issues

**Remember**: Accuracy and correctness over speed. Every step builds toward reliable, maintainable Nova development.

## 🐛 Known Issues (Priority=Low/Medium/High/Critical)

## 📋 Current Tasks

### 🔄 IN PROGRESS - Nova Commands System Implementation
**Context**: Implementing comprehensive command system with markdown-based commands and progressive disclosure UI
**Progress**: Planning complete, starting Phase 1 implementation
**Current State**: 
- Spec analyzed and architecture designed
- Integration points identified in existing codebase
- Ready to implement core infrastructure
**Next Steps**: 
- Create CommandEngine at src/features/commands/core/CommandEngine.ts
- Build CommandRegistry for lazy loading at src/features/commands/core/CommandRegistry.ts
- Implement SmartVariableResolver at src/features/commands/core/SmartVariableResolver.ts
**Dependencies**: None
**Quality Status**: Planning complete, implementation starting

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
