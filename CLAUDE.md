

# Nova Plugin Development Notes

## Implementation Guidelines for CC

### Core Principles
* **Extend Don't Duplicate:** Build on existing features - never create duplicated functions or workflows
* **Follow Existing Patterns:** Use established Nova architecture for providers, settings, UI, and error handling
* **Apply DRY and SOLID:** Use Don't Repeat Yourself and SOLID principles for clean, maintainable code
* **Test-Driven Development:** Write/update tests before implementing new functionality
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
* **Follow TDD principles where it makes sense:** Unit tests should test what is valuable. Write unit tests for business logic, not UI and DOM interactions which are complex to mock and offer little value.

## 🎯 PENDING TASKS

* remove all logging
* Switching providers does not update token count

