# Nova Plugin Development

## CRITICAL RULES — VIOLATION = IMMEDIATE STOP

### Git Control (USER OWNS ALL COMMITS)
- **NEVER auto-commit** — Wait for explicit "commit this" instruction
- **NEVER commit without showing the proposed message first** — User MUST approve
- **Before ANY commit**: Show `git status`, `git diff`, proposed message, then WAIT

### Code Control
- **NEVER write code until explicitly instructed** — Default mode is read-only analysis
- **NEVER start new tasks without confirmation** — Always confirm scope first
- **NEVER break existing interfaces** — Providers, UI, StateManager contracts are stable

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

- **Event-driven only**: Use `StateManager.emit()` — NEVER direct method calls between components
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

## KEY PATHS

| Area | Path |
|------|------|
| AI Providers | `src/ai/providers/` |
| Core Logic | `src/core/` (intent, document engine, conversation) |
| UI Components | `src/ui/` (sidebar, streaming, selection menu) |
| Utils | `src/utils/` (Logger, TimeoutManager) |
| Tests | `test/` |

---

## SESSION WORKFLOW

1. **Start**: Check `SCRATCHPAD.md` for IN PROGRESS tasks
2. **Before coding**: Research patterns with Grep/Read, verify approach
3. **After changes**: Run ALL quality gates
4. **End session**: Update `SCRATCHPAD.md` with status

---

## WHEN IN DOUBT

| Situation | Action |
|-----------|--------|
| Existing pattern? | Follow it exactly |
| Breaking interface? | STOP and ask |
| Compliance question? | Use `/project:compliance` command |
| Major change? | Use architect agent first |
| Multiple approaches? | Document in SCRATCHPAD.md, ask for decision |

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
| `code-reviewer` | Sonnet | PR reviews, code quality, compliance |
| `architect` | Opus | Planning major changes, design decisions |
| `compliance-checker` | Sonnet | Pre-submission audits |

## AVAILABLE COMMANDS

| Command | Description |
|---------|-------------|
| `/project:pr-review` | Full PR review with compliance |
| `/project:implement` | Plan-first implementation workflow |
| `/project:compliance` | Obsidian compliance audit |
| `/project:fix-issue` | Fix a specific issue |

---

*Detailed patterns: `.claude/skills/nova-architecture/SKILL.md`*
*Obsidian guidelines: `.claude/skills/obsidian/SKILL.md`*
*Current tasks: `SCRATCHPAD.md`*
