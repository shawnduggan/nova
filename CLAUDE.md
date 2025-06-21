

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

## 🎯 PENDING TASKS

* dot bug in privacyIndicator on mobile
* Revise model list. Remove Sonnet 3.5 Oct 22, Add o4, o3 models
* remove all logging

