---
name: nova-codebase
description: Auto-generated Nova codebase map. Regenerate with $nova-codebase-map.
generated: 2026-07-01
---

# Nova Codebase Map

> This file is auto-generated. Do not edit manually.
> Regenerate with: `$nova-codebase-map`.

## Summary

- Files scanned: 83
- Files with `@file` descriptions: 83
- Files missing `@file` descriptions: 0
- Local dependency edges: 255

## File Structure

### AI Layer (src/ai)

| File | Description | Key Exports |
|------|-------------|-------------|
| `models.ts` | Models - Centralized model definitions and context limits for all AI providers | `ContextLimit`, `ModelConfig`, `ModelDefinition`, `OLLAMA_DEFAULT_CONTEXT`, `OPENAI_COMPATIBLE_DEFAULT_CONTEXT`, `ProviderContextLimits`, `getAvailableModels`, `getContextLimit`, `getModelMaxOutputTokens`, `getProviderContextLimits`, `getProviderTypeForModel`, `hasKnownContextLimit` |
| `provider-manager.ts` | AIProviderManager - Manages AI provider instances and model selection | `AIProviderManager` |
| `types.ts` | AITypes - Type definitions for AI providers, messages, and streaming | `AIGenerationOptions`, `AIMessage`, `AIProvider`, `AIProviderSettings`, `AIStreamResponse`, `PlatformModelSettings`, `PlatformSettings`, `ProviderConfig`, `ProviderType` |

### AI Providers (src/ai/providers)

| File | Description | Key Exports |
|------|-------------|-------------|
| `claude.ts` | ClaudeProvider - Anthropic Claude API integration | `ClaudeProvider`, `modelAcceptsTemperature` |
| `google.ts` | GoogleProvider - Google Gemini API integration | `GoogleProvider` |
| `ollama.ts` | OllamaProvider - Local Ollama API integration | `OllamaProvider` |
| `openai-compatible.ts` | OpenAICompatibleProvider - Chat Completions integration for OpenAI-compatible endpoints | `OpenAICompatibleProvider`, `isLocalOpenAICompatibleBaseUrl`, `normalizeOpenAICompatibleBaseUrl` |
| `openai.ts` | OpenAIProvider - OpenAI GPT API integration | `OpenAIProvider` |

### Core Layer (src/core)

| File | Description | Key Exports |
|------|-------------|-------------|
| `ai-intent-classifier.ts` | AIIntentClassifier - AI-powered intent classification for ambiguous inputs | `AIIntentClassifier`, `UserIntent` |
| `auto-context.ts` | AutoContext - Automatic context population from wikilinks | `AutoContextDocument`, `AutoContextOptions`, `AutoContextService`, `ContextSource`, `DEFAULT_AUTO_CONTEXT_OPTIONS`, `TruncationResult`, `estimateTokens`, `extractSectionContent` |
| `command-parser.ts` | CommandParser - Parses user input into structured edit commands | `CommandParser` |
| `context-builder.ts` | ContextBuilder - Builds document context for AI prompts | `ContextBuilder`, `GeneratedPrompt` |
| `context-calculator.ts` | ContextCalculator - Calculates token usage and context limits | `ContextUsage`, `calculateContextUsage`, `estimateTokens`, `formatContextUsage`, `getContextTooltip`, `getContextWarningLevel`, `getRemainingContextPercentage` |
| `conversation-manager.ts` | ConversationManager - Manages file-scoped conversation storage | `ConversationManager`, `DataStore` |
| `crypto-service.ts` | CryptoService - Encrypts/decrypts sensitive data like API keys | `CryptoService` |
| `document-analysis.ts` | DocumentAnalyzer - Analyzes document structure and metadata | `DocumentAnalyzer`, `DocumentStructure` |
| `document-engine.ts` | DocumentEngine - Central hub for all document manipulation | `DocumentEngine` |
| `intent-detector.ts` | IntentDetector - Classifies user input as editing vs consultation | `IntentClassification`, `IntentDetector` |
| `prompt-builder.ts` | PromptBuilder - Builds system and user prompts for AI | `PromptBuilder` |
| `types.ts` | CoreTypes - Type definitions for document editing and commands | `ContextDocumentRef`, `ConversationData`, `ConversationMessage`, `DocumentContext`, `DocumentSection`, `EditAction`, `EditCommand`, `EditOptions`, `EditResult`, `HeadingInfo`, `PromptConfig` |
| `vault-analyzer.ts` | VaultAnalyzer - Vault-wide writing analysis with incremental caching and history snapshots | `DashboardCacheFile`, `DashboardHistoryFile`, `DocumentAnalysisSummary`, `VaultAnalyzer`, `VaultSnapshot` |
| `writing-analysis-normalizer.ts` | WritingAnalysisNormalizer - Position-stable Markdown masking for local writing analysis | `FrontmatterInfo`, `LineInfo`, `NormalizeMarkdownOptions`, `NormalizedMarkdown`, `buildLineInfos`, `detectFrontmatter`, `indexToPosition`, `normalizeMarkdownForWritingAnalysis` |
| `writing-analysis-runner.ts` | WritingAnalysisRunner - Shared run-token helpers for deterministic writing analysis | `AnalysisRunToken`, `createAnalysisRunToken`, `isStaleAnalysisRun`, `measureElapsedMs` |
| `writing-analysis.ts` | WritingAnalysis - Deterministic writing quality analysis helpers | `AdverbMatch`, `MAX_PROSE_LINTER_ANALYSIS_CHAR_LENGTH`, `MAX_WRITING_ANALYSIS_CHAR_LENGTH`, `PassiveVoiceMatch`, `SentenceAnalysis`, `WeakIntensifierMatch`, `WritingAnalysis`, `WritingAnalysisOptions`, `analyzeWriting`, `clearWritingAnalysisCache`, `getCacheSizeForTests`, `hasWritingAnalysisOptOut`, `hashContent` |
| `writing-score.ts` | WritingScore - Composite writing score helpers for dashboard analysis | `DEFAULT_TARGET_READABILITY_GRADE`, `WRITING_SCORE_MIN_WORDS`, `WRITING_SCORE_THRESHOLDS`, `WritingScore`, `WritingScoreLabel`, `calculateWritingScore`, `getWritingScoreLabel`, `getWritingScoreValueClass`, `scoreClarityPillar`, `scoreConcisenessPillar`, `scoreDisciplinePillar`, `scoreVarietyPillar` |

### Core Commands (src/core/commands)

| File | Description | Key Exports |
|------|-------------|-------------|
| `add-command.ts` | AddCommand - Handles content insertion at cursor | `AddCommand`, `StreamingCallback` |
| `delete-command.ts` | DeleteCommand - Handles content removal | `DeleteCommand` |
| `edit-command.ts` | EditCommand - Handles in-place content modification | `EditCommand` |
| `grammar-command.ts` | GrammarCommand - Handles grammar and spelling corrections | `GrammarCommand` |
| `metadata-command.ts` | MetadataCommand - Handles frontmatter and tag modifications | `MetadataCommand` |
| `rewrite-command.ts` | RewriteCommand - Handles content rewriting with tone/style | `RewriteCommand` |
| `selection-edit-command.ts` | SelectionEditCommand - Handles editing selected text | `SelectionEditCommand`, `SelectionEditResult` |

### Commands Feature (src/features/commands)

| File | Description | Key Exports |
|------|-------------|-------------|
| `constants.ts` | Constants for Nova Commands system | `CM_SELECTORS`, `COMMANDS`, `CSS_CLASSES`, `INSIGHT_PANEL`, `MARGIN_INDICATORS`, `OPPORTUNITY_TITLES`, `UI` |
| `types.ts` | Type definitions for the Nova Commands system | `CommandExecutionContext`, `CommandRegistry`, `CommandSuggestionsSettings`, `DocumentType`, `ExecutionOptions`, `InsightDetection`, `MarkdownCommand`, `ProgressiveDisclosureSettings`, `SmartContext`, `SmartTimingSettings`, `TemplateVariable`, `TimingDecision`, `TypingMetrics`, `responseTimeToMs`, `toProgressiveDisclosureSettings`, `toSmartTimingSettings` |

### Commands Core (src/features/commands/core)

| File | Description | Key Exports |
|------|-------------|-------------|
| `CommandEngine.ts` | CommandEngine - Core system for executing commands and the /fill command | `CommandEngine`, `MarkerInsight`, `insertSmartFillPlaceholder` |
| `SmartTimingEngine.ts` | SmartTimingEngine - Centralized timing service for command features | `SmartTimingEngine`, `TimingEvents` |
| `SmartVariableResolver.ts` | SmartVariableResolver - Intelligent resolution of template variables | `SmartVariableResolver` |

### Commands UI (src/features/commands/ui)

| File | Description | Key Exports |
|------|-------------|-------------|
| `InsightPanel.ts` | InsightPanel - Full intelligence panel for command selection | `InsightPanel` |
| `MarginIndicators.ts` | MarginIndicators - Intelligent margin indicators for command suggestions | `MarginIndicators` |
| `codemirror-decorations.ts` | CodeMirror decorations for margin indicators | `CodeMirrorIndicatorManager`, `CodeMirrorWritingHighlightManager`, `WritingHighlight`, `addIndicatorEffect`, `clearIndicatorsEffect`, `clearWritingHighlightsEffect`, `createIndicatorExtension`, `removeIndicatorEffect`, `setWritingHighlightsEffect` |

### Licensing Layer (src/licensing)

| File | Description | Key Exports |
|------|-------------|-------------|
| `feature-config.ts` | FeatureConfig - Time-gated feature configuration | `SUPERNOVA_FEATURES`, `TimeGatedFeature` |
| `feature-manager.ts` | FeatureManager - Manages feature flags and Supernova access | `FeatureManager` |
| `license-validator.ts` | LicenseValidator - Validates Supernova license keys | `LicenseValidator` |
| `types.ts` | LicensingTypes - Type definitions for licensing system | `DebugSettings`, `FeatureAccessResult`, `FeatureFlag`, `LicenseError`, `SupernovaLicense`, `SupernovaValidationResult` |

### UI Layer (src/ui)

| File | Description | Key Exports |
|------|-------------|-------------|
| `chat-renderer.ts` | ChatRenderer - Renders conversation messages in sidebar | `ChatRenderer` |
| `command-system.ts` | CommandSystem - Handles slash command detection and picker UI | `CommandSystem` |
| `context-manager.ts` | ContextManager - Manages multi-document context in sidebar | `ContextManager`, `DocumentReference`, `MultiDocContext` |
| `context-quick-panel.ts` | ContextQuickPanel - Collapsible quick panel for context controls | `ContextQuickPanel`, `ContextQuickPanelDeps` |
| `custom-command-modal.ts` | CustomCommandModal - Modal for creating/editing custom commands | `CustomCommandModal` |
| `custom-instruction-modal.ts` | CustomInstructionModal - Modal for custom editing instructions with prompt history | `CustomInstructionModal` |
| `input-handler.ts` | InputHandler - Handles text input and keyboard events | `InputHandler` |
| `prose-linter-view.ts` | ProseLinterView - Dedicated current-note Prose Linter view | `ProseLinterView`, `VIEW_TYPE_PROSE_LINTER` |
| `provider-manager.ts` | UIProviderManager - UI components for provider/model selection | `ProviderManager` |
| `release-notes-view.ts` | ReleaseNotesView - Full-page tab showing what's new after an update | `ReleaseNotesView`, `VIEW_TYPE_RELEASE_NOTES` |
| `selection-context-menu.ts` | SelectionContextMenu - Context menu for text selection actions | `SELECTION_ACTIONS`, `SelectionAction`, `SelectionContextMenu` |
| `sidebar-events.ts` | SidebarEvents - Custom DOM events for decoupled sidebar communication | `SIDEBAR_CHAT_MESSAGE_EVENT`, `SIDEBAR_PROCESSING_EVENT`, `SidebarChatMessageDetail`, `SidebarChatMessageEvent`, `SidebarChatMessageType`, `SidebarProcessingDetail`, `SidebarProcessingEvent`, `dispatchSidebarChatMessage`, `dispatchSidebarProcessing`, `isSidebarAvailable` |
| `sidebar-view.ts` | NovaSidebarView - Main sidebar view with chat interface | `NovaSidebarView`, `VIEW_TYPE_NOVA_SIDEBAR` |
| `smart-revision-modal.ts` | SmartRevisionModal - Smart Revision pass, brief, and review surface | `SmartRevisionModal`, `SmartRevisionModalOptions` |
| `streaming-manager.ts` | StreamingManager - Manages AI response streaming to editor | `ActionType`, `StreamingManager`, `StreamingOptions` |
| `tone-selection-modal.ts` | ToneSelectionModal - Modal for selecting rewrite tone | `TONE_OPTIONS`, `ToneOption`, `ToneSelectionModal` |
| `wikilink-suggest.ts` | WikilinkSuggest - Autocomplete for [[wikilinks]] in input | `NovaWikilinkAutocomplete` |
| `writing-analysis-manager.ts` | WritingAnalysisManager - Coordinates deterministic writing analysis for the active Markdown editor | `WRITING_ANALYSIS_UPDATED_EVENT`, `WritingAnalysisManager`, `WritingAnalysisUpdateDetail` |
| `writing-dashboard-view.ts` | WritingDashboardView - Vault-wide writing dashboard with scoring, trends, and per-document metrics | `VIEW_TYPE_WRITING_DASHBOARD`, `WritingDashboardView` |
| `writing-stats-panel.ts` | WritingStatsPanel - Collapsible sidebar panel for deterministic writing analysis metrics | `WritingStatsPanel`, `WritingStatsPanelDeps`, `WritingStatsPanelState` |

### Utilities (src/utils)

| File | Description | Key Exports |
|------|-------------|-------------|
| `logger.ts` | Logger - Centralized logging utility with levels | `LogLevel`, `Logger`, `ScopedLogger` |
| `timeout-manager.ts` | TimeoutManager - Obsidian-compliant timeout management | `TimeoutManager` |
| `version.ts` | Version utilities for semver comparison | `isVersionNewer` |

### Root Source (src)

| File | Description | Key Exports |
|------|-------------|-------------|
| `constants.ts` | Constants - Shared constants and magic strings | `CHALLENGE_SYSTEM_PROMPT`, `CHATGPT_ALIAS`, `CUSTOM_PROMPT_HISTORY_MAX`, `FEATURE_SMARTFILL`, `FEATURE_SMART_REVISION`, `GEMINI_ALIAS`, `KOFI_URL`, `NOVA_API_KEYS_SALT`, `NOVA_CONVERSATIONS_STORAGE_KEY`, `NOVA_STAR_ICON`, `NOVA_SUPERNOVA_ICON`, `PROVIDER_CLAUDE`, `PROVIDER_GOOGLE`, `PROVIDER_OLLAMA`, `PROVIDER_OPENAI`, `VIEW_TYPE_NOVA_SIDEBAR`, `VIEW_TYPE_PROSE_LINTER` |
| `release-notes.ts` | Release notes content for each version. | `RELEASE_NOTES`, `ReleaseNotesEntry`, `getRecentReleaseNotes`, `getReleaseNotes` |
| `settings.ts` | Settings - Plugin settings UI and configuration | `CustomCommand`, `DEFAULT_SETTINGS`, `DashboardSettings`, `NovaSettingTab`, `NovaSettings`, `WritingAnalysisSettings` |

## Component Dependencies

### AI Layer (src/ai)

**src/ai/models.ts** imports:
- `../settings`

**src/ai/provider-manager.ts** imports:
- `./types`
- `./providers/claude`
- `./providers/openai`
- `./providers/openai-compatible`
- `./providers/google`
- `./providers/ollama`
- `../settings`
- `../licensing/feature-manager`
- `./models`
- `../utils/timeout-manager`
- `obsidian` (external)

### AI Providers (src/ai/providers)

**src/ai/providers/claude.ts** imports:
- `../types`
- `../../utils/logger`
- `../../utils/timeout-manager`
- `obsidian` (external)

**src/ai/providers/google.ts** imports:
- `../types`
- `../../utils/logger`
- `../../utils/timeout-manager`
- `obsidian` (external)

**src/ai/providers/ollama.ts** imports:
- `../types`
- `../../utils/timeout-manager`
- `../../utils/logger`
- `obsidian` (external)

**src/ai/providers/openai-compatible.ts** imports:
- `../types`
- `../../utils/logger`
- `../../utils/timeout-manager`
- `obsidian` (external)

**src/ai/providers/openai.ts** imports:
- `../types`
- `../../utils/timeout-manager`
- `../../utils/logger`
- `obsidian` (external)

### Core Layer (src/core)

**src/core/ai-intent-classifier.ts** imports:
- `../ai/provider-manager`
- `../utils/logger`
- `./intent-detector`

**src/core/auto-context.ts** imports:
- `../utils/logger`
- `obsidian` (external)

**src/core/command-parser.ts** imports:
- `./types`

**src/core/context-builder.ts** imports:
- `./types`
- `../settings`

**src/core/context-calculator.ts** imports:
- `../ai/models`

**src/core/conversation-manager.ts** imports:
- `./types`
- `../utils/logger`
- `obsidian` (external)

**src/core/crypto-service.ts** imports:
- `../utils/logger`

**src/core/document-engine.ts** imports:
- `./types`
- `./conversation-manager`
- `../utils/logger`
- `obsidian` (external)

**src/core/intent-detector.ts** imports:
- `../utils/logger`

**src/core/prompt-builder.ts** imports:
- `./context-builder`
- `./document-engine`
- `./conversation-manager`
- `./command-parser`
- `./types`
- `obsidian` (external)

**src/core/types.ts** imports:
- `obsidian` (external)

**src/core/vault-analyzer.ts** imports:
- `../utils/logger`
- `../settings`
- `./writing-analysis`
- `./writing-score`
- `obsidian` (external)

**src/core/writing-analysis.ts** imports:
- `./writing-analysis-normalizer`

**src/core/writing-score.ts** imports:
- `./writing-analysis`

### Core Commands (src/core/commands)

**src/core/commands/add-command.ts** imports:
- `../document-engine`
- `../context-builder`
- `../../ai/provider-manager`
- `../types`
- `obsidian` (external)

**src/core/commands/delete-command.ts** imports:
- `../document-engine`
- `../types`
- `obsidian` (external)

**src/core/commands/edit-command.ts** imports:
- `../document-engine`
- `../context-builder`
- `../../ai/provider-manager`
- `../types`
- `./add-command`
- `obsidian` (external)

**src/core/commands/grammar-command.ts** imports:
- `../document-engine`
- `../context-builder`
- `../../ai/provider-manager`
- `../types`
- `./add-command`
- `obsidian` (external)

**src/core/commands/metadata-command.ts** imports:
- `../document-engine`
- `../../utils/logger`
- `../context-builder`
- `../../ai/provider-manager`
- `../types`
- `obsidian` (external)

**src/core/commands/rewrite-command.ts** imports:
- `../document-engine`
- `../context-builder`
- `../../ai/provider-manager`
- `../types`
- `./add-command`
- `obsidian` (external)

**src/core/commands/selection-edit-command.ts** imports:
- `../../../main`
- `../../utils/logger`
- `obsidian` (external)

### Commands Core (src/features/commands/core)

**src/features/commands/core/CommandEngine.ts** imports:
- `../../../utils/logger`
- `../../../ui/streaming-manager`
- `../../../ai/provider-manager`
- `../../../core/context-builder`
- `../../../core/document-engine`
- `../types`
- `../../../../main`
- `obsidian` (external)

**src/features/commands/core/SmartTimingEngine.ts** imports:
- `../../../utils/logger`
- `../../../utils/timeout-manager`
- `./SmartVariableResolver`
- `../types`
- `../../../../main`

**src/features/commands/core/SmartVariableResolver.ts** imports:
- `../../../utils/logger`
- `../types`
- `../../../../main`
- `obsidian` (external)

### Commands UI (src/features/commands/ui)

**src/features/commands/ui/InsightPanel.ts** imports:
- `../../../utils/logger`
- `../../../utils/timeout-manager`
- `../core/CommandEngine`
- `../constants`
- `../types`
- `../../../../main`
- `obsidian` (external)

**src/features/commands/ui/MarginIndicators.ts** imports:
- `../../../utils/logger`
- `../../../utils/timeout-manager`
- `../core/CommandEngine`
- `./InsightPanel`
- `./codemirror-decorations`
- `../types`
- `../../../../main`
- `obsidian` (external)
- `@codemirror/view` (external)

**src/features/commands/ui/codemirror-decorations.ts** imports:
- `../../../utils/logger`
- `../types`
- `../../../../main`
- `@codemirror/state` (external)
- `@codemirror/view` (external)
- `obsidian` (external)

### Licensing Layer (src/licensing)

**src/licensing/feature-config.ts** imports:
- `../constants`

**src/licensing/feature-manager.ts** imports:
- `./license-validator`
- `./types`
- `./feature-config`

**src/licensing/license-validator.ts** imports:
- `./types`
- `../core/crypto-service`

### UI Layer (src/ui)

**src/ui/chat-renderer.ts** imports:
- `../../main`
- `../utils/timeout-manager`
- `../utils/logger`
- `obsidian` (external)

**src/ui/command-system.ts** imports:
- `../../main`
- `../features/commands/core/CommandEngine`
- `../features/commands/core/SmartVariableResolver`
- `../utils/logger`
- `../features/commands/types`
- `../utils/timeout-manager`
- `obsidian` (external)

**src/ui/context-manager.ts** imports:
- `../../main`
- `../core/context-calculator`
- `../utils/logger`
- `../core/auto-context`
- `obsidian` (external)

**src/ui/context-quick-panel.ts** imports:
- `./context-manager`
- `./input-handler`
- `../utils/timeout-manager`
- `../utils/logger`
- `../core/context-calculator`
- `../../main`
- `obsidian` (external)

**src/ui/custom-command-modal.ts** imports:
- `../settings`
- `obsidian` (external)

**src/ui/custom-instruction-modal.ts** imports:
- `../../main`
- `../utils/timeout-manager`
- `../constants`
- `obsidian` (external)

**src/ui/input-handler.ts** imports:
- `../../main`
- `./wikilink-suggest`
- `./command-system`
- `./context-manager`
- `../utils/logger`
- `../utils/timeout-manager`
- `obsidian` (external)

**src/ui/prose-linter-view.ts** imports:
- `../../main`
- `../constants`
- `../core/writing-analysis`
- `../core/writing-analysis-runner`
- `../features/prose-linter/prose-linter-issues`
- `../features/prose-linter/prose-linter-rendering`
- `../features/prose-linter/prose-linter-runner`
- `../features/prose-linter/prose-linter-store`
- `../features/prose-linter/prose-linter-types`
- `../features/smart-revision/smart-revision-types`
- `./writing-analysis-manager`
- `obsidian` (external)

**src/ui/provider-manager.ts** imports:
- `../../main`
- `../ai/models`
- `../utils/logger`
- `obsidian` (external)

**src/ui/release-notes-view.ts** imports:
- `../constants`
- `../release-notes`
- `obsidian` (external)

**src/ui/selection-context-menu.ts** imports:
- `../../main`
- `../features/commands/core/CommandEngine`
- `../core/commands/selection-edit-command`
- `./tone-selection-modal`
- `./custom-instruction-modal`
- `./streaming-manager`
- `../utils/logger`
- `../constants`
- `./sidebar-events`
- `obsidian` (external)

**src/ui/sidebar-view.ts** imports:
- `../core/document-analysis`
- `../../main`
- `../core/types`
- `./context-manager`
- `../ai/models`
- `../ai/types`
- `../ai/providers/openai-compatible`
- `./input-handler`
- `./command-system`
- `./context-manager`
- `./chat-renderer`
- `./streaming-manager`
- `./selection-context-menu`
- `../core/context-calculator`
- `../utils/logger`
- `../utils/timeout-manager`
- `./sidebar-events`
- `./context-quick-panel`
- `./writing-analysis-manager`
- `./writing-stats-panel`
- `../core/writing-analysis`
- `obsidian` (external)

**src/ui/smart-revision-modal.ts** imports:
- `../../main`
- `../features/smart-revision/smart-revision-diff`
- `../features/smart-revision/smart-revision-diff`
- `../features/smart-revision/smart-revision-service`
- `../features/smart-revision/smart-revision-types`
- `obsidian` (external)

**src/ui/streaming-manager.ts** imports:
- `../utils/logger`
- `../utils/timeout-manager`
- `../../main`
- `obsidian` (external)

**src/ui/tone-selection-modal.ts** imports:
- `obsidian` (external)

**src/ui/wikilink-suggest.ts** imports:
- `obsidian` (external)

**src/ui/writing-analysis-manager.ts** imports:
- `../core/writing-analysis`
- `../core/writing-analysis-runner`
- `../features/commands/ui/codemirror-decorations`
- `../features/prose-linter/prose-linter-types`
- `../constants`
- `./writing-dashboard-view`
- `../utils/logger`
- `../utils/timeout-manager`
- `../../main`
- `obsidian` (external)
- `@codemirror/view` (external)

**src/ui/writing-dashboard-view.ts** imports:
- `../../main`
- `../core/vault-analyzer`
- `../core/writing-score`
- `obsidian` (external)

**src/ui/writing-stats-panel.ts** imports:
- `../core/writing-analysis`
- `obsidian` (external)

### Root Source (src)

**src/features/prose-linter/prose-linter-issues.ts** imports:
- `../../core/writing-analysis`
- `./prose-linter-types`

**src/features/prose-linter/prose-linter-rendering.ts** imports:
- `./prose-linter-types`

**src/features/prose-linter/prose-linter-rules.ts** imports:
- `../../core/writing-analysis-normalizer`
- `../../core/writing-analysis-runner`
- `./prose-linter-types`

**src/features/prose-linter/prose-linter-runner.ts** imports:
- `../../core/writing-analysis-runner`
- `../../core/writing-analysis-runner`
- `./prose-linter-rules`
- `./prose-linter-types`

**src/features/prose-linter/prose-linter-store.ts** imports:
- `./prose-linter-types`

**src/features/prose-linter/prose-linter-summary.ts** imports:
- `../../core/writing-analysis`
- `./prose-linter-types`

**src/features/prose-linter/prose-linter-types.ts** imports:
- `../../core/writing-analysis`

**src/features/smart-revision/smart-revision-diff.ts** imports:
- `./smart-revision-types`

**src/features/smart-revision/smart-revision-impact.ts** imports:
- `../../core/writing-analysis`
- `./smart-revision-types`

**src/features/smart-revision/smart-revision-prompts.ts** imports:
- `./smart-revision-types`

**src/features/smart-revision/smart-revision-risk.ts** imports:
- `./smart-revision-types`

**src/features/smart-revision/smart-revision-service.ts** imports:
- `../../ai/provider-manager`
- `../../utils/logger`
- `./smart-revision-diff`
- `./smart-revision-impact`
- `./smart-revision-prompts`
- `./smart-revision-risk`
- `./smart-revision-types`

**src/features/smart-revision/smart-revision-types.ts** imports:
- `../prose-linter/prose-linter-types`
- `obsidian` (external)

**src/release-notes.ts** imports:
- `./utils/version`

**src/settings.ts** imports:
- `../main`
- `./ai/types`
- `./licensing/types`
- `./ui/sidebar-view`
- `./ai/providers/claude`
- `./ai/providers/openai`
- `./ai/providers/openai-compatible`
- `./ai/providers/google`
- `./ai/providers/ollama`
- `./utils/logger`
- `./features/commands/types`
- `./utils/timeout-manager`
- `./ui/custom-command-modal`
- `./ai/models`
- `obsidian` (external)

## Recent Changes

| Commit | Summary |
|--------|---------|
| `817788a` | docs: update roadmap version references |
| `9acbbf0` | 1.7.1 |
| `5be84c2` | docs(release-notes): add notes for 1.7.1 |
| `44facd0` | fix: activate OpenAI-compatible model from settings |
| `35e4e1c` | 1.7.0 |
| `442d18a` | docs(release-notes): add notes for 1.7.0 |
| `1585fc6` | feat: add OpenAI-compatible endpoints |
| `e126a15` | docs: clarify feedback-only contribution policy |
| `fcb9238` | chore(release): bump version to 1.6.3 |
| `dcfaadd` | feat: add Claude Opus 4.8 |

## Missing File Headers

- None
