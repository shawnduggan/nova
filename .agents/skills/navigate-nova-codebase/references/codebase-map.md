# Nova Codebase Map

Generated 2026-08-01 from branch `codex/scorecard-remediation`, HEAD commit
`9414a1123aa1`, and the live working tree. Source count: 84 TypeScript files.
Test count: 80 TypeScript files. Missing `@file` headers: 0.

This is a navigation index. Live source and tests are canonical; revalidate
every task-relevant claim and regenerate after structural changes.

## Entry Points and Lifecycle

- `main.ts` defines `NovaPlugin`. `onload()` loads settings, migrates legacy
  dashboard files into keyed plugin data, initializes licensing, constructs
  managers/services, and registers CodeMirror extensions, four views,
  commands, ribbon actions, the settings tab, and registered events.
- Layout-dependent startup for release notes, margin indicators, and writing
  analysis uses `workspace.onLayoutReady()`.
- `onunload()` cleans provider, conversation, settings, indicator, analysis,
  and command managers.
- `src/settings.ts` owns `NovaSettings`, defaults, migrations, persistence UI,
  provider configuration, writing tools, and licensing settings.
- `src/constants.ts` owns shared view, feature, provider, icon, and prompt
  constants. Domain constants also live beside their feature.

## Directory and Module Map

| Area | Owners |
| --- | --- |
| AI | `src/ai/types.ts`, `models.ts`, `provider-manager.ts`; provider adapters in `src/ai/providers/` |
| Editing core | `document-engine.ts`, `command-parser.ts`, `intent-detector.ts`, `ai-intent-classifier.ts`, command handlers in `src/core/commands/` |
| Context and prompts | `context-builder.ts`, `context-calculator.ts`, `auto-context.ts`, `prompt-builder.ts` |
| Persistence and security | `conversation-manager.ts`, `crypto-service.ts`, and dashboard plugin-data contracts in `vault-analyzer.ts` |
| Writing analysis | `document-analysis.ts`, `writing-analysis*.ts`, `writing-score.ts`, `vault-analyzer.ts` |
| Smart fill commands | `src/features/commands/core/`, `types.ts`, `constants.ts`, and `ui/` |
| Prose linter | `src/features/prose-linter/` rule, runner, issue, store, rendering, summary, and type modules |
| Smart Revision | `src/features/smart-revision/` service, prompt/parser, risk, diff, impact, and session types |
| Licensing | `src/licensing/feature-manager.ts`, `feature-config.ts`, `license-validator.ts`, `types.ts` |
| UI | Sidebar, registered views, context controls, provider/input/rendering managers, selection menu, modals, suggestions, analysis manager, and stats panel in `src/ui/` |
| Utilities | `src/utils/logger.ts`, `timeout-manager.ts`, `version.ts`, and typed custom workspace registration in `workspace-events.ts` |

## Stable Contracts and State Ownership

- `src/ai/types.ts`: `AIProvider`, `AIStreamResponse`,
  `AIGenerationOptions`, `ProviderConfig`, and `ProviderType`.
- `src/core/types.ts`: edit actions/commands/results, document context, prompt
  config, conversation messages/data, and context-document references.
- `src/core/conversation-manager.ts`: `DataStore` boundary and file-scoped
  conversation persistence.
- `src/core/vault-analyzer.ts`: `DashboardDataStore`, cache/history schemas,
  and legacy dashboard-file migration constants.
- `src/features/commands/types.ts`: command registry, execution context,
  variables, suggestion settings, and timing contracts.
- `src/features/prose-linter/prose-linter-types.ts`: issue, range,
  replacement, configuration, identity, label, and priority contracts.
- `src/features/smart-revision/smart-revision-types.ts`: target, snapshot,
  brief, cards, risk, impact, model result, and session contracts.
- `src/settings.ts`: serialized Nova settings and defaults.
- There is no central `StateManager`. State is owned by NovaPlugin/settings,
  ConversationManager, feature stores/services, and UI managers. Preserve
  those boundaries rather than inventing a parallel owner.

## Event and State Flow

- `main.ts` is the composition root. Core services are injected into command
  handlers; views receive the plugin and use its established managers.
- Registered Obsidian workspace events drive active-file, editor, layout,
  metadata, resize, and menu behavior.
- `src/ui/sidebar-events.ts` owns typed `nova-sidebar-processing` and
  `nova-sidebar-chat-message` workspace-event helpers.
- Writing analysis publishes `nova-writing-analysis-updated` through the
  workspace event bus. `src/utils/workspace-events.ts` bridges plugin-defined
  names to Obsidian's core-only TypeScript overloads without weakening payload
  types.
- Provider, license, and indicator changes also use workspace events named
  `nova-provider-configured`, `nova-provider-disconnected`,
  `nova-license-updated`, and `nova-indicator-click`.
- Persistence uses serialized keyed plugin-data mutations for settings,
  conversations, prose-linter ignores, dashboard cache, and dashboard history.
- Metadata commands mutate active-note frontmatter through
  `FileManager.processFrontMatter` and preserve unrelated structured fields.

## Provider and Streaming Flow

1. Platform settings select a provider/model through `AIProviderManager`.
2. The manager routes calls to Claude, OpenAI, OpenAI-compatible, Google, or
   Ollama adapters implementing `AIProvider`.
3. Streaming adapters yield ordered `AIStreamResponse` chunks and accept
   AbortSignal through generation options.
4. `src/ui/streaming-manager.ts` owns editor-streaming UX, restoration,
   thinking notices, autoscroll, and stop/cleanup behavior. Sidebar,
   selection-menu, and command paths consume it.
5. Smart Revision uses `SmartRevisionService` plus prompt parsing, risk,
   impact, and diff helpers before accepted edits reach the Editor.

## UI and Settings Surfaces

- Registered views: sidebar (`nova-sidebar`), release notes
  (`nova-release-notes`), writing dashboard (`nova-writing-dashboard`), and
  prose linter (`nova-prose-linter`).
- Commands enter through `main.ts`; slash-command UI is owned by
  `src/ui/command-system.ts` and Smart Fill by `CommandEngine`.
- `NovaSidebarView` composes chat, input, context, provider, writing-analysis,
  streaming, and selection behavior.
- `NovaSettingTab` owns general, writing, command, provider, model, license,
  privacy-relevant, and release-note preferences.
- CSS is centralized in `styles.css`; TypeScript adds Nova-scoped classes and
  attributes rather than inline styles.

## Tests and Mocks

- Tests mirror source under `test/ai`, `core`, `features`, `licensing`, `ui`,
  `utils`, plus integration tests.
- Shared Obsidian mocks live in `test/mocks/obsidian-mock.ts`; common setup and
  helpers are `test/setup.ts` and `test/test-utils.ts`.
- Release-note behavior is covered by `test/release-notes.test.ts`.
- Streaming, provider status, intent routing, persistence, Smart Revision,
  prose linter, dashboard analysis, workspace events, pop-out behavior,
  privacy-safe logging, and lifecycle-sensitive UI have focused suites in
  their matching directories.

## Recent Structural Changes

- August 2026 moved Nova-internal DOM events to the Obsidian workspace bus,
  made analysis and insight handlers pop-out aware, consolidated dashboard
  persistence into plugin data, and moved metadata writes to Obsidian's
  frontmatter API.
- July 2026 added Smart Revision permanent-tier behavior and refreshed release
  and model support.
- June 2026 added OpenAI-compatible endpoints.
- May 2026 added and refined the prose linter and snapshot-based writing
  analysis.
- April 2026 added the writing dashboard and mobile hardening.

## Unresolved Facts

- The working tree contained pre-existing uncommitted source and test edits at
  generation time; inspect their diff before relying on behavior-level detail.
- No source files lack `@file` headers. Re-run the sync workflow after adding,
  removing, or renaming source files or changing contracts/events.
