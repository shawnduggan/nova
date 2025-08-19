# Nova Plugin Development – CLAUDE.md

## 🧠 Core Engineering Principles

- ✅ **Extend, Don't Duplicate** – Reuse existing patterns and functions. Never add redundant logic.
- ✅ **DRY + SOLID** – Apply clear separation of concerns. No copy-paste logic, magic strings, or tightly coupled flows.
- ✅ **Stable Contracts** – Changes must not break existing provider, UI, or state interfaces.
- ✅ **Performance-Aware** – Avoid unnecessary DOM updates or state recalculations. Profile when needed.

## 📚 Required Context & Strategic Documentation

**Before coding, read Nova's core strategic docs** in /Users/shawn/Library/Mobile Documents/iCloud~md~obsidian/Documents/Basecamp/09-Projects/Nova/Core Docs/ to understand Nova.

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

## 🧪 Development & Testing

- ✅ Always write or update tests before implementing new business logic.
- ❌ Avoid UI snapshot or DOM unit tests unless explicitly requested.
- ✅ Test all edge cases that affect global state or plugin behavior.

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

## ✅ Quality Assurance Requirements

**After ANY code changes, you MUST:**
- ✅ Run `npm run build` - must complete with 0 errors
- ✅ Run `npm test` - all tests must pass (476+ tests)
- ✅ Check ESLint status - 0 errors allowed (warnings are acceptable)
- ✅ Verify TypeScript compilation passes without errors
- ✅ Confirm all imports resolve correctly

**Before considering any task complete:**
- ✅ Validate that production code builds successfully
- ✅ Ensure no ESLint errors remain (use `npx eslint src/ --format=unix | grep error`)
- ✅ Verify all tests continue to pass

> If build, tests, or linting fail, the task is NOT complete until all issues are resolved.

## 🛠️ Tool Usage Guidelines

- ✅ Use `Task` tool for complex searches across multiple files
- ✅ Use `Grep` and `Glob` for specific pattern searches
- ✅ Use `Read` tool for examining specific files
- ✅ Use `Edit` or `MultiEdit` for code changes
- ✅ Use `TodoWrite` only as optional session-internal working memory
- ✅ Always reason through the task before making changes

> CLAUDE.md is the authoritative task source. TodoWrite is temporary session state only.

## 🔄 Session Continuity Guidelines

**When context runs low or session ends:**
- ✅ Update task status in Current Tasks section with progress notes
- ✅ Document any work-in-progress with specific next steps
- ✅ Add any discovered issues to Known Issues section
- ✅ Note which Quality Assurance steps still need completion
- ✅ Include relevant file paths and line numbers for context

**Task Status Format:**
- **IN PROGRESS**: [Brief description] - Next: [specific next step]
- **BLOCKED**: [Brief description] - Blocked by: [specific issue]
- **PENDING**: [Brief description] - Waiting for: [dependency/approval]

## 🐛 Known Issues (Priority=Low/Medium/High/Critical)

## 📋 Current Tasks

### CRITICAL - Obsidian Plugin Compliance Fixes (PR #6955 Review)

Based on Obsidian plugin review feedback, addressing 29 specific issues for plugin approval.

**Phase 1: CRITICAL - Must Fix for Approval**

- **COMPLETED**: #1 Payment/ads disclosure - Payment requirements and static ads clearly indicated in README
- **COMPLETED**: #2 Incorrect minAppVersion - Update from "0.15.0" to latest public build for newer APIs used
- **COMPLETED**: #3 Core styling override - Don't overwrite `.view-content` core styling, add plugin-specific class/data attribute
- **COMPLETED**: #4 Style tag memory leak - Remove style tags appended on view load, use styles.css instead
- **COMPLETED**: #5 Inline styles in JavaScript - Move all inline styles and JS style assignments to CSS for theme compatibility
- **COMPLETED**: #6 Unregistered event listeners - Register multiple event listeners and intervals for cleanup on plugin unload
- **COMPLETED**: #7 Using vault.modify instead of Editor API - Use Editor interface to preserve cursor, selections, undo/redo
- **COMPLETED**: #8 Command ID includes plugin name - Remove 'nova-' prefix from command IDs; Obsidian handles conflicts
- **COMPLETED**: #9 Top-level heading in settings - Remove "Nova Settings" heading in settings tab
- **COMPLETED**: #10 "Settings" in section headings - Remove word "settings" from settings section headings
- **COMPLETED**: #11 Improper heading format - Use `new Setting(containerEl).setName('name').setHeading()` for section headings
- **PENDING**: #12 Incorrect text casing - Use sentence case in UI instead of title case
- **COMPLETED**: #13 "Configuration" in headings - Remove word "configuration" from settings headings
- **COMPLETED**: #14 Using fetch instead of requestUrl - Use Obsidian's requestUrl function for CORS handling
- **PENDING**: #15 DeferredView handling - Properly handle deferred views introduced in v1.7.2
- **PENDING**: #16 Custom SVG icons - Use addIcon and setIcon instead of creating SVG elements manually
- **COMPLETED**: #17 Ad placement - Don't show ads at top of every settings tab; limit to one tab at bottom
- **PENDING**: #29 Analytics collection - Remove analytics collection per Developer Policies

**Phase 2: REQUIRED - Performance & API Best Practices**

- **PENDING**: #18 Iterating all files inefficiently - Avoid getMarkdownFiles() to find files by path
- **PENDING**: #19 File path resolution - Use Vault.getFileByPath instead of multiple getAbstractFileByPath attempts
- **PENDING**: #20 Deprecated activeLeaf - Use Workspace.getActiveViewOfType or getLeaf instead
- **PENDING**: #21 Unnecessary multiple saves - Remove redundant saveData() calls
- **PENDING**: #22 Unobfuscated license key - Properly obfuscate license signing key as claimed
- **PENDING**: #23 Incorrect heading regex - Use MetadataCache instead of regex with false positives
- **PENDING**: #25 NodeJS.Timeout type - Use regular number type with window.setTimeout/clearTimeout
- **PENDING**: #26 Private Notice property - Use Notice.messageEl instead of accessing private noticeEl

**Phase 3: RECOMMENDED - UI/UX Guidelines**

- **PENDING**: #27 License messages as notices - Use appropriate UI for license messages instead of notices
- **PENDING**: #28 Custom dropdown implementation - Use DropdownComponent instead of custom dropdown

**Phase 4: OPTIONAL - Code Quality**

- **PENDING**: #24 Already using correct API - (Acknowledges correct usage of metadataCache)
- **PENDING**: Reduce `any` usage in sidebar-view.ts (15+ instances) - Create interface for sidebar view properties
- **PENDING**: Add proper types to conversation-manager.ts sanitization methods - Define sanitization parameter types
- **PENDING**: Fix type safety in metadata-command.ts (20+ instances) - Create interfaces for property updates

**Quality Assurance Requirements:**
After each task: Run `npm run build`, `npm test`, check ESLint status (0 errors required)
Final: Comprehensive testing of all providers, UI components, and core functionality
Phase 1 completion required before plugin can be approved for Community Plugin store

### Recent Completions

**COMPLETED**: Task #11 - Convert section headings to proper Obsidian Setting API format
- Replaced 6 section headings from raw HTML createEl('h3') to proper Setting API format
- Updated: Debug, Privacy & Platform, Core, Configure Your API Keys, Platform, and Custom Commands sections
- Used `new Setting(containerEl).setName('heading').setHeading()` format as required by Obsidian
- Preserved informational headings in info cards as DOM elements (appropriate usage)
- Maintained proper visual hierarchy and spacing throughout settings interface
- All 481 tests pass, build succeeds with 0 errors, follows Obsidian plugin guidelines

**COMPLETED**: Task #10 & #13 - Remove "Settings" and "Configuration" from section headings
- Updated all section headings to remove redundant "Settings" terminology: "Core Settings" → "Core", "Privacy & Platform Settings" → "Privacy & Platform", "Debug Settings" → "Debug", etc.
- Replaced "Configuration" headings with "Setup" for clearer, non-redundant language
- Updated navigation help text to remove redundant "Settings" references
- Maintained clear, descriptive section names without unnecessary verbosity
- All 481 tests pass, build succeeds with 0 errors, follows Obsidian plugin guidelines

**COMPLETED**: Task #9 - Remove "Nova Settings" heading from settings tab
- Removed redundant top-level "Nova Settings" heading from settings.ts display() method
- Preserved all settings functionality and section organization without the heading
- Settings tab maintains proper visual hierarchy as tab context provides the heading context
- Verified no other references to the heading exist in codebase
- All 481 tests pass, build succeeds with 0 errors, follows Obsidian plugin guidelines

**COMPLETED**: Task #8 - Command ID compliance by removing plugin name prefixes
- Removed 'nova-' prefix from command IDs: improve-writing, make-longer, make-shorter, and all tone commands
- Updated dynamic tone command registration to use clean IDs without redundant plugin prefix
- Kept 'open-nova-sidebar' as appropriate (describes Nova's sidebar, not redundant prefix)
- Verified no hardcoded references to old command IDs exist in codebase
- All 481 tests pass, build succeeds with 0 errors, follows Obsidian plugin guidelines

**COMPLETED**: Task #7 - Editor API implementation to replace vault.modify usage
- Replaced all vault.modify() calls with proper Editor API usage in document-engine.ts and metadata-command.ts
- Updated document appending logic to use editor.replaceRange() instead of full file rewrite
- Changed full document replacement to use editor.setValue() preserving cursor and selections
- Updated all metadata/frontmatter operations to use editor interface instead of direct file modification  
- Fixed all test expectations to match new editor-based approach
- All 481 tests pass, build succeeds with 0 errors, preserves cursor position/selections/undo-redo functionality

**COMPLETED**: Task #6 - Unregistered event listeners cleanup system implementation
- Implemented proper event listener registration for all UI components using Obsidian's cleanup system
- Added manual cleanup systems for standalone classes (Settings, Command System, Custom Modal, Wikilink Suggest)
- Replaced direct addEventListener calls with registerDomEvent/registerEventListener patterns
- Connected all cleanup methods to plugin's onunload lifecycle
- All 476 tests pass, build succeeds with 0 errors, prevents memory leaks on plugin reload

### Future Enhancements

**MEDIUM Make return key hit enter on custom Tell Nova modal**: Currently hitting enter doesn't do anything. I want it to submit the form.

**LOW Remove privacy indicator on mobile view**: It doesn't provide value on mobile - all models are cloud

**MEDIUM Mobile Model Dropdown has no padding**: The provider names do, but the model names don't. We've tried to fix this a few times with no luck.

**LOW Consolidate input trigger detection**: Currently wikilinks (`[[`) and commands (`:`) use separate input listeners. Should consolidate into unified trigger detection system in InputHandler for better performance and cleaner architecture.

### Someday Maybe

**LOW Add slider setting for scroll speed**: Maybe on the General settings tab.

**MEDIUM User-configurable log levels**: Add setting in plugin settings tab to allow users to adjust logging verbosity (Debug, Info, Warn, Error). Currently hardcoded to INFO level. Would help with troubleshooting and support, and allow users to reduce logging overhead if needed.
