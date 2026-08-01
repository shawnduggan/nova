---
name: sync-nova-codebase
description: Refresh Nova's generated codebase reference after new TypeScript files, major refactors, export changes, or stale navigation metadata. Use to keep the Codex navigation index accurate without replacing live code inspection.
---

# Sync Nova Codebase

Maintain a concise generated reference at:

.agents/skills/navigate-nova-codebase/references/codebase-map.md

The reference is an index, not canon. Live code and tests always win.

## Audit Before Generating

1. Read AGENTS.md and navigate-nova-codebase.
2. Inspect the current branch, status, and existing user changes.
3. Enumerate src/**/*.ts with rg --files.
4. Use rg --files-without-match to find source files missing the established
   @file header. Report missing headers; do not invent descriptions.
5. Extract top-level exports, imports, constructor dependencies, owning
   managers and stores, event names, provider contracts, commands, settings,
   and related tests from live files.
6. Inspect recent structural changes with focused git log and diff evidence.
7. Compare the evidence with any existing generated map and identify additions,
   removals, renames, and stale claims.

Do not copy a historical map forward without revalidating it.

## Generated Map Format

Keep the reference factual and compact:

1. Generated date, branch, and commit
2. Scope and freshness warning
3. Entry points and lifecycle
4. Directory and module map
5. Public exports and stable contracts
6. Event and state flow
7. Provider and streaming flow
8. UI and settings surfaces
9. Test and mock locations
10. Recent structural changes
11. Missing headers or unresolved facts

Use repository-relative paths. Prefer tables or short bullets over prose.
Avoid source dumps, implementation speculation, secrets, local machine state,
and commit history unrelated to architecture.

## Apply and Verify

- Show a unified PATCH PREVIEW before creating or updating the reference.
- Change only the generated reference unless the user separately authorizes
  missing-header fixes.
- Re-run file, export, import, and missing-header checks after the edit.
- Spot-check every mapped entry against live files.
- Report the reference diff, coverage gaps, and the commit used for generation.
- Report source files scanned, source files described, missing headers, and
  unresolved dependency or contract facts.
- Do not commit the map without explicit approval.
