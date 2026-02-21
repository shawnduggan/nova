---
name: nova-codebase
description: Auto-generated Nova codebase map. Regenerate with /project:sync-codebase
generated: 2026-02-21
---

# Nova Codebase Map

> This file is auto-generated. Do not edit manually.
> Regenerate with: `/project:sync-codebase`

## File Structure

### src/ai/

| File | Description | Key Exports |
|------|-------------|-------------|
| `models.ts` | Centralized model definitions and context limits for all AI providers | `ModelDefinition`, `ModelConfig`, `ContextLimit`, `ProviderContextLimits`, `getProviderTypeForModel()`, `getAvailableModels()`, `OLLAMA_DEFAULT_CONTEXT`, `getContextLimit()`, `getProviderContextLimits()`, `getModelMaxOutputTokens()`, `hasKnownContextLimit()` |
| `provider-manager.ts` | Manages AI provider instances and model selection | `AIProviderManager` |
| `types.ts` | Type definitions for AI providers, messages, and streaming | `AIMessage`, `AIStreamResponse`, `AIProvider`, `AIGenerationOptions`, `ProviderConfig`, `AIProviderSettings`, `ProviderType`, `PlatformSettings` |

### src/ai/providers/

| File | Description | Key Exports |
|------|-------------|-------------|
| `claude.ts` | Anthropic Claude API integration | `ClaudeProvider` |
| `google.ts` | Google Gemini API integration | `GoogleProvider` |
| `ollama.ts` | Local Ollama API integration | `OllamaProvider` |
| `openai.ts` | OpenAI GPT API integration | `OpenAIProvider` |

### src/core/

| File | Description | Key Exports |
|------|-------------|-------------|
| `ai-intent-classifier.ts` | AI-powered intent classification for ambiguous inputs | `UserIntent`, `AIIntentClassifier` |
| `auto-context.ts` | Automatic context population from wikilinks | `ContextSource`, `AutoContextDocument`, `AutoContextOptions`, `DEFAULT_AUTO_CONTEXT_OPTIONS`, `estimateTokens()`, `extractSectionContent()`, `TruncationResult`, `truncateDocumentContent()`, `AutoContextService` |
| `command-parser.ts` | Parses user input into structured edit commands | `CommandParser` |
| `context-builder.ts` | Builds document context for AI prompts | `GeneratedPrompt`, `ContextBuilder` |
| `context-calculator.ts` | Calculates token usage and context limits | `ContextUsage`, `estimateTokens()`, `calculateContextUsage()`, `getRemainingContextPercentage()`, `getContextWarningLevel()`, `formatContextUsage()`, `getContextTooltip()` |
| `conversation-manager.ts` | Manages file-scoped conversation storage | `DataStore`, `ConversationManager` |
| `crypto-service.ts` | Encrypts/decrypts sensitive data like API keys | `CryptoService` |
| `document-analysis.ts` | Analyzes document structure and metadata | `DocumentStructure`, `DocumentAnalyzer` |
| `document-engine.ts` | Central hub for all document manipulation | `DocumentEngine` |
| `intent-detector.ts` | Classifies user input as editing vs consultation | `IntentClassification`, `IntentDetector` |
| `prompt-builder.ts` | Builds system and user prompts for AI | `PromptBuilder` |
| `types.ts` | Type definitions for document editing and commands | `EditAction`, `EditCommand`, `DocumentContext`, `HeadingInfo`, `EditResult`, `EditOptions`, `DocumentSection`, `PromptConfig`, `ConversationMessage`, `ContextDocumentRef`, `ConversationData` |

### src/core/commands/

| File | Description | Key Exports |
|------|-------------|-------------|
| `add-command.ts` | Handles content insertion at cursor | `StreamingCallback`, `AddCommand` |
| `delete-command.ts` | Handles content removal | `DeleteCommand` |
| `edit-command.ts` | Handles in-place content modification | `EditCommand` |
| `grammar-command.ts` | Handles grammar and spelling corrections | `GrammarCommand` |
| `metadata-command.ts` | Handles frontmatter and tag modifications | `MetadataCommand` |
| `rewrite-command.ts` | Handles content rewriting with tone/style | `RewriteCommand` |
| `selection-edit-command.ts` | Handles editing selected text | `SelectionEditResult`, `SelectionEditCommand` |

### src/features/commands/

| File | Description | Key Exports |
|------|-------------|-------------|
| `constants.ts` | Constants for Nova Commands system | `INSIGHT_PANEL`, `MARGIN_INDICATORS`, `UI`, `COMMANDS`, `OPPORTUNITY_TITLES`, `CSS_CLASSES`, `CM_SELECTORS` |
| `types.ts` | Type definitions for the Nova Commands system | `MarkdownCommand`, `TemplateVariable`, `SmartContext`, `CommandExecutionContext`, `ExecutionOptions`, `DocumentType`, `CommandSuggestionsSettings`, `ProgressiveDisclosureSettings`, `SmartTimingSettings`, `TimingDecision`, `TypingMetrics`, `CommandRegistry`, `InsightDetection`, `responseTimeToMs()`, `toProgressiveDisclosureSettings()`, `toSmartTimingSettings()` |

### src/features/commands/core/

| File | Description | Key Exports |
|------|-------------|-------------|
| `CommandEngine.ts` | Core system for executing commands and the /fill command | `MarkerInsight`, `insertSmartFillPlaceholder()`, `CommandEngine` |
| `SmartTimingEngine.ts` | Centralized timing service for command features | `TimingEvents`, `SmartTimingEngine` |
| `SmartVariableResolver.ts` | Intelligent resolution of template variables | `SmartVariableResolver` |

### src/features/commands/ui/

| File | Description | Key Exports |
|------|-------------|-------------|
| `codemirror-decorations.ts` | CodeMirror decorations for margin indicators | `addIndicatorEffect`, `removeIndicatorEffect`, `clearIndicatorsEffect`, `createIndicatorExtension()`, `CodeMirrorIndicatorManager` |
| `InsightPanel.ts` | Full intelligence panel for command selection | `InsightPanel` |
| `MarginIndicators.ts` | Intelligent margin indicators for command suggestions | `MarginIndicators` |

### src/licensing/

| File | Description | Key Exports |
|------|-------------|-------------|
| `feature-config.ts` | Time-gated feature configuration | `TimeGatedFeature`, `SUPERNOVA_FEATURES` |
| `feature-manager.ts` | Manages feature flags and Supernova access | `FeatureManager` |
| `license-validator.ts` | Validates Supernova license keys | `LicenseValidator` |
| `types.ts` | Type definitions for licensing system | `SupernovaLicense`, `SupernovaValidationResult`, `LicenseError`, `FeatureFlag`, `FeatureAccessResult`, `DebugSettings` |

### src/ui/

| File | Description | Key Exports |
|------|-------------|-------------|
| `chat-renderer.ts` | Renders conversation messages in sidebar | `ChatRenderer` |
| `command-system.ts` | Handles slash command detection and picker UI | `CommandSystem` |
| `context-manager.ts` | Manages multi-document context in sidebar | `DocumentReference`, `MultiDocContext`, `ContextManager` |
| `context-quick-panel.ts` | Collapsible quick panel for context controls | `ContextQuickPanelDeps`, `ContextQuickPanel` |
| `custom-command-modal.ts` | Modal for creating/editing custom commands | `CustomCommandModal` |
| `custom-instruction-modal.ts` | Modal for custom editing instructions with prompt history | `CustomInstructionModal` |
| `input-handler.ts` | Handles text input and keyboard events | `InputHandler` |
| `provider-manager.ts` | UI components for provider/model selection | `ProviderManager` |
| `release-notes-view.ts` | Full-page tab showing what's new after an update | `VIEW_TYPE_RELEASE_NOTES`, `ReleaseNotesView` |
| `selection-context-menu.ts` | Context menu for text selection actions | `SelectionAction`, `SELECTION_ACTIONS`, `SelectionContextMenu` |
| `sidebar-events.ts` | Custom DOM events for decoupled sidebar communication | `SIDEBAR_PROCESSING_EVENT`, `SIDEBAR_CHAT_MESSAGE_EVENT`, `SidebarProcessingDetail`, `SidebarChatMessageType`, `SidebarChatMessageDetail`, `SidebarProcessingEvent`, `SidebarChatMessageEvent`, `dispatchSidebarProcessing()`, `dispatchSidebarChatMessage()`, `isSidebarAvailable()` |
| `sidebar-view.ts` | Main sidebar view with chat interface | `VIEW_TYPE_NOVA_SIDEBAR`, `NovaSidebarView` |
| `streaming-manager.ts` | Manages AI response streaming to editor | `StreamingOptions`, `ActionType`, `StreamingManager` |
| `tone-selection-modal.ts` | Modal for selecting rewrite tone | `ToneOption`, `TONE_OPTIONS`, `ToneSelectionModal` |
| `wikilink-suggest.ts` | Autocomplete for [[wikilinks]] in input | `NovaWikilinkAutocomplete` |

### src/utils/

| File | Description | Key Exports |
|------|-------------|-------------|
| `logger.ts` | Centralized logging utility with levels | `LogLevel`, `Logger`, `ScopedLogger` |
| `timeout-manager.ts` | Obsidian-compliant timeout management | `TimeoutManager` |
| `version.ts` | Version utilities for semver comparison | `isVersionNewer()` |

### src/ (root)

| File | Description | Key Exports |
|------|-------------|-------------|
| `constants.ts` | Shared constants and magic strings | `NOVA_CONVERSATIONS_STORAGE_KEY`, `NOVA_API_KEYS_SALT`, `VIEW_TYPE_NOVA_SIDEBAR`, `NOVA_STAR_ICON`, `NOVA_SUPERNOVA_ICON`, `PROVIDER_*`, `CHATGPT_ALIAS`, `GEMINI_ALIAS`, `CUSTOM_PROMPT_HISTORY_MAX`, `CHALLENGE_SYSTEM_PROMPT` |
| `release-notes.ts` | Release notes content for each version | `RELEASE_NOTES`, `getReleaseNotes()` |
| `settings.ts` | Plugin settings UI and configuration | `CustomCommand`, `NovaSettings`, `DEFAULT_SETTINGS`, `NovaSettingTab` |

## Component Dependencies

### AI Layer (src/ai/)

**provider-manager.ts** imports from:
- `./types` - AIProvider, ProviderType, AIMessage, AIGenerationOptions, AIStreamResponse
- `./providers/claude`, `./providers/openai`, `./providers/google`, `./providers/ollama`
- `./models` - getProviderTypeForModel
- `../settings` - NovaSettings
- `../licensing/feature-manager` - FeatureManager
- `../utils/timeout-manager` - TimeoutManager

**providers/*.ts** import from:
- `../types` - AIProvider, AIMessage, AIStreamResponse, ProviderConfig
- `../../utils/logger` - Logger
- `../../utils/timeout-manager` - TimeoutManager
- `obsidian` - requestUrl

**models.ts** imports from:
- `../settings` - NovaSettings

### Core Layer (src/core/)

**document-engine.ts** imports from:
- `./types` - DocumentContext, EditResult, EditCommand, HeadingInfo, EditOptions
- `./conversation-manager` - ConversationManager
- `../utils/logger` - Logger
- `obsidian` - App, Editor, MarkdownView, TFile, EditorPosition

**prompt-builder.ts** imports from:
- `./context-builder` - ContextBuilder, GeneratedPrompt
- `./document-engine` - DocumentEngine
- `./conversation-manager` - ConversationManager
- `./command-parser` - CommandParser
- `./types` - EditCommand, DocumentContext, PromptConfig, ConversationMessage

**ai-intent-classifier.ts** imports from:
- `../ai/provider-manager` - AIProviderManager
- `../utils/logger` - Logger
- `./intent-detector` - IntentDetector

**auto-context.ts** imports from:
- `../utils/logger` - Logger
- `obsidian` - App, TFile, CachedMetadata

**context-calculator.ts** imports from:
- `../ai/models` - getContextLimit

**commands/*.ts** import from:
- `../document-engine` - DocumentEngine
- `../context-builder` - ContextBuilder, GeneratedPrompt
- `../../ai/provider-manager` - AIProviderManager
- `../types` - EditCommand, EditResult, DocumentContext

**selection-edit-command.ts** imports from:
- `../../../main` - NovaPlugin
- `../../utils/logger` - Logger
- `obsidian` - Editor

### Features Layer (src/features/commands/)

**core/CommandEngine.ts** imports from:
- `../../../../main` - NovaPlugin
- `../../../ai/provider-manager` - AIProviderManager
- `../../../core/context-builder` - ContextBuilder
- `../../../core/document-engine` - DocumentEngine
- `../../../ui/streaming-manager` - StreamingManager
- `../../../utils/logger` - Logger
- `../types` - MarkdownCommand, CommandExecutionContext, SmartContext, ExecutionOptions, TemplateVariable

**core/SmartTimingEngine.ts** imports from:
- `../../../../main` - NovaPlugin
- `../../../utils/logger` - Logger
- `../../../utils/timeout-manager` - TimeoutManager
- `../types` - DocumentType, SmartTimingSettings, TimingDecision, TypingMetrics
- `./SmartVariableResolver` - SmartVariableResolver

**core/SmartVariableResolver.ts** imports from:
- `../../../../main` - NovaPlugin
- `../../../utils/logger` - Logger
- `../types` - SmartContext, TemplateVariable
- `obsidian` - Editor, MarkdownView

**ui/MarginIndicators.ts** imports from:
- `../../../../main` - NovaPlugin
- `../../../utils/logger` - Logger
- `../../../utils/timeout-manager` - TimeoutManager
- `../core/CommandEngine` - CommandEngine
- `../core/SmartTimingEngine` - SmartTimingEngine
- `../core/SmartVariableResolver` - SmartVariableResolver
- `../types` - MarkdownCommand, InsightDetection
- `./codemirror-decorations` - CodeMirrorIndicatorManager
- `./InsightPanel` - InsightPanel
- `@codemirror/view` - EditorView

**ui/InsightPanel.ts** imports from:
- `../../../../main` - NovaPlugin
- `../../../utils/logger` - Logger
- `../../../utils/timeout-manager` - TimeoutManager
- `../constants` - INSIGHT_PANEL, CSS_CLASSES
- `../core/CommandEngine` - CommandEngine
- `../types` - MarkdownCommand, InsightDetection

**ui/codemirror-decorations.ts** imports from:
- `../../../../main` - NovaPlugin
- `../../../utils/logger` - Logger
- `../types` - InsightDetection
- `@codemirror/state` - StateEffect, StateField
- `@codemirror/view` - Decoration, EditorView, WidgetType

### UI Layer (src/ui/)

**sidebar-view.ts** imports from:
- `../../main` - NovaPlugin
- `../ai/models` - getAvailableModels, getProviderTypeForModel
- `../ai/types` - ProviderType
- `../core/context-calculator` - formatContextUsage, getContextWarningLevel
- `../core/document-analysis` - DocumentAnalyzer
- `../core/types` - EditCommand, EditResult, ConversationMessage
- `../utils/logger` - Logger
- `../utils/timeout-manager` - TimeoutManager
- `./chat-renderer`, `./command-system`, `./context-manager`, `./context-quick-panel`
- `./input-handler`, `./selection-context-menu`, `./sidebar-events`, `./streaming-manager`

**context-manager.ts** imports from:
- `../../main` - NovaPlugin
- `../core/auto-context` - AutoContextService, AutoContextDocument
- `../core/context-calculator` - calculateContextUsage
- `../utils/logger` - Logger
- `obsidian` - TFile

**context-quick-panel.ts** imports from:
- `../../main` - NovaPlugin
- `../core/context-calculator` - formatContextUsage, getContextWarningLevel
- `../utils/logger` - Logger
- `../utils/timeout-manager` - TimeoutManager
- `./context-manager` - ContextManager
- `./input-handler` - InputHandler

**command-system.ts** imports from:
- `../../main` - NovaPlugin
- `../features/commands/core/CommandEngine` - CommandEngine
- `../features/commands/core/SmartVariableResolver` - SmartVariableResolver
- `../features/commands/types` - MarkdownCommand
- `../utils/logger` - Logger
- `../utils/timeout-manager` - TimeoutManager

**input-handler.ts** imports from:
- `../../main` - NovaPlugin
- `../utils/logger` - Logger
- `../utils/timeout-manager` - TimeoutManager
- `./command-system` - CommandSystem
- `./context-manager` - ContextManager
- `./wikilink-suggest` - NovaWikilinkAutocomplete

**streaming-manager.ts** imports from:
- `../../main` - NovaPlugin
- `../utils/logger` - Logger
- `../utils/timeout-manager` - TimeoutManager
- `obsidian` - Editor, Notice, EditorPosition

**selection-context-menu.ts** imports from:
- `../../main` - NovaPlugin
- `../constants` - CHALLENGE_SYSTEM_PROMPT
- `../core/commands/selection-edit-command` - SelectionEditCommand
- `../features/commands/core/CommandEngine` - CommandEngine
- `../utils/logger` - Logger
- `./custom-instruction-modal` - CustomInstructionModal
- `./sidebar-events` - dispatchSidebarProcessing, dispatchSidebarChatMessage
- `./streaming-manager` - StreamingManager
- `./tone-selection-modal` - ToneSelectionModal

**sidebar-events.ts** imports from:
- (no local imports - leaf module)

**chat-renderer.ts** imports from:
- `../../main` - NovaPlugin
- `../utils/logger` - Logger
- `../utils/timeout-manager` - TimeoutManager

**provider-manager.ts** imports from:
- `../../main` - NovaPlugin
- `../ai/models` - getAvailableModels
- `../utils/logger` - Logger

### Licensing Layer (src/licensing/)

**license-validator.ts** imports from:
- `./types` - SupernovaLicense, SupernovaValidationResult, LicenseError
- `../core/crypto-service` - CryptoService

**feature-manager.ts** imports from:
- `./license-validator` - LicenseValidator
- `./types` - SupernovaLicense, FeatureFlag, FeatureAccessResult, DebugSettings
- `./feature-config` - SUPERNOVA_FEATURES, TimeGatedFeature

## Architectural Layers

```
┌─────────────────────────────────────────────────┐
│                    UI Layer                      │
│  sidebar-view, input-handler, streaming-manager  │
│  chat-renderer, context-manager, command-system  │
│  context-quick-panel, selection-context-menu     │
│  sidebar-events, provider-manager                │
└─────────────────────┬───────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────┐
│                Features Layer                    │
│  commands/core/* (CommandEngine, SmartTiming)    │
│  commands/ui/* (MarginIndicators, InsightPanel)  │
└─────────────────────┬───────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────┐
│                   Core Layer                     │
│  document-engine, conversation-manager           │
│  prompt-builder, context-builder, intent-*       │
│  auto-context, context-calculator                │
│  commands/* (add, edit, delete, grammar, etc)    │
└─────────────────────┬───────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────┐
│                    AI Layer                      │
│  provider-manager, models                        │
│  providers/* (claude, openai, google, ollama)    │
└─────────────────────┬───────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────┐
│                 Utils/Licensing                  │
│  logger, timeout-manager, version                │
│  feature-manager, license-validator              │
│  crypto-service                                  │
└─────────────────────────────────────────────────┘
```

## Recent Changes

| Commit | Summary |
|--------|---------|
| 1e0d23e | refactor(ui): remove context drawer, add quick panel mobile support |
| b1c6814 | fix: address code review - persist auto-context, use cachedRead, fix DOM leak |
| 895b452 | fix: address PR review comments - tests, CSS, backlinks, performance |
| e630f5f | feat: Auto-Context System and Sidebar Quick Panel (v1.3) |
| a330cde | fix(sidebar): remove insight depth button and clean up orphaned symbols |
| dfedfb2 | refactor: decouple SelectionContextMenu, extract sidebar subcomponents |
| e414eef | fix(deps): pin codemirror packages to obsidian peer versions |
| fe03951 | fix(deps): pin obsidian types and add missing codemirror deps |
| a156a61 | chore(tooling): add hygiene checks to pr-review workflow |
| 5f6bae2 | refactor: merge models.ts and context-limits.ts into single source of truth (#8) |

---

*Generated by `/project:sync-codebase`. See `.claude/skills/nova-patterns/SKILL.md` for coding standards.*
