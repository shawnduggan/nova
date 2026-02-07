---
name: nova-codebase
description: Auto-generated Nova codebase map. Regenerate with /project:sync-codebase
generated: 2026-02-07
---

# Nova Codebase Map

> This file is auto-generated. Do not edit manually.
> Regenerate with: `/project:sync-codebase`

## File Structure

### src/ai/

| File | Description | Key Exports |
|------|-------------|-------------|
| `context-limits.ts` | Token and context window limits per AI model | `ContextLimit`, `ProviderContextLimits`, `getContextLimit()`, `getProviderContextLimits()`, `getModelMaxOutputTokens()`, `hasKnownContextLimit()` |
| `models.ts` | Centralized model definitions for all AI providers | `ModelDefinition`, `ModelConfig`, `getProviderTypeForModel()`, `getAvailableModels()` |
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
| `types.ts` | Type definitions for the Nova Commands system | `MarkdownCommand`, `TemplateVariable`, `SmartContext`, `CommandExecutionContext`, `ExecutionOptions`, `DocumentType`, `CommandSuggestionsSettings`, `TimingDecision`, `TypingMetrics`, `CommandRegistry`, `InsightDetection` |

### src/features/commands/core/

| File | Description | Key Exports |
|------|-------------|-------------|
| `CommandEngine.ts` | Core system for executing commands and the /fill command | `MarkerInsight`, `insertSmartFillPlaceholder()`, `CommandEngine` |
| `SmartTimingEngine.ts` | Centralized timing service for command features | `TimingEvents`, `SmartTimingEngine` |
| `SmartVariableResolver.ts` | Intelligent resolution of template variables | `SmartVariableResolver` |

### src/features/commands/ui/

| File | Description | Key Exports |
|------|-------------|-------------|
| `InsightPanel.ts` | Full intelligence panel for command selection | `SpecificIssue`, `IndicatorOpportunity`, `InsightPanel` |
| `MarginIndicators.ts` | Intelligent margin indicators for command suggestions | `SpecificIssue`, `IndicatorOpportunity`, `MarginIndicators` |
| `codemirror-decorations.ts` | CodeMirror decorations for margin indicators | `IndicatorOpportunity`, `addIndicatorEffect`, `removeIndicatorEffect`, `clearIndicatorsEffect`, `IndicatorWidget`, `CodeMirrorIndicatorManager` |

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
| `chat-renderer.ts` | Renders conversation messages in sidebar | `ChatRenderer`, `MessageOptions` |
| `command-system.ts` | Handles slash command detection and picker UI | `CommandSystem` |
| `context-manager.ts` | Manages multi-document context in sidebar | `DocumentReference`, `MultiDocContext`, `ContextManager` |
| `custom-command-modal.ts` | Modal for creating/editing custom commands | `CustomCommandModal` |
| `custom-instruction-modal.ts` | Modal for custom editing instructions | `CustomInstructionModal` |
| `input-handler.ts` | Handles text input and keyboard events | `InputHandler` |
| `provider-manager.ts` | UI components for provider/model selection | `ProviderManager` |
| `selection-context-menu.ts` | Context menu for text selection actions | `SelectionAction`, `SELECTION_ACTIONS`, `SelectionContextMenu` |
| `sidebar-view.ts` | Main sidebar view with chat interface | `VIEW_TYPE_NOVA_SIDEBAR`, `NovaSidebarView` |
| `streaming-manager.ts` | Manages AI response streaming to editor | `StreamingOptions`, `ActionType`, `StreamingManager` |
| `tone-selection-modal.ts` | Modal for selecting rewrite tone | `ToneOption`, `TONE_OPTIONS`, `ToneSelectionModal` |
| `wikilink-suggest.ts` | Autocomplete for [[wikilinks]] in input | `NovaWikilinkAutocomplete` |

### src/utils/

| File | Description | Key Exports |
|------|-------------|-------------|
| `logger.ts` | Centralized logging utility with levels | `LogLevel`, `Logger`, `ScopedLogger` |
| `timeout-manager.ts` | Obsidian-compliant timeout management | `TimeoutManager` |

### src/ (root)

| File | Description | Key Exports |
|------|-------------|-------------|
| `constants.ts` | Shared constants and magic strings | `NOVA_CONVERSATIONS_STORAGE_KEY`, `VIEW_TYPE_NOVA_SIDEBAR`, `NOVA_STAR_ICON`, `NOVA_SUPERNOVA_ICON`, `PROVIDER_*`, `CHATGPT_ALIAS`, `GEMINI_ALIAS` |
| `settings.ts` | Plugin settings UI and configuration | `CustomCommand`, `NovaSettings`, `DEFAULT_SETTINGS`, `NovaSettingTab`, `ConfirmModal` |

## Component Dependencies

### AI Layer (src/ai/)

**provider-manager.ts** imports from:
- `./types` - AIProvider, ProviderType, AIMessage, AIGenerationOptions, AIStreamResponse
- `./providers/claude`, `./providers/openai`, `./providers/google`, `./providers/ollama`
- `./models` - getProviderTypeForModel
- `./context-limits` - getModelMaxOutputTokens

**providers/*.ts** import from:
- `../types` - AIProvider, AIMessage, AIStreamResponse, ProviderConfig
- `obsidian` - requestUrl

### Core Layer (src/core/)

**document-engine.ts** imports from:
- `./types` - DocumentContext, EditResult, EditCommand, HeadingInfo, EditOptions
- `./conversation-manager` - ConversationManager, DataStore
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

**commands/*.ts** import from:
- `../document-engine` - DocumentEngine
- `../context-builder` - ContextBuilder, GeneratedPrompt
- `../../ai/provider-manager` - AIProviderManager
- `../types` - EditCommand, EditResult, DocumentContext

### Features Layer (src/features/commands/)

**core/CommandEngine.ts** imports from:
- `../../../utils/logger` - Logger
- `../../../ui/streaming-manager` - StreamingManager
- `../../../ai/provider-manager` - AIProviderManager
- `../../../core/context-builder` - ContextBuilder
- `../../../core/document-engine` - DocumentEngine
- `../types` - MarkdownCommand, CommandExecutionContext, SmartContext, ExecutionOptions, TemplateVariable

**core/SmartTimingEngine.ts** imports from:
- `../../../utils/logger` - Logger
- `./SmartVariableResolver` - SmartVariableResolver
- `../types` - DocumentType, SmartTimingSettings, TimingDecision, TypingMetrics

**ui/MarginIndicators.ts** imports from:
- `../core/SmartVariableResolver` - SmartVariableResolver
- `../core/CommandEngine` - CommandEngine, MarkerInsight
- `../core/SmartTimingEngine` - SmartTimingEngine
- `./InsightPanel` - InsightPanel
- `./codemirror-decorations` - CodeMirrorIndicatorManager

### UI Layer (src/ui/)

**sidebar-view.ts** imports from:
- `../core/document-analysis` - DocumentAnalyzer
- `../core/types` - EditCommand, EditResult
- `./context-manager` - ContextManager, MultiDocContext
- `../ai/models` - getAvailableModels, getProviderTypeForModel
- `../ai/types` - ProviderType
- `./input-handler`, `./command-system`, `./chat-renderer`, `./streaming-manager`
- `./selection-context-menu` - SelectionContextMenu, SELECTION_ACTIONS
- `../core/context-calculator` - formatContextUsage, getContextWarningLevel
- `../utils/logger`, `../utils/timeout-manager`

**command-system.ts** imports from:
- `../features/commands/core/CommandEngine` - CommandEngine
- `../features/commands/core/SmartVariableResolver` - SmartVariableResolver
- `../features/commands/types` - MarkdownCommand
- `../utils/logger`, `../utils/timeout-manager`

**streaming-manager.ts** imports from:
- `../utils/logger` - Logger
- `../utils/timeout-manager` - TimeoutManager
- `obsidian` - Editor, Notice, EditorPosition

**selection-context-menu.ts** imports from:
- `../features/commands/core/CommandEngine` - CommandEngine
- `../core/commands/selection-edit-command` - SelectionEditCommand
- `./tone-selection-modal` - ToneSelectionModal
- `./custom-instruction-modal` - CustomInstructionModal
- `./sidebar-view`, `./streaming-manager`
- `../utils/logger`

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
│  commands/* (add, edit, delete, grammar, etc)    │
└─────────────────────┬───────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────┐
│                    AI Layer                      │
│  provider-manager, models, context-limits        │
│  providers/* (claude, openai, google, ollama)    │
└─────────────────────┬───────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────┐
│                 Utils/Licensing                  │
│  logger, timeout-manager, feature-manager        │
│  license-validator, crypto-service               │
└─────────────────────────────────────────────────┘
```

## Recent Changes

| Commit | Summary |
|--------|---------|
| b56bd00 | 1.1.0 |
| a18c728 | fix(claude): reorder Opus 4.6 to top of model list and update legacy model IDs |
| 3cd4821 | docs(readme): update Smart fill casing, dates, and context menu entry |
| 02baccd | feat(smartfill): add Smart fill to right-click context menu |
| cbd5222 | chore(smartfill): move availability dates earlier (Mar 1 / May 1) |
| 8063fe1 | docs(readme): revise tone and add Smart Fill documentation |
| 9884fb0 | fix(smartfill): align button tooltip and icon color with settings terminology |
| ce80bfe | refactor(ui): anchor privacy indicator next to token usage |
| 43fb160 | refactor(smartfill): rename "commands" feature to "smartfill" and fix palette bug |
| 5eecbb6 | chore(codebase): add @file headers to commands feature files |

---

*Generated by `/project:sync-codebase`. See `.claude/skills/nova-patterns/SKILL.md` for coding standards.*
