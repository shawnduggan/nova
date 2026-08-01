---
name: review-nova-pr
description: Perform a strict, read-only review of Nova branch, pull-request, or working-tree changes against the correct release baseline and repository policy. Use for pre-merge review, branch audits, or requests to inspect a diff without fixing it.
---

# Review Nova PR

Review with a read-only mindset. Do not implement fixes unless the user
separately establishes an implementation goal.

## Establish the Review Set

1. Read AGENTS.md and the relevant engineering or product skills.
2. Inspect the current branch and git status.
3. Resolve the intended base from the active release and user context. Do not
   assume origin/main or synchronize branches during an active release.
4. Inspect the base-to-head diff, staged diff, unstaged diff, and every
   relevant untracked file.
5. Record the file list and diff stat, then read every changed file in full
   where surrounding behavior affects the review.
6. Treat generated files, manifests, release notes, tests, and workflow files
   as part of the change when present.

If the comparison reference is missing or stale, report that limitation.
Fetch or modify refs only when the user has authorized current remote state.

## Review Axes

Check:

- correctness, invariants, edge cases, cancellation, teardown, and error paths;
- provider, UI, state-owner, persistence, event, and serialized-data contracts;
- constructor side effects, initialization order, event registration, timers,
  and unload cleanup;
- streaming order, partial output, abort behavior, and provider switching;
- use of StreamingManager for editor-streaming behavior;
- zero telemetry, privacy, secrets, network consent, unsafe DOM, injection,
  and path handling;
- Obsidian API, UI, accessibility, mobile, and plugin-store compliance;
- performance, repeated DOM work, full-vault scans, and unbounded operations;
- strict TypeScript, error typing, floating promises, and suppression comments;
- behavior-test quality, realistic mocks, success/error/edge coverage, and
  regression protection;
- repository hygiene, unrelated changes, accidental artifacts, documentation,
  version consistency, and release-branch continuity.

For a broad review with independent axes, use orchestrate-nova-work. Give
subagents read-only scopes and use a checker to deduplicate and calibrate
findings.

## Verify

Run focused tests or static checks when they can confirm or reject a suspected
finding. Run broader build, test, lint, security, or Obsidian checks in
proportion to risk and without hiding changes they produce. Distinguish:

- a demonstrated regression;
- a pre-existing failure;
- an unverified risk;
- a missing test.

Do not report speculative style preferences as defects.

## Report

Lead with findings, ordered by severity:

1. Must-Fix
2. Should-Fix
3. Nice-to-Have

For each finding include path and line, the violated behavior or rule, the
concrete impact, and the smallest credible correction. Include minimal diff
snippets only when they make the fix unambiguous.

Then report:

- checks run and results;
- important areas that passed;
- residual uncertainty;
- verdict: Block, Ready after Must-Fix, or Ready.

If a Must-Fix requires a larger refactor, use:
PROPOSE: ...; MINIMAL-OPTION: ...; BIG-OPTION: ...; WAIT.
