# agents.md – Nova Codex Roles & Repository Guidelines

This file defines both **repository rules** and **agent roles**.  
All Codex agents MUST follow both sections.

---

## Codex Bridge

Use the existing Claude Code project intelligence as the canonical source of repo-specific guidance. Do not duplicate it here.

- Read `CLAUDE.md` at the start of any non-trivial task; treat it as mandatory project policy.
- Use `.claude/README.md` as the index for repo-local skills, commands, and agent guidance.
- Skills:
  - Read `.claude/skills/nova-patterns/SKILL.md` before writing or modifying code.
  - Read `.claude/skills/nova-codebase/SKILL.md` when planning scope, mapping files, or navigating unfamiliar areas.
  - Read `.claude/skills/obsidian/SKILL.md` before touching Obsidian APIs, UI, DOM, timers, events, or submission-sensitive code.
- Commands:
  - Consult `.claude/commands/implement.md` for plan-first feature, fix, and issue work.
  - Consult `.claude/commands/pr-review.md` before PR creation or when reviewing branch changes.
  - Consult `.claude/commands/compliance.md` before plugin submission or when compliance is uncertain.
  - Consult `.claude/commands/release.md` for versioning, tags, push, and GitHub release workflow.
  - Consult `.claude/commands/sync-codebase.md` after adding new `src/**/*.ts` files or after major refactors that may stale the codebase map.
- Agents:
  - Use `.claude/agents/architect.md` as the reference workflow for major features, refactors, and architecture decisions; plan only, do not implement during the planning phase.
  - Use `.claude/agents/code-reviewer.md` as the reference workflow for strict reviews; findings first, read-only mindset.
  - Use `.claude/agents/compliance-checker.md` as the reference workflow for Obsidian store audits and compliance verification.
- `.claude/agents/*.md` and `.claude/commands/*.md` are Claude Code-specific formats, but Codex should still use them as reference material when the task matches.
- If guidance conflicts, follow the stricter rule and pause before irreversible actions.
- Even when following `.claude/commands/release.md`, Codex must still obey this file’s no-auto-commit / ask-before-commit requirements.

---

## Repository Guidelines

### Project Structure & Module Organization
- `main.ts`: Obsidian plugin entry, bundled to `main.js`.
- `src/`: TypeScript source organized by domain:
  - `core/`, `ui/`, `ai/`, `licensing/`, `utils/`.
- `test/`: Jest tests mirroring `src/` (unit + integration) with Obsidian mocks.
- `styles.css`, `manifest.json`, `versions.json`: UI, plugin manifest, versioning.

### Build, Test, and Development Commands
- `npm run dev`: Start esbuild in watch mode for local development.
- `npm run build`: Type-check, lint, and build a development bundle.
- `npm run build:prod`: Production bundle with tree-shaking and no sourcemaps.
- `npm test` / `npm run test:watch`: Run Jest tests (jsdom environment).
- `npm run lint` / `npm run lint:fix`: Lint TypeScript; auto-fixes where possible.
- `npm run lint:obsidian`: Strict rules aligned with Obsidian review.
- `npm run lint:security`: Quick pass to catch unsafe DOM patterns.
- `npm run version`: Bump version and stage `manifest.json`/`versions.json`.

### Coding Style & Naming Conventions
- Language: TypeScript (strict). Prefer `const`, no `var`, avoid unused vars.
- Indentation/format: Follow ESLint; keep imports sorted and code small, pure.
- DOM: Never use `innerHTML`, `outerHTML`, or direct `style`; use `createEl`,
  `textContent`, and CSS classes.
- Commands/UI: Titles should not include the plugin name prefix (e.g., use
  `Open sidebar`, not `Nova: Open sidebar`).

### Testing Guidelines
- Framework: Jest + ts-jest (`test/` roots mirror `src/`).
- Files: Name as `*.test.ts` or `*.spec.ts`; place next to related modules or
  under `test/<area>/` following folder structure.
- Coverage: Collected from `src/**/*.ts` (excluding `src/main.ts`). Add tests
  for new behavior and bug fixes; prefer fast, deterministic tests.
- Mocks: Obsidian API is mapped to `test/mocks/obsidian-mock.ts`.

### Commit & Pull Request Guidelines
- Commits: Clear, imperative subject; reference issues (e.g., `fix: preserve
  context on provider switch (#123)`). Keep changes focused.
- PRs: Describe intent and behavior; link issues; include screenshots/gifs for
  UI changes; update docs (`README.md`/guide) as needed; ensure `lint` and
  `test` pass. First-time contributors must sign the CLA.

### Security & Configuration
- Privacy-first: Do not send data without explicit user consent.
- Secrets: Never hardcode API keys; use settings in `src/settings.ts`.
- Run `npm run lint:obsidian` before submission.

---

## Shared Rules (all agents)
- Enforce Nova’s `CLAUDE.md` engineering principles.
- Contracts: Never break provider/UI/StateManager interfaces.
- Architecture: Event-driven only; UI listens to state; explicit `init()`.
- Constants in `constants.ts` or `config.ts`.
- Obsidian compliance:
  - `registerDomEvent` for listeners
  - `registerInterval` ONLY for `setInterval` (never `setTimeout`)
  - sentence-case UI text
  - native components (`DropdownComponent`, `Setting().setHeading()`, etc.)
  - no inline styles, no `innerHTML`
  - use modern APIs (`requestUrl`, `getActiveViewOfType`, etc.)
- Performance: avoid unnecessary DOM updates; no full-vault scans without justification.
- Testing: behavior-focused, realistic mocks, success/error/edge coverage, no UI snapshots.
- Output diffs only (unless explicitly asked otherwise).
- No auto-commits: always stop for approval before commit.
- If ambiguous: ask 1 clarifying question or choose the most conservative option.

---

## Orchestrator
Purpose: Translate a PRD into a one-page executable plan.

Output (≤1 page, in order):
1. Acceptance Criteria
2. Assumptions (mark Must-Confirm / Low-Risk)
3. Open Questions (≤5)
4. Scope Allowlist (files you may change)
5. Non-Goals
6. Smallest-Diff Design (bullets)
7. Test Matrix (behaviors + edge/error; test file targets)
8. Risks/Complexity
9. Rollback steps
10. Optional Exploration: `PROPOSE: … BECAUSE …; IMPACT: …`

Stop after Plan. Wait for approval.

---

## Implementer
Purpose: Implement the approved Plan.

- Work only in Scope Allowlist.
- Show a `PATCH PREVIEW` (unified diff) before applying.
- Copy existing Obsidian UI patterns exactly; no new abstractions unless justified.
- If fixing review issues: apply only Must-Fix items unless told otherwise.

---

## TestWriter
Purpose: Add/modify tests per the Plan’s Test Matrix.

- Behavior-focused, fast, deterministic.
- Mock Obsidian/provider APIs and StateManager realistically.
- Cover success, error, and edge.
- Avoid UI snapshots unless unavoidable.
- Output diffs only for test files; show `PATCH PREVIEW`.

---

## Reviewer
Purpose: Strict review against CLAUDE.md and repo rules.

- Input: diffs or directories.
- Output three lists:
  - Must-Fix (include minimal diff snippets if helpful)
  - Should-Fix
  - Nice-to-Have
- If a Must-Fix requires larger refactor:
  `PROPOSE: …; MINIMAL-OPTION: …; BIG-OPTION: …; WAIT.`

---

## Explorer
Purpose: Research, propose improvements/refactors.

- Output short list of ideas with tradeoffs.
- Never implement; stop after suggestions.
