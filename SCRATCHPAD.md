# Nova Development Scratchpad

> This file tracks current work, session notes, and known issues.
> Updated by both human and Claude during development sessions.

---

## Current Session

**Started**: 2025-11-28
**Focus**: Obsidian Settings API Compliance - Fix heading creation in settings

---

## IN PROGRESS

### Obsidian Settings API Compliance - Heading Fix
**Started**: 2025-11-28
**Priority**: CRITICAL (Blocking plugin store submission)
**Status**: PENDING APPROVAL

#### Issue
PR review flagged improper heading creation in settings using DOM methods instead of Settings API:
```typescript
// ❌ WRONG - Flagged by reviewer
infoDiv.createEl('h3', { text: 'Supernova Support' });

// ✅ CORRECT - Required by Obsidian
new Setting(containerEl).setName('Supernova Support').setHeading();
```

#### Analysis Complete
- **Files scanned**: 3 (settings.ts, sidebar-view.ts, custom-instruction-modal.ts)
- **Total headings found**: 16 instances
- **Actual violations**: 1 (only settings.ts line 1796)
- **False positives**: 15 (info card headers, modal titles - NOT settings context)

#### Key Finding
Only **ONE** instance needs to be fixed:
- **Location**: `src/settings.ts:1796` in `createSupernovaCTA()` method
- **Current**: `infoDiv.createEl('h3', { text: 'Supernova Support' });`
- **Required**: `new Setting(ctaDiv).setName('Supernova Support').setHeading();`

#### Implementation Plan

1. **Modify settings.ts** (single-line fix)
   - Replace h3 heading with proper Setting().setHeading() pattern
   - Adjust DOM structure to accommodate Settings API heading
   - **Risk**: LOW - Visual regression possible, may need CSS tweaks

2. **Test visual appearance**
   - Verify Supernova CTA section renders correctly
   - Check both tabs where createSupernovaCTA() is called
   - Ensure heading styling matches design

3. **Quality gates**
   - Run `npm run build` (must pass with 0 errors)
   - Run `npm test` (all 490+ tests must pass)
   - Run `npx eslint src/` (0 errors)

4. **Compliance verification**
   - Run compliance-checker agent
   - Verify no other heading violations exist

#### Files to Modify
- `src/settings.ts` (line 1796)

#### Files to Review (potential CSS adjustments)
- `styles.css` (if .nova-prominent-supernova-section styling needs updates)

#### Important Notes
- **13 h4/h5 headings in info cards** are COMPLIANT - do NOT change them
- **sidebar-view.ts h4** is NOT in settings context - do NOT change
- **custom-instruction-modal.ts h2** is NOT in settings context - do NOT change

#### Estimated Time
15-30 minutes including testing

---

**WAITING FOR APPROVAL TO PROCEED TO IMPLEMENTATION**

---

## PENDING (Ready to Start)

### Commands System Phase 1 - Core Infrastructure
**Priority**: HIGH
**Estimated**: Days 1-5

#### Core Infrastructure
- [ ] Create CommandEngine with markdown file loading system
  - Location: `src/features/commands/core/CommandEngine.ts`
  - Loads commands from Commands/ folder in vault
  - Executes with streaming support via StreamingManager
- [ ] Implement SmartVariableResolver for template variables
  - Variables: `{text}`, `{selection}`, `{document}`, `{title}`, `{document_type}`, `{metrics}`, `{audience_level}`
  - Smart context resolution based on cursor/selection
- [ ] Build CommandRegistry for lazy loading commands
  - Lazy load commands on first use (<50MB memory)
  - Cache loaded commands for session
- [ ] Integrate with existing `/` trigger detection in CommandSystem
  - Extend `src/ui/command-system.ts` for markdown commands
  - Update CommandParser for new command types

#### Progressive Disclosure UI
- [ ] Create MarginIndicators component
  - 14px icons at 40% opacity in right margin
  - Icon types: 💡 enhancement, ⚡ quick fix, 📊 metrics, ✨ transformation
- [ ] Implement hover preview system
  - 200ms fade-in on hover
  - Single-line description with primary command
- [ ] Build InsightPanels for full intelligence
  - Positioned near text without covering
  - Multiple approach options
  - Clear action buttons
- [ ] Add SmartTimingEngine
  - 3 second delay after typing stops
  - Hide when typing >30 WPM
  - Respect document type settings

#### Settings Integration
- [ ] Add Commands tab to NovaSettingTab
  - Location: `src/settings.ts` (extend existing)
  - CommandSettings interface with all options
- [ ] Implement sidebar quick controls
  - Add to NovaSidebarView for easy access
  - Dropdown: Off/Minimal/Balanced/Aggressive
- [ ] Support per-document frontmatter overrides
  - Read `nova-insights` from frontmatter
  - Override global settings per document

#### 7 Flagship Commands (MUST BE EXCEPTIONAL)
- [ ] `/expand-outline` - Transform bullets to flowing prose
- [ ] `/perspective-shift` - Rewrite from different viewpoints
- [ ] `/strengthen-hook` - 5 psychological hook styles
- [ ] `/add-examples` - 3 types per concept
- [ ] `/show-through-scene` - Convert telling to showing
- [ ] `/thesis-strengthen` - 3 academic argument versions
- [ ] `/troubleshooting-guide` - Symptom→cause→solution format

---

## COMPLETED

### ✅ Obsidian Plugin Compliance Fixes
**Completed**: [recent]
**Summary**: Fixed all setTimeout calls and event cleanup issues blocking plugin store submission

- Fixed 20 unregistered setTimeout calls across 6 core UI files
- Fixed innerHTML usage in sidebar-view.ts
- Removed manual event cleanup (registerDomEvent handles automatically)
- All setTimeout calls now use `TimeoutManager.addTimeout()`
- Build passes: 0 errors
- All 491 tests passing
- **Status**: FULLY COMPLIANT - Plugin store ready

---

## KNOWN ISSUES

### Low Priority

**Privacy indicator on mobile**
- Doesn't provide value on mobile - all models are cloud
- Consider removing or hiding on mobile

**Consolidate input trigger detection**
- Currently wikilinks (`[[`) and commands (`:`) use separate input listeners
- Should consolidate into unified trigger detection system

### Medium Priority

**Mobile Model Dropdown padding**
- Selected model names are left-aligned and need padding
- Does not happen on desktop

**User-configurable log levels**
- Add setting to adjust logging verbosity (Debug, Info, Warn, Error)
- Currently hardcoded to INFO level

---

## SOMEDAY/MAYBE

- Add slider setting for scroll speed (General settings tab)
- Consider plugin analytics opt-in for usage patterns

---

## SESSION NOTES

### Architecture Decisions
*Record significant decisions here for future reference*

### Discoveries
*Things learned during development*

### Patterns to Document
*Patterns that should be added to skills or CLAUDE.md*
