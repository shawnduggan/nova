# Nova Plugin Development

## CRITICAL RULES — VIOLATION = IMMEDIATE STOP

### Verification First (ZERO TOLERANCE FOR HALLUCINATION)
- **NEVER document features without verifying they exist in the codebase**
- **NEVER assume keyboard shortcuts, commands, or API methods exist**
- **ALWAYS use Grep/Read to verify before documenting**
- **If you cannot find it in the code, it does not exist**

### Code Control
- **NEVER write code until explicitly instructed** — Default mode is read-only analysis
- **NEVER start new tasks without confirmation** — Always confirm scope first
- **NEVER break existing interfaces** — Providers, UI, component contracts are stable
- **GOALS AUTHORIZE EXECUTION** — An explicit user-established goal authorizes both planning and implementation. Do not request separate plan approval while pursuing that goal. Preserve any downstream approval gates the user explicitly sets, including commit, publish, and release gates.

### Git Baseline (MANDATORY)
- At the start of every new task, inspect the current branch and working tree, then fetch `origin/main`.
- Treat `origin/main` as the authoritative production baseline unless the user explicitly names another base.
- Create the task branch from the freshly fetched `origin/main`; never rely on a potentially stale local `main`.
- If local changes or branch work would block synchronization, stop and ask whether the user wants it preserved before stashing, resetting, switching branches, or otherwise changing the working tree. Never assume preservation or disposal, and never reset, overwrite, stash, or discard user work without explicit authorization.

### Quality Gates (ALL MUST PASS)
```bash
npm run build          # 0 errors
npm test               # ALL tests pass (490+)
npx eslint src/        # 0 errors
```

---

## OBSIDIAN COMPLIANCE — PLUGIN STORE BLOCKING

These patterns will **REJECT your plugin submission**:

| ❌ NEVER | ✅ ALWAYS |
|----------|-----------|
| `addEventListener()` | `this.registerDomEvent()` |
| `setTimeout()` unregistered | `TimeoutManager.addTimeout()` |
| `setInterval()` unregistered | `this.registerInterval()` |
| `innerHTML`/`outerHTML` | DOM API (`createEl`, `setText`) |
| `fetch()` | `requestUrl()` |
| `vault.modify()` | Editor API (`editor.replaceRange()`) |
| `activeLeaf` | `getActiveViewOfType(MarkdownView)` |
| `console.log` in production | `Logger` utility |

---

## ARCHITECTURE — NON-NEGOTIABLE

- **Communication**: Direct injection for dependencies, Obsidian workspace events for cross-plugin communication. Direct method calls between tightly-coupled components are acceptable. Decoupling is a case-by-case decision, not a blanket rule.
- **Explicit initialization**: No side effects in constructors — use `init()` methods
- **Constants file**: All strings/selectors in `constants.ts`

---

## BUILD COMMANDS

```bash
npm run dev           # Watch mode
npm run build         # Lint + typecheck + build
npm run build:prod    # Production build
npm test              # Run all tests
npm run lint:fix      # Auto-fix ESLint issues
```

---

## COMMIT FORMAT

```
type(scope): description

- Detail 1
- Detail 2
```

**Types**: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`

❌ No AI attribution in commits

---

## AVAILABLE AGENTS

| Agent | Model | Use For |
|-------|-------|---------|
| `architect` | Opus | Planning major changes, design decisions |
| `code-reviewer` | Sonnet | PR reviews, code quality, compliance |
| `compliance-checker` | Sonnet | Pre-submission audits |

**How to use:** `Agent(subagent_type="architect", prompt="Plan refactoring of...")`
