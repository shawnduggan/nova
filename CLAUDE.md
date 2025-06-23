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
- ❌ **Do NOT mention Claude in commit messages.**

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

## 🐛 Known Issues

> No known issues currently.

## 📋 Current Tasks

BUG: info console logging reveals too much. 🔧 Commands feature check: {now: '2025-06-23T21:12:12.306Z', supernovaDate: '2025-07-20T00:00:00.000Z', generalDate: '2025-09-30T00:00:00.000Z', isSupernova: false, debugEnabled: false, …}
plugin:nova:11123 🔧 Commands: Not enabled - before release date

BUG: Settings in data.json could thwart app behaviour customCommands[], showCommandButton, debugSettings
   "customCommands": [],
  "general": {
    "defaultTemperature": 0.7,
    "defaultMaxTokens": 1000,
    "autoSave": true
  },
  "showCommandButton": true,
  "licensing": {
    "licenseKey": "",
    "supernovaLicenseKey": "dXNlckBleGFtcGxlLmNvbXxhbm51YWx8MjAyNi0wNi0yMlQxNjozMjowOS40NTRafDIwMjUtMDYtMjJUMTY6MzI6MDkuNDU0WnwzOGY4YWNjMDMzZGM0MjllODI1ZmM4YTMyZGI4YzdiODZiNGJlMzgzNTY1Mzg2ZDEwZDI1OWViMjk0ODhlNzcz",
    "isSupernova": false,
    "debugSettings": {
      "enabled": false,
      "forceSupernova": false
    }
