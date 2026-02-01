# Nova Plugin Development

## HOW THIS WORKS

**CLAUDE.md** (this file) = Critical rules + quick reference
**Skills** (`.claude/skills/`) = Detailed patterns, code examples, testing strategies
**Agents** (`.claude/agents/`) = Specialized assistants that load skills automatically
**Commands** (`.claude/commands/`) = Structured workflows for common tasks

### When to Use What

| Task | Tool | Why |
|------|------|-----|
| Quick compliance check | This file | Fast lookup of rules |
| Understand state management pattern | `.claude/skills/nova-architecture/` | Deep dive into patterns |
| Plan major refactoring | `architect` agent | Loads all skills, analyzes tradeoffs |
| Review code before PR | `/project:pr-review` command | Structured review workflow |
| Fix compliance issue | `compliance-checker` agent | Expert at Obsidian rules |

---

## CRITICAL RULES — VIOLATION = IMMEDIATE STOP

### Verification First (ZERO TOLERANCE FOR HALLUCINATION)
- **NEVER document features without verifying they exist in the codebase**
- **NEVER assume keyboard shortcuts, commands, or API methods exist**
- **ALWAYS use Grep/Read to verify before documenting**
- **If you cannot find it in the code, it does not exist**
- **When documenting**: Read the actual implementation first, then describe what you found
- **When uncertain**: Say "I need to verify this in the codebase" and search before answering

**Example violations:**
- ❌ Documenting "Cmd+. cancels operations" without finding the registered command
- ❌ Claiming a feature works a certain way based on assumption
- ❌ Describing UI elements or workflows you haven't verified in code
- ✅ Grep for command registration → Read implementation → Document actual behavior

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

1. **Start**: Use `/tasks` to check IN PROGRESS tasks
2. **Planning phase** (for major changes):
   - Use `architect` agent to design approach
   - Agents have full access to skills and codebase patterns
3. **Before coding**: Research patterns with Grep/Read, verify approach
4. **During coding**: Reference skills for detailed patterns
5. **After changes**: Run ALL quality gates
6. **Before PR**: Use `/project:pr-review` for full review
7. **End session**: Update task status with TaskUpdate

---

## WHEN IN DOUBT

| Situation | Action | Tool |
|-----------|--------|------|
| Documenting a feature? | Verify in codebase FIRST | Grep/Read implementation |
| User asks "how does X work?" | Search code, then describe | Grep → Read → Explain |
| Uncertain if feature exists? | Search before answering | Grep for it, or say "not found" |
| Existing pattern? | Follow it exactly | Grep/Read + skills |
| Breaking interface? | STOP and ask | User decision required |
| Compliance question? | Check rules, then audit | This file → `/project:compliance` |
| Major change? | Plan before coding | `architect` agent |
| Ready for PR? | Full review | `/project:pr-review` command |
| Code quality concern? | Expert review | `code-reviewer` agent |
| Multiple approaches? | Analyze tradeoffs | `architect` agent or ask user |
| Implementation strategy? | Structured workflow | `/project:implement` command |

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

**All agents automatically load relevant skills (nova-architecture, obsidian)**

| Agent | Model | Use For | When |
|-------|-------|---------|------|
| `architect` | Opus | Planning major changes, design decisions | Before implementing new features or refactoring |
| `code-reviewer` | Sonnet | PR reviews, code quality, compliance | Before submitting PRs or when quality concerns arise |
| `compliance-checker` | Sonnet | Pre-submission audits | Before plugin store submission |

**How to use:** Invoke with Task tool, e.g., `Task(subagent_type="architect", prompt="Plan refactoring of...")`

## AVAILABLE COMMANDS

**Commands provide structured workflows for common tasks**

| Command | Use For | When |
|---------|---------|------|
| `/project:pr-review` | Full PR review with compliance check | After code complete, before creating PR |
| `/project:implement` | Plan-first implementation workflow | Starting new features (combines planning + coding) |
| `/project:compliance` | Obsidian compliance audit | When compliance concerns arise |
| `/project:fix-issue` | Fix a specific issue | Structured bug fixing workflow |

**How to use:** Invoke with Skill tool, e.g., `Skill(skill="project:pr-review")`

---

## SKILLS REFERENCE

**Agents load these automatically — you can also read them directly for details**

| Skill | Contains | When to Read Directly |
|-------|----------|----------------------|
| `.claude/skills/nova-architecture/` | State management, component patterns, file conventions, testing | Understanding existing patterns before coding |
| `.claude/skills/obsidian/` | Plugin compliance rules, API usage, best practices | Checking specific Obsidian API usage |

**Agents have these skills loaded by default, so they provide expert guidance without you needing to read the full docs.**
