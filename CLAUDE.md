

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

* privacyIndicator not switching from local to cloud properly
* Revise model list. Remove Sonnet 3.5 Oct 22, Add o4, o3 models. Claude Code should ask me for input.
* remove all logging

## 🔧 PRIVACY INDICATOR SWITCHING BUG FIX

### Root Cause
When users switch between models (e.g., Claude to Ollama or vice versa), the privacy indicator doesn't update from cloud to local or vice versa. This happens because:

1. `updatePrivacyIndicator()` correctly detects provider type (ollama = local, others = cloud)
2. `switchToModel()` updates settings but doesn't call `refreshProviderStatus()`
3. Privacy indicator never gets refreshed after model switch

### Solution
**In `sidebar-view.ts`**, add call to `refreshProviderStatus()` in `switchToModel()` method:

```typescript
private switchToModel(providerType: string, modelValue: string): void {
    try {
        // ... existing code ...
        
        // Save settings asynchronously (don't block UI)
        this.plugin.saveSettings().catch(error => {
            console.error('Error saving model selection:', error);
            this.addErrorMessage('Failed to save model selection');
        });
        
        // ADD THIS: Refresh privacy indicator and other status elements
        this.refreshProviderStatus().catch(error => {
            console.error('Error refreshing provider status:', error);
        });
        
    } catch (error) {
        // ... existing error handling ...
    }
}
```

### Files to Modify
- `src/ui/sidebar-view.ts` (line ~2700, in switchToModel method)

