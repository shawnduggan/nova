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
- ❌ **Do NOT assign styles via JavaScript or in HTML. Sse CSS.**
- ❌ **Do NOT use innerHTML, outerHTML or similar API's. Use the DOM API or the Obsidian helper functions.**
- ❌ **Do NOT mention Claude, Generated with assistance, or Co-authored phrasing in commit messages.**

> Your default mode is read-only and analytical. Only switch to write mode when prompted.

## 🧰 Serena MCP Usage

- ✅ Always call `initial_instructions` before starting any programming task.
- ✅ Run `check_onboarding_performed` and complete onboarding if needed.
- ✅ Use symbolic tools (`find_symbol`, `replace_symbol_body`, etc.) – avoid direct file edits when possible.
- ✅ Use `get_symbols_overview` to understand structure before making changes.
- ✅ Use `think_about_collected_information` before writing code.
- ✅ Use `think_about_task_adherence` before editing any file.
- ✅ Always run `summarize_changes` after non-trivial tasks.

> Never execute or modify without reasoning through the task first.

## 🐛 Known Issues (Priority=Low/Medium/High/Critical)


## 📋 Current Tasks

### Obsidian Review Issues (CRITICAL - In Progress)

**Status**: Starting with task 1 of 6

1. **[COMPLETED] Move JavaScript Style Assignments to CSS**
   - ✅ sidebar-view.ts - All inline styles replaced with CSS classes
   - ✅ input-handler.ts - All inline styles replaced with CSS classes  
   - ✅ provider-manager.ts - All inline styles replaced with CSS classes
   - ✅ context-manager.ts - All inline styles replaced with CSS classes
   - ✅ custom-instruction-modal.ts - All inline styles replaced with CSS classes
   - ✅ command-system.ts - Major inline styles replaced (minor ones remain)
   - ⚠️ settings.ts - SKIPPED (complex confetti animations, low priority)
   - **Result**: All critical style assignments moved to CSS classes

2. **[PENDING] Replace innerHTML with DOM API**
   - Files to fix: chat-renderer.ts, sidebar-view.ts, input-handler.ts, settings.ts
   - Use Obsidian's createEl() and DOM methods

3. **[PENDING] Replace Type Casting with instanceof Checks**
   - Files to fix: sidebar-view.ts, context-manager.ts, conversation-context-persistence.test.ts
   - Replace `as TFile` and `as TFolder` with proper type guards

4. **[PENDING] Fix Command ID**
   - Change 'nova-tell-nova' to 'tell-assistant' in main.ts
   - Keep display name as 'Tell Nova...'

5. **[PENDING] Reduce 'as any' Casting (Optional)**
   - Files to fix: sidebar-view.ts, streaming-manager.ts, selection-context-menu.ts, provider-manager.ts

---

**LOW Add slider setting for scroll speed**: Maybe on the General settings tab.
