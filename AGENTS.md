# Nova Codex Repository Guidelines

This file is Nova's canonical repository policy. All Codex agents working in
this repository must follow it and the applicable repository skills.

---

## Canon and Required Context

- AGENTS.md is the source of truth for repository policy and workflow gates.
- Repository-native workflows live in .agents/skills/. Do not depend on
  configuration from another coding agent.
- For roadmap, PRD, spec, pricing, positioning, or product-priority work, read
  the relevant Nova documents in:
  - /Users/shawn/Obsidian/Basecamp/07-Projects/Nova/Core Docs/
  - /Users/shawn/Obsidian/Basecamp/07-Projects/Nova/Planning/
- The Basecamp vault is the source of truth for product documents and specs.
  Update existing documents in Nova's defined vault structure; do not create
  generated product plans or specs in this plugin repository.
- Product documents describe intent. Treat behavior as shipped only after the
  codebase confirms it.
- Verify every documented command, hotkey, setting, API, and shipped behavior
  against live code before describing it as available.

### Required Skill Routing

Read every applicable SKILL.md completely before acting:

- .agents/skills/implement-nova-change/SKILL.md for feature, fix, and issue
  implementation.
- .agents/skills/develop-nova-plugin/SKILL.md before changing plugin code,
  tests, styles, manifests, or Obsidian-facing behavior.
- .agents/skills/navigate-nova-codebase/SKILL.md when mapping scope,
  dependencies, contracts, or unfamiliar areas.
- .agents/skills/evaluate-nova-product/SKILL.md for product, roadmap, spec,
  pricing, positioning, or prioritization work.
- .agents/skills/orchestrate-nova-work/SKILL.md for complex work with multiple
  genuinely independent evidence or implementation streams.
- .agents/skills/review-nova-pr/SKILL.md for strict branch or pull-request
  reviews.
- .agents/skills/audit-nova-compliance/SKILL.md before plugin submission,
  after submission-sensitive changes, or whenever compliance is uncertain.
- .agents/skills/release-nova-plugin/SKILL.md for versioning, release notes,
  commits, tags, pushes, GitHub releases, assets, or attestations.
- .agents/skills/sync-nova-codebase/SKILL.md after adding src/**/*.ts files or
  after major refactors that may stale the generated codebase map.

Use only the minimum applicable skill set. If guidance conflicts, follow the
stricter rule and stop before irreversible actions.
Codex-native reusable workflows are skills, not slash commands. Invoke an
explicit-only workflow such as release with `$release-nova-plugin`.

---

## Repository Guidelines

### Project Structure and Module Organization

- main.ts: Obsidian plugin entry, bundled to main.js.
- src/: TypeScript source organized by domain:
  - core/, ui/, ai/, licensing/, utils/.
- test/: Jest tests mirroring src/ with Obsidian mocks.
- styles.css, manifest.json, versions.json: UI, plugin manifest, versioning.

### Build, Test, and Development Commands

- npm run dev: start esbuild in watch mode.
- npm run build: type-check, lint, and build a development bundle.
- npm run build:prod: production bundle with tree-shaking and no sourcemaps.
- npm run typecheck:test: type-check test sources and Obsidian mocks.
- npm test: type-check tests, then run Jest in jsdom.
- npm run test:watch: run Jest in watch mode.
- npm run lint / npm run lint:fix: lint TypeScript or apply safe lint fixes.
- npm run lint:obsidian: strict checks aligned with Obsidian review.
- npm run lint:security: quick unsafe-DOM and security checks.
- npm run version: project version lifecycle. Use it only through the
  approval-gated release workflow.

### Coding Style and Naming

- TypeScript is strict. Prefer const, never var, and avoid unused values.
- Follow ESLint, keep imports sorted, and keep modules small and focused.
- Never use innerHTML, outerHTML, or direct style mutation. Use createEl,
  textContent, and CSS classes.
- Command and UI titles use sentence case and no plugin-name prefix. For
  example, use Open sidebar rather than Nova: Open sidebar.

### Testing

- Jest and ts-jest run in the jsdom environment.
- Name tests *.test.ts or *.spec.ts and mirror the related source structure.
- Coverage includes src/**/*.ts except src/main.ts.
- Add behavior-focused tests for new behavior and fixes. Cover success, error,
  and edge paths with realistic Obsidian, provider, state-owner, and
  persistence mocks.
- Prefer fast deterministic tests. Avoid UI snapshots unless unavoidable.

### Commits and Maintainer Pull Requests

- Use `type(scope): description` commit subjects. Allowed types are `feat`,
  `fix`, `refactor`, `test`, `docs`, and `chore`; use an imperative
  description, a meaningful scope when useful, and reference issues when
  relevant.
- Use a concise body for important user-visible or technical details. Never
  add AI attribution, co-author lines, or generated-by notices to commits.
- Maintainer PRs describe intent and behavior, link issues, include visuals for
  UI changes, update user documentation when needed, and pass required checks.
- External code contributions, documentation patches, and unsolicited PRs are
  not accepted. Direct contributors to CONTRIBUTING.md for the feedback-only
  policy; do not ask them to open PRs or sign CLAs.

### Security and Configuration

- Privacy first: do not send data without explicit user consent.
- Nova's policy is zero telemetry. Do not add usage analytics, tracking, or
  client-side telemetry.
- Never hardcode secrets. Store provider credentials through Nova settings.
- Run npm run lint:obsidian before submission.

---

## Shared Engineering Rules

- Release continuity: all work for an active release stays on its release
  branch. Do not sync it with origin/main between tasks unless explicitly
  requested.
- Preserve the user's dirty worktree and unrelated changes.
- Never break provider, UI, state-owner, persistence, event, or serialized-data
  contracts without an approved migration.
- Keep architecture event-driven: UI listens to state, dependencies are
  explicit, constructors have no side effects, and initialization is explicit.
- Put reusable constants in constants.ts or config.ts.
- Obsidian requirements:
  - registerDomEvent for DOM events.
  - registerEvent for Obsidian events.
  - registerInterval only for setInterval, never for setTimeout.
  - Track and clear timeouts through Nova's existing timeout abstraction.
  - Use native components such as DropdownComponent and Setting().setHeading().
  - Use requestUrl, getActiveViewOfType, and other current APIs.
  - Use sentence-case UI text, safe DOM APIs, and CSS classes.
  - Do not register default hotkeys.
- Route editor-streaming operations through Nova's established
  StreamingManager and preserve partial output, cancellation, completion,
  error recovery, autoscroll, and cleanup semantics.
- Avoid unnecessary DOM updates and unjustified full-vault scans.
- Preserve streaming behavior, structured errors, privacy, accessibility, and
  mobile compatibility.
- Output diffs only unless the user explicitly requests another format.
- Never auto-commit. Always stop for explicit approval before committing.
- Never tag, push, publish, create a release, delete release state, or perform
  another irreversible external action without explicit approval.
- If ambiguity would materially change scope or behavior, ask one focused
  question. Otherwise choose the most conservative low-risk interpretation.

---

## Workflow and Approval Gates

### Plan

For non-trivial implementation work, produce a one-page executable plan in
this order:

1. Acceptance Criteria
2. Assumptions, marked Must-Confirm or Low-Risk
3. Open Questions, no more than five
4. Scope Allowlist
5. Non-Goals
6. Smallest-Diff Design
7. Test Matrix with behavior, edge/error cases, and test targets
8. Risks and Complexity
9. Rollback Steps
10. Optional Exploration in this form:
    PROPOSE: ... BECAUSE ...; IMPACT: ...

A user-established implementation goal authorizes proceeding from this plan
into implementation without a separate plan-approval checkpoint. Otherwise
stop after the plan. Downstream commit, publish, and release gates always
remain explicit.

### Implement

- Work only in the Scope Allowlist.
- Show a PATCH PREVIEW as a unified diff before applying changes.
- Copy established Nova and Obsidian patterns; add abstractions only when the
  plan justifies them.
- When addressing review feedback, apply only Must-Fix items unless told
  otherwise.

### Test

- Validate the narrowest relevant behavior first, then run broader checks in
  proportion to risk.
- Use realistic mocks and cover success, error, and edge behavior.
- Do not hide pre-existing failures; distinguish them from regressions caused
  by the current patch.

### Review

- Review with a read-only mindset and findings first.
- Report Must-Fix, Should-Fix, and Nice-to-Have lists with path and line
  evidence.
- If a Must-Fix requires a larger refactor, report:
  PROPOSE: ...; MINIMAL-OPTION: ...; BIG-OPTION: ...; WAIT.

### Explore

- Research and propose a short list of improvements with tradeoffs.
- Do not implement exploratory ideas without an implementation goal.

---

## Codex Orchestration

- Use subagents only when the user or an applicable repository skill calls for
  them.
- Prefer parallel read-heavy investigations with concrete, bounded
  deliverables.
- Do not create artificial dependencies. If two nodes can start from the same
  known state and neither consumes the other's output, run them independently.
- Keep parallel writes disjoint or isolated. The primary agent owns scope,
  integration, conflict resolution, and final verification.
- Add an independent checker after multi-branch work, reopen only failed
  nodes, and cap rework loops.
- Parallelism never broadens authorization or bypasses plan, patch preview,
  commit, publish, or release gates.
