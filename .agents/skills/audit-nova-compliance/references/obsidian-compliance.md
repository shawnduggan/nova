# Obsidian Compliance Reference

Validated 2026-08-01. This is a Codex audit reference, not a substitute for
current official guidance or live repository evidence.

## Authority

Use, in order:

1. Current Obsidian developer documentation:
   - https://docs.obsidian.md/oo/plugin
   - https://docs.obsidian.md/Reference/Manifest
   - https://docs.obsidian.md/Plugins/Releasing/Submit%20your%20plugin
2. Nova's installed Obsidian types, `eslint.config.mjs`, package scripts, and
   `eslint-plugin-obsidianmd` rules.
3. AGENTS.md and the live codebase.

If these disagree, re-check the current official docs and installed API. Search
matches are candidates; inspect context before reporting a finding.

## Manifest, Submission, and Release

- Required manifest fields are present and correctly typed.
- `id` contains only lowercase letters and hyphens, does not contain
  `obsidian`, does not end in `plugin`, and matches the plugin folder.
- `name` is unique and concise; it contains neither Obsidian variants nor the
  word Plugin and avoids reserved core-feature names.
- `version` is exact `x.y.z` SemVer. Package, lockfile, manifest, compatibility
  map, release tag, and release metadata agree where required.
- `isDesktopOnly: false` means every runtime path is mobile-safe or explicitly
  platform-gated.
- The default-branch manifest is accurate and committed before submission.
- Release assets are a production-minified `main.js`, `manifest.json`, and
  Nova's `styles.css`; `main.js` is attached to releases rather than committed.
- README disclosures cover network use, external accounts/services, payments,
  external-file access, ads, closed-source code, and privacy-relevant behavior.
- A package-manager lockfile is committed and dependency additions are
  justified.

## Lifecycle, Events, and Platform

- Constructors only store dependencies and local state. Use explicit `init()`;
  defer startup UI work with `workspace.onLayoutReady()`.
- Register DOM events, Obsidian events, editor extensions, intervals, and other
  resources through Plugin/Component registration APIs.
- Pass only `setInterval` handles to `registerInterval`. Track and clear
  timeouts with Nova's TimeoutManager.
- Cleanup covers requests, streams, subscriptions, timers, transient DOM,
  stores, managers, and views. Do not detach all leaves during unload.
- Use Obsidian `Platform`, not `process.platform`. Gate dynamic desktop-only
  imports and never top-level import Node or Electron APIs on mobile paths.
- Do not hardcode `.obsidian`; use `Vault.configDir`.
- Avoid unsupported regex lookbehind for the declared mobile/minimum-version
  target.

## Files, Settings, and Network

- Use the Editor for active-file edits and `Vault.process` for safe background
  transformations. Preserve concurrent user edits.
- Use `FileManager.processFrontMatter` for frontmatter and
  `FileManager.trashFile` for deletion.
- Prefer Vault over Adapter APIs. Use `getFileByPath` for known paths; use
  `cachedRead` when cached content is acceptable and `read` when freshness is
  required.
- Normalize user-supplied paths with `normalizePath` and use `instanceof`
  before narrowing TFile, TFolder, or adapter types.
- Persist plugin data through `Plugin.loadData()` and `Plugin.saveData()`.
- Use the injected/plugin `app`, never the global app instance.
- Use `requestUrl`, explicit consent, bounded payloads, cancellation, and
  redacted structured errors for network operations.

## Commands, DOM, CSS, and Accessibility

- Command IDs and names omit the plugin ID/name and the word “command.”
- Do not register default hotkeys.
- UI copy uses sentence case. Settings headings exist only for multiple
  sections, omit “setting” and “option,” and use `Setting().setHeading()`.
- Use native Obsidian components and safe DOM construction. Never use
  innerHTML, outerHTML, JavaScript-assigned static styles, or unsafe global
  selectors.
- Scope selectors to `nova-` classes, use Obsidian CSS variables, and avoid
  overriding core styles.
- Interactive controls have accessible names, semantic roles, keyboard
  activation, visible focus, and established mobile touch targets. Respect
  reduced-motion preferences.

## Type Safety, Privacy, and Performance

- Preserve strict TypeScript. Avoid `any`, unsafe assertions, floating
  promises, unnecessary suppressions, deprecated APIs, sample code, and raw
  console output.
- Nova has zero client-side telemetry. Do not add analytics, tracking, or
  telemetry libraries.
- Never log secrets, vault content, or sensitive metadata. Network
  transmission requires an explicit, visible user path.
- Avoid full-vault iteration for path lookup, unbounded work, repeated layout,
  full rerenders, and load-time work that can be deferred.
- Preserve provider, persistence, event, serialized-data, streaming, and
  cancellation contracts. Editor streaming remains owned by StreamingManager.

## Audit Evidence

For each category, record checks run, pass/warning/blocking counts, verified
paths and lines, and residual uncertainty. A Ready verdict requires zero
blocking violations, zero `lint:obsidian` warnings or errors, passing required
release checks, and no unresolved submission-sensitive uncertainty.
