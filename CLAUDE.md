

# Nova Plugin Development Notes

## Implementation Guidelines for CC

### Core Principles
* **Extend Don't Duplicate:** Build on existing features - never create duplicated functions or workflows
* **Follow Existing Patterns:** Use established Nova architecture for providers, settings, UI, and error handling
* **Apply DRY and SOLID:** Use Don't Repeat Yourself and SOLID principles for clean, maintainable code
* **Test-Driven Development:** Write/update tests before implementing new functionality. Focus on business logic not complex low-value UI and DOM tests.
* **Performance First:** Profile changes affecting conversation flow or UI responsiveness
* **Code Reuse:** Always verify existing functionality before creating new implementations

### Quality Gates
* **Before coding:** Understand existing systems that can be extended
* **During development:** Ensure no regression in existing features  
* **Before completion:** Test edge cases and verify no breaking change

### Process
* **Don't start tasks unless I ask you to:** Never race ahead and start a new task before the current one is finished.
* **Don't be a sycophant:** Give honest opinions. Never start a response with "You're absolutely right!"
* **Never commit unless I ask you to:** I need to test and validate all changes first
* **Never mention Claude in a commit comment:** Keep comments clean and to the point

## Serena Tools Usage

### When using Serena's MCP tools:
1. Always call `initial_instructions` before starting any programming task
2. Check onboarding status with `check_onboarding_performed` and run if needed
3. Prefer symbolic operations (`find_symbol`, `replace_symbol_body`) over line-based edits
4. Use `get_symbols_overview` before diving into specific code sections
5. Store project-specific knowledge with memory tools for future reference
6. Use `think_about_collected_information` after search sequences
7. Call `think_about_task_adherence` before making code changes
8. Use `summarize_changes` after completing non-trivial tasks

## 🎯 PENDING TASKS

No pending tasks.

