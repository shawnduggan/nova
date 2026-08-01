---
name: orchestrate-nova-work
description: Coordinate complex Nova work with dependency graphs, focused Codex subagents, checker nodes, and bounded convergence. Use for major features, architecture decisions, broad reviews, or investigations with at least three genuinely independent workstreams.
---

# Orchestrate Nova Work

Use orchestration when independent evidence streams can materially reduce
elapsed time or improve verification. This skill authorizes focused Codex
subagents within the user's existing task scope; it does not authorize new
external actions or broaden file scope.

## Decide Whether to Orchestrate

Use one primary agent for a small change, a single execution path, or work
whose branches depend on one another. Consider subagents when at least three
bounded tasks can start from the same known state and return independently,
such as:

- mapping separate subsystems;
- reviewing correctness, compliance, and tests;
- researching product intent while another branch maps implementation;
- validating disjoint implementation areas after a shared plan.

Parallel agents consume more tokens and add integration cost. Use them only
when the expected evidence or latency benefit is real.

## Draw the Dependency Graph First

For each node, state:

- its concrete deliverable;
- its required inputs;
- the node or fact it depends on;
- whether it is read-only or writes files;
- its completion check.

Apply the fake-edge test: if node B can begin from the same known state as node
A and does not consume A's output, remove the A-to-B edge and run them in
parallel. Keep real sequential edges for plan-to-implementation,
implementation-to-tests, and integration-to-final-review.

## Delegate Safely

- The primary agent reads all mandatory repository and skill instructions.
  Never delegate interpretation of repository policy.
- Give each subagent one concrete, bounded deliverable and the exact relevant
  scope.
- Prefer read-only branches. For writes, use disjoint files or isolated work
  and name the ownership boundary explicitly.
- Never let two agents edit the same file concurrently.
- Keep approval-gated or irreversible actions with the primary agent.
- The primary agent owns the plan, Scope Allowlist, integration, conflicts,
  user updates, and final answer.

## Join Through a Checker

After parallel branches complete:

1. Compare each result with its requested deliverable.
2. Reconcile contradictions against primary evidence.
3. Integrate only work inside the approved scope.
4. Run an independent checker against acceptance criteria, repository rules,
   tests, and the actual diff.
5. Reopen only the node that failed. Give it the checker evidence and one
   bounded correction task.
6. Cap rework loops. If the same condition fails repeatedly, stop and report
   the blocker rather than cycling.

The checker must inspect the integrated result, not merely trust branch
summaries.

## Useful Nova Graphs

Feature work:

Product intent and code map run in parallel, then join into the one-page plan.
Implementation follows the approved scope. Tests and compliance review then
run independently before final integration verification.

Branch review:

Diff inventory feeds independent correctness, test, and compliance reviews.
Their findings join in a severity and duplication checker before the final
review report.

Architecture work:

Current-state map, contract analysis, and alternative evaluation run in
parallel. A planning node compares them, then a checker verifies the proposed
scope and rollback path. Planning stops before implementation unless the user
has already established an implementation goal.

## Preserve Gates

Subagents never bypass the one-page plan, PATCH PREVIEW, Scope Allowlist,
commit approval, tag approval, push approval, publication approval, or release
verification. Parallelism changes scheduling, not authority.
