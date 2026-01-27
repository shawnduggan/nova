# Nova Development Scratchpad

> This file tracks current work, session notes, and known issues.
> Updated by both human and Claude during development sessions.

---

## Current Session

**Started**: 2026-01-27
**Focus**: Codebase Sync System

---

## IN PROGRESS

### Codebase Sync System
**Started**: 2026-01-27
**Priority**: MEDIUM (Developer tooling)
**Status**: ✅ COMPLETE

---

## Architecture Plan: Codebase Sync System

**Date**: 2026-01-27
**Status**: IMPLEMENTED

### Context

Claude Code needs to maintain accurate understanding of Nova's architecture as it evolves. Currently, the single `nova-architecture` skill mixes static patterns (coding standards, compliance rules) with dynamic information (file structure, exports). This makes it difficult to keep architectural knowledge current without manually editing skill files after every major feature.

**Solution**: Split the skill into static patterns (manually maintained) and generated codebase map (auto-updated), then create a sync command to regenerate the dynamic portion after significant changes.

### Current State

**Existing Files:**
- `.claude/skills/nova-architecture/SKILL.md` - 362 lines mixing static patterns and file structure
- `.claude/agents/architect.md` - loads skills: `obsidian, nova-architecture`
- `.claude/agents/code-reviewer.md` - loads skills: `obsidian, nova-architecture`

**Source Files (46 total):**
```
src/
├── ai/                    # 7 files
│   ├── context-limits.ts
│   ├── models.ts
│   ├── provider-manager.ts
│   ├── types.ts
│   └── providers/         # claude.ts, google.ts, ollama.ts, openai.ts
├── core/                  # 14 files
│   ├── ai-intent-classifier.ts, command-parser.ts, context-builder.ts
│   ├── context-calculator.ts, conversation-manager.ts, crypto-service.ts
│   ├── document-analysis.ts, document-engine.ts, intent-detector.ts
│   ├── prompt-builder.ts, types.ts
│   └── commands/          # 7 command files
├── licensing/             # 4 files
├── ui/                    # 13 files
├── utils/                 # 2 files
├── constants.ts
└── settings.ts
```

**Current Header Status:**
- Files WITH headers (inconsistent format, no @file): ~6 files
- Files WITHOUT headers: ~40 files

### Proposed Changes

#### Files to Modify

| File | Change | Risk |
|------|--------|------|
| `.claude/skills/nova-architecture/SKILL.md` | Replace with nova-patterns content | Low |
| `.claude/agents/architect.md` | Update skills line | Low |
| `.claude/agents/code-reviewer.md` | Update skills line | Low |
| 46 src/*.ts files | Add @file header comments | Low |

#### New Files

| File | Purpose |
|------|---------|
| `.claude/skills/nova-patterns/SKILL.md` | Static coding standards, compliance, patterns |
| `.claude/skills/nova-codebase/SKILL.md` | Generated file structure, exports, dependencies |
| `.claude/commands/sync-codebase.md` | Command to regenerate nova-codebase skill |

### Implementation Steps

#### Phase 1: Add @file Headers to All 46 src/*.ts Files

Standard format:
```typescript
/**
 * @file ModuleName - One-line description of purpose
 */
```

Proposed descriptions by folder:

**src/ai/**
| File | @file Description |
|------|-------------------|
| `context-limits.ts` | ContextLimits - Token and context window limits per AI model |
| `models.ts` | Models - Centralized model definitions for all AI providers |
| `provider-manager.ts` | AIProviderManager - Manages AI provider instances and model selection |
| `types.ts` | AITypes - Type definitions for AI providers, messages, and streaming |
| `providers/claude.ts` | ClaudeProvider - Anthropic Claude API integration |
| `providers/google.ts` | GoogleProvider - Google Gemini API integration |
| `providers/ollama.ts` | OllamaProvider - Local Ollama API integration |
| `providers/openai.ts` | OpenAIProvider - OpenAI GPT API integration |

**src/core/**
| File | @file Description |
|------|-------------------|
| `ai-intent-classifier.ts` | AIIntentClassifier - AI-powered intent classification for ambiguous inputs |
| `command-parser.ts` | CommandParser - Parses user input into structured edit commands |
| `context-builder.ts` | ContextBuilder - Builds document context for AI prompts |
| `context-calculator.ts` | ContextCalculator - Calculates token usage and context limits |
| `conversation-manager.ts` | ConversationManager - Manages file-scoped conversation storage |
| `crypto-service.ts` | CryptoService - Encrypts/decrypts sensitive data like API keys |
| `document-analysis.ts` | DocumentAnalyzer - Analyzes document structure and metadata |
| `document-engine.ts` | DocumentEngine - Central hub for all document manipulation |
| `intent-detector.ts` | IntentDetector - Classifies user input as editing vs consultation |
| `prompt-builder.ts` | PromptBuilder - Builds system and user prompts for AI |
| `types.ts` | CoreTypes - Type definitions for document editing and commands |
| `commands/add-command.ts` | AddCommand - Handles content insertion at cursor |
| `commands/delete-command.ts` | DeleteCommand - Handles content removal |
| `commands/edit-command.ts` | EditCommand - Handles in-place content modification |
| `commands/grammar-command.ts` | GrammarCommand - Handles grammar and spelling corrections |
| `commands/metadata-command.ts` | MetadataCommand - Handles frontmatter and tag modifications |
| `commands/rewrite-command.ts` | RewriteCommand - Handles content rewriting with tone/style |
| `commands/selection-edit-command.ts` | SelectionEditCommand - Handles editing selected text |

**src/licensing/**
| File | @file Description |
|------|-------------------|
| `feature-config.ts` | FeatureConfig - Time-gated feature configuration |
| `feature-manager.ts` | FeatureManager - Manages feature flags and Supernova access |
| `license-validator.ts` | LicenseValidator - Validates Supernova license keys |
| `types.ts` | LicensingTypes - Type definitions for licensing system |

**src/ui/**
| File | @file Description |
|------|-------------------|
| `chat-renderer.ts` | ChatRenderer - Renders conversation messages in sidebar |
| `command-system.ts` | CommandSystem - Handles slash command detection and picker UI |
| `context-manager.ts` | ContextManager - Manages multi-document context in sidebar |
| `custom-command-modal.ts` | CustomCommandModal - Modal for creating/editing custom commands |
| `custom-instruction-modal.ts` | CustomInstructionModal - Modal for custom editing instructions |
| `input-handler.ts` | InputHandler - Handles text input and keyboard events |
| `provider-manager.ts` | UIProviderManager - UI components for provider/model selection |
| `selection-context-menu.ts` | SelectionContextMenu - Context menu for text selection actions |
| `sidebar-view.ts` | NovaSidebarView - Main sidebar view with chat interface |
| `streaming-manager.ts` | StreamingManager - Manages AI response streaming to editor |
| `tone-selection-modal.ts` | ToneSelectionModal - Modal for selecting rewrite tone |
| `wikilink-suggest.ts` | WikilinkSuggest - Autocomplete for [[wikilinks]] in input |

**src/utils/**
| File | @file Description |
|------|-------------------|
| `logger.ts` | Logger - Centralized logging utility with levels |
| `timeout-manager.ts` | TimeoutManager - Obsidian-compliant timeout management |

**src/ (root)**
| File | @file Description |
|------|-------------------|
| `constants.ts` | Constants - Shared constants and magic strings |
| `settings.ts` | Settings - Plugin settings UI and configuration |

#### Phase 2: Split nova-architecture Skill

**2.1 Create `.claude/skills/nova-patterns/SKILL.md`** (static, manually maintained)

Content from current skill:
- YAML frontmatter with name and description
- Core Philosophy section
- State Management patterns and key events table
- Component Patterns (UI, Core Services, AI Providers)
- Timer Management (TimeoutManager patterns)
- Logging (Logger utility usage)
- Error Handling Pattern
- File Conventions table
- Testing Patterns (with mock patterns)
- Constants usage
- **NEW**: File header requirement rule

**2.2 Create `.claude/skills/nova-codebase/SKILL.md`** (generated, auto-updated)

Format:
```markdown
---
name: nova-codebase
description: Auto-generated Nova codebase map. Regenerate with /project:sync-codebase
generated: 2026-01-27T10:30:00Z
---

# Nova Codebase Map

> This file is auto-generated. Do not edit manually.
> Regenerate with: `/project:sync-codebase`

## File Structure

### src/ai/
| File | Description | Key Exports |
|------|-------------|-------------|
| context-limits.ts | Token limits per model | `getModelContextLimit()`, `getModelMaxOutputTokens()` |
...

## Component Dependencies

### AI Layer (src/ai/)
- `provider-manager.ts` imports from:
  - `./types`, `./providers/*`, `../settings`, `../licensing/feature-manager`
...

## Recent Changes

| Commit | Date | Summary |
|--------|------|---------|
| fcf9efe | 2026-01-26 | 1.0.23 |
...
```

**2.3 Delete/rename old skill**
- Delete `.claude/skills/nova-architecture/SKILL.md` after creating both new ones

#### Phase 3: Create Sync Command

**Create `.claude/commands/sync-codebase.md`**

Command instructions for Claude to:
1. Walk src/ recursively, extract @file descriptions
2. Extract exports (classes, interfaces, functions, types)
3. Build import dependency map
4. Get last 10 commits: `git log --oneline -10 --no-merges`
5. Generate `.claude/skills/nova-codebase/SKILL.md`
6. Warn on missing @file descriptions
7. Stage and commit: `chore: sync nova-codebase skill`

#### Phase 4: Update Agents

**Update `.claude/agents/architect.md`**
```yaml
skills: obsidian, nova-patterns, nova-codebase
```

**Update `.claude/agents/code-reviewer.md`**
```yaml
skills: obsidian, nova-patterns, nova-codebase
```

### Key Decisions

1. **Format**: Tabular, organized by folder, with descriptions from @file headers
2. **Dependency organization**: By folder, then alphabetically within folder
3. **Auto-commit**: Yes, with standardized message `chore: sync nova-codebase skill`
4. **Header format**: Add @file as first line of existing comments to preserve detail

### Risk Assessment

- **Breaking changes**: No - New files only, no interface changes
- **Test impact**: None - No production code changes
- **Compliance**: None - Changes are in .claude/ which is gitignored by users
- **Mobile**: N/A - Developer tooling only

### Success Criteria

- [ ] All 46 src/*.ts files have @file header descriptions
- [ ] nova-patterns skill contains coding standards including @file requirement
- [ ] nova-codebase skill is generated with accurate structure
- [ ] Running `/project:sync-codebase` regenerates skill correctly
- [ ] Agents load both skills appropriately

---

⚠️ **AWAITING APPROVAL - Do not proceed without explicit approval**

---

### PR Code Scan Compliance Fixes (COMPLETED)
**Started**: 2025-11-30
**Priority**: CRITICAL (Blocking plugin store submission)
**Status**: ✅ COMPLETE (8 commits, all blocking issues resolved)

#### Context
Automated PR code scan identified 87+ violations that must be fixed before plugin store submission. These span async/Promise handling, type safety, code quality, UI text casing, and Obsidian compliance patterns.

#### Issue Categories Summary

1. **Async/Promise Issues** (49+ instances):
   - Awaiting non-Promise values (5 instances)
   - Unhandled floating promises (39 instances)
   - Async functions with no await expressions (5+ instances)

2. **Type Safety** (30+ instances):
   - Explicit `any` types throughout codebase
   - Template literal expression type issues (4 instances)

3. **Code Quality** (9+ instances):
   - Deprecated `.substr()` usage (4 instances)
   - UI text not in sentence case (3 instances in provider settings)
   - Direct style manipulation via element.style (4 instances)

4. **Legacy Patterns**:
   - Settings headings using DOM methods vs Settings API
   - Console logging eslint disables

---

## Implementation Plan

### Phase 1: Low-Risk Quick Wins (1-2 hours)
**Files**: 4 files, simple replacements

#### 1.1 Fix Deprecated `.substr()` → `.substring()`

**Pattern Change**:
```typescript
// BEFORE
'cmd_' + Math.random().toString(36).substr(2, 9)

// AFTER
'cmd_' + Math.random().toString(36).substring(2, 11)
```

**Note**: `.substr(start, length)` vs `.substring(start, end)` - end is exclusive, so `substr(2, 9)` becomes `substring(2, 11)`.

**Files to Modify**:
- `src/settings.ts:1521`
- `src/ui/context-manager.ts:132`
- `src/ui/sidebar-view.ts:1526`
- `src/core/conversation-manager.ts:391`

**Risk**: LOW

#### 1.2 Fix UI Text Sentence Case

**Files to Modify**:
- `src/settings.ts:1238` - Change `'Google (Gemini)'` to `'Gemini (Google)'`
- `src/settings.ts:1355-1356` - Verify provider labels follow pattern

**Analysis**:
- "ChatGPT (OpenAI)" - Brand name, KEEP AS-IS
- "Google (Gemini)" - Should follow pattern "Gemini (Google)" for consistency
- Model labels in `ai/models.ts` are model names, not UI text - KEEP AS-IS

**Risk**: LOW

#### Quality Gate
- Run `npm run build` - must pass with 0 errors
- Run `npm test` - all 490+ tests must pass
- Run `npx eslint src/` - 0 errors

---

### Phase 2: Type Safety - High Priority (3-4 hours)
**Files**: 10+ files, interface creation + replacements

#### 2.1 Create New Type Interfaces

**New file**: Consider organizing in existing type files or create new ones

```typescript
// src/ui/types.ts (or appropriate location)
interface CommandPickerItem {
  id: string;
  name: string;
  description?: string;
  action: () => void | Promise<void>;
}

interface EditorSelection {
  from: EditorPosition;
  to: EditorPosition;
}

interface EditorPosition {
  line: number;
  ch: number;
}

// src/ai/types.ts (or appropriate location)
interface GoogleRequest {
  contents: Array<{role: string; parts: Array<{text: string}>}>;
  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
    topP?: number;
    topK?: number;
  };
  safetySettings?: unknown[];
}

interface OpenAIRequest {
  model: string;
  messages: Array<{role: string; content: string}>;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

type PromptConfig = string | {
  system?: string;
  user: string;
  context?: string;
};
```

#### 2.2 Fix High Priority `any` Types

**Files and Changes**:

| File | Line | Current | Proposed Type | Risk |
|------|------|---------|---------------|------|
| `main.ts` | 118, 420 | `data: any` | `data: unknown` | Low |
| `main.ts` | 270 | `deepMerge(target: any, source: any)` | `<T>(target: T, source: Partial<T>): T` | Med |
| `src/ui/sidebar-view.ts` | 49 | `_commandPickerItems: any[]` | `CommandPickerItem[]` | Med |
| `src/ui/sidebar-view.ts` | 220 | `editor: any` | `editor: Editor` | Low |
| `src/ui/streaming-manager.ts` | 25-27 | `any` for positions | `EditorPosition` | Low |
| `src/ai/providers/google.ts` | 37, 66 | Return `any` | `GoogleRequest` | Low |
| `src/ai/providers/openai.ts` | 56, 99, 100, 105 | `any` in request | `OpenAIRequest` | Low |
| `src/core/commands/*.ts` | Multiple | `prompt: any` | `prompt: string \| PromptConfig` | Med |
| `src/core/conversation-manager.ts` | 60, 73, 74, 100, 109 | Data sanitization | `unknown` with guards | Med |

#### Quality Gate
- Run `npm run build` after each file modification
- Run `npm test` after each section
- Verify no new TypeScript errors

---

### Phase 3: Async/Promise Handling (4-6 hours)
**Most complex phase - requires careful analysis**

#### 3.1 Identify All Floating Promises

**Strategy**: Comprehensive grep to find all 39 instances
```bash
# Find potential floating promises
grep -r "this\." src/ | grep -v "await" | grep -v "void"
```

#### 3.2 Common Patterns to Fix

**Pattern 1: Event handlers calling async methods**
```typescript
// BEFORE
registerDomEvent(element, 'click', () => {
  this.performAsyncAction();  // ❌ Floating promise
});

// FIX OPTION A: Explicitly ignore
registerDomEvent(element, 'click', () => {
  void this.performAsyncAction();  // ✅ Explicitly ignored
});

// FIX OPTION B: Add error handling
registerDomEvent(element, 'click', () => {
  this.performAsyncAction().catch(error => Logger.error('Action failed', error));
});
```

**Pattern 2: Fire-and-forget in methods**
```typescript
// BEFORE
someMethod() {
  this.saveSettings();  // ❌ Floating promise
  this.doOtherThing();
}

// FIX OPTION A: Wait for it
async someMethod() {
  await this.saveSettings();  // ✅ Wait for it
  this.doOtherThing();
}

// FIX OPTION B: Explicitly ignore
someMethod() {
  void this.saveSettings();  // ✅ Explicitly ignore
  this.doOtherThing();
}
```

**Pattern 3: Async functions without await**
```typescript
// BEFORE - async without await
async updateSomething(): Promise<void> {
  this.initializeFeatureFlags(); // ← Might be async!
}

// FIX OPTION A: Await it
async updateSomething(): Promise<void> {
  await this.initializeFeatureFlags(); // ← If it's async
}

// FIX OPTION B: Remove async
updateSomething(): void {
  this.initializeFeatureFlags(); // ← If it's sync
}
```

#### 3.3 Priority Files to Analyze

**High Priority**:
- `src/settings.ts` - Event handlers and button clicks
- `src/ui/sidebar-view.ts` - UI event handlers
- `src/ai/provider-manager.ts` - Provider initialization
- `src/core/document-engine.ts` - Document operations

**Medium Priority**:
- `src/ui/context-manager.ts`
- `src/ui/input-handler.ts`
- `src/licensing/feature-manager.ts`
- `src/licensing/license-validator.ts`

#### 3.4 Fix Awaiting Non-Promises

**Location**: `src/ai/provider-manager.ts:185`
```typescript
// Verify checkProviderAvailability return type
// If Promise<boolean>: Keep await
// If boolean: Remove await
```

#### Quality Gate
- Run `npm run build` after each file
- Run `npm test` after each section
- Verify async behavior still works correctly

---

### Phase 4: Type Safety - Medium Priority (2-3 hours)

**Files to Modify**:

| File | Line | Current | Proposed Type | Risk |
|------|------|---------|---------------|------|
| `src/ui/input-handler.ts` | 25, 40 | `sidebarView: any` | `NovaSidebarView` | Low |
| `src/ui/wikilink-suggest.ts` | 12, 23 | `sidebarView: any` | `NovaSidebarView` | Low |
| `src/ui/context-manager.ts` | 50, 59 | `sidebarView: any` | `NovaSidebarView` | Low |
| `src/ui/selection-context-menu.ts` | 311 | `{ from: any; to: any }` | `EditorSelection` | Low |
| `src/ai/models.ts` | 11, 17, 36 | `settings?: any` | `settings?: NovaSettings` | Low |

#### Quality Gate
- Run `npm run build` after modifications
- Run `npm test` after section complete

---

### Phase 5: Type Safety - Lower Priority (2-3 hours)

**Files to Modify**:

| File | Line | Current | Proposed Type | Risk |
|------|------|---------|---------------|------|
| `src/settings.ts` | 594 | `error: any` | `error: unknown` | Low |
| `src/core/commands/metadata-command.ts` | 256, 270, 304, 822 | `value: any`, `tag: any` | Use generics | Low |
| `test/integration/*.test.ts` | Various | `mockPlugin: any` | Proper mock type | None |

#### Quality Gate
- Run `npm run build` after modifications
- Run `npm test` - all tests must pass

---

### Phase 6: Final Validation (1 hour)

1. Run full test suite: `npm test` (all 490+ tests must pass)
2. Run linter: `npx eslint src/` (0 errors)
3. Run build: `npm run build` (0 errors)
4. Manual testing:
   - Test all AI providers (Claude, OpenAI, Google, Ollama)
   - Test conversation flow
   - Test settings UI
   - Test command execution
   - Test streaming responses
5. Review PR scan results

---

## Open Questions (Need Clarification)

1. **Template literal type issues (4 instances)**: PR mentions "Invalid type 'never' of template literal expression" but exact locations not found. Need file:line numbers from actual scan.

2. **Console logging ESLint disable**: PR mentions "Disabling 'no-console' is not allowed" but no eslint-disable directives found. Need exact location.

3. **Style manipulation (4 instances)**: PR says "Avoid setting styles directly via element.style.display/gap/justifyContent/marginTop" but specific instances not located. Need exact file:line numbers.

4. **checkProviderAvailability return type**: Need to verify if it returns `Promise<boolean>` or `boolean` to fix the await warning properly.

5. **Exact floating promise locations**: Need comprehensive scan to find all 39 instances beyond what's documented.

---

## Risk Assessment

**Breaking changes**: No
- All changes are type-safety improvements and bug fixes
- No interface changes
- No behavioral changes

**Test impact**: Medium
- Some tests may need type updates
- Mock types in test files need updating
- All tests should continue passing with proper types

**Compliance**: High Impact (CRITICAL)
- Fixes 87+ blocking issues for plugin store submission
- Addresses TypeScript strict mode violations
- Removes deprecated APIs
- Follows Obsidian best practices

---

## Success Criteria

- [ ] All 87+ issues resolved per PR scan
- [ ] `npm run build` passes with 0 errors
- [ ] `npm test` passes with all 490+ tests passing
- [ ] `npx eslint src/` passes with 0 errors
- [ ] No new TypeScript errors introduced
- [ ] All AI providers function correctly
- [ ] Conversation flow works end-to-end
- [ ] Settings UI renders and functions properly
- [ ] Manual testing passes on desktop and mobile
- [ ] PR code scan shows 0 blocking issues

---

## Estimated Effort

**Total**: 13-19 hours across 6 phases

**By Phase**:
- Phase 1 (Quick wins): 1-2 hours
- Phase 2 (High priority types): 3-4 hours
- Phase 3 (Async/Promise): 4-6 hours
- Phase 4 (Medium priority types): 2-3 hours
- Phase 5 (Lower priority types): 2-3 hours
- Phase 6 (Validation): 1 hour

---

## ACTUAL COMPLETION SUMMARY (2025-11-30)

**Total Commits**: 8
**Total Blocking Issues Fixed**: 43+
**Build Status**: ✅ 0 errors, 83 warnings (non-blocking `any` types)
**Test Status**: ✅ 494/494 passing
**Compliance Status**: ✅ READY FOR PLUGIN STORE SUBMISSION

### Commits:
1. `755b1b3` - fix(compliance): resolve quick-win PR scan violations
2. `56933a7` - fix(async): remove unnecessary async from synchronous methods
3. `fbd8ac6` - fix(compliance): remove async from synchronous methods
4. `852381a` - fix(compliance): add error handlers to floating promises
5. `d222bf2` - fix(compliance): enable floating promise detection and fix 6 violations
6. `1de75a2` - fix(compliance): fix remaining 18 floating promises in sidebar-view
7. `edd53f1` - fix(test): fix streaming completion test with void operator
8. `ff3bb3d` - fix(compliance): fix sentence case violations in UI text

### Issues Fixed:
- ✅ 24 floating promises with proper error handling
- ✅ All async method issues (unnecessary async removed)
- ✅ 4 deprecated `.substr()` → `.substring()`
- ✅ 9 sentence case UI text violations
- ✅ All event listeners using `registerDomEvent()`
- ✅ All timers using `TimeoutManager` or `registerInterval()`
- ✅ No DOM security issues (no `innerHTML`/`outerHTML`)
- ✅ No deprecated Obsidian APIs

### Issues Mentioned But Not Found:
- Template literal type issues (4) - NOT FOUND in codebase
- Console logging ESLint disable - NOT FOUND
- Style manipulation (element.style.*) - NOT FOUND
- prompt() calls - NOT FOUND

These may have been false positives in original scan or already fixed in earlier work.

### Remaining Non-Blocking Items:
- 83 `any` type warnings (not required for plugin store, but could improve)

---

## PENDING (Ready to Start)

### Commands System Phase 1 - Core Infrastructure
**Priority**: HIGH (after PR fixes complete)
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

### ✅ Obsidian Settings API Compliance - Heading Fix
**Completed**: 2025-11-28
**Summary**: Fixed improper heading creation in settings using DOM methods

- Changed `infoDiv.createEl('h3')` to `new Setting().setHeading()` pattern
- Only 1 actual violation found (settings.ts:1796)
- 15 false positives identified and documented
- Build passes: 0 errors
- All 491 tests passing

### ✅ Obsidian Plugin Compliance Fixes
**Completed**: 2025-11-27
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
