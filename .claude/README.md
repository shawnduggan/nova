# .claude/ — Project Intelligence

This directory contains project-specific knowledge, workflows, and quality standards for any AI agent working on Nova. Read this before writing any code.

## Start Here

1. Read `../CLAUDE.md` — Critical rules, compliance requirements, and quality gates. **Non-negotiable.**
2. Read the relevant **skills** below for patterns and conventions.
3. Follow the **quality gates** — every change must pass build, tests, and lint before commit.

## Directory Structure

```
.claude/
├── skills/           # Domain knowledge (read before coding)
│   ├── nova-patterns/    # Architecture patterns, state management, component conventions
│   ├── nova-codebase/    # Auto-generated file map and module descriptions
│   └── obsidian/         # Obsidian plugin API rules and compliance requirements
├── agents/           # Specialized agent definitions (Claude Code specific)
│   ├── architect.md      # Planning and design decisions (uses Opus)
│   ├── code-reviewer.md  # Code quality and pattern compliance (read-only)
│   └── compliance-checker.md  # Obsidian store requirements audit
├── commands/         # Structured workflows (Claude Code specific)
│   ├── implement.md      # Plan-first feature implementation
│   ├── pr-review.md      # Pre-merge review checklist
│   ├── compliance.md     # Compliance audit
│   ├── release.md        # Release workflow
│   └── sync-codebase.md  # Codebase documentation sync
└── settings.local.json   # Local Claude Code settings (ignore)
```

## What Matters for Any Agent

### Skills (Read These)

Skills are the project's accumulated knowledge. They describe **how Nova code should be written** — patterns, conventions, and constraints learned through development.

| Skill | What It Contains | When to Read |
|-------|-----------------|--------------|
| `skills/nova-patterns/SKILL.md` | State management, component patterns, testing strategies, file conventions | Before writing or modifying any code |
| `skills/nova-codebase/SKILL.md` | Generated file descriptions, module structure, dependency map | When navigating unfamiliar parts of the codebase |
| `skills/obsidian/SKILL.md` | Plugin store compliance rules, required API patterns, forbidden patterns | Before using any Obsidian API or DOM manipulation |

**If you only read one thing, read `nova-patterns`** — it's the codebase DNA.

### Agents & Commands (Claude Code Only)

The `agents/` and `commands/` directories define Claude Code-specific workflows. If you're not running in Claude Code, you can **ignore these directories** — the useful content is in the skills and in `CLAUDE.md`.

That said, the agent definitions describe *what good reviews and planning look like* for this project, so they're worth reading as reference even if you can't execute them directly.

## Quality Gates

Every change must pass before commit. No exceptions.

```bash
npm run build          # 0 errors
npm test               # ALL tests pass
npx eslint src/        # 0 errors
```

## Key Rules (from CLAUDE.md)

- **Never auto-commit** — all commits require explicit human approval
- **Never break existing interfaces** — Provider, UI, and StateManager contracts are stable
- **Never use forbidden Obsidian patterns** — see compliance table in CLAUDE.md
- **Verify before documenting** — grep the codebase, don't assume features exist
- **Follow existing patterns** — if the codebase does it a certain way, match it

## Branching Convention

- No `v` prefix on branches or tags (breaks Obsidian store)
- Feature branches named for the version: `1.1.2`, `1.2`
- `main` matches the live plugin store release
- All work happens on feature branches, merged via PR
