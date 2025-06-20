

# Nova Plugin Development Notes

## 🎯 PENDING TASKS

### **BUG: Provider Dropdown Shows "II" on Reload**
Provider dropdown displays "II" instead of selected provider name on Obsidian restart/reload. Issue is in `sidebar-view.ts:2488-2528` where `updateCurrentProvider()` async function is called synchronously during dropdown initialization, causing display corruption before provider info loads.

**Root cause:** Timing issue where dropdown UI is rendered before async provider data is available.
**Location:** `src/ui/sidebar-view.ts` lines 2488-2528 (updateCurrentProvider function and initialization)
**Fix needed:** Proper async initialization with fallback display text during loading.

### **Task: Document Reading Time Display**
Change document stats/analytics to show reading time instead of word count and sections. Should display like "~ 4 min read". Use existing word count function in `updateDocumentStats()` in `sidebar-view.ts:2034-2069`, divide words by 225 to get reading time.

---

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
* **Before completion:** Test edge cases and verify no breaking changes