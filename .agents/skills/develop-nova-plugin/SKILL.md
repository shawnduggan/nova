---
name: develop-nova-plugin
description: Apply Nova's architecture, TypeScript, Obsidian API, UI, privacy, lifecycle, and testing conventions. Use whenever changing plugin source, tests, styles, manifests, providers, state, events, timers, or other Obsidian-facing behavior.
---

# Develop Nova Plugin

Use this skill as the engineering standard for Nova changes. Read AGENTS.md
first and combine this with navigate-nova-codebase when the affected path is
not already clear.

## Preserve the Architecture

- Pass dependencies explicitly. Constructors store dependencies and establish
  local state only; perform subscriptions and other side effects in init().
- Use direct method calls for tightly coupled components. Use registered
  events for cross-component, layout-level, settings, and license signals;
  do not add indirection merely for its own sake.
- Keep state changes in the established owning manager or store and
  communicate through registered workspace or custom events. UI components
  listen and render; do not invent a parallel state owner.
- Preserve provider, UI, persistence, event, and serialized-data contracts. If
  a contract must change, map every consumer and include a migration in the
  approved plan.
- Preserve streaming semantics: ordered chunks, cancellation, completion,
  structured failures, and cleanup must remain observable to callers.
- Route editor-streaming operations through StreamingManager. Preserve partial
  output, restoration on failure, autoscroll, cancellation, and teardown.
- Put reusable constants in the nearest constants.ts or config.ts.
- Reuse existing Logger, TimeoutManager, provider, state, and error patterns
  before introducing an abstraction.
- Give every new TypeScript file the established @file header. Use kebab-case
  filenames, PascalCase types, camelCase functions and values,
  SCREAMING_SNAKE_CASE constants, and nova-prefixed CSS classes.

## Use Obsidian-Safe APIs

- Register DOM listeners with registerDomEvent and Obsidian events with
  registerEvent so unload cleanup is automatic.
- Pass only setInterval handles to registerInterval. Track and clear
  setTimeout handles through Nova's existing timeout abstraction.
- Use requestUrl for network requests and current workspace/view APIs such as
  getActiveViewOfType.
- Use normalizePath for user-supplied vault paths, Platform for platform
  checks, and instanceof before narrowing TFile, TFolder, or adapter types.
- Use the editor for the active editing surface. For background vault writes,
  use Vault.process and preserve user edits. Use FileManager.processFrontMatter
  for frontmatter and FileManager.trashFile for deletion.
- Prefer Vault APIs over Adapter APIs. Use Plugin.loadData and Plugin.saveData
  for plugin data, and use the plugin's app reference rather than global app.
- Never use innerHTML, outerHTML, direct style mutation, or document-global
  selectors when a component-local safe DOM API is available.
- Build DOM with createEl, textContent, attributes, and CSS classes.
- Prefer native Obsidian components. Use Setting().setHeading() for settings
  headings and sentence case for commands, settings, notices, and controls.
- Command IDs and names omit the plugin ID/name and the word “command.” Do not
  register default hotkeys.
- Add accessible names, keyboard behavior, focus handling, and semantic roles
  for interactive controls.
- Scope selectors to Nova-owned classes, use Obsidian CSS variables, and keep
  visual, focus, reduced-motion, and touch behavior in stylesheets.
- Keep code mobile-safe. Avoid Node-only, Electron-only, or desktop-only APIs
  unless the manifest and feature intentionally require them.

## Protect Privacy and Reliability

- Nova has zero telemetry. Never add analytics, tracking, or client-side
  telemetry.
- Never transmit vault content, metadata, or credentials without explicit
  user consent and a visible product path.
- Never hardcode or log secrets. Use Nova settings and redact sensitive error
  details.
- Use structured application errors and the existing logger instead of raw
  console output.
- Preserve the live intent-classification contract and its safe non-editing
  fallback. Changes to classification or command patterns require focused
  pattern and integration tests to prevent unintended document edits.
- Avoid full-vault scans, repeated layout work, and full component rerenders
  when an incremental update is possible.
- Clean up streams, requests, subscriptions, timers, and transient UI on
  cancellation, close, provider change, and plugin unload.

## Implement the Smallest Safe Change

1. Trace the current behavior and its tests before editing.
2. Keep the patch inside the approved Scope Allowlist.
3. Copy the nearest working pattern before inventing a new one.
4. Update types and all consumers together when a local interface changes.
5. Add behavior tests for success, error, cancellation, and relevant edge
   cases. Use realistic Obsidian, provider, state-owner, and persistence mocks.
6. Avoid snapshots unless structure cannot be asserted meaningfully another
   way.

## Validate

Run the narrowest relevant tests first. Then run the checks justified by the
change:

- npm test -- <target>
- npm run build
- npm run lint
- npm run lint:security
- npm run lint:obsidian

Use npm run build:prod for release-sensitive bundling changes. Report
pre-existing failures separately and never weaken a check to make the patch
pass.

For submission, manifest, API, lifecycle, or CSS-sensitive work, read
`../audit-nova-compliance/references/obsidian-compliance.md` completely.
