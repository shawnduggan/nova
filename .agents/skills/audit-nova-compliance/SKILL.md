---
name: audit-nova-compliance
description: Audit Nova for Obsidian plugin-store, lifecycle, API, privacy, accessibility, type-safety, performance, and manifest compliance. Use before submission or release, after submission-sensitive changes, or whenever compliance is uncertain.
---

# Audit Nova Compliance

Perform a read-only audit unless the user has explicitly asked for fixes.
Automated searches produce candidates, not findings; verify every candidate in
context.

## Establish Scope

Read AGENTS.md, develop-nova-plugin, the manifest, package scripts, lint
configuration, changed files, and the relevant runtime paths. For a full store
audit or submission review, also read `references/obsidian-compliance.md`
completely and inspect all plugin source rather than only the current diff.

## Run Authoritative Checks

Run:

- npm run lint:obsidian
- npm run lint:security
- npm run lint
- npm run build:prod
- npm test when submission or release readiness is being asserted

Treat npm run lint:obsidian as the authoritative automated Obsidian check.
It must finish with zero errors and zero warnings. Record exact failures and
distinguish pre-existing failures from current regressions.

Use targeted rg searches to locate candidates for manual inspection,
including addEventListener, setInterval, setTimeout, innerHTML, outerHTML,
direct style mutation, fetch, console output, explicit any, suppression
comments, compatibility-sensitive regular expressions, and deprecated APIs.
Do not report a match until the surrounding lifecycle and API usage confirm a
violation.

## Audit Checklist

### Lifecycle and Events

- DOM listeners use registerDomEvent.
- Obsidian events use registerEvent.
- registerInterval receives only setInterval handles.
- Timeouts use Nova's timeout abstraction and are cleared.
- Streams, requests, subscriptions, views, and transient DOM are cleaned up
  on cancellation and unload.
- Constructors do not start side effects; init order is explicit.

### DOM, UI, and Accessibility

- No innerHTML, outerHTML, unsafe HTML injection, or direct inline styles.
- DOM creation uses safe local APIs and CSS classes.
- Commands and settings use sentence case and omit a plugin-name prefix.
- Settings headings use Setting().setHeading().
- Native Obsidian components are used where appropriate.
- Interactive controls have accessible names, keyboard behavior, focus
  handling, and semantic roles.
- No default hotkeys are registered.
- Commands omit the plugin name/ID and the word “command.”
- Styles are Nova-scoped, use Obsidian variables, and preserve keyboard focus,
  reduced motion, and mobile touch behavior.

### APIs and Compatibility

- Network calls use requestUrl and follow explicit consent and privacy paths.
- Workspace and view access use current APIs such as getActiveViewOfType.
- Active-editor and background-vault writes use the appropriate safe pattern.
- User-defined paths pass through normalizePath; frontmatter, deletion, plugin
  data, file lookup, and platform checks use the current Obsidian APIs.
- Node, Electron, desktop-only, and browser-global assumptions are absent or
  correctly gated.
- APIs and regular expressions remain compatible with the declared minimum
  app version and mobile platforms.

### TypeScript and Reliability

- Strict types are preserved; explicit any and unsafe assertions are
  justified.
- Promises are awaited, returned, or intentionally marked and handled.
- Async functions, error narrowing, cancellation, and cleanup are correct.
- No unnecessary lint disables, dead code, raw console logging, or deprecated
  string APIs remain.
- Streaming and provider failures preserve structured errors and cleanup.

### Privacy, Security, and Performance

- No telemetry, analytics, or tracking exists.
- No credentials, vault content, or sensitive metadata are logged or sent
  without consent.
- Settings and error paths do not expose secrets.
- DOM, URLs, paths, and provider responses are handled without injection or
  traversal hazards.
- No unjustified full-vault scans, unbounded loops, repeated layout work, or
  avoidable full rerenders exist.

### Manifest and Release Metadata

- The plugin ID uses only lowercase letters and hyphens, contains no
  `obsidian`, and does not end in `plugin`; the name contains neither Obsidian
  variants nor the word Plugin.
- manifest.json fields, SemVer version, minimum app version, and desktop
  support are valid.
- package.json, manifest.json, and versions.json agree where required.
- main.js, styles.css, and manifest.json are present for a release build.
- No development-only dependency or artifact leaks into the published
  package.

## Report and Re-Audit

Report:

1. Blocking violations
2. Warnings
3. Per-category counts and checks passed
4. Commands run and results
5. Readiness verdict

Every violation includes path and line, applicable rule, user or review
impact, and the smallest fix. After authorized fixes, rerun the failed check
and its neighboring checks before declaring Ready.
