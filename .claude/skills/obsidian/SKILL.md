---
name: obsidian-plugin-development
description: Obsidian plugin development best practices, ESLint rules, submission requirements, and API patterns. Auto-loads when working on Obsidian plugin code.
---

# Obsidian Plugin Development Skill

Comprehensive guidelines for developing high-quality Obsidian plugins that follow best practices, pass code review, and adhere to official submission guidelines.

## Top 20 Critical Rules

### Submission & Naming (Bot-Enforced)
1. Plugin ID: no "obsidian", can't end with "plugin", lowercase only
2. Plugin name: no "Obsidian", can't end with "Plugin"
3. Plugin name: can't start with "Obsi" or end with "dian"
4. Description: no "Obsidian", "This plugin", etc.
5. Description must end with `.?!)` punctuation

### Memory & Lifecycle
6. Use `registerEvent()` for automatic cleanup
7. Don't store view references in plugin class
8. Use `instanceof` instead of type casting

### UI/UX
9. Use sentence case for all UI text
10. No "command" in command names/IDs
11. No plugin ID in command IDs
12. No default hotkeys - let users set their own
13. Use `.setHeading()` for settings section headings

### API Best Practices
14. Use Editor API for active file edits (`editor.replaceRange()`)
15. Use `Vault.process()` for background file modifications
16. Use `normalizePath()` for user-provided paths
17. Use `Platform` API for OS detection
18. Use `requestUrl()` instead of `fetch()`
19. No `console.log` in onload/onunload in production

### Styling
20. Use Obsidian CSS variables
21. Scope CSS to plugin containers

### Accessibility (MANDATORY)
22. Make all interactive elements keyboard accessible
23. Provide ARIA labels for icon buttons
24. Define clear focus indicators (`:focus-visible`)

### Security & Compatibility
25. Don't use `innerHTML`/`outerHTML` - use DOM API
26. Avoid regex lookbehind (iOS incompatible)
27. Remove all sample/template code before submission

## Event Listeners & Timers

```typescript
// ❌ WRONG - Memory leak, won't be cleaned up
element.addEventListener('click', handler);
setTimeout(() => {}, 1000);
setInterval(() => {}, 5000);

// ✅ CORRECT - Automatic cleanup on plugin unload
this.registerDomEvent(element, 'click', handler);
this.registerInterval(window.setInterval(() => {}, 5000));
// For setTimeout, use a TimeoutManager pattern
```

## File Operations

```typescript
// ❌ WRONG - Deprecated/inefficient
const file = this.app.vault.getAbstractFileByPath(path);
await this.app.vault.modify(file, content);
await this.app.vault.read(file);
const found = this.app.vault.getMarkdownFiles().find(f => f.path === path);

// ✅ CORRECT - Modern APIs
const file = this.app.vault.getFileByPath(path);
await this.app.vault.process(file, (content) => newContent);
await this.app.vault.cachedRead(file);
const found = this.app.vault.getFileByPath(path);
```

## Workspace & Views

```typescript
// ❌ WRONG - Deprecated
const leaf = this.app.workspace.activeLeaf;
const view = leaf.view;

// ✅ CORRECT - Modern API
const view = this.app.workspace.getActiveViewOfType(MarkdownView);
if (view) {
  const editor = view.editor;
  // Use editor API
}
```

## Network Requests

```typescript
// ❌ WRONG - fetch() doesn't work on mobile
const response = await fetch(url);

// ✅ CORRECT - Works everywhere
import { requestUrl } from 'obsidian';
const response = await requestUrl({ url });
```

## DOM & Security

```typescript
// ❌ WRONG - XSS vulnerability
element.innerHTML = userContent;
element.outerHTML = template;

// ✅ CORRECT - Safe DOM API
const div = element.createEl('div');
div.setText(userContent);
div.addClass('my-class');
```

## Type Safety

```typescript
// ❌ WRONG - Unsafe cast
const file = abstractFile as TFile;
(component as any).internalMethod();

// ✅ CORRECT - Type narrowing
if (abstractFile instanceof TFile) {
  const file = abstractFile;
  // file is properly typed as TFile
}
```

## Command Registration

```typescript
// ❌ WRONG
this.addCommand({
  id: 'my-plugin-open-command',  // Redundant plugin ID
  name: 'Open Command',          // Title Case, "command" in name
  hotkeys: [{ modifiers: ['Mod'], key: 'o' }],  // Default hotkey
});

// ✅ CORRECT
this.addCommand({
  id: 'open',                    // Clean, no plugin prefix
  name: 'Open sidebar',          // Sentence case, descriptive
  // No default hotkey - let users configure
  callback: () => { /* action */ }
});
```

## Settings UI

```typescript
// ❌ WRONG
containerEl.createEl('h2', { text: 'My Plugin Settings' });
new Setting(containerEl).setName('Enable Feature');

// ✅ CORRECT
new Setting(containerEl)
  .setHeading()
  .setName('General');  // No "Settings" - context is clear

new Setting(containerEl)
  .setName('Enable feature')  // Sentence case
  .setDesc('Enables the main feature')
  .addToggle(toggle => toggle.setValue(this.settings.enabled));
```

## Plugin Lifecycle

```typescript
// ❌ WRONG - Memory leaks
class MyPlugin extends Plugin {
  view: CustomView;  // Stored reference = memory leak
  
  async onload() {
    this.view = new CustomView();  // Will never be cleaned up
  }
  
  onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE);  // Don't do this
  }
}

// ✅ CORRECT - Let Obsidian manage
class MyPlugin extends Plugin {
  async onload() {
    this.registerView(VIEW_TYPE, (leaf) => {
      return new CustomView(leaf);  // Create and return directly
    });
  }
  
  onunload() {
    // Obsidian handles cleanup automatically
  }
}
```

## Accessibility (MANDATORY)

```typescript
// All interactive elements need:
button.setAttribute('aria-label', 'Close sidebar');
button.setAttribute('tabindex', '0');

// Icon-only buttons MUST have aria-label
const iconBtn = containerEl.createEl('button', { cls: 'clickable-icon' });
setIcon(iconBtn, 'x');
iconBtn.setAttribute('aria-label', 'Close');

// Touch targets: minimum 44×44px
button.style.minWidth = '44px';
button.style.minHeight = '44px';

// Focus indicators
// In CSS:
.my-button:focus-visible {
  outline: 2px solid var(--interactive-accent);
  outline-offset: 2px;
}
```

## CSS Best Practices

```css
/* ❌ WRONG - Hard-coded colors, global scope */
.sidebar { background: #ffffff; color: #000000; }

/* ✅ CORRECT - CSS variables, scoped to plugin */
.nova-sidebar {
  background: var(--background-primary);
  color: var(--text-normal);
  border: 1px solid var(--background-modifier-border);
  padding: var(--size-4-2);  /* 8px on 4px grid */
}

/* Key Obsidian CSS variables */
--background-primary
--background-secondary
--text-normal
--text-muted
--text-faint
--interactive-accent
--background-modifier-border
--background-modifier-hover
```

## Pre-Submission Checklist

### Bot Validation (Auto-Fail)
- [ ] Plugin ID: no "obsidian", doesn't end with "plugin"
- [ ] Plugin name: no "Obsidian", doesn't end with "Plugin"
- [ ] Description: no "Obsidian" or "This plugin"
- [ ] Description ends with punctuation (. ? ! or ))
- [ ] manifest.json matches submission entry

### Code Quality
- [ ] No memory leaks (views properly managed)
- [ ] Type safety (instanceof, not casts)
- [ ] All UI text in sentence case
- [ ] Using preferred APIs
- [ ] No iOS-incompatible features
- [ ] All sample code removed
- [ ] No innerHTML/outerHTML

### Accessibility
- [ ] All interactive elements keyboard accessible
- [ ] ARIA labels on icon buttons
- [ ] Focus indicators with :focus-visible
- [ ] Touch targets 44×44px minimum

---

*For detailed coverage of specific topics, see reference files in this skill directory.*
