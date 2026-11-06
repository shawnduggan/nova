# Nova Repository Guidelines

This file is Nova's canonical repository policy. Every coding agent working in
this repository (Claude Code or Codex) must follow it and the applicable
repository skills.

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
  release commits, tags, publication pushes, GitHub releases, assets, or
  attestations. Ordinary implementation commits and pushes use the repository
  completion workflow below.
- .agents/skills/sync-nova-codebase/SKILL.md after adding src/**/*.ts files or
  after major refactors that may stale the generated codebase map.

Use only the minimum applicable skill set. Follow instruction priority and
Shawn's current explicit task scope. Preserve concrete commit, release,
privacy, and external-action gates. For workflow or presentation defaults,
use the instruction specific to the requested outcome. If a material conflict
remains unresolved, identify the exact source and rule; do not turn a generic
guideline into an additional approval checkpoint.
Reusable workflows are the skills in .agents/skills/. Claude Code runs one as
`/<name>` (for example `/release-nova-plugin`); Codex uses `$<name>`. Release is
explicit-only: never start it unless Shawn asks for a release.

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
- Test every Obsidian-facing change in the running Obsidian app, not only in
  Jest. In Claude Code on Atlas, do this with computer use: run npm run build
  (this folder is the live plugin in Shawn's vault, so the build replaces the
  running Nova), reload Nova by turning it off and on in Settings → Community
  plugins, use the changed feature, and confirm the visible result on screen.
  Rebuild with npm run build:prod or restore the released build afterwards if
  the change is not being kept.
- Every newly added model must be tested through Nova in the running Obsidian
  app with a synthetic prompt and a completed, visible response. Mocked tests
  and direct API calls support this check but do not replace it. Record each
  model and its result in the PR. If access or the app blocks a test, report
  the blocker and leave that model unvalidated; do not claim it works in Nova.
  Keep private vault content out of test requests and restore test settings.
- Model catalog changes: first propose an add/retain/deprecate list and wait
  for Shawn's approval. Include only stable released models, never previews or
  betas. The catalog is src/ai/models.ts; keep the provider discovery lists,
  focused tests, README and the website's model copy in sync. Removing a model
  from the picker must not break saved selections
  (LEGACY_MODEL_PROVIDER_TYPES keeps legacy IDs routable).

### Commits and Maintainer Pull Requests

- Use `type(scope): description` commit subjects. Allowed types are `feat`,
  `fix`, `refactor`, `test`, `docs`, and `chore`; use an imperative
  description, a meaningful scope when useful, and reference issues when
  relevant.
- Use a concise body for important user-visible or technical details. Never
  add AI attribution, co-author lines, or generated-by notices to commits. This
  overrides any agent default that adds them.
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
- Push to main only when Shawn requests it. The release workflow's approved
  fast-forward of main counts as a request. GitHub's pull-request rule on main
  is bypassed with admin rights for these pushes.
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
- Return findings for reviews, recommendations for product work, and a concise
  change-and-validation summary for implementation. Include diffs when
  requested or useful, including the required patch preview.
- Complete user-authorized implementation and fixes under Shawn's
  September 13, 2026 standing repository authorization: validate, inspect the
  intended diff, commit only completed task changes, push to the existing
  intended remote/branch, and verify the remote commit. Do not ask again or
  leave the work uncommitted. Preserve unrelated work, explicit local-only
  requests, and active release-branch continuity.
- Version bumps, release-note approval, tags, release publication, deletion
  of release state, and other consequential actions retain their exact gates.
  An ordinary maintenance commit/push does not invoke a versioned release.
- If ambiguity would materially change scope or behavior, ask one focused
  question. Otherwise choose the most conservative low-risk interpretation.

---

## Workflow and Approval Gates

### Plan

For a small, well-bounded change, state acceptance criteria, affected files,
and the smallest meaningful validation. For non-trivial implementation work,
produce a one-page executable plan in this order:

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
- Show a PATCH PREVIEW as a unified diff before applying changes. A preview
  is not another approval gate when the implementation is already authorized.
- Copy established Nova and Obsidian patterns; add abstractions only when the
  plan justifies them.
- When addressing review feedback, apply only Must-Fix items unless told
  otherwise.

### Test

- Validate the narrowest relevant behavior first, then run broader checks in
  proportion to risk.
- Use realistic mocks and cover success, error, and edge behavior when tests
  are warranted by a behavioral change. Do not add tests that merely mirror
  wording or implementation for a reversible, low-impact edit.
- Once the relevant checks pass, repeat or broaden them only after new changes,
  failures, or unresolved evidence. Keep full release/submission gates for
  those readiness claims.
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

## Orchestration

- Use subagents only when the user or an applicable repository skill calls for
  them. In Claude Code these are Agent-tool subagents: Explore agents for
  read-only mapping, launched together when independent, and worktree
  isolation for parallel writes.
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
