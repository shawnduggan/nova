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

### CRITICAL - Obsidian Plugin Compliance Fixes (PR #6955 Feedback)

**Phase 1: REQUIRED - Monetization & Disclosures**
- **COMPLETED**: Update README.md with clear SuperNova pricing disclosure - Updated messaging to clarify early access model and graduation to free tier
- **COMPLETED**: Fix README-browser.md "Free forever" claims to reflect freemium model - Updated to match main README messaging
- **COMPLETED**: Remove SuperNova ads from General settings tab - Removed createSupernovaCTA call from createGeneralTabContent
- **COMPLETED**: Remove SuperNova ads from Providers settings tab - Removed createSupernovaCTA call from createProvidersTabContent

**Phase 2: REQUIRED - API Compliance**
- **COMPLETED**: Replace fetch() with requestUrl() in google-provider.ts (3 instances) - Updated all fetch calls and adapted streaming to use simulated chunking, all tests passed
- **COMPLETED**: Replace fetch() with requestUrl() in openai-provider.ts (3 instances) - Updated all fetch calls and adapted streaming to use simulated chunking, all tests passed
- **COMPLETED**: Replace fetch() with requestUrl() in ollama-provider.ts (5 instances) - Updated all fetch calls and adapted streaming to use simulated chunking, all tests passed
- **PENDING**: Remove inline styles from SVG icons in sidebar-view.ts (13 instances) - Next: Create CSS classes for icon sizing

**Phase 3: OPTIONAL - Type Safety Improvements** 
- **PENDING**: Reduce `any` usage in sidebar-view.ts (15+ instances) - Next: Create interface for sidebar view properties
- **PENDING**: Add proper types to conversation-manager.ts sanitization methods - Next: Define sanitization parameter types
- **PENDING**: Fix type safety in metadata-command.ts (20+ instances) - Next: Create interfaces for property updates

**Quality Assurance Requirements:**
After each task: Run `npm run build`, `npm test`, check ESLint status (0 errors required)
Final: Comprehensive testing of all providers, UI components, and core functionality

### Recent Completions


### Future Enhancements

**MEDIUM Make return key hit enter on custom Tell Nova modal**: Currently hitting enter doesn't do anything. I want it to submit the form.

**LOW Remove privacy indicator on mobile view**: It doesn't provide value on mobile - all models are cloud

**MEDIUM Mobile Model Dropdown has no padding**: The provider names do, but the model names don't. We've tried to fix this a few times with no luck.

**LOW Consolidate input trigger detection**: Currently wikilinks (`[[`) and commands (`:`) use separate input listeners. Should consolidate into unified trigger detection system in InputHandler for better performance and cleaner architecture.

### Someday Maybe

**LOW Add slider setting for scroll speed**: Maybe on the General settings tab.

**MEDIUM User-configurable log levels**: Add setting in plugin settings tab to allow users to adjust logging verbosity (Debug, Info, Warn, Error). Currently hardcoded to INFO level. Would help with troubleshooting and support, and allow users to reduce logging overhead if needed.
