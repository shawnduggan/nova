---
name: navigate-nova-codebase
description: Map live Nova code paths, contracts, events, tests, and likely scope. Use before planning or editing unfamiliar areas, tracing behavior across modules, locating owners, or checking the impact of a proposed change.
---

# Navigate Nova Codebase

Build a task-scoped map from live repository evidence. Do not replace current
code inspection with a generated summary.

## Map the Relevant Slice

1. Read AGENTS.md and inspect the current branch and git status. Preserve the
   active release branch and all unrelated changes.
2. Use rg --files and targeted rg searches to locate the entry point, feature
   vocabulary, public types, events, settings, commands, and tests.
3. Read the smallest complete execution path from caller to state, provider,
   persistence, or UI effect.
4. Trace imports, exports, constructor dependencies, event producers and
   listeners, owning manager or store transitions, and cleanup paths.
5. Identify stable contracts and all consumers before proposing interface
   changes.
6. Find related behavior tests, mocks, fixtures, and failure/cancellation
   coverage.
7. Use focused git log or git blame only when history is needed to explain an
   otherwise ambiguous design choice.

If
.agents/skills/navigate-nova-codebase/references/codebase-map.md exists, use
it only as an index. Verify every relevant statement against live code. If it
is stale after new files or a major refactor, use sync-nova-codebase.

## Questions the Map Must Answer

- Where does the behavior enter the system?
- Which module owns the state or invariant?
- Which modules consume the result?
- Which events, interfaces, and serialized shapes are contracts?
- How does success, error, cancellation, teardown, and provider switching
  flow?
- Which tests prove the current behavior?
- What is the smallest plausible file allowlist?
- What facts remain unverified?

## Output

Return a compact map in this order:

1. Current behavior
2. Entry point and dependency path
3. Contracts and invariants
4. Candidate Scope Allowlist
5. Test targets
6. Risks and unknowns

Include path and line references for important claims. Do not edit files while
performing a navigation-only task.
