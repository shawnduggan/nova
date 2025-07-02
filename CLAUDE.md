# Nova Plugin Development – CLAUDE.md

## 🧠 Core Engineering Principles

- ✅ **Extend, Don't Duplicate** – Reuse existing patterns and functions. Never add redundant logic.
- ✅ **DRY + SOLID** – Apply clear separation of concerns. No copy-paste logic, magic strings, or tightly coupled flows.
- ✅ **Stable Contracts** – Changes must not break existing provider, UI, or state interfaces.
- ✅ **Performance-Aware** – Avoid unnecessary DOM updates or state recalculations. Profile when needed.

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

**HIGH Model dropdown on mobile has no padding on the items.**: Should mimic the same padding as desktop, but adjusted for mobile.

**HIGH Hover effect on buttons is just a red square**: When hovering over the clear conversation history, delete all context files, or any single delete file button, instead of the translucent subtle red shading, its a solid red square which is quite offputting.

## 📋 Current Tasks


### Future Enhancements 

**MEDIUM User-configurable log levels**: Add setting in plugin settings tab to allow users to adjust logging verbosity (Debug, Info, Warn, Error). Currently hardcoded to INFO level. Would help with troubleshooting and support, and allow users to reduce logging overhead if needed.

**LOW Add slider setting for scroll speed**: Maybe on the General settings tab.
