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

Use the exact one-page Plan order in AGENTS.md:

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
   batch whose scope materially differs from the preview.
2. Edit only files in the Scope Allowlist. Stop and revise the plan before
   expanding scope.
3. Apply the smallest coherent diff, copy existing Nova patterns, and avoid
   speculative cleanup or unrelated refactors.
4. Preserve contracts, event ordering, streaming, cancellation, teardown,
   privacy, accessibility, and mobile behavior.
5. Add or update behavior tests with realistic mocks. Cover success, error,
   and relevant edge or cancellation paths.
6. Validate each logical batch with the narrowest useful command before
   running broader gates.

For complex work, orchestrate only independent read-heavy or disjoint
workstreams. The primary agent integrates and owns the final diff.

## Verify and Hand Off

Run applicable checks in this progression:

- targeted tests;
- npm run build;
- npm test;
- npm run lint;
- npm run lint:security;
- npm run lint:obsidian;
- npm run build:prod when bundling, submission, or release behavior changed.

Inspect final git status and the complete diff. Confirm every acceptance
criterion, note skipped checks and pre-existing failures, and list any residual
risk.

Do not create a scratchpad plan in the repository. Do not commit, tag, push,
publish, or release. If a commit would be the next step, show the proposed
scope and an AGENTS.md-compliant message without AI attribution, then wait for
explicit approval.
