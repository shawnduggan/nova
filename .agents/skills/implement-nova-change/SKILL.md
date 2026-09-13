---
name: implement-nova-change
description: Plan, implement, test, and hand off Nova features, fixes, and issues using the repository's smallest-diff, patch-preview, testing, compliance, and approval rules. Use whenever the user asks Codex to change Nova code or repository behavior.
---

# Implement Nova Change

Combine this workflow with develop-nova-plugin. Use navigate-nova-codebase for
unfamiliar scope, evaluate-nova-product for product decisions, and
audit-nova-compliance for submission-sensitive behavior.

## Establish the Baseline

1. Read AGENTS.md and every applicable skill completely.
2. Inspect the current branch, git status, staged and unstaged changes, and
   untracked files.
3. Preserve active-release continuity and distinguish the user's existing
   changes from the requested patch.
4. If the request names a GitHub issue or URL, read the authoritative issue
   with the connected GitHub tooling or `gh issue view`. Then trace current
   behavior and identify relevant tests, contracts, events, settings, and
   release implications.
5. Resolve material ambiguity from repository evidence. Ask one focused
   question only when a conservative assumption would change the result.

## Produce the Nova Plan

For a small, well-bounded change, state acceptance criteria, affected files,
and the smallest meaningful validation. For non-trivial work, use the
one-page Plan order in AGENTS.md:

1. Acceptance Criteria
2. Assumptions
3. Open Questions
4. Scope Allowlist
5. Non-Goals
6. Smallest-Diff Design
7. Test Matrix
8. Risks and Complexity
9. Rollback Steps
10. Optional Exploration

For major architecture work, include current contracts, alternatives, affected
consumers, migration needs, mobile and performance risks, and any new
dependency. Plan only until implementation is authorized.

A direct request to implement, fix, build, add, migrate, or make the changes
establishes an implementation goal and permits continuing after the plan.
Otherwise stop for approval.

## Implement

1. Show a unified PATCH PREVIEW before the first edit and before any later
   batch whose scope materially differs from the preview. Continue when the
   implementation is already authorized; a preview is not a new approval gate.
2. Edit only files in the Scope Allowlist. Stop and revise the plan before
   expanding scope.
3. Apply the smallest coherent diff, copy existing Nova patterns, and avoid
   speculative cleanup or unrelated refactors.
4. Preserve contracts, event ordering, streaming, cancellation, teardown,
   privacy, accessibility, and mobile behavior.
5. For behavior changes, add or update meaningful tests with realistic mocks
   covering the affected success, error, edge, or cancellation paths. Do not
   add tests that only mirror wording or a reversible, low-impact edit.
6. Validate each logical batch with the narrowest useful command before
   running broader gates.

For complex work, orchestrate only independent read-heavy or disjoint
workstreams. The primary agent integrates and owns the final diff.

## Verify and Hand Off

Choose checks for the affected behavior and the readiness claim:

- Start with the smallest meaningful inspection, targeted test, or static check.
- Use npm run typecheck:test for test/mock typing changes and npm run build
  when source, types, styles, or build inputs require validation.
- Run the full npm test suite when shared contracts, broad behavior, or
  release/submission readiness warrants it.
- Run the relevant lint, security, and Obsidian checks for affected rules or
  submission-sensitive behavior; do not treat every command as mandatory for
  every edit.
- Use npm run build:prod for bundling, submission, or release changes.
- Complete all required release/submission gates when claiming that readiness,
  including real Obsidian validation for newly added models.

Once the chosen checks pass, repeat or broaden them only after new changes,
failures, or unresolved evidence. Documentation-only changes usually need
reference/command validation and diff inspection, not a full application run.

Inspect final git status and the complete diff. Confirm every acceptance
criterion, note skipped checks and pre-existing failures, and list any residual
risk.

Do not create a scratchpad plan in the repository. Finish user-authorized
implementation under Shawn's standing repository completion authorization:
inspect the intended diff, run relevant checks, commit only the completed
task changes with an AGENTS.md-compliant message, push to the existing intended
remote/branch, and verify the remote commit. Do not ask again or stop with
uncommitted work. Preserve unrelated work and explicit local-only/no-push
requests; report actual validation, branch, or push blockers. Route versioned
release actions through release-nova-plugin and preserve its exact gates.
